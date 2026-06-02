/**
 * orchestrator.ts — 오케스트레이터 진입점
 *
 * classifyInput → selectAgents → assignFramework → buildStages 를 조합.
 * LLM 호출 없음. 결정론적.
 */

import type { InterviewSignals, PipelineStage } from '@/stores/types';
import type { Agent, AgentObservation } from '@/stores/agent-types';
import { classifyInput } from './orchestrator-classify';
import type { InputClassification } from './orchestrator-classify';
import { selectAgents } from './orchestrator-select';
import type { SelectionTrace } from './orchestrator-select';
import { assignFramework } from './orchestrator-framework';
import { classifySteps } from './task-classifier';
import { buildAssignmentReason } from './assignment-reason';

/* ─── Types ─── */

export interface PlannedWorker {
  agentId: string;
  framework: string | null;
  focus: string;
  expectedOutput: string;
  who: string;
  agentType: 'ai' | 'self' | 'human';  // v2 agent type
  aiScope: string;
  selfScope: string;
  decision: string;
  questionToHuman: string;
  humanContactHint: string;
  stepIndex: number;
  stageId: string;
  taskType: string | null;     // task-classifier의 TaskType (context 전략 결정)
  dependsOn?: number[];        // 의존하는 워커의 stepIndex[] (runPipeline에서 선택적 peerResults 주입)
  assignmentReason?: string;   // "왜 이 에이전트인지" — SelectionTrace에서 도출한 한 줄 (ai 타입만)
}

export interface OrchestratorResult {
  classification: InputClassification;
  workers: PlannedWorker[];
  stages: PipelineStage[];
}

/* ─── Stage Builder ─── */

/**
 * 워커를 스테이지로 배치.
 * - routine/important: 단일 스테이지 (전부 병렬)
 * - critical: 2스테이지 — Stage 1(도메인 전문가 병렬) → Stage 2(Critic이 Stage 1 결과 검토)
 */
function buildStages(
  workers: PlannedWorker[],
  classification: InputClassification,
): { workers: PlannedWorker[]; stages: PipelineStage[] } {
  if (classification.stakes !== 'critical' || workers.length < 2) {
    // 단일 스테이지: 전부 병렬
    const stageId = 'stage_1';
    const updated = workers.map(w => ({ ...w, stageId }));
    const stages: PipelineStage[] = [{
      id: stageId,
      label: '분석',
      labelEn: 'Analysis',
      workerIds: updated.map((_, i) => `w_${i}`), // 실제 ID는 initWorkers에서 부여
      status: 'pending',
    }];
    return { workers: updated, stages };
  }

  // Critical: Critic을 Stage 2로 분리
  const criticIdx = workers.findIndex(w => {
    // validation group의 리스크 관련 에이전트
    const kws = ['리스크', '위험', '실패', '비판', 'risk', 'danger', 'failure', 'critique', 'review', 'validate'];
    const focusLower = w.focus.toLowerCase();
    return kws.some(kw => focusLower.includes(kw)) || w.framework?.includes('Pre-mortem') || w.framework?.includes('Red Team');
  });

  // Critic이 명확하지 않으면 마지막 워커를 Stage 2로
  const stage2Idx = criticIdx >= 0 ? criticIdx : workers.length - 1;

  const stage1Workers = workers.filter((_, i) => i !== stage2Idx).map(w => ({ ...w, stageId: 'stage_1' }));
  // Stage 2 critic depends on all Stage 1 workers
  const stage1Indices = stage1Workers.map(w => w.stepIndex);
  const stage2Workers = [{ ...workers[stage2Idx], stageId: 'stage_2', dependsOn: stage1Indices }];

  const stages: PipelineStage[] = [
    {
      id: 'stage_1',
      label: '분석',
      labelEn: 'Analysis',
      workerIds: stage1Workers.map((_, i) => `w_${i}`),
      status: 'pending',
    },
    {
      id: 'stage_2',
      label: '검증',
      labelEn: 'Validation',
      workerIds: [`w_${stage2Idx}`],
      status: 'pending',
      dependsOnStageId: 'stage_1',
    },
  ];

  return { workers: [...stage1Workers, ...stage2Workers], stages };
}

/* ─── Main ─── */

export function planWorkers(
  steps: { task: string; who?: string; agent_type?: string; output: string; agent_hint?: string; ai_scope?: string; self_scope?: string; decision?: string; question_to_human?: string; human_contact_hint?: string }[],
  signals: InterviewSignals | undefined,
  unlockedAgents: Agent[],
  observations: AgentObservation[],
): OrchestratorResult {
  // 1. 입력 분류
  const problemText = steps.map(s => s.task).join(' ');
  const classification = classifyInput(problemText, steps, signals);

  // Resolve agent_type for each step (v2 > legacy fallback)
  const resolvedSteps = steps.map(s => {
    const agentType = (s.agent_type as 'ai' | 'self' | 'human')
      || (s.who === 'both' ? 'ai' : s.who === 'human' ? 'self' : 'ai');
    return { ...s, agentType };
  });

  // 2. 에이전트 선택 — ai 타입만 배정, self/human은 skip
  const aiSteps = resolvedSteps
    .map((s, i) => ({ ...s, originalIndex: i }))
    .filter(s => s.agentType === 'ai');

  const traces: SelectionTrace[] = [];
  const agentMap = aiSteps.length > 0
    ? selectAgents(
        aiSteps.map(s => ({ task: s.task, output: s.output, agent_hint: s.agent_hint })),
        classification,
        unlockedAgents,
        observations,
        problemText,
        traces,
      )
    : new Map<number, Agent>();

  // Remap agent selections back to original step indices
  const originalAgentMap = new Map<number, Agent>();
  aiSteps.forEach((s, mappedIdx) => {
    const agent = agentMap.get(mappedIdx);
    if (agent) originalAgentMap.set(s.originalIndex, agent);
  });

  // Derive the why-this-agent rationale per original step index, from the
  // traces the router just produced. trace.stepIndex is the index *within*
  // aiSteps, so map it back through aiSteps[].originalIndex.
  const agentsById = new Map(unlockedAgents.map(a => [a.id, a]));
  const reasonByOriginalIndex = new Map<number, string>();
  for (const tr of traces) {
    const aiStep = aiSteps[tr.stepIndex];
    if (!aiStep) continue;
    reasonByOriginalIndex.set(aiStep.originalIndex, buildAssignmentReason(tr, agentsById));
  }

  // 3. Task 분류 (context 전략 결정용)
  const taskClassifications = classifySteps(
    steps.map(s => ({ task: s.task, output: s.output })),
    problemText,
  );

  // 4. 프레임워크 배정 + task type 설정
  const rawWorkers: PlannedWorker[] = resolvedSteps.map((step, i) => {
    const agent = originalAgentMap.get(i);
    const agentId = agent?.id || '';
    const framework = agent ? assignFramework(agentId, step.task, classification) : null;
    const tc = taskClassifications[i];

    return {
      agentId,
      framework,
      focus: step.task,
      expectedOutput: step.output,
      who: step.who || (step.agentType === 'self' ? 'human' : step.agentType === 'human' ? 'human' : 'ai'),
      agentType: step.agentType,
      aiScope: step.ai_scope || '',
      selfScope: step.self_scope || '',
      decision: step.decision || '',
      questionToHuman: step.question_to_human || '',
      humanContactHint: step.human_contact_hint || '',
      stepIndex: i,
      stageId: 'stage_1',
      taskType: tc?.taskType || null,
      assignmentReason: reasonByOriginalIndex.get(i),
    };
  });

  // 4. 스테이지 배치
  const { workers, stages } = buildStages(rawWorkers, classification);

  return { classification, workers, stages };
}
