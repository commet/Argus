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


// ── 감시 문답 → 임계·계열 판정 (2026-08-18, 재정초 §6 봉인 시공 PR-A2) ──────
//
// 왜 여기에 사는가. 이 파일은 두 스냅샷(prev, next)만 보고 "이 한 걸음이
// 실질적 변화인가"를 판정한다. 그런데 `stateful` 분기가 스스로 적어둔 대로,
// 경로·변동성은 두 점으로 판정할 수 없고 **관측 이력이 필요하다**. 아래가
// 그 이력 위의 판정(CUSUM, Page 1954)이고, 같은 파일에 두는 이유는 임계가
// 두 판정 사이에서 갈라지면 안 되기 때문이다.
//
// ── 사람에게 무엇을 묻는가, 그리고 무엇을 묻지 않는가 ──
//
// 첫 판은 여섯을 물었다: 무엇을·어디서·평소 값·평소 출렁임(σ)·깨지는 값·왜.
// 실데이터로 답변가능성을 실측하고 그 절반을 버렸다.
//
//   전체 사용자 작성 텍스트 321건 중 변동성을 언급한 것 **1건**.
//   기록된 전제 579개 중 출렁임 수치를 가진 것 **0개**.
//   `decision_items` 23개 전제 중 numeric_value **0**, materiality_rule **0**.
//   창업자 자신의 실관찰은 n=2, n=3 — σ 가 미기록인 게 아니라 **추정 불가**다.
//
// 즉 σ 를 묻는 것은 이 제품의 어떤 사용자도 낸 적 없는 값을 요구하는 일이고,
// 더 나쁘게는 아래 거절 규칙이 그 답을 요구하는 바람에 **지금까지 기록된 모든
// 전제가 그 질문에서 막혔을 것**이다. 답할 수 없는 것을 물으면 남는 길은
// 둘뿐이다 — 사용자가 지어내거나, 모델이 대신 메우거나. 둘 다 이 제품이
// 금지한 일이다(정직한 공백 > 조작).
//
// 문구를 고쳐 살릴 수도 없었다. "평소에도 이만큼은 왔다갔다 한다"는 최소 넷으로
// 읽힌다 — σ, 반범위, 전체 최고-최저 폭, 판독 간 변화폭. 어느 쪽으로 읽느냐에
// 따라 h=4×답 이 실제로는 4σ 도 되고 15σ 도 되며, 그 사이에서 오경보 간격이
// 열 자릿수 넘게 벌어진다. 확인 못 하는 자기보고에 그만큼 민감한 값을 걸 수 없다.
// (유도 문헌도 같은 말을 한다: 물어야 할 것은 **관측 가능한 양**이지 분포의
// 모수가 아니다. Garthwaite·Kadane·O'Hagan 2005 §2.2.)
//
// 그래서 묻는 것은 넷이다: **무엇을·어디서·이 값이면 깨진 것·왜.**
// 이 넷은 사람이 아는 것이다. 실측에서 가장 좋은 실제 전제도 what 과 broken 은
// 갖고 있었다("2주차 재방문율이 25%를 넘으면").
//
// 평소 값과 출렁임은 **묻지 않고 판독에서 추정한다.** 자기보고보다 데이터가
// 낫기도 하지만, 더 중요하게는 그것이 정직한 순서다 — 기준선은 관측의 산물이지
// 사용자가 선언할 사전 믿음이 아니다. 반대로 **깨지는 값은 반드시 사람이 정한다.**
// 그것은 데이터에서 도출되지 않는 가치 판단이고(P6), 도구가 대신 정하면 숨은
// 기본값이 판단을 대체한다.
//
// 숫자는 **명시 값만** 받는다. 이 파일 머리의 규율 그대로다: 산문에서
// 정규식으로 뽑으면 "2026년 기준금리 3.5%"를 2026 으로 읽어 가짜 drift 를
// 제조한다. 호출자가 숫자를 지목하고, 여기는 비교만 한다.
//
// 출처: `src/lib/cognition/watch.ts`·`detect.ts` 의 순수 로직을 이 핀된 쌍으로
// 옮긴 것. 그리고 **이 파일이 그 로직의 정본이다** — 원본은 소비자 0인
// 라이브러리로, 봉인된 §6 결정 ③("엔진 편입 + 화면 철거")이 이리로 오게 했다.
// 두 곳에 파일-대조 핀을 걸지 않는 이유: 핀은 은퇴시키기로 한 파일을 두 번째
// 권위로 만들고, 그러면 같은 답이 두 임계를 갖는다.

/**
 * 여유 k = 0.5σ. 표준 tabular CUSUM 관례로 "1σ 지속 이동을 탐지한다"는 뜻이다.
 *
 * 처음엔 k 를 `|평소 − 깨짐| / 2` 로 뒀다. 교과서의 "탐지하려는 이동폭의 절반"을
 * 옮긴 것인데, **탐지하려는 이동폭을 임계까지의 거리로 읽은 것이 오독**이었다.
 * 그러면 임계가 멀수록(평소 100·깨짐 50·σ 5 → 10σ) k 가 5σ 로 커져 계열이
 * 귀머거리가 된다. 실측: 100→76 으로 무너지는 계열의 누적합 최고가 **0** 이었다.
 * 임계로 곧장 달려가는 붕괴에 침묵하면서, 한 번 튀고 마는 이상치에는 울렸다.
 *
 * k 는 **잡음 규모**에 건다. 얼마나 큰 이동이 결정에 중요한가(임계까지의 거리)와
 * 얼마나 큰 이동을 잡음에서 구별할 수 있는가(σ)는 다른 질문이고, k 는 후자의
 * 답이다. 전자는 스냅샷 규칙의 선이 맡는다.
 */
export const SLACK_RATIO = 0.5;
/** 결정 구간 h = 4σ. 관례의 아래끝(4~5σ) — 데이터에서 나온 값이 아니라 고른 값.
 *  k=0.5σ·h=4σ 단방향의 오경보 간격(ARL0)은 관례상 판독 ~170건 수준이다. */
export const DECISION_SIGMA = 4;
/**
 * 기준선을 추정하기 위한 최소 판독 수.
 *
 * 교과서(SPC Phase I)는 20~25건을 원한다. 이 제품의 판독 주기에서 그건 몇 년이라
 * 8 로 낮췄고, 낮춘 대가를 숨기지 않는다: 8건이면 이동범위 7개로 σ 를 추정하므로
 * 그 추정 자체가 30% 안팎으로 흔들린다. 그래서 계열 판정은 **보조**이고, 전제가
 * 깨졌는지는 사용자가 정한 선(스냅샷 규칙)이 판독 1건부터 답한다.
 *
 * 이 숫자를 낮추면 판정이 일찍 나오는 게 아니라 **근거 없는 판정이 일찍 나온다.**
 */
export const MIN_BASELINE_READINGS = 8;
/** 이동범위 편향보정 상수 d2 (n=2). 평균이동범위를 쓸 때의 σ̂ = MR̄ / d2. */
export const MR_D2 = 1.128;
/**
 * 이상치에 견디는 σ̂ = 1.047 × median(MR) (Cryer & Ryan). **기본 추정자.**
 *
 * 평균 이동범위를 먼저 썼다가 실측에서 갈아탔다: 한 번 튀고 마는 이상치 하나가
 * 이동범위 둘을 거대하게 만들어 σ̂ 를 3배로 부풀리고, **그 이상치가 스스로를
 * 숨겼다**(SPC 의 masking). 기준선이 이상치에 끌려가면 그 뒤에 오는 진짜
 * 표류까지 안 보인다.
 */
export const MR_ROBUST = 1.047;

/** 사람이 답할 수 있는 것만. 평소 값·출렁임은 여기 없다 — 판독에서 추정한다. */
export interface WatchAnswers {
  /** 무엇을 보나 ("2주차 재방문율"). */
  what: string;
  /** 어디서 보나 ("대시보드 A"). 답할 수 없으면 그 감시는 허구다. */
  where: string;
  /** 이 값이면 전제가 깨진 것. **사람만이 정할 수 있는 값.** */
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
 * 첫 판에는 여기 "깨진 값이 평소 출렁임 안에 있다(δ≤σ)" 거절이 있었다. 옳은
 * 걱정이지만 **틀린 자리**였다 — 자기보고한 σ 로 판정했으니, 사용자가 σ 를 작게
 * 답하면 통과하고 크게 답하면 막혔다. 같은 걱정은 이제 판독이 쌓인 뒤
 * `cusumSeries` 가 `indistinguishable` 로 답한다. 데이터가 말하게 하고,
 * 만들기 전에 지어낸 숫자로 막지 않는다.
 */
export function watchAnswerBlocks(w: WatchAnswers): string[] {
  const out: string[] = [];
  if (!(w.what || '').trim()) out.push('무엇을 볼지 적어주세요.');
  if (!(w.where || '').trim()) out.push('그 숫자를 어디서 보는지 적어주세요. 볼 곳이 없으면 지켜지지 않습니다.');
  if (!Number.isFinite(w.broken)) out.push('어떤 값이면 이 전제가 깨진 건지 숫자로 적어주세요.');
  if (!(w.why || '').trim()) out.push('왜 그 값이면 깨진 건지 한 줄 적어주세요. 나중에 이 기준을 다시 볼 때 필요합니다.');
  return out;
}

/** 판독에서 추정한 기준선. 자기보고가 아니라 관측의 산물이다. */
export interface Baseline {
  /** 중앙값. 이상치 한 건에 끌려가지 않게 평균이 아니다. */
  center: number;
  /** σ̂ = MR̄ / d2. 연속 판독의 차이에서 나오므로 느린 추세에 덜 부풀려진다. */
  sigma: number;
  sample: number;
}

function median(xs: readonly number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 0 ? (s[mid - 1]! + s[mid]!) / 2 : s[mid]!;
}

/** 판독이 모자라거나 전혀 안 움직이면 null — 없는 기준선을 지어내지 않는다. */
export function estimateBaseline(values: readonly number[]): Baseline | null {
  const vs = (values ?? []).filter((v) => Number.isFinite(v));
  if (vs.length < MIN_BASELINE_READINGS) return null;
  const mr: number[] = [];
  for (let i = 1; i < vs.length; i += 1) mr.push(Math.abs(vs[i]! - vs[i - 1]!));
  // 견고 추정자가 기본. 다만 계열의 절반 이상이 완전히 붙어 있으면 중앙값이 0이
  // 되어 σ 가 사라지므로, 그때만 평균 이동범위로 물러난다 (둘 다 0이면 기준선 없음).
  let sigma = MR_ROBUST * median(mr);
  if (!(sigma > 0)) sigma = (mr.reduce((a, b) => a + b, 0) / mr.length) / MR_D2;
  if (!(sigma > 0)) return null;
  return { center: median(vs), sigma, sample: vs.length };
}

/**
 * 스냅샷 규칙. `broken` 이 단일 정본이고, 사람이 읽는 문장과 이 규칙이 거기서
 * 나온다. 파생이지 두 번째 저장이 아니다.
 *
 * `direction` 을 첫 판독에서 얻는 이유: 어느 쪽으로 가는 게 나쁜지는 지금 어디에
 * 있는지를 알아야 정해진다. 이건 자기보고가 아니라 사실이므로 물을 것이 아니라
 * 읽을 것이다. 기본값 `'cross'` 로 두면 안 되는 이유는 따로 있다 — `'cross'`
 * 분기는 `boundary` 를 **아예 안 읽어서**(threshold 분기의 `direction !== 'cross'`
 * 게이트), 선에 정확히 닿는 값의 운명이 선언이 아니라 `Math.sign(0)` 이라는
 * 우연에 걸린다.
 */
export function deriveMaterialityRule(w: WatchAnswers, currentValue: number): MaterialityRule | null {
  if (watchAnswerBlocks(w).length > 0) return null;
  if (!Number.isFinite(currentValue) || currentValue === w.broken) return null;
  return {
    type: 'threshold',
    params: { line: w.broken, direction: w.broken < currentValue ? 'below' : 'above' },
    modifiers: { boundary: 'inclusive' },
  };
}

/** 계열 판정 결과. `insufficient` 는 "괜찮다"가 아니라 "아직 모른다"이다. */
export interface SeriesVerdict {
  status: 'alert' | 'holds' | 'insufficient' | 'indistinguishable';
  /** 사람이 읽는 한 줄. 사실 진술만 — 권고·평가 어휘 금지. */
  statement: string;
  /** 누적합의 최고점. 결정 구간과 비교할 수 있게 함께 준다. */
  statistic: number;
  /** 경보가 처음 성립한 판독 번호 (1부터). 없으면 -1. */
  alert_at_index: number;
  sample: number;
  /** 추정된 기준선. 판정의 근거를 함께 돌려준다 (숨은 숫자 금지). */
  baseline?: Baseline;
}

/**
 * 누적합 관리도 (Page 1954). **단방향** — 사용자가 깨진다고 말한 쪽으로 가는
 * 이동만 누적한다. 기준선은 판독에서 추정한다.
 *
 * 한 걸음이 선을 안 넘어도 같은 방향으로 조금씩 계속 새면 누적합이 결정 구간을
 * 넘는다. 이것이 스냅샷 판정이 원리적으로 못 보는 것이고, `stateful` 분기가
 * "관측 이력이 필요하다"고 적어둔 자리다.
 *
 * 왜 양방향이 아닌가. 양방향은 **건강하게 성장하는 지표에 경보를 낸다** — 매달
 * 4%씩 잘 크는 숫자가 4번째 판독에서 울린다(실측). 사용자가 "이 값이면 깨진
 * 것"이라 말한 반대쪽 이동은 그가 걱정한 사건이 아니고, 그걸 알림으로 만드는
 * 것은 개입 여부를 사용자 대신 판정하는 과발화다.
 *
 * 그래서 감시하지 않는 절반이 생긴다. 깨지는 값을 **하나만** 받으므로 양쪽이 다
 * 위험한 전제는 구조적으로 표현되지 않는다. 숨기지 않는다 — 판정 문장이
 * "{broken} 쪽으로 새는 것만 봅니다"라고 밝힌다.
 */
export function cusumSeries(values: readonly number[], w: WatchAnswers): SeriesVerdict {
  const vs = (values ?? []).filter((v) => Number.isFinite(v));
  const side = `${w.broken}${w.unit ?? ''} 쪽으로 새는 것만 봅니다.`;
  const base = estimateBaseline(vs);
  if (!base) {
    return {
      status: 'insufficient',
      statement: `수치 판독이 ${vs.length}건입니다 (기준선 추정에 ${MIN_BASELINE_READINGS}건 필요). `
        + `계열은 아직 판정하지 않습니다. "괜찮다"가 아니라 "아직 모른다"입니다. `
        + `전제가 깨졌는지는 ${w.broken}${w.unit ?? ''} 선이 판독마다 답합니다.`,
      statistic: 0, alert_at_index: -1, sample: vs.length,
    };
  }
  // 선이 잡음 안에 있으면 이 감시는 흔들린 것과 깨진 것을 구별하지 못한다.
  // 첫 판은 이걸 만들기 전에 자기보고 σ 로 막았다. 이제 데이터가 말한다.
  const delta = Math.abs(base.center - w.broken);
  if (delta <= base.sigma) {
    return {
      status: 'indistinguishable',
      statement: `판독 ${base.sample}건에서 평소는 ${round4(base.center)}${w.unit ?? ''}, `
        + `평소 출렁임은 ${round4(base.sigma)} 정도입니다. 깨진다고 하신 ${w.broken}${w.unit ?? ''}이 `
        + `그 출렁임 안에 있어서, 이 숫자로는 흔들린 것과 깨진 것을 구별할 수 없습니다.`,
      statistic: 0, alert_at_index: -1, sample: base.sample, baseline: base,
    };
  }
  const toward: 'up' | 'down' = w.broken < base.center ? 'down' : 'up';
  const slack = base.sigma * SLACK_RATIO;
  const h = base.sigma * DECISION_SIGMA;
  let sum = 0;
  let peak = 0;
  let crossedAt = -1;
  for (let i = 0; i < vs.length; i += 1) {
    // 깨짐 쪽으로의 이탈을 양수로. 반대쪽 이동은 음수라 누적합을 깎는다.
    const raw = toward === 'down' ? base.center - vs[i]! : vs[i]! - base.center;
    // 한 판독의 기여를 결정 구간에서 자른다. 자르지 않으면 한 번 튀고 마는
    // 이상치가 누적합을 h 의 열 배로 밀어올리고, 값이 정상으로 돌아온 뒤에도
    // 여유 k 씩만 빠지므로 **수십 판독 동안 경보가 걸린 채로 남는다.**
    // 큰 한 방은 사용자가 정한 선(스냅샷 규칙)이 잡는 몫이고, 여기는 작은
    // 이동이 꾸준히 쌓이는 것을 본다 (Shewhart–CUSUM 병용의 그 분업).
    const d = Math.min(raw, h);
    sum = Math.max(0, sum + d - slack);
    if (sum > peak) peak = sum;
    if (crossedAt < 0 && sum > h) crossedAt = i + 1;
  }
  const cur = round4(sum);
  const stat = round4(peak);
  const basis = `평소 ${round4(base.center)}${w.unit ?? ''}, 출렁임 ${round4(base.sigma)} 기준 (판독에서 추정). ${side}`;
  // 판정은 **지금 상태**다. 한때 넘었다가 돌아온 것은 사실로 함께 적되 경보로
  // 남기지 않는다 — 끝난 일로 계속 부르는 것은 과발화다.
  if (sum > h) {
    return {
      status: 'alert',
      statement: `판독 ${vs.length}건에서 누적합이 결정 구간(${round4(h)})을 넘어 ${cur}입니다`
        + `${crossedAt > 0 ? ` (${crossedAt}번째부터)` : ''}. ${basis}`,
      statistic: stat, alert_at_index: crossedAt, sample: vs.length, baseline: base,
    };
  }
  return {
    status: 'holds',
    statement: `판독 ${vs.length}건에서 누적합은 지금 ${cur}, 결정 구간(${round4(h)}) 안입니다`
      + `${crossedAt > 0 ? `. ${crossedAt}번째에 한 번 넘었다가 돌아왔습니다 (최고 ${stat})` : ''}. ${basis}`,
    statistic: stat, alert_at_index: crossedAt, sample: vs.length, baseline: base,
  };
}

/**
 * 감시를 사람에게 한 문장으로 돌려준다. 확인창·리시트가 이걸 읽는다.
 *
 * 마지막 절이 중요하다. 우리가 근거를 길게 설명하는 것은 계열 판정의 관례
 * 상수(k·h)인데, **사용자가 실제로 받는 알림은 거의 전부 선 쪽에서 나온다** —
 * 판독 한 건이 닿기만 해도 울리므로 계열보다 두 자릿수 배 자주 발화한다.
 * 자주 우는 쪽을 설명 안 하고 조용한 쪽만 설명하면, 사용자는 자기가 받는
 * 알림의 출처를 틀리게 안다.
 */
export function watchStatement(w: WatchAnswers): string | null {
  if (watchAnswerBlocks(w).length > 0) return null;
  const u = w.unit ?? '';
  return `${w.what}을(를) ${w.where}에서 봅니다. ${w.broken}${u}이면 깨진 것 (${w.why.trim()}). `
    + `이 선은 판독 한 건이 닿기만 해도 알립니다. `
    + `${w.broken}${u} 쪽으로 조금씩 새는 것은 판독 ${MIN_BASELINE_READINGS}건이 쌓인 뒤부터 따로 봅니다.`;
}

function round4(n: number): number {
  return Math.round(n * 1e4) / 1e4;
}
