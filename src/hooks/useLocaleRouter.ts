'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale } from './useLocale';
import { withLocale } from '@/lib/locale-path';

/**
 * useRouter wrapper whose `push`/`replace` prefix internal paths with the
 * active locale (`/workspace` → `/en/workspace`). Already-prefixed or external
 * targets pass through unchanged (see `withLocale`). Other router methods are
 * forwarded as-is.
 */
export function useLocaleRouter() {
  const router = useRouter();
  const locale = useLocale();

  return useMemo(
    () => ({
      ...router,
      push: (href: string, options?: Parameters<typeof router.push>[1]) =>
        router.push(withLocale(locale, href), options),
      replace: (href: string, options?: Parameters<typeof router.replace>[1]) =>
        router.replace(withLocale(locale, href), options),
    }),
    [router, locale],
  );
}
