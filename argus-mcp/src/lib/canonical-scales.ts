/**
 * Canonical scales & units — the pre-rule normalization layer for M2 drift
 * materiality (internal design notes §3, §10.4).
 *
 * Rules compare CANONICAL values, never raw labels. This module turns an ordinal
 * label ("BBB", "Baa2", "Enterprise", "Maintenance") into a comparable number via
 * a built-in ordinal map, and converts a few units into a common axis before the
 * rule ever runs. When a label can't be placed on a known scale, this returns
 * `null` — the caller routes that to `uncertain` (host-judgment lane), never a
 * silent guess (§3.1, "규칙이 아니라 매번 모델 판정 = 스파인 위반").
 *
 * Alias normalization is the load-bearing win: Baa2 ≡ BBB, so a Moody's→S&P
 * relabel is `unchanged`, not a manufactured downgrade (CAT-06).
 */

/** A single ordinal scale: label (or alias) → rank. Lower rank = "higher"/better
 *  by convention where that matters, but the rule only cares about the DELTA in
 *  ranks (step N), so direction is left to the premise's modifier. */
export interface OrdinalScale {
  /** Human name, used in messages. */
  name: string;
  /** Canonical label → integer rank. Aliases point to the same rank as their canon. */
  ranks: Record<string, number>;
  /** Optional label normalizer (case/spacing) applied before lookup. */
  kind: 'credit' | 'lts' | 'tier' | 'quality' | 'custom';
}

/** Normalize a label for lookup: trim, collapse spaces, lowercase. Ordinal maps
 *  are keyed by this normalized form so "BBB ", "bbb", "BBB" all hit. */
function normLabel(label: string): string {
  return label.trim().toLowerCase().replace(/\s+/g, ' ');
}

// ── S&P / Moody's credit ratings (AAA=1 … D=22), with cross-agency aliases ──
// The canonical axis is S&P notation; Moody's labels are aliases onto the same
// rank so Baa2 ≡ BBB (CAT-06), A2 ≡ A, Ba1 ≡ BB+, etc.
const SP_ORDER = [
  'AAA', 'AA+', 'AA', 'AA-', 'A+', 'A', 'A-', 'BBB+', 'BBB', 'BBB-',
  'BB+', 'BB', 'BB-', 'B+', 'B', 'B-', 'CCC+', 'CCC', 'CCC-', 'CC', 'C', 'D',
];
// Moody's, index-aligned to SP_ORDER above.
const MOODYS_ORDER = [
  'Aaa', 'Aa1', 'Aa2', 'Aa3', 'A1', 'A2', 'A3', 'Baa1', 'Baa2', 'Baa3',
  'Ba1', 'Ba2', 'Ba3', 'B1', 'B2', 'B3', 'Caa1', 'Caa2', 'Caa3', 'Ca', 'C', 'DDD',
];

function buildCreditRanks(): Record<string, number> {
  const r: Record<string, number> = {};
  SP_ORDER.forEach((lbl, i) => {
    r[normLabel(lbl)] = i + 1;
    const m = MOODYS_ORDER[i];
    if (m) r[normLabel(m)] = i + 1; // alias onto the same rank
  });
  return r;
}

// ── LTS / lifecycle stages (Active=1 … EOL highest) ──
const LTS_ORDER = ['Active', 'Maintenance', 'Security', 'Deprecated', 'EOL'];

// ── Product tiers (Free=1 … Enterprise highest) ──
const TIER_ORDER = ['Free', 'Trial', 'Starter', 'Pro', 'Business', 'Team', 'Enterprise'];

// ── Generic quality letter grades (A=1 … F) ──
const QUALITY_ORDER = ['A', 'B', 'C', 'D', 'E', 'F'];

function buildOrdinal(order: string[]): Record<string, number> {
  const r: Record<string, number> = {};
  order.forEach((lbl, i) => { r[normLabel(lbl)] = i + 1; });
  return r;
}

/** Built-in scales, addressable by name from a premise's `scale` modifier. */
export const BUILTIN_SCALES: Record<string, OrdinalScale> = {
  sp_credit: { name: 'S&P/Moody\'s credit rating', kind: 'credit', ranks: buildCreditRanks() },
  lts: { name: 'lifecycle stage', kind: 'lts', ranks: buildOrdinal(LTS_ORDER) },
  tier: { name: 'product tier', kind: 'tier', ranks: buildOrdinal(TIER_ORDER) },
  quality: { name: 'quality grade', kind: 'quality', ranks: buildOrdinal(QUALITY_ORDER) },
};

/**
 * Map a label onto a named scale's ordinal rank. Returns null when the scale is
 * unknown OR the label isn't on it — the caller routes null to `uncertain`
 * (host-judgment lane), never a silent numeric guess (§3.1).
 *
 * A custom scale (user-provided ordered labels) can be passed inline via
 * `customScales` so a premise isn't limited to the built-ins.
 */
export function normalizeLabel(
  scale: string | undefined,
  label: string,
  customScales?: Record<string, OrdinalScale | string[]>,
): number | null {
  if (!scale) return null;
  const custom = customScales?.[scale];
  if (custom) {
    const ranks = Array.isArray(custom) ? buildOrdinal(custom) : custom.ranks;
    const hit = ranks[normLabel(label)];
    return typeof hit === 'number' ? hit : null;
  }
  const builtin = BUILTIN_SCALES[scale];
  if (!builtin) return null;
  const hit = builtin.ranks[normLabel(label)];
  return typeof hit === 'number' ? hit : null;
}

// ── unit canonicalization (§3.2) ──────────────────────────────────────────
// A tiny table for the units the corpus actually collides on. Anything not
// covered returns null → caller keeps the value in the host_reported lane
// rather than inventing a conversion (§3.2 "억지 계산 금지").

/** Known unit conversions to a canonical base. Value is a linear factor OR a
 *  function for non-linear axes (mpg↔L/100km is reciprocal). */
type UnitConv = { to: string; convert: (v: number) => number };

const UNIT_TABLE: Record<string, UnitConv> = {
  // temperature: Kelvin ↔ Celsius (offset). Canonical = Celsius for delta axes.
  k: { to: 'c', convert: (v) => v - 273.15 },
  kelvin: { to: 'c', convert: (v) => v - 273.15 },
  // fuel economy: mpg (US) → L/100km (reciprocal). Canonical = L/100km.
  mpg: { to: 'l/100km', convert: (v) => (v === 0 ? Infinity : 235.215 / v) },
  // percentage points and percent share a numeric magnitude; the AXIS (not the
  // unit) disambiguates — handled by unit_axis, not here.
};

/**
 * Convert a value from a source unit to its canonical unit. Returns null when the
 * unit is unknown (caller keeps host_reported + low_confidence). When from===to
 * or from is already canonical, returns the value unchanged.
 */
export function normalizeUnit(value: number, from: string | undefined): { value: number; unit: string } | null {
  if (!from) return null;
  const key = from.trim().toLowerCase();
  const conv = UNIT_TABLE[key];
  if (!conv) return { value, unit: key }; // unknown but not an error — pass through as-is unit-tagged
  return { value: conv.convert(value), unit: conv.to };
}
