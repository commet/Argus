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
  playful = false,
  className = '',
  style,
}: {
  variant?: ArgusMascotVariant;
  size?: ArgusMascotSize;
  alt?: string;
  framed?: boolean;
  animate?: boolean;
  /** Warm "moment" surfaces (seal / settle): a periodic cute wag instead of the
   *  calm breathe. Implies animate. Honors prefers-reduced-motion. */
  playful?: boolean;
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
        // 마스코트 PNG는 불투명(크림 양피지 배경이 구워진 RGB)이라 흰 박스+링에
        // 얹으면 '스티커'처럼 뜬다. 그림의 크림(#ECE3D5)에 맞춘 따뜻한 판 위에 올려
        // 액자가 아니라 '의도된 일러스트 판'으로 읽히게. 밝은 그림이므로 다크모드에도
        // 어두운 박스가 아니라 같은 따뜻한 판을 유지한다(광택 인셋 하이라이트 제거).
        framed ? 'rounded-xl bg-[#ece3d4] ring-1 ring-black/[0.05] shadow-[0_4px_14px_rgba(70,52,30,0.12)]' : '',
        playful ? 'argus-mascot-wiggle' : animate ? 'argus-mascot-breathe' : '',
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
        className={variant === 'sitting' ? 'object-contain' : 'object-cover'}
        draggable={false}
      />
    </span>
  );
}
