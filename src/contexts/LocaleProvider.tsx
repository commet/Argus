'use client';

import { createContext, useContext, useMemo, useRef, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import {
  type Locale,
  type TranslationKey,
  translate,
  setModuleLocale,
  getCurrentLanguage,
} from '@/lib/i18n';
import { getStorage, STORAGE_KEYS } from '@/lib/storage';
import { stripLocale } from '@/lib/locale-path';
import type { Settings } from '@/stores/types';

/**
 * The user's EXPLICIT locale choice, read on the client: a `?lang` override
 * first, then the language they saved in Settings. Returns null when the user
 * has made no explicit choice (so the server's Accept-Language seed stands).
 */
function explicitClientLocale(): Locale | null {
  if (typeof window === 'undefined') return null;
  const url = new URLSearchParams(window.location.search).get('lang');
  if (url === 'ko' || url === 'en') return url;
  const stored = getStorage<Partial<Settings>>(STORAGE_KEYS.SETTINGS, {}).language;
  return stored === 'ko' || stored === 'en' ? stored : null;
}

/**
 * LocaleProvider — the single source of truth for the active locale.
 *
 * Seeded from the request's resolved locale (Accept-Language today; the
 * `[locale]` route segment once path-based routing lands). It does two things:
 *
 *   1. Exposes the locale through React context so `useLocale()` / `useT()` are
 *      reactive — when the locale prop changes (navigation), every consumer
 *      re-renders. No page reload.
 *   2. Mirrors the locale into the i18n module (`setModuleLocale`) so non-React
 *      callers — prompt-building engines, store actions, formatters that call
 *      bare `t()` — stay consistent with what the UI shows.
 *
 * The mirror is written during render (not in an effect) so that any `t()`
 * called synchronously by children during the same commit already sees the
 * correct locale. This is safe: it runs client-only and is idempotent.
 */

interface LocaleContextValue {
  locale: Locale;
  t: (key: TranslationKey, params?: Record<string, string | number>) => string;
}

const LocaleContext = createContext<LocaleContextValue | null>(null);

export function LocaleProvider({
  locale: seed,
  children,
}: {
  locale: Locale;
  children: React.ReactNode;
}) {
  // The route segment ([locale]) is the source of truth — `seed` is it.
  const locale = seed;
  const router = useRouter();
  const pathname = usePathname();

  // The user's EXPLICIT choice (?lang, then saved Settings language) must win
  // over the browser's Accept-Language the proxy fell back to — otherwise someone
  // who chose Korean on an English browser is forced to English. But the URL is
  // authoritative here, so we don't flip the locale in place (that would render
  // Korean under an /en URL); we persist the choice to the argus-locale cookie
  // and NAVIGATE to the matching locale route, keeping URL and content in sync.
  // Self-limiting: after the redirect the route IS the explicit locale, so the
  // cookie matches and no further navigation fires (no loop).
  useEffect(() => {
    const explicit = explicitClientLocale();
    const active = explicit ?? seed;
    if (typeof document !== 'undefined') {
      document.cookie = `argus-locale=${active}; path=/; max-age=31536000; samesite=lax`;
    }
    if (explicit && explicit !== seed) {
      const rest = stripLocale(pathname || '/');
      const search = typeof window !== 'undefined' ? window.location.search : '';
      const hash = typeof window !== 'undefined' ? window.location.hash : '';
      router.replace(`/${explicit}${rest === '/' ? '' : rest}${search}${hash}`);
    }
    // Mount-only: the stored choice is stable for the session; useLocaleSwitch
    // handles in-session changes by navigating + updating the cookie itself.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep the module mirror aligned with the rendered locale. Writing during
  // render is intentional so a synchronous bare `t()` in a child sees the right
  // value (see file header). CLIENT-ONLY: never on the server — module state is
  // shared across requests there, so writing it during SSR would race between a
  // /en and a /ko request. The guard makes this a no-op server-side.
  const lastWritten = useRef<Locale | null>(null);
  if (typeof window !== 'undefined' && lastWritten.current !== locale) {
    setModuleLocale(locale);
    lastWritten.current = locale;
  }

  const value = useMemo<LocaleContextValue>(
    () => ({
      locale,
      t: (key, params) => translate(locale, key, params),
    }),
    [locale],
  );

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

/** Read the active locale from context. Returns null if no provider (tests). */
export function useLocaleContext(): LocaleContextValue | null {
  return useContext(LocaleContext);
}

/**
 * Reactive translation hook. Use inside components instead of the bare `t()`
 * import so the text updates when the locale changes.
 *
 *   const t = useT();
 *   <button>{t('common.save')}</button>
 */
export function useT(): (key: TranslationKey, params?: Record<string, string | number>) => string {
  const ctx = useContext(LocaleContext);
  // Fallback for components rendered outside a provider (e.g. unit tests):
  // translate with the module mirror / storage locale.
  if (!ctx) return (key, params) => translate(getCurrentLanguage(), key, params);
  return ctx.t;
}
