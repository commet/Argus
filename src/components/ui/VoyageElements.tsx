'use client';

import type { VoyageState } from '@/lib/voyage-state';

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

/* ════════════════════════════════════════════════════════════
   VoyageShip — 프로젝트 = 해도 위의 범선

   Hand-drawn sea-chart ink, not a box. One three-masted vessel,
   re-rigged per voyage state. Ink line = var(--bp-ink) (steel-blue
   in dark mode via .voyage-ink); gold leaf = var(--accent).

   docked   출항 전 — moored, sails furled, anchor down
   sailing  항해 중 — full sail, heeling, bow wave, pennant streaming
   adrift   표류    — slack sails, listing, lost in fog
   wrecked  난파    — hull listing & half-sunk, mast snapped, sail torn,
                      a pin marking the question they fled
   arrived  입항    — level at port, sails furled, flag raised (unconfirmed)
   verified 검증된 항해 — gold flag, sealed, faint shimmer
   ════════════════════════════════════════════════════════════ */

const INK = 'var(--bp-ink)';
const GOLD = 'var(--accent)';

/** Per-state stroke/anim tuning. */
function rigOf(state: VoyageState) {
  switch (state) {
    case 'sailing':  return { tilt: -3, sink: 0, opacity: 1,    anim: 'voyage-bob' };
    case 'adrift':   return { tilt: 2,  sink: 1, opacity: 0.78, anim: 'voyage-list' };
    case 'wrecked':  return { tilt: 9,  sink: 6, opacity: 0.92, anim: '' };
    default:         return { tilt: 0,  sink: 0, opacity: 1,    anim: '' };
  }
}

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
  const { tilt, sink, opacity, anim } = rigOf(state);
  const furled = state === 'docked' || state === 'arrived' || state === 'verified';
  const full = state === 'sailing';
  const slack = state === 'adrift';
  const torn = state === 'wrecked';
  const atPort = state === 'arrived' || state === 'verified';

  // shared stroke props for ink linework
  const ink = { stroke: INK, strokeWidth: 1.6, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none' };
  const inkThin = { ...ink, strokeWidth: 1.1 };

  return (
    <svg
      viewBox="0 0 128 116"
      width={size}
      height={(size * 116) / 128}
      className={`voyage-ink ${anim ? 'voyage-anim' : ''} ${className}`}
      style={anim ? { animationName: anim } : undefined}
      role="img"
      aria-label={title || `voyage state: ${state}`}
    >
      {title ? <title>{title}</title> : null}

      {/* ── Sea: waterline + a few chart wave ticks ── */}
      <g opacity={0.55}>
        <path d="M 6 89 H 122" {...inkThin} />
        <path d="M 16 93 q 3 -3 6 0 M 30 95 q 3 -3 6 0 M 96 93 q 3 -3 6 0 M 110 95 q 3 -3 6 0" {...inkThin} strokeWidth={0.9} />
      </g>

      {/* ── Port marker (arrived / verified): a jetty the ship is moored at ── */}
      {atPort && (
        <g>
          <path d="M 98 85 H 122" stroke={INK} strokeWidth={2.2} strokeLinecap="round" fill="none" />
          <path d="M 102 85 V 92 M 112 85 V 92 M 121 85 V 91" {...inkThin} />
          <path d="M 121 85 V 71" {...inkThin} />
          <path d="M 121 71 L 128 73.5 L 121 76 Z" stroke="none" fill={state === 'verified' ? GOLD : INK} opacity={state === 'verified' ? 0.95 : 0.4} />
        </g>
      )}

      {/* ── Mooring anchor (docked) ── */}
      {state === 'docked' && (
        <g opacity={0.6}>
          <path d="M 99 65 L 103 88" {...inkThin} />
          <path d="M 103 88 m -4 -3 a 4 4 0 1 0 8 0 M 103 80 V 92 M 98 91 h 10" {...inkThin} strokeWidth={1.2} />
        </g>
      )}

      {/* ── The ship — heels / sinks per state ── */}
      <g
        opacity={opacity}
        style={{ transform: `translateY(${sink}px) rotate(${tilt}deg)`, transformOrigin: '64px 84px' }}
      >
        {/* Hull */}
        <path
          d="M 28 66 C 24 75 32 86 46 86 L 80 86 C 94 86 102 75 98 66 Q 63 71 28 66 Z"
          stroke={INK}
          strokeWidth={1.8}
          strokeLinejoin="round"
          fill="var(--bp-paper)"
        />
        {/* Wale stripe — gold leaf */}
        <path d="M 31 73 Q 63 77.5 95 73" stroke={GOLD} strokeWidth={1.3} fill="none" opacity={0.7} />
        {/* Sterncastle + bow beak */}
        <path d="M 28 66 L 26.5 57 L 35 57 L 36 66" {...ink} />
        <path d="M 90 66 L 92 59.5 L 99 61.5 L 98 66" {...ink} />

        {/* Masts — mizzen / main / fore (main snaps when wrecked) */}
        <path d={torn ? 'M 60 66 V 38' : 'M 60 66 V 14'} {...ink} />
        {torn && <path d="M 60.5 38 L 80 31" {...ink} />} {/* snapped main top */}
        <path d="M 44 66 V 34" {...ink} />
        <path d="M 78 66 V 28" {...ink} />
        {/* Bowsprit */}
        <path d="M 96 64 L 118 56" {...ink} />

        {/* Yards (spars) — hidden where the mast snapped */}
        {!torn && <path d="M 51 21 H 69 M 46 40 H 74 M 68 40 H 90" {...inkThin} />}
        {torn && <path d="M 46 40 H 74" {...inkThin} />}

        {/* ── Sails / canvas, per state ── */}
        {full && (
          <g fill="var(--bp-paper)" stroke={INK} strokeWidth={1.4} strokeLinejoin="round">
            <path d="M 52 22 L 68 22 Q 73 28 69 34 L 51 33 Q 48 27 52 22 Z" />
            <path d="M 47 41 L 73 41 Q 81 52 73 63 L 48 60 Q 42 50 47 41 Z" />
            <path d="M 69 41 L 89 41 Q 94 50 89 59 L 70 57 Q 65 49 69 41 Z" />
          </g>
        )}
        {slack && (
          <g fill="var(--bp-paper)" stroke={INK} strokeWidth={1.3} strokeLinejoin="round">
            <path d="M 52 22 L 68 22 Q 67 30 66 37 Q 60 33 54 37 Q 53 30 52 22 Z" />
            <path d="M 48 41 L 72 41 Q 70 57 69 67 Q 60 61 51 67 Q 50 57 48 41 Z" />
            <path d="M 70 41 L 89 41 Q 88 56 87 65 Q 79 59 71 65 Q 70 56 70 41 Z" />
          </g>
        )}
        {furled && (
          <g fill="var(--bp-paper)" stroke={INK} strokeWidth={1.2} strokeLinejoin="round">
            <path d="M 51 21 Q 60 19 69 21 Q 60 24 51 21 Z" />
            <path d="M 46 39 Q 60 37 74 39 Q 60 43 46 39 Z" />
            <path d="M 68 39 Q 79 37 90 39 Q 79 43 68 39 Z" />
          </g>
        )}
        {torn && (
          <path
            d="M 47 41 L 73 41 L 70 54 L 64 47 L 58 56 L 52 48 L 48 55 Z"
            fill="var(--bp-paper)"
            stroke={INK}
            strokeWidth={1.2}
            strokeLinejoin="round"
            opacity={0.85}
          />
        )}

        {/* ── Flags & pennants ── */}
        {full && (
          <>
            <path d="M 60 14 L 82 18 L 60 22 Z" fill={GOLD} stroke="none" />
            <path d="M 78 28 L 90 30.5 L 78 33 Z" fill={GOLD} stroke="none" opacity={0.7} />
          </>
        )}
        {state === 'arrived' && <path d="M 60 14 L 74 15.5 L 74 22 L 60 21 Z" fill={INK} stroke="none" opacity={0.4} />}
        {state === 'verified' && (
          <>
            <path d="M 60 14 L 75 15.5 L 75 22.5 L 60 21 Z" fill={GOLD} stroke="none" />
            <path d="M 64 18 l 2 2 l 4 -4" stroke="var(--bp-paper)" strokeWidth={1.4} fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </>
        )}
      </g>

      {/* ── Bow wave (sailing only) ── */}
      {full && <path d="M 98 86 Q 108 82 116 86 Q 108 89.5 98 86 Z" fill={GOLD} stroke="none" opacity={0.45} />}

      {/* ── Fog band (adrift) — lost, becalmed ── */}
      {slack && (
        <g className="voyage-fog" aria-hidden="true">
          <rect x="-10" y="40" width="148" height="30" rx="15" fill="var(--text-tertiary)" opacity={0.16} />
          <path d="M 20 50 h 30 M 70 58 h 34 M 40 64 h 40" stroke="var(--text-tertiary)" strokeWidth={2} strokeLinecap="round" opacity={0.3} />
        </g>
      )}

      {/* ── Wreck pin — marks the question they fled ── */}
      {torn && (
        <g>
          <path d="M 60 8 a 5 5 0 1 0 0.01 0 M 60 17 L 55.5 9.5 M 60 17 L 64.5 9.5" stroke={GOLD} strokeWidth={1.6} fill="var(--bp-paper)" strokeLinejoin="round" />
          <circle cx="60" cy="12.5" r="1.6" fill={GOLD} stroke="none" />
        </g>
      )}

      {/* ── Submersion (wrecked) — sea closes over the listing hull ── */}
      {torn && (
        <path d="M 6 82 Q 40 79 64 82 T 122 82 V 116 H 6 Z" fill="var(--text-tertiary)" stroke="none" opacity={0.22} />
      )}
    </svg>
  );
}
