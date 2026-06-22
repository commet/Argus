'use client';

/**
 * PhaseGlyphs — the three voyage-leg illustrations (묶기 / 듣기 / 닿기).
 *
 * Drawn in the same 18th-c. naval-print ink language as SailingShip: pure SVG,
 * 0.4–2.2px ink strokes on cream paper, `currentColor` = --bp-ink. Each glyph
 * is a self-contained living plate at viewBox 0 0 220 160 ("ink units"); the
 * parent scales it to fit the plate card.
 *
 * The myth (docs/MYTH-SIRENS-design-grounding-2026-06-23.md) is encoded
 * literally, not decoratively:
 *   - Bind  (묶기): the rope lashed to the mast at a horn cleat + a wax-sealed
 *                   date tag that gently sways — you tie your OWN judgment and
 *                   pin a date BEFORE the song. Bound hands, open ears.
 *   - Listen (듣기): deaf rowers stroking the oars while the song washes over
 *                   the hull, and the tiller is held level — max generation, the
 *                   helm never seized.
 *   - Land  (닿기): the anchor settling onto the seabed by a far shore, carrying
 *                   the SAME wax seal — the committed bet, settled on reality.
 *
 * Gold (--bp-gold) is spent on exactly one motif: the wax seal, which appears
 * in BOTH Bind and Land. It is the through-line of the user's own commitment —
 * the one thing the machine never authors.
 *
 * Each glyph draws itself once on mount (bp-stroke-draw / bp-seal-stamp /
 * bp-anchor-drop), then stays quietly ALIVE with slow idle motion (bp-sway /
 * bp-bob / bp-oar / bp-seal-glint). All animation classes are disabled under
 * prefers-reduced-motion (globals.css), where the glyph renders in final state.
 */

type GlyphProps = {
  /** True once the plate has mounted — triggers the one-time entrance draw. */
  show?: boolean;
  className?: string;
};

const INK: React.CSSProperties = { color: 'var(--bp-ink)' };

/** The wax seal — a pressed gold wafer with an embossed compass star and a
 *  slow breathing glint. Shared motif between Bind and Land. */
function WaxSeal({ cx, cy, r = 12, show, delay = 0 }: { cx: number; cy: number; r?: number; show?: boolean; delay?: number }) {
  return (
    <g
      className={show ? 'bp-seal-stamp' : undefined}
      style={show ? { animationDelay: `${delay}ms` } : { opacity: 0 }}
    >
      {/* scalloped wax rim */}
      <circle cx={cx} cy={cy} r={r} fill="var(--bp-gold)" stroke="var(--bp-gold-deep)" strokeWidth="1" />
      <circle cx={cx} cy={cy} r={r - 2.6} fill="none" stroke="var(--bp-gold-deep)" strokeWidth="0.5" opacity="0.6" />
      {/* embossed 8-point compass star, in deep gold */}
      <g stroke="var(--bp-gold-deep)" strokeWidth="0.8" opacity="0.85">
        <path d={`M ${cx} ${cy - (r - 3.5)} L ${cx} ${cy + (r - 3.5)}`} />
        <path d={`M ${cx - (r - 3.5)} ${cy} L ${cx + (r - 3.5)} ${cy}`} />
        <path d={`M ${cx - (r - 5.5)} ${cy - (r - 5.5)} L ${cx + (r - 5.5)} ${cy + (r - 5.5)}`} opacity="0.6" />
        <path d={`M ${cx + (r - 5.5)} ${cy - (r - 5.5)} L ${cx - (r - 5.5)} ${cy + (r - 5.5)}`} opacity="0.6" />
      </g>
      <circle cx={cx} cy={cy} r="1.2" fill="var(--bp-gold-deep)" />
      {/* breathing glint highlight (upper-left) */}
      <path
        className={show ? 'bp-seal-glint' : undefined}
        d={`M ${cx - r * 0.55} ${cy - r * 0.2} A ${r * 0.7} ${r * 0.7} 0 0 1 ${cx - r * 0.1} ${cy - r * 0.62}`}
        fill="none"
        stroke="var(--bp-paper)"
        strokeWidth="1.4"
        strokeLinecap="round"
        opacity="0"
      />
    </g>
  );
}

/* ══════════════════════ 묶기 / BIND ══════════════════════ */
export function BindGlyph({ show, className }: GlyphProps) {
  const turns = [58, 74, 90, 106];
  return (
    <svg
      viewBox="0 0 220 160"
      className={className}
      style={{ ...INK, width: '100%', height: '100%', display: 'block' }}
      role="img"
      aria-label="A rope lashed to a ship's mast at a cleat, holding a wax-sealed date tag"
    >
      {/* ── the mast timber, with iron bands ── */}
      <g>
        <path d="M 96 24 Q 110 14 124 24 L 124 142 L 96 142 Z" fill="var(--bp-paper)" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
        <line x1="104" y1="32" x2="104" y2="140" stroke="currentColor" strokeWidth="0.4" opacity="0.3" />
        <line x1="116" y1="32" x2="116" y2="140" stroke="currentColor" strokeWidth="0.4" opacity="0.3" />
        <line x1="110" y1="38" x2="110" y2="120" stroke="currentColor" strokeWidth="0.4" opacity="0.16" />
        {/* iron bands */}
        <line x1="95" y1="40" x2="125" y2="40" stroke="currentColor" strokeWidth="1.1" opacity="0.55" />
        <line x1="95" y1="128" x2="125" y2="128" stroke="currentColor" strokeWidth="1.1" opacity="0.55" />
        <circle cx="97" cy="40" r="0.9" fill="currentColor" opacity="0.55" />
        <circle cx="123" cy="40" r="0.9" fill="currentColor" opacity="0.55" />
      </g>

      {/* ── rope turns around the mast (back faint, front solid, drawn on reveal) ── */}
      {turns.map((y, i) => (
        <g key={y}>
          <path d={`M 90 ${y} A 20 5.5 0 0 1 130 ${y}`} fill="none" stroke="currentColor" strokeWidth="1.1" opacity="0.2" />
          <path
            d={`M 90 ${y} A 20 5.5 0 0 0 130 ${y}`}
            fill="none"
            stroke="currentColor"
            strokeWidth="1.9"
            strokeLinecap="round"
            className={show ? 'bp-stroke-draw' : undefined}
            style={show ? { strokeDasharray: 72, ['--draw-from' as string]: 72, animationDelay: `${180 + i * 120}ms` } : { opacity: 0 }}
          />
        </g>
      ))}

      {/* ── the horn cleat the rope is made fast to ── */}
      <g
        className={show ? 'bp-fade-soft' : undefined}
        style={show ? { animationDelay: '760ms' } : { opacity: 0 }}
      >
        <path d="M 122 96 q 9 -1 12 4 q 2 4 -1 5 q -4 1 -6 -3 q -2 -4 -5 -3 Z" fill="var(--bp-paper)" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
        <circle cx="128" cy="100" r="1.6" fill="currentColor" />
      </g>

      {/* ── the hanging sealed date tag — gently sways from the cleat ── */}
      <g
        className={show ? 'bp-sway' : undefined}
        style={{ transformOrigin: '8% 4%', ...(show ? {} : { opacity: 0 }) }}
      >
        <g
          className={show ? 'bp-fade-soft' : undefined}
          style={show ? { animationDelay: '860ms' } : undefined}
        >
          {/* tail rope */}
          <path d="M 130 100 q 8 6 7 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          {/* the tag card */}
          <path
            d="M 150 132 l 30 -8 a 4 4 0 0 1 5 3 l 4 15 a 4 4 0 0 1 -3 5 l -30 8 l -8 -16 Z"
            fill="var(--bp-paper)"
            stroke="currentColor"
            strokeWidth="1.1"
            strokeLinejoin="round"
          />
          {/* punch-hole + lashing to the rope */}
          <circle cx="150" cy="132" r="2.2" fill="var(--bp-paper)" stroke="currentColor" strokeWidth="0.9" />
          {/* date ticks */}
          <line x1="163" y1="133" x2="181" y2="128.5" stroke="currentColor" strokeWidth="0.8" opacity="0.6" />
          <line x1="165" y1="139" x2="184" y2="134" stroke="currentColor" strokeWidth="0.7" opacity="0.42" />
          <line x1="167" y1="145" x2="182" y2="141" stroke="currentColor" strokeWidth="0.7" opacity="0.42" />
          {/* the wax seal — the moment of commitment, in gold */}
          <WaxSeal cx={158} cy={138} r={10} show={show} delay={1000} />
        </g>
      </g>
    </svg>
  );
}

/* ══════════════════════ 듣기 / LISTEN ══════════════════════ */
export function ListenGlyph({ show, className }: GlyphProps) {
  // Oars hang from thole pins on the near gunwale and stroke to the lee side.
  const oars = [
    { px: 66, py: 108, bx: 40, by: 138, cls: 'bp-oar' },
    { px: 92, py: 108, bx: 68, by: 141, cls: 'bp-oar bp-oar-b' },
    { px: 118, py: 108, bx: 96, by: 138, cls: 'bp-oar bp-oar-c' },
  ];
  return (
    <svg
      viewBox="0 0 220 160"
      className={className}
      style={{ ...INK, width: '100%', height: '100%', display: 'block' }}
      role="img"
      aria-label="A rowed boat with the song washing over it, the tiller held steady"
    >
      {/* ── the song, arriving from off-plate (top-right = the Siren) ── */}
      <g className={show ? 'bp-song-pulse' : undefined} style={show ? undefined : { opacity: 0 }}>
        {[30, 46, 62, 80, 98].map((r, i) => (
          <path
            key={r}
            d={`M ${216 - r} 6 A ${r} ${r} 0 0 1 216 ${6 + r}`}
            fill="none"
            stroke="currentColor"
            strokeWidth="0.9"
            opacity={0.42 - i * 0.06}
            strokeDasharray="2 5"
          />
        ))}
        {/* a faint siren-rock silhouette the song issues from */}
        <path d="M 212 4 q 4 6 2 12 q 4 -2 2 6" fill="none" stroke="currentColor" strokeWidth="0.7" opacity="0.3" />
      </g>

      {/* ── water hatching ── */}
      <g
        className={show ? 'bp-fade-soft' : undefined}
        style={show ? { animationDelay: '120ms' } : { opacity: 0 }}
      >
        {[122, 134, 146].map((y, i) => (
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

      {/* ── the boat + crew, bobbing on the swell ── */}
      <g className={show ? 'bp-bob' : undefined} style={show ? undefined : { opacity: 0 }}>
        {/* oars (deaf rowers) — each strokes from its thole pin */}
        <g
          className={show ? 'bp-fade-soft' : undefined}
          style={show ? { animationDelay: '300ms' } : undefined}
        >
          {oars.map((o, i) => (
            <g key={i} className={show ? o.cls : undefined} style={{ transformOrigin: '100% 0%' }}>
              <line x1={o.px} y1={o.py} x2={o.bx} y2={o.by} stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
              <ellipse cx={o.bx} cy={o.by} rx="3" ry="5.2" fill="var(--bp-paper)" stroke="currentColor" strokeWidth="0.9" transform={`rotate(30 ${o.bx} ${o.by})`} />
            </g>
          ))}
        </g>

        {/* the hull */}
        <path
          d="M 28 106 L 192 106 L 178 124 Q 150 134 110 134 Q 70 134 48 124 Z"
          fill="var(--bp-paper)"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinejoin="round"
        />
        {/* planking + gunwale + thole pins */}
        <path d="M 36 113 Q 110 119 184 113" fill="none" stroke="currentColor" strokeWidth="0.5" opacity="0.45" />
        <line x1="32" y1="106" x2="188" y2="106" stroke="currentColor" strokeWidth="0.7" opacity="0.55" />
        {oars.map((o) => (
          <line key={o.px} x1={o.px} y1="102" x2={o.px} y2="106" stroke="currentColor" strokeWidth="0.9" />
        ))}

        {/* bow stem + a small pennant (left = bow) */}
        <line x1="33" y1="106" x2="26" y2="92" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        <path d="M 26 92 l 14 3 l -10 4 Z" fill="currentColor" opacity="0.7" />

        {/* the tiller, held level (the helm never seized) — stern, right */}
        <line x1="186" y1="106" x2="204" y2="98" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
        <circle cx="205" cy="97" r="3.4" fill="var(--bp-paper)" stroke="currentColor" strokeWidth="1.1" />
        {/* a small "held / locked" datum tick on the tiller */}
        <line x1="192" y1="95" x2="203" y2="92" stroke="currentColor" strokeWidth="0.5" strokeDasharray="1.5 2.5" opacity="0.6" />
      </g>
    </svg>
  );
}

/* ══════════════════════ 닿기 / LAND ══════════════════════ */
export function LandGlyph({ show, className }: GlyphProps) {
  return (
    <svg
      viewBox="0 0 220 160"
      className={className}
      style={{ ...INK, width: '100%', height: '100%', display: 'block' }}
      role="img"
      aria-label="An anchor settling on the seabed beside a distant shore, carrying a wax seal"
    >
      {/* ── distant shore (Ithaca) with a small light tower ── */}
      <g
        className={show ? 'bp-fade-soft' : undefined}
        style={show ? { animationDelay: '80ms' } : { opacity: 0 }}
      >
        <path d="M 150 42 L 165 35 L 180 27 L 198 33 L 216 42" fill="none" stroke="currentColor" strokeWidth="0.7" opacity="0.5" />
        <path d="M 150 42 L 165 35 L 180 27 L 198 33 L 216 42 L 216 48 L 150 48 Z" fill="currentColor" opacity="0.06" />
        {/* light tower on the headland */}
        <line x1="180" y1="27" x2="180" y2="16" stroke="currentColor" strokeWidth="0.9" opacity="0.55" />
        <path d="M 177 16 l 6 0 l -1.5 -4 l -3 0 Z" fill="currentColor" opacity="0.5" />
        <path d="M 184 13 q 5 0 8 -2" fill="none" stroke="currentColor" strokeWidth="0.5" opacity="0.4" strokeDasharray="1.5 2" />
        {/* horizon = reality */}
        <line x1="6" y1="48" x2="214" y2="48" stroke="currentColor" strokeWidth="0.5" opacity="0.32" />
      </g>

      {/* ── layered seabed ── */}
      <g
        className={show ? 'bp-fade-soft' : undefined}
        style={show ? { animationDelay: '120ms' } : { opacity: 0 }}
      >
        <path d="M 6 140 Q 60 133 110 140 T 214 140" fill="none" stroke="currentColor" strokeWidth="0.8" opacity="0.5" />
        <path d="M 6 148 Q 70 142 120 148 T 214 146" fill="none" stroke="currentColor" strokeWidth="0.6" opacity="0.3" />
        <path d="M 6 140 Q 60 133 110 140 T 214 140 L 214 158 L 6 158 Z" fill="currentColor" opacity="0.05" />
      </g>

      {/* ── the anchor: drops in on reveal, then sways on its chain ── */}
      <g
        className={show ? 'bp-anchor-drop' : undefined}
        style={show ? { animationDelay: '300ms' } : { opacity: 0 }}
      >
        <g className={show ? 'bp-sway' : undefined} style={{ transformOrigin: '50% 4%' }}>
          {/* chain links up to off-plate */}
          {[10, 20, 30].map((y, i) => (
            <ellipse key={y} cx="110" cy={y} rx="3" ry="4.4" fill="none" stroke="currentColor" strokeWidth="1.1" opacity={0.45 + i * 0.15} />
          ))}
          {/* ring */}
          <circle cx="110" cy="44" r="6" fill="none" stroke="currentColor" strokeWidth="1.5" />
          {/* shank */}
          <line x1="110" y1="50" x2="110" y2="120" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" />
          {/* stock (cross-bar) */}
          <line x1="91" y1="60" x2="129" y2="60" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
          <line x1="127" y1="56" x2="127" y2="64" stroke="currentColor" strokeWidth="1.2" />
          {/* arms + flukes (admiralty crown) */}
          <path d="M 110 120 Q 85 120 83 96" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" />
          <path d="M 110 120 Q 135 120 137 96" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" />
          <path d="M 83 96 l -6 8 l 12 -1 Z" fill="currentColor" stroke="currentColor" strokeWidth="0.8" strokeLinejoin="round" />
          <path d="M 137 96 l 6 8 l -12 -1 Z" fill="currentColor" stroke="currentColor" strokeWidth="0.8" strokeLinejoin="round" />
          {/* the wax seal — the same commitment from Bind, now landed */}
          <WaxSeal cx={110} cy={86} r={10.5} show={show} delay={820} />
        </g>
      </g>

      {/* ── impact ripples where the crown meets the bed ── */}
      <g
        className={show ? 'bp-ripple-out' : undefined}
        style={show ? { animationDelay: '760ms' } : { opacity: 0 }}
      >
        <path d="M 86 132 Q 110 126 134 132" fill="none" stroke="currentColor" strokeWidth="0.7" opacity="0.5" />
        <path d="M 78 138 Q 110 130 142 138" fill="none" stroke="currentColor" strokeWidth="0.6" opacity="0.3" />
      </g>
    </svg>
  );
}
