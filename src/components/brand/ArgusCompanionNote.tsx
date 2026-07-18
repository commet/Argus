'use client';

import type { ReactNode } from 'react';
import { ArgusMascot, type ArgusMoment } from './ArgusMascot';

export function ArgusCompanionNote({
  moment = 'companion',
  title,
  children,
  compact = false,
  bare = false,
  mascotClassName = '',
  className = '',
}: {
  moment?: Extract<ArgusMoment, 'companion' | 'watching'>;
  title: string;
  children?: ReactNode;
  compact?: boolean;
  /** Removes the card shell so the companion can sit as a margin note. */
  bare?: boolean;
  mascotClassName?: string;
  className?: string;
}) {
  return (
    <div
      className={[
        'argus-presence-note flex gap-3',
        bare
          ? 'items-end'
          : 'items-center rounded-xl border border-[var(--border-subtle)]/70 bg-[var(--surface)]/72 shadow-[var(--shadow-xs)]',
        bare ? '' : compact ? 'px-3 py-2.5' : 'px-4 py-3.5',
        className,
      ].filter(Boolean).join(' ')}
    >
      <ArgusMascot moment={moment} size={compact ? 'sm' : 'md'} alt="" loading="eager" className={mascotClassName} />
      <div className="min-w-0 text-left">
        <p className="text-[13px] font-semibold text-[var(--text-primary)] leading-snug">{title}</p>
        {children && (
          <div className="mt-0.5 text-[12px] leading-[1.55] text-[var(--text-secondary)]">
            {children}
          </div>
        )}
      </div>
    </div>
  );
}
