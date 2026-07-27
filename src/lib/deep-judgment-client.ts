import { supabase } from '@/lib/supabase';

export type DeepJudgmentAuthorization =
  | { allowed: true; status: 'granted' | 'resumed' }
  | { allowed: false; status: 'daily_used' | 'unavailable' };

export async function authorizePlatformDeepJudgment(sessionId: string): Promise<DeepJudgmentAuthorization> {
  const session = await Promise.race([
    supabase.auth.getSession().then((result) => result.data.session),
    new Promise<null>((resolve) => setTimeout(() => resolve(null), 4_000)),
  ]);
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`;

  try {
    const response = await fetch('/api/deep-judgment/authorize', {
      method: 'POST',
      headers,
      body: JSON.stringify({ session_id: sessionId }),
    });
    const body = await response.json().catch(() => ({}));
    if (response.ok && body.allowed === true) {
      return { allowed: true, status: body.status === 'resumed' ? 'resumed' : 'granted' };
    }
    return {
      allowed: false,
      status: response.status === 429 || body.status === 'daily_used' ? 'daily_used' : 'unavailable',
    };
  } catch {
    return { allowed: false, status: 'unavailable' };
  }
}
