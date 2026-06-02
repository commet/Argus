'use client';

/**
 * ShipCutaway — Act 2 illustration (top-down deck plan).
 *
 * Bow faces right, stern at left. Reading the deck from left to right is
 * also reading the work flow:
 *   Helm (1st Mate) → Chart table (Cartographers) → Workshop (Artisans)
 *   → Lookout (Watch) → Forward rail (Scouts).
 *
 * Each station is built around a *dominant object* (helm wheel, chart table,
 * workbenches, mounted spyglass, bow point) so the five zones are
 * geometrically distinct at a glance — circle / rectangle / cluster /
 * vertical spike / wedge.
 *
 * Stations are addressable via `<g data-station="...">` so the parent can
 * highlight them in sync with the StationCards' hover state.
 */

import type React from 'react';
import type { DivisionId } from '@/data/voyage-crew';

// ────────────────────────────────────────────────────────────────────
// Geometry — bow right, stern left
// ────────────────────────────────────────────────────────────────────

const VB_W = 1200;
const VB_H = 580;

// Hull (top-down silhouette): squared stern at left, pointed bow at right.
// Slight tumblehome on stern corners; ogival arc into the bow.
const HULL_OUTER = `
  M 124 168
  L 1000 168
  C 1054 168, 1108 196, 1148 290
  C 1108 384, 1054 412, 1000 412
  L 124 412
  C 110 412, 100 402, 100 388
  L 100 192
  C 100 178, 110 168, 124 168
  Z
`;

// Inner deck (bulwark thickness ~12px)
const HULL_INNER = `
  M 138 180
  L 996 180
  C 1042 180, 1090 204, 1124 290
  C 1090 376, 1042 400, 996 400
  L 138 400
  C 130 400, 124 394, 124 386
  L 124 194
  C 124 186, 130 180, 138 180
  Z
`;

// Mast cross-sections (along centerline y=290)
const MIZZEN = { cx: 290, cy: 290, r: 9 };
const MAINMAST = { cx: 580, cy: 290, r: 12 };
const FOREMAST = { cx: 870, cy: 290, r: 9 };

// Helm wheel (stern)
const HELM = { cx: 200, cy: 290, r: 32 };

// Capstan (between mainmast and helm-area, gives the deck rhythm)
const CAPSTAN = { cx: 410, cy: 290, r: 14 };

// ────────────────────────────────────────────────────────────────────
// Reusable bits
// ────────────────────────────────────────────────────────────────────

/** Person seen from above: head circle + shoulder oval. The oval's long axis
 *  hints at the body's facing direction. */
function Figure({
  cx,
  cy,
  active = false,
  facing = 0, // degrees; 0 = facing right (bow)
  size = 1,
}: {
  cx: number;
  cy: number;
  active?: boolean;
  facing?: number;
  size?: number;
}) {
  const rx = 9 * size;
  const ry = 5.5 * size;
  const r = 4.6 * size;
  return (
    <g transform={`translate(${cx}, ${cy}) rotate(${facing})`}>
      {/* shoulders */}
      <ellipse
        cx={0}
        cy={1.5}
        rx={rx}
        ry={ry}
        fill={active ? 'var(--bp-ink)' : 'var(--bp-paper)'}
        stroke="currentColor"
        strokeWidth={active ? 1.1 : 0.95}
      />
      {/* head */}
      <circle
        cx={0}
        cy={-1.2}
        r={r}
        fill={active ? 'var(--bp-paper)' : 'var(--bp-ink)'}
        stroke="currentColor"
        strokeWidth={0.6}
      />
    </g>
  );
}

function StationLabel({
  x,
  y,
  number,
  text,
}: {
  x: number;
  y: number;
  number: string;
  text: string;
}) {
  return (
    <g>
      <text
        x={x}
        y={y}
        textAnchor="middle"
        style={{
          font: '600 9.5px var(--font-mono), monospace',
          fill: 'var(--bp-ink)',
          letterSpacing: '0.18em',
        }}
      >
        {`No. ${number}`}
      </text>
      <text
        x={x}
        y={y + 13}
        textAnchor="middle"
        style={{
          font: '500 10px var(--font-mono), monospace',
          fill: 'var(--bp-ink-soft)',
          letterSpacing: '0.32em',
        }}
      >
        {text}
      </text>
    </g>
  );
}

/** Helm wheel — 8 spokes + center hub + outer rim grip ring. */
function HelmWheel({ cx, cy, r, active }: { cx: number; cy: number; r: number; active?: boolean }) {
  const spokes = 8;
  return (
    <g transform={`translate(${cx}, ${cy})`}>
      {/* outer grip ring */}
      <circle r={r} fill="var(--bp-paper)" stroke="currentColor" strokeWidth="1.4" />
      <circle r={r - 4} fill="none" stroke="currentColor" strokeWidth="0.55" opacity="0.6" />
      {/* 8 grip handles around outer ring */}
      {Array.from({ length: spokes }).map((_, i) => {
        const a = (i / spokes) * Math.PI * 2;
        const x1 = Math.cos(a) * r;
        const y1 = Math.sin(a) * r;
        const x2 = Math.cos(a) * (r + 5);
        const y2 = Math.sin(a) * (r + 5);
        return (
          <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
        );
      })}
      {/* spokes */}
      {Array.from({ length: spokes / 2 }).map((_, i) => {
        const a = (i / (spokes / 2)) * Math.PI;
        return (
          <line
            key={i}
            x1={Math.cos(a) * (r - 1)}
            y1={Math.sin(a) * (r - 1)}
            x2={-Math.cos(a) * (r - 1)}
            y2={-Math.sin(a) * (r - 1)}
            stroke="currentColor"
            strokeWidth="0.7"
            opacity="0.85"
          />
        );
      })}
      {/* hub */}
      <circle r={4} fill={active ? 'var(--bp-ink)' : 'currentColor'} />
      <circle r={2} fill="var(--bp-paper)" />
    </g>
  );
}

/** Capstan — cylindrical winch with radial bars. */
function Capstan({ cx, cy, r }: { cx: number; cy: number; r: number }) {
  return (
    <g transform={`translate(${cx}, ${cy})`}>
      <circle r={r} fill="var(--bp-paper)" stroke="currentColor" strokeWidth="1.1" />
      <circle r={r - 4} fill="none" stroke="currentColor" strokeWidth="0.5" opacity="0.55" />
      {[0, 60, 120, 180, 240, 300].map((deg) => {
        const a = (deg * Math.PI) / 180;
        return (
          <line
            key={deg}
            x1={Math.cos(a) * r}
            y1={Math.sin(a) * r}
            x2={Math.cos(a) * (r + 6)}
            y2={Math.sin(a) * (r + 6)}
            stroke="currentColor"
            strokeWidth="0.9"
            strokeLinecap="round"
          />
        );
      })}
      <circle r={2} fill="currentColor" />
    </g>
  );
}

/** Mast cross-section + cross spar. */
function Mast({ cx, cy, r }: { cx: number; cy: number; r: number }) {
  return (
    <g>
      {/* spar (yard) */}
      <line x1={cx - r - 8} y1={cy} x2={cx + r + 8} y2={cy} stroke="currentColor" strokeWidth="0.7" opacity="0.5" />
      {/* mast circle */}
      <circle cx={cx} cy={cy} r={r} fill="var(--bp-paper)" stroke="currentColor" strokeWidth="1.2" />
      <circle cx={cx} cy={cy} r={r * 0.45} fill="currentColor" opacity="0.85" />
    </g>
  );
}

/** Anchor — top-down view (stock + arms). */
function Anchor({ cx, cy }: { cx: number; cy: number }) {
  return (
    <g transform={`translate(${cx}, ${cy})`}>
      {/* shaft */}
      <line x1={-12} y1={0} x2={14} y2={0} stroke="currentColor" strokeWidth="1.4" />
      {/* stock (cross-piece) */}
      <line x1={-10} y1={-7} x2={-10} y2={7} stroke="currentColor" strokeWidth="1.2" />
      {/* ring */}
      <circle cx={-13} cy={0} r={2.2} fill="none" stroke="currentColor" strokeWidth="0.9" />
      {/* arms with flukes */}
      <path d="M 14 0 Q 8 -8 4 -10" fill="none" stroke="currentColor" strokeWidth="1.1" />
      <path d="M 14 0 Q 8 8 4 10" fill="none" stroke="currentColor" strokeWidth="1.1" />
      <path d="M 4 -10 L 1 -7 L 6 -7 Z" fill="currentColor" />
      <path d="M 4 10 L 1 7 L 6 7 Z" fill="currentColor" />
    </g>
  );
}

/** Ship's bell on a small bracket. */
function ShipBell({ cx, cy }: { cx: number; cy: number }) {
  return (
    <g transform={`translate(${cx}, ${cy})`}>
      <path d="M -4 -3 L -4 2 Q 0 6 4 2 L 4 -3 Z" fill="var(--bp-paper)" stroke="currentColor" strokeWidth="0.85" />
      <line x1={0} y1={-3} x2={0} y2={-6} stroke="currentColor" strokeWidth="0.8" />
      <circle cx={0} cy={2} r={0.8} fill="currentColor" />
    </g>
  );
}

/** Compass binnacle (stand with compass on top). */
function Binnacle({ cx, cy }: { cx: number; cy: number }) {
  return (
    <g transform={`translate(${cx}, ${cy})`}>
      <rect x={-9} y={-7} width={18} height={14} fill="var(--bp-paper)" stroke="currentColor" strokeWidth="0.9" />
      <circle r={5} fill="none" stroke="currentColor" strokeWidth="0.6" />
      <line x1={0} y1={-5} x2={0} y2={5} stroke="currentColor" strokeWidth="0.5" />
      <line x1={-5} y1={0} x2={5} y2={0} stroke="currentColor" strokeWidth="0.5" />
      <path d="M 0 -4.5 L -1.2 -2 L 1.2 -2 Z" fill="currentColor" />
    </g>
  );
}

/** Chart table with chart contents (course curve, compass star, dotted route). */
function ChartTable() {
  return (
    <g>
      {/* table */}
      <rect x={344} y={246} width={184} height={88} fill="var(--bp-paper)" stroke="currentColor" strokeWidth="1" />
      {/* inner chart area */}
      <rect x={350} y={252} width={172} height={76} fill="none" stroke="currentColor" strokeWidth="0.4" opacity="0.4" />

      {/* coastline curve */}
      <path
        d="M 358 318 Q 392 308 418 314 Q 446 320 470 312 Q 494 304 514 308"
        fill="none"
        stroke="currentColor"
        strokeWidth="0.7"
        opacity="0.55"
      />
      {/* dotted course */}
      <path
        d="M 360 282 Q 410 270 460 280 Q 500 287 518 276"
        fill="none"
        stroke="currentColor"
        strokeWidth="0.55"
        strokeDasharray="3 3"
        opacity="0.7"
      />
      <circle cx={360} cy={282} r={1.6} fill="currentColor" />
      <circle cx={518} cy={276} r={1.6} fill="currentColor" />
      {/* destination 'X' */}
      <line x1={515} y1={273} x2={521} y2={279} stroke="currentColor" strokeWidth="0.8" />
      <line x1={521} y1={273} x2={515} y2={279} stroke="currentColor" strokeWidth="0.8" />

      {/* mini compass on chart */}
      <g transform="translate(490, 314)" opacity="0.7">
        <circle r={5} fill="none" stroke="currentColor" strokeWidth="0.4" />
        <circle r={2.5} fill="none" stroke="currentColor" strokeWidth="0.3" />
        {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => {
          const a = (deg * Math.PI) / 180;
          const len = deg % 90 === 0 ? 5 : 3.5;
          return (
            <line
              key={deg}
              x1={0}
              y1={0}
              x2={Math.cos(a) * len}
              y2={Math.sin(a) * len}
              stroke="currentColor"
              strokeWidth={deg % 90 === 0 ? 0.5 : 0.3}
            />
          );
        })}
        {/* fleur N */}
        <path d="M 0 -5 L -1.4 -2.5 L 0 -3 L 1.4 -2.5 Z" fill="currentColor" />
      </g>

      {/* latitude/longitude tick marks along edges */}
      <g opacity="0.45">
        {[366, 386, 406, 426, 446, 466, 486, 506].map((x) => (
          <line key={x} x1={x} y1={252} x2={x} y2={255} stroke="currentColor" strokeWidth="0.4" />
        ))}
        {[262, 280, 298, 316].map((y) => (
          <line key={y} x1={350} y1={y} x2={353} y2={y} stroke="currentColor" strokeWidth="0.4" />
        ))}
      </g>
    </g>
  );
}

/** Lantern (small) — used at chart table & bow. */
function Lantern({ cx, cy }: { cx: number; cy: number }) {
  return (
    <g transform={`translate(${cx}, ${cy})`}>
      <line x1={0} y1={-7} x2={0} y2={-3} stroke="currentColor" strokeWidth="0.7" />
      <rect x={-4} y={-3} width={8} height={9} fill="var(--bp-paper)" stroke="currentColor" strokeWidth="0.85" />
      <line x1={-4} y1={1} x2={4} y2={1} stroke="currentColor" strokeWidth="0.4" opacity="0.5" />
      <circle cx={0} cy={1.5} r={1.2} fill="currentColor" opacity="0.85" />
    </g>
  );
}

/** Workbench (small) — generic surface for an artisan. */
function Workbench({ x, y, w, h }: { x: number; y: number; w: number; h: number }) {
  return (
    <rect
      x={x}
      y={y}
      width={w}
      height={h}
      fill="var(--bp-paper)"
      stroke="currentColor"
      strokeWidth="0.7"
      opacity="0.85"
    />
  );
}

// Tool glyphs
function Anvil({ cx, cy }: { cx: number; cy: number }) {
  return (
    <path
      d={`M ${cx - 9} ${cy - 1} L ${cx + 9} ${cy - 1} L ${cx + 7} ${cy + 1} L ${cx + 4} ${cy + 1} L ${cx + 4} ${cy + 5} L ${cx - 4} ${cy + 5} L ${cx - 4} ${cy + 1} L ${cx - 7} ${cy + 1} Z`}
      fill="currentColor"
    />
  );
}

function Hammer({ cx, cy }: { cx: number; cy: number }) {
  return (
    <g>
      <line x1={cx - 8} y1={cy + 2} x2={cx + 4} y2={cy - 4} stroke="currentColor" strokeWidth="1" />
      <rect x={cx + 2} y={cy - 7} width={6} height={6} fill="currentColor" transform={`rotate(-30 ${cx + 5} ${cy - 4})`} />
    </g>
  );
}

function Ledger({ cx, cy }: { cx: number; cy: number }) {
  return (
    <g>
      <rect x={cx - 7} y={cy - 4} width={14} height={9} fill="var(--bp-paper)" stroke="currentColor" strokeWidth="0.7" />
      <line x1={cx} y1={cy - 4} x2={cx} y2={cy + 5} stroke="currentColor" strokeWidth="0.5" opacity="0.7" />
      {[-1, 1, 3].map((dy, i) => (
        <line key={i} x1={cx - 5} y1={cy + dy} x2={cx - 1} y2={cy + dy} stroke="currentColor" strokeWidth="0.3" />
      ))}
      {[-1, 1, 3].map((dy, i) => (
        <line key={i} x1={cx + 1} y1={cy + dy} x2={cx + 5} y2={cy + dy} stroke="currentColor" strokeWidth="0.3" />
      ))}
    </g>
  );
}

function Quill({ cx, cy }: { cx: number; cy: number }) {
  return (
    <g>
      <line x1={cx - 3} y1={cy + 4} x2={cx + 5} y2={cy - 4} stroke="currentColor" strokeWidth="0.85" />
      <path d={`M ${cx + 5} ${cy - 4} l 2 -2 l 1 1 l -2 2 z`} fill="currentColor" />
    </g>
  );
}

function Abacus({ cx, cy }: { cx: number; cy: number }) {
  return (
    <g>
      <rect x={cx - 7} y={cy - 4} width={14} height={9} fill="var(--bp-paper)" stroke="currentColor" strokeWidth="0.7" />
      <line x1={cx - 7} y1={cy - 1} x2={cx + 7} y2={cy - 1} stroke="currentColor" strokeWidth="0.4" />
      <line x1={cx - 7} y1={cy + 2} x2={cx + 7} y2={cy + 2} stroke="currentColor" strokeWidth="0.4" />
      {[-4, -1, 2, 5].map((dx) => (
        <circle key={dx} cx={cx + dx} cy={cy - 2.5} r={0.85} fill="currentColor" />
      ))}
      {[-4, 0, 4].map((dx) => (
        <circle key={dx} cx={cx + dx} cy={cy + 0.5} r={0.85} fill="currentColor" />
      ))}
      {[-2, 2].map((dx) => (
        <circle key={dx} cx={cx + dx} cy={cy + 3.5} r={0.85} fill="currentColor" />
      ))}
    </g>
  );
}

function Compass({ cx, cy }: { cx: number; cy: number }) {
  return (
    <g transform={`translate(${cx}, ${cy})`}>
      <line x1={-4} y1={4} x2={0} y2={-5} stroke="currentColor" strokeWidth="0.85" />
      <line x1={4} y1={4} x2={0} y2={-5} stroke="currentColor" strokeWidth="0.85" />
      <circle cx={0} cy={-5} r={1.2} fill="currentColor" />
      <circle cx={-4} cy={4} r={0.7} fill="currentColor" />
      <circle cx={4} cy={4} r={0.7} fill="currentColor" />
    </g>
  );
}

function MortarPestle({ cx, cy }: { cx: number; cy: number }) {
  return (
    <g>
      <path d={`M ${cx - 6} ${cy + 1} A 6 4 0 0 0 ${cx + 6} ${cy + 1} L ${cx + 5} ${cy + 5} L ${cx - 5} ${cy + 5} Z`} fill="var(--bp-paper)" stroke="currentColor" strokeWidth="0.75" />
      <line x1={cx + 1} y1={cy - 5} x2={cx + 4} y2={cy + 1} stroke="currentColor" strokeWidth="1" />
    </g>
  );
}

function BrushJar({ cx, cy }: { cx: number; cy: number }) {
  return (
    <g>
      <rect x={cx - 5} y={cy - 1} width={10} height={6} fill="var(--bp-paper)" stroke="currentColor" strokeWidth="0.7" />
      <line x1={cx - 4} y1={cy - 1} x2={cx - 6} y2={cy - 7} stroke="currentColor" strokeWidth="1" />
      <ellipse cx={cx - 6} cy={cy - 8} rx={1.6} ry={0.9} fill="currentColor" />
    </g>
  );
}

/** Mounted spyglass on a tripod (the Watch's signature object). */
function SpyglassTripod({ cx, cy }: { cx: number; cy: number }) {
  return (
    <g transform={`translate(${cx}, ${cy})`}>
      {/* tripod legs (three short lines splaying out) */}
      <line x1={-5} y1={3} x2={-9} y2={11} stroke="currentColor" strokeWidth="0.85" />
      <line x1={5} y1={3} x2={9} y2={11} stroke="currentColor" strokeWidth="0.85" />
      <line x1={0} y1={3} x2={0} y2={11} stroke="currentColor" strokeWidth="0.85" />
      {/* mount cap */}
      <ellipse cx={0} cy={0} rx={6} ry={2.5} fill="var(--bp-paper)" stroke="currentColor" strokeWidth="0.85" />
      {/* spyglass tube extending forward (right) */}
      <line x1={2} y1={0} x2={28} y2={-3} stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <line x1={2} y1={0} x2={28} y2={-3} stroke="var(--bp-paper)" strokeWidth="0.6" />
      {/* objective lens at end */}
      <circle cx={28} cy={-3} r={2.4} fill="var(--bp-ink)" />
      <circle cx={28} cy={-3} r={1.2} fill="var(--bp-paper)" />
      {/* eyepiece */}
      <rect x={-1} y={-1.5} width={3} height={3} fill="currentColor" />
    </g>
  );
}

/** Sextant (small triangular instrument). */
function Sextant({ cx, cy }: { cx: number; cy: number }) {
  return (
    <g transform={`translate(${cx}, ${cy})`}>
      <path d="M -7 4 L 7 4 L 0 -6 Z" fill="var(--bp-paper)" stroke="currentColor" strokeWidth="0.85" />
      <path d="M -5 3 A 6 6 0 0 1 5 3" fill="none" stroke="currentColor" strokeWidth="0.5" />
      <line x1={-5} y1={3} x2={5} y2={3} stroke="currentColor" strokeWidth="0.4" />
      <circle cx={0} cy={-3} r={1} fill="currentColor" />
    </g>
  );
}

/** Sounding line (rope hanging over the side with weight). */
function SoundingLine({ topX, topY, dropY }: { topX: number; topY: number; dropY: number }) {
  return (
    <g>
      <path
        d={`M ${topX} ${topY} Q ${topX + 3} ${(topY + dropY) / 2} ${topX + 6} ${dropY}`}
        fill="none"
        stroke="currentColor"
        strokeWidth="0.7"
      />
      {/* lead weight */}
      <ellipse cx={topX + 6} cy={dropY + 2} rx={2} ry={3} fill="currentColor" />
    </g>
  );
}

/** Coiled rope on deck. */
function CoiledRope({ cx, cy }: { cx: number; cy: number }) {
  return (
    <g transform={`translate(${cx}, ${cy})`}>
      <ellipse rx={7} ry={4} fill="none" stroke="currentColor" strokeWidth="0.85" />
      <ellipse rx={5} ry={2.7} fill="none" stroke="currentColor" strokeWidth="0.7" />
      <ellipse rx={3} ry={1.6} fill="none" stroke="currentColor" strokeWidth="0.6" />
      <circle r={0.8} fill="currentColor" opacity="0.7" />
    </g>
  );
}

// ────────────────────────────────────────────────────────────────────
// Main component
// ────────────────────────────────────────────────────────────────────

export function ShipCutaway({
  className,
  activeStation,
  onStationHover,
}: {
  className?: string;
  activeStation: DivisionId | null;
  onStationHover: (id: DivisionId | null) => void;
}) {
  const isActive = (id: DivisionId) => activeStation === id;

  const stationHandlers = (id: DivisionId) => ({
    onMouseEnter: () => onStationHover(id),
    onMouseLeave: () => onStationHover(null),
    onClick: (e: React.MouseEvent) => {
      e.stopPropagation();
      onStationHover(id);
    },
  });

  // Faint zone backdrop only on hover — soft focus without a permanent box.
  // A plain render helper (not a nested component) so it can close over
  // `isActive` without tripping react/no-unstable-nested-components.
  const zoneBackdrop = ({
    x,
    y,
    w,
    h,
    id,
  }: {
    x: number;
    y: number;
    w: number;
    h: number;
    id: DivisionId;
  }) => (
    <rect
      x={x}
      y={y}
      width={w}
      height={h}
      rx={6}
      fill="var(--bp-ink)"
      opacity={isActive(id) ? 0.05 : 0}
      style={{ transition: 'opacity 220ms ease', pointerEvents: 'none' }}
    />
  );

  const stationGroupStyle = (id: DivisionId) => ({
    opacity: activeStation && !isActive(id) ? 0.42 : 1,
    transition: 'opacity 220ms ease',
    cursor: 'pointer' as const,
  });

  return (
    <svg
      className={className}
      viewBox={`0 0 ${VB_W} ${VB_H}`}
      preserveAspectRatio="xMidYMid meet"
      style={{ color: 'var(--bp-ink)', width: '100%', height: '100%', display: 'block' }}
      role="img"
      aria-label="Top-down deck plan showing five crew stations along the ship"
    >
      <defs>
        {/* Cross-hatch for stern shadow / hatches */}
        <pattern id="hatch-stern" patternUnits="userSpaceOnUse" width="5" height="5" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="5" stroke="currentColor" strokeWidth="0.4" opacity="0.55" />
        </pattern>
        <pattern id="hatch-fine" patternUnits="userSpaceOnUse" width="3" height="3" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="3" stroke="currentColor" strokeWidth="0.3" opacity="0.4" />
        </pattern>
      </defs>

      {/* ── Plate frame (double-line border + corner ornaments) ── */}
      <g opacity="0.4">
        <rect x={8} y={8} width={VB_W - 16} height={VB_H - 16} fill="none" stroke="currentColor" strokeWidth="0.85" />
        <rect x={14} y={14} width={VB_W - 28} height={VB_H - 28} fill="none" stroke="currentColor" strokeWidth="0.4" />
        {/* corner ornaments — small fleur */}
        {([
          [22, 22],
          [VB_W - 22, 22],
          [22, VB_H - 22],
          [VB_W - 22, VB_H - 22],
        ] as const).map(([x, y], i) => (
          <g key={i} transform={`translate(${x}, ${y})`}>
            <circle r={2.2} fill="none" stroke="currentColor" strokeWidth="0.45" />
            <line x1={-5} y1={0} x2={5} y2={0} stroke="currentColor" strokeWidth="0.4" />
            <line x1={0} y1={-5} x2={0} y2={5} stroke="currentColor" strokeWidth="0.4" />
          </g>
        ))}
      </g>

      {/* ── Plate caption ── */}
      <line x1="60" y1="48" x2="240" y2="48" stroke="currentColor" strokeWidth="0.5" opacity="0.5" />
      <line x1="960" y1="48" x2="1140" y2="48" stroke="currentColor" strokeWidth="0.5" opacity="0.5" />
      <text
        x={VB_W / 2}
        y="52"
        textAnchor="middle"
        style={{
          font: '500 11px var(--font-mono), monospace',
          fill: 'var(--bp-ink-soft)',
          letterSpacing: '0.32em',
        }}
      >
        PLATE II — DECK PLAN
      </text>

      {/* ── Compass rose (top-left, indicates bow direction) ── */}
      <g transform="translate(76, 96)" opacity="0.62">
        <circle r={26} fill="none" stroke="currentColor" strokeWidth="0.55" />
        <circle r={20} fill="none" stroke="currentColor" strokeWidth="0.35" />
        <circle r={5} fill="none" stroke="currentColor" strokeWidth="0.4" />
        {/* 16 rays — cardinals long, ordinals medium, sub-points short */}
        {Array.from({ length: 16 }).map((_, i) => {
          const deg = i * 22.5;
          const a = (deg * Math.PI) / 180;
          const isCardinal = i % 4 === 0;
          const isOrdinal = !isCardinal && i % 2 === 0;
          const inner = 5;
          const outer = isCardinal ? 26 : isOrdinal ? 22 : 18;
          return (
            <line
              key={i}
              x1={Math.cos(a) * inner}
              y1={Math.sin(a) * inner}
              x2={Math.cos(a) * outer}
              y2={Math.sin(a) * outer}
              stroke="currentColor"
              strokeWidth={isCardinal ? 0.85 : 0.45}
            />
          );
        })}
        {/* fleur-de-lis pointing right (= bow direction) */}
        <path d="M 6 0 L 24 -2 L 22 0 L 24 2 Z" fill="currentColor" />
        <path d="M 22 -3 L 26 0 L 22 3 Z" fill="currentColor" />
        {/* "BOW →" tag */}
        <text
          x="34"
          y="3"
          style={{ font: '500 8.5px var(--font-mono), monospace', fill: 'var(--bp-ink-soft)', letterSpacing: '0.22em' }}
        >
          BOW
        </text>
      </g>

      {/* ── Scale bar (decorative, bottom-left) ── */}
      <g transform={`translate(74, ${VB_H - 56})`} opacity="0.55">
        <line x1="0" y1="0" x2="100" y2="0" stroke="currentColor" strokeWidth="0.7" />
        {[0, 25, 50, 75, 100].map((x) => (
          <line key={x} x1={x} y1={-3} x2={x} y2={3} stroke="currentColor" strokeWidth="0.55" />
        ))}
        {[12.5, 37.5, 62.5, 87.5].map((x) => (
          <line key={x} x1={x} y1={-1.5} x2={x} y2={1.5} stroke="currentColor" strokeWidth="0.4" />
        ))}
        <text
          x="50"
          y="-8"
          textAnchor="middle"
          style={{ font: '500 8px var(--font-mono), monospace', fill: 'var(--bp-ink-soft)', letterSpacing: '0.28em' }}
        >
          SCALE — fathoms
        </text>
      </g>

      {/* ── Hull (top-down silhouette) ── */}
      <path d={HULL_OUTER} fill="var(--bp-paper)" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      <path d={HULL_INNER} fill="none" stroke="currentColor" strokeWidth="0.7" opacity="0.55" />

      {/* ── Deck planks (subtle horizontal lines + caulking dots) ── */}
      <g opacity="0.22">
        {[206, 230, 254, 290, 326, 350, 374].map((y) => (
          <line
            key={y}
            x1={148}
            y1={y}
            x2={y === 290 ? 1118 : 1080}
            y2={y}
            stroke="currentColor"
            strokeWidth={y === 290 ? 0.55 : 0.4}
          />
        ))}
        {/* knot dots scattered on planks */}
        {[
          [310, 218],
          [620, 230],
          [840, 218],
          [430, 350],
          [720, 348],
          [950, 348],
          [560, 374],
        ].map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r={0.85} fill="currentColor" />
        ))}
      </g>

      {/* ── Stern transom (left edge): windows + scrollwork ── */}
      <g>
        {/* shadow strip behind transom */}
        <rect x={100} y={194} width={26} height={192} fill="url(#hatch-stern)" opacity="0.7" />
        {/* 3 vertical multi-pane windows */}
        {[210, 248, 286, 324].map((y) => (
          <g key={y}>
            <rect x={104} y={y} width={18} height={16} fill="var(--bp-paper)" stroke="currentColor" strokeWidth="0.7" />
            <line x1={113} y1={y} x2={113} y2={y + 16} stroke="currentColor" strokeWidth="0.4" opacity="0.7" />
            <line x1={104} y1={y + 8} x2={122} y2={y + 8} stroke="currentColor" strokeWidth="0.4" opacity="0.7" />
          </g>
        ))}
        {/* scroll bracket above & below */}
        <path d="M 102 194 Q 108 188 116 192 Q 122 188 128 194" fill="none" stroke="currentColor" strokeWidth="0.85" />
        <path d="M 102 386 Q 108 392 116 388 Q 122 392 128 386" fill="none" stroke="currentColor" strokeWidth="0.85" />
        {/* small ornament */}
        <circle cx={114} cy={190} r={1.4} fill="currentColor" opacity="0.7" />
        <circle cx={114} cy={390} r={1.4} fill="currentColor" opacity="0.7" />
      </g>

      {/* ── Bulwarks: gun ports along both sides ── */}
      <g opacity="0.7">
        {/* upper bulwark gun ports */}
        {[200, 280, 360, 440, 520, 600, 680, 760, 840, 920].map((x) => (
          <rect key={`u${x}`} x={x} y={170} width={14} height={6} fill="var(--bp-paper)" stroke="currentColor" strokeWidth="0.6" />
        ))}
        {/* lower bulwark gun ports */}
        {[200, 280, 360, 440, 520, 600, 680, 760, 840, 920].map((x) => (
          <rect key={`l${x}`} x={x} y={404} width={14} height={6} fill="var(--bp-paper)" stroke="currentColor" strokeWidth="0.6" />
        ))}
      </g>

      {/* ── Cargo hatches (squares with frame) ── */}
      <g>
        <rect x={650} y={272} width={40} height={36} fill="url(#hatch-fine)" stroke="currentColor" strokeWidth="0.85" />
        <rect x={650} y={272} width={40} height={36} fill="none" stroke="currentColor" strokeWidth="0.85" />
        <line x1={650} y1={290} x2={690} y2={290} stroke="currentColor" strokeWidth="0.5" />
        <line x1={670} y1={272} x2={670} y2={308} stroke="currentColor" strokeWidth="0.5" />
      </g>

      {/* ── Bowsprit + spritsail yard (extends past the bow point) ── */}
      <g>
        <line x1={1148} y1={290} x2={1184} y2={290} stroke="currentColor" strokeWidth="1.6" />
        <line x1={1170} y1={283} x2={1170} y2={297} stroke="currentColor" strokeWidth="0.85" />
        <line x1={1148} y1={286} x2={1148} y2={294} stroke="currentColor" strokeWidth="0.7" opacity="0.6" />
      </g>

      {/* ── Capstan (between mainmast and helm zone) ── */}
      <Capstan cx={CAPSTAN.cx} cy={CAPSTAN.cy} r={CAPSTAN.r} />

      {/* ── 3 masts ── */}
      <Mast cx={MIZZEN.cx} cy={MIZZEN.cy} r={MIZZEN.r} />
      <Mast cx={MAINMAST.cx} cy={MAINMAST.cy} r={MAINMAST.r} />
      <Mast cx={FOREMAST.cx} cy={FOREMAST.cy} r={FOREMAST.r} />

      {/* ── Anchor (stowed on the forward deck, near Scouts) ── */}
      <Anchor cx={1064} cy={376} />

      {/* ──────────────────────────────────────────────────────────── */}
      {/* STATION 01 · FIRST MATE — helm wheel as dominant object         */}
      {/* ──────────────────────────────────────────────────────────── */}
      <g
        data-station="navigator"
        {...stationHandlers('navigator')}
        style={stationGroupStyle('navigator')}
      >
        {zoneBackdrop({ x: 138, y: 186, w: 144, h: 208, id: 'navigator' })}

        {/* Ship's bell */}
        <ShipBell cx={156} cy={232} />

        {/* Helm wheel */}
        <HelmWheel cx={HELM.cx} cy={HELM.cy} r={HELM.r} active={isActive('navigator')} />

        {/* Compass binnacle (small pedestal forward of helm) */}
        <Binnacle cx={258} cy={290} />

        {/* First Mate figure (beside the wheel, slightly forward) */}
        <Figure cx={232} cy={252} active={isActive('navigator')} size={1.15} facing={-20} />
        {/* signaling arm reaching toward bow */}
        <line x1={240} y1={250} x2={258} y2={244} stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
        <circle cx={258} cy={244} r={1.6} fill="currentColor" />

        <StationLabel x={200} y={208} number="01" text="FIRST MATE" />
      </g>

      {/* ──────────────────────────────────────────────────────────── */}
      {/* STATION 02 · CARTOGRAPHERS — chart table as dominant object    */}
      {/* ──────────────────────────────────────────────────────────── */}
      <g
        data-station="cartographers"
        {...stationHandlers('cartographers')}
        style={stationGroupStyle('cartographers')}
      >
        {zoneBackdrop({ x: 326, y: 186, w: 216, h: 208, id: 'cartographers' })}

        {/* Lantern beside table (top corner) */}
        <Lantern cx={356} cy={228} />
        {/* Chart cylinders/scrolls (top-right corner) */}
        <g transform="translate(518, 226)">
          <rect x={-5} y={-7} width={10} height={14} fill="var(--bp-paper)" stroke="currentColor" strokeWidth="0.7" />
          <line x1={-5} y1={-3} x2={5} y2={-3} stroke="currentColor" strokeWidth="0.4" />
          <line x1={-5} y1={1} x2={5} y2={1} stroke="currentColor" strokeWidth="0.4" />
        </g>

        {/* Chart table itself with chart contents */}
        <ChartTable />

        {/* 3 cartographer figures around the table */}
        <Figure cx={384} cy={232} active={isActive('cartographers')} size={1} facing={90} />
        <Figure cx={488} cy={232} active={isActive('cartographers')} size={1} facing={90} />
        <Figure cx={436} cy={356} active={isActive('cartographers')} size={1} facing={-90} />
        {/* arms reaching toward chart */}
        <line x1={384} y1={241} x2={384} y2={250} stroke="currentColor" strokeWidth="0.85" />
        <line x1={488} y1={241} x2={488} y2={250} stroke="currentColor" strokeWidth="0.85" />
        <line x1={436} y1={347} x2={436} y2={336} stroke="currentColor" strokeWidth="0.85" />
        {/* dividers / quill held by middle figure (visible above table) */}
        <Quill cx={420} cy={252} />

        <StationLabel x={434} y={208} number="02" text="CARTOGRAPHERS" />
      </g>

      {/* ──────────────────────────────────────────────────────────── */}
      {/* STATION 03 · ARTISANS — workshop with diverse benches/tools    */}
      {/* ──────────────────────────────────────────────────────────── */}
      <g
        data-station="artisans"
        {...stationHandlers('artisans')}
        style={stationGroupStyle('artisans')}
      >
        {zoneBackdrop({ x: 606, y: 186, w: 252, h: 208, id: 'artisans' })}

        {/* Top row of workbenches */}
        <Workbench x={620} y={222} w={42} h={20} />
        <Anvil cx={641} cy={232} />
        <Figure cx={641} cy={208} active={isActive('artisans')} size={0.95} facing={90} />
        <Hammer cx={641} cy={250} />

        <Workbench x={680} y={222} w={42} h={20} />
        <Ledger cx={701} cy={232} />
        <Figure cx={701} cy={208} active={isActive('artisans')} size={0.95} facing={90} />

        <Workbench x={740} y={222} w={42} h={20} />
        <Quill cx={761} cy={234} />
        <BrushJar cx={770} cy={232} />
        <Figure cx={761} cy={208} active={isActive('artisans')} size={0.95} facing={90} />

        {/* Center coordinator (around mainmast) */}
        <Figure cx={620} cy={290} active={isActive('artisans')} size={1.05} facing={0} />
        <rect x={628} y={286} width={8} height={6} fill="var(--bp-paper)" stroke="currentColor" strokeWidth="0.5" />
        <line x1={629} y1={289} x2={635} y2={289} stroke="currentColor" strokeWidth="0.3" />

        {/* Bottom row of workbenches */}
        <Workbench x={620} y={344} w={42} h={20} />
        <Abacus cx={641} cy={354} />
        <Figure cx={641} cy={376} active={isActive('artisans')} size={0.95} facing={-90} />

        <Workbench x={680} y={344} w={42} h={20} />
        <Compass cx={701} cy={354} />
        <Figure cx={701} cy={376} active={isActive('artisans')} size={0.95} facing={-90} />

        <Workbench x={740} y={344} w={42} h={20} />
        <MortarPestle cx={761} cy={352} />
        <Figure cx={761} cy={376} active={isActive('artisans')} size={0.95} facing={-90} />

        <StationLabel x={732} y={208} number="03" text="ARTISANS" />
      </g>

      {/* ──────────────────────────────────────────────────────────── */}
      {/* STATION 04 · WATCH — mounted spyglass tripod (vertical spike)  */}
      {/* ──────────────────────────────────────────────────────────── */}
      <g
        data-station="watch"
        {...stationHandlers('watch')}
        style={stationGroupStyle('watch')}
      >
        {zoneBackdrop({ x: 886, y: 186, w: 102, h: 208, id: 'watch' })}

        {/* Crow's nest indicator — concentric dashed ring around foremast */}
        <circle
          cx={FOREMAST.cx}
          cy={FOREMAST.cy}
          r={20}
          fill="none"
          stroke="currentColor"
          strokeWidth="0.6"
          strokeDasharray="2.5 2.5"
          opacity="0.5"
        />

        {/* Mounted spyglass on tripod (the signature object) */}
        <SpyglassTripod cx={930} cy={244} />

        {/* Sextant on small stand */}
        <Sextant cx={932} cy={344} />

        {/* Watch figures */}
        <Figure cx={952} cy={258} active={isActive('watch')} size={1.05} facing={0} />
        {/* arm pointing forward */}
        <line x1={961} y1={257} x2={974} y2={252} stroke="currentColor" strokeWidth="1" strokeLinecap="round" />

        <Figure cx={902} cy={326} active={isActive('watch')} size={1} facing={0} />
        {/* handheld telescope to eye */}
        <line x1={910} y1={325} x2={924} y2={322} stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />

        <Figure cx={970} cy={332} active={isActive('watch')} size={1} facing={-90} />
        {/* small writing tablet */}
        <rect x={974} y={326} width={6} height={5} fill="var(--bp-paper)" stroke="currentColor" strokeWidth="0.5" />

        <StationLabel x={935} y={208} number="04" text="THE WATCH" />
      </g>

      {/* ──────────────────────────────────────────────────────────── */}
      {/* STATION 05 · SCOUTS — bow tip with figurehead + sounding line  */}
      {/* ──────────────────────────────────────────────────────────── */}
      <g
        data-station="scouts"
        {...stationHandlers('scouts')}
        style={stationGroupStyle('scouts')}
      >
        {zoneBackdrop({ x: 1006, y: 186, w: 140, h: 208, id: 'scouts' })}

        {/* Forward railing arc (curve following the bow) */}
        <path
          d="M 1018 198 Q 1112 244 1140 290 Q 1112 336 1018 382"
          fill="none"
          stroke="currentColor"
          strokeWidth="0.7"
          opacity="0.5"
        />

        {/* Bow lantern hung */}
        <Lantern cx={1108} cy={232} />

        {/* Coiled rope on deck */}
        <CoiledRope cx={1030} cy={332} />

        {/* Sounding line dropped over the side */}
        <SoundingLine topX={1098} topY={368} dropY={400} />

        {/* Forward-leaning Scout (pointing) */}
        <Figure cx={1080} cy={262} active={isActive('scouts')} size={1.05} facing={-15} />
        {/* arm reaching forward */}
        <line x1={1089} y1={261} x2={1108} y2={256} stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
        <path d="M 1108 256 L 1114 254 L 1112 258 Z" fill="currentColor" />

        {/* Sounding Scout */}
        <Figure cx={1078} cy={344} active={isActive('scouts')} size={1} facing={20} />
        <line x1={1086} y1={350} x2={1098} y2={368} stroke="currentColor" strokeWidth="0.7" />

        {/* Watching Scout */}
        <Figure cx={1042} cy={302} active={isActive('scouts')} size={1} facing={0} />
        <line x1={1051} y1={300} x2={1062} y2={296} stroke="currentColor" strokeWidth="0.85" />

        {/* Figurehead silhouette beneath bowsprit */}
        <path
          d="M 1142 286 Q 1156 282 1166 286 L 1166 294 Q 1156 298 1142 294 Z"
          fill="currentColor"
          opacity="0.3"
        />
        <circle cx={1158} cy={286} r={1.4} fill="currentColor" opacity="0.5" />

        <StationLabel x={1078} y={208} number="05" text="SCOUTS" />
      </g>

      {/* ── Information flow lines (faint serpentine connector) ── */}
      <g
        opacity={activeStation ? 0.55 : 0.18}
        style={{ transition: 'opacity 240ms ease', pointerEvents: 'none' }}
      >
        <path
          d="M 1080 290 Q 990 290 930 290 Q 800 290 720 290 Q 580 290 460 290 Q 350 290 240 290"
          fill="none"
          stroke="currentColor"
          strokeWidth="0.5"
          strokeDasharray="2 5"
        />
      </g>
    </svg>
  );
}
