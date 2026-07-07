'use client';

import type { ReactNode } from 'react';
import { ArgusMascot, type ArgusMascotVariant } from './ArgusMascot';

export function MascotMoment({
  variant = 'sitting',
  title,
  children,
  compact = false,
  className = '',
}: {
  variant?: ArgusMascotVariant;
  title: string;
  children?: ReactNode;
  compact?: boolean;
  className?: string;
}) {
  return (
    <div
      className={[
        'argus-mascot-enter flex items-center gap-3 rounded-2xl border border-[var(--border-subtle)]/70 bg-[var(--surface)]/70 shadow-[var(--shadow-xs)]',
        compact ? 'px-3 py-2.5' : 'px-4 py-3.5',
        className,
      ].filter(Boolean).join(' ')}
    >
      <ArgusMascot variant={variant} size={compact ? 'sm' : 'md'} animate />
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
