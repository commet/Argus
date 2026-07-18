import type { CSSProperties } from 'react';

export type ArgusMarkSize = 'xs' | 'sm' | 'md' | 'lg';
export type ArgusMarkTone = 'ink' | 'gold' | 'signal' | 'muted';

const SIZE: Record<ArgusMarkSize, string> = {
  xs: 'w-4 h-4',
  sm: 'w-6 h-6',
  md: 'w-8 h-8',
  lg: 'w-10 h-10',
};

const TONE: Record<ArgusMarkTone, { ink: string; eye: string; field: string }> = {
  ink: { ink: 'var(--text-primary)', eye: '#a8842f', field: 'var(--surface)' },
  gold: { ink: '#302713', eye: '#f3df9a', field: 'var(--accent)' },
  signal: { ink: '#26322d', eye: '#d1b85f', field: '#dfe7dc' },
  muted: { ink: 'var(--text-tertiary)', eye: '#a8842f', field: 'var(--bg)' },
};

/** Small-format Argus identity for chrome and status UI below 64px. */
export function ArgusMark({
  size = 'md',
  tone = 'ink',
  framed = true,
  label,
  className = '',
  style,
}: {
  size?: ArgusMarkSize;
  tone?: ArgusMarkTone;
  framed?: boolean;
  label?: string;
  className?: string;
  style?: CSSProperties;
}) {
  const color = TONE[tone];
  return (
    <span
      className={`argus-mark inline-flex shrink-0 items-center justify-center ${framed ? 'rounded-[8px] shadow-[var(--shadow-xs)]' : ''} ${SIZE[size]} ${className}`}
      style={{ background: framed ? color.field : undefined, color: color.ink, ...style }}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <svg viewBox="0 0 36 36" width="100%" height="100%" fill="none" aria-hidden="true">
        <path d="M8.1 15.1 9.7 5.7l6 5.1c1.5-.4 3.1-.4 4.6 0l6-5.1 1.6 9.4c1.2 1.8 1.8 3.9 1.8 6.1 0 6.6-5.2 10.1-11.7 10.1S6.3 27.8 6.3 21.2c0-2.2.6-4.3 1.8-6.1Z" fill="currentColor" />
        <path d="m11.1 8.9 3.3 2.9-4.1 1.6.8-4.5Zm13.8 0-3.3 2.9 4.1 1.6-.8-4.5Z" fill={color.eye} opacity=".58" />
        <ellipse cx="13.7" cy="19.2" rx="2" ry="2.35" fill={color.eye} />
        <ellipse cx="22.3" cy="19.2" rx="2" ry="2.35" fill={color.eye} />
        <circle cx="14.2" cy="18.7" r=".55" fill="#fff" opacity=".8" />
        <circle cx="22.8" cy="18.7" r=".55" fill="#fff" opacity=".8" />
        <path d="M15.6 23.2c1.5-.8 3.3-.8 4.8 0l-1 1.7h-2.8l-1-1.7Z" fill={color.field} opacity=".88" />
        <path d="M18 25v2.1m-3.4-.2c1.9 1.3 4.9 1.3 6.8 0" stroke={color.field} strokeWidth="1.15" strokeLinecap="round" />
        <path d="m15.2 30.2 2.8-1.1 2.8 1.1-.6 3.1-2.2 1.2-2.2-1.2-.6-3.1Z" fill={color.eye} stroke={color.ink} strokeWidth=".7" />
      </svg>
    </span>
  );
}
