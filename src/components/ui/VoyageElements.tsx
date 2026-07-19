'use client';

import Image from 'next/image';
import type { VoyageState } from '@/lib/voyage-state';
import { VoyageMarker } from '@/components/projects/VoyageMarker';

/**
 * Voyage visual elements for the Argus design system.
 * These translate sea-chart language into UI components.
 * (Supersedes the retired MusicalElements — orchestra metaphor is gone.)
 */

/* ────────────────────────────────────
   Graticule — 해도 위·경도 격자 배경
   Renders as an absolutely-positioned
   background layer inside its parent.
   The faint lat/long grid of a sea chart.
   ──────────────────────────────────── */

export function Graticule({
  opacity = 0.07,
  spacing = 28,
  className = '',
}: {
  opacity?: number;
  spacing?: number;
  className?: string;
}) {
  const lineColor = `rgba(181, 166, 140, ${opacity})`;
  const s = spacing;
  // A repeating tile with one horizontal + one vertical hairline = chart graticule.
  const svgPattern = `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}"><line x1="0" y1="0.5" x2="${s}" y2="0.5" stroke="${lineColor}" stroke-width="0.7"/><line x1="0.5" y1="0" x2="0.5" y2="${s}" stroke="${lineColor}" stroke-width="0.7"/></svg>`;

  return (
    <div
      className={`absolute inset-0 pointer-events-none ${className}`}
      aria-hidden="true"
      style={{
        backgroundImage: `url("data:image/svg+xml,${encodeURIComponent(svgPattern)}")`,
        backgroundRepeat: 'repeat',
      }}
    />
  );
}

/* ────────────────────────────────────
   ChartEdge — 항로 구간의 끝 표시
   A thin rule capped by a bold edge,
   like the border of a chart section.
   (Replaces the score's final barline.)
   ──────────────────────────────────── */

export function ChartEdge({
  height = 16,
  className = '',
}: {
  height?: number;
  className?: string;
}) {
  const color = 'var(--border)';
  const boldColor = 'var(--text-tertiary)';
  return (
    <div className={`flex items-center justify-center gap-[3px] ${className}`} role="separator" aria-hidden="true">
      <div style={{ width: 1, height, background: color }} />
      <div style={{ width: 3, height, background: boldColor, borderRadius: 1 }} />
    </div>
  );
}

/* ────────────────────────────────────
   VoyageShip — legacy API, canonical art

   Loading/error/404 surfaces still call this older component name. Keep the
   API, but render the same real Argus sea and chart instrument used by the
   project map instead of maintaining a second hand-drawn ship identity.
   ──────────────────────────────────── */

export function VoyageShip({
  state,
  size = 72,
  title,
  className = '',
}: {
  state: VoyageState;
  size?: number;
  title?: string;
  className?: string;
}) {
  const height = (size * 116) / 128;
  const markerSize = Math.max(24, Math.min(62, Math.round(size * 0.38)));
  const objectPosition = state === 'wrecked' || state === 'adrift'
    ? 'left center'
    : state === 'arrived' || state === 'verified'
      ? 'right bottom'
      : 'center';

  return (
    <span
      className={`relative inline-flex shrink-0 items-center justify-center overflow-hidden bg-[#082625] ${className}`}
      style={{ width: size, height, borderRadius: Math.max(8, Math.round(size * 0.08)) }}
      role="img"
      aria-label={title || `voyage state: ${state}`}
    >
      <Image
        src="/images/voyage/argus-sea-chart-v1.jpg"
        alt=""
        fill
        sizes={`${size}px`}
        quality={82}
        className="object-cover opacity-90"
        style={{ objectPosition }}
      />
      <span aria-hidden className="absolute inset-0 bg-[linear-gradient(180deg,rgba(2,25,24,.06),rgba(2,18,18,.34))] shadow-[inset_0_0_0_1px_rgba(245,240,229,.2)]" />
      <span
        className={`relative z-[1] ${state === 'sailing' || state === 'adrift' ? 'voyage-anim' : ''}`}
        style={state === 'sailing' ? { animationName: 'voyage-bob' } : state === 'adrift' ? { animationName: 'voyage-list' } : undefined}
      >
        <VoyageMarker state={state} size={markerSize} />
      </span>
    </span>
  );
}
