'use client';

import Image from 'next/image';
import type { CSSProperties } from 'react';

export type ArgusMoment = 'companion' | 'witness' | 'watching' | 'returning' | 'settled';
export type ArgusMascotSize = 'sm' | 'md' | 'lg' | 'hero';

/**
 * Two masters per moment:
 *   src  — the original plate. Its cream paper background is baked into the
 *          pixels (JPEG has no alpha), which is fine INSIDE a plate, because the
 *          plate's own `bg-[#e9e3d8]` is the same cream.
 *   cut  — a real alpha cutout of the same art (scripts/make-mascot-cutouts.mjs).
 *          Used when there is no plate, because there the baked rectangle has
 *          nothing to hide behind and reads as a box floating on the page.
 * See the `plate` prop below for why this pairing exists rather than one file.
 */
const MOMENT: Record<ArgusMoment, { src: string; cut: string; shape: 'portrait' | 'square' | 'wide'; position: string; motion: string }> = {
  companion: {
    src: '/images/brand/argus-v2/argus-companion.jpg',
    cut: '/images/brand/argus-v2/argus-companion-cut.webp',
    shape: 'portrait',
    position: 'object-center',
    motion: 'argus-presence-breathe',
  },
  witness: {
    src: '/images/brand/argus-v2/argus-canon.jpg',
    cut: '/images/brand/argus-v2/argus-canon-cut.webp',
    shape: 'square',
    position: 'object-center',
    motion: 'argus-presence-acknowledge',
  },
  watching: {
    src: '/images/brand/argus-v2/argus-watching.jpg',
    cut: '/images/brand/argus-v2/argus-watching-cut.webp',
    shape: 'wide',
    position: 'object-center',
    motion: 'argus-presence-breathe',
  },
  returning: {
    src: '/images/brand/argus-v2/argus-returning.jpg',
    cut: '/images/brand/argus-v2/argus-returning-cut.webp',
    shape: 'square',
    position: 'object-center',
    motion: 'argus-presence-return',
  },
  settled: {
    src: '/images/brand/argus-v2/argus-returning.jpg',
    cut: '/images/brand/argus-v2/argus-returning-cut.webp',
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
  // No plate → the dog stands directly on the page, so it must be the alpha
  // cutout and must be CONTAINED (cover would crop a free-standing figure at the
  // box edge, which looks like a clipped sticker). Inside a plate the original
  // fills the frame edge to edge, as a mounted plate should.
  const bare = !plate;
  return (
    <span
      className={[
        'argus-presence relative inline-flex shrink-0',
        plate ? 'overflow-hidden rounded-[14px] bg-[#e9e3d8] shadow-[0_5px_18px_rgba(49,38,23,0.10)]' : '',
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
        src={bare ? config.cut : config.src}
        alt={alt ?? ''}
        aria-hidden={alt ? undefined : true}
        fill
        loading={loading}
        sizes={config.shape === 'wide' ? '(max-width: 768px) 144px, 256px' : '(max-width: 768px) 112px, 144px'}
        className={`${bare ? 'object-contain' : 'object-cover'} ${config.position}`}
        draggable={false}
      />
    </span>
  );
}
