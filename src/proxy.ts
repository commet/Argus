import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Proxy: per-request CSP nonce + path-based locale routing.
 *
 * CSP (unchanged):
 * - Nonce replaces 'unsafe-inline' in script-src (XSS mitigation)
 * - 'strict-dynamic' allows Next.js chunk loading from nonce-tagged scripts
 * - style-src keeps 'unsafe-inline' (needed for Tailwind/styled-jsx)
 * - Auth is handled client-side (Supabase + AuthGuard + RLS)
 *
 * Locale:
 * - /api/*, root metadata routes (sitemap, robots, manifest, icons, og-image),
 *   and any path with a file extension get CSP only — never locale-prefixed.
 * - A path already under /en or /ko proceeds, with x-locale set to it.
 * - A locale-less page path is 307-redirected to /{locale}{path}, locale
 *   resolved from ?lang → argus-locale cookie → Accept-Language.
 */

const LOCALES = ['en', 'ko'] as const;
type Locale = (typeof LOCALES)[number];

// Root-level special files Next serves directly. They must NOT be locale-
// redirected or they 404 (sitemap/robots/manifest) or break <head> refs
// (icon/apple-icon/opengraph-image). favicon.ico is already matcher-excluded.
const RESERVED_ROOT_PATHS = new Set([
  'sitemap.xml',
  'robots.txt',
  'manifest.webmanifest',
  'icon',
  'apple-icon',
  'opengraph-image',
  'twitter-image',
  // Public share pages (/d/<token>) are intentionally locale-less and chrome-
  // less — served by app/d/[token] under the root layout, not [locale]. Leave
  // them alone so the proxy doesn't 307 them to /{locale}/d/… (which has no route).
  'd',
]);

function isLocale(seg: string | undefined): seg is Locale {
  return !!seg && (LOCALES as readonly string[]).includes(seg);
}

/** A first segment we must leave alone: a reserved metadata route or a file. */
function isReservedRootSeg(seg: string | undefined): boolean {
  if (!seg) return false;
  return RESERVED_ROOT_PATHS.has(seg) || seg.includes('.');
}

function buildCsp(nonce: string): string {
  // Dev only: React dev-mode uses eval() for debugging features (callstack
  // reconstruction) and logs a console error under a strict CSP. Production
  // CSP is unchanged — React never evals in prod.
  const devEval = process.env.NODE_ENV === 'development' ? " 'unsafe-eval'" : '';
  return [
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
}

function resolveLocale(req: NextRequest): Locale {
  const queryLang = req.nextUrl.searchParams.get('lang');
  if (isLocale(queryLang ?? undefined)) return queryLang as Locale;

  const cookieLang = req.cookies.get('argus-locale')?.value;
  if (isLocale(cookieLang)) return cookieLang;

  const accept = req.headers.get('accept-language') ?? '';
  const first = accept.split(',')[0]?.trim().toLowerCase() ?? '';
  return first.startsWith('ko') ? 'ko' : 'en';
}

export function proxy(req: NextRequest) {
  // Use getRandomValues (guaranteed in Edge Runtime) instead of randomUUID
  const nonceBytes = new Uint8Array(16);
  crypto.getRandomValues(nonceBytes);
  const nonce = btoa(String.fromCharCode(...nonceBytes));
  const csp = buildCsp(nonce);

  const { pathname } = req.nextUrl;
  const firstSeg = pathname.split('/')[1];

  // /api, reserved metadata routes, and static-ish files — CSP only, no locale.
  if (pathname.startsWith('/api') || isReservedRootSeg(firstSeg)) {
    const requestHeaders = new Headers(req.headers);
    requestHeaders.set('x-nonce', nonce);
    const response = NextResponse.next({ request: { headers: requestHeaders } });
    response.headers.set('Content-Security-Policy', csp);
    return response;
  }

  // Already locale-prefixed — proceed, expose the locale + the locale-less path
  // to layouts (the latter so generateMetadata can build a per-page canonical /
  // hreflang instead of inheriting the homepage's).
  if (isLocale(firstSeg)) {
    const requestHeaders = new Headers(req.headers);
    requestHeaders.set('x-nonce', nonce);
    requestHeaders.set('x-locale', firstSeg);
    requestHeaders.set('x-pathname', pathname.slice(firstSeg.length + 1) || '');
    const response = NextResponse.next({ request: { headers: requestHeaders } });
    response.headers.set('Content-Security-Policy', csp);
    return response;
  }

  // Locale-less page path — redirect to the resolved locale.
  const locale = resolveLocale(req);
  const target = req.nextUrl.clone();
  // Avoid `/` → `/en/` (a trailing slash Next then 308-normalizes — a third hop).
  target.pathname = pathname === '/' ? `/${locale}` : `/${locale}${pathname}`;
  const response = NextResponse.redirect(target, 307);
  response.cookies.set('argus-locale', locale, {
    path: '/',
    maxAge: 31536000,
    sameSite: 'lax',
  });
  response.headers.set('Content-Security-Policy', csp);
  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
