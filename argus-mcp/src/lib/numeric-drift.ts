/**
 * Numeric premise drift — the only MECHANICAL drift decision (plan v5 §7.1),
 * now the 3-valued MATERIALITY engine (internal design notes §2, §4, §10).
 *
 * Deliberately takes explicit numbers / labelled ordinals, never parses them out
 * of prose: the webapp's regex-first-number approach reads "2026년 기준금리 3.5%"
 * as 2026 and manufactures fake drift. The HOST names the number; this compares.
 *
 * Text premises are NOT decided here — a paraphrase is not a changed fact, so
 * string comparison over-fires. For text, the host asserts `changed` as a
 * research finding (provenance-armed, recorded verbatim; see argus_recheck).
 *
 * The spine invariant (M2 §0, §9): this decides ONLY "did the fact materially
 * change?" — never "should you revisit?". The default is UNDER-fire: when a rule
 * isn't declared and the heuristic is unsure, the answer is silence + an honest
 * "define a rule to be more precise" notice, NOT a manufactured alert.
 */

import { normalizeLabel, normalizeUnit, type OrdinalScale } from './canonical-scales.js';

/** Relative move (fraction) below which a scale-free numeric change is noise. */
export const NUMERIC_DRIFT_THRESHOLD = 0.1;
/** Alias kept for M2 spec vocabulary (§2 REL_DEFAULT). */
export const REL_DEFAULT = NUMERIC_DRIFT_THRESHOLD;
/** Resolution significance multiplier — a move must clear resolution×SIG_MULT. */
export const SIG_MULT = 2;
/** near-zero relative multiplier: below safety_floor absence, a ≥2× move fires. */
export const BIG_MULT = 2.0;
/** knife-edge smoothing band around the relative threshold → uncertain. */
export const EPS = 0.01;

export type Materiality = 'material' | 'uncertain' | 'unchanged';

export interface MaterialityResult {
  status: Materiality;
  reason: string;
  /** Heuristic / boundary / axis-undefined → drives the honest low-confidence notice. */
  low_confidence?: boolean;
}

// ── premise value & rule types (M2 §10.1, §10.2) ────────────────────────────

/** A premise's compared value: an explicit number, or an ordinal/nominal label. */
export type PremiseValue = number | { label: string };

export type UnitAxis = 'absolute' | 'ratio' | 'percentage_point' | 'complement';
export type RuleType = 'threshold' | 'step' | 'delta' | 'relative' | 'band' | 'map' | 'stateful';

export interface RuleModifiers {
  direction?: 'harmful_only' | 'either' | 'sign_flip';
  /** Which direction is "harmful" for direction=harmful_only: does the value going
   *  UP hurt, or DOWN? Defaults to 'up' (larger = worse) when unspecified. */
  harmful_dir?: 'up' | 'down';
  unit_axis?: UnitAxis;
  boundary?: 'inclusive' | 'exclusive';
  scale?: string; // ordinal / nominal-set name
  resolution?: number;
  zero_meaningful?: boolean;
  safety_floor?: number;
  /** near-zero cutoff override (else derived from resolution). */
  near_zero_cut?: number;
}

export interface MaterialityRule {
  type: RuleType;
  params: Record<string, number | string | string[]>;
  modifiers?: RuleModifiers;
}

export interface MaterialityCtx {
  resolution?: number;
  unit_axis?: UnitAxis;
  unit_from?: string;
  /** inline custom ordinal scales, addressable by the rule/modifier `scale` name. */
  customScales?: Record<string, OrdinalScale | string[]>;
}

// ── back-compat surface (existing callers / tests) ──────────────────────────

export interface NumericDrift {
  drifted: boolean;
  reason: string;
}

/**
 * Legacy 2-valued shim: `material` → drifted, else not. Preserved so callers that
 * still want a boolean don't break; the wiring in recheck.ts uses the 3-valued
 * evaluateMateriality directly.
 */
export function numericDrift(prev: number, next: number): NumericDrift {
  const r = evaluateMateriality(prev, next);
  return { drifted: r.status === 'material', reason: r.reason };
}

// ── helpers ─────────────────────────────────────────────────────────────────

function asNumber(v: PremiseValue): number | null {
  return typeof v === 'number' ? (Number.isFinite(v) ? v : null) : null;
}

/** Infer measurement resolution from the decimal places present in the two
 *  values — 0.01% → 1bp granularity, one-decimal kg → 0.1, integers → 1. */
function inferResolution(prev: number, next: number): number {
  const decimals = (n: number): number => {
    if (!Number.isFinite(n)) return 0;
    const s = Math.abs(n).toString();
    const dot = s.indexOf('.');
    if (dot < 0) return 0;
    return s.length - dot - 1;
  };
  const d = Math.max(decimals(prev), decimals(next));
  if (d === 0) return 1;
  return Math.pow(10, -d);
}

function inferAxis(prev: number, next: number, mod: RuleModifiers | undefined): UnitAxis {
  if (mod?.unit_axis) return mod.unit_axis;
  // values in [0,1] look like probabilities/ratios; explicit %p/bp handled by caller.
  const inUnit = Math.abs(prev) <= 1 && Math.abs(next) <= 1;
  if (inUnit) return 'ratio';
  // near-ceiling percentages (>95 & ≤100) are complement-ambiguous — "99.9% vs
  // 99.5%" reads tiny on the success axis but is a doubling on the failure axis.
  // Treat as ratio so the engine asks for the axis instead of silently deciding (§2).
  const nearCeil = (v: number) => v >= 90 && v <= 100;
  if (nearCeil(prev) && nearCeil(next)) return 'ratio';
  return 'absolute';
}

function nearZeroCut(prev: number, mod: RuleModifiers | undefined, resolution: number): number {
  if (typeof mod?.near_zero_cut === 'number') return mod.near_zero_cut;
  // "near zero" = within a few resolution units of zero.
  return resolution * 10;
}

// ── the engine (M2 §2 pseudocode, exactly) ─────────────────────────────────

/**
 * Evaluate whether a premise's fact materially changed. 3-valued:
 *   material   — a declared rule (or the under-fire heuristic) says it changed
 *   uncertain  — depends / boundary / rule-uncovered / axis-undefined → SILENT
 *                (no auto-handle; the user calls the handle, not the tool)
 *   unchanged  — no change, or below noise/resolution → quiet
 *
 * `rule` (optional) is the premise-declared MaterialityRule. Absent → the §2
 * default heuristic, which errs toward silence.
 */
export function evaluateMateriality(
  prev: PremiseValue,
  next: PremiseValue,
  rule?: MaterialityRule,
  ctx?: MaterialityCtx,
): MaterialityResult {
  const mod: RuleModifiers | undefined = rule?.modifiers;
  const scale = mod?.scale;

  // ── 0. normalization first (§3): labels → ordinal, units → canonical ──
  let pv: number | null;
  let nv: number | null;
  const prevIsLabel = typeof prev === 'object';
  const nextIsLabel = typeof next === 'object';

  if (prevIsLabel || nextIsLabel) {
    // both must resolve on a scale, else uncertain (host-judgment lane)
    const pl = prevIsLabel ? (prev as { label: string }).label : String(prev);
    const nl = nextIsLabel ? (next as { label: string }).label : String(next);
    if (rule?.type === 'map') {
      return evaluateMap(pl, nl, rule);
    }
    pv = normalizeLabel(scale, pl, ctx?.customScales);
    nv = normalizeLabel(scale, nl, ctx?.customScales);
    if (pv === null || nv === null) {
      // alias/normalization may still make them equal as strings (§3.1 tail)
      if (normStr(pl) === normStr(nl)) return { status: 'unchanged', reason: '라벨 동일 (정규화 후)' };
      return {
        status: 'uncertain',
        reason: '비수치/미정규 라벨 — canonical scale를 지정하면 기계 판정 가능 (host 판정 레인)',
        low_confidence: true,
      };
    }
  } else {
    pv = asNumber(prev);
    nv = asNumber(next);
    if (pv === null || nv === null) {
      return { status: 'unchanged', reason: 'non-finite input — not comparable' };
    }
    // unit canonicalization before comparing (§3.2)
    if (ctx?.unit_from) {
      const cp = normalizeUnit(pv, ctx.unit_from);
      const cn = normalizeUnit(nv, ctx.unit_from);
      if (cp && cn) { pv = cp.value; nv = cn.value; }
    }
  }

  if (pv === nv) {
    return { status: 'unchanged', reason: '변화 없음' };
  }

  // ── explicit declared rule beats the heuristic (§6.2) ──
  if (rule) {
    const declared = evaluateDeclaredRule(pv, nv, rule, ctx);
    if (declared) return declared;
  }

  // ── default heuristic (§2) ──
  const resolution = mod?.resolution ?? ctx?.resolution ?? inferResolution(pv, nv);

  // 1. measurement-resolution gate
  if (Math.abs(nv - pv) < resolution * SIG_MULT) {
    return { status: 'unchanged', reason: `해상도 이하 이동 (< ${resolution * SIG_MULT})` };
  }

  // 2. unit-axis branch
  const axis = inferAxis(pv, nv, mod);

  // 3. sign flip: dead-band AND, never "always material"
  const signFlip = Math.sign(pv) !== Math.sign(nv) && pv !== 0 && nv !== 0;
  if (signFlip) {
    const floor = mod?.safety_floor ?? 0;
    if (Math.abs(pv) >= floor && Math.abs(nv) >= floor) {
      if (mod?.zero_meaningful === true) {
        return { status: 'material', reason: `부호 전환: ${pv} → ${nv}` };
      }
      return {
        status: 'uncertain',
        reason: '부호 전환이나 0의 의미(zero_meaningful) 미선언 — 규칙을 정해주세요',
        low_confidence: true,
      };
    }
    return { status: 'unchanged', reason: 'dead-band 안 왕복 = 노이즈' };
  }

  // 4. magnitude by axis
  if (axis === 'ratio') {
    return {
      status: 'uncertain',
      reason: '값이 비율(%)입니다 — %p(퍼센트포인트)로 볼지 여집합(100−값) 축으로 볼지 정해주세요',
      low_confidence: true,
    };
  }
  if (axis === 'percentage_point') {
    const D = numParam(mod?.resolution, resolution) * SIG_MULT;
    return Math.abs(nv - pv) >= D
      ? { status: 'material', reason: `${(nv - pv).toFixed(2)}%p 이동: ${pv} → ${nv}` }
      : { status: 'unchanged', reason: '%p 이동이 해상도 이하' };
  }

  // axis === 'absolute'
  // 4a. near-zero: relative-explosion vs real signal (both-edged)
  if (isNearZero(pv, mod, resolution)) {
    const rel = Math.abs(nv - pv) / Math.max(Math.abs(pv), resolution);
    if (typeof mod?.safety_floor === 'number') {
      return Math.abs(nv - pv) >= mod.safety_floor
        ? { status: 'material', reason: `안전기준 이상 이동: ${pv} → ${nv}` }
        : { status: 'unchanged', reason: `안전기준 대비 작은 이동: ${pv} → ${nv}` };
    }
    return rel >= BIG_MULT
      ? { status: 'material', reason: `near-zero ${rel.toFixed(1)}배 이동: ${pv} → ${nv}` }
      : { status: 'uncertain', reason: 'near-zero 애매 — 규칙(delta/safety_floor)을 정해주세요', low_confidence: true };
  }

  // 4b/4c. general scale-free: knife-edge FIRST (exactly-at-threshold is the
  // >= vs > hostage case → uncertain, §8 PCT-08/DATE-09), then relative.
  const rel = Math.abs(nv - pv) / Math.abs(pv);
  const P = REL_DEFAULT;
  if (Math.abs(rel - P) <= EPS) {
    return { status: 'uncertain', reason: `상대변화가 임계 경계에 걸침 (${Math.round(rel * 100)}%) — 규칙/밴드를 정해주세요`, low_confidence: true };
  }
  if (rel >= P) {
    return { status: 'material', reason: `${Math.round(rel * 100)}% 이동: ${pv} → ${nv}` };
  }
  return { status: 'unchanged', reason: `${Math.round(rel * 100)}% 이동 (<${Math.round(P * 100)}% 임계)` };
}

// ── declared-rule evaluation (§1, §6) ───────────────────────────────────────

function evaluateDeclaredRule(
  pv: number,
  nv: number,
  rule: MaterialityRule,
  ctx: MaterialityCtx | undefined,
): MaterialityResult | null {
  const mod = rule.modifiers;
  const resolution = mod?.resolution ?? ctx?.resolution ?? inferResolution(pv, nv);

  // axis gate (§6.3): a value declared as a raw ratio/% cannot take a naked
  // relative or delta move — the author must pick %p or a complement axis. Until
  // then it's uncertain, never a manufactured alert. (threshold/band/step/map
  // are axis-agnostic — a crossed line is a crossed line.)
  if (mod?.unit_axis === 'ratio' && (rule.type === 'relative' || rule.type === 'delta')) {
    return { status: 'uncertain', reason: '값이 비율(%)입니다 — %p(퍼센트포인트)로 볼지 여집합(100−값) 축으로 볼지 정해주세요', low_confidence: true };
  }

  // sign-flip modifier (§2.3 / §6.5): dead-band AND, never "always material".
  // A declared sign_flip is decided here (not by the raw delta/relative magnitude).
  if (mod?.direction === 'sign_flip') {
    const signFlip = Math.sign(pv) !== Math.sign(nv) && pv !== 0 && nv !== 0;
    if (!signFlip) return { status: 'unchanged', reason: `부호 유지: ${pv} → ${nv}` };
    const floor = mod.safety_floor ?? 0;
    if (Math.abs(pv) >= floor && Math.abs(nv) >= floor) {
      return mod.zero_meaningful === true
        ? { status: 'material', reason: `부호 전환: ${pv} → ${nv}` }
        : { status: 'uncertain', reason: '부호 전환이나 0의 의미(zero_meaningful) 미선언 — 규칙을 정해주세요', low_confidence: true };
    }
    return { status: 'unchanged', reason: 'dead-band 안 왕복 = 노이즈' };
  }

  // direction gate (harmful_only): a beneficial move is unchanged (§6.5)
  const dirGate = (material: MaterialityResult): MaterialityResult => {
    if (mod?.direction === 'harmful_only') {
      const wentUp = nv > pv;
      const harmfulUp = (mod.harmful_dir ?? 'up') === 'up';
      const harmful = harmfulUp ? wentUp : !wentUp;
      if (!harmful) return { status: 'unchanged', reason: `유익한 방향 이동 (harmful_only): ${pv} → ${nv}` };
    }
    return material;
  };

  switch (rule.type) {
    case 'threshold': {
      const line = numParam(rule.params['line'], NaN);
      if (!Number.isFinite(line)) return null;
      const direction = String(rule.params['direction'] ?? 'cross');
      const boundary = mod?.boundary ?? (rule.params['boundary'] as string | undefined);
      if (!boundary && direction !== 'cross') {
        // boundary undefined and it matters near the line → uncertain (§1.4)
        const atLine = pv === line || nv === line;
        if (atLine) return { status: 'uncertain', reason: 'threshold 경계 도달인데 boundary(inclusive/exclusive) 미지정 — 정해주세요', low_confidence: true };
      }
      const incl = boundary === 'inclusive';
      const crossed = (() => {
        if (direction === 'above') return incl ? nv >= line && pv < line : nv > line && pv <= line;
        if (direction === 'below') return incl ? nv <= line && pv > line : nv < line && pv >= line;
        // cross: either side
        return Math.sign(pv - line) !== Math.sign(nv - line) && pv !== nv;
      })();
      return crossed
        ? dirGate({ status: 'material', reason: `임계선 ${line} ${direction} 교차: ${pv} → ${nv}` })
        : { status: 'unchanged', reason: `임계선 ${line} 미교차: ${pv} → ${nv}` };
    }

    case 'step': {
      const S = numParam(rule.params['S'], NaN);
      const N = numParam(rule.params['N'], 1);
      if (!Number.isFinite(S) || S <= 0) return null;
      // ordinal-scale step compares ranks (already normalized to numbers upstream).
      const notches = Math.abs(nv - pv) / S;
      // step size must sit above resolution (§3.3) — else fall to heuristic.
      if (S < resolution) return null;
      return notches >= N - 1e-9
        ? dirGate({ status: 'material', reason: `${Math.round(notches)}칸 이동 (step ${S}, N≥${N}): ${pv} → ${nv}` })
        : { status: 'unchanged', reason: `${notches.toFixed(2)}칸 (< N=${N}): ${pv} → ${nv}` };
    }

    case 'delta': {
      const D = numParam(rule.params['D'], NaN);
      if (!Number.isFinite(D) || D <= 0) return null;
      return Math.abs(nv - pv) >= D
        ? dirGate({ status: 'material', reason: `Δ ${Math.abs(nv - pv)} ≥ ${D}: ${pv} → ${nv}` })
        : { status: 'unchanged', reason: `Δ ${Math.abs(nv - pv)} < ${D}: ${pv} → ${nv}` };
    }

    case 'relative': {
      const P = numParam(rule.params['P'], REL_DEFAULT);
      if (pv === 0) return { status: 'uncertain', reason: 'relative 기준값 0 — delta 규칙이 필요합니다', low_confidence: true };
      const rel = Math.abs(nv - pv) / Math.abs(pv);
      if (Math.abs(rel - P) <= EPS) {
        return { status: 'uncertain', reason: `상대변화가 임계 경계에 걸침 (${Math.round(rel * 100)}%) — 규칙/밴드를 정해주세요`, low_confidence: true };
      }
      return rel >= P
        ? dirGate({ status: 'material', reason: `${Math.round(rel * 100)}% 이동: ${pv} → ${nv}` })
        : { status: 'unchanged', reason: `${Math.round(rel * 100)}% 이동 (<${Math.round(P * 100)}%)` };
    }

    case 'band': {
      const lo = numParam(rule.params['lo'], NaN);
      const hi = numParam(rule.params['hi'], NaN);
      if (!Number.isFinite(lo) || !Number.isFinite(hi)) return null;
      const incl = (mod?.boundary ?? rule.params['boundary']) === 'inclusive';
      const outside = incl ? nv < lo || nv > hi : nv <= lo || nv >= hi;
      const wasInside = incl ? pv >= lo && pv <= hi : pv > lo && pv < hi;
      return outside && wasInside
        ? { status: 'material', reason: `밴드 [${lo}, ${hi}] 이탈: ${pv} → ${nv}` }
        : { status: 'unchanged', reason: `밴드 [${lo}, ${hi}] 내: ${pv} → ${nv}` };
    }

    case 'stateful':
      // v1: opt-in only, and this numeric path sees just two snapshots — it cannot
      // observe a window. Honest: surface as uncertain (path/volatility not decidable
      // from prev→next alone), never fabricate a peak/crossing verdict (§1.3, §10.5).
      return { status: 'uncertain', reason: 'stateful(경로/변동성)은 두 스냅샷으로 판정 불가 — 관측 이력이 필요합니다', low_confidence: true };

    case 'map':
      // handled in the label path; a numeric map here means mis-typed rule.
      return { status: 'uncertain', reason: 'map 규칙은 라벨 값에만 적용됩니다', low_confidence: true };

    default:
      return null;
  }
}

/** map rule: entry into a pre-registered material-state set = material; a state
 *  not in the set (and not equal) = uncertain (host-judgment, §5). */
function evaluateMap(prevLabel: string, nextLabel: string, rule: MaterialityRule): MaterialityResult {
  if (normStr(prevLabel) === normStr(nextLabel)) {
    return { status: 'unchanged', reason: '상태 동일' };
  }
  const raw = rule.params['material_states'];
  const set = Array.isArray(raw) ? raw.map((s) => normStr(String(s))) : [];
  if (set.includes(normStr(nextLabel))) {
    return { status: 'material', reason: `material 상태 진입: ${prevLabel} → ${nextLabel}` };
  }
  return {
    status: 'uncertain',
    reason: `상태 전이이나 등록된 material 상태집합 밖: ${prevLabel} → ${nextLabel} — 규칙 정할지 당신 몫`,
    low_confidence: true,
  };
}

// ── small utils ─────────────────────────────────────────────────────────────

function normStr(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, ' ');
}

function numParam(v: unknown, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
}

function isNearZero(prev: number, mod: RuleModifiers | undefined, resolution: number): boolean {
  return Math.abs(prev) < nearZeroCut(prev, mod, resolution);
}
