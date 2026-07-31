'use client';

import { ScanSearch } from 'lucide-react';
import { useLocale } from '@/hooks/useLocale';
import type { WorkerPersona } from '@/stores/types';
import { personaReviewLabel } from './shared/persona-format';

/**
 * Review marker — a quiet functional mark, not a fictional person's avatar.
 */
export function WorkerAvatar({
  persona,
  size = 'md',
  pulse = false,
}: {
  persona: WorkerPersona | null;
  size?: 'sm' | 'md' | 'lg';
  pulse?: boolean;
}) {
  const locale = useLocale();
  const dims = { sm: 'w-6 h-6', md: 'w-8 h-8', lg: 'w-10 h-10' };
  const iconSize = { sm: 12, md: 14, lg: 17 };

  if (!persona) {
    return (
      <div className={`${dims[size]} rounded-full bg-[var(--border-subtle)] flex items-center justify-center shrink-0`}>
        <ScanSearch size={iconSize[size]} className="text-[var(--text-tertiary)]" aria-hidden />
      </div>
    );
  }

  const label = personaReviewLabel(persona, locale);

  return (
    <div
      className={`${dims[size]} rounded-full flex items-center justify-center shrink-0 relative border border-[var(--border)] bg-[var(--surface)] text-[var(--text-secondary)] ${pulse ? 'animate-pulse' : ''}`}
      aria-label={label}
      role="img"
    >
      <ScanSearch size={iconSize[size]} strokeWidth={1.7} aria-hidden />
    </div>
  );
}

/**
 * Inline avatar row — 배치 배너 등에서 아바타를 나란히 표시
 */
export function AvatarRow({ personas, maxShow = 5 }: { personas: (WorkerPersona | null)[]; maxShow?: number }) {
  const shown = personas.slice(0, maxShow);
  const overflow = personas.length - maxShow;

  return (
    <div className="flex items-center -space-x-1.5">
      {shown.map((p, i) => (
        <div key={p?.id ?? i} className="relative" style={{ zIndex: shown.length - i }}>
          <WorkerAvatar persona={p} size="sm" />
        </div>
      ))}
      {overflow > 0 && (
        <span className="ml-1 text-[12px] text-[var(--text-tertiary)]">+{overflow}</span>
      )}
    </div>
  );
}
