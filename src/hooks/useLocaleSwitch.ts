'use client';

import { useLocale } from './useLocale';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { useProgressiveStore } from '@/stores/useProgressiveStore';

/**
 * Locale switching for headers and language toggles.
 *
 * Persists via useSettingsStore (localStorage) and forces a full page reload
 * so SSR-injected text regenerates with the new locale. Don't replace the
 * reload with router.refresh() unless layout.tsx + i18n bundles are reworked
 * to react to a runtime locale change.
 */
export function useLocaleSwitch() {
  const locale = useLocale();
  const { updateSettings } = useSettingsStore();

  const switchTo = (next: 'ko' | 'en') => {
    if (next === locale) return;
    // The reload (needed for SSR text regen) discards any in-flight voyage work,
    // so confirm while the engine is streaming or workers are running.
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
    window.location.reload();
  };

  return { locale, switchTo };
}
