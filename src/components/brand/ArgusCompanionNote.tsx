'use client';

import type { ReactNode } from 'react';
import { ArgusMascot, type ArgusMoment } from './ArgusMascot';

export function ArgusCompanionNote({
  moment = 'companion',
  title,
  children,
  compact = false,
  className = '',
}: {
  moment?: Extract<ArgusMoment, 'companion' | 'watching'>;
  title: string;
  children?: ReactNode;
  compact?: boolean;
  className?: string;
}) {
  return (
    <div
      className={[
        'argus-presence-note flex items-center gap-3 rounded-xl border border-[var(--border-subtle)]/70 bg-[var(--surface)]/72 shadow-[var(--shadow-xs)]',
        compact ? 'px-3 py-2.5' : 'px-4 py-3.5',
        className,
      ].filter(Boolean).join(' ')}
    >
      <ArgusMascot moment={moment} size={compact ? 'sm' : 'md'} alt="" loading="eager" />
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
