'use client';

import Image from 'next/image';
import type { CSSProperties } from 'react';

export type ArgusMoment = 'companion' | 'witness' | 'watching' | 'returning' | 'settled';
export type ArgusMascotSize = 'sm' | 'md' | 'lg' | 'hero';

const MOMENT: Record<ArgusMoment, { src: string; shape: 'portrait' | 'square' | 'wide'; position: string; motion: string }> = {
  companion: {
    src: '/images/brand/argus-v2/argus-companion.jpg',
    shape: 'portrait',
    position: 'object-center',
    motion: 'argus-presence-breathe',
  },
  witness: {
    src: '/images/brand/argus-v2/argus-canon.jpg',
    shape: 'square',
    position: 'object-center',
    motion: 'argus-presence-acknowledge',
  },
  watching: {
    src: '/images/brand/argus-v2/argus-watching.jpg',
    shape: 'wide',
    position: 'object-center',
    motion: 'argus-presence-breathe',
  },
  returning: {
    src: '/images/brand/argus-v2/argus-returning.jpg',
    shape: 'square',
    position: 'object-center',
    motion: 'argus-presence-return',
  },
  settled: {
    src: '/images/brand/argus-v2/argus-returning.jpg',
    shape: 'square',
    position: 'object-center',
    motion: 'argus-presence-settle',
  },
};

const SIZE: Record<'portrait' | 'square' | 'wide', Record<ArgusMascotSize, string>> = {
  portrait: {
    sm: 'w-16 h-20',
    md: 'w-20 h-24',
    lg: 'w-28 h-36',
    hero: 'w-36 h-48',
  },
  square: {
    sm: 'w-16 h-16',
    md: 'w-20 h-20',
    lg: 'w-28 h-28',
    hero: 'w-36 h-36',
  },
  wide: {
    sm: 'w-28 h-16',
    md: 'w-36 h-20',
    lg: 'w-48 h-28',
    hero: 'w-64 h-36',
  },
};

/**
 * Canonical full Argus presence. Call sites choose a product moment, never an
 * image filename or a generic emotion; pose and motion follow the brand canon.
 */
export function ArgusMascot({
  moment,
  size = 'md',
  alt,
  motion = 'auto',
  plate = true,
  interactive = false,
  loading = 'lazy',
  className = '',
  style,
}: {
  moment: ArgusMoment;
  size?: ArgusMascotSize;
  alt?: string;
  motion?: 'auto' | 'still';
  plate?: boolean;
  interactive?: boolean;
  loading?: 'eager' | 'lazy';
  className?: string;
  style?: CSSProperties;
}) {
  const config = MOMENT[moment];
  return (
    <span
      className={[
        'argus-presence relative inline-flex shrink-0 overflow-hidden',
        plate ? 'rounded-[14px] bg-[#e9e3d8] shadow-[0_5px_18px_rgba(49,38,23,0.10)]' : '',
        motion === 'auto' ? config.motion : '',
        interactive ? 'argus-presence-interactive' : '',
        SIZE[config.shape][size],
        className,
      ].filter(Boolean).join(' ')}
      data-argus-moment={moment}
      data-interactive={interactive || undefined}
      style={style}
    >
      <Image
        src={config.src}
        alt={alt ?? ''}
        aria-hidden={alt ? undefined : true}
        fill
        loading={loading}
        sizes={config.shape === 'wide' ? '(max-width: 768px) 144px, 256px' : '(max-width: 768px) 112px, 144px'}
        className={`object-cover ${config.position}`}
        draggable={false}
      />
    </span>
  );
}
