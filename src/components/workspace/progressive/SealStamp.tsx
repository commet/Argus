'use client';

/**
 * SealStamp — the app-register wax/ink seal (P1-A3 / 07 S2).
 *
 * The visual ancestor is the landing's static chart seal
 * (landing/films/VoyageMapFilm.tsx "chart seal"), redrawn here with APP tokens
 * only (`var(--accent)`), never the landing blueprint tokens — the
 * design-register contract keeps the landing's ceremony gold out of working
 * surfaces, and this stamp is the user's OWN commitment mark, not an AI
 * verdict decoration.
 *
 * Spine: the stamp carries NO judgment — only the product name and the
 * check-in date. Identical for every seal, regardless of the decision's
 * content or direction.
 *
 * `animate` gates the press-in keyframes + ink ring; pass `false` for the
 * resting certificate state (and under prefers-reduced-motion the CSS itself
 * freezes to the final frame, so even `animate` is safe).
 */

export function SealStamp({
  date,
  animate = false,
  size = 76,
  className = '',
}: {
  /** Short date carved into the lower arc, e.g. "7.17" (month.day). */
  date: string;
  /** Play the press-in ceremony (seal-press + ink ring). */
  animate?: boolean;
  size?: number;
  className?: string;
}) {
  return (
    <div
      className={`relative inline-block ${className}`}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      {/* ink ring — a single spreading echo behind the press (animate only) */}
      {animate && (
        <div
          className="seal-ink-ring absolute inset-0 rounded-full"
          style={{ border: '1.5px solid var(--accent)' }}
        />
      )}
      <svg
        viewBox="0 0 76 76"
        width={size}
        height={size}
        fill="none"
        className={animate ? 'seal-press' : undefined}
        style={{ transform: 'rotate(-8deg)', color: 'var(--accent)' }}
      >
        {/* double ring — outer firm, inner faint (a pressed stamp's halo) */}
        <circle cx="38" cy="38" r="35" stroke="currentColor" strokeWidth="2" />
        <circle cx="38" cy="38" r="29" stroke="currentColor" strokeWidth="1" opacity="0.18" />
        {/* upper arc: product name · lower arc: the check-in date. Nothing
            else — nothing evaluative ever gets carved here. */}
        <defs>
          <path id="seal-arc-top" d="M 14 38 A 24 24 0 0 1 62 38" />
          <path id="seal-arc-bottom" d="M 14 38 A 24 24 0 0 0 62 38" />
        </defs>
        <text
          fontSize="8.5"
          fontWeight="700"
          letterSpacing="0.28em"
          fill="currentColor"
          style={{ fontFamily: 'var(--font-mono, monospace)' }}
        >
          <textPath href="#seal-arc-top" startOffset="50%" textAnchor="middle">
            ARGUS
          </textPath>
        </text>
        <text
          fontSize="10"
          fontWeight="700"
          letterSpacing="0.12em"
          fill="currentColor"
          style={{ fontFamily: 'var(--font-mono, monospace)', fontVariantNumeric: 'tabular-nums' }}
        >
          <textPath href="#seal-arc-bottom" startOffset="50%" textAnchor="middle">
            {date}
          </textPath>
        </text>
        {/* anchor glyph (lucide Anchor path, scaled to the seal's heart) */}
        <g transform="translate(28 28) scale(0.833)" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 22V8" />
          <path d="M5 12H2a10 10 0 0 0 20 0h-3" />
          <circle cx="12" cy="5" r="3" />
        </g>
      </svg>
      {/* the glint breath — the only loop that survives the ceremony */}
      {!animate && (
        <div
          className="seal-glint-app absolute rounded-full pointer-events-none"
          style={{
            width: size * 0.28,
            height: size * 0.28,
            top: size * 0.12,
            left: size * 0.16,
            background: 'radial-gradient(circle, var(--accent) 0%, transparent 70%)',
            opacity: 0,
          }}
        />
      )}
    </div>
  );
}
