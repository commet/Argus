import { NextRequest, NextResponse } from 'next/server';
import { adminClient } from '@/lib/share-guard';
import { authenticatePluginToken, SCOPE_FULL } from '@/lib/plugin-token-auth';
import type { JudgmentReceipt } from '@/lib/review';

/**
 * MCP pull side of the sync (design doc §연결 방식 — bidirectional). `argus_sync`
 * GETs the user's account receipts (PAT-authed) so the terminal can surface
 * "your live judgments + what's due" without the webapp. Read-only summary — the
 * full receipt jsonb stays server-side; we return only what a terminal lists.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  // 계정 전체 범위를 요구한다. 원격 커넥터가 동의로 받아 가는 `argus.decisions`
  // 토큰은 여기 들어올 수 없다 — 그 동의 화면은 결정 기록만 말했다.
  const auth = await authenticatePluginToken(req.headers.get('authorization'), SCOPE_FULL);
  if (!auth.ok) {
    if (auth.reason === 'insufficient_scope') {
      return NextResponse.json({ error: 'This token is not scoped for account receipts' }, { status: 403 });
    }
    return NextResponse.json({ error: 'Missing, invalid, revoked, or expired token' }, { status: 401 });
  }

  const admin = adminClient();
  const { data: rows, error } = await admin
    .from('review_receipts')
    .select('id, state, next_check_by, data')
    .eq('user_id', auth.userId)
    .is('deleted_at', null)
    .order('next_check_by', { ascending: true, nullsFirst: false })
    .limit(500);
  if (error) {
    return NextResponse.json({ error: 'query failed' }, { status: 500 });
  }

  const today = new Date().toISOString().slice(0, 10);
  const receipts = (rows || []).map((r) => {
    const d = r.data as JudgmentReceipt;
    const open = (d.falsifiable_followups || []).filter((f) => f.sealed_at && !f.settled_at);
    // Settled predicates travel back with the USER's own settlement words —
    // this is what lets argus_sync mirror a web settlement into the local
    // ledger as the user's record, not a machine verdict (BLUEPRINT §9.4
    // 귀환 봉합: flag-only cross-check meant permanent divergence).
    const settled = (d.falsifiable_followups || []).filter((f) => f.settled_at && f.outcome);
    return {
      id: r.id,
      source_title: d.source_title,
      state: r.state,
      next_check_by: r.next_check_by,
      due: !!r.next_check_by && r.next_check_by <= today,
      core_question: d.core_question,
      open_predicates: open.map((f) => ({ predicate: f.predicate, check_by: f.check_by })),
      ...(settled.length > 0
        ? {
            settled_predicates: settled.map((f) => ({
              predicate: f.predicate,
              outcome: f.outcome,
              what_happened: f.what_happened ?? '',
              settled_at: f.settled_at,
            })),
          }
        : {}),
    };
  });

  return NextResponse.json({ ok: true, count: receipts.length, receipts });
}
