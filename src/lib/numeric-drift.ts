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

import { normalizeLabel, normalizeUnit, type OrdinalScale } from './canonical-scales';

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
        reason: '비수치/미정규 라벨. canonical scale를 지정하면 기계 판정 가능 (host 판정 레인)',
        low_confidence: true,
      };
    }
  } else {
    pv = asNumber(prev);
    nv = asNumber(next);
    if (pv === null || nv === null) {
      return { status: 'unchanged', reason: 'non-finite input; not comparable' };
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
        reason: '부호 전환이나 0의 의미(zero_meaningful) 미선언. 규칙을 정해주세요',
        low_confidence: true,
      };
    }
    return { status: 'unchanged', reason: 'dead-band 안 왕복 = 노이즈' };
  }

  // 4. magnitude by axis
  if (axis === 'ratio') {
    return {
      status: 'uncertain',
      reason: '값이 비율(%)입니다. %p(퍼센트포인트)로 볼지 여집합(100−값) 축으로 볼지 정해주세요',
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
      : { status: 'uncertain', reason: 'near-zero 애매. 규칙(delta/safety_floor)을 정해주세요', low_confidence: true };
  }

  // 4b/4c. general scale-free: knife-edge FIRST (exactly-at-threshold is the
  // >= vs > hostage case → uncertain, §8 PCT-08/DATE-09), then relative.
  const rel = Math.abs(nv - pv) / Math.abs(pv);
  const P = REL_DEFAULT;
  if (Math.abs(rel - P) <= EPS) {
    return { status: 'uncertain', reason: `상대변화가 임계 경계에 걸침 (${Math.round(rel * 100)}%). 규칙/밴드를 정해주세요`, low_confidence: true };
  }
  if (rel >= P) {
    return { status: 'material', reason: `${Math.round(rel * 100)}% 이동: ${pv} → ${nv}` };
  }
  return { status: 'unchanged', reason: `${Math.round(rel * 100)}% 이동 (<${Math.round(P * 100)}% 임계)` };
}

// ── declared-rule evaluation (§1, §6) ───────────────────────────────────────

/** Rule types that cannot decide anything without a parameter. `stateful` is the
 *  only declared type that is meaningful bare (it always answers `uncertain`). */
const NEEDS_PARAMS: ReadonlySet<RuleType> = new Set<RuleType>([
  'threshold', 'step', 'delta', 'relative', 'band', 'map',
]);

function evaluateDeclaredRule(
  pv: number,
  nv: number,
  rule: MaterialityRule,
  ctx: MaterialityCtx | undefined,
): MaterialityResult | null {
  const mod = rule.modifiers;
  const resolution = mod?.resolution ?? ctx?.resolution ?? inferResolution(pv, nv);

  // A declared rule arrives as UNVALIDATED jsonb — written by the MCP host, by an
  // older client, or by hand — and every branch below indexes `rule.params`. When
  // that is absent (`{type:'delta'}`) the index THROWS, and the throw escapes into
  // callers that are not all wrapped: the nightly watcher burns a Brave + LLM call
  // and then loses the premise every single night, and `recheckPremise` in the
  // browser store dies mid-write with no catch anywhere above it. So read params
  // defensively (2026-07-29).
  //
  // But do not paper over it either: a rule whose required parameter is simply
  // MISSING is broken data, not a rule that happens not to apply. Falling through
  // to the heuristic there would let a `material` verdict fire off a threshold the
  // user never actually wrote. `uncertain` is the honest answer — it is silent (no
  // alert) and it carries the reason to the premise screen.
  const params = rule.params && typeof rule.params === 'object' && !Array.isArray(rule.params)
    ? rule.params
    : undefined;
  const unreadable = (what: string): MaterialityResult => ({
    status: 'uncertain',
    reason: `선언된 ${rule.type} 규칙에서 ${what}을(를) 읽을 수 없어요. 규칙을 다시 정해주세요`,
    low_confidence: true,
  });
  if (!params && NEEDS_PARAMS.has(rule.type)) return unreadable('기준값(params)');
  const p: Record<string, number | string | string[]> = params ?? {};

  // axis gate (§6.3): a value declared as a raw ratio/% cannot take a naked
  // relative or delta move — the author must pick %p or a complement axis. Until
  // then it's uncertain, never a manufactured alert. (threshold/band/step/map
  // are axis-agnostic — a crossed line is a crossed line.)
  if (mod?.unit_axis === 'ratio' && (rule.type === 'relative' || rule.type === 'delta')) {
    return { status: 'uncertain', reason: '값이 비율(%)입니다. %p(퍼센트포인트)로 볼지 여집합(100−값) 축으로 볼지 정해주세요', low_confidence: true };
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
        : { status: 'uncertain', reason: '부호 전환이나 0의 의미(zero_meaningful) 미선언. 규칙을 정해주세요', low_confidence: true };
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
      const line = numParam(p['line'], NaN);
      // Declared-but-unreadable is NOT the same as declared-but-inapplicable: falling
      // through to the heuristic here would fire `material` off a threshold the user
      // never wrote. Say so instead (silent, and the reason reaches the premise screen).
      if (!Number.isFinite(line)) return unreadable('임계선(line)');
      const direction = String(p['direction'] ?? 'cross');
      const boundary = mod?.boundary ?? (p['boundary'] as string | undefined);
      if (!boundary && direction !== 'cross') {
        // boundary undefined and it matters near the line → uncertain (§1.4)
        const atLine = pv === line || nv === line;
        if (atLine) return { status: 'uncertain', reason: 'threshold 경계 도달인데 boundary(inclusive/exclusive) 미지정. 정해주세요', low_confidence: true };
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
      const S = numParam(p['S'], NaN);
      const N = numParam(p['N'], 1);
      if (!Number.isFinite(S)) return unreadable('칸 크기(S)');
      // S<=0 is PRESENT but inapplicable — the documented fall-through, kept.
      if (S <= 0) return null;
      // ordinal-scale step compares ranks (already normalized to numbers upstream).
      const notches = Math.abs(nv - pv) / S;
      // step size must sit above resolution (§3.3) — else fall to heuristic.
      if (S < resolution) return null;
      return notches >= N - 1e-9
        ? dirGate({ status: 'material', reason: `${Math.round(notches)}칸 이동 (step ${S}, N≥${N}): ${pv} → ${nv}` })
        : { status: 'unchanged', reason: `${notches.toFixed(2)}칸 (< N=${N}): ${pv} → ${nv}` };
    }

    case 'delta': {
      const D = numParam(p['D'], NaN);
      if (!Number.isFinite(D)) return unreadable('허용 변화폭(D)');
      // D<=0 is PRESENT but inapplicable — the documented fall-through, kept.
      if (D <= 0) return null;
      return Math.abs(nv - pv) >= D
        ? dirGate({ status: 'material', reason: `Δ ${Math.abs(nv - pv)} ≥ ${D}: ${pv} → ${nv}` })
        : { status: 'unchanged', reason: `Δ ${Math.abs(nv - pv)} < ${D}: ${pv} → ${nv}` };
    }

    case 'relative': {
      const P = numParam(p['P'], REL_DEFAULT);
      if (pv === 0) return { status: 'uncertain', reason: 'relative 기준값 0. delta 규칙이 필요합니다', low_confidence: true };
      const rel = Math.abs(nv - pv) / Math.abs(pv);
      if (Math.abs(rel - P) <= EPS) {
        return { status: 'uncertain', reason: `상대변화가 임계 경계에 걸침 (${Math.round(rel * 100)}%). 규칙/밴드를 정해주세요`, low_confidence: true };
      }
      return rel >= P
        ? dirGate({ status: 'material', reason: `${Math.round(rel * 100)}% 이동: ${pv} → ${nv}` })
        : { status: 'unchanged', reason: `${Math.round(rel * 100)}% 이동 (<${Math.round(P * 100)}%)` };
    }

    case 'band': {
      const lo = numParam(p['lo'], NaN);
      const hi = numParam(p['hi'], NaN);
      if (!Number.isFinite(lo) || !Number.isFinite(hi)) return unreadable('밴드 경계(lo/hi)');
      const incl = (mod?.boundary ?? p['boundary']) === 'inclusive';
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
      return { status: 'uncertain', reason: 'stateful(경로/변동성)은 두 스냅샷으로 판정 불가. 관측 이력이 필요합니다', low_confidence: true };

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
  // Same unvalidated-jsonb hazard as evaluateDeclaredRule: this runs on the LABEL
  // path, BEFORE that function, so it needs its own guard or `{type:'map'}` throws.
  const params = rule.params && typeof rule.params === 'object' ? rule.params : undefined;
  if (!params) {
    return {
      status: 'uncertain',
      reason: '선언된 map 규칙에 material 상태집합(params)이 없어 적용할 수 없어요. 규칙을 다시 정해주세요',
      low_confidence: true,
    };
  }
  const raw = params['material_states'];
  const set = Array.isArray(raw) ? raw.map((s) => normStr(String(s))) : [];
  if (set.includes(normStr(nextLabel))) {
    return { status: 'material', reason: `material 상태 진입: ${prevLabel} → ${nextLabel}` };
  }
  return {
    status: 'uncertain',
    reason: `상태 전이이나 등록된 material 상태집합 밖: ${prevLabel} → ${nextLabel}. 규칙 정할지 당신 몫`,
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

// ── 감시 4문답 → 임계·사전믿음 (2026-08-18, 재정초 §6 봉인 시공 PR-A2) ──────
//
// 왜 여기에 사는가. 이 파일은 두 스냅샷(prev, next)만 보고 "이 한 걸음이
// 실질적 변화인가"를 판정한다. 그런데 `stateful` 분기가 스스로 적어둔 대로,
// 경로·변동성은 두 점으로 판정할 수 없고 **관측 이력이 필요하다**. 아래가
// 그 이력 위의 판정(CUSUM, Page 1954)이고, 같은 파일에 두는 이유는 임계가
// 두 판정 사이에서 갈라지면 안 되기 때문이다 — 사용자의 답 하나에서
// 스냅샷 규칙과 계열 사전믿음이 **함께** 유도된다.
//
// 왜 사람에게 네 가지만 묻는가. CUSUM 은 target·slack·decisionInterval 을
// 요구하는데 그건 도구가 아니라 시험지다. 그렇다고 기계가 기본 임계를 몰래
// 정하면 그 순간 이 설계가 거짓말이 된다(임계는 검증 불가능한 사전 믿음이다).
// 그래서 묻는 말을 바꾼다 — 사람이 실제로 아는 것만 묻고, 관례는 상수로
// 이름 붙여 근거 문장에 그대로 남긴다.
//
// 숫자는 **명시 값만** 받는다. 이 파일 머리의 규율 그대로다: 산문에서
// 정규식으로 뽑으면 "2026년 기준금리 3.5%"를 2026 으로 읽어 가짜 drift 를
// 제조한다. 호출자가 숫자를 지목하고, 여기는 비교만 한다.
//
// 출처: `src/lib/cognition/watch.ts`(4문답·거절 규칙)와
// `src/lib/cognition/detect.ts`(CUSUM)의 순수 로직을 이 핀된 쌍으로 옮긴 것.
// 그쪽은 앱 전용 타입에 묶여 있어 byte-사본이 될 수 없다.
//
// 그리고 **이 파일이 그 로직의 정본이다.** 원본은 소비자 0인 라이브러리로,
// 봉인된 §6 결정 ③("엔진 편입 + 화면 철거")이 이리로 오게 한 것 — 이 이전이
// 그 편입의 첫 걸음이다. 두 곳에 파일-대조 핀을 걸지 않는 이유가 여기 있다:
// 핀은 은퇴시키기로 한 파일을 두 번째 권위로 만들고, 그러면 같은 4답이
// 두 임계를 갖는다(이 파일이 막으려는 바로 그 일). 원본의 중복 로직 제거는
// 앱 존 PR 몫이고, 그 전까지 중복 재출현은 능력 중복 검사기가 본다.

/** 여유 k = 탐지하려는 이동폭의 절반. 표준 tabular CUSUM 관례. */
export const SLACK_RATIO = 0.5;
/** 결정 구간 h = 4σ. 관례의 아래끝(4~5σ) — 데이터에서 나온 값이 아니라 고른 값. */
export const DECISION_SIGMA = 4;
/** 계열 판정이 시작되는 최소 판독 수. 그 아래는 "아직 모른다"이지 "괜찮다"가 아니다. */
export const MIN_READINGS = 3;

/** 사람이 답할 수 있는 네 가지 + 어디서 보는지. 숫자는 전부 명시 값. */
export interface WatchAnswers {
  /** 무엇을 보나 ("전환율"). */
  what: string;
  /** 어디서 보나 ("대시보드 A"). */
  where: string;
  /** 평소 값. */
  normal: number;
  /** 평소에도 이만큼은 왔다갔다 한다 (σ). */
  wobble: number;
  /** 이 값이면 전제가 깨진 것. */
  broken: number;
  /** 왜 그 값인가. 근거 없는 임계는 나중에 검토될 수 없다. */
  why: string;
  /** 표시용 단위 ("%", "원"). 판정에는 쓰지 않는다. */
  unit?: string;
}

/**
 * 감시를 만들 수 없는 이유를 **전부** 돌려준다. 하나만 주면 사용자가 한 번에
 * 하나씩 고치며 여러 번 튕긴다.
 *
 * 가장 중요한 거절: **깨진 값이 평소 출렁임 안에 있으면 만들지 않는다.**
 * δ ≤ σ 면 그 임계는 소음과 구별되지 않아 영영 의미 있게 울리지 않거나 아무
 * 때나 운다. 만들어 주면 사용자는 "지켜보는 중"이라 믿지만 실제로는 아무것도
 * 안 지켜진다 — 조용한 실패를 제조하는 셈이다.
 */
export function watchAnswerBlocks(w: WatchAnswers): string[] {
  const out: string[] = [];
  if (!(w.what || '').trim()) out.push('무엇을 볼지 적어주세요.');
  if (!(w.where || '').trim()) out.push('그 숫자를 어디서 보는지 적어주세요.');
  if (!Number.isFinite(w.normal)) out.push('평소 값이 숫자가 아닙니다.');
  if (!Number.isFinite(w.wobble)) out.push('평소 출렁임이 숫자가 아닙니다.');
  if (!Number.isFinite(w.broken)) out.push('깨진 값이 숫자가 아닙니다.');
  if (Number.isFinite(w.wobble) && w.wobble <= 0) {
    out.push('평소 출렁임은 0보다 커야 합니다. 전혀 안 움직이는 숫자는 없습니다.');
  }
  if (Number.isFinite(w.normal) && Number.isFinite(w.broken) && Number.isFinite(w.wobble) && w.wobble > 0) {
    const delta = Math.abs(w.normal - w.broken);
    if (delta === 0) {
      out.push('평소 값과 깨진 값이 같습니다. 이러면 언제 깨진 건지 알 수가 없습니다.');
    } else if (delta <= w.wobble) {
      out.push('깨진 값이 평소 출렁임 안에 있습니다. 이대로 만들면 그냥 흔들린 것과 진짜 깨진 것을 구분할 수 없습니다.');
    }
  }
  if (!(w.why || '').trim()) out.push('왜 그 값이면 깨진 건지 한 줄 적어주세요. 나중에 이 기준을 다시 볼 때 필요합니다.');
  return out;
}

/** CUSUM 사전 믿음. 막힌 게 하나라도 있으면 null — 반쯤 맞는 임계를 만들지 않는다. */
export function deriveCusumPrior(w: WatchAnswers): { target: number; slack: number; decisionInterval: number; rationale: string } | null {
  if (watchAnswerBlocks(w).length > 0) return null;
  const delta = Math.abs(w.normal - w.broken);
  return {
    target: w.normal,
    slack: delta * SLACK_RATIO,
    decisionInterval: w.wobble * DECISION_SIGMA,
    rationale: `${w.why.trim()} (평소 ${w.normal}, 출렁임 ${w.wobble}, ${w.broken}이면 깨진 것.) `
      + `여유 k 는 이동폭의 ${SLACK_RATIO}배, 결정 구간 h 는 출렁임의 ${DECISION_SIGMA}배 (문헌 관례이지 이 데이터에서 나온 값이 아님).`,
  };
}

/**
 * 같은 답에서 스냅샷 규칙도 유도한다 — `broken` 하나가 단일 정본이고,
 * 사람이 읽는 문장·계열 사전믿음·이 규칙이 전부 거기서 나온다. 셋을 따로
 * 저장하면 독립 편집이 가능해지고, 그 순간 조용한 불일치가 시작된다.
 *
 * `direction` 은 사용자의 두 숫자에서 나온다 — `broken` 이 `normal` 아래면
 * 아래로 내려가는 것이 깨지는 것이다. 기본값 `'cross'` 로 두면 안 되는 이유가
 * 있다: `'cross'` 분기는 `boundary` 를 **아예 안 읽는다**(위 threshold 분기의
 * `direction !== 'cross'` 게이트). 그러면 `boundary:'inclusive'` 는 저장은 되고
 * 판정엔 영향이 없는 장식이 되고, 선에 정확히 닿는 값의 운명이 선언이 아니라
 * `Math.sign(0)` 이라는 우연에 걸린다. 방향을 명시해야 경계 선언이 하중을 받는다.
 */
export function deriveMaterialityRule(w: WatchAnswers): MaterialityRule | null {
  if (watchAnswerBlocks(w).length > 0) return null;
  return {
    type: 'threshold',
    params: { line: w.broken, direction: w.broken < w.normal ? 'below' : 'above' },
    modifiers: { boundary: 'inclusive' },
  };
}

/** 계열 판정 결과. `insufficient` 는 "괜찮다"가 아니라 "아직 모른다"이다. */
export interface SeriesVerdict {
  status: 'alert' | 'holds' | 'insufficient';
  /** 사람이 읽는 한 줄. 사실 진술만 — 권고·평가 어휘 금지. */
  statement: string;
  /** 누적합의 최고점. 결정 구간과 비교할 수 있게 함께 준다. */
  statistic: number;
  /** 경보가 처음 성립한 판독 번호 (1부터). 없으면 -1. */
  alert_at_index: number;
  sample: number;
}

/**
 * 누적합 관리도 (Page 1954). 양방향 — 위로 새는 것과 아래로 새는 것을 함께 본다.
 *
 * 한 걸음이 임계를 안 넘어도 **같은 방향으로 조금씩 계속 새면** 누적합이
 * 결정 구간을 넘는다. 이것이 스냅샷 판정(evaluateMateriality)이 원리적으로
 * 못 보는 것이고, `stateful` 분기가 "관측 이력이 필요하다"고 적어둔 자리다.
 */
export function cusumSeries(
  values: readonly number[],
  prior: { target: number; slack: number; decisionInterval: number },
): SeriesVerdict {
  const vs = (values ?? []).filter((v) => Number.isFinite(v));
  if (vs.length < MIN_READINGS) {
    return {
      status: 'insufficient',
      statement: `수치 판독이 ${vs.length}건입니다 (최소 ${MIN_READINGS}건). 아직 판정하지 않습니다. "괜찮다"가 아니라 "아직 모른다"입니다.`,
      statistic: 0,
      alert_at_index: -1,
      sample: vs.length,
    };
  }
  let hi = 0;
  let lo = 0;
  let peak = 0;
  let alarmAt = -1;
  for (let i = 0; i < vs.length; i += 1) {
    const d = vs[i]! - prior.target;
    hi = Math.max(0, hi + d - prior.slack);
    lo = Math.max(0, lo - d - prior.slack);
    const worst = Math.max(hi, lo);
    if (worst > peak) peak = worst;
    if (alarmAt < 0 && worst > prior.decisionInterval) alarmAt = i + 1;
  }
  const stat = Math.round(peak * 1e4) / 1e4;
  return alarmAt > 0
    ? {
        status: 'alert',
        statement: `판독 ${vs.length}건의 누적합이 ${alarmAt}번째에서 결정 구간(${prior.decisionInterval})을 넘었습니다. 최고 ${stat}.`,
        statistic: stat, alert_at_index: alarmAt, sample: vs.length,
      }
    : {
        status: 'holds',
        statement: `판독 ${vs.length}건에서 누적합이 결정 구간(${prior.decisionInterval}) 안에 있습니다. 최고 ${stat}.`,
        statistic: stat, alert_at_index: -1, sample: vs.length,
      };
}
