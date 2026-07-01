'use client';

import type { ReactNode } from 'react';
import { Graticule } from './VoyageElements';

/**
 * ChartPlate — the app interior rendered as a sea-chart sheet.
 *
 * The landing is guru-tier blueprint/sea-chart craft (registration ticks, graticule,
 * plate labels); app interiors used to revert to generic rounded-card SaaS. This is the
 * single source for "you are inside the chart" empty/blank surfaces, so they stay
 * coherent with the landing instead of each re-inventing a centered card.
 *
 * Material is theme-paired via --bp-* (light: parchment + navy ink / dark: charcoal +
 * cream ink), so text placed on it (using --bp-ink / --bp-ink-soft) reads in BOTH modes.
 * IMPORTANT for callers: a primary CTA on this plate must be theme-STABLE — use the gold
 * gradient (var(--gradient-gold)) + a fixed dark ink, NOT bg-[var(--bp-ink)] (which can
 * desync against the plate in dark mode) and NOT --primary/--bg (which flip with theme).
 */
export function ChartPlate({
  label,
  coordinate,
  children,
  compact = false,
  className = '',
}: {
  /** Top-left mono plate label (blueprint register), e.g. "미개척 · UNCHARTED". */
  label?: string;
  /** Top-right decorative mono coordinate, hidden on mobile. */
  coordinate?: string;
  children: ReactNode;
  /** Tighter padding for secondary states (filter-no-results, sub-sections). */
  compact?: boolean;
  className?: string;
}) {
  return (
    <div
      className={`relative overflow-hidden rounded-2xl border border-[var(--bp-ink)]/15 bg-[var(--bp-paper)] shadow-[var(--shadow-md)] ${className}`}
    >
      <Graticule opacity={0.08} spacing={26} />
      {/* registration ticks — the chart-plate corner marks (landing signature) */}
      <span className="absolute top-2.5 left-2.5 w-3 h-3 border-t border-l border-[var(--bp-ink)]/30" aria-hidden />
      <span className="absolute top-2.5 right-2.5 w-3 h-3 border-t border-r border-[var(--bp-ink)]/30" aria-hidden />
      <span className="absolute bottom-2.5 left-2.5 w-3 h-3 border-b border-l border-[var(--bp-ink)]/30" aria-hidden />
      <span className="absolute bottom-2.5 right-2.5 w-3 h-3 border-b border-r border-[var(--bp-ink)]/30" aria-hidden />
      {label && (
        <span className="absolute top-3 left-5 text-[9px] font-mono uppercase tracking-[0.22em] text-[var(--bp-ink-soft)]/70">
          {label}
        </span>
      )}
      {coordinate && (
        <span className="absolute top-3 right-5 hidden sm:block text-[9px] font-mono tracking-[0.12em] text-[var(--bp-ink-soft)]/55 tabular-nums">
          {coordinate}
        </span>
      )}
      <div className={`relative flex flex-col items-center text-center px-6 ${compact ? 'py-10' : 'py-14 md:py-16'}`}>
        {children}
      </div>
    </div>
  );
}
