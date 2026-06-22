'use client';

/**
 * PhaseGlyphs — the three voyage-leg illustrations (묶기 / 듣기 / 닿기).
 *
 * Drawn in the same 18th-c. naval-print ink language as SailingShip: pure SVG,
 * 0.4–1.7px ink strokes on cream paper, `currentColor` = --bp-ink. Each glyph
 * is a single self-contained plate at viewBox 0 0 220 160 ("ink units"); the
 * parent scales it to fit the plate card.
 *
 * The myth (docs/MYTH-SIRENS-design-grounding-2026-06-23.md) is encoded
 * literally, not decoratively:
 *   - Bind  (묶기): the rope lashed to the mast + a wax-sealed date tag — you
 *                   tie your OWN judgment BEFORE the song.
 *   - Listen (듣기): deaf rowers + the song washing over the hull, while the
 *                   tiller is held level — max generation, helm never seized.
 *   - Land  (닿기): the anchor meeting the seabed by a far shore, carrying the
 *                   SAME wax seal — the committed bet settled against reality.
 *
 * Gold (--bp-gold) is spent on exactly one motif: the wax seal, which appears
 * in BOTH Bind and Land. It is the through-line of the user's own commitment —
 * the only thing the machine never authors.
 *
 * Entrance animation is gated on `show` (the parent reveals plates in sequence
 * on scroll); idle motion is limited to the song-pulse in Listen so the band
 * stays calm. All animation classes are disabled under prefers-reduced-motion
 * (see globals.css).
 */

type GlyphProps = {
  /** True once the plate has scrolled into view — triggers entrance draw. */
  show?: boolean;
  className?: string;
};

const INK: React.CSSProperties = { color: 'var(--bp-ink)' };

/** The wax seal — a pressed gold wafer with an embossed compass star. Shared
 *  motif between Bind (the moment of sealing) and Land (the seal, landed). */
function WaxSeal({ cx, cy, r = 13, show, delay = 0 }: { cx: number; cy: number; r?: number; show?: boolean; delay?: number }) {
  return (
    <g
      className={show ? 'bp-seal-stamp' : undefined}
      style={show ? { animationDelay: `${delay}ms` } : { opacity: 0 }}
    >
      {/* scalloped wax rim */}
      <circle cx={cx} cy={cy} r={r} fill="var(--bp-gold)" stroke="var(--bp-gold-deep)" strokeWidth="1" />
      <circle cx={cx} cy={cy} r={r - 3} fill="none" stroke="var(--bp-gold-deep)" strokeWidth="0.5" opacity="0.6" />
      {/* embossed 8-point compass star, in deep gold */}
      <g stroke="var(--bp-gold-deep)" strokeWidth="0.8" opacity="0.85">
        <path d={`M ${cx} ${cy - (r - 4)} L ${cx} ${cy + (r - 4)}`} />
        <path d={`M ${cx - (r - 4)} ${cy} L ${cx + (r - 4)} ${cy}`} />
        <path d={`M ${cx - (r - 6)} ${cy - (r - 6)} L ${cx + (r - 6)} ${cy + (r - 6)}`} opacity="0.6" />
        <path d={`M ${cx + (r - 6)} ${cy - (r - 6)} L ${cx - (r - 6)} ${cy + (r - 6)}`} opacity="0.6" />
      </g>
      <circle cx={cx} cy={cy} r="1.3" fill="var(--bp-gold-deep)" />
    </g>
  );
}

/* ══════════════════════ 묶기 / BIND ══════════════════════ */
/* The mast, lashed with rope, holding a wax-sealed date tag. "Tie your own
   rope before you hear the song." Bound HANDS, not ears (open mind). */
export function BindGlyph({ show, className }: GlyphProps) {
  // Four rope turns around the mast. Front arc solid, back arc faint — so the
  // rope reads as wrapping AROUND a round timber.
  const turns = [60, 76, 92, 108];
  return (
    <svg
      viewBox="0 0 220 160"
      className={className}
      style={{ ...INK, width: '100%', height: '100%', display: 'block' }}
      role="img"
      aria-label="A rope lashed around a ship's mast, holding a wax-sealed date tag"
    >
      {/* ── the mast timber ── */}
      <g>
        {/* rounded cap */}
        <path d="M 96 26 Q 110 16 124 26 L 124 140 L 96 140 Z" fill="var(--bp-paper)" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
        {/* timber grain */}
        <line x1="104" y1="34" x2="104" y2="138" stroke="currentColor" strokeWidth="0.4" opacity="0.3" />
        <line x1="116" y1="34" x2="116" y2="138" stroke="currentColor" strokeWidth="0.4" opacity="0.3" />
        <line x1="110" y1="40" x2="110" y2="120" stroke="currentColor" strokeWidth="0.4" opacity="0.18" />
      </g>

      {/* ── rope turns around the mast ── */}
      {turns.map((y, i) => (
        <g key={y}>
          {/* back of the turn (behind the mast) — faint */}
          <path d={`M 90 ${y} A 20 5.5 0 0 1 130 ${y}`} fill="none" stroke="currentColor" strokeWidth="1" opacity="0.22" />
          {/* front of the turn — solid, drawn on reveal */}
          <path
            d={`M 90 ${y} A 20 5.5 0 0 0 130 ${y}`}
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            className={show ? 'bp-stroke-draw' : undefined}
            style={show ? { strokeDasharray: 70, ['--draw-from' as string]: 70, animationDelay: `${160 + i * 120}ms` } : { opacity: 0 }}
          />
        </g>
      ))}

      {/* ── the cinch knot + tail rope down to the tag ── */}
      <g
        className={show ? 'bp-fade-soft' : undefined}
        style={show ? { animationDelay: '760ms' } : { opacity: 0 }}
      >
        <path d="M 130 92 q 10 2 8 12 q -2 8 -10 6" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M 134 108 Q 150 116 150 130" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      </g>

      {/* ── the sealed date tag (luggage tag with three date ticks) ── */}
      <g
        className={show ? 'bp-fade-soft' : undefined}
        style={show ? { animationDelay: '840ms' } : { opacity: 0 }}
      >
        <path
          d="M 150 130 l 30 -8 a 4 4 0 0 1 5 3 l 4 16 a 4 4 0 0 1 -3 5 l -30 8 l -8 -16 Z"
          fill="var(--bp-paper)"
          stroke="currentColor"
          strokeWidth="1.1"
          strokeLinejoin="round"
        />
        {/* date ticks on the tag */}
        <line x1="164" y1="132" x2="180" y2="128" stroke="currentColor" strokeWidth="0.7" opacity="0.6" />
        <line x1="166" y1="138" x2="184" y2="133.5" stroke="currentColor" strokeWidth="0.7" opacity="0.45" />
        <line x1="168" y1="144" x2="182" y2="140" stroke="currentColor" strokeWidth="0.7" opacity="0.45" />
      </g>

      {/* ── the wax seal — the moment of commitment, in gold ── */}
      <WaxSeal cx={150} cy={128} r={11} show={show} delay={980} />
    </svg>
  );
}

/* ══════════════════════ 듣기 / LISTEN ══════════════════════ */
/* Deaf rowers stroke the oars while the Siren's song washes over the hull from
   off-plate; the tiller is held level. Maximum generation — the helm is never
   seized. Visually the QUIET middle leg (per the canon: don't dramatize P2). */
export function ListenGlyph({ show, className }: GlyphProps) {
  return (
    <svg
      viewBox="0 0 220 160"
      className={className}
      style={{ ...INK, width: '100%', height: '100%', display: 'block' }}
      role="img"
      aria-label="A boat with rowers, the song washing over it, while the tiller is held steady"
    >
      {/* ── the song, arriving from off-plate (top-right = the Siren) ── */}
      <g className={show ? 'bp-song-pulse' : undefined} style={show ? undefined : { opacity: 0 }}>
        {[34, 50, 66, 84].map((r, i) => (
          <path
            key={r}
            d={`M ${214 - r} 8 A ${r} ${r} 0 0 1 214 ${8 + r}`}
            fill="none"
            stroke="currentColor"
            strokeWidth="0.9"
            opacity={0.4 - i * 0.07}
            strokeDasharray="2 5"
          />
        ))}
      </g>

      {/* ── water line ── */}
      <g
        className={show ? 'bp-fade-soft' : undefined}
        style={show ? { animationDelay: '120ms' } : { opacity: 0 }}
      >
        {[120, 132, 144].map((y, i) => (
          <path
            key={y}
            d={`M -4 ${y} Q 40 ${y - 4} 84 ${y} T 168 ${y} T 256 ${y}`}
            fill="none"
            stroke="currentColor"
            strokeWidth="0.7"
            strokeDasharray={`${5 - i} ${8 + i * 2}`}
            opacity={0.4 - i * 0.08}
          />
        ))}
      </g>

      {/* ── the oars (deaf rowers), dipping to the lee side ── */}
      <g
        className={show ? 'bp-fade-soft' : undefined}
        style={show ? { animationDelay: '320ms' } : { opacity: 0 }}
      >
        {[
          { x1: 70, y1: 110, x2: 44, y2: 138 },
          { x1: 96, y1: 110, x2: 72, y2: 140 },
          { x1: 122, y1: 110, x2: 100, y2: 138 },
        ].map((o, i) => (
          <g key={i}>
            <line x1={o.x1} y1={o.y1} x2={o.x2} y2={o.y2} stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
            {/* blade */}
            <ellipse cx={o.x2} cy={o.y2} rx="3.2" ry="5" fill="var(--bp-paper)" stroke="currentColor" strokeWidth="0.9" transform={`rotate(28 ${o.x2} ${o.y2})`} />
            {/* splash tick */}
            <path d={`M ${o.x2 - 5} ${o.y2 - 2} q 3 -4 6 0`} fill="none" stroke="currentColor" strokeWidth="0.5" opacity="0.5" />
          </g>
        ))}
      </g>

      {/* ── the hull ── */}
      <g
        className={show ? 'bp-fade-soft' : undefined}
        style={show ? { animationDelay: '220ms' } : { opacity: 0 }}
      >
        <path
          d="M 30 108 L 192 108 L 178 124 Q 150 134 110 134 Q 70 134 48 124 Z"
          fill="var(--bp-paper)"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
        {/* gunwale rail + thole pins */}
        <line x1="34" y1="108" x2="188" y2="108" stroke="currentColor" strokeWidth="0.6" opacity="0.5" />
        {[64, 90, 116].map((x) => (
          <line key={x} x1={x} y1="104" x2={x} y2="108" stroke="currentColor" strokeWidth="0.8" />
        ))}
      </g>

      {/* ── the tiller, held level (the helm never seized) ── */}
      <g
        className={show ? 'bp-fade-soft' : undefined}
        style={show ? { animationDelay: '520ms' } : { opacity: 0 }}
      >
        <line x1="178" y1="108" x2="200" y2="100" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        {/* grip knob */}
        <circle cx="202" cy="99" r="3.4" fill="var(--bp-paper)" stroke="currentColor" strokeWidth="1.1" />
        {/* a small "held level" datum tick — the helm holds its bearing */}
        <line x1="188" y1="96" x2="200" y2="92.5" stroke="currentColor" strokeWidth="0.5" strokeDasharray="1.5 2.5" opacity="0.55" />
      </g>
    </svg>
  );
}

/* ══════════════════════ 닿기 / LAND ══════════════════════ */
/* The anchor meets the seabed by a far shore (Ithaca). It carries the SAME wax
   seal as Bind — the committed bet, now settled against reality. */
export function LandGlyph({ show, className }: GlyphProps) {
  return (
    <svg
      viewBox="0 0 220 160"
      className={className}
      style={{ ...INK, width: '100%', height: '100%', display: 'block' }}
      role="img"
      aria-label="An anchor settling on the seabed beside a distant shore, carrying a wax seal"
    >
      {/* ── distant shore (Ithaca) on the horizon ── */}
      <g
        className={show ? 'bp-fade-soft' : undefined}
        style={show ? { animationDelay: '80ms' } : { opacity: 0 }}
      >
        <path d="M 150 40 L 166 34 L 182 26 L 200 32 L 216 40" fill="none" stroke="currentColor" strokeWidth="0.7" opacity="0.5" />
        <path d="M 150 40 L 166 34 L 182 26 L 200 32 L 216 40 L 216 46 L 150 46 Z" fill="currentColor" opacity="0.06" />
        {/* horizon hairline = reality */}
        <line x1="6" y1="46" x2="214" y2="46" stroke="currentColor" strokeWidth="0.5" opacity="0.32" />
      </g>

      {/* ── the seabed ── */}
      <g
        className={show ? 'bp-fade-soft' : undefined}
        style={show ? { animationDelay: '120ms' } : { opacity: 0 }}
      >
        <path d="M 6 138 Q 60 132 110 138 T 214 138" fill="none" stroke="currentColor" strokeWidth="0.8" opacity="0.5" />
        <path d="M 6 138 Q 60 132 110 138 T 214 138 L 214 158 L 6 158 Z" fill="currentColor" opacity="0.05" />
      </g>

      {/* ── the anchor, descended onto the bed (drops in on reveal) ── */}
      <g
        className={show ? 'bp-anchor-drop' : undefined}
        style={show ? { animationDelay: '300ms' } : { opacity: 0 }}
      >
        {/* chain links up to off-plate */}
        {[14, 24, 34].map((y, i) => (
          <ellipse key={y} cx="110" cy={y} rx="3.2" ry="4.6" fill="none" stroke="currentColor" strokeWidth="1.1" opacity={0.5 + i * 0.15} />
        ))}
        {/* ring */}
        <circle cx="110" cy="46" r="6" fill="none" stroke="currentColor" strokeWidth="1.5" />
        {/* shank */}
        <line x1="110" y1="52" x2="110" y2="118" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        {/* stock (cross-bar) */}
        <line x1="92" y1="62" x2="128" y2="62" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        <line x1="126" y1="58" x2="126" y2="66" stroke="currentColor" strokeWidth="1.2" />
        {/* arms + flukes — the classic curved admiralty crown */}
        <path d="M 110 118 Q 86 118 84 96" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <path d="M 110 118 Q 134 118 136 96" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <path d="M 84 96 l -6 8 l 12 -1 Z" fill="currentColor" stroke="currentColor" strokeWidth="0.8" strokeLinejoin="round" />
        <path d="M 136 96 l 6 8 l -12 -1 Z" fill="currentColor" stroke="currentColor" strokeWidth="0.8" strokeLinejoin="round" />
      </g>

      {/* ── impact ripples where the crown meets the bed ── */}
      <g
        className={show ? 'bp-ripple-out' : undefined}
        style={show ? { animationDelay: '740ms' } : { opacity: 0 }}
      >
        <path d="M 86 132 Q 110 126 134 132" fill="none" stroke="currentColor" strokeWidth="0.7" opacity="0.5" />
        <path d="M 78 138 Q 110 130 142 138" fill="none" stroke="currentColor" strokeWidth="0.6" opacity="0.32" />
      </g>

      {/* ── the wax seal — the same commitment from Bind, now landed ── */}
      <WaxSeal cx={110} cy={84} r={11} show={show} delay={820} />
    </svg>
  );
}
