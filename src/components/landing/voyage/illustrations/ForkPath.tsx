'use client';

/**
 * ForkPath — the SirenHero's single visual anchor.
 *
 * One ink trunk (your plan) enters from the left and splits into three
 * diverging routes at a single gold node: the literal picture of the
 * product — "어디서 갈리는지" (where it forks). The gold marks the divergence,
 * earning its 5%-rule moment: that fork is the judgment you left blank.
 *
 * Pure SVG in the 18th-c. blueprint register — hairlines (currentColor =
 * --bp-ink), token-colored, dark-mode safe. The strokes draw themselves in
 * on load via `bp-stroke-draw`; under prefers-reduced-motion they render
 * statically complete (no dashoffset set inline → defaults to 0).
 */

export function ForkPath({ className }: { className?: string }) {
  // Divergence node — where the single plan becomes three readings.
  const node = { x: 150, y: 60 };

  // Three routes fanning out from the node to the right edge. Smooth
  // quadratics so they read as charted courses, not a circuit diagram.
  const routes = [
    `M ${node.x} ${node.y} C 214 60, 256 22, 344 18`,
    `M ${node.x} ${node.y} C 224 60, 268 60, 344 60`,
    `M ${node.x} ${node.y} C 214 60, 256 98, 344 102`,
  ];
  const ends = [
    { x: 344, y: 18 },
    { x: 344, y: 60 },
    { x: 344, y: 102 },
  ];

  // dasharray long enough to hide any single path until it draws.
  const DRAW = 420;

  return (
    <svg
      viewBox="0 0 360 120"
      className={className}
      style={{ color: 'var(--bp-ink)', width: '100%', height: 'auto', display: 'block' }}
      role="img"
      aria-label="One plan, read separately, forking into divergent routes"
    >
      {/* Trunk — the plan, before it forks. */}
      <path
        d={`M 12 60 L ${node.x} ${node.y}`}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.4}
        strokeLinecap="round"
        opacity={0.85}
        className="bp-stroke-draw"
        style={{ strokeDasharray: DRAW, ['--draw-from' as string]: DRAW, animationDelay: '280ms' }}
      />

      {/* Three diverging routes. */}
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
            animationDelay: `${620 + i * 140}ms`,
          }}
        />
      ))}

      {/* Endpoint ticks — the divergent outcomes, drawn open (unsettled). */}
      {ends.map((p, i) => (
        <circle
          key={i}
          cx={p.x}
          cy={p.y}
          r={2.4}
          fill="var(--bp-paper)"
          stroke="currentColor"
          strokeWidth={0.9}
          opacity={0.55}
          className="bp-fade-up"
          style={{ animationDelay: `${980 + i * 120}ms` }}
        />
      ))}

      {/* The fork node — the only gold on this diagram. The judgment you
          left blank. */}
      <g className="bp-fade-up" style={{ animationDelay: '900ms' }}>
        <circle cx={node.x} cy={node.y} r={7} fill="none" stroke="var(--bp-gold)" strokeWidth={0.8} opacity={0.4} />
        <circle cx={node.x} cy={node.y} r={4} fill="var(--bp-gold)" />
      </g>
    </svg>
  );
}
