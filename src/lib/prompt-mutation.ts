/**
 * Prompt Mutation — Phase 4B (자가 개선)
 *
 * Eval 결과 패턴을 분석하여 시스템 프롬프트에
 * 자동 보정 지시를 추가한다.
 */

import { getStorage } from '@/lib/storage';
import type { EvalResult, EvalTool } from '@/lib/eval-engine';

const EVAL_STORAGE_KEYS: Record<EvalTool, string> = {
  reframe: 'argus_eval_results',
  recast: 'argus_eval_recast',
  'rehearse': 'argus_eval_rehearsal',
  refine: 'argus_eval_refine',
};

const MIN_SAMPLES = 5;
const FAILURE_THRESHOLD = 0.4;

interface PromptMutation { evalId: string; instruction: string; passRate: number }

export function getWorstPerformingEvals(tool: EvalTool = 'reframe'): PromptMutation[] {
  const history = getStorage<EvalResult[]>(EVAL_STORAGE_KEYS[tool], []);
  if (history.length < MIN_SAMPLES) return [];
  const recent = history.slice(-20);
  const evalStats: Record<string, { pass: number; total: number }> = {};
  for (const result of recent) { for (const [evalId, passed] of Object.entries(result.evals)) { if (!evalStats[evalId]) evalStats[evalId] = { pass: 0, total: 0 }; evalStats[evalId].total++; if (passed) evalStats[evalId].pass++; } }
  const mutations: PromptMutation[] = [];
  for (const [evalId, stats] of Object.entries(evalStats)) { const passRate = stats.pass / stats.total; if (passRate >= FAILURE_THRESHOLD) continue; const instruction = MUTATION_MAP[evalId]; if (instruction) mutations.push({ evalId, instruction, passRate }); }
  return mutations.sort((a, b) => a.passRate - b.passRate);
}

export function applyPromptMutations(basePrompt: string, tool: EvalTool = 'reframe'): string {
  const mutations = getWorstPerformingEvals(tool);
  if (mutations.length === 0) return basePrompt;
  return `${basePrompt}\n\n[자동 보정 — eval 기반]\n${mutations.slice(0, 2).map(m => m.instruction).join('\n')}`;
}

const MUTATION_MAP: Record<string, string> = {
  // Reframe
  question_accepted: '- hidden_questions를 더 실용적이고 구체적으로 만드세요. 사용자가 바로 채택할 수 있는 질문이어야 합니다.',
  assumptions_engaged: '- hidden_assumptions를 실제 업무 맥락과 연결하세요. "만약 ~가 아니라면, 전략이 바뀝니다"처럼 판단에 직접 연결되는 전제를 찾으세요.',
  no_immediate_reanalyze: '- 첫 분석에서 충분한 깊이를 제공하세요. 사용자가 바로 재분석을 요청하면 초기 분석이 피상적인 것입니다.',
  has_useful_assumptions: '- 미확인 전제를 더 적극적으로 찾으세요. "당연하다고 생각하지만 실제로 검증하지 않은 것"을 찾아내세요.',
  assumptions_diverse: '- 전제들이 같은 축에 편중되어 있습니다. 고객 가치, 실행 가능성, 사업성, 조직 역량 중 서로 다른 축에서 전제를 찾으세요.',
  // Recast
  steps_accepted: '- 워크플로우 단계를 수정 없이 바로 활용할 수 있도록 설계하세요. 3-7개 단계가 적절합니다.',
  actor_overrides_low: '- actor 배정을 더 신중하게 하세요. 4가지 판단 기준을 엄격히 적용하세요.',
  has_key_assumptions: '- 이 계획이 성립하려면 참이어야 할 핵심 가정을 반드시 2개 이상 명시하세요.',
  has_design_rationale: '- 왜 이 순서인지, 왜 이 역할 배정인지 설계 근거를 반드시 설명하세요.',
  // Rehearsal
  critical_risks_found: '- 핵심(critical) 리스크를 반드시 식별하세요. "해결 안 하면 진행 불가"인 리스크가 없다면 너무 낙관적입니다.',
  unspoken_risks_surfaced: '- 모두 알지만 아무도 안 꺼내는 문제(unspoken)를 반드시 1개 이상 찾으세요.',
  persona_views_diverse: '- 다른 페르소나와 차별화된 관점을 제시하세요. 같은 리스크만 지적하면 다관점 검증의 의미가 없습니다.',
  approval_conditions_clear: '- 구체적이고 검증 가능한 승인 조건을 제시하세요. "ROI 30% 이상 시뮬레이션" 같은 측정 가능한 조건이어야 합니다.',
  // Refine
  converged_efficiently: '- 초기 수정에서 핵심 이슈를 정확히 타격하세요. 3회 이상 반복 필요시 근본 원인을 다루고 있지 않을 수 있습니다.',
  issues_trending_down: '- 수정 시 새로운 이슈를 만들지 마세요. 파급 효과를 고려하세요.',
  critical_resolved: '- 핵심(critical) 리스크 해소를 최우선으로 하세요.',
  approval_conditions_met: '- 고영향력 이해관계자의 승인 조건에 직접 대응하는 수정을 하세요.',
};
