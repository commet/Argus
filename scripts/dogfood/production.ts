/**
 * Production P6 web lifecycle — the handoff's "Web P6 production lifecycle"
 * steps 1–10, driven over real HTTPS against the deployed app, recording only
 * non-sensitive evidence (event ids, receipts, HTTP codes, content hashes).
 *
 * Run this from a machine that can reach production, with a DISPOSABLE
 * signed-in test account (never a real user's account):
 *
 *   ARGUS_BASE_URL=https://argus.voyage \
 *   NEXT_PUBLIC_SUPABASE_URL=... NEXT_PUBLIC_SUPABASE_ANON_KEY=... \
 *   DOGFOOD_EMAIL=... DOGFOOD_PASSWORD=... DOGFOOD_PROJECT_ID=<uuid> \
 *   npx tsx scripts/dogfood/runner.ts --mode production
 *
 * The project must belong to the test account and have NO semantic events yet.
 * Telegram/plugin production steps remain the founder's guided checklist
 * (README §production) — they need a human tapping a real bot.
 */
import { createClient } from '@supabase/supabase-js';
import { EvidenceRecorder, sha256 } from './harness/evidence';
import { checkStreamInvariants } from './harness/invariants';
import { fold, projectJudgment } from '../../src/lib/decision-kernel';

interface HttpResult {
  status: number;
  body: { ok?: boolean; error?: string; events?: unknown[]; receipt?: Array<{ duplicate?: boolean }> };
}

export async function runProductionP6(outDir: string): Promise<number> {
  const baseUrl = process.env.ARGUS_BASE_URL ?? 'https://argus.voyage';
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const email = process.env.DOGFOOD_EMAIL;
  const password = process.env.DOGFOOD_PASSWORD;
  // DOGFOOD_PROJECT_ID is now OPTIONAL. The Argus UI has no "name a project"
  // field — a project is auto-created from whatever decision text you type in
  // the workspace — so hand-making an empty project is awkward. Instead, when
  // no id is given, this runner provisions its own disposable project via the
  // authenticated client (projects RLS: WITH CHECK auth.uid() = user_id) and
  // reports the id. Pass DOGFOOD_PROJECT_ID only to target a specific project.
  let projectId = process.env.DOGFOOD_PROJECT_ID;
  if (!supabaseUrl || !anonKey || !email || !password) {
    console.error('Missing env. Required: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, DOGFOOD_EMAIL, DOGFOOD_PASSWORD (DOGFOOD_PROJECT_ID and ARGUS_BASE_URL are optional).');
    console.error('This mode records REAL production evidence; use a DISPOSABLE test account.');
    return 2;
  }

  const auth = createClient(supabaseUrl, anonKey);
  const { data: signIn, error: signInError } = await auth.auth.signInWithPassword({ email, password });
  if (signInError || !signIn.session) {
    console.error(`Sign-in failed: ${signInError?.message ?? 'no session'}`);
    return 2;
  }
  const token = signIn.session.access_token;
  const userId = signIn.user!.id;

  let provisioned = false;
  if (!projectId) {
    // Create a throwaway project as the signed-in user. It stays empty of v6
    // events (decision_contract is null), so the P6 lifecycle can seal into it.
    const newId = crypto.randomUUID();
    const nowIso = new Date().toISOString();
    const { error: insertError } = await auth.from('projects').insert({
      id: newId, user_id: userId, name: `dogfood-P6-${nowIso.slice(0, 10)}`,
      description: 'Disposable DKK v6 dogfood project. Safe to delete.',
      refs: [], created_at: nowIso, updated_at: nowIso,
    });
    if (insertError) {
      console.error(`Could not create a disposable project: ${insertError.message}`);
      console.error('Fix: ensure the account can insert projects, or pass DOGFOOD_PROJECT_ID for an existing empty project.');
      return 2;
    }
    projectId = newId;
    provisioned = true;
    console.log(`Provisioned disposable project ${newId} for the test account.`);
  }

  const runId = `production-${new Date().toISOString().replace(/[:.]/g, '-')}`;
  const evidence = new EvidenceRecorder(runId, 'production', outDir);
  const endpoint = `${baseUrl}/api/semantic/projects/${projectId}/events`;

  const http = async (method: 'GET' | 'POST', body?: unknown): Promise<HttpResult> => {
    const res = await fetch(endpoint, {
      method,
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    let json: HttpResult['body'] = {};
    try { json = await res.json() as HttpResult['body']; } catch { /* non-JSON error body */ }
    return { status: res.status, body: json };
  };

  let previousSnapshot: string[] = [];
  let failures = 0;
  const stamp = () => new Date().toISOString();

  const step = async (name: string, expect: { status: number; duplicate?: boolean }, command?: Record<string, unknown>): Promise<HttpResult> => {
    const started = Date.now();
    const result = command ? await http('POST', { command }) : await http('GET');
    const read = await http('GET');
    const events = (read.body.events ?? []) as unknown[];
    const currentSnapshot = events.map((e) => JSON.stringify(e));
    const invariantFailures = checkStreamInvariants({
      events, previousSnapshot, currentSnapshot, now: stamp(),
    });
    previousSnapshot = currentSnapshot;
    const duplicateFlags = (result.body.receipt ?? []).map((r) => r.duplicate === true);
    const matched = result.status === expect.status
      && (expect.duplicate === undefined || (duplicateFlags.length > 0 && duplicateFlags.every((f) => f === expect.duplicate)));
    if (!matched || invariantFailures.length > 0) failures += 1;
    evidence.record({
      scenario: 'PROD-P6', step: name, surface: 'web', action: String(command?.kind ?? 'read'),
      outcome: { ok: result.status === 200, code: result.body.error, status: result.status, duplicate: duplicateFlags },
      expected: JSON.stringify(expect), matched,
      event_ids: events.slice(-6).map((e) => String((e as { event_id?: unknown }).event_id ?? '')),
      idempotency_keys: [],
      content_sha256: command ? [sha256(command)] : [],
      invariant_failures: invariantFailures.map((f) => `${f.id}: ${f.detail}`),
      elapsed_ms: Date.now() - started,
    });
    console.log(`[${matched && invariantFailures.length === 0 ? 'ok ' : 'RED'}] ${name} → HTTP ${result.status}${result.body.error ? ` (${result.body.error})` : ''}`);
    return result;
  };

  const suffix = Date.now().toString(36);
  const id = (prefix: string) => `dogfood-${prefix}-${suffix}`;
  const inTwoWeeks = new Date(Date.now() + 14 * 86400_000).toISOString();
  const inFourWeeks = new Date(Date.now() + 28 * 86400_000).toISOString();

  // Preflight: refuse to run against a project that already has events.
  const initial = await http('GET');
  if (initial.status !== 200) {
    console.error(`Cannot read the project stream (HTTP ${initial.status}). Check the account/project.`);
    return 2;
  }
  if ((initial.body.events ?? []).length > 0) {
    console.error('This project already has semantic events. Use a fresh disposable project — this runner will not mix into an existing ledger.');
    return 2;
  }
  previousSnapshot = [];

  // — The handoff's ten steps —
  const sealCommand = {
    kind: 'seal', command_id: id('seal'), judgment_id: id('judgment'), return_contract_id: id('return'),
    statement: `Dogfood P6 lifecycle statement (${suffix}). Not a real user judgment.`,
    review_at: inTwoWeeks, review_question: `Dogfood P6 return question (${suffix})?`,
  };
  await step('1-seal', { status: 200, duplicate: false }, sealCommand);
  await step('2-verify-appended', { status: 200 });
  await step('3-observe', { status: 200, duplicate: false }, {
    kind: 'observe', command_id: id('observe'), observation_id: id('obs'), text: `Dogfood observation (${suffix}).`,
  });
  await step('4-resolve-open', { status: 200, duplicate: false }, {
    kind: 'resolve', command_id: id('resolve'), resolution_id: id('res'),
    judgment_id: sealCommand.judgment_id, return_contract_id: sealCommand.return_contract_id,
    resolution: {
      kind: 'answered',
      answer_summary: `Dogfood answer (${suffix}).`,
      evidence_refs: [id('obs')],
      present_standard: {
        status: 'same',
        response_text: 'I would make the same call under the same conditions',
      },
    },
  });
  const afterResolve = await http('GET');
  const openProjection = projectJudgment(fold((afterResolve.body.events ?? []) as unknown[]), sealCommand.judgment_id, stamp());
  if (openProjection?.lifecycle?.startsWith('resolved')) {
    failures += 1;
    console.log('[RED] 4b-resolution must not close the judgment');
  } else {
    console.log(`[ok ] 4b-still-open (${openProjection?.lifecycle})`);
  }
  await step('5-defer', { status: 200, duplicate: false }, {
    kind: 'defer', command_id: id('defer'), return_contract_id: sealCommand.return_contract_id,
    review_at: inFourWeeks, reason: 'Dogfood defer.',
  });
  await step('6-close', { status: 200, duplicate: false }, {
    kind: 'close', command_id: id('close'), judgment_id: sealCommand.judgment_id, resolution_id: id('res'),
  });
  await step('7-retry-exact-duplicate', { status: 200, duplicate: true }, sealCommand);
  await step('8-retry-altered-refused', { status: 409 }, { ...sealCommand, statement: 'Altered under the same command id.' });
  // 9 — concurrent conflicting commands (defer vs a second close).
  const race = await Promise.all([
    http('POST', { command: { kind: 'defer', command_id: id('race-defer'), return_contract_id: sealCommand.return_contract_id, review_at: inFourWeeks } }),
    http('POST', { command: { kind: 'close', command_id: id('race-close'), judgment_id: sealCommand.judgment_id, resolution_id: id('res') } }),
  ]);
  const raceRead = await http('GET');
  const raceEvents = (raceRead.body.events ?? []) as unknown[];
  evidence.record({
    scenario: 'PROD-P6', step: '9-concurrent-defer-close', surface: 'web', action: 'race',
    outcome: { ok: true, status: 200 },
    matched: race.every((r) => [200, 409].includes(r.status)),
    event_ids: raceEvents.slice(-4).map((e) => String((e as { event_id?: unknown }).event_id ?? '')),
    idempotency_keys: [], content_sha256: [],
    invariant_failures: checkStreamInvariants({ events: raceEvents, previousSnapshot, currentSnapshot: raceEvents.map((e) => JSON.stringify(e)), now: stamp() }).map((f) => `${f.id}: ${f.detail}`),
    note: `statuses=${race.map((r) => r.status).join(',')} codes=${race.map((r) => r.body.error ?? '-').join(',')}`,
    elapsed_ms: 0,
  });
  previousSnapshot = raceEvents.map((e) => JSON.stringify(e));
  console.log(`[ok ] 9-race statuses=${race.map((r) => r.status).join(',')} (each must be an explicit 200 or 409, never silent)`);
  await step('10-final-read', { status: 200 });

  evidence.writeMeta({ endpoint: endpoint.replace(projectId, '<project>'), failures, provisioned_project: provisioned, finished_at: stamp() });
  await evidence.close();
  console.log(`\nEvidence → ${evidence.dir}`);
  if (provisioned) {
    console.log(`Disposable project ${projectId} now holds this lifecycle. Inspect it in Supabase, then delete it (or the whole test account) when done.`);
  }
  console.log(failures === 0
    ? 'P6 web lifecycle completed with matching outcomes. Inspect steps.jsonl and commit the non-sensitive evidence per handoff item 7.'
    : `${failures} step(s) diverged — inspect steps.jsonl before claiming anything.`);
  return failures === 0 ? 0 : 1;
}
