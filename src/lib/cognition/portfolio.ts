import { toNumericSeries, type NumericSeries } from './detect';
import type { SignalReading } from './types';

/**
 * 가설 포트폴리오 — **단절을 탐지하지 않고** 믿음을 갱신한다.
 *
 * ── 왜 이것이 근본적인가 ─────────────────────────────────────────────
 *
 * 안정성-가소성 딜레마(Grossberg 1987)의 무한 후퇴: 최적 갱신 속도는 변화
 * 과정의 성질에 달렸고, **그 과정 자체가 변한다.** 그래서 "얼마나 빨리
 * 갱신할지"를 정하려면 다시 "변화가 얼마나 빠른지"를 알아야 하고, 그것을
 * 알려면 또… 끝이 없다. 탐지기(CUSUM·ADWIN)는 이 후퇴를 **임계값이라는
 * 사전 믿음으로 끊는다** — 정직하지만 임의적이다.
 *
 * 온라인 학습 계보(Herbster-Warmuth 1998 fixed-share, Cesa-Bianchi-Lugosi
 * 2006)는 다른 길을 낸다: **단절을 탐지하지 않는다.** 경쟁 가설들에 가중치를
 * 두고, 관측마다 손실로 재가중하며, 매번 가중치의 일부를 서로 나눠준다
 * (share 단계). 그러면 어떤 가설의 가중치도 0으로 죽지 않으므로, 세계가
 * 바뀌어 예전에 틀렸던 가설이 다시 맞게 되면 **스스로 되살아난다.**
 *
 * 결정적인 것: 이것은 분포 가정 없이 **후회 상한**을 준다. 최적 k-이동
 * 가설열에 대해 후회가 O(√(T(k log N + k log(T/k)))) 로 유계다. 즉
 * "얼마나 빨리 갱신할지"를 몰라도 **최선을 크게 밑돌지 않는다는 보증**이 있다.
 * 무한 후퇴를 푸는 것이 아니라 **후퇴가 필요 없게** 만드는 것이다.
 *
 * ── 이 제품에서 무엇이 '가설'인가 ────────────────────────────────────
 *
 * 전제 하나에 대한 경쟁 상태들이다:
 *   holds        전제가 여전히 참이다 (목표값 근처)
 *   broken       전제가 무너졌다 (목표에서 멀다)
 *   regime_shift 세계가 다른 국면으로 옮겼다 (최근 관측의 수준이 새 기준)
 *
 * 가중치 벡터가 곧 믿음 상태다. 사용자에게 보이는 것은 등급이 아니라
 * **"지금 무엇이 앞서고 있고, 언제 순위가 바뀌었나"** 다.
 *
 * ── 규율 ─────────────────────────────────────────────────────────────
 *
 * 1. 순수·결정론. 같은 판독 열 = 같은 가중치.
 * 2. 모수(η·α)는 사전 믿음이므로 근거와 함께 노출된다.
 * 3. 손실은 [0,1] 로 유계화된다 — 유계가 아니면 후회 상한이 성립하지 않는다.
 * 4. 표본이 없으면 **균등 가중치를 그대로 돌려준다.** "모른다"가 균등이고,
 *    임의의 가설을 앞세우지 않는다.
 *
 * ── 이미 있는 것과의 관계 ───────────────────────────────────────────
 * 전제의 데이터 모델은 `src/lib/premises-core.ts` + `./premise.ts` 소유다.
 * 여기는 가설 가중치만 굴린다 — 전제를 저장하거나 동일성을 판정하지 않는다.
 */

export type HypothesisId = 'holds' | 'broken' | 'regime_shift';

export interface PortfolioPrior {
  /**
   * 학습률 η. 크면 최근 관측에 급하게 반응하고, 작으면 둔하다.
   * Cesa-Bianchi-Lugosi 의 관례적 선택은 √(8 ln N / T) 이지만 T를 모르므로
   * 고정값을 쓰고 그 사실을 밝힌다.
   */
  learningRate: number;
  /**
   * 공유율 α (fixed-share). **이 모수가 추적 능력의 원천이다.** 0이면
   * 지수가중 평균이 되어 한 번 죽은 가설이 부활하지 못한다(= 국면 전환을
   * 못 따라간다). 관례는 0.01~0.1.
   */
  shareRate: number;
  /** 전제가 가정하는 목표값 — `holds` 가설의 예측치. */
  target: number;
  /** 값의 대표 스케일. 손실 유계화의 분모. 0이면 1로 대체된다. */
  scale: number;
  rationale: string;
}

export interface PortfolioStep {
  /** 이 단계에서 관측된 값. */
  value: number;
  /** 되짚을 참조. */
  ref: string;
  /** 갱신 후 가중치 (합 1). */
  weights: Record<HypothesisId, number>;
  /** 이 단계에서 가장 앞선 가설. */
  leader: HypothesisId;
  /** 각 가설이 이 관측에서 받은 손실 (0~1). */
  losses: Record<HypothesisId, number>;
}

export interface PortfolioResult {
  prior: PortfolioPrior;
  /** 최종 가중치. */
  weights: Record<HypothesisId, number>;
  leader: HypothesisId;
  /** 선두가 바뀐 지점들 — 국면 전환의 후보이며, **탐지 없이** 나온다. */
  leadership_changes: Array<{ at_index: number; ref: string; from: HypothesisId; to: HypothesisId }>;
  /** 단계별 궤적. 화면이 "언제 순위가 바뀌었나"를 그릴 재료. */
  trajectory: PortfolioStep[];
  /** 누적 손실 — 포트폴리오 vs 최선의 고정 가설. 보증의 실측 확인. */
  cumulative_loss: number;
  best_fixed_loss: number;
  /** 실측 후회 = 포트폴리오 손실 − 최선 고정 손실. 음수면 포트폴리오가 더 낫다. */
  realized_regret: number;
  /** 사람이 읽을 한 줄. 사실 진술이며 조치를 지시하지 않는다. */
  statement: string;
  evidence: { sample: number; excluded_unread: number };
}

const HYPOTHESES: readonly HypothesisId[] = ['holds', 'broken', 'regime_shift'];

const r4 = (x: number): number => Math.round(x * 10_000) / 10_000;

/**
 * 각 가설의 예측치. **결정론이고 관측 이력만 본다** (미래를 보지 않는다).
 *
 * `regime_shift` 는 "최근 창의 평균이 새 기준"이라는 가설이므로 직전 관측들의
 * 이동평균을 쓴다. 창 길이 3은 임의적이고, 그래서 이 주석에 적어둔다 —
 * 숨긴 상수는 사전 믿음을 숨기는 것이다.
 */
function predict(h: HypothesisId, history: readonly number[], prior: PortfolioPrior): number {
  switch (h) {
    case 'holds':
      return prior.target;
    case 'broken':
      // 무너졌다는 가설의 예측: 목표에서 스케일만큼 벗어난 값. 방향은 이력이
      // 알려준다 (이력이 없으면 위쪽으로 가정하되 그 사실이 손실로 벌받는다).
      if (history.length === 0) return prior.target + prior.scale;
      return history[history.length - 1] >= prior.target ? prior.target + prior.scale : prior.target - prior.scale;
    case 'regime_shift': {
      const w = history.slice(-3);
      if (w.length === 0) return prior.target;
      return w.reduce((s, x) => s + x, 0) / w.length;
    }
    default:
      return prior.target;
  }
}

/** 손실 — [0,1] 유계. 유계가 아니면 후회 상한이 성립하지 않는다. */
function boundedLoss(predicted: number, actual: number, scale: number): number {
  const s = scale === 0 ? 1 : Math.abs(scale);
  const err = Math.abs(predicted - actual) / (2 * s);
  return Math.min(1, Math.max(0, err));
}

function uniformWeights(): Record<HypothesisId, number> {
  const w = 1 / HYPOTHESES.length;
  return { holds: w, broken: w, regime_shift: w };
}

function argmax(w: Record<HypothesisId, number>): HypothesisId {
  // 동점이면 HYPOTHESES 순서로 결정론적으로 고른다 — 난수도, 삽입 순서도 아니다.
  let best: HypothesisId = HYPOTHESES[0];
  for (const h of HYPOTHESES) if (w[h] > w[best]) best = h;
  return best;
}

/**
 * fixed-share 로 포트폴리오를 굴린다 (Herbster-Warmuth 1998).
 *
 *   손실 갱신:  w_i ← w_i · exp(−η · ℓ_i)
 *   공유 단계:  w_i ← (1−α)·w_i + (α/N)·Σ_j w_j
 *
 * 공유 단계가 없으면(α=0) 한 번 죽은 가설이 부활하지 못한다. 그것이 이
 * 알고리즘과 단순 지수가중의 차이 전부다.
 */
export function runPortfolio(readingsOrSeries: readonly SignalReading[] | NumericSeries, prior: PortfolioPrior): PortfolioResult {
  const series: NumericSeries = Array.isArray(readingsOrSeries)
    ? toNumericSeries(readingsOrSeries as readonly SignalReading[])
    : (readingsOrSeries as NumericSeries);

  const { values, refs } = series;
  const N = HYPOTHESES.length;
  let weights = uniformWeights();
  const trajectory: PortfolioStep[] = [];
  const leadership_changes: PortfolioResult['leadership_changes'] = [];
  const history: number[] = [];
  const cumLossByH: Record<HypothesisId, number> = { holds: 0, broken: 0, regime_shift: 0 };
  let portfolioLoss = 0;
  let prevLeader: HypothesisId | null = null;

  for (let i = 0; i < values.length; i += 1) {
    const actual = values[i];
    const losses: Record<HypothesisId, number> = { holds: 0, broken: 0, regime_shift: 0 };

    // 1) 각 가설의 예측과 손실. 예측은 **이 관측을 보기 전** 이력으로만.
    for (const h of HYPOTHESES) {
      losses[h] = boundedLoss(predict(h, history, prior), actual, prior.scale);
      cumLossByH[h] += losses[h];
    }
    // 포트폴리오의 손실 = 가중 평균 (혼합 예측의 손실이 아니라 손실의 혼합 —
    // 유계 손실에서는 후자가 상한 증명과 맞는 형태다).
    portfolioLoss += HYPOTHESES.reduce((s, h) => s + weights[h] * losses[h], 0);

    // 2) 손실 갱신.
    const updated: Record<HypothesisId, number> = { holds: 0, broken: 0, regime_shift: 0 };
    for (const h of HYPOTHESES) updated[h] = weights[h] * Math.exp(-prior.learningRate * losses[h]);

    // 3) 공유 단계 — 이것이 추적을 가능하게 한다.
    const total = HYPOTHESES.reduce((s, h) => s + updated[h], 0) || 1;
    const shared: Record<HypothesisId, number> = { holds: 0, broken: 0, regime_shift: 0 };
    for (const h of HYPOTHESES) {
      shared[h] = (1 - prior.shareRate) * (updated[h] / total) + prior.shareRate / N;
    }
    const norm = HYPOTHESES.reduce((s, h) => s + shared[h], 0) || 1;
    weights = {
      holds: shared.holds / norm,
      broken: shared.broken / norm,
      regime_shift: shared.regime_shift / norm,
    };

    const leader = argmax(weights);
    if (prevLeader && leader !== prevLeader) {
      leadership_changes.push({ at_index: i, ref: refs[i] ?? '', from: prevLeader, to: leader });
    }
    prevLeader = leader;

    trajectory.push({
      value: r4(actual),
      ref: refs[i] ?? '',
      weights: { holds: r4(weights.holds), broken: r4(weights.broken), regime_shift: r4(weights.regime_shift) },
      leader,
      losses: { holds: r4(losses.holds), broken: r4(losses.broken), regime_shift: r4(losses.regime_shift) },
    });

    history.push(actual);
  }

  const bestFixed = Math.min(...HYPOTHESES.map((h) => cumLossByH[h]));
  const leader = argmax(weights);

  const statement =
    values.length === 0
      ? `수치 판독이 없습니다 — 세 가설의 가중치가 균등합니다(각 ${r4(1 / N)}). 모른다는 뜻이며, 어느 가설도 앞세우지 않습니다.`
      : leadership_changes.length === 0
        ? `판독 ${values.length}건 동안 '${leader}' 가 계속 앞섰습니다 (가중치 ${r4(weights[leader])}). 선두 교체 없음.`
        : `판독 ${values.length}건 동안 선두가 ${leadership_changes.length}번 바뀌었고 현재 '${leader}' 입니다 (가중치 ${r4(weights[leader])}). 마지막 교체는 ${leadership_changes[leadership_changes.length - 1].at_index}번째 판독입니다.`;

  return {
    prior,
    weights: { holds: r4(weights.holds), broken: r4(weights.broken), regime_shift: r4(weights.regime_shift) },
    leader,
    leadership_changes,
    trajectory,
    cumulative_loss: r4(portfolioLoss),
    best_fixed_loss: r4(Number.isFinite(bestFixed) ? bestFixed : 0),
    realized_regret: r4(portfolioLoss - (Number.isFinite(bestFixed) ? bestFixed : 0)),
    statement,
    evidence: { sample: values.length, excluded_unread: series.excluded_unread },
  };
}

/**
 * 탐지기와 포트폴리오가 **엇갈릴 때** 그 사실을 감추지 않는다.
 *
 * 두 계보는 다른 것을 하므로 엇갈리는 것이 정상이다. 탐지기는 "임계를
 * 넘었나"를, 포트폴리오는 "어느 가설이 앞서나"를 답한다. 합의를 강요하면
 * 한쪽의 정보가 사라진다 — 그리고 사용자는 자기 사전 믿음(임계)이 얼마나
 * 결과를 좌우하는지 볼 기회를 잃는다.
 */
export function disagreement(detectorAlerted: boolean, portfolio: PortfolioResult): string | null {
  const portfolioBroken = portfolio.leader !== 'holds';
  if (detectorAlerted === portfolioBroken) return null;
  return detectorAlerted
    ? `탐지기는 경보를 냈지만 포트폴리오는 여전히 '${portfolio.leader}' 를 앞세웁니다 — 임계가 민감하거나, 이동이 아직 일관되지 않습니다.`
    : `탐지기는 조용하지만 포트폴리오는 '${portfolio.leader}' 로 옮겼습니다 — 임계를 넘지 않는 크기의 이동이 누적되고 있습니다.`;
}
