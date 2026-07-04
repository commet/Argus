/**
 * Agent Autonomous Planning
 *
 * Level 3+ 에이전트가 복합 태스크를 받으면:
 * 1. 하위 단계를 자율 계획 (planTask)
 * 2. 각 단계를 순차 실행 (executePlan)
 * 3. 중간 검증 + 조기 완료 가능
 * 4. 결과 통합 (aggregation)
 *
 * shouldPlan() 게이트: 보수적 진입 (Lv.3+, 복합 task, important+ stakes 중 2/3)
 * Planning 실패 시 worker-engine의 기존 단일 호출로 fallback.
 */

import { callLLMJson, callLLMStream, callLLM } from '@/lib/llm';
import { buildWorkerTaskPrompt } from '@/lib/progressive-prompts';
import { getCurrentLanguage } from '@/lib/i18n';
import { validateWorkerOutput, type ValidationResult } from '@/lib/worker-quality';
import type { WorkerTask, AgentPlan, AgentPlanStep } from '@/stores/types';
import type { Agent } from '@/stores/agent-types';
import type { WorkerContext } from '@/lib/worker-engine';
import { numericLevelToAgentLevel } from '@/lib/agent-skills';
import { findDelegateAgent, executeDelegation, getAvailableCapabilities } from '@/lib/agent-delegator';

// ─── Types ───

export interface PlanExecutionResult {
  plan: AgentPlan;
  step_results: Array<{ step: AgentPlanStep; result: string; validation?: ValidationResult }>;
  aggregated_result: string;
}

// ─── Planning 트리거 ───

const COMPLEX_TASK_TYPES = new Set(['synthesis', 'strategy', 'analysis', 'critique', 'planning']);

export function shouldPlan(task: WorkerTask, agent?: Agent): boolean {
  if (!agent || task.who !== 'ai') return false;
  if ((task.delegation_depth || 0) >= 1) return false; // 위임 task는 planning 비활성화

  let score = 0;

  // 조건 1: Agent level >= 3
  if (agent.level >= 3) score++;

  // 조건 2: 복합형 task type
  if (task.task_type && COMPLEX_TASK_TYPES.has(task.task_type)) score++;

  // 조건 3: task 텍스트가 충분히 복잡 (100자 이상 + 2개 이상 키워드)
  const complexKeywords = ['분석', '비교', '전략', '종합', '설계', '평가', '검토', '리스크'];
  const keywordHits = complexKeywords.filter(kw => task.task.includes(kw)).length;
  if (task.task.length >= 100 || keywordHits >= 2) score++;

  // 2/3 이상 충족 시 planning 활성화
  return score >= 2;
}

// ─── Planning Prompt ───

function buildPlanningPrompt(
  task: WorkerTask,
  context: WorkerContext,
  agent: Agent,
  availableCapabilities?: string[],
  locale: 'ko' | 'en' = 'ko',
): { system: string; user: string } {
  const agentName = (locale === 'en' && agent.nameEn) ? agent.nameEn : agent.name;
  const agentRole = (locale === 'en' && agent.roleEn) ? agent.roleEn : agent.role;

  if (locale === 'ko') {
    const delegationBlock = availableCapabilities && availableCapabilities.length > 0
      ? `\n\n만약 이 작업의 일부가 너의 전문 영역이 아니라면, 해당 단계를 다른 전문가에게 위임할 수 있다.\n위임 가능 전문 분야: ${availableCapabilities.join(', ')}\n위임이 필요한 단계에는 "is_delegation": true, "delegate_capability": "분야명" 을 추가하라.`
      : '';

    const system = `너는 ${agentName} (${agentRole})이다.
주어진 작업을 2~4개의 하위 단계로 나눠서 계획을 세워라.
각 단계는 순서대로 실행되며, 이전 단계의 결과가 다음 단계에 활용된다.

규칙:
- 각 단계는 명확한 task와 expected_output이 있어야 한다
- 불필요하게 세분화하지 마라. 단일 호출로 충분하면 1개 step만 반환해도 된다
- 단계 수는 2~4개. 5개 이상은 금지
- 각 단계의 output은 구체적이고 측정 가능해야 한다
- 한국어로 응답하라${delegationBlock}

반드시 아래 JSON 형식으로만 응답:
{
  "steps": [
    { "step_number": 1, "task": "...", "expected_output": "..." }
  ],
  "reasoning": "왜 이 분해가 단일 호출보다 나은지 한 문장",
  "estimated_quality_gain": "어떤 측면의 품질이 개선되는지 한 문장"
}`;

    const user = `문제: ${context.problemText.slice(0, 500)}
핵심 질문: ${context.realQuestion.slice(0, 300)}
내 작업: ${task.task}
기대 산출물: ${task.expected_output}`;

    return { system, user };
  }

  // English
  const delegationBlock = availableCapabilities && availableCapabilities.length > 0
    ? `\n\nIf part of this task falls outside your expertise, you may delegate that step to another specialist.\nAvailable specialist capabilities: ${availableCapabilities.join(', ')}\nFor any step to be delegated, add "is_delegation": true, "delegate_capability": "<capability>".`
    : '';

  const system = `You are ${agentName} (${agentRole}).
Break the given task into 2-4 sub-steps and plan them out.
Each step runs in order; the result of one step feeds into the next.

Rules:
- Each step must have a clear task and expected_output
- Do not over-subdivide. If a single call would suffice, return just 1 step
- 2-4 steps maximum. 5+ is forbidden
- Each step's output must be specific and measurable
- Always respond in English${delegationBlock}

Respond with JSON only in this exact shape:
{
  "steps": [
    { "step_number": 1, "task": "...", "expected_output": "..." }
  ],
  "reasoning": "one sentence on why this decomposition beats a single call",
  "estimated_quality_gain": "one sentence on which quality dimension improves"
}`;

  const user = `Problem: ${context.problemText.slice(0, 500)}
Core question: ${context.realQuestion.slice(0, 300)}
My task: ${task.task}
Expected output: ${task.expected_output}`;

  return { system, user };
}

// ─── Plan 생성 ───

export async function planTask(
  task: WorkerTask,
  context: WorkerContext,
  agent: Agent,
  availableCapabilities?: string[],
): Promise<AgentPlan> {
  const locale = getCurrentLanguage();
  const { system, user } = buildPlanningPrompt(task, context, agent, availableCapabilities, locale);

  const plan = await callLLMJson<AgentPlan>(
    [{ role: 'user', content: user }],
    { system, maxTokens: 1000 },
  );

  // Validation: steps 2-4개, 각 step에 task+expected_output 필수
  if (!Array.isArray(plan.steps) || plan.steps.length === 0 || plan.steps.length > 4) {
    throw new Error('Invalid plan: steps must be 1-4');
  }
  for (const step of plan.steps) {
    if (!step.task || !step.expected_output) {
      throw new Error('Invalid plan step: missing task or expected_output');
    }
    step.step_number = step.step_number || plan.steps.indexOf(step) + 1;
  }

  return plan;
}

// ─── Plan 실행 ───

export async function executePlan(
  plan: AgentPlan,
  task: WorkerTask,
  context: WorkerContext,
  onStream: (text: string) => void,
  signal?: AbortSignal,
): Promise<PlanExecutionResult> {
  const step_results: PlanExecutionResult['step_results'] = [];
  let accumulatedContext = '';
  const locale = getCurrentLanguage();

  const LBL = locale === 'ko' ? {
    prevStepResults: '이전 단계 결과',
    stepHeader: (n: number | undefined, t: string) => `\n\n### 단계 ${n}: ${t}\n\n`,
    delegationResult: (n: number | undefined, who: string) => `\n\n[단계 ${n} 위임 결과 — ${who}]`,
    stepResult: (n: number | undefined) => `\n\n[단계 ${n} 결과]`,
    agentFallback: '에이전트',
    reasonSuffix: '전문 영역',
    aggregationKeywords: ['통합', '정리', '종합', 'integrate', 'consolidate', 'synthesize', 'summarize'],
  } : {
    prevStepResults: 'Previous step result',
    stepHeader: (n: number | undefined, t: string) => `\n\n### Step ${n}: ${t}\n\n`,
    delegationResult: (n: number | undefined, who: string) => `\n\n[Step ${n} delegated result — ${who}]`,
    stepResult: (n: number | undefined) => `\n\n[Step ${n} result]`,
    agentFallback: 'Agent',
    reasonSuffix: 'specialty area',
    aggregationKeywords: ['integrate', 'consolidate', 'synthesize', 'summarize', '통합', '정리', '종합'],
  };

  const level = numericLevelToAgentLevel(
    task.agent_id ? (await import('@/stores/useAgentStore')).useAgentStore.getState().getAgent(task.agent_id)?.level ?? 1 : 1,
  );

  let pendingValidation: Promise<{ validation: ValidationResult | undefined; stepIdx: number }> | null = null;

  for (const step of plan.steps) {
    if (signal?.aborted) break;

    // 이전 step 결과를 context에 누적 (위임/직접 실행 모두에서 사용)
    const enrichedContext: WorkerContext = {
      ...context,
      qaHistory: [
        ...context.qaHistory,
        ...(accumulatedContext ? [{ q: LBL.prevStepResults, a: accumulatedContext }] : []),
      ],
    };

    // Delegation: 다른 에이전트에게 위임
    if (step.is_delegation && step.delegate_capability && (task.delegation_depth || 0) === 0 && task.agent_id) {
      const delegate = findDelegateAgent(step.delegate_capability, new Set([task.agent_id]));
      if (delegate) {
        const agentStore = (await import('@/stores/useAgentStore')).useAgentStore.getState();
        const fromAgent = agentStore.getAgent(task.agent_id);
        const fromAgentName = fromAgent ? ((locale === 'en' && fromAgent.nameEn) ? fromAgent.nameEn : fromAgent.name) : LBL.agentFallback;
        const toAgentName = (locale === 'en' && delegate.nameEn) ? delegate.nameEn : delegate.name;
        const delegationResult = await executeDelegation(
          {
            from_agent_id: task.agent_id,
            from_agent_name: fromAgentName,
            to_agent_id: delegate.id,
            to_agent_name: toAgentName,
            capability: step.delegate_capability,
            sub_task: step.task,
            expected_output: step.expected_output,
            reason: `${step.delegate_capability} ${LBL.reasonSuffix}`,
          },
          task,
          enrichedContext,
          onStream,
          signal,
        );
        step_results.push({ step, result: delegationResult.result });
        accumulatedContext += `${LBL.delegationResult(step.step_number, toAgentName)}\n${delegationResult.result}`;
        continue;
      }
      // 위임 대상 없으면 직접 실행으로 fallthrough
    }

    const { system, user } = buildWorkerTaskPrompt(
      step.task,
      step.expected_output,
      'ai',
      enrichedContext,
      task.persona ?? undefined,
      level,
      undefined,
      task.framework,
      task.task_type,
      locale,
      task.ai_scope,
      task.self_scope,
    );

    // Stream prefix로 현재 step 표시
    onStream(LBL.stepHeader(step.step_number, step.task));

    const text = await new Promise<string>((resolve, reject) => {
      callLLMStream(
        [{ role: 'user', content: user }],
        { system, maxTokens: 2000, signal },
        {
          onToken: (fullText) => onStream(`${LBL.stepHeader(step.step_number, step.task)}${fullText}`),
          onComplete: (fullText) => resolve(fullText),
          onError: (err) => reject(err),
        },
      );
    });

    // 이전 step의 비동기 검증 결과 확인 (early stop 판단)
    if (pendingValidation) {
      const prev = await pendingValidation;
      if (prev.validation && prev.stepIdx >= 0) {
        step_results[prev.stepIdx].validation = prev.validation;
        // Early stop: 높은 품질 + 남은 step이 통합/정리만이면 중단
        if (prev.validation.score >= 90 && plan.steps.length > 1) {
          const remaining = plan.steps.filter(s => s.step_number > step.step_number);
          const isRemainingJustAggregation = remaining.length > 0 && remaining.every(s => {
            const taskLower = s.task.toLowerCase();
            return LBL.aggregationKeywords.some(kw => taskLower.includes(kw.toLowerCase()));
          });
          if (isRemainingJustAggregation) break;
        }
      }
      pendingValidation = null;
    }

    step_results.push({ step, result: text });
    accumulatedContext += `${LBL.stepResult(step.step_number)}\n${text}`;

    // 검증을 비동기로 시작 — 다음 step과 병렬 실행
    const stepIdx = step_results.length - 1;
    pendingValidation = validateWorkerOutput(step.task, step.expected_output, text)
      .then(v => ({ validation: v, stepIdx }))
      .catch(() => ({ validation: undefined, stepIdx }));
  }

  // 마지막 step의 비동기 검증 결과 수집
  if (pendingValidation) {
    const last = await pendingValidation;
    if (last.validation && last.stepIdx >= 0 && last.stepIdx < step_results.length) {
      step_results[last.stepIdx].validation = last.validation;
    }
  }

  // 결과 통합 (step이 2개 이상일 때만)
  const completedResults = step_results.filter(r => r.result);
  let aggregated: string;

  if (completedResults.length <= 1) {
    aggregated = completedResults[0]?.result || '';
  } else {
    aggregated = await aggregateResults(
      completedResults.map(r => `[${r.step.task}]\n${r.result}`),
      task.task,
      task.expected_output,
      locale,
    );
    onStream(aggregated);
  }

  return { plan, step_results, aggregated_result: aggregated };
}

// ─── 결과 통합 ───

async function aggregateResults(
  stepResults: string[],
  originalTask: string,
  expectedOutput: string,
  locale: 'ko' | 'en' = 'ko',
): Promise<string> {
  if (locale === 'ko') {
    const system = `아래는 하나의 작업을 여러 단계로 나눠 실행한 결과들이다.
이것들을 하나의 일관된 산출물로 통합하라.

규칙:
- 중복을 제거하고 핵심만 남겨라
- 원래 기대 산출물 형식에 맞춰라
- 단계 구분 없이 하나의 완성된 문서로 작성하라
- 한국어로 작성`;

    const user = `원래 작업: ${originalTask}
기대 산출물: ${expectedOutput}

─── 단계별 결과 ───
${stepResults.join('\n\n---\n\n')}`;

    return callLLM(
      [{ role: 'user', content: user }],
      { system, maxTokens: 3000 },
    );
  }

  const system = `Below are the step-by-step results of one task split into multiple stages.
Integrate them into a single, coherent deliverable.

Rules:
- Remove duplication; keep only the essential content
- Match the original expected-output format
- Write as one completed document, without step markers
- Write in English`;

  const user = `Original task: ${originalTask}
Expected output: ${expectedOutput}

─── Step-by-step results ───
${stepResults.join('\n\n---\n\n')}`;

  return callLLM(
    [{ role: 'user', content: user }],
    { system, maxTokens: 3000 },
  );
}
