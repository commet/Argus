'use client';

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
