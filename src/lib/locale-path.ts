/**
 * Locale path helpers — the single place that knows how a locale segment is
 * encoded in the URL (`/en/...`, `/ko/...`).
 *
 * Pure string functions, no I/O, safe in server, client, and tests. Used by
 * the proxy (locale-less → prefixed redirect), LocaleLink / useLocaleRouter
 * (prefix internal nav), and every component that compares `usePathname()` to
 * a locale-less literal (normalize first via `stripLocale`).
 */

export const LOCALES = ['en', 'ko'] as const;
export type AppLocale = (typeof LOCALES)[number];

export function isLocale(seg: string | undefined | null): seg is AppLocale {
  return seg === 'en' || seg === 'ko';
}

/** First path segment if it is a locale, else null. `/en/x` → 'en'. */
export function localeFromPath(pathname: string): AppLocale | null {
  const seg = pathname.split('/')[1];
  return isLocale(seg) ? seg : null;
}

/**
 * Remove a leading `/en` or `/ko` segment, returning the locale-less path
 * (always starts with `/`). `/en` → `/`, `/en/workspace` → `/workspace`.
 * A path without a locale prefix is returned unchanged.
 */
export function stripLocale(pathname: string): string {
  const m = pathname.match(/^\/(?:en|ko)(\/.*)?$/);
  if (m) return m[1] || '/';
  return pathname;
}

/**
 * Prefix an internal path with the locale. Leaves alone: paths already
 * locale-prefixed, external (`http`), hash (`#`), protocol-relative (`//`),
 * and anything not starting with `/`. Query/hash on the path are preserved.
 */
export function withLocale(locale: AppLocale, path: string): string {
  if (!path.startsWith('/')) return path; // external, #, relative, mailto:
  if (path.startsWith('//')) return path; // protocol-relative
  if (/^\/(?:en|ko)(?:\/|$|\?|#)/.test(path)) return path; // already prefixed
  return `/${locale}${path === '/' ? '' : path}`;
}
