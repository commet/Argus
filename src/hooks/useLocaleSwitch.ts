'use client';

import { useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useLocale } from './useLocale';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { useProgressiveStore } from '@/stores/useProgressiveStore';
import { stripLocale } from '@/lib/locale-path';

/**
 * Switch locale while preserving the current path, query, and hash. In-flight
 * analysis requires an app-owned confirmation before navigation can interrupt it.
 */
export function useLocaleSwitch() {
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const { updateSettings } = useSettingsStore();
  const [pendingLocale, setPendingLocale] = useState<'ko' | 'en' | null>(null);

  const commitSwitch = (next: 'ko' | 'en') => {
    if (next === locale) return;
    updateSettings({ language: next });
    if (typeof document !== 'undefined') {
      document.cookie = `argus-locale=${next}; path=/; max-age=31536000; samesite=lax`;
    }

    const basePath = pathname ?? (typeof window !== 'undefined' ? window.location.pathname : '/');
    const search = typeof window !== 'undefined' ? window.location.search : '';
    const hash = typeof window !== 'undefined' ? window.location.hash : '';
    const rest = stripLocale(basePath);
    router.push(`/${next}${rest === '/' ? '' : rest}${search}${hash}`);
  };

  const switchTo = (next: 'ko' | 'en') => {
    if (next === locale) return;
    if (useProgressiveStore.getState().isBranchingLocked()) {
      setPendingLocale(next);
      return;
    }
    commitSwitch(next);
  };

  const confirmSwitch = () => {
    if (!pendingLocale) return;
    const next = pendingLocale;
    setPendingLocale(null);
    commitSwitch(next);
  };

  return {
    locale,
    switchTo,
    pendingLocale,
    confirmSwitch,
    cancelSwitch: () => setPendingLocale(null),
  };
}
