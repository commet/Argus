import type { CognitiveFrame } from './types';

/**
 * 보정 — **봉인된 예측에만** 점수가 붙는다. 사람에게는 절대 붙지 않는다.
 *
 * ── 왜 이 파일이 조심스러운가 ─────────────────────────────────────────
 *
 * CLAUDE.md Zero-Judgment 게이트: *"사용자가 누구인지에 대한 사용자향 판정
 * 금지. 미보정 점수·등급을 노출하지 않는다."* 그리고 TWIN 수정조항이 그
 * 금지에 정확히 두 개의 구멍을 냈다 — 점수가 붙을 수 있는 대상은 **(a) 분신의
 * 봉인 예측, (b) 사용자가 스스로 사전등록한 예측** 뿐이며, 조건 셋을 전부
 * 지킬 때만이다:
 *   1. 표본 임계 미달이면 숫자 대신 **"아직 모릅니다"**
 *   2. 증거(근거 케이스 id) 동반
 *   3. **채점 대상이 예측임을 문장에서 밝힌다**
 *
 * 이 파일은 (b)에 해당한다. 그래서 반환 타입이 `number` 가 아니라
 * `CalibrationReading` 이다 — 숫자만 돌려주면 호출자가 조건 2·3을 잊는다.
 *
 * ── 문헌 ─────────────────────────────────────────────────────────────
 *
 * Brier(1950) 점수, Murphy(1973) 분해: BS = 불확실성 − 분해능 + 보정.
 * Tetlock(2005·2015): 보정은 훈련 가능하지만 **사전등록된 해결가능 예측에
 * 채점 피드백이 있을 때만**이다. 그래서 `resolvable: false` 인 확신도는
 * 분모에서도 빠진다 — 판정 불가능한 문장에 점수를 매기는 것은 숫자 놀이이고,
 * 그런 문장을 분모에 넣으면 M8(게이밍 유출: 안전한 predicate 편중)을
 * 측정하는 대신 조장한다.
 */

/**
 * 숫자를 낼 최소 표본. **검증 불가능한 사전 믿음이므로 노출한다** (P6).
 *
 * 10을 고른 근거: Brier 분해가 구간별로 의미를 갖기 시작하는 최소치의
 * 관례적 하한이고, 이 제품의 실측 표본(정산 시도 12건)과 같은 자릿수다.
 * 근거가 강해서 10인 것이 아니라, **10이라고 미리 말해두면 나중에 사후
 * 조정이 드러나기 때문에** 10이다.
 */
export const MIN_SAMPLE = 10;

export interface ScoredPrediction {
  frame_id: string;
  /** 봉인 시점의 확신도 (0~1 로 정규화). */
  forecast: number;
  /** 정산에서 falsifier 가 관찰됐나 → 예측이 맞았나. */
  outcome: 0 | 1;
  /** 채점 근거를 되짚을 수 있는 id. */
  evidence_ref: string;
}

export type CalibrationReading =
  | {
      state: 'unknown';
      /** 왜 모르는지 — 조용히 0을 내지 않는다. */
      reason: string;
      sample: number;
      min_sample: number;
      /** 표본에 든 케이스 id. 적어도 무엇이 세어졌는지는 보인다. */
      case_refs: string[];
    }
  | {
      state: 'measured';
      sample: number;
      min_sample: number;
      /** Brier 점수 (0 = 완벽, 1 = 최악). */
      brier: number;
      /** Murphy 분해. */
      reliability: number;
      resolution: number;
      uncertainty: number;
      case_refs: string[];
      /**
       * 이 숫자가 무엇에 대한 것인지 밝히는 문장. TWIN 조건 3을 타입으로
       * 강제한다 — 호출자가 문장을 짓지 못하게 하고 여기서 만든다.
       */
      subject_sentence: string;
    };

/** 정산까지 끝나고 **해결 가능하다고 봉인된** 확신도만 채점 대상으로 뽑는다. */
export function scorablePredictions(frames: readonly CognitiveFrame[]): ScoredPrediction[] {
  const out: ScoredPrediction[] = [];
  for (const f of frames ?? []) {
    const c = f?.confidence;
    const s = f?.settlement;
    if (!c || !s) continue;
    if (!c.resolvable) continue;
    if (f.status !== 'settled') continue;
    const forecast = Math.min(1, Math.max(0, (Number(c.value) || 0) / 100));
    out.push({
      frame_id: f.id,
      forecast,
      // falsifier 가 관찰됐다 = 판단이 틀렸다. 예측이 맞은 것은 그 반대다.
      outcome: s.falsifier_observed ? 0 : 1,
      evidence_ref: s.evidence_ref || `frame:${f.id}`,
    });
  }
  return out;
}

/**
 * Murphy(1973) 분해. 구간은 0.1 폭 10개 — 구간 수도 사전 믿음이지만 관례가
 * 확립된 부분이므로 근거를 여기 남기고 노출은 하지 않는다.
 */
function decompose(preds: readonly ScoredPrediction[]): {
  brier: number;
  reliability: number;
  resolution: number;
  uncertainty: number;
} {
  const n = preds.length;
  const base = preds.reduce((s, p) => s + p.outcome, 0) / n;
  const uncertainty = base * (1 - base);

  const bins = new Map<number, ScoredPrediction[]>();
  for (const p of preds) {
    const k = Math.min(9, Math.floor(p.forecast * 10));
    const arr = bins.get(k);
    if (arr) arr.push(p);
    else bins.set(k, [p]);
  }

  let reliability = 0;
  let resolution = 0;
  for (const group of bins.values()) {
    const nk = group.length;
    const fk = group.reduce((s, p) => s + p.forecast, 0) / nk;
    const ok = group.reduce((s, p) => s + p.outcome, 0) / nk;
    reliability += (nk / n) * (fk - ok) ** 2;
    resolution += (nk / n) * (ok - base) ** 2;
  }

  const brier = preds.reduce((s, p) => s + (p.forecast - p.outcome) ** 2, 0) / n;
  const r4 = (x: number) => Math.round(x * 10_000) / 10_000;
  return {
    brier: r4(brier),
    reliability: r4(reliability),
    resolution: r4(resolution),
    uncertainty: r4(uncertainty),
  };
}

/**
 * 보정 판독. 표본이 임계 미달이면 **숫자를 내지 않는다.**
 *
 * "아직 모릅니다"를 0이나 0.5로 바꾸는 순간 이 제품이 방어하려는 실패
 * (그럴듯한 숫자가 모름을 가리는 것)를 스스로 저지르게 된다.
 */
export function calibration(frames: readonly CognitiveFrame[]): CalibrationReading {
  const preds = scorablePredictions(frames);
  const case_refs = preds.map((p) => p.evidence_ref);

  if (preds.length < MIN_SAMPLE) {
    return {
      state: 'unknown',
      reason:
        preds.length === 0
          ? '정산된 해결가능 예측이 아직 없습니다 — 채점할 대상이 없습니다.'
          : `정산된 해결가능 예측이 ${preds.length}건입니다 (임계 ${MIN_SAMPLE}건). 아직 모릅니다.`,
      sample: preds.length,
      min_sample: MIN_SAMPLE,
      case_refs,
    };
  }

  const d = decompose(preds);
  return {
    state: 'measured',
    sample: preds.length,
    min_sample: MIN_SAMPLE,
    ...d,
    case_refs,
    subject_sentence:
      `아래는 당신이 **봉인해 둔 예측 ${preds.length}건**의 채점 결과입니다 — ` +
      '당신이 어떤 사람인지에 대한 평가가 아닙니다.',
  };
}
