/**
 * PaperGrain — fine deterministic dot stipple, ~3% opacity.
 *
 * Pure SVG pattern (no raster, no filter), tiles via patternUnits.
 * Position: caller chooses. Default is `absolute inset-0` so it sits
 * inside a section without bleeding into others.
 */

import { useId } from 'react';

export function PaperGrain({
  className = 'absolute inset-0 w-full h-full pointer-events-none',
  opacity = 0.045,
  density = 'fine',
}: {
  className?: string;
  opacity?: number;
  density?: 'fine' | 'coarse';
}) {
  const step = density === 'fine' ? 4 : 7;
  const r = density === 'fine' ? 0.45 : 0.75;
  // useId() — every instance gets a unique pattern id. With a static id, the 5
  // sections that each render a PaperGrain produced duplicate DOM ids, so every
  // `url(#…)` resolved to the first match (invalid HTML + wrong-fill risk).
  const id = `paper-grain${useId()}`;
  return (
    <svg className={className} aria-hidden="true" style={{ opacity }}>
      <defs>
        <pattern id={id} width={step} height={step} patternUnits="userSpaceOnUse">
          <circle cx={step / 2} cy={step / 2} r={r} fill="var(--bp-ink)" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id})`} />
    </svg>
  );
}
