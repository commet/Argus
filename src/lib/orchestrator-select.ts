/**
 * orchestrator-select.ts — 구조화된 에이전트 선택 엔진
 *
 * 키워드 카운팅이 아닌 3-레이어 매칭:
 *
 * Layer 1: Task Classification (task-classifier.ts)
 *   → 각 step을 { taskType, contextDomain, outputType }로 분류
 *   → 주변 step 문맥을 고려하여 모호함 해소
 *
 * Layer 2: Capability Scoring (agent-capabilities.ts)
 *   → 에이전트의 역량 프로필과 task 분류를 다차원 매칭
 *   → score = taskType(50%) + domain(30%) + output(20%) + anti-pattern
 *
 * Layer 3: Experience Adjustment (self-improvement)
 *   → 관찰(observations) + 히트레이트(hit-rate)로 점수 보정
 *   → 쓸수록 매칭 정확도가 올라가는 구조
 *
 * 설계 원칙:
 * - LLM 호출 0. 결정론적. 같은 입력 → 같은 결과.
 * - OpenClaw: "코드가 라우팅, LLM은 창의적 작업"
 * - AutoAgent: "사용 데이터가 쌓이면 매칭이 개선"
 */

import type { Agent, AgentObservation } from '@/stores/agent-types';
import type { InputClassification } from './orchestrator-classify';
import { classifySteps, type TaskClassification } from './task-classifier';
import { scoreAgentForTask, getCapability, isCriticAgentId, STRONG_FIT_THRESHOLD } from './agent-capabilities';
import { lensOf, type Lens } from './agent-lens';
import { getAgentHitRate } from './hit-rate';

/* ─── Types ─── */

interface ScoredAgent {
  agent: Agent;
  baseScore: number;         // capability 매칭 점수
  experienceBoost: number;   // 관찰 + 히트레이트 보정
  totalScore: number;
}

export interface SelectionTrace {
  stepIndex: number;
  taskClassification: TaskClassification;
  selectedAgent: string;
  scores: Array<{ agentId: string; baseScore: number; experienceBoost: number; total: number }>;
  /** True when the agent was force-added (e.g. the critical-stakes Critic),
   *  not chosen by capability score — drives a distinct rationale string. */
  forced?: boolean;
  /** F3 — margin between the winner and the runner-up (winner.total - second.total,
   *  or 1.0 if the winner was the only candidate). Internal-routing-only (spine
   *  rule 2: never a user-facing number) — it drives the HONEST reason: a small
   *  margin → a "near-tie" line, not a false "best fit". */
  confidence?: number;
  /** F3 — 'awarded' (a real capability match, total > 0) vs 'unfilled' (no
   *  qualified bidder; the best was assigned as least-bad and the reason says
   *  "weak match" honestly, instead of degrading to a hardcoded keyword pick). */
  outcome?: 'awarded' | 'unfilled';
  /** F3-spectrum — absolute fit of the AWARDED agent (baseScore vs
   *  STRONG_FIT_THRESHOLD): 'strong' = a real specialist match; 'stretch' = the
   *  closest available but not a specialist (surfaced honestly, not as a
   *  confident "best fit"). Absent on 'unfilled'/forced traces. */
  fit?: 'strong' | 'stretch';
}

/* ─── Layer 3: Experience Adjustment ─── */

function computeExperienceBoost(
  agent: Agent,
  taskClassification: TaskClassification,
  observations: AgentObservation[],
): number {
  let boost = 0;

  // F3a — XP/level severed from routing. `agent.level` is declared cosmetic
  // (useAgentStore: "must never gate capability"), but a +0.10 level boost still
  // leaked here — a rich-get-richer loop (XP is earned by being USED) with no
  // calibration basis, large enough (=the whole 1st↔2nd task-type gap) to flip a
  // tie. Routing now learns only from hit-rate (3c), the legitimate signal.

  // 3b. 관찰 기반 보정
  const relevantObs = observations.filter(o => o.confidence >= 0.3);
  let skillGapBoost = 0;
  for (const obs of relevantObs) {
    const obsLower = obs.observation.toLowerCase();
    const taskDomain = taskClassification.contextDomain;

    if (obs.category === 'skill_gap') {
      // 사용자에게 이 도메인의 skill gap이 있음 → 해당 도메인 에이전트 부스트
      const cap = getCapability(agent.id);
      if (cap && cap.domains.includes(taskDomain)) {
        skillGapBoost += 0.05 * obs.confidence;
      }
    } else if (obs.category === 'preference') {
      // 사용자가 특정 패턴을 선호 → 에이전트 이름이 관찰에 있으면 부스트
      if (obsLower.includes(agent.name.toLowerCase())) {
        boost += 0.03 * obs.confidence;
      }
    }
  }
  // Cap accrued skill_gap boost so observation pile-up can't overwhelm the
  // taskType match (50% weight; 1st↔2nd-rank gap is only 0.10). Was unbounded —
  // a timebomb that flips routing once observation data accrues.
  boost += Math.min(skillGapBoost, 0.10);

  // 3c. 히트레이트 반영 (5건 이상 데이터가 있을 때만)
  const hitRate = getAgentHitRate(agent.id);
  if (hitRate.total >= 5) {
    // hitRate.rate 0~1 → -0.15 ~ +0.15 범위로 변환
    boost += (hitRate.rate - 0.5) * 0.3;
  }

  // (F3a removed the former "3d activity approval-rate" branch — it read
  //  `agent.activities`, a field that doesn't exist on Agent (activities live in
  //  the store array), so it was dead code that never fired.)

  return boost;
}

/* ─── Main ─── */

export function selectAgents(
  steps: { task: string; output: string; agent_hint?: string }[],
  classification: InputClassification,
  unlockedAgents: Agent[],
  observations: AgentObservation[],
  problemText?: string,
  /** Optional sink for selection traces (why-this-agent + score breakdown).
   *  When provided, filled with one trace per assigned step. Leaving it out
   *  preserves the original signature — callers/tests are unaffected. */
  outTraces?: SelectionTrace[],
): Map<number, Agent> {
  const result = new Map<number, Agent>();
  const usedAgentIds = new Set<string>();
  const usedLenses = new Set<Lens>();   // 7-lens diversity: at most one worker per lens
  const traces: SelectionTrace[] = [];

  // ── Layer 1: Task Classification (모든 step을 한 번에, 문맥 포함) ──
  const taskClassifications = classifySteps(
    steps.map(s => ({ task: s.task, output: s.output })),
    problemText,
  );

  // ── critical stakes → Critic 예약 ──
  const criticAgent = classification.stakes === 'critical'
    ? unlockedAgents.find(a => isCriticAgentId(a.id))
    : null;

  // ── 각 step에 에이전트 배정 ──
  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    const tc = taskClassifications[i];
    if (!tc) continue;

    // One worker per lens: a lens already filled is unavailable, so the chain-
    // hierarchy near-ties (e.g. hayoon~sujin, both Scout) resolve to the higher
    // scorer and the rest of the run diversifies to other lenses.
    let available = unlockedAgents.filter(a => {
      if (usedAgentIds.has(a.id) || a.archived) return false;
      const lens = lensOf(a.id);
      return !(lens && usedLenses.has(lens));
    });
    // All lenses filled (9+ AI steps) → relax the one-per-lens rule and keep
    // routing by CAPABILITY score (anti-patterns still respected), rather than
    // letting initWorkers drop to the keyword fallback, which ignores capability
    // AND anti-patterns entirely (an intern could get a legal step).
    if (available.length === 0) {
      available = unlockedAgents.filter(a => !usedAgentIds.has(a.id) && !a.archived);
    }
    if (available.length === 0) break;

    // ── Layer 2: Capability Scoring ──
    const scored: ScoredAgent[] = available.map(agent => {
      const baseScore = scoreAgentForTask(
        agent.id,
        tc.taskType,
        tc.secondaryType,
        tc.contextDomain,
        tc.outputType,
      );

      // ── Layer 3: Experience Adjustment ──
      const experienceBoost = computeExperienceBoost(agent, tc, observations);

      // agent_hint 보너스 (LLM 제안을 약한 참고 신호로)
      let hintBoost = 0;
      if (step.agent_hint) {
        const hintLower = step.agent_hint.toLowerCase();
        if (agent.name.toLowerCase().includes(hintLower) || hintLower.includes(agent.name.toLowerCase())) {
          hintBoost = 0.05;
        }
      }

      return {
        agent,
        baseScore,
        experienceBoost: experienceBoost + hintBoost,
        totalScore: baseScore + experienceBoost + hintBoost,
      };
    });

    // 최고 점수 에이전트 선택. F3: a POSITIVE fit is assigned; a non-positive best
    // (a soft anti-pattern −0.4, or a sensitive-task −Infinity) is NEVER
    // force-assigned — forcing it would inject a mismatched specialist's
    // frameworks (worse than a generalist). Instead we record an 'unfilled' trace
    // (no agent), so the worker runs agent-less (a neutral generalist) AND the
    // captain sees an honest "no strong fit" reason on it — especially important
    // for the sensitive case (a legal step with no qualified lawyer must SAY so,
    // not silently run a generalist). The keyword fallback stays dead either way
    // (assignAgentToTask is now capability-based and also returns null here).
    scored.sort((a, b) => b.totalScore - a.totalScore);
    const best = scored[0];
    if (!best) continue;

    // Confidence = margin to the runner-up (1.0 if the winner stood alone). Both
    // finite-guarded so a −Infinity runner-up doesn't poison the margin.
    const second = scored[1];
    const confidence = second && Number.isFinite(best.totalScore) && Number.isFinite(second.totalScore)
      ? Math.round((best.totalScore - second.totalScore) * 100) / 100
      : 1.0;
    const topScores = scored.slice(0, 3).map(s => ({
      agentId: s.agent.id,
      baseScore: Math.round(s.baseScore * 100) / 100,
      experienceBoost: Math.round(s.experienceBoost * 100) / 100,
      total: Number.isFinite(s.totalScore) ? Math.round(s.totalScore * 100) / 100 : s.totalScore,
    }));

    if (best.totalScore > 0) {
      result.set(i, best.agent);
      usedAgentIds.add(best.agent.id);
      const bestLens = lensOf(best.agent.id);
      if (bestLens) usedLenses.add(bestLens);
      // F3-spectrum: grade the AWARDED fit on the CAPABILITY baseScore (not the
      // total — experience/hint boosts are luck, not specialization). A weak
      // absolute fit is a 'stretch', surfaced honestly downstream instead of
      // posing as a confident best fit.
      const fit: 'strong' | 'stretch' = best.baseScore >= STRONG_FIT_THRESHOLD ? 'strong' : 'stretch';
      traces.push({ stepIndex: i, taskClassification: tc, selectedAgent: best.agent.id, confidence, outcome: 'awarded', fit, scores: topScores });
    } else {
      // No qualified bidder — surface it honestly; do NOT force the worst fit.
      traces.push({ stepIndex: i, taskClassification: tc, selectedAgent: '', confidence: 0, outcome: 'unfilled', scores: topScores });
    }
  }

  // ── critical stakes: Critic 보장 ──
  if (criticAgent && !usedAgentIds.has(criticAgent.id)) {
    // critique 타입에 가장 가까운 빈 step 찾기
    let bestCritiqueStep = -1;
    let bestCritiqueScore = -1;

    for (let i = 0; i < steps.length; i++) {
      if (result.has(i)) continue;
      const tc = taskClassifications[i];
      if (!tc) continue;
      const critiqueAffinity = tc.taskType === 'critique' ? 3 : tc.secondaryType === 'critique' ? 2 : 0;
      if (critiqueAffinity > bestCritiqueScore) {
        bestCritiqueScore = critiqueAffinity;
        bestCritiqueStep = i;
      }
    }

    // Either an empty critique-affine step, or fall back to the last step
    // (overwriting whatever was there — the Critic guarantee wins on critical
    // stakes).
    const targetStep = bestCritiqueStep >= 0 ? bestCritiqueStep : steps.length - 1;
    if (targetStep >= 0) {
      // If we overwrite an already-assigned step, release the displaced agent's
      // id/lens claim — otherwise that lens stays "used" but unfilled (orphaned)
      // and the run silently loses a perspective.
      const displaced = result.get(targetStep);
      if (displaced && displaced.id !== criticAgent.id) {
        usedAgentIds.delete(displaced.id);
        const dl = lensOf(displaced.id);
        if (dl) usedLenses.delete(dl);
      }
      result.set(targetStep, criticAgent);
      usedAgentIds.add(criticAgent.id);
      // critic도 lens를 점유 — force-add가 lens 가드를 우회해 같은 렌즈 중복을 만들지 않게.
      const criticLens = lensOf(criticAgent.id);
      if (criticLens) usedLenses.add(criticLens);
      // Record the rationale so the why-this-agent line shows for the Critic —
      // and REPLACE any stale trace if we overwrote an already-assigned step
      // (otherwise the line would describe the agent we just displaced).
      const tc = taskClassifications[targetStep];
      if (tc) {
        const criticTrace: SelectionTrace = {
          stepIndex: targetStep,
          taskClassification: tc,
          selectedAgent: criticAgent.id,
          scores: [{ agentId: criticAgent.id, baseScore: 0, experienceBoost: 0, total: 0 }],
          forced: true,
        };
        const existing = traces.findIndex(t => t.stepIndex === targetStep);
        if (existing >= 0) traces[existing] = criticTrace;
        else traces.push(criticTrace);
      }
    }
  }

  // Surface the why-this-agent traces (computed above, previously discarded).
  if (outTraces) outTraces.push(...traces);

  return result;
}
