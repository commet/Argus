import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { executeServerAuthorityCommand } from '@/lib/epistemic/server-gateway';
import { forgetServerClaim } from '@/lib/epistemic/server-erasure';

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
  if (command && typeof command === 'object' && !Array.isArray(command)
    && (command as Record<string, unknown>).type === 'ForgetClaim') {
    const value = command as Record<string, unknown>;
    const confirmation = value.confirmation as { value?: unknown } | undefined;
    if (value.user_id !== user.id || typeof value.claim_id !== 'string'
      || typeof value.command_id !== 'string' || !Number.isSafeInteger(value.expected_authority_epoch)
      || !Number.isSafeInteger(value.account_erasure_epoch) || typeof confirmation?.value !== 'string') {
      return NextResponse.json({ error: 'INVALID_FORGET_COMMAND' }, { status: 400 });
    }
    const forgotten = await forgetServerClaim({
      admin, user_id: user.id, claim_id: value.claim_id,
      expected_authority_epoch: Number(value.expected_authority_epoch),
      expected_account_erasure_epoch: Number(value.account_erasure_epoch),
      confirmation: confirmation.value, receipt_id: value.command_id,
    });
    if (forgotten.ok) return NextResponse.json({ ...forgotten.receipt, objects_removed: forgotten.objects_removed }, { status: 200 });
    const forgetStatus = forgotten.error_code === 'FORGET_CONFIRMATION_MISMATCH' ? 400
      : forgotten.error_code === 'FORGET_ARTIFACT_LOCATOR_INVALID' ? 409
        : forgotten.error_code?.includes('FAILED') ? 503 : 409;
    return NextResponse.json({ error: forgotten.error_code, objects_removed: forgotten.objects_removed }, { status: forgetStatus });
  }
  const result = await executeServerAuthorityCommand(admin, user.id, command);
  if (result.ok) return NextResponse.json(result.receipt, { status: 200 });
  const status = result.code === 'WRONG_OWNER' || result.code === 'BLOCKED_ORIGIN' ? 403
    : result.code.startsWith('STALE_') || result.code === 'IDEMPOTENCY_CONFLICT' ? 409
      : result.code === 'READ_FAILED' || result.code === 'APPEND_FAILED' ? 503 : 400;
  return NextResponse.json({ error: result.code, current: result.current }, { status });
}
