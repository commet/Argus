import Image from 'next/image';
import type { CSSProperties } from 'react';

export type ArgusFaceMarkSize = 'sm' | 'md' | 'lg';

const SIZE: Record<ArgusFaceMarkSize, string> = {
  sm: 'w-6 h-6',
  md: 'w-8 h-8',
  lg: 'w-9 h-9',
};

/**
 * The canonical Argus face, purpose-cropped for persistent identity chrome.
 * This is the real character artwork, never a redrawn miniature or generic icon.
 */
export function ArgusFaceMark({
  size = 'md',
  className = '',
  style,
}: {
  size?: ArgusFaceMarkSize;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <span
      className={`argus-face-mark relative inline-flex shrink-0 overflow-hidden rounded-[7px] bg-[#e9e3d8] ring-1 ring-black/[0.08] ${SIZE[size]} ${className}`}
      aria-hidden="true"
      style={style}
    >
      <Image
        src="/images/brand/argus-v2/argus-face-mark-v2.jpg"
        alt=""
        fill
        loading="eager"
        sizes="36px"
        className="object-cover"
        draggable={false}
      />
    </span>
  );
}
