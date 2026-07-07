'use client';

import Image from 'next/image';
import type { CSSProperties } from 'react';

export type ArgusMascotVariant = 'head' | 'sitting' | 'watching';
export type ArgusMascotSize = 'xs' | 'sm' | 'md' | 'lg';

const SRC: Record<ArgusMascotVariant, string> = {
  head: '/images/brand/argus/argus-head.png',
  sitting: '/images/brand/argus/argus-sitting.png',
  watching: '/images/brand/argus/argus-watching.png',
};

const SIZE: Record<ArgusMascotSize, string> = {
  xs: 'w-9 h-9',
  sm: 'w-12 h-12',
  md: 'w-16 h-16',
  lg: 'w-24 h-24',
};

export function ArgusMascot({
  variant = 'head',
  size = 'sm',
  alt,
  framed = true,
  animate = false,
  className = '',
  style,
}: {
  variant?: ArgusMascotVariant;
  size?: ArgusMascotSize;
  alt?: string;
  framed?: boolean;
  animate?: boolean;
  className?: string;
  style?: CSSProperties;
}) {
  const isWide = variant === 'watching';
  const wrapperSize = isWide
    ? size === 'lg' ? 'w-36 h-16' : size === 'md' ? 'w-28 h-12' : size === 'sm' ? 'w-24 h-10' : 'w-20 h-9'
    : SIZE[size];

  return (
    <span
      className={[
        'argus-mascot relative inline-flex shrink-0 overflow-hidden',
        framed ? 'rounded-xl bg-[var(--bp-paper)] shadow-[0_1px_0_rgba(255,255,255,.65)_inset,0_8px_24px_rgba(26,20,12,.10)] ring-1 ring-[var(--border-subtle)]/70' : '',
        animate ? 'argus-mascot-breathe' : '',
        wrapperSize,
        className,
      ].filter(Boolean).join(' ')}
      style={style}
    >
      <Image
        src={SRC[variant]}
        alt={alt ?? ''}
        aria-hidden={alt ? undefined : true}
        fill
        loading={size === 'lg' ? 'eager' : 'lazy'}
        sizes={size === 'lg' ? '144px' : size === 'md' ? '112px' : size === 'sm' ? '96px' : '80px'}
        className="object-cover"
        draggable={false}
      />
    </span>
  );
}
