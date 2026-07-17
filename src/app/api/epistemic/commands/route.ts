import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { executeServerAuthorityCommand } from '@/lib/epistemic/server-gateway';

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !serviceKey || !anonKey) {
    return NextResponse.json({ error: 'Service unavailable.' }, { status: 503 });
  }
  const token = authHeader.slice(7);
  const authClient = createClient(url, anonKey);
  const { data: { user }, error } = await authClient.auth.getUser(token);
  if (error || !user) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });

  let command: unknown;
  try {
    command = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 });
  }
  const admin = createClient(url, serviceKey);
  const result = await executeServerAuthorityCommand(admin, user.id, command);
  if (result.ok) return NextResponse.json(result.receipt, { status: 200 });
  const status = result.code === 'WRONG_OWNER' || result.code === 'BLOCKED_ORIGIN' ? 403
    : result.code.startsWith('STALE_') || result.code === 'IDEMPOTENCY_CONFLICT' ? 409
      : result.code === 'READ_FAILED' || result.code === 'APPEND_FAILED' ? 503 : 400;
  return NextResponse.json({ error: result.code, current: result.current }, { status });
}
