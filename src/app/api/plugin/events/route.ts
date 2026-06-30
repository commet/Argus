import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { adminClient } from '@/lib/share-guard';

export const dynamic = 'force-dynamic';

function hashToken(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}

function parseLimit(value: string | null): number {
  const n = Number(value || 200);
  if (!Number.isFinite(n)) return 200;
  return Math.max(1, Math.min(500, Math.floor(n)));
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Missing token. Run: /argus:connect <pat>' }, { status: 401 });
  }

  const raw = authHeader.slice(7).trim();
  if (!raw.startsWith('argus_pat_')) {
    return NextResponse.json({ error: 'Invalid token format' }, { status: 401 });
  }

  const admin = adminClient();
  const { data: tokenRow } = await admin
    .from('plugin_tokens')
    .select('id, user_id')
    .eq('token_hash', hashToken(raw))
    .single();

  if (!tokenRow) {
    return NextResponse.json({ error: 'Unknown or revoked token' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const limit = parseLimit(searchParams.get('limit'));
  const after = searchParams.get('after');

  let query = admin
    .from('plugin_events')
    .select('event_id, ledger_id, event, payload, created_at')
    .eq('user_id', tokenRow.user_id)
    .order('created_at', { ascending: true })
    .limit(limit);

  if (after) query = query.gt('created_at', after);

  const { data, error } = await query;
  if (error) {
    console.error('[plugin/events] select failed:', error.message);
    return NextResponse.json({ error: 'Could not read plugin events' }, { status: 500 });
  }

  admin.from('plugin_tokens')
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', tokenRow.id)
    .then(({ error: stampError }) => {
      if (stampError) console.error('[plugin/events] last_used stamp:', stampError.message);
    });

  return NextResponse.json({ ok: true, events: data ?? [] });
}
