'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useLocale } from './useLocale';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { useProgressiveStore } from '@/stores/useProgressiveStore';
import { stripLocale } from '@/lib/locale-path';

/**
 * Locale switching for headers and language toggles.
 *
 * Reactive: the locale lives in the route (`/en/...` | `/ko/...`) and the
 * LocaleProvider re-renders from the segment, so switching is a client-side
 * navigation — no page reload. We swap the leading locale segment of the
 * current path for the new one (preserving the rest + query) and `router.push`.
 * The `argus-locale` cookie is updated so the middleware default and SSR agree
 * on the next visit; localStorage settings stay in sync too.
 */
export function useLocaleSwitch() {
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const { updateSettings } = useSettingsStore();

  const switchTo = (next: 'ko' | 'en') => {
    if (next === locale) return;

    // A locale switch navigates and remounts; confirm before discarding any
    // in-flight voyage work (engine streaming / workers running).
    const inFlight = useProgressiveStore.getState().isBranchingLocked();
    if (inFlight && typeof window !== 'undefined') {
      const ok = window.confirm(
        locale === 'ko'
          ? '진행 중인 항해가 있어요. 언어를 바꾸면 페이지를 새로 불러와 진행 중인 작업이 중단됩니다. 계속할까요?'
          : 'A voyage is in progress. Switching language reloads the page and interrupts the running work. Continue?',
      );
      if (!ok) return;
    }

    updateSettings({ language: next });
    if (typeof document !== 'undefined') {
      document.cookie = `argus-locale=${next}; path=/; max-age=31536000; samesite=lax`;
    }

    const basePath = pathname ?? (typeof window !== 'undefined' ? window.location.pathname : '/');
    const search = typeof window !== 'undefined' ? window.location.search : '';
    const hash = typeof window !== 'undefined' ? window.location.hash : '';
    const rest = stripLocale(basePath);
    const newPath = `/${next}${rest === '/' ? '' : rest}${search}${hash}`;
    router.push(newPath);
  };

  return { locale, switchTo };
}
