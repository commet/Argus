'use client';

/**
 * SeaChart — the decision voyage drawn as an antique nautical chart.
 *
 * The voyage's checkpoints/branches are positioned by the pure geometry in
 * lib/branch-map-layout, then RE-DRAWN as a charted sea route on aged parchment:
 * a graticule, ink stains and a scorched edge, a 16-point compass rose with
 * rhumb lines, the chosen course threading a WINDING multi-harmonic spline (with
 * an ink-bleed wobble), my ship at the current position, and the roads-not-taken
 * rendered as UNKNOWN routes — fading dashed courses that variously end at an
 * island, a phantom ship, or dissolve into uncharted fog. A few phantom sails
 * drift in the empty sea to hint at the wider unknown. Period typography via
 * `--font-chart` (Cormorant Garamond → Nanum Myeongjo).
 *
 * Self-contained parchment palette so it reads as a physical chart object in
 * both light and dark themes.
 *
 * `variant="compact"` — the rail hero (tight, fewer labels, no sea flourishes).
 * `variant="full"`    — the 전체 해도 modal (large, labelled, cartouche + legend).
 */

import { useId, useMemo, useState, useEffect, useRef } from 'react';
import { Plus, Minus, Maximize } from 'lucide-react';
import { layoutBranchMap } from '@/lib/branch-map-layout';
import { useLocale } from '@/hooks/useLocale';
import type { VoyageBranch, VoyageCheckpoint, Waypoint, WaypointType } from '@/stores/types';

const PAPER = {
  paper0: '#f6eedb',
  paper1: '#e9dcbe',
  paper2: '#d6c39a',
  ink: '#1f3148',
  inkSoft: '#41597a',
  sepia: '#947e4f',
  sepiaSoft: '#b7a578',
  gold: '#ad8327',
  goldSoft: '#d6ab4d',
  ghost: '#b6a47a',
  reef: '#9c4a26',
  land: '#dbc99d',
  landEdge: '#a18a57',
  fog: '#f3efe6',
} as const;

const CHART_FONT = "var(--font-chart, Georgia, serif)";

interface SeaChartProps {
  checkpoints: VoyageCheckpoint[];
  branches: VoyageBranch[];
  waypoints: Waypoint[];
  activeBranchId: string | null;
  activeCheckpointId: string | null;
  variant?: 'compact' | 'full';
  onPick?: (checkpointId: string) => void;
}

const WP_LABEL: Record<WaypointType, { ko: string; en: string }> = {
  departure:     { ko: '출항',     en: 'Departure' },
  course_change: { ko: '침로 변경', en: 'Course change' },
  reef:          { ko: '암초',     en: 'Reef' },
  sighting:      { ko: '관측',     en: 'Sighting' },
  headwind:      { ko: '역풍',     en: 'Headwind' },
  helm:          { ko: '선장의 키', en: 'Helm' },
  anchorage:     { ko: '정박',     en: 'Anchorage' },
};

type P = { x: number; y: number };

const hash = (s: string) => { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return h; };

/** Catmull-Rom spline through points → smooth cubic bezier (a flowing route). */
function spline(pts: P[]): string {
  if (pts.length === 0) return '';
  if (pts.length === 1) return `M ${pts[0].x} ${pts[0].y}`;
  let d = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] || p2;
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${c1x.toFixed(1)} ${c1y.toFixed(1)}, ${c2x.toFixed(1)} ${c2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
  }
  return d;
}

/** Deterministic wobbly landmass outline. */
function island(cx: number, cy: number, r: number, seed: number): string {
  const n = 9;
  let d = '';
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const rr = r * (0.7 + 0.3 * Math.abs(Math.sin(a * 1.7 + seed)));
    const x = cx + Math.cos(a) * rr;
    const y = cy + Math.sin(a) * rr * 0.8;
    d += i === 0 ? `M ${x.toFixed(1)} ${y.toFixed(1)}` : ` L ${x.toFixed(1)} ${y.toFixed(1)}`;
  }
  return d + ' Z';
}

/** A small caravel under sail. `s` ≈ half-length. */
function Ship({ cx, cy, s, color, phantom = false, angle = 0 }: { cx: number; cy: number; s: number; color: string; phantom?: boolean; angle?: number }) {
  const hull = `M ${-1.35 * s} 0 Q 0 ${0.55 * s} ${1.35 * s} 0 L ${0.95 * s} ${0.62 * s} Q 0 ${0.92 * s} ${-0.95 * s} ${0.62 * s} Z`;
  const mast = `M 0 ${0.05 * s} L 0 ${-1.95 * s}`;
  const sailR = `M ${0.1 * s} ${-1.85 * s} Q ${1.2 * s} ${-1.0 * s} ${0.5 * s} ${-0.15 * s} L ${0.1 * s} ${-0.15 * s} Z`;
  const sailL = `M ${-0.1 * s} ${-1.5 * s} Q ${-0.78 * s} ${-0.95 * s} ${-0.38 * s} ${-0.18 * s} L ${-0.1 * s} ${-0.18 * s} Z`;
  const pennant = `M 0 ${-1.95 * s} L ${0.7 * s} ${-1.78 * s} L 0 ${-1.6 * s} Z`;
  return (
    <g transform={`translate(${cx} ${cy}) rotate(${angle})`} opacity={phantom ? 0.45 : 0.96}>
      <path d={hull} fill={phantom ? 'none' : color} stroke={color} strokeWidth={phantom ? 0.5 : 0.4} strokeLinejoin="round" />
      <path d={mast} stroke={color} strokeWidth={0.55} fill="none" strokeLinecap="round" />
      <path d={sailR} fill={phantom ? 'none' : PAPER.paper0} stroke={color} strokeWidth={0.5} strokeLinejoin="round" />
      <path d={sailL} fill={phantom ? 'none' : PAPER.paper0} stroke={color} strokeWidth={0.45} strokeLinejoin="round" />
      <path d={pennant} fill={phantom ? 'none' : color} stroke={color} strokeWidth={0.4} />
    </g>
  );
}

/** 16-point compass rose. */
function CompassRose({ cx, cy, r }: { cx: number; cy: number; r: number }) {
  const pts: React.ReactNode[] = [];
  for (let i = 0; i < 16; i++) {
    const a = (i * Math.PI) / 8;
    const long = i % 4 === 0;
    const mid = i % 2 === 0;
    const len = long ? r : mid ? r * 0.66 : r * 0.42;
    const w = long ? r * 0.11 : r * 0.06;
    const tipX = cx + Math.sin(a) * len, tipY = cy - Math.cos(a) * len;
    const lX = cx + Math.cos(a) * w, lY = cy + Math.sin(a) * w;
    const rX = cx - Math.cos(a) * w, rY = cy - Math.sin(a) * w;
    pts.push(<path key={i} d={`M ${cx} ${cy} L ${lX} ${lY} L ${tipX} ${tipY} L ${rX} ${rY} Z`}
      fill={long ? PAPER.ink : i % 4 === 2 ? PAPER.sepia : 'none'} stroke={PAPER.sepia} strokeWidth={0.4}
      opacity={long ? 0.85 : mid ? 0.5 : 0.33} />);
  }
  return (
    <g>
      <circle cx={cx} cy={cy} r={r * 1.04} fill="none" stroke={PAPER.sepia} strokeWidth={0.5} opacity={0.5} />
      <circle cx={cx} cy={cy} r={r * 0.66} fill="none" stroke={PAPER.sepia} strokeWidth={0.4} opacity={0.4} />
      {pts}
      <circle cx={cx} cy={cy} r={r * 0.07} fill={PAPER.gold} />
      <text x={cx} y={cy - r * 1.12} textAnchor="middle" fontSize={r * 0.32} fill={PAPER.ink} fontWeight={600} fontFamily={CHART_FONT} style={{ letterSpacing: '0.04em' }}>N</text>
    </g>
  );
}

export function SeaChart({
  checkpoints, branches, waypoints, activeBranchId, activeCheckpointId, variant = 'compact', onPick,
}: SeaChartProps) {
  const locale = useLocale();
  const L = (ko: string, en: string) => (locale === 'ko' ? ko : en);
  const uid = useId().replace(/:/g, '');
  const full = variant === 'full';
  // The route inks itself in (SVG SMIL — self-contained, no CSS-build dependency)
  // only in the full chart, and never when the user prefers reduced motion.
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    const m = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduce(m.matches);
    const onChange = () => setReduce(m.matches);
    m.addEventListener('change', onChange);
    return () => m.removeEventListener('change', onChange);
  }, []);
  const animate = full && !reduce;

  // Zoom / pan — full chart only. Default view (k=1, no offset) letterbox-fits
  // the WHOLE voyage; the user zooms in to read labels and pans to explore.
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [view, setView] = useState({ k: 1, x: 0, y: 0 });
  const drag = useRef<{ px: number; py: number; ox: number; oy: number; moved: boolean } | null>(null);
  const suppressPick = useRef(false);

  const { nodes } = useMemo(() => layoutBranchMap(checkpoints, branches), [checkpoints, branches]);

  const layout = useMemo(() => {
    if (nodes.length === 0) return null;
    const rows = nodes.map(n => Math.round((n.y - 16) / 34));
    const maxRow = Math.max(0, ...rows);
    const rowGap = full ? 52 : 40;        // tighter rows → less sparse, fills the frame
    const amp = full ? 74 : 18;           // winding amplitude — a real sea route
    const forkSpread = full ? 120 : 34;   // how far roads-not-taken peel to the left
    // Course sits just LEFT of centre so the chosen route winds down the middle,
    // labels read to the RIGHT (wide margin), and the not-taken forks peel into
    // the open "unknown" sea on the LEFT.
    const sideL = full ? 120 : 24;
    const sideR = full ? 196 : 24;
    const padTop = full ? 50 : 28;
    const padBottom = full ? 46 : 26;
    // zero-phase wander → starts dead-centre, then swings RIGHT and back LEFT
    // (primary near one wave per ~6 turns) for a true serpentine sea route.
    const wander = (row: number) => amp * (0.7 * Math.sin(row * 0.95) + 0.3 * Math.sin(row * 2.2));
    const baseX = sideL + amp;            // trunk centre
    const W = baseX + amp + sideR;        // = centre is baseX
    const H = padTop + maxRow * rowGap + padBottom;
    const placed = nodes.map((n, i) => {
      const isActive = n.branchId === activeBranchId;
      const px = isActive
        ? baseX + wander(rows[i])
        : baseX - forkSpread * Math.max(1, n.lane) + wander(rows[i]) * 0.3;
      return { ...n, px, py: padTop + rows[i] * rowGap, row: rows[i], isActive };
    });
    const byId = new Map(placed.map(p => [p.id, p]));
    const activePath: typeof placed = [];
    let cursor = activeCheckpointId ? byId.get(activeCheckpointId) : undefined;
    const guard = new Set<string>();
    while (cursor && !guard.has(cursor.id)) { guard.add(cursor.id); activePath.unshift(cursor); cursor = cursor.parentId ? byId.get(cursor.parentId) : undefined; }
    return { placed, byId, W, H, baseX, activePath };
  }, [nodes, full, activeCheckpointId, activeBranchId]);

  const wpByCp = useMemo(() => { const m = new Map<string, Waypoint>(); for (const w of waypoints) m.set(w.checkpoint_id, w); return m; }, [waypoints]);
  const statusByBranch = useMemo(() => new Map(branches.map(b => [b.id, b.status])), [branches]);

  // Reset the view whenever the voyage's shape or the current position changes,
  // so a freshly opened / updated chart always starts fully framed.
  useEffect(() => { setView({ k: 1, x: 0, y: 0 }); }, [layout?.W, layout?.H, activeCheckpointId]);

  if (!layout) {
    return (
      <div className="relative w-full overflow-hidden rounded-[10px]" style={{ background: `radial-gradient(120% 90% at 30% 20%, ${PAPER.paper0}, ${PAPER.paper1} 70%, ${PAPER.paper2})`, aspectRatio: full ? '16 / 10' : '5 / 4' }}>
        <svg width="100%" height="100%" viewBox="0 0 200 160" preserveAspectRatio="xMidYMid slice" aria-hidden>
          <CompassRose cx={100} cy={80} r={34} />
        </svg>
      </div>
    );
  }

  const { placed, byId, W, H, activePath } = layout;

  // ── Zoom / pan plumbing (full only) ──
  const clientToSvg = (clientX: number, clientY: number) => {
    const svg = svgRef.current;
    const m = svg?.getScreenCTM();
    if (!svg || !m) return { x: W / 2, y: H / 2 };
    const pt = svg.createSVGPoint(); pt.x = clientX; pt.y = clientY;
    const o = pt.matrixTransform(m.inverse());
    return { x: o.x, y: o.y };           // viewBox coords (pre our <g> transform)
  };
  const zoomAt = (factor: number, ox: number, oy: number) => setView(v => {
    const k = Math.min(4, Math.max(0.55, v.k * factor));
    const cx = (ox - v.x) / v.k, cy = (oy - v.y) / v.k;
    return { k, x: ox - k * cx, y: oy - k * cy };
  });
  const onPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!full) return;
    (e.target as Element).setPointerCapture?.(e.pointerId);
    drag.current = { px: e.clientX, py: e.clientY, ox: view.x, oy: view.y, moved: false };
  };
  const onPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.px, dy = e.clientY - d.py;
    if (Math.abs(dx) + Math.abs(dy) > 3) d.moved = true;
    const s = svgRef.current?.getScreenCTM()?.a || 1;   // screen px per viewBox unit
    // Resolve the next offset HERE (event time) — the setView updater must not
    // read drag.current, which pointerup may have nulled before React applies it.
    const nx = d.ox + dx / s, ny = d.oy + dy / s;
    setView(v => ({ ...v, x: nx, y: ny }));
  };
  const onPointerUp = () => { if (drag.current?.moved) suppressPick.current = true; drag.current = null; };
  const onWheel = (e: React.WheelEvent<SVGSVGElement>) => {
    if (!full || !(e.ctrlKey || e.metaKey)) return;   // plain wheel scrolls the page
    e.preventDefault();
    const o = clientToSvg(e.clientX, e.clientY);
    zoomAt(e.deltaY < 0 ? 1.12 : 0.89, o.x, o.y);
  };
  const handlePick = onPick
    ? (id: string) => { if (suppressPick.current) { suppressPick.current = false; return; } onPick(id); }
    : undefined;

  const dim = (branchId: string | null) => (branchId && statusByBranch.get(branchId) === 'abandoned' ? 0.4 : 1);
  const roseR = full ? Math.min(58, W * 0.11) : 11;
  // compass tucks into the bottom-left open sea (the right side carries labels);
  // in the narrow rail it's a faint top-right corner watermark, clear of the route
  const roseCx = full ? roseR + 30 : W - roseR - 4;
  const roseCy = full ? H - roseR - 26 : roseR + 5;
  const activeCourse = spline(activePath.map(n => ({ x: n.px, y: n.py })));

  const stains = [
    { x: W * 0.18, y: H * 0.32, r: full ? 48 : 22 },
    { x: W * 0.82, y: H * 0.6, r: full ? 60 : 26 },
    { x: W * 0.4, y: H * 0.9, r: full ? 38 : 18 },
  ];

  // Roads-not-taken: each non-active branch head gets an UNKNOWN-route treatment.
  const ghostHeads = placed.filter(n => n.isHead && n.branchId && n.branchId !== activeBranchId);
  type Treat = 'island' | 'ship' | 'fog';
  const treatOf = (id: string): Treat => (['island', 'ship', 'fog'] as Treat[])[hash(id) % 3];

  // Phantom sails drifting in the open sea (full) — one in the far-right margin,
  // one in the unknown sea to the left, hinting at the wider unknown.
  const driftShips = full ? [
    { x: W * 0.91, y: H * 0.18, s: 6.5, a: -16 },
    { x: W * 0.12, y: H * 0.5, s: 5.5, a: 14 },
  ] : [];

  // Depth soundings scattered over open water (full) — a cartographer's detail,
  // kept clear of the centred course and its right-hand labels.
  const soundings = full ? [
    { x: W * 0.93, y: H * 0.36, n: 9 }, { x: W * 0.9, y: H * 0.52, n: 14 },
    { x: W * 0.95, y: H * 0.68, n: 6 }, { x: W * 0.1, y: H * 0.3, n: 23 },
    { x: W * 0.07, y: H * 0.7, n: 31 }, { x: W * 0.16, y: H * 0.86, n: 18 },
  ] : [];

  return (
    <div className={`relative w-full overflow-hidden rounded-[10px] shadow-[inset_0_0_46px_rgba(78,56,16,0.15)]${full ? ' h-full' : ''}`}>
      <svg ref={svgRef} width="100%" height={full ? '100%' : undefined}
        viewBox={`0 0 ${W} ${H}`} preserveAspectRatio={full ? 'xMidYMid meet' : 'xMinYMin meet'} role="img"
        aria-label={L('결정 항해 해도', 'Decision voyage chart')}
        onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp} onWheel={onWheel}
        style={{ display: 'block', touchAction: full ? 'none' : undefined, cursor: full ? (drag.current ? 'grabbing' : 'grab') : undefined }}>
        <defs>
          <radialGradient id={`paper-${uid}`} cx="32%" cy="16%" r="100%">
            <stop offset="0%" stopColor={PAPER.paper0} />
            <stop offset="58%" stopColor={PAPER.paper1} />
            <stop offset="100%" stopColor={PAPER.paper2} />
          </radialGradient>
          <radialGradient id={`stain-${uid}`} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgba(116,82,38,0.15)" />
            <stop offset="55%" stopColor="rgba(116,82,38,0.06)" />
            <stop offset="100%" stopColor="rgba(116,82,38,0)" />
          </radialGradient>
          <radialGradient id={`fog-${uid}`} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={PAPER.fog} stopOpacity="0.92" />
            <stop offset="60%" stopColor={PAPER.fog} stopOpacity="0.5" />
            <stop offset="100%" stopColor={PAPER.fog} stopOpacity="0" />
          </radialGradient>
          <linearGradient id={`fade-${uid}`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor={PAPER.ghost} stopOpacity="0.85" />
            <stop offset="100%" stopColor={PAPER.ghost} stopOpacity="0.05" />
          </linearGradient>
          {/* cool water wash — near-clear over the centre, deepening (cooler) toward
              the margins/bottom so the parchment reads as SEA, not just paper */}
          <radialGradient id={`cool-${uid}`} cx="46%" cy="36%" r="78%">
            <stop offset="0%" stopColor="#5f788f" stopOpacity="0" />
            <stop offset="62%" stopColor="#587089" stopOpacity="0.05" />
            <stop offset="100%" stopColor="#46627d" stopOpacity="0.17" />
          </radialGradient>
          <pattern id={`grat-${uid}`} width={full ? 48 : 27} height={full ? 48 : 27} patternUnits="userSpaceOnUse">
            <path d={`M ${full ? 48 : 27} 0 L 0 0 0 ${full ? 48 : 27}`} fill="none" stroke={PAPER.sepia} strokeWidth={0.4} />
          </pattern>
          <filter id={`grain-${uid}`}><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch" result="n" /><feColorMatrix in="n" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.5 0" /></filter>
          <filter id={`bleed-${uid}`} x="-6%" y="-6%" width="112%" height="112%"><feTurbulence type="fractalNoise" baseFrequency="0.016" numOctaves="2" seed="7" result="t" /><feDisplacementMap in="SourceGraphic" in2="t" scale={full ? 2.6 : 1.5} xChannelSelector="R" yChannelSelector="G" /></filter>
          <filter id={`scorch-${uid}`}><feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="3" seed="11" result="t" /><feDisplacementMap in="SourceGraphic" in2="t" scale={full ? 10 : 5} /></filter>
          <radialGradient id={`vig-${uid}`} cx="50%" cy="44%" r="76%"><stop offset="54%" stopColor="rgba(0,0,0,0)" /><stop offset="100%" stopColor="rgba(52,34,8,0.27)" /></radialGradient>
          <filter id={`glow-${uid}`} x="-120%" y="-120%" width="340%" height="340%"><feGaussianBlur stdDeviation={full ? 3 : 1.7} result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
        </defs>

        {/* Static backdrop so zooming OUT reveals a continuous paper tone, not the
            page behind the SVG. Stays put while the chart group transforms. */}
        <rect x="0" y="0" width={W} height={H} fill={PAPER.paper2} />

        <g transform={full ? `translate(${view.x} ${view.y}) scale(${view.k})` : undefined}>

        {/* Parchment + cool water wash + depth contours + stains + graticule + grain */}
        <rect x="0" y="0" width={W} height={H} fill={`url(#paper-${uid})`} />
        <rect x="0" y="0" width={W} height={H} fill={`url(#cool-${uid})`} />
        {/* faint isobaths in the deep water toward the bottom */}
        {full && [0, 1, 2, 3].map((i) => (
          <path key={`bath-${i}`} d={`M ${W * 0.04} ${H * (0.74 + i * 0.066)} Q ${W * 0.5} ${H * (0.66 + i * 0.066)} ${W * 0.96} ${H * (0.76 + i * 0.066)}`}
            fill="none" stroke="#54708a" strokeWidth={0.6} opacity={0.14} />
        ))}
        {stains.map((s, i) => <ellipse key={i} cx={s.x} cy={s.y} rx={s.r} ry={s.r * 0.78} fill={`url(#stain-${uid})`} />)}
        <rect x="0" y="0" width={W} height={H} fill={`url(#grat-${uid})`} opacity={full ? 0.17 : 0.13} />
        <rect x="0" y="0" width={W} height={H} filter={`url(#grain-${uid})`} opacity={full ? 0.06 : 0.05} />

        {/* Scorched, irregular edge */}
        <rect x={full ? 6 : 3} y={full ? 6 : 3} width={W - (full ? 12 : 6)} height={H - (full ? 12 : 6)} fill="none" stroke="rgba(68,42,12,0.34)" strokeWidth={full ? 9 : 5} filter={`url(#scorch-${uid})`} opacity={0.55} />

        {/* Neatline */}
        {full && (<><rect x="9" y="9" width={W - 18} height={H - 18} fill="none" stroke={PAPER.sepia} strokeWidth={1} opacity={0.55} /><rect x="13" y="13" width={W - 26} height={H - 26} fill="none" stroke={PAPER.sepia} strokeWidth={0.5} opacity={0.4} /></>)}

        {/* Rhumb lines from the compass */}
        {full && Array.from({ length: 16 }).map((_, i) => { const a = (i * Math.PI) / 8; return <line key={i} x1={roseCx} y1={roseCy} x2={roseCx + Math.sin(a) * (W + H)} y2={roseCy - Math.cos(a) * (W + H)} stroke={PAPER.sepia} strokeWidth={0.4} opacity={0.12} />; })}

        {/* ── Roads-not-taken: fading dashed courses into the unknown ── */}
        {placed.map((n) => {
          if (!n.parentId || n.branchId === activeBranchId) return null;
          const p = byId.get(n.parentId);
          if (!p) return null;
          const my = (p.py + n.py) / 2;
          return <path key={`g-${n.id}`} d={`M ${p.px} ${p.py} C ${p.px} ${my}, ${n.px} ${my}, ${n.px} ${n.py}`} fill="none"
            stroke={`url(#fade-${uid})`} strokeWidth={1.5} strokeLinecap="round" strokeDasharray="2 5" opacity={dim(n.branchId)} />;
        })}

        {/* Unknown-route endpoints: island / phantom ship / fog */}
        {ghostHeads.map((n, i) => {
          const t = treatOf(n.branchId!);
          // a faint tail continuing past the head toward the nearer side (into the unknown)
          const dir = n.px > W / 2 ? 1 : -1;
          const tail = `M ${n.px} ${n.py} q ${dir * (full ? 26 : 12)} ${full ? 14 : 7}, ${dir * (full ? 52 : 24)} ${full ? 8 : 4}`;
          return (
            <g key={`gt-${n.id}`} opacity={dim(n.branchId)}>
              <path d={tail} fill="none" stroke={PAPER.ghost} strokeWidth={1.1} strokeDasharray="1.5 5" opacity={0.5} />
              {t === 'fog' && (
                <>
                  <ellipse cx={n.px + dir * (full ? 60 : 28)} cy={n.py + (full ? 10 : 5)} rx={full ? 40 : 20} ry={full ? 26 : 13} fill={`url(#fog-${uid})`} />
                  {full && <text x={n.px + dir * 60} y={n.py + 12} textAnchor="middle" fontSize={8} fill={PAPER.sepia} fontFamily={CHART_FONT} fontStyle="italic" opacity={0.7} style={{ letterSpacing: '0.08em' }}>{L('미지의 바다', 'terra incognita')}</text>}
                </>
              )}
              {t === 'island' && (
                <g>
                  <path d={island(n.px, n.py, full ? 17 : 9, i + 1)} fill={PAPER.land} stroke={PAPER.landEdge} strokeWidth={0.6} />
                  <path d={island(n.px, n.py, (full ? 17 : 9) * 0.58, i + 4)} fill="none" stroke={PAPER.landEdge} strokeWidth={0.4} opacity={0.6} />
                </g>
              )}
              {t === 'ship' && <Ship cx={n.px + dir * (full ? 40 : 18)} cy={n.py + (full ? 6 : 3)} s={full ? 7 : 4.5} color={PAPER.sepia} phantom angle={dir * 8} />}
            </g>
          );
        })}

        {/* Roads not taken AT A FORK — the options you were offered but didn't
            pick, drawn as faint dashed stubs peeling into the open sea with a
            keyword (full). Tap (full) to fork from here and choose again. */}
        {placed.map((n) => {
          const wp = wpByCp.get(n.id);
          const notTaken = (wp?.alternatives || []).filter(a => !a.taken);
          if (notTaken.length === 0) return null;
          return (
            <g key={`alt-${n.id}`} className={onPick && full ? 'cursor-pointer' : undefined}
              onClick={handlePick && full ? () => handlePick(n.id) : undefined}>
              {notTaken.slice(0, full ? 3 : 2).map((alt, k) => {
                const ang = ((full ? 150 : 158) + k * 19) * Math.PI / 180;   // fan down-/up-left into open sea
                const len = full ? 40 : 14;
                const ex = n.px + Math.cos(ang) * len;
                const ey = n.py + Math.sin(ang) * len;
                const mx = n.px + Math.cos(ang) * len * 0.55 + (full ? 5 : 2);
                const my = n.py + Math.sin(ang) * len * 0.55;
                const kw = alt.label.length > 16 ? alt.label.slice(0, 15) + '…' : alt.label;
                return (
                  <g key={k} opacity={0.6}>
                    <path d={`M ${n.px} ${n.py} Q ${mx} ${my} ${ex} ${ey}`} fill="none"
                      stroke={PAPER.ghost} strokeWidth={full ? 1 : 0.8} strokeDasharray="2 3" strokeLinecap="round" />
                    <circle cx={ex} cy={ey} r={full ? 1.5 : 1} fill={PAPER.ghost} />
                    {full && (
                      <text x={ex - 4} y={ey + 3} textAnchor="end" fontSize={7.5} fill={PAPER.sepia}
                        fontFamily={CHART_FONT} fontStyle="italic" style={{ letterSpacing: '0.02em' }}>{kw}</text>
                    )}
                  </g>
                );
              })}
            </g>
          );
        })}

        {/* Depth soundings — faint italic numerals over the open sea */}
        {soundings.map((s, i) => (
          <text key={`snd-${i}`} x={s.x} y={s.y} fontSize={6.5} fill={PAPER.sepia} fontFamily={CHART_FONT} fontStyle="italic" opacity={0.42} textAnchor="middle">{s.n}</text>
        ))}

        {/* Drifting phantom sails in the open sea (full) */}
        {driftShips.map((d, i) => <Ship key={`drift-${i}`} cx={d.x} cy={d.y} s={d.s} color={PAPER.sepiaSoft} phantom angle={d.a} />)}

        {/* ── The inked main course — one winding spline + ink-bleed wobble ── */}
        {activePath.length > 1 && (
          <g filter={`url(#bleed-${uid})`}>
            <path d={activeCourse} pathLength={1} fill="none" stroke={PAPER.ink} strokeWidth={full ? 2.1 : 1.5} strokeLinecap="round" strokeLinejoin="round" opacity={0.9}
              strokeDasharray={animate ? 1 : undefined} strokeDashoffset={animate ? 1 : undefined}>
              {animate && <animate attributeName="stroke-dashoffset" from="1" to="0" dur="1.5s" begin="0.15s" fill="freeze" calcMode="spline" keyTimes="0;1" keySplines="0.45 0 0.2 1" />}
            </path>
            <path d={activeCourse} pathLength={1} fill="none" stroke={PAPER.paper0} strokeWidth={full ? 0.7 : 0.5} strokeLinecap="round" opacity={0.4}
              strokeDasharray={animate ? 1 : undefined} strokeDashoffset={animate ? 1 : undefined}>
              {animate && <animate attributeName="stroke-dashoffset" from="1" to="0" dur="1.5s" begin="0.15s" fill="freeze" calcMode="spline" keyTimes="0;1" keySplines="0.45 0 0.2 1" />}
            </path>
          </g>
        )}

        {/* Waypoint markers + labels */}
        {placed.map((n) => {
          const wp = wpByCp.get(n.id);
          const isActiveCp = n.id === activeCheckpointId;
          const isActiveBranch = n.branchId === activeBranchId;
          const anchored = n.isHead && n.branchId && statusByBranch.get(n.branchId) === 'anchored';
          const isReef = wp?.type === 'reef';
          const baseColor = isReef ? PAPER.reef : isActiveBranch ? PAPER.ink : PAPER.sepia;
          const r = full ? (wp ? 4 : 2.4) : (wp ? 3 : 1.9);

          return (
            <g key={`n-${n.id}`}>
             <g opacity={dim(n.branchId)} className={onPick ? 'cursor-pointer' : undefined} onClick={handlePick ? () => handlePick(n.id) : undefined}>
              {/* a whisper-thin halo only on waypoints, to lift them off the sea
                  without the old "target" heaviness */}
              {wp && !isActiveCp && <circle cx={n.px} cy={n.py} r={r + (full ? 2.4 : 1.8)} fill="none" stroke={baseColor} strokeWidth={0.4} opacity={0.18} />}

              {isActiveCp ? (
                // my ship — the chart's hero: a larger gold caravel with a soft
                // halo, a spreading wake, and a slow sonar pulse, so the eye
                // lands on "here, now".
                <>
                {!reduce && [0, 1.3].map((begin, i) => (
                  <circle key={`pulse-${i}`} cx={n.px} cy={n.py} r={full ? 9 : 4} fill="none"
                    stroke={PAPER.gold} strokeWidth={full ? 1.3 : 0.8} opacity={0}>
                    <animate attributeName="r" from={full ? 8 : 3.5} to={full ? 30 : 13} dur="2.6s"
                      begin={`${begin}s`} repeatCount="indefinite" calcMode="spline" keyTimes="0;1" keySplines="0.22 0.6 0.25 1" />
                    <animate attributeName="opacity" values="0.55;0" keyTimes="0;1" dur="2.6s"
                      begin={`${begin}s`} repeatCount="indefinite" />
                  </circle>
                ))}
                <g filter={`url(#glow-${uid})`}>
                  <circle cx={n.px} cy={n.py} r={full ? 18 : 7.5} fill={PAPER.goldSoft} opacity={0.15} />
                  <circle cx={n.px} cy={n.py} r={full ? 10 : 4.5} fill={PAPER.goldSoft} opacity={0.18} />
                  {full && (
                    <g stroke={PAPER.gold} fill="none" opacity={0.3}>
                      <path d={`M ${n.px - 13} ${n.py + 7} Q ${n.px} ${n.py + 13} ${n.px + 13} ${n.py + 7}`} strokeWidth={0.7} />
                      <path d={`M ${n.px - 19} ${n.py + 10} Q ${n.px} ${n.py + 19} ${n.px + 19} ${n.py + 10}`} strokeWidth={0.5} opacity={0.6} />
                    </g>
                  )}
                  <Ship cx={n.px} cy={n.py + (full ? 2 : 1)} s={full ? 11 : 5} color={PAPER.gold} />
                </g>
                </>
              ) : wp?.type === 'departure' ? (
                <g stroke={baseColor} strokeWidth={full ? 1.4 : 1.1} strokeLinecap="round" fill="none">
                  <circle cx={n.px} cy={n.py - r} r={full ? 1.5 : 1.2} fill={baseColor} stroke="none" />
                  <line x1={n.px} y1={n.py - r} x2={n.px} y2={n.py + r} />
                  <line x1={n.px - r * 0.8} y1={n.py - r * 0.1} x2={n.px + r * 0.8} y2={n.py - r * 0.1} />
                  <path d={`M ${n.px - r} ${n.py + r * 0.4} Q ${n.px} ${n.py + r * 1.4}, ${n.px + r} ${n.py + r * 0.4}`} />
                </g>
              ) : wp ? (
                // a charted survey mark — a fine ring with a small solid core,
                // not a fat ink blob (reads precise, like a station on a chart)
                <g>
                  <circle cx={n.px} cy={n.py} r={r} fill={PAPER.paper0} stroke={baseColor} strokeWidth={isActiveBranch ? 1 : 0.85} />
                  <circle cx={n.px} cy={n.py} r={Math.max(1, r * 0.42)} fill={baseColor} />
                </g>
              ) : (
                // a plain logged checkpoint — a small hollow dot
                <circle cx={n.px} cy={n.py} r={r} fill={PAPER.paper0} stroke={baseColor} strokeWidth={0.8} opacity={0.85} />
              )}

              {anchored && !isActiveCp && (
                <g stroke={PAPER.gold} strokeWidth={1.1} fill="none">
                  <line x1={n.px + r + 2} y1={n.py - r - 5} x2={n.px + r + 2} y2={n.py + 2} />
                  <path d={`M ${n.px + r + 2} ${n.py - r - 5} L ${n.px + r + 8} ${n.py - r - 2.5} L ${n.px + r + 2} ${n.py - r} Z`} fill={PAPER.gold} />
                </g>
              )}

              {full && wp && (() => {
                const lx = n.px + (isActiveCp ? (full ? 19 : 12) : r + 11);
                const text = wp.headline.length > 28 ? wp.headline.slice(0, 27) + '…' : wp.headline;
                return (
                  <g>
                    <line x1={n.px + r + 2} y1={n.py} x2={lx - 2} y2={n.py} stroke={baseColor} strokeWidth={0.4} opacity={0.4} />
                    <text x={lx} y={n.py - 3} fontSize={6.5} fill={isReef ? PAPER.reef : PAPER.sepia} fontWeight={600} fontFamily={CHART_FONT} style={{ letterSpacing: '0.2em', textTransform: 'uppercase' }}>
                      {L(WP_LABEL[wp.type].ko, WP_LABEL[wp.type].en)}
                    </text>
                    <text x={lx} y={n.py + 9} fontSize={12.5} fill={PAPER.ink} fontFamily={CHART_FONT} fontStyle="italic" fontWeight={500}>{text}</text>
                  </g>
                );
              })()}

              {onPick && <circle cx={n.px} cy={n.py} r={full ? 16 : 11} fill="transparent" />}
             </g>
            </g>
          );
        })}

        {/* Compass rose — bottom-left in the full chart; a faint corner watermark in compact */}
        <g opacity={full ? 1 : 0.3}><CompassRose cx={roseCx} cy={roseCy} r={roseR} /></g>

        <rect x="0" y="0" width={W} height={H} fill={`url(#vig-${uid})`} pointerEvents="none" />
        </g>
      </svg>

      {/* Zoom controls — full chart only. Default view fits the whole voyage;
          these let the user push in to read labels and pull back out. */}
      {full && (
        <div className="absolute right-2 top-2 flex flex-col rounded-lg overflow-hidden border border-[rgba(120,90,30,0.3)] bg-[rgba(246,238,219,0.85)] backdrop-blur-sm shadow-sm">
          <button type="button" onClick={() => zoomAt(1.3, W / 2, H / 2)} title={L('확대', 'Zoom in')} aria-label={L('확대', 'Zoom in')}
            className="w-7 h-7 flex items-center justify-center text-[#3a2c12] hover:bg-[rgba(173,131,39,0.18)] transition-colors cursor-pointer">
            <Plus size={14} />
          </button>
          <button type="button" onClick={() => zoomAt(0.77, W / 2, H / 2)} title={L('축소', 'Zoom out')} aria-label={L('축소', 'Zoom out')}
            className="w-7 h-7 flex items-center justify-center text-[#3a2c12] hover:bg-[rgba(173,131,39,0.18)] transition-colors cursor-pointer border-t border-[rgba(120,90,30,0.25)]">
            <Minus size={14} />
          </button>
          <button type="button" onClick={() => setView({ k: 1, x: 0, y: 0 })} title={L('전체 보기', 'Fit chart')} aria-label={L('전체 보기', 'Fit chart')}
            className="w-7 h-7 flex items-center justify-center text-[#3a2c12] hover:bg-[rgba(173,131,39,0.18)] transition-colors cursor-pointer border-t border-[rgba(120,90,30,0.25)]">
            <Maximize size={12} />
          </button>
        </div>
      )}
    </div>
  );
}
