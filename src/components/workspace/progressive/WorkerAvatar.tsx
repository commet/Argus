'use client';

import type { WorkerPersona } from '@/stores/types';

/**
 * Persona Avatar — 컬러 이니셜 + 역할 아이콘
 * 이모지 대신 따뜻하면서 프로페셔널한 아바타.
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
  const dims = { sm: 'w-6 h-6', md: 'w-8 h-8', lg: 'w-10 h-10' };
  const textSize = { sm: 'text-[12px]', md: 'text-[12px]', lg: 'text-[14px]' };
  const iconSize = { sm: 'text-[7px]', md: 'text-[8px]', lg: 'text-[12.5px]' };

  if (!persona) {
    return (
      <div className={`${dims[size]} rounded-full bg-[var(--border-subtle)] flex items-center justify-center shrink-0`}>
        <span className={`${textSize[size]} font-bold text-[var(--text-tertiary)]`}>?</span>
      </div>
    );
  }

  const initial = persona.name.charAt(0);
  const bgColor = `${persona.color}18`; // 10% opacity hex
  const borderColor = `${persona.color}40`; // 25% opacity

  return (
    <div
      className={`${dims[size]} rounded-full flex items-center justify-center shrink-0 relative ${pulse ? 'animate-pulse' : ''}`}
      style={{
        backgroundColor: bgColor,
        border: `1.5px solid ${borderColor}`,
      }}
      aria-label={`${persona.name} · ${persona.role}`}
      role="img"
    >
      <span className={`${textSize[size]} font-bold`} style={{ color: persona.color }}>
        {initial}
      </span>
      <span className={`absolute -bottom-0.5 -right-0.5 ${iconSize[size]} leading-none`} aria-hidden="true">
        {persona.emoji}
      </span>
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
