import { NextRequest, NextResponse } from 'next/server';
import { adminClient } from '@/lib/share-guard';
import { authenticatePluginToken, SCOPE_FULL } from '@/lib/plugin-token-auth';

export const dynamic = 'force-dynamic';

function parseLimit(value: string | null): number {
  const n = Number(value || 200);
  if (!Number.isFinite(n)) return 200;
  return Math.max(1, Math.min(500, Math.floor(n)));
}

export async function GET(req: NextRequest) {
  // 계정 전체 범위. 원격 커넥터의 `argus.decisions` 토큰은 여기 못 들어온다.
  const auth = await authenticatePluginToken(req.headers.get('authorization'), SCOPE_FULL);
  if (!auth.ok) {
    if (auth.reason === 'insufficient_scope') {
      return NextResponse.json({ error: 'This token is not scoped for plugin events' }, { status: 403 });
    }
    return NextResponse.json(
      { error: 'Missing, invalid, revoked, or expired token. Run: /argus:settings connect <pat>' },
      { status: 401 },
    );
  }

  const admin = adminClient();
  const { searchParams } = new URL(req.url);
  const limit = parseLimit(searchParams.get('limit'));
  const after = searchParams.get('after');

  let query = admin
    .from('plugin_events')
    .select('event_id, ledger_id, event, payload, created_at')
    .eq('user_id', auth.userId)
    .order('created_at', { ascending: true })
    .limit(limit);

  if (after) query = query.gt('created_at', after);

  const { data, error } = await query;
  if (error) {
    console.error('[plugin/events] select failed:', error.message);
    return NextResponse.json({ error: 'Could not read plugin events' }, { status: 500 });
  }

  // last_used 스탬프는 authenticatePluginToken 이 이미 찍었다 (한 곳에서만).
  return NextResponse.json({ ok: true, events: data ?? [] });
}
