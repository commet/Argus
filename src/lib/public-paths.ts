/**
 * Single source of truth for routes that do NOT require authentication.
 *
 * Consumed by LayoutShell (runtime soft-wall) and middleware route tests.
 * Keep this list aligned with what a signed-out visitor should be able to see.
 */

export const PUBLIC_PATHS = [
  '/',
  '/login',
  '/auth/callback',
  '/guide',
  '/workspace',
  '/boss',
  '/settings',
  '/privacy',
  '/terms',
] as const;

export const PUBLIC_PREFIXES = ['/api/', '/_next/', '/favicon.ico'] as const;

export function isPublicPath(pathname: string): boolean {
  if (PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))) return true;
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'));
}
