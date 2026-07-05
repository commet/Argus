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
import { planOrchestration, type OrchestrationPlan } from './orchestration-pattern';
import { isCriticAgentId } from './agent-capabilities';

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
  orchestrationPlan: OrchestrationPlan;   // chosen collaboration pattern + verify depth
}

/* ─── Stage Builder ─── */

/**
 * 워커를 스테이지로 배치. 패턴은 planOrchestration이 결정한다:
 * - single / parallel: 단일 스테이지 (전부 병렬) — navigator review가 경량 검증을 담당
 * - review_loop: 2스테이지 — Stage 1(병렬) → Stage 2(Critic이 검토) — deep 검증 + debate 점화
 *   (review_loop는 critical에 더해 on_fire(위기)·확증편향 케이스까지 포함 — 기존 critical보다 넓음)
 */
/**
 * F4 — layer workers into an N-stage DAG by their declared producer→consumer
 * `dependsOn` (Kahn longest-path: layer = 1 + max(dep layers), no-deps = layer 0).
 * Each layer becomes a stage in topological order; a stage depends on the one
 * before it, and every worker keeps its own `dependsOn` so runPipeline injects
 * exactly the right upstream results and the Layer-0 gate can fire. Returns null
 * on a dependency CYCLE — the caller then falls back to the pattern logic rather
 * than trusting a malformed plan to order execution.
 */
export function layerWorkersByDeps(
  workers: PlannedWorker[],
): { workers: PlannedWorker[]; stages: PipelineStage[] } | null {
  const byStep = new Map(workers.map(w => [w.stepIndex, w]));
  const layerOf = new Map<number, number>();
  const onPath = new Set<number>();
  const resolve = (idx: number): number | null => {
    const cached = layerOf.get(idx);
    if (cached !== undefined) return cached;
    if (onPath.has(idx)) return null; // cycle
    onPath.add(idx);
    const deps = (byStep.get(idx)?.dependsOn ?? []).filter(d => byStep.has(d));
    let maxDep = -1;
    for (const d of deps) {
      const dl = resolve(d);
      if (dl === null) return null;   // cycle propagates up
      if (dl > maxDep) maxDep = dl;
    }
    onPath.delete(idx);
    const l = maxDep + 1;
    layerOf.set(idx, l);
    return l;
  };
  for (const w of workers) {
    if (resolve(w.stepIndex) === null) return null; // reject cyclic plan
  }

  const maxLayer = Math.max(0, ...[...layerOf.values()]);
  const outWorkers: PlannedWorker[] = [];
  const stages: PipelineStage[] = [];
  for (let l = 0; l <= maxLayer; l++) {
    const inLayer = workers.filter(w => layerOf.get(w.stepIndex) === l);
    if (inLayer.length === 0) continue;
    const stageId = `stage_${l + 1}`;
    for (const w of inLayer) outWorkers.push({ ...w, stageId });
    stages.push({
      id: stageId,
      label: l === 0 ? '분석' : '이어받기',
      labelEn: l === 0 ? 'Analysis' : 'Build on prior',
      workerIds: inLayer.map((w) => `w_${w.stepIndex}`),
      status: 'pending',
      dependsOnStageId: l === 0 ? undefined : `stage_${l}`,
    });
  }
  return { workers: outWorkers, stages };
}

function buildStages(
  workers: PlannedWorker[],
  classification: InputClassification,
  userLeaning = false,
): { workers: PlannedWorker[]; stages: PipelineStage[]; plan: OrchestrationPlan } {
  // Pattern/verify gates key off the AI worker count, not the raw step count —
  // self/human confirmation steps must not inflate single/light into parallel/standard.
  const aiCount = workers.filter(w => w.agentType === 'ai').length;
  const plan = planOrchestration(classification, aiCount, { userLeaning });

  // F4 — if the planner declared producer→consumer deps, run an N-stage DAG
  // (topological layering) so a later lens reads the real output of the one it
  // depends on. Skipped for the critical-stakes review_loop (its proven Critic
  // guarantee wins there) and on a cyclic plan (layerWorkersByDeps → null →
  // fall through). No declared deps → unchanged behavior below.
  const hasDeclaredDeps = workers.some(w => (w.dependsOn?.length ?? 0) > 0);
  if (hasDeclaredDeps && plan.pattern !== 'review_loop') {
    const layered = layerWorkersByDeps(workers);
    if (layered && layered.stages.length > 1) return { ...layered, plan };
  }

  if (plan.pattern !== 'review_loop' || aiCount < 2) {
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
    return { workers: updated, stages, plan };
  }

  // review_loop: Critic을 Stage 2로 분리. critic은 반드시 AI 워커여야 한다 —
  // self/human 워커가 critic으로 뽑히면 worker-engine이 stage_2를 0개 실행하고
  // (aiWorkers.length===0) "검증" 스테이지가 에러 없이 침묵 속에 증발한다.
  // Single source of truth (isCriticAgentId) — same agent the selector reserved
  // as the critic and the same one runDebate will run, so UI stage-2 = actual
  // reviewer. (Was a separate focus-keyword heuristic that could pick a different
  // worker — e.g. a "고객 리뷰 분석" step matched 'review'.)
  const criticIdx = workers.findIndex(w => w.agentType === 'ai' && isCriticAgentId(w.agentId));

  // Critic이 명확하지 않으면 마지막 AI 워커를 Stage 2로 (self/human은 검증 못 함)
  let lastAiIdx = -1;
  for (let i = workers.length - 1; i >= 0; i--) { if (workers[i].agentType === 'ai') { lastAiIdx = i; break; } }
  const stage2Idx = criticIdx >= 0 ? criticIdx : lastAiIdx;

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

  return { workers: [...stage1Workers, ...stage2Workers], stages, plan };
}

/* ─── Main ─── */

export function planWorkers(
  steps: { task: string; who?: string; agent_type?: string; output: string; agent_hint?: string; ai_scope?: string; self_scope?: string; decision?: string; question_to_human?: string; human_contact_hint?: string; depends_on?: number[] }[],
  signals: InterviewSignals | undefined,
  unlockedAgents: Agent[],
  observations: AgentObservation[],
  /** The user already typed a pre-AI lean (Bind rope) — confirmation-bias risk,
   *  feeds verify depth via planOrchestration. Default false = unchanged behavior. */
  userLeaning = false,
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
      // F4 — the planner-declared producer→consumer deps, sanitized against a bad
      // LLM emission (out-of-range / self-reference dropped). buildStages layers
      // stages from these; the Layer-0 ready-gate reads them at run time.
      dependsOn: (step.depends_on ?? []).filter(
        d => Number.isInteger(d) && d >= 0 && d < resolvedSteps.length && d !== i,
      ),
    };
  });

  // 4. 스테이지 배치 (패턴 + 검증 깊이 결정)
  const { workers, stages, plan } = buildStages(rawWorkers, classification, userLeaning);

  return { classification, workers, stages, orchestrationPlan: plan };
}
