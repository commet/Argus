'use client';

import Image from 'next/image';

export function ClosingAnchorMark({
  size = 48,
  className = '',
  alt = '',
}: {
  size?: number;
  className?: string;
  alt?: string;
}) {
  return (
    <span
      className={`relative inline-flex shrink-0 overflow-hidden rounded-full bg-[#061b1b] ${className}`}
      style={{ width: size, height: size }}
      aria-hidden={alt ? undefined : true}
    >
      <Image
        src="/images/voyage/closing-anchor-mark-v1.jpg"
        alt={alt}
        fill
        sizes={`${size}px`}
        quality={90}
        className="object-cover"
      />
    </span>
  );
}
