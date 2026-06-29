/**
 * assignment-reason.ts — "왜 이 에이전트인지" 한 줄 설명.
 *
 * orchestrator-select가 step마다 계산하는 SelectionTrace(선택된 에이전트 +
 * 후보들의 점수 분해)는 지금까지 계산만 되고 버려졌다. 이 파일은 그 trace를
 * 사용자가 읽을 수 있는 한 줄로 옮긴다 — "소환의 이유"를 선장에게 공개하기
 * 위한 최소 어휘.
 *
 * 원칙:
 *  - 정직: task 분류(taskType·contextDomain)는 라우터가 실제 사용한 근거이고,
 *    runner-up은 trace.scores[1]에서 그대로 읽는다. 추측하지 않는다.
 *  - 절제: 한 줄. 원점수(0.x) 같은 기계적 숫자는 노출하지 않는다 — 크기가
 *    작고 혼란만 준다. "무엇에 적합한지 + 다음 후보"면 충분하다.
 *  - 순수 함수: 스토어/부수효과 없음. locale은 i18n에서 읽어 단위 테스트 가능.
 */

import type { Agent } from '@/stores/agent-types';
import type { TaskType, ContextDomain } from './task-classifier';
import type { SelectionTrace } from './orchestrator-select';
import { getCurrentLanguage } from '@/lib/i18n';

// [ko, en]
const TASK_TYPE_LABELS: Record<TaskType, [string, string]> = {
  research: ['조사', 'research'],
  analysis: ['분석', 'analysis'],
  synthesis: ['종합', 'synthesis'],
  strategy: ['전략', 'strategy'],
  calculation: ['수치 분석', 'modeling'],
  writing: ['문서 작성', 'writing'],
  critique: ['검증', 'critique'],
  design: ['설계', 'design'],
  legal_review: ['법적 검토', 'legal review'],
  planning: ['기획', 'planning'],
};

const DOMAIN_LABELS: Record<ContextDomain, [string, string]> = {
  market: ['시장', 'market'],
  finance: ['재무', 'finance'],
  tech: ['기술', 'tech'],
  legal: ['법률', 'legal'],
  ux: ['UX', 'UX'],
  ops: ['운영', 'ops'],
  people: ['조직·인사', 'people'],
  product: ['제품', 'product'],
  brand: ['브랜드', 'brand'],
};

/**
 * Build a one-line rationale for why this agent was assigned to a step.
 * Reads the task classification the router actually used, plus the runner-up
 * (if any) straight from the trace. Returns a localized string.
 */
export function buildAssignmentReason(
  trace: SelectionTrace,
  agentsById: Map<string, Agent>,
): string {
  const ko = getCurrentLanguage() === 'ko';

  // Force-added agents (e.g. the critical-stakes Critic) weren't chosen by
  // capability fit — say why they're really here instead of a misleading
  // "best fit for X" line.
  if (trace.forced) {
    return ko ? '고위험 결정이라 검증 담당으로 합류' : 'Added as a risk reviewer for this high-stakes call';
  }

  const tc = trace.taskClassification;
  const task = TASK_TYPE_LABELS[tc.taskType]?.[ko ? 0 : 1] || tc.taskType;
  const domain = DOMAIN_LABELS[tc.contextDomain]?.[ko ? 0 : 1] || tc.contextDomain;

  const core = ko ? `${domain} ${task}에 가장 적합` : `Best fit for ${domain} ${task}`;

  // Runner-up: the next-highest scorer, if it scored at all and isn't the
  // selected agent. Names come from the unlocked-agent map.
  const runner = trace.scores.find(
    (s) => s.agentId !== trace.selectedAgent && s.total > 0,
  );
  const runnerName = runner ? agentsById.get(runner.agentId)?.name : undefined;
  if (runnerName) {
    return ko ? `${core} · 차순위 ${runnerName}` : `${core} · runner-up ${runnerName}`;
  }
  return core;
}
