'use client';

import Link from 'next/link';
import { RotateCcw } from 'lucide-react';
import { VoyageShip, Graticule } from '@/components/ui/VoyageElements';
import { useLocale } from '@/hooks/useLocale';
import { withLocale } from '@/lib/locale-path';

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const locale = useLocale();
  const L = (ko: string, en: string) => (locale === 'ko' ? ko : en);

  return (
    <main id="main-content" tabIndex={-1} className="flex flex-1 items-center justify-center px-4 py-12 focus:outline-none sm:px-6 sm:py-16">
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
            ERROR
          </span>
          <div className="absolute inset-0 flex items-end justify-center pb-3">
            <VoyageShip state="wrecked" size={195} title={L('문제가 생긴 안내 그림', 'Something went wrong illustration')} />
          </div>
        </div>

        <h1 className="mt-8 text-[22px] font-bold tracking-tight text-[var(--text-primary)]">
          {L('문제가 생겼어요', 'Something went wrong')}
        </h1>
        <p className="mt-2 text-[14px] leading-relaxed text-[var(--text-secondary)]">
          {L(
            '잠깐 스친 문제일 가능성이 커요. 이미 저장한 내용은 이 브라우저에 그대로 남아 있습니다.',
            'Most likely a passing problem. Anything already saved remains in this browser.',
          )}
        </p>
        {error.digest && (
          <p className="bp-mono mt-3" style={{ fontSize: 10.5, letterSpacing: '0.08em', color: 'var(--text-tertiary)' }}>
            ref: {error.digest}
          </p>
        )}

        <div className="mt-7 flex flex-col items-stretch justify-center gap-2 sm:flex-row sm:items-center sm:gap-3">
          <button
            type="button"
            onClick={reset}
            className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl px-4 py-2 text-[13px] font-semibold text-[var(--accent-fg)] transition-all hover:shadow-[var(--shadow-md)]"
            style={{ background: 'var(--gradient-gold)' }}
          >
            <RotateCcw size={14} aria-hidden="true" /> {L('다시 시도', 'Try again')}
          </button>
          <Link
            href={withLocale(locale, '/workspace')}
            className="inline-flex min-h-11 items-center justify-center px-4 py-2 text-[13px] font-semibold text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]"
          >
            {L('워크스페이스로 돌아가기', 'Back to workspace')}
          </Link>
        </div>
      </div>
    </main>
  );
}
