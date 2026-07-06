/**
 * Server-side Cloudflare Turnstile verification for the UNAUTHENTICATED paid
 * endpoints (anon /api/llm trial, /api/search). This is defense-in-depth on top
 * of the per-IP rate limits: the rate limiter caps a single IP, Turnstile raises
 * the cost of the IP-rotation bypass (proxy pools) that a plain per-IP cap can't
 * stop.
 *
 * ── INERT BY DEFAULT ──────────────────────────────────────────────────────────
 * verifyTurnstile() returns ALLOW whenever TURNSTILE_SECRET_KEY is unset, so
 * merely deploying this code changes nothing. Enforcement turns on ONLY when the
 * secret is configured. DO NOT set the secret in production until the client is
 * actually attaching a token (header `x-turnstile-token`) — otherwise every anon
 * call is rejected. See docs / SECURITY.md for the enablement checklist.
 *
 * Failure policy: on a Cloudflare outage or network error we fail OPEN (allow).
 * For a COST guard, availability beats strictness — a Cloudflare hiccup must not
 * take down the anon trial. A missing/forged token while the secret is set fails
 * CLOSED (reject), which is the actual enforcement path.
 */

const VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

/** True when the server secret is configured (i.e. enforcement is live). */
export function isTurnstileEnabled(): boolean {
  return !!process.env.TURNSTILE_SECRET_KEY;
}

/** Header the client sends the Turnstile token in. */
export const TURNSTILE_HEADER = 'x-turnstile-token';

export async function verifyTurnstile(
  token: string | null | undefined,
  ip?: string,
): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return true;          // inert until configured
  if (!token) return false;          // enforced: no token → reject

  try {
    const form = new URLSearchParams();
    form.set('secret', secret);
    form.set('response', token);
    if (ip && ip !== 'unknown') form.set('remoteip', ip);

    const res = await fetch(VERIFY_URL, { method: 'POST', body: form });
    if (!res.ok) return true;        // CF outage → fail open (availability > strictness)
    const data: unknown = await res.json().catch(() => null);
    return (data as { success?: boolean } | null)?.success === true;
  } catch {
    return true;                     // network error → fail open
  }
}
