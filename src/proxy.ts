import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Proxy: generates a per-request CSP nonce.
 *
 * - Nonce replaces 'unsafe-inline' in script-src (XSS mitigation)
 * - 'strict-dynamic' allows Next.js chunk loading from nonce-tagged scripts
 * - style-src keeps 'unsafe-inline' (needed for Tailwind/styled-jsx)
 * - Auth is handled client-side (Supabase + AuthGuard + RLS)
 */
export function proxy(req: NextRequest) {
  // Use getRandomValues (guaranteed in Edge Runtime) instead of randomUUID
  const nonceBytes = new Uint8Array(16);
  crypto.getRandomValues(nonceBytes);
  const nonce = btoa(String.fromCharCode(...nonceBytes));

  // Dev only: React dev-mode uses eval() for debugging features (callstack
  // reconstruction) and logs a console error under a strict CSP. Production
  // CSP is unchanged — React never evals in prod.
  const devEval = process.env.NODE_ENV === 'development' ? " 'unsafe-eval'" : '';

  const csp = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${devEval}`,
    "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://fonts.googleapis.com",
    "font-src 'self' https://cdn.jsdelivr.net https://fonts.gstatic.com data:",
    "img-src 'self' data: https://lh3.googleusercontent.com",
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://cdn.jsdelivr.net",
    "frame-src https://challenges.cloudflare.com",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ');

  // Pass nonce to layout via request header
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set('x-nonce', nonce);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set('Content-Security-Policy', csp);
  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
