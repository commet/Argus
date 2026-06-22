'use client';

import { createContext, useContext, useMemo, useRef } from 'react';
import {
  type Locale,
  type TranslationKey,
  translate,
  setModuleLocale,
  getCurrentLanguage,
} from '@/lib/i18n';

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
  locale,
  children,
}: {
  locale: Locale;
  children: React.ReactNode;
}) {
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
