'use client';

import { useState, useEffect } from 'react';
import { getStorage, setStorage, STORAGE_KEYS } from '@/lib/storage';
import type { Settings } from '@/stores/types';
import { useLocaleContext } from '@/contexts/LocaleProvider';

export type Locale = 'ko' | 'en';

function detectBrowserLocale(): Locale {
  if (typeof navigator === 'undefined') return 'en';
  return (navigator.language || '').startsWith('ko') ? 'ko' : 'en';
}

function detectUrlLocale(): Locale | null {
  if (typeof window === 'undefined') return null;
  const param = new URLSearchParams(window.location.search).get('lang');
  return param === 'ko' || param === 'en' ? param : null;
}

/**
 * Resolves the user's locale.
 *
 * The source of truth is the LocaleProvider (seeded from the request's resolved
 * locale on the server, so SSR and the first client paint agree). When a
 * provider is present we read from it — this is reactive, so a locale change
 * (navigation) re-renders consumers without a page reload.
 *
 * The standalone path below only runs when there is NO provider (e.g. a
 * component mounted in a unit test). It mirrors the old resolution order:
 *   1. URL param (?lang=ko | ?lang=en)
 *   2. Explicit stored setting
 *   3. Browser Accept-Language on first visit (auto-persisted)
 *   4. Default 'en'
 */
export function useLocale(): Locale {
  const ctx = useLocaleContext();
  const [fallbackLocale, setFallbackLocale] = useState<Locale>('en');

  useEffect(() => {
    if (ctx) return; // provider is the source of truth

    const urlLocale = detectUrlLocale();
    if (urlLocale) {
      setFallbackLocale(urlLocale);
      return;
    }

    const settings = getStorage<Settings>(STORAGE_KEYS.SETTINGS, {} as Settings);
    if (settings.language) {
      setFallbackLocale(settings.language as Locale);
      return;
    }

    const browserLocale = detectBrowserLocale();
    setStorage(STORAGE_KEYS.SETTINGS, { ...settings, language: browserLocale });
    setFallbackLocale(browserLocale);
  }, [ctx]);

  return ctx ? ctx.locale : fallbackLocale;
}

/**
 * Dual-language text helper.
 * Usage: const L = useLandingText(locale); L('제목', 'Title')
 */
export function useLandingText(locale: Locale) {
  return (ko: string, en: string) => (locale === 'ko' ? ko : en);
}
