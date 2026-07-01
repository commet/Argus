/**
 * Worker Engine — 병렬 에이전트 작업 실행 + 품질 게이트
 *
 * execution_plan의 각 step을 실제로 실행하는 엔진.
 * AI 작업은 병렬 스트리밍, human 작업은 사용자 입력 대기.
 * 각 worker는 페르소나를 가지고 전문화된 프롬프트로 실행된다.
 * 완료 후 품질 검증 → 실패 시 재시도 or 사용자 선택.
 */

import { callLLMStream } from '@/lib/llm';
import { buildWorkerTaskPrompt } from '@/lib/progressive-prompts';
import { getCurrentLanguage } from '@/lib/i18n';
import { validateWorkerOutput, checkSpecificity, type ValidationResult } from '@/lib/worker-quality';
import { validateByFramework } from '@/lib/guard-rails';
import type { WorkerTask, PipelineStage } from '@/stores/types';
import { LEVEL_CONFIGS, numericLevelToAgentLevel } from '@/lib/agent-skills';
import { useAgentStore } from '@/stores/useAgentStore';
import { XP_REWARDS } from '@/stores/agent-types';
import { buildSearchContext, type SearchResult } from '@/lib/agent-prompt-builder';
import { gatherToolContext } from '@/lib/agent-tools';
import { shouldPlan, planTask, executePlan } from '@/lib/agent-planner';
import { getAvailableCapabilities } from '@/lib/agent-delegator';
import { appendToTranscript } from '@/lib/execution-transcript';

// ─── Context ───

export interface WorkerContext {
  problemText: string;
  realQuestion: string;
  skeleton: string[];
  hiddenAssumptions: string[];
  qaHistory: Array<{ q: string; a: string }>;
  peerResults?: string;  // 이전 스테이지 완료 결과 (context-strategy의 'focused' 모드에서 사용)
  sessionId?: string;
}

// ─── Types ───

export interface WorkerTaskResult {
  text: string;
  validation?: ValidationResult;
}

// ─── Single task execution ───

export async function runWorkerTask(
  task: WorkerTask,
  context: WorkerContext,
  onStream: (text: string) => void,
  signal?: AbortSignal,
): Promise<WorkerTaskResult> {
  const baseLevel = task.level || 'junior';

  // Agent 조회 (있으면 agent context가 프롬프트에 주입됨)
  const agent = task.agent_id
    ? useAgentStore.getState().getAgent(task.agent_id)
    : undefined;

  // Agent 레벨을 반영한 effective level
  const level = agent ? numericLevelToAgentLevel(agent.level) : baseLevel;

  // ─── Agent 자율 계획 (Planning Gate) ───
  // Level 3+ 에이전트 + 복합 task → 다단계 계획 후 실행
  // Planning 실패 시 아래 기존 단일 호출로 fallback
  if (shouldPlan(task, agent) && agent) {
    try {
      const capabilities = (task.delegation_depth || 0) === 0
        ? getAvailableCapabilities(task.agent_id)
        : undefined;
      const plan = await planTask(task, context, agent, capabilities);
      const planResult = await executePlan(plan, task, context, onStream, signal);

      if (task.agent_id) {
        useAgentStore.getState().recordActivity(task.agent_id, 'task_completed', task.task, context.sessionId);
      }

      let validation: ValidationResult | undefined;
      if (task.who === 'ai') {
        try {
          validation = await validateWorkerOutput(task.task, task.expected_output, planResult.aggregated_result);
          if (task.framework && validation) {
            const guardResult = validateByFramework(task.framework, planResult.aggregated_result);
            if (!guardResult.passed) {
              validation.score = Math.min(validation.score, guardResult.score);
              validation.issues = [...validation.issues, ...guardResult.issues];
              validation.passed = validation.score >= 70;
            }
          }
          if (validation) {
            const specificity = checkSpecificity(planResult.aggregated_result, context.problemText);
            if (specificity.score < 30) {
              validation.issues = [...validation.issues, ...specificity.issues];
              validation.score = Math.min(validation.score, specificity.score + 20);
              validation.passed = validation.score >= 70;
            }
          }
        } catch {
          // 검증 실패 → 비차단
        }
      }

      return { text: planResult.aggregated_result, validation };
    } catch {
      // Planning 실패 → 기존 단일 호출로 fallback
    }
  }

  const locale = getCurrentLanguage();
  const { system, user } = buildWorkerTaskPrompt(
    task.task,
    task.expected_output,
    task.who,
    context,
    task.persona ?? undefined,
    level,
    agent,
    task.framework,
    task.task_type,
    locale,
  );

  // 에이전트 도구 컨텍스트 (메모리 회상, 관찰 요약 등)
  let toolContext = '';
  if (task.agent_id) {
    toolContext = gatherToolContext(task.agent_id, task.task);
  }

  // 웹 검색: web_search capability가 있는 에이전트만
  let searchContext = '';
  if (agent?.capabilities.includes('web_search')) {
    try {
      const results = await fetchSearchResults(task.task, locale);
      searchContext = buildSearchContext(results);
    } catch {
      // 검색 실패 시 무시 — 작업 자체는 계속 진행
    }
  }

  const finalUser = [user, toolContext, searchContext].filter(Boolean).join('\n\n');

  const text = await new Promise<string>((resolve, reject) => {
    callLLMStream(
      [{ role: 'user', content: finalUser }],
      { system, maxTokens: LEVEL_CONFIGS[level].maxTokens, model: level === 'junior' ? 'fast' : 'default', signal },
      {
        onToken: (fullText) => onStream(fullText),
        onComplete: (fullText) => resolve(fullText),
        onError: (err) => reject(err),
      },
    );
  });

  // AI 작업만 검증 (human/both는 사용자 책임)
  let validation: ValidationResult | undefined;
  if (task.who === 'ai') {
    try {
      validation = await validateWorkerOutput(task.task, task.expected_output, text);

      // 프레임워크별 guard-rails 추가 검증
      if (task.framework && validation) {
        const guardResult = validateByFramework(task.framework, text);
        if (!guardResult.passed) {
          validation.score = Math.min(validation.score, guardResult.score);
          validation.issues = [...validation.issues, ...guardResult.issues];
          validation.passed = validation.score >= 70;
        }
      }

      // 구체성 검증
      if (validation) {
        const specificity = checkSpecificity(text, context.problemText);
        if (specificity.score < 30) {
          validation.issues = [...validation.issues, ...specificity.issues];
          validation.score = Math.min(validation.score, specificity.score + 20);
          validation.passed = validation.score >= 70;
        }
      }
    } catch {
      // 검증 자체 실패 → 비차단, 결과 그대로 사용
    }
  }

  // 작업 완료 activity 기록
  if (task.agent_id) {
    useAgentStore.getState().recordActivity(
      task.agent_id,
      'task_completed',
      task.task,
      context.sessionId,
    );
  }

  return { text, validation };
}

// ─── Parallel execution with concurrency limit + quality gate ───

const MAX_CONCURRENT = 3;
const MAX_RETRIES = 1;

export async function runAllAIWorkers(
  workers: WorkerTask[],
  context: WorkerContext,
  callbacks: {
    onStart: (id: string) => void;
    onStream: (id: string, text: string) => void;
    onComplete: (id: string, result: string, validation?: ValidationResult) => void;
    onValidationFailed?: (id: string, validation: ValidationResult) => Promise<'retry' | 'skip' | 'accept'>;
    onError: (id: string, error: string) => void;
  },
  signal?: AbortSignal,
): Promise<void> {
  // v2: Include workers that need AI execution:
  // 1. AI agents (agent_type='ai' or legacy who='ai'/'both')
  // 2. Self/Human agents with ai_scope that are in ai_preparing state (AI 보조 분석)
  // 3. Skip already-completed workers (crash resume)
  const aiWorkers = workers.filter(w => {
    // Crash resume: skip workers that already completed
    if (w.status === 'done' && w.result) return false;
    const aType = w.agent_type || (w.who === 'both' ? 'ai' : w.who === 'human' ? 'self' : 'ai');
    if (aType === 'ai') return true;
    // Legacy support
    if (!w.agent_type && (w.who === 'ai' || w.who === 'both')) return true;
    // Self/Human workers with ai_scope need AI preliminary execution. Normally
    // deployWorkers() stamps them 'ai_preparing', BUT crash-resume hydration
    // resets in-flight workers ('running'/'ai_preparing') back to 'pending'
    // (useProgressiveStore sanitize). Without 'pending' here, a reload mid-run
    // left every self/human-with-ai_scope worker filtered out — aiWorkers empty,
    // the executor returned immediately, and "다시 실행" did nothing (stuck 0/N).
    if ((aType === 'self' || aType === 'human') && w.ai_scope && (w.status === 'ai_preparing' || w.status === 'pending')) return true;
    return false;
  });
  if (aiWorkers.length === 0) return;

  const queue = [...aiWorkers];

  const processQueue = async (): Promise<void> => {
    while (queue.length > 0) {
      if (signal?.aborted) return;
      const worker = queue.shift();
      if (!worker) return;

      callbacks.onStart(worker.id);

      let attempt = 0;
      let finalResult: WorkerTaskResult | null = null;

      while (attempt <= MAX_RETRIES) {
        try {
          const result = await runWorkerTask(
            worker,
            context,
            (text) => callbacks.onStream(worker.id, text),
            signal,
          );

          // 검증 통과 또는 검증 없음 → 완료
          if (!result.validation || result.validation.passed) {
            finalResult = result;
            break;
          }

          // 검증 실패
          if (attempt < MAX_RETRIES) {
            // 자동 재시도 (첫 실패)
            attempt++;
            continue;
          }

          // 최대 재시도 도달 → 검증 미통과 결과를 절대 '무음 수용'하지 않는다.
          if (callbacks.onValidationFailed) {
            const action = await Promise.race([
              callbacks.onValidationFailed(worker.id, result.validation),
              // 무응답 시 자동 수용 금지 — 생각 없이 통과시키지 않고 SKIP 처리한다.
              new Promise<'skip'>(r => setTimeout(() => r('skip'), 30_000)),
            ]);
            if (action === 'retry') {
              attempt++;
              continue;
            } else if (action === 'accept') {
              finalResult = result; // 사용자가 명시적으로 채택
              break;
            } else {
              // skip(또는 무응답): 검증 미통과 결과를 채택하지 않는다. 워커를 'running'에
              // 방치하면 또 다른 무한 스피너가 되므로, 종료 상태로 명확히 표시한다.
              callbacks.onError(
                worker.id,
                `검증 미통과로 결과를 채택하지 않았습니다 (점수 ${result.validation.score}/100)`,
              );
              break;
            }
          } else {
            // 콜백 없는 경로(현재 프로덕션): 물어볼 사용자가 없으므로 결과 텍스트는 잃지 않도록
            // 전달하되 '깨끗한 완료'로 위장하지 않는다 — validation.passed=false가 그대로 흘러가
            // WorkerCard/AgentSidebar에 점수+피드백과 함께 '검증 미통과'로 표시된다.
            finalResult = result;
            break;
          }
        } catch (err) {
          if (signal?.aborted) return;
          callbacks.onError(worker.id, err instanceof Error ? err.message : String(err));
          break;
        }
      }

      if (finalResult) {
        callbacks.onComplete(worker.id, finalResult.text, finalResult.validation);
      }
    }
  };

  const slots = Array.from(
    { length: Math.min(MAX_CONCURRENT, aiWorkers.length) },
    () => processQueue(),
  );

  await Promise.allSettled(slots);
}

// ─── Pipeline execution (Phase 3) ───

/**
 * 스테이지 기반 파이프라인 실행.
 * 스테이지 순서대로 실행하며, 이전 스테이지 결과를 다음 스테이지에 전달.
 * 스테이지 내부에서는 기존 runAllAIWorkers의 병렬 실행 재사용.
 */
export async function runPipeline(
  workers: WorkerTask[],
  stages: PipelineStage[],
  context: WorkerContext,
  callbacks: {
    onStart: (id: string) => void;
    onStream: (id: string, text: string) => void;
    onComplete: (id: string, result: string, validation?: ValidationResult) => void;
    onValidationFailed?: (id: string, validation: ValidationResult) => Promise<'retry' | 'skip' | 'accept'>;
    onError: (id: string, error: string) => void;
    onStageComplete?: (stageId: string, results: Map<string, string>) => void;
  },
  signal?: AbortSignal,
): Promise<void> {
  // 스테이지가 없으면 기존 방식으로 폴백
  if (!stages || stages.length === 0) {
    return runAllAIWorkers(workers, context, callbacks, signal);
  }

  // 스테이지 순서대로 실행 (dependsOnStageId 기반 정렬)
  const sortedStages = [...stages].sort((a, b) => {
    if (a.dependsOnStageId && !b.dependsOnStageId) return 1;
    if (!a.dependsOnStageId && b.dependsOnStageId) return -1;
    return 0;
  });

  const locale = getCurrentLanguage();
  const stageResults = new Map<string, Map<string, string>>(); // stageId → (workerId → result text)

  // Crash resume: seed stageResults with already-completed workers
  for (const w of workers) {
    if (w.status === 'done' && w.result && w.stage_id) {
      if (!stageResults.has(w.stage_id)) stageResults.set(w.stage_id, new Map());
      stageResults.get(w.stage_id)!.set(w.id, w.result);
    }
  }

  for (const stage of sortedStages) {
    if (signal?.aborted) return;

    const stageWorkers = workers.filter(w => w.stage_id === stage.id);
    if (stageWorkers.length === 0) continue;

    // 이전 스테이지 결과를 context에 주입
    // depends_on이 있으면 해당 워커 결과만 선택적 주입, 없으면 이전 스테이지 전체
    let enrichedContext = context;
    if (stage.dependsOnStageId) {
      // 모든 이전 결과를 flat map으로 수집
      const allPriorResults = new Map<string, string>();
      for (const [, resultMap] of stageResults) {
        for (const [wId, text] of resultMap) allPriorResults.set(wId, text);
      }

      // 이 스테이지 워커들의 depends_on을 합산해서 필요한 결과만 추출
      const neededIds = new Set<string>();
      for (const sw of stageWorkers) {
        if (sw.depends_on && sw.depends_on.length > 0) {
          sw.depends_on.forEach(id => neededIds.add(id));
        }
      }

      // depends_on이 명시되면 해당 워커만, 아니면 이전 스테이지 전체 (하위 호환)
      const sourceResults = neededIds.size > 0
        ? new Map(Array.from(allPriorResults).filter(([wId]) => neededIds.has(wId)))
        : stageResults.get(stage.dependsOnStageId) ?? new Map<string, string>();

      if (sourceResults.size > 0) {
        const priorText = Array.from(sourceResults.entries())
          .map(([wId, text]) => {
            const w = workers.find(w2 => w2.id === wId);
            const fallbackName = locale === 'en' ? 'Team member' : '팀원';
            const analysisLabel = locale === 'en'
              ? `[Analysis by ${w?.persona?.name || fallbackName}]`
              : `[${w?.persona?.name || fallbackName}의 분석]`;
            return `${analysisLabel}\n${text}`;
          })
          .join('\n\n---\n\n');

        enrichedContext = {
          ...context,
          peerResults: priorText,
          qaHistory: [
            ...context.qaHistory,
            { q: locale === 'en' ? "Previous team members' analysis" : '이전 팀원들의 분석 결과', a: priorText },
          ],
        };
      }
    }

    // 현재 스테이지의 결과 수집용
    const currentStageResults = new Map<string, string>();

    // 기존 runAllAIWorkers 패턴으로 스테이지 내 병렬 실행
    await runAllAIWorkers(stageWorkers, enrichedContext, {
      ...callbacks,
      onComplete: (id, result, validation) => {
        currentStageResults.set(id, result);
        callbacks.onComplete(id, result, validation);
      },
    }, signal);

    stageResults.set(stage.id, currentStageResults);
    if (context.sessionId) {
      appendToTranscript(context.sessionId, 'stage_completed', {
        stageId: stage.id,
        workerCount: currentStageResults.size,
      });
    }
    callbacks.onStageComplete?.(stage.id, currentStageResults);
  }
}

// ─── Web Search ───

async function fetchSearchResults(query: string, locale?: 'ko' | 'en'): Promise<SearchResult[]> {
  // Hard cap: web search runs BEFORE the streaming watchdog is armed, so a hung
  // Brave/socket would leave the worker 'running' forever with no recovery but a
  // reload. Best-effort — timeout degrades to no results, never blocks the worker.
  const ctl = new AbortController();
  const to = setTimeout(() => ctl.abort(), 8000);
  try {
    const res = await fetch('/api/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: query.slice(0, 300), locale: locale ?? getCurrentLanguage() }),
      signal: ctl.signal,
    });
    if (!res.ok) return [];
    const { results } = await res.json();
    return results || [];
  } catch {
    return [];
  } finally {
    clearTimeout(to);
  }
}
