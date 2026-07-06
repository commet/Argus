import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { adminClient } from '@/lib/share-guard';
import { isTokenExpired } from '@/lib/plugin-token';
import type { JudgmentReceipt } from '@/lib/review';

/**
 * MCP pull side of the sync (design doc §연결 방식 — bidirectional). `argus_sync`
 * GETs the user's account receipts (PAT-authed) so the terminal can surface
 * "your live judgments + what's due" without the webapp. Read-only summary — the
 * full receipt jsonb stays server-side; we return only what a terminal lists.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function hashToken(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Missing token' }, { status: 401 });
  }
  const raw = authHeader.slice(7).trim();
  if (!raw.startsWith('argus_pat_')) {
    return NextResponse.json({ error: 'Invalid token format' }, { status: 401 });
  }

  const admin = adminClient();
  const { data: tokenRow } = await admin
    .from('plugin_tokens')
    .select('user_id, expires_at')
    .eq('token_hash', hashToken(raw))
    .single();
  if (!tokenRow || isTokenExpired(tokenRow.expires_at)) {
    return NextResponse.json({ error: 'Unknown, revoked, or expired token' }, { status: 401 });
  }

  const { data: rows, error } = await admin
    .from('review_receipts')
    .select('id, state, next_check_by, data')
    .eq('user_id', tokenRow.user_id)
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
    return {
      id: r.id,
      source_title: d.source_title,
      state: r.state,
      next_check_by: r.next_check_by,
      due: !!r.next_check_by && r.next_check_by <= today,
      core_question: d.core_question,
      open_predicates: open.map((f) => ({ predicate: f.predicate, check_by: f.check_by })),
    };
  });

  return NextResponse.json({ ok: true, count: receipts.length, receipts });
}
