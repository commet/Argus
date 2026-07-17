import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { productionE3BReleaseDecision } from '@/lib/epistemic/e3b-release-gate';
import { executeServerReviewAction, readServerReviewSnapshot } from '@/lib/epistemic/server-review';

function unavailable() {
  return NextResponse.json({ error: 'E3B_NOT_RELEASED' }, { status: 404 });
}

async function authenticatedClients(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !serviceKey || !anonKey) return { unavailable: true as const };
  const auth = createClient(url, anonKey);
  const { data: { user }, error } = await auth.auth.getUser(authHeader.slice(7));
  if (error || !user) return null;
  return { user, admin: createClient(url, serviceKey), unavailable: false as const };
}

export async function GET(req: NextRequest) {
  const release = productionE3BReleaseDecision();
  if (!release.open) return unavailable();
  const clients = await authenticatedClients(req);
  if (!clients) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  if (clients.unavailable) return NextResponse.json({ error: 'Service unavailable.' }, { status: 503 });
  const snapshot = await readServerReviewSnapshot(clients.admin, clients.user.id);
  if (!snapshot) return NextResponse.json({ error: 'REVIEW_READ_FAILED' }, { status: 503 });
  return NextResponse.json({ release_receipt_id: release.receipt.receipt_id, ...snapshot });
}

export async function POST(req: NextRequest) {
  const release = productionE3BReleaseDecision();
  if (!release.open) return unavailable();
  const clients = await authenticatedClients(req);
  if (!clients) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  if (clients.unavailable) return NextResponse.json({ error: 'Service unavailable.' }, { status: 503 });
  let value: unknown;
  try {
    value = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 });
  }
  const result = await executeServerReviewAction({ admin: clients.admin, user_id: clients.user.id, value });
  if (result.ok) return NextResponse.json(result.receipt, { status: 200 });
  const status = result.code === 'ORIGIN_NOT_AUTHORIZED' ? 403
    : result.code.startsWith('STALE_') || result.code === 'IDEMPOTENCY_CONFLICT' ? 409
      : result.code === 'READ_FAILED' || result.code === 'POLICY_READ_FAILED' || result.code === 'APPEND_FAILED' ? 503
        : result.code === 'CLAIM_NOT_FOUND' ? 404 : 400;
  return NextResponse.json({ error: result.code, ...('current' in result ? { current: result.current } : {}) }, { status });
}
