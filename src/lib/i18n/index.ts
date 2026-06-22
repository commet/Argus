import { ko, type TranslationKey } from './ko';
import { en } from './en';
import { getStorage, STORAGE_KEYS } from '@/lib/storage';
import type { Settings } from '@/stores/types';

export type Locale = 'ko' | 'en';

const translations = { ko, en } as const;

/**
 * Pure translation lookup. No I/O — give it the locale explicitly.
 * Used by the reactive `useT()` hook (locale from LocaleProvider context) and
 * by the module-level `t()` below (locale from the module mirror).
 */
export function translate(
  lang: Locale,
  key: TranslationKey,
  params?: Record<string, string | number>,
): string {
  const dict = translations[lang] || translations.ko;
  let text = dict[key] || ko[key] || key;
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      text = text.replace(`{${k}}`, String(v));
    }
  }
  return text;
}

/**
 * Module-level locale mirror.
 *
 * The route segment `[locale]` is the source of truth (see LocaleProvider).
 * React code reads locale reactively from context (`useLocale`/`useT`). But a
 * lot of non-React code — the engines that build LLM prompts, store actions,
 * error formatters — calls `t()`/`getCurrentLanguage()` synchronously and can't
 * use a hook. Those read this mirror, which LocaleProvider keeps in sync on the
 * client. It is intentionally CLIENT-ONLY: never set on the server (module
 * state is shared across requests there), so server-side reads fall through to
 * storage and then the en-first default.
 */
let moduleLocale: Locale | null = null;

export function setModuleLocale(lang: Locale): void {
  moduleLocale = lang;
}

function storageLocale(): Locale {
  // Client fallback before LocaleProvider mounts. 'en' is the source language
  // (en-first launch); a stored explicit preference wins.
  const settings = getStorage<Partial<Settings>>(STORAGE_KEYS.SETTINGS, {});
  return (settings.language as Locale) || 'en';
}

export function getCurrentLanguage(): Locale {
  return moduleLocale ?? storageLocale();
}

/**
 * Non-reactive translation for use OUTSIDE React render (engines, stores,
 * formatters). Inside a component, prefer `useT()` so the text re-renders when
 * the locale changes. Reads the module mirror, falling back to storage.
 */
export function t(key: TranslationKey, params?: Record<string, string | number>): string {
  return translate(getCurrentLanguage(), key, params);
}

export type { TranslationKey };
