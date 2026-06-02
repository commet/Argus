/**
 * Progressive Convergence — 진짜 질문이 수렴하고 있는지 측정
 *
 * 4가지 신호를 종합:
 * 1. 질문 안정성: real_question이 라운드마다 얼마나 바뀌는지
 * 2. 가정 감소 추세: hidden_assumptions가 줄어들고 있는지
 * 3. 프레이밍 확신도: LLM의 자기 평가
 * 4. 워커 품질 신호: 워커 결과물의 검증 점수 + 승인률 (Phase 4)
 */

import type { AnalysisSnapshot, ConvergenceMetrics } from '@/stores/types';

/** 두 문자열의 유사도 (0-1). 간단한 단어 겹침 기반. */
function wordOverlap(a: string, b: string): number {
  const wordsA = new Set(a.replace(/[??.!]/g, '').split(/\s+/).filter(w => w.length > 1));
  const wordsB = new Set(b.replace(/[??.!]/g, '').split(/\s+/).filter(w => w.length > 1));
  if (wordsA.size === 0 || wordsB.size === 0) return 0;
  let overlap = 0;
  for (const w of wordsA) {
    if (wordsB.has(w)) overlap++;
  }
  return overlap / Math.max(wordsA.size, wordsB.size);
}

/**
 * 스냅샷 히스토리를 분석하여 수렴 메트릭을 계산한다.
 * round 0부터 현재까지의 스냅샷을 받아야 한다.
 */
export function assessConvergence(snapshots: AnalysisSnapshot[]): ConvergenceMetrics {
  if (snapshots.length === 0) {
    return {
      score: 0,
      trend: 'unclear',
      is_converged: false,
      estimated_rounds_left: 5,
      guidance: '분석을 시작해야 합니다.',
    };
  }

  if (snapshots.length === 1) {
    const confidence = snapshots[0].framing_confidence ?? 70;
    return {
      score: Math.min(confidence, 40), // 1라운드로는 최대 40
      trend: 'unclear',
      is_converged: false,
      estimated_rounds_left: 2,
      guidance: '첫 분석입니다. 질문에 답하면 정교해집니다.',
    };
  }

  // ── 1. 질문 안정성 (0-40점) ──
  // 질문이 라운드마다 더 구체화되는 건 설계상 의도된 GOOD 신호다(프롬프트가
  // 매 라운드 "NOTICEABLY more specific" 하라고 지시한다). 그래서 "바뀔 때마다
  // 누적 감점"하던 옛 방식은 답을 더 할수록 명확도가 단조 하락하는 비상식적
  // 결과를 낳았다. 대신 "최근으로 올수록 변화가 잦아드는가"를 본다 — 최근
  // 전환일수록 가중치를 크게 둔 유사도 평균. 질문이 안정돼 갈수록 점수가
  // 오르고, 초기 탐색기의 큰 변화는 점수를 영구히 끌어내리지 않는다.
  const questions = snapshots.map(s => s.real_question);
  let stabilityScore = 40;
  let lastSimilarity = 1;
  if (questions.length >= 2) {
    let weightedSim = 0;
    let weightSum = 0;
    for (let i = 1; i < questions.length; i++) {
      const similarity = wordOverlap(questions[i - 1], questions[i]);
      const weight = i; // 최근 전환일수록 더 무겁게 (1, 2, 3, …)
      weightedSim += similarity * weight;
      weightSum += weight;
      lastSimilarity = similarity;
    }
    const avgSimilarity = weightSum > 0 ? weightedSim / weightSum : 1;
    stabilityScore = Math.max(0, Math.round(40 * avgSimilarity));
  }

  // ── 2. 가정 감소 추세 (0-30점) ──
  const assumptionCounts = snapshots.map(s => s.hidden_assumptions.length);
  let assumptionScore = 15; // 기본
  if (assumptionCounts.length >= 2) {
    const recent = assumptionCounts.slice(-2);
    if (recent[1] <= recent[0]) {
      assumptionScore = 30; // 줄어들고 있음 → 좋음
    } else if (recent[1] > recent[0] + 2) {
      assumptionScore = 5;  // 급격히 늘어남 → 불안정
    }
  }

  // ── 3. 프레이밍 확신도 (0-30점) ──
  const latestConfidence = snapshots[snapshots.length - 1].framing_confidence ?? 70;
  const confidenceScore = Math.round(latestConfidence * 0.3);

  // ── 종합 ──
  const totalScore = Math.min(100, stabilityScore + assumptionScore + confidenceScore);

  // 추세 판단
  let trend: ConvergenceMetrics['trend'] = 'unclear';
  if (snapshots.length >= 3) {
    const recentScores = snapshots.slice(-3).map((s, i) => {
      const sim = i > 0 ? wordOverlap(questions[questions.length - 3 + i - 1], questions[questions.length - 3 + i]) : 0.5;
      return sim;
    });
    const avgSimilarity = recentScores.reduce((a, b) => a + b, 0) / recentScores.length;
    if (avgSimilarity > 0.75) trend = 'stable';
    else if (lastSimilarity > 0.7 && assumptionScore >= 20) trend = 'improving';
    else trend = 'declining';
  } else if (lastSimilarity > 0.6) {
    trend = 'improving';
  }

  const is_converged = totalScore >= 75;
  const estimated_rounds_left = is_converged ? 0 : totalScore >= 60 ? 1 : totalScore >= 40 ? 2 : 3;

  let guidance: string;
  if (is_converged) {
    guidance = '구조가 안정됐습니다. Mix로 넘어갈 수 있습니다.';
  } else if (totalScore >= 60) {
    guidance = '거의 다 왔습니다. 한 라운드만 더.';
  } else if (totalScore >= 40) {
    guidance = '방향은 잡혔지만 아직 날카롭지 않습니다.';
  } else if (trend === 'declining') {
    guidance = '질문이 계속 바뀌고 있습니다. 문제를 다시 정의해보세요.';
  } else {
    guidance = '아직 명확하지 않습니다. 질문에 답하면서 좁혀갑시다.';
  }

  return {
    score: totalScore,
    trend,
    is_converged,
    estimated_rounds_left,
    guidance,
  };
}

/* ─── Phase 4: Worker-informed convergence ─── */

export interface WorkerQualityInput {
  validationScore?: number;
  approved: boolean | null;
}

/**
 * 워커 결과를 반영한 수렴 메트릭.
 * 기존 3신호(질문/가정/확신)를 80점으로 축소하고, 워커 품질을 20점으로 추가.
 */
export function assessConvergenceWithWorkers(
  snapshots: AnalysisSnapshot[],
  workerResults?: WorkerQualityInput[],
): ConvergenceMetrics {
  const base = assessConvergence(snapshots);

  // 워커 결과 없으면 기존 로직 그대로
  if (!workerResults || workerResults.length === 0) return base;

  // 워커 품질 신호 (0-20점)
  const scored = workerResults.filter(w => w.validationScore !== undefined);
  const approved = workerResults.filter(w => w.approved === true);
  const rejected = workerResults.filter(w => w.approved === false);

  let workerQualityScore = 10; // 중립
  if (scored.length > 0) {
    const avgScore = scored.reduce((sum, w) => sum + (w.validationScore || 0), 0) / scored.length;
    if (avgScore >= 80 && rejected.length === 0) workerQualityScore = 20;
    else if (avgScore >= 60 && approved.length > rejected.length) workerQualityScore = 15;
    else if (rejected.length > approved.length) workerQualityScore = 0;
    else workerQualityScore = 10;
  } else if (approved.length > 0 && rejected.length === 0) {
    workerQualityScore = 15;
  } else if (rejected.length > approved.length) {
    workerQualityScore = 0;
  }

  // 기존 점수를 80% 스케일로 축소하고 워커 품질 추가
  const adjustedBase = Math.round(base.score * 0.8);
  const totalScore = Math.min(100, adjustedBase + workerQualityScore);
  const is_converged = totalScore >= 75;
  const estimated_rounds_left = is_converged ? 0 : totalScore >= 60 ? 1 : totalScore >= 40 ? 2 : 3;

  return {
    ...base,
    score: totalScore,
    is_converged,
    estimated_rounds_left,
    guidance: is_converged ? base.guidance : (workerQualityScore < 10 ? '워커 결과 품질이 낮습니다. 추가 라운드를 고려하세요.' : base.guidance),
  };
}
