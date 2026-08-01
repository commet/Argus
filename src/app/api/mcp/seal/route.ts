import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { adminClient } from '@/lib/share-guard';
import { isTokenExpired } from '@/lib/plugin-token';
import type { JudgmentReceipt } from '@/lib/review';
import { sanitizeTrackedPremises } from '@/lib/mcp-seal-routing';

/**
 * MCP → account bridge (design: "MCP도 이메일로 귀환"). The argus-decision-mcp `argus_seal`
 * / `argus_settle` tools POST here when the user has configured an account token
 * (opt-in — no token ⇒ the seal stays local, privacy preserved). We resolve the
 * PAT → user (same plugin_tokens table the `argus push` bridge uses) and land
 * the sealed prediction in `review_receipts`, so it appears in the user's Active
 * Course dashboard AND the Companion Brief cron emails it at its check-by date.
 *
 * Server-to-server (PAT auth, no browser Origin) — deliberately no CSRF check.
 * The whole prediction rides in the receipt's `data` jsonb (drift-proof); only
 * next_check_by/state are lifted for the cron, matching the webapp seal path.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_BODY_BYTES = 64 * 1024;

function hashToken(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}

interface SealPayload {
  action?: 'seal' | 'settle' | 'defer' | 'dismiss';
  id?: string;
  predicate?: string;
  pass_condition?: string;
  fail_condition?: string;
  check_by?: string;
  sealed_at?: string;
  source_title?: string;
  real_question?: string;
  human_judgment?: string;
  // settle
  outcome?: 'happened' | 'avoided' | 'partial' | 'unclear' | 'missed';
  what_happened?: string;
  settled_at?: string;
  /** M3 opt-in premise sync: the sealed decision's monitored premises (the MCP
   *  sends them ONLY when the user set premise_sync:true). Stored so the
   *  autonomous premise-watch (T2) covers terminal premises too. */
  tracked_premises?: Array<Record<string, unknown>>;
}

/** Sanitize opt-in premises to the PremiseState shape premise-watch consumes —
 *  bounded (≤7, text ≤400), monitored-only fields; never trust the wire.
 *  Exported for the M3 seam test (MCP wire shape → premise-watch consumption). */
/**
 * MCP outcome vocabulary → the web's.
 *
 * A Map, not an object literal: `OBJ[body.outcome]` with a body off the network
 * resolves inherited keys, so `outcome:"constructor"` yielded a truthy Function
 * that sailed past the `|| 'unclear'` fallback and was written into the receipt.
 *
 * `still_pending`/`unclear` mean reality has not answered. They are a DEFERRAL,
 * never a settlement — the settle branch refuses them outright.
 */
const OUTCOME_MAP = new Map<string, JudgmentReceipt['falsifiable_followups'][number]['outcome']>([
  ['held', 'happened'], ['happened', 'happened'],
  ['avoided', 'avoided'],
  ['partial', 'partial'],
  ['missed', 'missed'],
  ['still_pending', 'unclear'], ['unclear', 'unclear'],
]);

function rowId(id: string): string {
  return `mcp_${id}`;
}

function buildReceipt(p: SealPayload, now: string): JudgmentReceipt {
  const id = String(p.id);
  const predicate = String(p.predicate);
  return {
    receipt_id: rowId(id),
    kind: 'judgment',
    root_mode: 'judgment',
    state: 'sealed',
    artifact_id: rowId(id),
    source_kind: 'mcp_file',
    source_title: (p.source_title || predicate).slice(0, 200),
    source_fingerprint: id,
    core_question: (p.real_question || p.source_title || predicate).slice(0, 400),
    judgment_obligations: p.human_judgment
      ? [{ obligation_id: `o_${id}`, statement: p.human_judgment.slice(0, 400), owner: 'user', why_human: '', evidence_needed: '', anchors: [], owned_by_user: true }]
      : [],
    claim_ledger: [], hidden_assumptions: [], forks: [], findings: [],
    current_heading: '',
    falsifiable_followups: [{
      followup_id: `f_${id}`,
      predicate,
      predicate_owner: 'user',
      pass_condition: p.pass_condition || '',
      fail_condition: p.fail_condition || '',
      check_by: String(p.check_by),
      sealed_at: p.sealed_at || now,
    }],
    companion_thread: [],
    ...(sanitizeTrackedPremises(p.tracked_premises) ? { tracked_premises: sanitizeTrackedPremises(p.tracked_premises) } : {}),
    provenance: {
      schema_version: '1', extraction_tool: 'argus-decision-mcp', extraction_version: '1', lens_versions: {},
      model_provider: 'unknown', model_name: 'argus-decision-mcp', prompt_hash: '', created_at: now,
    },
    created_at: now, updated_at: now,
  };
}

export async function POST(req: NextRequest) {
  const ct = req.headers.get('content-type') || '';
  if (!ct.includes('application/json')) {
    return NextResponse.json({ error: 'Content-Type must be application/json' }, { status: 415 });
  }
  const cl = req.headers.get('content-length');
  if (cl && parseInt(cl, 10) > MAX_BODY_BYTES) {
    return NextResponse.json({ error: 'Payload too large' }, { status: 413 });
  }

  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Missing token. Set ARGUS_TOKEN in your MCP config.' }, { status: 401 });
  }
  const raw = authHeader.slice(7).trim();
  if (!raw.startsWith('argus_pat_')) {
    return NextResponse.json({ error: 'Invalid token format' }, { status: 401 });
  }

  const admin = adminClient();
  const { data: tokenRow } = await admin
    .from('plugin_tokens')
    .select('id, user_id, expires_at')
    .eq('token_hash', hashToken(raw))
    .single();
  if (!tokenRow || isTokenExpired(tokenRow.expires_at)) {
    return NextResponse.json({ error: 'Unknown, revoked, or expired token' }, { status: 401 });
  }

  let body: SealPayload;
  try {
    body = (await req.json()) as SealPayload;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const id = typeof body.id === 'string' ? body.id.trim() : '';
  if (!id || !/^[A-Za-z0-9._-]{1,128}$/.test(id)) {
    return NextResponse.json({ error: 'valid id required' }, { status: 400 });
  }
  const now = new Date().toISOString();
  const action = body.action ?? 'seal';

  admin.from('plugin_tokens').update({ last_used_at: now }).eq('id', tokenRow.id)
    .then(({ error }) => { if (error) console.error('[mcp/seal] last_used:', error.message); });

  // ── DISMISS: the user set this decision aside in the terminal. The account must
  //    stop nudging it. `archived` (not `settled`) is the honest state: nothing
  //    reality said was recorded, and the Companion Brief only selects `sealed`.
  //    Without this, argus_dismiss told the account nothing and the Brief kept
  //    emailing a decision the user had explicitly killed.
  if (action === 'dismiss') {
    const { data: existing } = await admin
      .from('review_receipts')
      .select('data')
      .eq('id', rowId(id))
      .eq('user_id', tokenRow.user_id)
      .is('deleted_at', null)
      .single();
    if (!existing?.data) {
      return NextResponse.json({ ok: true, updated: false, reason: 'not_synced' });
    }
    const receipt = existing.data as JudgmentReceipt;
    receipt.state = 'archived';
    receipt.updated_at = now;
    const { error } = await admin
      .from('review_receipts')
      .update({ state: 'archived', next_check_by: null, data: receipt })
      .eq('id', rowId(id))
      .eq('user_id', tokenRow.user_id);
    if (error) {
      console.error('[mcp/seal] dismiss update:', error.message);
      return NextResponse.json({ error: 'dismiss failed' }, { status: 502 });
    }
    return NextResponse.json({ ok: true, updated: true, state: 'archived' });
  }

  // ── DEFER: reality has not answered. Push the check-by; the record stays alive.
  //    Deliberately NOT an `action:'seal'` re-push: that upserts a freshly built
  //    receipt over `data`, wiping any premises or edits the user made on the web.
  if (action === 'defer') {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(body.check_by))) {
      return NextResponse.json({ error: 'check_by (YYYY-MM-DD) required to defer' }, { status: 400 });
    }
    const { data: existing } = await admin
      .from('review_receipts')
      .select('data')
      .eq('id', rowId(id))
      .eq('user_id', tokenRow.user_id)
      .is('deleted_at', null)
      .single();
    if (!existing?.data) {
      return NextResponse.json({ ok: true, updated: false, reason: 'not_synced' });
    }
    const receipt = existing.data as JudgmentReceipt;
    const newCheckBy = String(body.check_by);
    receipt.falsifiable_followups = (receipt.falsifiable_followups || []).map((f) =>
      f.followup_id === `f_${id}`
        ? {
            ...f,
            check_by: newCheckBy,
            revise_count: (f.revise_count ?? 0) + 1,
            first_check_by: f.first_check_by ?? f.check_by,
            ...(body.what_happened ? { defer_reason: String(body.what_happened).slice(0, 600) } : {}),
          }
        : f,
    );
    receipt.updated_at = now;
    const { error } = await admin
      .from('review_receipts')
      .update({ state: 'sealed', next_check_by: newCheckBy, data: receipt })
      .eq('id', rowId(id))
      .eq('user_id', tokenRow.user_id);
    if (error) {
      console.error('[mcp/seal] defer update:', error.message);
      return NextResponse.json({ error: 'defer failed' }, { status: 502 });
    }
    return NextResponse.json({ ok: true, updated: true, state: 'sealed', check_by: newCheckBy });
  }

  // ── SETTLE: reality answered. Patch the synced row; no-op if never synced. ──
  if (action === 'settle') {
    // An unknown word must not silently become "unclear" — the old
    // `OUTCOME_MAP[x] || 'unclear'` turned every typo, and every prototype key,
    // into a terminal settlement. Reject what is not in the vocabulary.
    const mapped = typeof body.outcome === 'string' ? OUTCOME_MAP.get(body.outcome) : undefined;
    if (!mapped) {
      return NextResponse.json({ error: 'unknown outcome' }, { status: 400 });
    }
    // "unclear" is reality staying silent, which is a deferral, not a settlement.
    // Filing it stamped settled_at, flipped the receipt terminal, and dropped the
    // decision out of the dashboard, the due badge and the Companion Brief email.
    if (mapped === 'unclear') {
      return NextResponse.json({
        ok: true, updated: false, reason: 'not_a_settlement',
        detail: 'Reality has not answered. Send action:"defer" with a new check_by instead.',
      });
    }
    const { data: existing } = await admin
      .from('review_receipts')
      .select('data')
      .eq('id', rowId(id))
      .eq('user_id', tokenRow.user_id)
      .is('deleted_at', null)
      .single();
    if (!existing?.data) {
      return NextResponse.json({ ok: true, updated: false, reason: 'not_synced' });
    }
    const receipt = existing.data as JudgmentReceipt;
    const settledAt = body.settled_at || now;
    receipt.falsifiable_followups = (receipt.falsifiable_followups || []).map((f) =>
      f.followup_id === `f_${id}`
        ? { ...f, outcome: mapped, what_happened: (body.what_happened || '').slice(0, 600), settled_at: settledAt }
        : f,
    );
    receipt.state = 'settled';
    receipt.updated_at = settledAt;
    const { error } = await admin
      .from('review_receipts')
      .update({ state: 'settled', next_check_by: null, data: receipt })
      .eq('id', rowId(id))
      .eq('user_id', tokenRow.user_id);
    if (error) {
      console.error('[mcp/seal] settle update:', error.message);
      return NextResponse.json({ error: 'settle failed' }, { status: 502 });
    }
    return NextResponse.json({ ok: true, updated: true, state: 'settled' });
  }

  // ── SEAL: land the prediction so it surfaces + emails at check-by. ──
  if (!body.predicate || String(body.predicate).trim().length < 4 || !/^\d{4}-\d{2}-\d{2}$/.test(String(body.check_by))) {
    return NextResponse.json({ error: 'predicate and check_by (YYYY-MM-DD) required' }, { status: 400 });
  }
  const receipt = buildReceipt(body, now);
  const { error } = await admin.from('review_receipts').upsert(
    {
      id: rowId(id),
      user_id: tokenRow.user_id,
      state: 'sealed',
      source_title: receipt.source_title,
      source_kind: 'mcp_file',
      next_check_by: String(body.check_by),
      data: receipt,
      deleted_at: null,
    },
    { onConflict: 'id' },
  );
  if (error) {
    console.error('[mcp/seal] upsert:', error.message);
    return NextResponse.json({ error: 'seal sync failed' }, { status: 502 });
  }
  return NextResponse.json({ ok: true, synced: true, id: rowId(id), check_by: body.check_by });
}
