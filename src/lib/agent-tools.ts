/**
 * agent-tools.ts — 에이전트 도구 실행 시스템
 *
 * 에이전트가 "다른 프롬프트를 가진 같은 LLM"이 아니라
 * 실제 도구를 가진 에이전트가 되게 하는 레이어.
 *
 * 도구 종류:
 * 1. calculate — 수식 계산 (민재 Numbers용)
 * 2. memory_recall — 과거 세션에서 관련 작업 검색
 * 3. web_search — 기존 웹 검색 (worker-engine.ts에서 이미 지원)
 * 4. fact_check — 결과물 내 수치/주장의 자기검증 프롬프트 생성
 *
 * LLM이 도구를 "호출"하는 게 아니라,
 * 에이전트 실행 전에 관련 도구 결과를 컨텍스트에 주입하는 방식.
 * = "pre-loaded tools" 패턴 (실행 전 컨텍스트 강화)
 */

import { getStorage, STORAGE_KEYS } from '@/lib/storage';
import { useAgentStore } from '@/stores/useAgentStore';
import type { Agent, AgentObservation } from '@/stores/agent-types';

/* ─── Types ─── */

export interface ToolResult {
  toolId: string;
  toolName: string;
  content: string;
}

/* ─── Tool 1: Memory Recall — 과거 작업 기억 ─── */

interface PastSession {
  problem_text: string;
  workers: Array<{
    agent_id?: string;
    task: string;
    result: string | null;
    approved: boolean | null;
  }>;
}

/**
 * 이 에이전트의 과거 성공 작업 중 현재 task와 관련된 것을 검색.
 * 키워드 기반 유사도 (간단하지만 효과적).
 */
function recallPastWork(agentId: string, currentTask: string, maxResults: number = 2): ToolResult | null {
  const sessions = getStorage<PastSession[]>(STORAGE_KEYS.PROGRESSIVE_SESSIONS, []);

  const taskWords = new Set(
    currentTask.replace(/[?.!,]/g, '').split(/\s+/).filter(w => w.length >= 2)
  );

  // 이 에이전트의 과거 승인된 작업 중 유사한 것 검색
  const relevantWork: { task: string; result: string; overlap: number }[] = [];

  for (const session of sessions) {
    for (const worker of session.workers) {
      if (worker.agent_id !== agentId) continue;
      // Align with the mix policy (mixableWorkerResults): only an explicit
      // captain rejection excludes work. approved === null is the normal state
      // for focus-mode results — skipping those made every focus session
      // invisible to recall.
      if (worker.approved === false || !worker.result) continue;

      const workerWords = new Set(
        worker.task.replace(/[?.!,]/g, '').split(/\s+/).filter(w => w.length >= 2)
      );

      let overlap = 0;
      for (const w of taskWords) {
        if (workerWords.has(w)) overlap++;
      }

      if (overlap >= 2) {
        relevantWork.push({ task: worker.task, result: worker.result, overlap });
      }
    }
  }

  if (relevantWork.length === 0) return null;

  relevantWork.sort((a, b) => b.overlap - a.overlap);
  const top = relevantWork.slice(0, maxResults);

  const content = top.map(w =>
    `[이전 작업: ${w.task}]\n${w.result.slice(0, 400)}${w.result.length > 400 ? '...' : ''}`
  ).join('\n\n');

  return {
    toolId: 'memory_recall',
    toolName: '과거 작업 기억',
    content,
  };
}

/* ─── Tool 2: Agent Observations Summary — 축적된 관찰 ─── */

function buildObservationSummary(agent: Agent): ToolResult | null {
  const relevant = agent.observations
    .filter(o => o.confidence >= 0.4)
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 5);

  if (relevant.length === 0) return null;

  const content = relevant.map(o =>
    `- ${o.observation} (확신도: ${Math.round(o.confidence * 100)}%)`
  ).join('\n');

  return {
    toolId: 'observation_summary',
    toolName: '사용자 관찰 요약',
    content,
  };
}

/* ─── Tool 3: Peer Results — 같은 세션 다른 에이전트의 완료된 작업 ─── */

/**
 * 현재 세션에서 이미 완료된 다른 에이전트의 결과를 참조할 수 있게.
 * Stage 2 뿐만 아니라 Stage 1 내에서도 먼저 완료된 워커의 결과를 볼 수 있음.
 */
export function buildPeerResultsContext(
  completedWorkers: Array<{ persona?: { name: string; role: string } | null; task: string; result: string | null }>,
): ToolResult | null {
  const available = completedWorkers.filter(w => w.result && w.result.length > 0);
  if (available.length === 0) return null;

  const content = available.map(w =>
    `[${w.persona?.name || '팀원'} (${w.persona?.role || ''})의 작업: ${w.task}]\n${(w.result || '').slice(0, 300)}${(w.result || '').length > 300 ? '...' : ''}`
  ).join('\n\n---\n\n');

  return {
    toolId: 'peer_results',
    toolName: '팀원 작업 결과 참조',
    content,
  };
}

/* ─── Tool Aggregator — 에이전트에 맞는 도구 결과를 모아서 반환 ─── */

/**
 * 에이전트의 실행 전에 호출. 관련 도구 결과를 프롬프트에 주입할 수 있는 텍스트로 반환.
 * LLM 호출 0. 결정론적.
 */
export function gatherToolContext(
  agentId: string,
  currentTask: string,
): string {
  const agent = useAgentStore.getState().getAgent(agentId);
  if (!agent) return '';

  const results: ToolResult[] = [];

  // Memory recall (Lv.2+)
  if (agent.level >= 2) {
    const memory = recallPastWork(agentId, currentTask);
    if (memory) results.push(memory);
  }

  // Observation summary (Lv.2+, buildAgentContext와 중복 방지를 위해 다른 형태)
  // → buildAgentContext가 이미 관찰을 주입하므로, 여기서는 건너뜀
  // 대신 Lv.3+에서 작업 패턴 요약을 제공
  if (agent.level >= 3) {
    const obsSummary = buildObservationSummary(agent);
    if (obsSummary) results.push(obsSummary);
  }

  if (results.length === 0) return '';

  const sections = results.map(r =>
    `## ${r.toolName}\n${r.content}`
  ).join('\n\n');

  return `\n─── 에이전트 도구 컨텍스트 ───\n${sections}\n─── 도구 컨텍스트 끝 ───`;
}
