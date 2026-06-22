'use client';

import Link from 'next/link';
import type { ComponentProps } from 'react';
import { useLocale } from '@/hooks/useLocale';
import { withLocale } from '@/lib/locale-path';

/**
 * Drop-in replacement for next/link that prefixes internal hrefs with the
 * active locale (`/workspace` → `/en/workspace`). External links, hashes,
 * already-prefixed paths, and object hrefs pass through untouched (see
 * `withLocale`). Use this for every internal navigation link so the user
 * stays inside their locale without relying on the middleware redirect hop.
 */
type LinkProps = ComponentProps<typeof Link>;

export function LocaleLink({ href, ...rest }: LinkProps) {
  const locale = useLocale();
  const finalHref = typeof href === 'string' ? withLocale(locale, href) : href;
  return <Link href={finalHref} {...rest} />;
}
