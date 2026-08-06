// 실행 계획 — 결정과 현실 사이의 다리 (제품 기획안 §3).
//
// 이 모듈이 존재하는 이유 하나: **계획의 마일스톤을 귀환 계약으로 바꾸는 것.**
// 그 전까지 귀환은 사용자가 따로 받아들여야 하는 부담이었다("돌아보기를
// 예약하시겠습니까?"). 계획이 있으면 날짜가 이미 있으므로 귀환이 공짜로 따라온다.
// 미끼(계획)의 모든 부분이 해자(정산)로 이어지게 만든다는 전략이 여기서 코드가 된다.
//
// 경계 셋 — 전부 방법 정본에서 온다:
//  1. 계획은 채택된 카드에만 붙는다 (`process` 추천은 결정 이후의 것).
//  2. 계획을 만드는 것은 AI, 채택하는 것은 사용자 (§AUTHORITY).
//  3. 모르는 것은 openQuestions로 남긴다 — 지어낸 단계로 채우지 않는다.

import {
  type CaseState,
  type ExecutionPlan,
  HarnessViolation,
  type IsoTime,
  type PlanStep,
  type ReturnContractDraft,
} from './types';

export const DEFAULT_HORIZON_DAYS = 21;

// 한 계획이 만들 수 있는 귀환의 상한. 없으면 12단계 계획이 12번의 알림이 되고,
// 그것이 전역 예산(3건)을 혼자 다 먹는다. 계획은 상세할 수 있지만 **정산 약속은
// 드물어야 한다** — 과발화 방지가 여기에도 적용된다.
export const MAX_RETURNS_PER_PLAN = 3;

export interface PlanValidation {
  ok: boolean;
  problems: string[];
}

// 계획 자체의 정합성. 방법 위반이 아니라 형태 오류를 잡는다 — 모델이 낸 계획이
// 조용히 반쪽짜리로 저장되는 것을 막는다.
export function validatePlan(plan: ExecutionPlan, now?: IsoTime): PlanValidation {
  const problems: string[] = [];
  if (plan.steps.length === 0) {
    problems.push('계획에 단계가 하나도 없다 — 계획을 낼 수 없으면 openQuestions로 이유를 남겨야 한다');
  }
  // now를 아는 호출자만 과거 기한을 검사한다. 하네스는 시계를 읽지 않으므로
  // (§types 상단) 시각은 언제나 주입받는다 — 여기서 Date.now()를 부르면
  // 원장 재생이 실행 시각에 따라 달라진다.
  const nowMs = now ? new Date(now).getTime() : null;
  plan.steps.forEach((s, i) => {
    if (!s.what.trim()) problems.push(`단계 ${i + 1}: 무엇을 할지가 비어 있다`);
    if (!s.byOrWhen.trim()) problems.push(`단계 ${i + 1}: 언제까지인지가 비어 있다`);
    if (s.dueDate && Number.isNaN(new Date(s.dueDate).getTime())) {
      problems.push(`단계 ${i + 1}: dueDate가 날짜가 아니다 (${s.dueDate})`);
    } else if (s.dueDate && nowMs !== null && !Number.isNaN(nowMs) && new Date(s.dueDate).getTime() < nowMs) {
      // 과거 기한은 조용히 통과시키지 않는다. 통과시키면 방금 세운 계획이
      // 곧바로 "돌아볼 때가 됐다"고 알리는 과발화가 되고, 사용자는 아직
      // 아무것도 하지 않았으므로 정산할 것도 없다.
      problems.push(`단계 ${i + 1}: dueDate가 이미 지난 날짜다 (${s.dueDate}) — 앞으로 확인할 날짜여야 한다`);
    }
  });
  if (plan.horizonDays <= 0) problems.push('horizonDays는 양수여야 한다');
  return { ok: problems.length === 0, problems };
}

// 계획을 채택할 수 있는 상태인가. 카드가 없으면 계획은 의미가 없다 —
// 아직 사용자의 결정이 아닌 것에 실행 순서를 붙이는 셈이기 때문이다.
export function assertPlanAllowed(state: CaseState): void {
  if (!state.card) {
    throw new HarnessViolation(
      'PLAN_WITHOUT_ADOPTED_CARD',
      '실행 계획은 채택된 결정에만 붙는다 (process 추천은 결정 이후의 것). 먼저 카드를 채택하라.',
    );
  }
  if (state.state === 'STOPPED') {
    throw new HarnessViolation('PLAN_ON_STOPPED_CASE', '멈추기로 한 결정에 실행 계획을 붙이지 않는다.');
  }
}

// ---------------------------------------------------------------------------
// 이 파일의 심장: 마일스톤 → 귀환 계약
// ---------------------------------------------------------------------------

export interface PlannedReturn {
  contract: ReturnContractDraft;
  fromStep: string; // 어느 단계에서 나왔는지 — 사용자에게 이유를 말할 수 있어야 한다
}

// 날짜가 붙은 단계만 귀환이 된다. 상한을 넘으면 **가장 이른 것들**을 남긴다:
// 먼 미래의 약속보다 곧 닥칠 약속이 정산 가치가 높고, 사용자가 실제로 기억한다.
//
// 첫 귀환은 `commitment`(행동을 시작했는가), 나머지는 `outcome`(결과가 나왔는가)이다.
// 이 구분이 §7.3의 관찰 우선 규칙과 맞물린다 — 첫 확인은 실행 여부만 묻는다.
export function returnsFromPlan(plan: ExecutionPlan, max: number = MAX_RETURNS_PER_PLAN): PlannedReturn[] {
  const dated = plan.steps
    .filter((s): s is PlanStep & { dueDate: IsoTime } => Boolean(s.dueDate))
    .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
    .slice(0, max);

  return dated.map((step, i) => ({
    fromStep: step.what,
    contract: {
      kind: i === 0 ? 'commitment' : 'outcome',
      trigger: { type: 'date', date: step.dueDate },
      expectedSignal: i === 0 ? undefined : step.what,
    },
  }));
}

// 계획이 잘렸는지 사용자에게 말할 수 있어야 한다 (no-silent-caps).
export function planReturnSummary(plan: ExecutionPlan, max: number = MAX_RETURNS_PER_PLAN): string {
  const datedCount = plan.steps.filter((s) => s.dueDate).length;
  const used = Math.min(datedCount, max);
  if (datedCount === 0) return '기한이 붙은 단계가 없어 돌아보기가 예약되지 않았습니다.';
  const base = `${used}번의 돌아보기가 예약되었습니다.`;
  return datedCount > max
    ? `${base} (기한이 있는 단계는 ${datedCount}개지만, 알림이 과해지지 않도록 가장 이른 ${max}개만 잡았습니다.)`
    : base;
}
