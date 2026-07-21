'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { VoyageShip, Graticule } from '@/components/ui/VoyageElements';
import { localeFromPath, withLocale } from '@/lib/locale-path';

export default function NotFound() {
  const [locale, setLocale] = useState<'ko' | 'en'>('ko');

  useEffect(() => {
    setLocale(localeFromPath(window.location.pathname) ?? 'ko');
  }, []);

  const L = (ko: string, en: string) => (locale === 'ko' ? ko : en);

  return (
    <div className="flex flex-1 items-center justify-center px-4 py-12 sm:px-6 sm:py-16">
      <div className="w-full max-w-md text-center">
        <div
          className="relative mx-auto h-[210px] overflow-hidden rounded-2xl border border-[var(--border-subtle)] shadow-[var(--shadow-sm)] sm:h-[230px]"
          style={{ background: 'var(--bp-paper)' }}
        >
          <Graticule opacity={0.11} spacing={26} />
          <span
            className="bp-mono absolute left-4 top-3"
            style={{ fontSize: 10, letterSpacing: '0.26em', color: 'var(--text-tertiary)' }}
          >
            404
          </span>
          <span
            className="bp-mono absolute right-4 top-3"
            style={{ fontSize: 10, letterSpacing: '0.26em', color: 'var(--text-tertiary)' }}
          >
            {L('페이지 없음', 'NOT FOUND')}
          </span>
          <div className="absolute inset-0 flex items-end justify-center pb-3">
            <VoyageShip state="adrift" size={195} title={L('페이지를 찾지 못한 안내 그림', 'Page not found illustration')} />
          </div>
        </div>

        <h1 className="mt-8 text-[22px] font-bold tracking-tight text-[var(--text-primary)]">
          {L('페이지를 찾을 수 없어요', 'Page not found')}
        </h1>
        <p className="mt-2 text-[14px] leading-relaxed text-[var(--text-secondary)]">
          {L('주소가 바뀌었거나, 처음부터 없던 곳이에요.', 'This page moved, or never existed.')}
        </p>

        <div className="mt-7 flex flex-col items-stretch justify-center gap-2 sm:flex-row sm:items-center sm:gap-3">
          <Link
            href={withLocale(locale, '/workspace')}
            className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl px-4 py-2 text-[13px] font-semibold text-[var(--accent-fg)] transition-all hover:shadow-[var(--shadow-md)]"
            style={{ background: 'var(--gradient-gold)' }}
          >
            {L('워크스페이스로 돌아가기', 'Back to workspace')} <ArrowRight size={14} aria-hidden="true" />
          </Link>
          <Link
            href={withLocale(locale, '/')}
            className="inline-flex min-h-11 items-center justify-center px-4 py-2 text-[13px] font-semibold text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]"
          >
            {L('처음으로', 'Home')}
          </Link>
        </div>
      </div>
    </div>
  );
}
