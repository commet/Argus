import type { SignalReading } from './types';

/**
 * 변화점 탐지 — **문헌을 인용하는 대신 실행한다.**
 *
 * ── 이 파일이 생긴 이유 (자기 고발) ──────────────────────────────────
 *
 * 이 엔진의 1층은 Chow(1960)·Bai-Perron(1998)·Page(1954) CUSUM·
 * ADWIN(2007)을 주석에 적어두고 **탐지는 한 줄도 구현하지 않았다.** 전제를
 * 신호에 결박하고 판독을 원장에 쌓았을 뿐, 판독의 열이 "변했는지"를 판정하는
 * 통계는 없었다.
 *
 * 그것이 정확히 이 프로젝트가 막으려는 실패다 — **이해 없이 작동하는 명명**.
 * 문헌의 이름을 붙여두면 그 문헌의 힘이 코드에 들어온 것처럼 보이지만,
 * 들어오지 않았다. 그래서 이 파일은 그 이름들이 실제로 하는 계산을 한다.
 *
 * ── 두 탐지기, 두 다른 질문 ──────────────────────────────────────────
 *
 * **CUSUM (Page 1954)** — "목표에서 한쪽으로 누적해서 벗어나고 있는가."
 *   S_i = max(0, S_{i-1} + (x_i − target − k))
 *   S_i > h 이면 경보. 작은 지속적 이동에 민감하다 (Shewhart 관리도가 놓치는 것).
 *
 * **적응 창 (ADWIN, Bifet-Gavaldà 2007의 핵심)** — "최근과 과거의 평균이
 *   우연으로 설명되지 않을 만큼 다른가." 창을 모든 지점에서 둘로 갈라
 *   |평균차| ≥ ε_cut 인 분할이 있으면 변화. Hoeffding 경계에서
 *   ε_cut = sqrt( (1/2m) · ln(4/δ') ),  m = 조화평균(|W0|,|W1|),  δ' = δ/n.
 *   목표값을 몰라도 되고, 국면 전환의 *시점*을 돌려준다.
 *
 * 둘 다 두는 이유: CUSUM 은 목표를 알아야 하고(전환율 3% 전제처럼), 적응 창은
 * 목표를 모를 때 쓴다(경쟁 강도처럼). 하나로 합치면 둘 중 하나의 질문을 못 한다.
 *
 * ── 규율 (문헌 상충 1의 직접 결과) ───────────────────────────────────
 *
 * 유한 표본에서 소음과 구조 변화의 구분은 귀납 문제 그 자체다. 모든 탐지기의
 * 모수는 **데이터에서 도출되지 않는 사전 믿음**이다. 그래서:
 *
 *   1. 모수(k·h·δ)는 결과에 **항상 동봉된다**. 숨기면 거짓말이 된다.
 *   2. 결과는 `evidence` 를 갖는다 — 어느 판독이, 어느 분할에서, 어떤 통계로.
 *      되짚을 수 없는 경보는 사용자를 설득할 자격이 없다.
 *   3. 표본이 모자라면 `insufficient` 를 낸다. **`holds` 로 적지 않는다** —
 *      "아직 못 본 것"과 "봤는데 괜찮은 것"은 다른 사실이고, 둘을 합치면
 *      센서가 켜져 있다는 사실 자체가 거짓 안심이 된다 (P5).
 *   4. 순수·결정론. `Date.now()`·난수 없음. 같은 판독 열 = 같은 판정.
 */

/** 판독 열에서 숫자를 뽑는다. **비수치·미판독은 0으로 강제하지 않고 제외하고 센다.** */
export interface NumericSeries {
  values: number[];
  /** 판독 순서를 되짚을 수 있는 참조 (경보 증거로 쓴다). */
  refs: string[];
  /** 숫자로 읽히지 않아 제외된 판독 수. 조용히 버리지 않는다. */
  excluded: number;
  /** 제외 사유별 개수 — `unread` 와 `non_numeric` 은 다른 사실이다. */
  excluded_unread: number;
  excluded_non_numeric: number;
}

export function toNumericSeries(readings: readonly SignalReading[]): NumericSeries {
  const values: number[] = [];
  const refs: string[] = [];
  let unread = 0;
  let nonNumeric = 0;

  // 시간순으로 정렬한다 — 탐지는 순서에 의존하고, 저장 순서를 믿으면 안 된다.
  const ordered = [...(readings ?? [])].sort((a, b) =>
    String(a?.observed_at ?? '').localeCompare(String(b?.observed_at ?? '')),
  );

  for (const r of ordered) {
    if (!r || r.verdict === 'unread' || r.value === null || r.value === undefined) {
      unread += 1;
      continue;
    }
    // 숫자 접두부만 읽는다 ("1400원" → 1400). 완전히 비수치면 제외.
    //
    // ⚠️ 첫 판이 여기서 틀렸다: 한글을 걷어내면 빈 문자열이 남고 `Number('')` 는
    // **0**이다 (그리고 0은 유한하다). 그래서 '가나다' 가 제외되지 않고 값 0으로
    // 열에 섞여 들어갔다 — 이 파일이 막겠다고 선언한 "조용한 메움"을 이 파일이
    // 저지른 것이다. 숫자 문자가 하나도 없으면 걷어내기 전에 제외한다.
    const raw = String(r.value);
    const stripped = raw.replace(/[^0-9.+\-eE]/g, '');
    const n = /[0-9]/.test(stripped) ? Number(stripped) : Number.NaN;
    if (!Number.isFinite(n)) {
      nonNumeric += 1;
      continue;
    }
    values.push(n);
    refs.push(`${r.target}@${r.observed_at}`);
  }

  return {
    values,
    refs,
    excluded: unread + nonNumeric,
    excluded_unread: unread,
    excluded_non_numeric: nonNumeric,
  };
}

/** CUSUM 모수 — 전부 사전 믿음이므로 이름과 근거를 함께 들고 다닌다. */
export interface CusumPrior {
  /** 전제가 가정하는 목표값 (예: 전환율 0.03). */
  target: number;
  /**
   * 허용 여유 k. 관례는 탐지하려는 이동폭의 절반(δ/2)이다. 이보다 작으면
   * 소음에 울고, 크면 실제 이동을 놓친다.
   */
  slack: number;
  /** 결정 구간 h. 관례는 4~5σ. 이것이 경보의 민감도를 정한다. */
  decisionInterval: number;
  /** 왜 이 숫자인가. 비어 있으면 이 사전 믿음은 검토될 수 없다. */
  rationale: string;
}

/** 적응 창 모수. */
export interface AdwinPrior {
  /**
   * 신뢰 모수 δ. 작을수록 보수적(경보가 드물다). Hoeffding 경계에 들어간다.
   * ADWIN 원논문의 관례는 0.002~0.05.
   */
  delta: number;
  /** 분할 양쪽의 최소 표본. 너무 작으면 경계가 무의미하게 커진다. */
  minSplit: number;
  rationale: string;
}

export type DetectionVerdict = 'holds' | 'alert' | 'insufficient';

export interface DetectionResult {
  method: 'cusum' | 'adaptive_window';
  verdict: DetectionVerdict;
  /** 사람이 읽을 한 줄. 사실 진술이며 조치를 지시하지 않는다. */
  statement: string;
  /** 통계값 — 경보든 아니든 낸다. 조용한 통과도 숫자를 남긴다. */
  statistic: number;
  /** 이 판정을 낸 임계. **항상 동봉** (문헌 상충 1). */
  threshold: number;
  /** 모수 원본 — 사용자가 자기 사전 믿음을 되볼 수 있게. */
  prior: CusumPrior | AdwinPrior;
  /** 되짚을 수 있는 증거. */
  evidence: {
    sample: number;
    excluded: number;
    excluded_unread: number;
    /** 경보 시 변화 추정 시점의 판독 참조 (없으면 빈 문자열). */
    change_at_ref: string;
    /** 경보 시 변화 추정 인덱스 (없으면 -1). */
    change_at_index: number;
    /** 앞·뒤 평균 (적응 창) 또는 목표·최종 누적 (CUSUM). */
    before: number;
    after: number;
  };
}

const r4 = (x: number): number => Math.round(x * 10_000) / 10_000;

/**
 * CUSUM (Page 1954) — 양방향.
 *
 * 목표에서 위/아래 어느 쪽으로든 누적 이탈이 결정 구간을 넘으면 경보. 경보
 * 시점의 인덱스를 돌려주므로 "언제부터 벗어났나"에 답할 수 있다.
 */
export function cusum(series: NumericSeries, prior: CusumPrior): DetectionResult {
  const { values, refs } = series;
  const base = {
    method: 'cusum' as const,
    prior,
    threshold: prior.decisionInterval,
  };

  if (values.length < 3) {
    return {
      ...base,
      verdict: 'insufficient',
      statement: `수치 판독이 ${values.length}건입니다 (최소 3건). 아직 판정하지 않습니다 — 미판독 ${series.excluded_unread}건.`,
      statistic: 0,
      evidence: {
        sample: values.length,
        excluded: series.excluded,
        excluded_unread: series.excluded_unread,
        change_at_ref: '',
        change_at_index: -1,
        before: prior.target,
        after: values.length > 0 ? r4(values[values.length - 1]) : prior.target,
      },
    };
  }

  let sHi = 0;
  let sLo = 0;
  let peak = 0;
  let alarmAt = -1;

  for (let i = 0; i < values.length; i += 1) {
    const d = values[i] - prior.target;
    sHi = Math.max(0, sHi + d - prior.slack);
    sLo = Math.max(0, sLo - d - prior.slack);
    const worst = Math.max(sHi, sLo);
    if (worst > peak) peak = worst;
    if (alarmAt < 0 && worst > prior.decisionInterval) alarmAt = i;
  }

  const alerted = alarmAt >= 0;
  return {
    ...base,
    verdict: alerted ? 'alert' : 'holds',
    statistic: r4(peak),
    statement: alerted
      ? `목표 ${prior.target} 에서 누적 이탈이 ${r4(peak)} 로 결정 구간 ${prior.decisionInterval} 을 넘었습니다 (판독 ${alarmAt + 1}번째부터).`
      : `누적 이탈 최대 ${r4(peak)} 로 결정 구간 ${prior.decisionInterval} 이내입니다 (판독 ${values.length}건).`,
    evidence: {
      sample: values.length,
      excluded: series.excluded,
      excluded_unread: series.excluded_unread,
      change_at_ref: alerted ? (refs[alarmAt] ?? '') : '',
      change_at_index: alarmAt,
      before: prior.target,
      after: r4(values[values.length - 1]),
    },
  };
}

/**
 * 적응 창 (ADWIN, Bifet-Gavaldà 2007의 핵심 검정).
 *
 * 창을 모든 지점에서 둘로 갈라, 평균차가 Hoeffding 경계를 넘는 분할이 있으면
 * 변화로 판정한다. **가장 큰 초과를 낸 분할**을 변화 시점으로 돌려준다 —
 * 원논문은 가장 오래된 초과 분할을 잘라내지만, 여기서는 사용자에게 "어디서
 * 갈렸나"를 보여주는 것이 목적이므로 최대 초과 지점이 더 유용하다.
 * (이 선택 자체가 설계 판단이므로 여기 적어둔다.)
 *
 * 목표값이 필요 없다는 것이 CUSUM 과의 결정적 차이다.
 */
export function adaptiveWindow(series: NumericSeries, prior: AdwinPrior): DetectionResult {
  const { values, refs } = series;
  const minSplit = Math.max(2, Math.floor(prior.minSplit));
  const base = { method: 'adaptive_window' as const, prior };

  if (values.length < minSplit * 2) {
    return {
      ...base,
      verdict: 'insufficient',
      statement: `수치 판독이 ${values.length}건입니다 (분할당 최소 ${minSplit}건 × 2). 아직 판정하지 않습니다 — 미판독 ${series.excluded_unread}건.`,
      statistic: 0,
      threshold: 0,
      evidence: {
        sample: values.length,
        excluded: series.excluded,
        excluded_unread: series.excluded_unread,
        change_at_ref: '',
        change_at_index: -1,
        before: 0,
        after: 0,
      },
    };
  }

  const n = values.length;
  // Hoeffding 경계는 [0,1] 유계 변수를 가정한다. 그래서 값을 범위로 **정규화해
  // 비교**하고(경계를 범위로 늘리지 않는다 — 첫 판이 그렇게 했고 단위가 뒤엉켰다),
  // 범위가 0이면 변화 없음이다.
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min;
  const unit = (x: number): number => (range === 0 ? 0 : (x - min) / range);

  const deltaPrime = prior.delta / n;
  let bestExcess = -Infinity;
  let bestIdx = -1;
  let bestBefore = 0;
  let bestAfter = 0;
  let bestEps = 0;
  let minEps = Infinity;

  for (let cut = minSplit; cut <= n - minSplit; cut += 1) {
    const w0 = values.slice(0, cut);
    const w1 = values.slice(cut);
    const u0 = w0.reduce((s, x) => s + unit(x), 0) / w0.length;
    const u1 = w1.reduce((s, x) => s + unit(x), 0) / w1.length;
    // 조화평균 m — 작은 쪽 창이 경계를 지배한다 (ADWIN 원논문의 m).
    const m = 1 / (1 / w0.length + 1 / w1.length);
    const eps = Math.sqrt((1 / (2 * m)) * Math.log(4 / deltaPrime));
    if (eps < minEps) minEps = eps;
    const diff = Math.abs(u0 - u1);
    const excess = diff - eps;
    if (excess > bestExcess) {
      bestExcess = excess;
      bestIdx = cut;
      // 보고는 원단위로 — 정규화는 검정의 내부 사정이다.
      bestBefore = w0.reduce((s, x) => s + x, 0) / w0.length;
      bestAfter = w1.reduce((s, x) => s + x, 0) / w1.length;
      bestEps = eps;
    }
  }

  // **공허한 경계**: 정규화 평균차의 최댓값은 1이므로, 모든 분할에서 ε_cut ≥ 1 이면
  // 이 표본 크기로는 **어떤 변화도 판정할 수 없다.** 그때 `holds` 라고 적는 것은
  // "봤는데 괜찮다"는 거짓말이다 — ADWIN 은 수천 점 스트림용 경계이고, 판독 열이
  // 짧으면 정직한 답은 "아직 못 본다"다. (첫 판이 여기서 3→9 급변에 holds 를 냈다.)
  if (range > 0 && minEps >= 1) {
    return {
      ...base,
      verdict: 'insufficient',
      statement: `판독 ${n}건으로는 이 검정이 어떤 변화도 판정할 수 없습니다 (우연 경계 ${r4(minEps)} ≥ 최대 가능 차이 1). 표본이 더 필요합니다 — "괜찮다"가 아닙니다.`,
      statistic: 0,
      threshold: r4(minEps),
      evidence: {
        sample: n,
        excluded: series.excluded,
        excluded_unread: series.excluded_unread,
        change_at_ref: '',
        change_at_index: -1,
        before: r4(bestBefore),
        after: r4(bestAfter),
      },
    };
  }

  const alerted = bestExcess > 0 && range > 0;
  return {
    ...base,
    verdict: alerted ? 'alert' : 'holds',
    statistic: r4(Math.abs(bestBefore - bestAfter)),
    threshold: r4(bestEps),
    statement: alerted
      ? `판독 ${bestIdx}번째에서 앞뒤 평균이 ${r4(bestBefore)} → ${r4(bestAfter)} 로 갈렸고, 차이 ${r4(Math.abs(bestBefore - bestAfter))} 가 우연 경계 ${r4(bestEps)} 를 넘었습니다.`
      : range === 0
        ? `판독 ${n}건이 모두 같은 값입니다 — 변화 없음.`
        : `앞뒤 평균 최대 차이 ${r4(Math.abs(bestBefore - bestAfter))} 가 우연 경계 ${r4(bestEps)} 이내입니다 (판독 ${n}건).`,
    evidence: {
      sample: n,
      excluded: series.excluded,
      excluded_unread: series.excluded_unread,
      change_at_ref: alerted ? (refs[bestIdx] ?? '') : '',
      change_at_index: alerted ? bestIdx : -1,
      before: r4(bestBefore),
      after: r4(bestAfter),
    },
  };
}

/**
 * 두 탐지기를 함께 돌린다.
 *
 * **합의를 요구하지 않는다.** 둘은 다른 질문에 답하므로 한쪽만 울리는 것이
 * 정상이고, 그때 "어느 탐지기가 무엇을 봤는지"를 그대로 보여준다. 다수결로
 * 합치면 두 질문이 하나로 뭉개진다.
 */
export function detectAll(
  readings: readonly SignalReading[],
  priors: { cusum?: CusumPrior; adwin?: AdwinPrior },
): DetectionResult[] {
  const series = toNumericSeries(readings);
  const out: DetectionResult[] = [];
  if (priors.cusum) out.push(cusum(series, priors.cusum));
  if (priors.adwin) out.push(adaptiveWindow(series, priors.adwin));
  return out;
}

/** 경보가 하나라도 있나 — 귀환 트리거 판정에 쓴다. */
export function anyAlert(results: readonly DetectionResult[]): boolean {
  return (results ?? []).some((r) => r.verdict === 'alert');
}

/**
 * 전부 `insufficient` 인가 — **이것이 `holds` 와 구분되어야 하는 이유**:
 * 표본이 없어서 조용한 것과 봤는데 괜찮은 것은 다른 사실이다. 화면이 둘을
 * 같은 초록으로 그리면 센서가 켜져 있다는 사실이 거짓 안심이 된다.
 */
export function allInsufficient(results: readonly DetectionResult[]): boolean {
  const list = results ?? [];
  return list.length > 0 && list.every((r) => r.verdict === 'insufficient');
}
