'use client';

/**
 * 404 — a ship adrift on an empty chart.
 *
 * Replaces the unstyled Next.js default. Uses the sea-chart design system
 * (Graticule + VoyageShip 'adrift') so even a dead end speaks the product's
 * language: you're off the chart, not in trouble.
 */

import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { VoyageShip, Graticule } from '@/components/ui/VoyageElements';
import { useLocale } from '@/hooks/useLocale';

export default function NotFound() {
  const locale = useLocale();
  const L = (ko: string, en: string) => (locale === 'ko' ? ko : en);

  return (
    <div className="flex-1 flex items-center justify-center px-6 py-16">
      <div className="w-full max-w-md text-center">
        {/* Chart panel — the adrift ship, lost in the graticule */}
        <div
          className="relative mx-auto rounded-2xl overflow-hidden border border-[var(--border-subtle)] shadow-[var(--shadow-sm)]"
          style={{ background: 'var(--bp-paper)', height: 230 }}
        >
          <Graticule opacity={0.11} spacing={26} />
          <span
            className="bp-mono absolute top-3 left-4"
            style={{ fontSize: 10, letterSpacing: '0.26em', color: 'var(--text-tertiary)' }}
          >
            404
          </span>
          <span
            className="bp-mono absolute top-3 right-4"
            style={{ fontSize: 10, letterSpacing: '0.26em', color: 'var(--text-tertiary)' }}
          >
            {L('표류', 'ADRIFT')}
          </span>
          <div className="absolute inset-0 flex items-end justify-center pb-3">
            <VoyageShip state="adrift" size={195} title={L('표류 중인 배', 'A ship adrift')} />
          </div>
        </div>

        <h1 className="text-[22px] font-bold text-[var(--text-primary)] tracking-tight mt-8">
          {L('해도에 없는 바다예요', 'Off the chart')}
        </h1>
        <p className="text-[14px] text-[var(--text-secondary)] leading-relaxed mt-2">
          {L('주소가 바뀌었거나, 처음부터 없던 곳이에요.', 'This page moved, or never existed.')}
        </p>

        <div className="flex items-center justify-center gap-3 mt-7">
          <Link
            href="/workspace"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-white text-[13px] font-semibold hover:shadow-[var(--shadow-md)] transition-all"
            style={{ background: 'var(--gradient-gold)' }}
          >
            {L('워크스페이스로', 'Back to workspace')} <ArrowRight size={14} />
          </Link>
          <Link
            href="/"
            className="text-[13px] font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors px-2 py-2"
          >
            {L('처음으로', 'Home')}
          </Link>
        </div>
      </div>
    </div>
  );
}
