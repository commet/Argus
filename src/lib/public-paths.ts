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
  // '/design' removed (05 S5): orphan internal-reference routes (zero inbound
  // links) — kept alive behind AuthGuard, just not public.
  // /project is public so the anonymous cohort that SEALED a decision can reach
  // their promised return (the seal + .ics both point here). The page is
  // localStorage-first — it renders the user's local projects, the due strip,
  // and the SettlementModal for anon; AuthGuard previously walled it, so the
  // seal made a dated promise to a surface the sealer was then locked out of.
  '/project',
  // /tools/review is the low-friction document-review wedge (design doc
  // subtask-b): it is localStorage-first like /workspace and anon LLM calls are
  // rate-limited, so a signed-out visitor can drop in a strategy doc and get a
  // Judgment Receipt. The other /tools/* routes stay protected.
  '/tools/review',
] as const;

export const PUBLIC_PREFIXES = ['/api/', '/_next/', '/favicon.ico'] as const;

export function isPublicPath(pathname: string): boolean {
  if (PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))) return true;
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'));
}
