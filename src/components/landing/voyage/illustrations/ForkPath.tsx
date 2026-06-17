'use client';

/**
 * ForkPath — the SirenHero's single visual anchor.
 *
 * One ink trunk (your plan) enters from the left and splits into three
 * diverging routes at a single gold node: the picture of "어디서 갈리는지"
 * (where it forks). From the route the reading settles on, a dashed arc
 * curves back to you — the return-on-your-date comeback, Argus's most
 * ownable mechanic, drawn in chart language instead of only stated in copy.
 *
 * Gold is spent exactly once on this whole screen: the divergence node.
 * That is the value moment (recognition — the judgment you left blank), not
 * the click. Everything else is navy ink hairline, 18th-c. blueprint register,
 * token-colored and dark-mode safe. Strokes draw themselves in on load via
 * `bp-stroke-draw`; under prefers-reduced-motion they render statically
 * complete (no inline dashoffset → defaults to 0).
 */

import { useId } from 'react';

export function ForkPath({ className, label }: { className?: string; label?: string }) {
  // Per-instance marker id — safe if ForkPath is ever mounted twice on a page
  // (duplicate SVG ids would make every url(#…) resolve to the first one).
  const arrowId = `forkpath-return-${useId().replace(/:/g, '')}`;
  // Divergence node — where the single plan becomes three readings.
  const node = { x: 148, y: 58 };

  // Three routes fanning out from the node. Smooth quadratics so they read
  // as charted courses, not a circuit diagram.
  const routes = [
    `M ${node.x} ${node.y} C 212 58, 254 22, 330 18`,
    `M ${node.x} ${node.y} C 220 58, 262 58, 322 58`,
    `M ${node.x} ${node.y} C 212 58, 254 94, 330 98`,
  ];
  const ends = [
    { x: 330, y: 18 },
    { x: 330, y: 98 },
  ];

  // dasharray long enough to hide any single path until it draws.
  const DRAW = 420;

  return (
    <svg
      viewBox="0 0 360 134"
      className={className}
      style={{ color: 'var(--bp-ink)', width: '100%', height: 'auto', display: 'block' }}
      role="img"
      aria-label={label ?? 'One plan, read separately, forking into divergent routes — then a return on your date'}
    >
      <defs>
        <marker
          id={arrowId}
          viewBox="0 0 8 8"
          refX="5.5"
          refY="4"
          markerWidth="7"
          markerHeight="7"
          orient="auto"
        >
          <path d="M1 1 L7 4 L1 7 Z" fill="currentColor" opacity="0.7" />
        </marker>
      </defs>

      {/* Trunk — the plan, before it forks. */}
      <path
        d={`M 12 ${node.y} L ${node.x} ${node.y}`}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.4}
        strokeLinecap="round"
        opacity={0.85}
        className="bp-stroke-draw"
        style={{ strokeDasharray: DRAW, ['--draw-from' as string]: DRAW, animationDelay: '260ms' }}
      />

      {/* Three diverging routes — the separate readings. */}
      {routes.map((d, i) => (
        <path
          key={i}
          d={d}
          fill="none"
          stroke="currentColor"
          strokeWidth={i === 1 ? 1.1 : 0.9}
          strokeLinecap="round"
          opacity={i === 1 ? 0.7 : 0.5}
          className="bp-stroke-draw"
          style={{
            strokeDasharray: DRAW,
            ['--draw-from' as string]: DRAW,
            animationDelay: `${580 + i * 130}ms`,
          }}
        />
      ))}

      {/* Open endpoints (up / down) — outcomes left unsettled. */}
      {ends.map((p, i) => (
        <circle
          key={i}
          cx={p.x}
          cy={p.y}
          r={2.4}
          fill="var(--bp-paper)"
          stroke="currentColor"
          strokeWidth={0.9}
          opacity={0.5}
          className="bp-fade-up"
          style={{ animationDelay: `${940 + i * 110}ms` }}
        />
      ))}

      {/* The return: a dashed arc curving back to you from the settled route —
          "정한 날짜에 돌아와 묻습니다". Promised (dashed), not yet walked. */}
      <g className="bp-fade-up" style={{ animationDelay: '1180ms' }}>
        {/* Waypoint the return departs from — the date you set. */}
        <circle cx={322} cy={58} r={3.4} fill="var(--bp-paper)" stroke="currentColor" strokeWidth={1} opacity={0.7} />
        <circle cx={322} cy={58} r={1} fill="currentColor" opacity={0.7} />
        <path
          d="M 322 64 C 308 116, 210 122, 170 70"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.1}
          strokeDasharray="3 3"
          opacity={0.58}
          markerEnd={`url(#${arrowId})`}
        />
      </g>

      {/* The fork node — the ONLY gold on this screen. The judgment you left
          blank: not the click, the recognition. */}
      <g className="bp-fade-up" style={{ animationDelay: '880ms' }}>
        <circle cx={node.x} cy={node.y} r={7} fill="none" stroke="var(--bp-gold)" strokeWidth={0.8} opacity={0.4} />
        <circle cx={node.x} cy={node.y} r={4} fill="var(--bp-gold)" />
      </g>
    </svg>
  );
}
