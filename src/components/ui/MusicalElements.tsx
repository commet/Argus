'use client';

/**
 * Musical visual elements for the Argus design system.
 * These translate orchestral score language into UI components.
 */

/* ────────────────────────────────────
   Fermata — "여기서 멈추고 생각하세요"
   The arc-and-dot hold symbol.
   ──────────────────────────────────── */

export function Fermata({
  size = 20,
  color = 'currentColor',
  className = '',
}: {
  size?: number;
  color?: string;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <path
        d="M 3 20 A 11 11 0 0 1 21 20"
        stroke={color}
        strokeWidth="1.8"
        strokeLinecap="round"
        fill="none"
      />
      <circle cx="12" cy="15" r="2" fill={color} />
    </svg>
  );
}

/* ────────────────────────────────────
   Crescendo Hairpin — 점점 세게
   The opening wedge < shape.
   ──────────────────────────────────── */

export function CrescendoHairpin({
  width = 80,
  height = 16,
  color = 'var(--text-tertiary)',
  className = '',
}: {
  width?: number;
  height?: number;
  color?: string;
  className?: string;
}) {
  const mid = height / 2;
  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <path
        d={`M 2 ${mid} L ${width - 2} 2 M 2 ${mid} L ${width - 2} ${height - 2}`}
        stroke={color}
        strokeWidth="1.2"
        strokeLinecap="round"
      />
    </svg>
  );
}

/* ────────────────────────────────────
   BarLine — 마디선 (section dividers)
   single: |   double: ||   final: |▌
   ──────────────────────────────────── */

export function BarLine({
  type = 'single',
  height = 28,
  className = '',
}: {
  type?: 'single' | 'double' | 'final';
  height?: number;
  className?: string;
}) {
  const color = 'var(--border)';
  const boldColor = 'var(--text-tertiary)';

  if (type === 'double') {
    return (
      <div className={`flex items-center justify-center gap-[3px] ${className}`} role="separator" aria-hidden="true">
        <div style={{ width: 1, height, background: color }} />
        <div style={{ width: 1, height, background: color }} />
      </div>
    );
  }

  if (type === 'final') {
    return (
      <div className={`flex items-center justify-center gap-[3px] ${className}`} role="separator" aria-hidden="true">
        <div style={{ width: 1, height, background: color }} />
        <div style={{ width: 3, height, background: boldColor, borderRadius: 1 }} />
      </div>
    );
  }

  return (
    <div className={`flex items-center justify-center ${className}`} role="separator" aria-hidden="true">
      <div style={{ width: 1, height, background: color }} />
    </div>
  );
}

/* ────────────────────────────────────
   StaffLines — 오선지 배경 패턴
   Renders as an absolutely-positioned
   background layer inside its parent.
   ──────────────────────────────────── */

export function StaffLines({
  opacity = 0.07,
  spacing = 10,
  className = '',
}: {
  opacity?: number;
  spacing?: number;
  className?: string;
}) {
  const staffHeight = spacing * 6; // 5 lines + gap
  const lineColor = `rgba(181, 166, 140, ${opacity})`;

  const svgPattern = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="${staffHeight}"><line x1="0" y1="${spacing}" x2="200" y2="${spacing}" stroke="${lineColor}" stroke-width="0.8"/><line x1="0" y1="${spacing * 2}" x2="200" y2="${spacing * 2}" stroke="${lineColor}" stroke-width="0.8"/><line x1="0" y1="${spacing * 3}" x2="200" y2="${spacing * 3}" stroke="${lineColor}" stroke-width="0.8"/><line x1="0" y1="${spacing * 4}" x2="200" y2="${spacing * 4}" stroke="${lineColor}" stroke-width="0.8"/><line x1="0" y1="${spacing * 5}" x2="200" y2="${spacing * 5}" stroke="${lineColor}" stroke-width="0.8"/></svg>`;

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
   DynamicMark — pp, p, mp, mf, f, ff
   Musical intensity indicators.
   Rendered in italic serif style like
   handwritten markings on a score.
   ──────────────────────────────────── */

export function DynamicMark({
  level,
  className = '',
}: {
  level: 'pp' | 'p' | 'mp' | 'mf' | 'f' | 'ff';
  className?: string;
}) {
  const labels: Record<string, string> = {
    pp: 'pp',
    p: 'p',
    mp: 'mp',
    mf: 'mf',
    f: 'f',
    ff: 'ff',
  };

  return (
    <span
      className={`inline-block font-serif italic text-[var(--text-tertiary)] select-none ${className}`}
      title={level === 'pp' ? 'pianissimo' : level === 'p' ? 'piano' : level === 'mp' ? 'mezzo-piano' : level === 'mf' ? 'mezzo-forte' : level === 'f' ? 'forte' : 'fortissimo'}
      aria-hidden="true"
    >
      {labels[level]}
    </span>
  );
}

/* ────────────────────────────────────
   TrebleClef — 높은음자리표 워터마크
   Decorative SVG for card/section
   backgrounds. Use with low opacity.
   ──────────────────────────────────── */

export function TrebleClef({
  size = 120,
  color = 'var(--accent)',
  opacity = 0.04,
  className = '',
}: {
  size?: number;
  color?: string;
  opacity?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size * 1.6}
      viewBox="0 0 100 160"
      fill="none"
      className={`pointer-events-none select-none ${className}`}
      style={{ opacity }}
      aria-hidden="true"
    >
      <path
        d="M52 148c-16 0-28-8-28-22 0-10 6-18 16-20l2 6c-6 2-10 8-10 14 0 10 8 16 20 16 14 0 22-10 22-24 0-20-14-36-22-50L48 58c-8-14-14-28-14-44C34 6 40 0 50 0c8 0 14 6 14 14 0 6-4 10-8 10-4 0-6-2-6-6 0-3 2-5 4-6-1-2-3-4-6-4-6 0-10 6-10 14 0 12 6 24 14 40l4 8c10 18 24 34 24 56 0 18-10 26-24 26z"
        fill={color}
      />
    </svg>
  );
}

/* ────────────────────────────────────
   SoundWave — 수평 파형
   Animated waveform bars for loading
   states or decorative use.
   ──────────────────────────────────── */

export function SoundWave({
  bars = 5,
  height = 24,
  color = 'var(--accent)',
  animated = true,
  className = '',
}: {
  bars?: number;
  height?: number;
  color?: string;
  animated?: boolean;
  className?: string;
}) {
  const barWidth = 3;
  const gap = 3;
  const totalWidth = bars * barWidth + (bars - 1) * gap;
  const heights = [0.4, 0.7, 1, 0.7, 0.4, 0.6, 0.9];

  return (
    <svg
      width={totalWidth}
      height={height}
      viewBox={`0 0 ${totalWidth} ${height}`}
      className={className}
      aria-hidden="true"
    >
      {Array.from({ length: bars }).map((_, i) => {
        const h = height * (heights[i % heights.length] || 0.5);
        const y = (height - h) / 2;
        return (
          <rect
            key={i}
            x={i * (barWidth + gap)}
            y={y}
            width={barWidth}
            height={h}
            rx={1.5}
            fill={color}
            opacity={0.8}
            style={animated ? {
              animation: `wave-ripple ${1.2 + i * 0.15}s ease-in-out infinite`,
              animationDelay: `${i * 0.1}s`,
            } : undefined}
          />
        );
      })}
    </svg>
  );
}

/* ────────────────────────────────────
   MusicalDivider — 음악적 구분선
   Replaces generic border-t / <hr>.
   Combines bar line + optional dynamic mark.
   ──────────────────────────────────── */

export function MusicalDivider({
  mark,
  className = '',
}: {
  mark?: 'pp' | 'p' | 'mp' | 'mf' | 'f' | 'ff';
  className?: string;
}) {
  return (
    <div className={`flex items-center gap-3 my-4 ${className}`} role="separator" aria-hidden="true">
      <div className="flex-1 h-px bg-[var(--border)]" />
      <BarLine type="single" height={16} />
      {mark && <DynamicMark level={mark} className="text-[11px]" />}
      <div className="flex-1 h-px bg-[var(--border)]" />
    </div>
  );
}

/* ────────────────────────────────────
   ConductorBaton — 지휘봉 로딩 아이콘
   Animated baton using CSS class
   `animate-baton` from globals.css.
   ──────────────────────────────────── */

export function ConductorBaton({
  size = 24,
  color = 'var(--accent)',
  animated = true,
  className = '',
}: {
  size?: number;
  color?: string;
  animated?: boolean;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={`${animated ? 'animate-baton' : ''} ${className}`}
      aria-hidden="true"
    >
      {/* Baton shaft */}
      <line
        x1="12"
        y1="4"
        x2="12"
        y2="20"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
      />
      {/* Handle / grip */}
      <circle cx="12" cy="20" r="2.5" fill={color} />
      {/* Tip */}
      <circle cx="12" cy="4" r="1.5" fill={color} opacity="0.6" />
    </svg>
  );
}
