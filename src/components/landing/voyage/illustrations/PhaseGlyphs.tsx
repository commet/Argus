'use client';

/**
 * PhaseGlyphs — the three voyage-leg dioramas (묶기 / 듣기 / 닿기).
 *
 * Each is a small SCENE with foreground / midground / background depth, drawn in
 * the 18th-c. naval-print ink language of SailingShip: pure SVG, 0.4–2.2px ink
 * strokes on cream paper, `currentColor` = --bp-ink, at viewBox 0 0 220 160.
 *
 * The myth (docs/MYTH-SIRENS-design-grounding-2026-06-23.md) is literal:
 *   - Bind  (묶기): on deck before the strait — rope made fast to the mast at a
 *                   belaying-pin rack + a wax-sealed date tag that sways. You tie
 *                   your OWN judgment and pin a date. Bound hands, open ears.
 *   - Listen (듣기): in the strait — deaf rowers stroke the oars while the Siren
 *                   sings from her rock; the tiller is held level. Max
 *                   generation, the helm never seized.
 *   - Land  (닿기): the cove at settlement — the anchor bites the seabed below a
 *                   lighthouse shore, carrying the SAME wax seal. The committed
 *                   bet, settled on reality.
 *
 * Gold (--bp-gold) is spent on one motif only: the wax seal, shared between Bind
 * and Land — the through-line of the user's own commitment.
 *
 * Each draws once on mount, then stays quietly alive (sway / bob / oar / song-
 * pulse / seal-glint). All animation is disabled under prefers-reduced-motion.
 */

type GlyphProps = {
  show?: boolean;
  className?: string;
};

const INK: React.CSSProperties = { color: 'var(--bp-ink)' };

/** The wax seal — a pressed gold wafer with an embossed compass star + glint. */
function WaxSeal({ cx, cy, r = 11, show, delay = 0 }: { cx: number; cy: number; r?: number; show?: boolean; delay?: number }) {
  return (
    <g className={show ? 'bp-seal-stamp' : undefined} style={show ? { animationDelay: `${delay}ms` } : { opacity: 0 }}>
      <circle cx={cx} cy={cy} r={r} fill="var(--bp-gold)" stroke="var(--bp-gold-deep)" strokeWidth="1" />
      <circle cx={cx} cy={cy} r={r - 2.6} fill="none" stroke="var(--bp-gold-deep)" strokeWidth="0.5" opacity="0.6" />
      <g stroke="var(--bp-gold-deep)" strokeWidth="0.8" opacity="0.85">
        <path d={`M ${cx} ${cy - (r - 3.5)} L ${cx} ${cy + (r - 3.5)}`} />
        <path d={`M ${cx - (r - 3.5)} ${cy} L ${cx + (r - 3.5)} ${cy}`} />
        <path d={`M ${cx - (r - 5.5)} ${cy - (r - 5.5)} L ${cx + (r - 5.5)} ${cy + (r - 5.5)}`} opacity="0.6" />
        <path d={`M ${cx + (r - 5.5)} ${cy - (r - 5.5)} L ${cx - (r - 5.5)} ${cy + (r - 5.5)}`} opacity="0.6" />
      </g>
      <circle cx={cx} cy={cy} r="1.2" fill="var(--bp-gold-deep)" />
      <path
        className={show ? 'bp-seal-glint' : undefined}
        d={`M ${cx - r * 0.55} ${cy - r * 0.2} A ${r * 0.7} ${r * 0.7} 0 0 1 ${cx - r * 0.1} ${cy - r * 0.62}`}
        fill="none" stroke="var(--bp-paper)" strokeWidth="1.3" strokeLinecap="round" opacity="0"
      />
    </g>
  );
}

/* ══════════════════════ 묶기 / BIND ══════════════════════ */
export function BindGlyph({ show, className }: GlyphProps) {
  const turns = [54, 70, 86, 102];
  return (
    <svg viewBox="0 0 220 160" className={className} style={{ ...INK, width: '100%', height: '100%', display: 'block' }}
      role="img" aria-label="On deck: a rope made fast to the mast, holding a wax-sealed date tag">
      {/* ── background: a faint deck rail + sky ── */}
      <g opacity="0.5" className={show ? 'bp-fade-soft' : undefined} style={show ? { animationDelay: '60ms' } : { opacity: 0 }}>
        <line x1="14" y1="40" x2="70" y2="40" stroke="currentColor" strokeWidth="0.4" strokeDasharray="3 7" opacity="0.5" />
        <line x1="150" y1="34" x2="206" y2="34" stroke="currentColor" strokeWidth="0.4" strokeDasharray="3 7" opacity="0.4" />
        {/* far rail */}
        <line x1="8" y1="120" x2="78" y2="120" stroke="currentColor" strokeWidth="0.6" opacity="0.4" />
        {[18, 34, 50, 66].map((x) => <line key={x} x1={x} y1="120" x2={x} y2="132" stroke="currentColor" strokeWidth="0.5" opacity="0.35" />)}
      </g>

      {/* ── foreground deck planking ── */}
      <g className={show ? 'bp-fade-soft' : undefined} style={show ? { animationDelay: '120ms' } : { opacity: 0 }}>
        {[140, 148, 156].map((y) => <line key={y} x1="6" y1={y} x2="214" y2={y} stroke="currentColor" strokeWidth="0.5" opacity="0.4" />)}
        {[40, 90, 140, 190].map((x, i) => <line key={x} x1={x + (i % 2) * 12} y1="140" x2={x + (i % 2) * 12} y2="156" stroke="currentColor" strokeWidth="0.4" opacity="0.3" />)}
      </g>

      {/* ── the mast timber + iron bands, standing on the deck ── */}
      <g>
        <path d="M 96 22 Q 110 12 124 22 L 124 140 L 96 140 Z" fill="var(--bp-paper)" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
        <line x1="104" y1="30" x2="104" y2="138" stroke="currentColor" strokeWidth="0.4" opacity="0.3" />
        <line x1="116" y1="30" x2="116" y2="138" stroke="currentColor" strokeWidth="0.4" opacity="0.3" />
        <line x1="95" y1="36" x2="125" y2="36" stroke="currentColor" strokeWidth="1.1" opacity="0.55" />
        <line x1="95" y1="120" x2="125" y2="120" stroke="currentColor" strokeWidth="1.1" opacity="0.55" />
      </g>

      {/* ── belaying-pin rack at the mast base, with a hung rope coil ── */}
      <g className={show ? 'bp-fade-soft' : undefined} style={show ? { animationDelay: '700ms' } : { opacity: 0 }}>
        <line x1="84" y1="124" x2="96" y2="124" stroke="currentColor" strokeWidth="1.3" />
        {[86, 90, 94].map((x) => <line key={x} x1={x} y1="120" x2={x} y2="132" stroke="currentColor" strokeWidth="1" />)}
        {/* coil hanging on the middle pin */}
        <ellipse cx="90" cy="135" rx="5" ry="7" fill="none" stroke="currentColor" strokeWidth="0.9" opacity="0.75" />
        <ellipse cx="90" cy="135" rx="2.6" ry="4" fill="none" stroke="currentColor" strokeWidth="0.7" opacity="0.55" />
      </g>

      {/* ── rope turns around the mast (back faint, front solid, drawn on reveal) ── */}
      {turns.map((y, i) => (
        <g key={y}>
          <path d={`M 90 ${y} A 20 5.5 0 0 1 130 ${y}`} fill="none" stroke="currentColor" strokeWidth="1.1" opacity="0.2" />
          <path d={`M 90 ${y} A 20 5.5 0 0 0 130 ${y}`} fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round"
            className={show ? 'bp-stroke-draw' : undefined}
            style={show ? { strokeDasharray: 72, ['--draw-from' as string]: 72, animationDelay: `${180 + i * 110}ms` } : { opacity: 0 }} />
        </g>
      ))}

      {/* ── the horn cleat the tag-rope is made fast to ── */}
      <g className={show ? 'bp-fade-soft' : undefined} style={show ? { animationDelay: '760ms' } : { opacity: 0 }}>
        <path d="M 122 92 q 9 -1 12 4 q 2 4 -1 5 q -4 1 -6 -3 q -2 -4 -5 -3 Z" fill="var(--bp-paper)" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
        <circle cx="128" cy="96" r="1.5" fill="currentColor" />
      </g>

      {/* ── the hanging sealed date tag — gently sways from the cleat ── */}
      <g className={show ? 'bp-sway' : undefined} style={{ transformOrigin: '6% 4%', ...(show ? {} : { opacity: 0 }) }}>
        <g className={show ? 'bp-fade-soft' : undefined} style={show ? { animationDelay: '860ms' } : undefined}>
          <path d="M 130 96 q 8 6 7 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          <path d="M 150 128 l 30 -8 a 4 4 0 0 1 5 3 l 4 15 a 4 4 0 0 1 -3 5 l -30 8 l -8 -16 Z" fill="var(--bp-paper)" stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round" />
          <circle cx="150" cy="128" r="2.2" fill="var(--bp-paper)" stroke="currentColor" strokeWidth="0.9" />
          <line x1="163" y1="129" x2="181" y2="124.5" stroke="currentColor" strokeWidth="0.8" opacity="0.6" />
          <line x1="165" y1="135" x2="184" y2="130" stroke="currentColor" strokeWidth="0.7" opacity="0.42" />
          <line x1="167" y1="141" x2="182" y2="137" stroke="currentColor" strokeWidth="0.7" opacity="0.42" />
          <WaxSeal cx={158} cy={134} r={10} show={show} delay={1000} />
        </g>
      </g>
    </svg>
  );
}

/* ══════════════════════ 듣기 / LISTEN ══════════════════════ */
export function ListenGlyph({ show, className }: GlyphProps) {
  const oars = [
    { px: 64, py: 106, bx: 40, by: 136, cls: 'bp-oar' },
    { px: 90, py: 106, bx: 66, by: 139, cls: 'bp-oar bp-oar-b' },
    { px: 116, py: 106, bx: 94, by: 136, cls: 'bp-oar bp-oar-c' },
  ];
  // seated rower: a head + a leaning back, at each oar's inboard end
  const rowers = [
    { x: 70, y: 100 },
    { x: 96, y: 100 },
    { x: 122, y: 100 },
  ];
  return (
    <svg viewBox="0 0 220 160" className={className} style={{ ...INK, width: '100%', height: '100%', display: 'block' }}
      role="img" aria-label="In the strait: deaf rowers at the oars under the Siren's song, the tiller held level">
      {/* ── the Siren on her rock + the song, from the top-right ── */}
      <g className={show ? 'bp-song-pulse' : undefined} style={show ? undefined : { opacity: 0 }}>
        {[28, 44, 60, 78, 96].map((r, i) => (
          <path key={r} d={`M ${216 - r} 4 A ${r} ${r} 0 0 1 216 ${4 + r}`} fill="none" stroke="currentColor" strokeWidth="0.9" opacity={0.42 - i * 0.06} strokeDasharray="2 5" />
        ))}
      </g>
      {/* siren silhouette on a rock (static, faint) */}
      <g className={show ? 'bp-fade-soft' : undefined} style={show ? { animationDelay: '160ms' } : { opacity: 0 }} opacity="0.55">
        <path d="M 206 30 q 6 -2 10 0 l 0 8 q -5 2 -10 0 Z" fill="currentColor" opacity="0.12" />
        <circle cx="210" cy="22" r="2.4" fill="none" stroke="currentColor" strokeWidth="0.8" />
        <path d="M 210 25 q -3 5 -2 11 q 4 -1 4 0 q 0 -1 4 0 q 1 -6 -2 -11" fill="none" stroke="currentColor" strokeWidth="0.8" />
      </g>

      {/* ── water hatching (foreground swell) ── */}
      <g className={show ? 'bp-fade-soft' : undefined} style={show ? { animationDelay: '120ms' } : { opacity: 0 }}>
        {[120, 132, 144, 154].map((y, i) => (
          <path key={y} d={`M -4 ${y} Q 40 ${y - 4} 84 ${y} T 168 ${y} T 256 ${y}`} fill="none" stroke="currentColor" strokeWidth="0.7" strokeDasharray={`${5 - i} ${8 + i * 2}`} opacity={0.4 - i * 0.07} />
        ))}
      </g>

      {/* ── the boat + crew, bobbing on the swell ── */}
      <g className={show ? 'bp-bob' : undefined} style={show ? undefined : { opacity: 0 }}>
        {/* oars (deaf rowers) — each strokes from its thole pin */}
        <g className={show ? 'bp-fade-soft' : undefined} style={show ? { animationDelay: '320ms' } : undefined}>
          {oars.map((o, i) => (
            <g key={i} className={show ? o.cls : undefined} style={{ transformOrigin: '100% 0%' }}>
              <line x1={o.px} y1={o.py} x2={o.bx} y2={o.by} stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
              <ellipse cx={o.bx} cy={o.by} rx="3" ry="5.2" fill="var(--bp-paper)" stroke="currentColor" strokeWidth="0.9" transform={`rotate(30 ${o.bx} ${o.by})`} />
            </g>
          ))}
        </g>

        {/* rower silhouettes leaning to the stroke */}
        <g className={show ? 'bp-fade-soft' : undefined} style={show ? { animationDelay: '360ms' } : undefined}>
          {rowers.map((r, i) => (
            <g key={i}>
              <path d={`M ${r.x} ${r.y} q -7 -2 -10 -10`} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.8" />
              <circle cx={r.x - 11} cy={r.y - 12} r="2.6" fill="var(--bp-paper)" stroke="currentColor" strokeWidth="1.1" />
            </g>
          ))}
        </g>

        {/* the hull */}
        <path d="M 28 106 L 192 106 L 178 124 Q 150 134 110 134 Q 70 134 48 124 Z" fill="var(--bp-paper)" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
        <path d="M 36 113 Q 110 119 184 113" fill="none" stroke="currentColor" strokeWidth="0.5" opacity="0.45" />
        <line x1="32" y1="106" x2="188" y2="106" stroke="currentColor" strokeWidth="0.7" opacity="0.55" />
        {oars.map((o) => <line key={o.px} x1={o.px} y1="102" x2={o.px} y2="106" stroke="currentColor" strokeWidth="0.9" />)}

        {/* bow stem + pennant (left) */}
        <line x1="33" y1="106" x2="26" y2="92" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        <path d="M 26 92 l 14 3 l -10 4 Z" fill="currentColor" opacity="0.7" />

        {/* the tiller, held level (the helm never seized) — stern, right */}
        <line x1="186" y1="106" x2="204" y2="98" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
        <circle cx="205" cy="97" r="3.4" fill="var(--bp-paper)" stroke="currentColor" strokeWidth="1.1" />
        <line x1="192" y1="95" x2="203" y2="92" stroke="currentColor" strokeWidth="0.5" strokeDasharray="1.5 2.5" opacity="0.6" />
      </g>
    </svg>
  );
}

/* ══════════════════════ 닿기 / LAND ══════════════════════ */
export function LandGlyph({ show, className }: GlyphProps) {
  return (
    <svg viewBox="0 0 220 160" className={className} style={{ ...INK, width: '100%', height: '100%', display: 'block' }}
      role="img" aria-label="The cove at settlement: an anchor biting the seabed below a lighthouse shore, carrying a wax seal">
      {/* ── sky: two seabirds ── */}
      <g className={show ? 'bp-fade-soft' : undefined} style={show ? { animationDelay: '40ms' } : { opacity: 0 }} opacity="0.45">
        <path d="M 40 22 q 5 -4 10 0 q 5 -4 10 0" fill="none" stroke="currentColor" strokeWidth="0.7" />
        <path d="M 58 14 q 4 -3 8 0 q 4 -3 8 0" fill="none" stroke="currentColor" strokeWidth="0.6" />
      </g>

      {/* ── distant shore (Ithaca) + lighthouse with a beam ── */}
      <g className={show ? 'bp-fade-soft' : undefined} style={show ? { animationDelay: '90ms' } : { opacity: 0 }}>
        <path d="M 146 44 L 162 36 L 178 27 L 196 33 L 216 44" fill="none" stroke="currentColor" strokeWidth="0.7" opacity="0.5" />
        <path d="M 146 44 L 162 36 L 178 27 L 196 33 L 216 44 L 216 50 L 146 50 Z" fill="currentColor" opacity="0.06" />
        {/* lighthouse */}
        <path d="M 176 27 l 1 -11 l 4 0 l 1 11 Z" fill="var(--bp-paper)" stroke="currentColor" strokeWidth="0.8" />
        <rect x="177.5" y="13" width="3" height="3" fill="none" stroke="currentColor" strokeWidth="0.6" />
        {/* beam */}
        <path d="M 181 14 l 16 -5 M 181 16 l 16 2" fill="none" stroke="currentColor" strokeWidth="0.5" opacity="0.4" strokeDasharray="1.5 2" />
        {/* horizon = reality */}
        <line x1="6" y1="50" x2="214" y2="50" stroke="currentColor" strokeWidth="0.5" opacity="0.3" />
      </g>

      {/* ── layered seabed with a couple of rocks ── */}
      <g className={show ? 'bp-fade-soft' : undefined} style={show ? { animationDelay: '130ms' } : { opacity: 0 }}>
        <path d="M 6 142 Q 60 135 110 142 T 214 142" fill="none" stroke="currentColor" strokeWidth="0.8" opacity="0.5" />
        <path d="M 6 150 Q 70 144 120 150 T 214 148" fill="none" stroke="currentColor" strokeWidth="0.6" opacity="0.3" />
        <path d="M 6 142 Q 60 135 110 142 T 214 142 L 214 158 L 6 158 Z" fill="currentColor" opacity="0.05" />
        <path d="M 40 142 q 4 -6 9 0 Z" fill="currentColor" opacity="0.12" />
        <path d="M 168 142 q 5 -7 11 0 Z" fill="currentColor" opacity="0.12" />
      </g>

      {/* ── the anchor: drops on reveal, then sways on its chain ── */}
      <g className={show ? 'bp-anchor-drop' : undefined} style={show ? { animationDelay: '320ms' } : { opacity: 0 }}>
        <g className={show ? 'bp-sway' : undefined} style={{ transformOrigin: '50% 4%' }}>
          {[10, 20, 30].map((y, i) => <ellipse key={y} cx="110" cy={y} rx="3" ry="4.4" fill="none" stroke="currentColor" strokeWidth="1.1" opacity={0.45 + i * 0.15} />)}
          <circle cx="110" cy="44" r="6" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <line x1="110" y1="50" x2="110" y2="122" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" />
          <line x1="91" y1="60" x2="129" y2="60" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
          <line x1="127" y1="56" x2="127" y2="64" stroke="currentColor" strokeWidth="1.2" />
          <path d="M 110 122 Q 85 122 83 98" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" />
          <path d="M 110 122 Q 135 122 137 98" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" />
          <path d="M 83 98 l -6 8 l 12 -1 Z" fill="currentColor" stroke="currentColor" strokeWidth="0.8" strokeLinejoin="round" />
          <path d="M 137 98 l 6 8 l -12 -1 Z" fill="currentColor" stroke="currentColor" strokeWidth="0.8" strokeLinejoin="round" />
          <WaxSeal cx={110} cy={86} r={10.5} show={show} delay={820} />
        </g>
      </g>

      {/* ── impact ripples where the crown meets the bed ── */}
      <g className={show ? 'bp-ripple-out' : undefined} style={show ? { animationDelay: '760ms' } : { opacity: 0 }}>
        <path d="M 86 134 Q 110 128 134 134" fill="none" stroke="currentColor" strokeWidth="0.7" opacity="0.5" />
        <path d="M 78 140 Q 110 132 142 140" fill="none" stroke="currentColor" strokeWidth="0.6" opacity="0.3" />
      </g>
    </svg>
  );
}
