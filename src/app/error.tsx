'use client';

/**
 * Root error boundary — the ship hit a reef.
 *
 * Same sea-chart language as the 404 (VoyageShip 'wrecked'), plus the one
 * reassurance that is actually true here: Argus is localStorage-first, so
 * the user's work survives a crashed render.
 */

import Link from 'next/link';
import { RotateCcw } from 'lucide-react';
import { VoyageShip, Graticule } from '@/components/ui/VoyageElements';
import { useLocale } from '@/hooks/useLocale';

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
    <div className="flex-1 flex items-center justify-center px-6 py-16">
      <div className="w-full max-w-md text-center">
        <div
          className="relative mx-auto rounded-2xl overflow-hidden border border-[var(--border-subtle)] shadow-[var(--shadow-sm)]"
          style={{ background: 'var(--bp-paper)', height: 230 }}
        >
          <Graticule opacity={0.11} spacing={26} />
          <span
            className="bp-mono absolute top-3 left-4"
            style={{ fontSize: 10, letterSpacing: '0.26em', color: 'var(--text-tertiary)' }}
          >
            ERROR
          </span>
          <div className="absolute inset-0 flex items-end justify-center pb-3">
            <VoyageShip state="wrecked" size={195} title={L('암초에 부딪힌 배', 'A ship on a reef')} />
          </div>
        </div>

        <h1 className="text-[22px] font-bold text-[var(--text-primary)] tracking-tight mt-8">
          {L('암초에 부딪혔어요', 'We hit a reef')}
        </h1>
        <p className="text-[14px] text-[var(--text-secondary)] leading-relaxed mt-2">
          {L(
            '잠깐 스친 문제일 가능성이 커요. 작업 내용은 이 브라우저에 그대로 남아 있습니다.',
            'Most likely a passing problem — your work is still safe in this browser.',
          )}
        </p>
        {error.digest && (
          <p className="bp-mono mt-3" style={{ fontSize: 10.5, letterSpacing: '0.08em', color: 'var(--text-tertiary)' }}>
            ref: {error.digest}
          </p>
        )}

        <div className="flex items-center justify-center gap-3 mt-7">
          <button
            onClick={reset}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-white text-[13px] font-semibold hover:shadow-[var(--shadow-md)] transition-all cursor-pointer"
            style={{ background: 'var(--gradient-gold)' }}
          >
            <RotateCcw size={14} /> {L('다시 시도', 'Try again')}
          </button>
          <Link
            href="/workspace"
            className="text-[13px] font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors px-2 py-2"
          >
            {L('워크스페이스로', 'Back to workspace')}
          </Link>
        </div>
      </div>
    </div>
  );
}
