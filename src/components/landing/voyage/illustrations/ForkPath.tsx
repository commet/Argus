'use client';

/**
 * ForkPath — the SirenHero's single visual anchor (redrawn for impact).
 *
 * The picture of the whole product in one chart: your plan (a bold ink trunk)
 * enters from the left, and at one gold node it is read separately by many
 * eyes and the course forks (알아봄 — the judgment you left blank). From the
 * date you set on the settled route, a dashed arc curves back to you
 * (귀환 — "정한 날짜에 돌아와 묻습니다").
 *
 * Three chart annotations make it legible at a glance — 당신의 계획 → 읽는
 * 눈마다 갈리는 곳 → 정한 날짜에 귀환 — in the same mono marginalia register
 * the rest of the logbook uses. Gold is still spent exactly once (the fork
 * node, the value moment = recognition); everything else is navy-ink hairline,
 * token-colored and dark-mode safe. Strokes draw themselves in on load via
 * `bp-stroke-draw`; under prefers-reduced-motion they render statically.
 */

import { useId } from 'react';

export function ForkPath({ className, label }: { className?: string; label?: string }) {
  // Per-instance marker id — safe if ForkPath is ever mounted twice on a page.
  const arrowId = `forkpath-return-${useId().replace(/:/g, '')}`;
  // Divergence node — where the single plan becomes many readings.
  const node = { x: 150, y: 74 };

  // Three routes fanning out from the node — charted courses, not a circuit.
  const routes = [
    `M ${node.x} ${node.y} C 214 74, 250 40, 334 32`,
    `M ${node.x} ${node.y} C 224 74, 276 74, 346 74`,
    `M ${node.x} ${node.y} C 214 74, 250 108, 334 116`,
  ];
  const ends = [
    { x: 334, y: 32 },
    { x: 346, y: 74 },
    { x: 334, y: 116 },
  ];

  const DRAW = 540; // dasharray long enough to hide any path until it draws

  return (
    <svg
      viewBox="0 0 400 158"
      className={className}
      style={{ color: 'var(--bp-ink)', width: '100%', height: 'auto', display: 'block' }}
      role="img"
      aria-label={
        label ??
        'One plan, read separately by many eyes, forking into divergent routes — then a return on your date'
      }
    >
      <defs>
        <marker id={arrowId} viewBox="0 0 8 8" refX="5.5" refY="4" markerWidth="7.5" markerHeight="7.5" orient="auto">
          <path d="M1 1 L7 4 L1 7 Z" fill="currentColor" opacity="0.78" />
        </marker>
      </defs>

      {/* Chart annotations — the logbook's mono marginalia, so the diagram
          reads at a glance without a caption underneath. */}
      <text x="14" y="60" className="bp-mono" fill="var(--bp-ink-soft)" style={{ fontSize: 10.5, letterSpacing: '0.03em', opacity: 0.72 }}>
        당신의 계획
      </text>
      <text x="208" y="15" textAnchor="middle" className="bp-mono" fill="var(--bp-ink-soft)" style={{ fontSize: 10.5, letterSpacing: '0.03em', opacity: 0.74 }}>
        읽는 눈마다 갈리는 곳
      </text>
      <text x="188" y="152" textAnchor="middle" className="bp-mono" fill="var(--bp-ink-soft)" style={{ fontSize: 10.5, letterSpacing: '0.03em', opacity: 0.74 }}>
        정한 날짜에 귀환
      </text>

      {/* Start point + trunk — the plan, before it forks. */}
      <circle cx="20" cy={node.y} r="2.8" fill="currentColor" opacity={0.85} />
      <path
        d={`M 20 ${node.y} L ${node.x} ${node.y}`}
        fill="none"
        stroke="currentColor"
        strokeWidth={2.4}
        strokeLinecap="round"
        opacity={0.9}
        className="bp-stroke-draw"
        style={{ strokeDasharray: DRAW, ['--draw-from' as string]: DRAW, animationDelay: '240ms' }}
      />

      {/* Three diverging routes — the separate readings. */}
      {routes.map((d, i) => (
        <path
          key={i}
          d={d}
          fill="none"
          stroke="currentColor"
          strokeWidth={i === 1 ? 1.7 : 1.4}
          strokeLinecap="round"
          opacity={i === 1 ? 0.72 : 0.5}
          className="bp-stroke-draw"
          style={{ strokeDasharray: DRAW, ['--draw-from' as string]: DRAW, animationDelay: `${600 + i * 130}ms` }}
        />
      ))}

      {/* Open endpoints — outcomes left unsettled. */}
      {ends.map((p, i) => (
        <circle
          key={i}
          cx={p.x}
          cy={p.y}
          r={3}
          fill="var(--bp-paper)"
          stroke="currentColor"
          strokeWidth={1.1}
          opacity={0.55}
          className="bp-fade-up"
          style={{ animationDelay: `${980 + i * 100}ms` }}
        />
      ))}

      {/* The return: a dashed arc from the set-date waypoint on the settled
          route, curving back to you — promised (dashed), not yet walked. */}
      <g className="bp-fade-up" style={{ animationDelay: '1220ms' }}>
        <circle cx={300} cy={node.y} r={4} fill="var(--bp-paper)" stroke="currentColor" strokeWidth={1.2} opacity={0.8} />
        <circle cx={300} cy={node.y} r={1.3} fill="currentColor" opacity={0.8} />
        <path
          d={`M 300 ${node.y + 8} C 286 140, 116 144, 64 ${node.y + 18}`}
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          strokeDasharray="4 3"
          opacity={0.62}
          markerEnd={`url(#${arrowId})`}
        />
      </g>

      {/* The fork node — the ONLY gold on this screen. The judgment you left
          blank: not the click, the recognition. */}
      <g className="bp-fade-up" style={{ animationDelay: '900ms' }}>
        <circle cx={node.x} cy={node.y} r={10} fill="none" stroke="var(--bp-gold)" strokeWidth={1} opacity={0.4} />
        <circle cx={node.x} cy={node.y} r={5} fill="var(--bp-gold)" />
      </g>
    </svg>
  );
}
