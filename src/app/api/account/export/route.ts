import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { USER_DATA_TABLES } from '@/lib/user-data-tables';

/**
 * Complete server-side export — every user-scoped row across all USER_DATA_TABLES
 * as one portable JSON. The old Settings "export" only dumped localStorage, so server-only
 * data (synced history, plugin imports, analytics) was invisible to the user who
 * owns it. Data ownership/portability is a trust dimension: you can take it with you.
 */
export async function GET(req: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !serviceKey || !anonKey) {
    return NextResponse.json({ error: 'Service unavailable.' }, { status: 503 });
  }

  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }
  const token = authHeader.slice(7);
  const authClient = createClient(url, anonKey);
  const { data: { user }, error: authErr } = await authClient.auth.getUser(token);
  if (authErr || !user) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  const admin = createClient(url, serviceKey);
  const data: Record<string, unknown> = {
    exported_at: new Date().toISOString(),
    user: { id: user.id, email: user.email, created_at: user.created_at },
    tables: {},
  };
  const tables = data.tables as Record<string, unknown>;

  for (const table of USER_DATA_TABLES) {
    const { data: rows, error } = await admin.from(table).select('*').eq('user_id', user.id);
    tables[table] = error ? { error: error.message } : rows;
  }

  return new NextResponse(JSON.stringify(data, null, 2), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="argus-export-${user.id.slice(0, 8)}.json"`,
    },
  });
}
