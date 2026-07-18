import type { CSSProperties } from 'react';

export type ArgusSigilSize = 'sm' | 'md' | 'lg';

const SIZE: Record<ArgusSigilSize, string> = {
  sm: 'w-6 h-6',
  md: 'w-8 h-8',
  lg: 'w-9 h-9',
};

/**
 * Argus's collar tag, reduced to a durable identity mark. The collar names the
 * loyal companion; the brass bearing point names memory, watch, and return.
 * It intentionally contains no face, letterform, or status meaning.
 */
export function ArgusSigil({
  size = 'md',
  label,
  className = '',
  style,
}: {
  size?: ArgusSigilSize;
  label?: string;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <span
      className={`argus-sigil inline-flex shrink-0 items-center justify-center ${SIZE[size]} ${className}`}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      style={style}
    >
      <svg viewBox="0 0 36 36" width="100%" height="100%" fill="none" aria-hidden="true">
        <path
          d="M6.2 9.6c6.7-2.5 16.9-2.5 23.6 0"
          stroke="#56696A"
          strokeWidth="3.8"
          strokeLinecap="round"
        />
        <path
          d="M15.3 9.1v4.2h5.4V9.1"
          fill="#E9E3D8"
          stroke="#242321"
          strokeWidth="1.15"
          strokeLinejoin="round"
        />
        <path
          d="m18 13.1 7 3.2-1.6 10.9L18 31l-5.4-3.8L11 16.3l7-3.2Z"
          fill="#A8842F"
          stroke="#242321"
          strokeWidth="1.25"
          strokeLinejoin="round"
        />
        <path
          d="m18 17.7 3.3 4-3.3 5.1-3.3-5.1 3.3-4Z"
          fill="#E9E3D8"
          stroke="#56696A"
          strokeWidth=".8"
          strokeLinejoin="round"
        />
        <path d="M18 18.6v7.1" stroke="#242321" strokeWidth=".85" strokeLinecap="round" opacity=".72" />
      </svg>
    </span>
  );
}
