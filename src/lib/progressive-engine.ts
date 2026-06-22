/**
 * Progressive Engine — LLM 호출 + 상태 전이 오케스트레이션
 */

import { callLLMJson, callLLMStreamThenParse } from '@/lib/llm';
import {
  buildInitialAnalysisPrompt,
  buildInitialRefinementPrompt,
  buildDeepeningPrompt,
  buildMixPrompt,
  buildFinalDeliverablePrompt,
  buildNavigatorReviewPrompt,
  buildStrategicForkPrompt,
  buildWeaknessCheckPrompt,
  buildOverreachPrompt,
  buildHighestLoadPrompt,
  type TypedQuestionContext,
} from '@/lib/progressive-prompts';
import {
  buildFlowQuestion,
  pickNextQuestionType,
  type QuestionTypeTag,
  type QuestionStateContext,
  type TypedQuestionOption,
  type StrategicForkEffect,
  type WeaknessCheckEffect,
} from '@/lib/question-types';
import { buildReviewPrompt } from '@/lib/review-prompt';
import type { Agent } from '@/stores/agent-types';
import { assessConvergence, assessConvergenceWithWorkers } from '@/lib/progressive-convergence';
import { runDebateRound, type DebateResult } from '@/lib/debate-engine';
import { generateId } from '@/lib/uuid';
import { useAgentStore } from '@/stores/useAgentStore';
import { getCurrentLanguage } from '@/lib/i18n';
import { classifyCrisis } from '@/lib/crisis-gate';
import type {
  AnalysisSnapshot,
  ConvergenceMetrics,
  FlowQuestion,
  FlowAnswer,
  MixResult,
  DMFeedbackResult,
  DMConcern,
  LeadSynthesisResult,
  LoadBearingClaim,
} from '@/stores/types';
import { buildLeadSynthesisPrompt, type LeadAgentConfig } from '@/lib/lead-agent';
import { resolveContributorsHeuristic, type WorkerSource } from '@/lib/attribution-heuristic';

// ─── Response shapes from LLM ───

interface InitialAnalysisResponse {
  real_question: string;
  framing_confidence?: number;
  why_this_matters?: string;
  hidden_assumptions: string[];
  skeleton: string[];
  /** R31 — the model's own STEP-0 classification, surfaced so the RUNTIME can
   *  enforce the structural contract (only `open` builds a plan). Optional: an
   *  older/weaker model may omit it, in which case the guard no-ops (safe). */
  request_type?: 'open' | 'flat' | 'vent' | 'validation' | 'info' | 'resistance' | 'self_profiling' | 'crisis';
  next_question: {
    text: string;
    subtext?: string;
    options?: string[];
    type: 'select' | 'short';
  };
  detected_decision_maker: string | null;
}

/**
 * R31 — runtime route-contract guard (the "rules=data on the surface with a
 * runtime" move). R29 measured that weaker/mid models (esp. sonnet, the webapp's
 * default tier) IGNORE the STEP-0 under-fire gates ~44% of the time and build a
 * plan / manufacture a fork on a non-open request — a mirror-clause over-fire the
 * markdown plugin cannot stop (no runtime) but the webapp CAN.
 *
 * This is the SAFE structural form: it only ENFORCES the contract the prompt
 * already states (skeleton is non-empty ONLY for `open`). It is purely
 * subtractive — it blanks a plan that should not exist — and NEVER rewrites the
 * insight/real_question prose (text-scrubbing is fragile and could mangle a good
 * answer). Default is no-op: it fires only on a RECOGNIZED non-open request_type,
 * so a missing/unknown value leaves the output untouched.
 *
 * Exported pure for unit testing.
 */
const NON_OPEN_REQUEST_TYPES = new Set([
  'vent', 'validation', 'info', 'self_profiling', 'flat', 'resistance',
]);

export function applyRouteContract<T extends { request_type?: string; skeleton?: string[] }>(
  result: T,
): { result: T; coerced: boolean } {
  const rt = result.request_type;
  if (rt && NON_OPEN_REQUEST_TYPES.has(rt) && Array.isArray(result.skeleton) && result.skeleton.length > 0) {
    // The model classified this as a non-open request but still built a plan —
    // an internal contradiction. Honor the restraint side (the spine-safe
    // direction): a non-open request gets no manufactured plan.
    return { result: { ...result, skeleton: [] }, coerced: true };
  }
  return { result, coerced: false };
}

interface ExecutionPlanStep {
  task: string;
  who?: 'ai' | 'human' | 'both';                 // legacy
  agent_type?: 'ai' | 'self' | 'human';           // v2
  output: string;
  ai_scope?: string;
  self_scope?: string;
  decision?: string;
  agent_hint?: string;
  question_to_human?: string;
  human_contact_hint?: string;
}

interface DeepeningResponse {
  insight: string;
  real_question: string;
  hidden_assumptions: string[];
  skeleton: string[];
  execution_plan?: {
    steps: ExecutionPlanStep[];
    key_assumptions: string[];
  };
  next_question: {
    text: string;
    subtext?: string;
    options?: string[];
    type: 'select' | 'short';
  } | null;
  ready_for_mix: boolean;
}

interface MixResponse {
  title: string;
  executive_summary: string;
  sections: {
    heading: string;
    content: string;
    contributors?: string[]; // worker names that backed this section (section-level fallback)
    sentences?: Array<{      // sentence-level attribution (preferred when workers present)
      text: string;
      contributors?: string[];
    }>;
  }[];
  key_assumptions: string[];
  next_steps: string[];
}

interface DMFeedbackResponse {
  persona_name: string;
  persona_role: string;
  first_reaction: string;
  good_parts: string[];
  concerns: {
    text: string;
    severity: 'critical' | 'important' | 'minor';
    fix_suggestion: string;
  }[];
  would_ask: string[];
  approval_condition: string;
}

interface FinalResponse {
  title: string;
  executive_summary: string;
  sections: { heading: string; content: string }[];
  key_assumptions: string[];
  next_steps: string[];
  changes_applied?: string[];
}

// ─── Typed question generation (Phase 1) ───

interface StrategicForkLLMOption {
  label: string;
  decisionLine?: string;
  rationale?: string;
  addsWorkerRole?: string;
  snapshotPatch?: {
    real_question?: string;
    hidden_assumptions?: string[];
    skeleton?: string[];
    insight?: string;
  };
}

interface StrategicForkLLMResponse {
  text: string;
  subtext?: string;
  options: StrategicForkLLMOption[];
}

interface WeaknessCheckLLMOption {
  label: string;
  weakestAssumption?: { assumption?: string; explanation?: string };
  nextThreeDays?: string[];
  dmFirstReaction?: string;
  snapshotPatch?: {
    insight?: string;
    real_question?: string;
    hidden_assumptions?: string[];
    skeleton?: string[];
  };
}

interface WeaknessCheckLLMResponse {
  text: string;
  subtext?: string;
  options: WeaknessCheckLLMOption[];
}

/**
 * Generate a typed question. Engine picks the TYPE (state machine);
 * LLM fills in the CONTENT within that type's schema.
 *
 * Returns null on failure — caller should fall back to the legacy
 * untyped next_question from runInitialAnalysis / runDeepening.
 */
export async function runTypedQuestion(
  type: QuestionTypeTag,
  ctx: TypedQuestionContext,
  signal?: AbortSignal,
): Promise<FlowQuestion | null> {
  const locale = getCurrentLanguage();

  try {
    if (type === 'strategic_fork') {
      const { system, user } = buildStrategicForkPrompt(ctx, locale);
      const result = await callLLMJson<StrategicForkLLMResponse>(
        [{ role: 'user', content: user }],
        { system, maxTokens: 2500, signal, shape: { text: 'string', options: 'array' } },
      );
      if (!result.options || result.options.length < 2) return null;
      const options: TypedQuestionOption[] = result.options
        .filter(o => !!o.label && !!o.decisionLine)
        .map(o => {
          const effect: StrategicForkEffect = {
            decisionLine: o.decisionLine || o.label,
            rationale: o.rationale,
            addsWorkerRole: o.addsWorkerRole,
            snapshotPatch: o.snapshotPatch
              ? {
                  real_question: o.snapshotPatch.real_question,
                  hidden_assumptions: o.snapshotPatch.hidden_assumptions,
                  skeleton: o.snapshotPatch.skeleton,
                  insight: o.snapshotPatch.insight,
                }
              : undefined,
          };
          return { label: o.label, effect };
        });
      if (options.length < 2) return null;
      return buildFlowQuestion(
        generateId(),
        'strategic_fork',
        result.text,
        result.subtext,
        options,
        'reframe',
      );
    }

    if (type === 'weakness_check') {
      const { system, user } = buildWeaknessCheckPrompt(ctx, locale);
      const result = await callLLMJson<WeaknessCheckLLMResponse>(
        [{ role: 'user', content: user }],
        { system, maxTokens: 2500, signal, shape: { text: 'string', options: 'array' } },
      );
      if (!result.options || result.options.length < 2) return null;
      const options: TypedQuestionOption[] = result.options
        .filter(o => !!o.label && !!o.weakestAssumption?.assumption && Array.isArray(o.nextThreeDays) && o.nextThreeDays.length > 0)
        .map(o => {
          const effect: WeaknessCheckEffect = {
            weakestAssumption: {
              assumption: o.weakestAssumption?.assumption || '',
              explanation: o.weakestAssumption?.explanation || '',
            },
            nextThreeDays: o.nextThreeDays || [],
            dmFirstReaction: o.dmFirstReaction,
            snapshotPatch: o.snapshotPatch
              ? {
                  insight: o.snapshotPatch.insight,
                  real_question: o.snapshotPatch.real_question,
                  hidden_assumptions: o.snapshotPatch.hidden_assumptions,
                  skeleton: o.snapshotPatch.skeleton,
                }
              : undefined,
          };
          return { label: o.label, effect };
        });
      if (options.length < 2) return null;
      return buildFlowQuestion(
        generateId(),
        'weakness_check',
        result.text,
        result.subtext,
        options,
        'recast',
      );
    }

    // frame_clarify / free_follow_up: not yet implemented — fall through to legacy.
    return null;
  } catch (err) {
    if (process.env.NODE_ENV === 'development') {
      console.warn('[typed-question] failed:', err instanceof Error ? err.message : err);
    }
    return null;
  }
}

/**
 * State machine wrapper — decides type, generates, returns null if nothing
 * typed applies (caller should then use legacy question).
 */
export async function pickAndGenerateTypedQuestion(
  stateCtx: QuestionStateContext,
  promptCtx: TypedQuestionContext,
  signal?: AbortSignal,
): Promise<FlowQuestion | null> {
  const type = pickNextQuestionType(stateCtx);
  if (!type) return null;
  return runTypedQuestion(type, promptCtx, signal);
}

// ─── Engine functions ───

/**
 * Step 1: 초기 분석 — 문제 입력 → 즉시 뼈대 + 첫 질문
 * @param onToken - 스트리밍 콜백 (있으면 실시간 출력 표시)
 */
export async function runInitialAnalysis(
  problemText: string,
  onToken?: (text: string) => void,
  signal?: AbortSignal,
  /** P1-3 무음 구간 제거: when provided, the legacy next_question returns
   *  IMMEDIATELY and the typed-question generation runs in the background —
   *  the caller swaps it in via replaceLatestQuestion if the user hasn't
   *  answered yet. Without it, behavior is unchanged (await typed). */
  onTypedUpgrade?: (typed: FlowQuestion, replacesQuestionId: string) => void,
): Promise<{
  snapshot: AnalysisSnapshot;
  question: FlowQuestion;
  detectedDM: string | null;
}> {
  const locale = getCurrentLanguage();

  // ── Deterministic crisis backstop (decision 3: warn + resource, never block) ──
  // High-PRECISION regex screen in FRONT of the LLM. When it fires the input is
  // clearly a crisis, so we short-circuit: zero LLM tokens, no planning
  // machinery, and a machine-readable `crisis` flag the UI renders as a
  // non-blocking concern. Recall is NOT lost — the subtler cases this misses
  // fall through to the LLM, whose STEP-0 GATE A still suppresses the skeleton
  // and names the concern. Never widen the regex here (over-fire = its own harm).
  const crisis = classifyCrisis(problemText);
  if (crisis.isCrisis && crisis.category) {
    const snapshot: AnalysisSnapshot = {
      version: 0,
      // The concern message is NOT stored here — it lives only on `crisis` and is
      // rendered solely by CrisisConcernBanner. Keeping real_question as the
      // user's own words avoids the decision card ("우리가 잡은 항로") mislabeling
      // a hotline message as a plotted course, and avoids polluting the
      // downstream real_question if the user consciously continues.
      real_question: problemText,
      hidden_assumptions: [],
      skeleton: [],          // suppresses the plan AND blocks contract sealing (no predicates)
      framing_confidence: 20, // low — never offers a "is this framing right?" ceremony
      framing_locked: true,   // suppresses FramingConfirmation on a safety input
      crisis,
    };
    // A valid-but-suppressed question so the conscious-continue path has a target;
    // the UI hides it by default and only reveals it after an explicit override.
    const question: FlowQuestion = {
      id: generateId(),
      text: locale === 'ko' ? '계속 진행하시겠어요?' : 'Would you like to continue?',
      type: 'short',
      engine_phase: 'reframe',
    };
    return { snapshot, question, detectedDM: null };
  }

  const { system, user } = buildInitialAnalysisPrompt(problemText, locale);

  // Stream: real-time display then JSON parse, or standard approach
  const result = onToken
    ? await callLLMStreamThenParse<InitialAnalysisResponse>(
        [{ role: 'user', content: user }],
        { system, maxTokens: 2000, signal, shape: { real_question: 'string', hidden_assumptions: 'array', skeleton: 'array', next_question: 'object' } },
        onToken,
      )
    : await callLLMJson<InitialAnalysisResponse>(
        [{ role: 'user', content: user }],
        { system, maxTokens: 2000, signal, shape: { real_question: 'string', hidden_assumptions: 'array', skeleton: 'array', next_question: 'object' } },
      );

  // R31 — runtime route-contract guard: a non-open request that nonetheless built
  // a plan is the model ignoring the STEP-0 under-fire gate (R29: ~44% on weak/mid
  // tiers). Enforce the restraint structural contract the prompt already states.
  const { result: contractResult } = applyRouteContract(result);
  Object.assign(result, contractResult);

  const framingConfidence = Math.min(100, Math.max(0, result.framing_confidence ?? 75));

  const snapshot: AnalysisSnapshot = {
    version: 0,
    real_question: result.real_question || (locale === 'ko' ? '분석 중...' : 'Analyzing...'),
    hidden_assumptions: result.hidden_assumptions || [],
    skeleton: result.skeleton || [],
    framing_confidence: framingConfidence,
    framing_locked: false,
    // R32 — wire the model's STEP-0 classification onto the snapshot so the flow
    // can make a non-open route terminal (ProgressiveFlow suppresses the fabricated
    // follow-up question). Undefined when the model omits it → flow stays normal.
    request_type: result.request_type,
  };

  // Phase 1 typed question: framing_confidence>=70이면 strategic_fork로 넘어간다.
  // 실패 시 기존 next_question으로 fallback.
  const legacyQuestion: FlowQuestion = {
    id: generateId(),
    text: result.next_question?.text || (locale === 'ko' ? '이 결과물을 누가 최종 판단해?' : 'Who will make the final decision on this?'),
    subtext: result.next_question?.subtext,
    options: result.next_question?.options,
    type: result.next_question?.type || 'select',
    engine_phase: 'reframe',
  };

  const typedArgs = [
    {
      round: 0,
      framingConfidence,
      askedTypes: [] as QuestionTypeTag[],
      workerOutputsReady: false,
    },
    {
      problemText,
      snapshot: {
        real_question: snapshot.real_question,
        hidden_assumptions: snapshot.hidden_assumptions,
        skeleton: snapshot.skeleton,
        insight: snapshot.insight,
      },
    },
  ] as const;

  let question: FlowQuestion;
  if (onTypedUpgrade) {
    // Show the legacy question NOW; upgrade in the background (best-effort —
    // abort/failure leaves the legacy question standing, which is honest).
    question = legacyQuestion;
    pickAndGenerateTypedQuestion(typedArgs[0], typedArgs[1], signal)
      .then((t) => { if (t) onTypedUpgrade(t, legacyQuestion.id); })
      .catch(() => { /* upgrade is optional polish, never a failure */ });
  } else {
    const typed = await pickAndGenerateTypedQuestion(typedArgs[0], typedArgs[1], signal);
    question = typed ?? legacyQuestion;
  }

  return {
    snapshot,
    question,
    detectedDM: result.detected_decision_maker || null,
  };
}

/**
 * Step 1b: 프레이밍 재분석 — 사용자가 Round 1 질문을 거부했을 때
 */
export async function refineInitialFraming(
  problemText: string,
  rejectedQuestion: string,
  rejectionReason: string,
  onToken?: (text: string) => void,
  signal?: AbortSignal,
): Promise<{
  snapshot: AnalysisSnapshot;
  question: FlowQuestion;
  detectedDM: string | null;
}> {
  const locale = getCurrentLanguage();
  const { system, user } = buildInitialRefinementPrompt(
    problemText, rejectedQuestion, rejectionReason, locale,
  );

  const result = onToken
    ? await callLLMStreamThenParse<InitialAnalysisResponse>(
        [{ role: 'user', content: user }],
        { system, maxTokens: 2000, signal, shape: { real_question: 'string', hidden_assumptions: 'array', skeleton: 'array', next_question: 'object' } },
        onToken,
      )
    : await callLLMJson<InitialAnalysisResponse>(
        [{ role: 'user', content: user }],
        { system, maxTokens: 2000, signal, shape: { real_question: 'string', hidden_assumptions: 'array', skeleton: 'array', next_question: 'object' } },
      );

  const framingConfidence = Math.min(100, Math.max(0, result.framing_confidence ?? 70));

  const snapshot: AnalysisSnapshot = {
    version: 0,
    real_question: result.real_question || (locale === 'ko' ? '분석 중...' : 'Analyzing...'),
    hidden_assumptions: result.hidden_assumptions || [],
    skeleton: result.skeleton || [],
    framing_confidence: framingConfidence,
    framing_locked: false,
    framing_override_reason: rejectionReason,
  };

  return {
    snapshot,
    question: {
      id: generateId(),
      text: result.next_question?.text || (locale === 'ko' ? '이제 이 방향이 맞나요?' : 'Does this direction look right now?'),
      subtext: result.next_question?.subtext,
      options: result.next_question?.options,
      type: result.next_question?.type || 'select',
      engine_phase: 'reframe',
    },
    detectedDM: result.detected_decision_maker || null,
  };
}

/**
 * Step 2+: 심화 분석 — 답변 반영 → 업데이트된 분석 + 다음 질문
 */
export async function runDeepening(
  problemText: string,
  currentSnapshot: AnalysisSnapshot,
  questionsAndAnswers: Array<{ question: FlowQuestion; answer: FlowAnswer }>,
  round: number,
  maxRounds: number,
  allSnapshots: AnalysisSnapshot[],
  onToken?: (text: string) => void,
  signal?: AbortSignal,
  leadContext?: string,
  registeredPersonas?: Array<{ name: string; role: string; hasContact: boolean }>,
  /** P1-3: legacy question returns immediately; typed generation upgrades it
   *  in the background via the callback (see runInitialAnalysis). */
  onTypedUpgrade?: (typed: FlowQuestion, replacesQuestionId: string) => void,
): Promise<{
  snapshot: AnalysisSnapshot;
  question: FlowQuestion | null;
  readyForMix: boolean;
  convergenceMetrics: ConvergenceMetrics;
}> {
  const locale = getCurrentLanguage();
  // Conductor: pass unlocked agent list for team-aware task decomposition
  const agentStore = useAgentStore.getState();
  const isKo = locale === 'ko';
  const availableAgents = agentStore.getUnlockedAgents()
    .filter(a => a.capabilities.includes('task_execution'))
    .map(a => ({
      name: isKo ? a.name : (a.nameEn || a.name),
      role: isKo ? a.role : (a.roleEn || a.role),
      specialty: a.expertise?.split('.')[0] || a.role,
    }));

  const { system, user } = buildDeepeningPrompt(
    problemText, currentSnapshot, questionsAndAnswers, round, maxRounds, availableAgents, locale, leadContext, registeredPersonas,
  );

  const result = onToken
    ? await callLLMStreamThenParse<DeepeningResponse>(
        [{ role: 'user', content: user }],
        { system, maxTokens: 2000, signal, shape: { insight: 'string', real_question: 'string', hidden_assumptions: 'array', skeleton: 'array', ready_for_mix: 'boolean' } },
        onToken,
      )
    : await callLLMJson<DeepeningResponse>(
        [{ role: 'user', content: user }],
        { system, maxTokens: 2000, signal, shape: { insight: 'string', real_question: 'string', hidden_assumptions: 'array', skeleton: 'array', ready_for_mix: 'boolean' } },
      );

  const snapshot: AnalysisSnapshot = {
    version: currentSnapshot.version + 1,
    real_question: result.real_question || currentSnapshot.real_question,
    hidden_assumptions: result.hidden_assumptions || currentSnapshot.hidden_assumptions,
    skeleton: result.skeleton || currentSnapshot.skeleton,
    execution_plan: result.execution_plan || currentSnapshot.execution_plan,
    insight: result.insight,
    framing_confidence: currentSnapshot.framing_confidence,
    framing_locked: currentSnapshot.framing_locked,
    // Carry the deterministic crisis flag forward so the resource banner stays
    // pinned across deepening even after a conscious "continue" (defensive: the
    // banner also reads it off the round-0 snapshot, but don't depend on that).
    crisis: currentSnapshot.crisis,
    // Carry the route classification forward (deepening only happens on an open
    // decision, but keep it pinned so the flow's non-open check is stable).
    request_type: currentSnapshot.request_type,
  };

  // Adaptive convergence: 스냅샷 전체 + 새 스냅샷으로 수렴도 계산
  const convergence = assessConvergence([...allSnapshots, snapshot]);
  snapshot.convergence_score = convergence.score;
  snapshot.convergence_trend = convergence.trend;

  // LLM이 ready라고 했거나, 수렴도가 충분하면 Mix 가능
  const llmSaysReady = result.ready_for_mix === true;
  const convergenceSaysReady = convergence.is_converged;
  const isMaxRound = round >= maxRounds - 1;

  // 적응형 수렴: 최대 라운드라도 수렴 안 됐으면 강제하지 않음 → 대신 선택지 제시
  let shouldProceedToMix: boolean;
  let question: FlowQuestion | null;

  if (llmSaysReady || convergenceSaysReady) {
    // 수렴 완료
    shouldProceedToMix = true;
    question = null;
  } else if (isMaxRound && !convergenceSaysReady) {
    // 최대 라운드인데 수렴 안 됨 → 사용자에게 선택지 제시
    shouldProceedToMix = false;
    question = {
      id: generateId(),
      text: locale === 'ko'
        ? `아직 완전히 명확하지 않습니다 (명확도: ${convergence.score}%). 어떻게 할까요?`
        : `Not fully clear yet (clarity: ${convergence.score}%). What would you like to do?`,
      subtext: convergence.guidance,
      options: locale === 'ko'
        ? ['지금 바로 문서로 만들기', '한 라운드 더 진행하기', '문제를 다시 정의하기']
        : ['Create the document now', 'Go one more round', 'Redefine the problem'],
      type: 'select',
      engine_phase: 'reframe',
    };
  } else {
    // 아직 진행 중 — Phase 1: typed question 먼저 시도.
    shouldProceedToMix = false;

    const askedTypes: QuestionTypeTag[] = [];
    for (const qa of questionsAndAnswers) {
      const tag = (qa.question as FlowQuestion & { typed?: { tag?: QuestionTypeTag } }).typed?.tag;
      if (tag) askedTypes.push(tag);
    }

    const stateCtx = {
      round,
      framingConfidence: snapshot.framing_confidence ?? 75,
      askedTypes,
      // round>=1 means the engine already asked a strategic_fork; we treat
      // that as "enough context to fire weakness_check" even without full
      // worker output. Real worker integration comes in a later phase.
      workerOutputsReady: round >= 1,
    };
    const genCtx = {
      problemText,
      snapshot: {
        real_question: snapshot.real_question,
        hidden_assumptions: snapshot.hidden_assumptions,
        skeleton: snapshot.skeleton,
        insight: snapshot.insight,
      },
      previousQA: questionsAndAnswers.map(qa => ({
        q: qa.question.text,
        a: qa.answer.value,
      })),
    };

    const legacyQuestion: FlowQuestion | null = result.next_question
      ? {
          id: generateId(),
          text: result.next_question.text,
          subtext: result.next_question.subtext,
          options: result.next_question.options,
          type: result.next_question.type || 'select',
          engine_phase: round >= 1 ? 'recast' : 'reframe',
        }
      : null;

    if (legacyQuestion && onTypedUpgrade) {
      // P1-3: the user sees the next question immediately (the deepening
      // answer already arrived); the typed upgrade lands ~5–10s later and
      // swaps in only while the question is still unanswered.
      question = legacyQuestion;
      pickAndGenerateTypedQuestion(stateCtx, genCtx, signal)
        .then((t) => { if (t) onTypedUpgrade(t, legacyQuestion.id); })
        .catch(() => { /* best-effort upgrade */ });
    } else {
      const typed = await pickAndGenerateTypedQuestion(stateCtx, genCtx, signal);
      question = typed ?? legacyQuestion;
    }
  }

  return {
    snapshot,
    question,
    readyForMix: shouldProceedToMix,
    convergenceMetrics: convergence,
  };
}

/**
 * Step Lead Synthesis: Lead agent integrates all worker results
 */
export async function runLeadSynthesis(
  problemText: string,
  realQuestion: string,
  workerResults: Array<{ agentName: string; agentRole: string; task: string; result: string }>,
  leadConfig: LeadAgentConfig,
  signal?: AbortSignal,
): Promise<LeadSynthesisResult> {
  const locale = getCurrentLanguage();
  const { system, user } = buildLeadSynthesisPrompt(
    leadConfig, problemText, realQuestion, workerResults, locale,
  );

  const result = await callLLMJson<{
    integrated_analysis: string;
    key_findings: string[];
    unresolved_tensions: string[];
    recommendation_direction: string;
  }>(
    [{ role: 'user', content: user }],
    { system, maxTokens: 3000, signal, shape: { integrated_analysis: 'string', key_findings: 'array', unresolved_tensions: 'array', recommendation_direction: 'string' } },
  );

  // Record XP for the lead agent
  useAgentStore.getState().recordActivity(
    leadConfig.agentId, 'synthesis_completed', problemText.slice(0, 100),
  );

  return {
    lead_agent_id: leadConfig.agentId,
    lead_agent_name: locale === 'ko' ? leadConfig.agentName : leadConfig.agentNameEn,
    integrated_analysis: result.integrated_analysis || '',
    key_findings: result.key_findings || [],
    unresolved_tensions: result.unresolved_tensions || [],
    recommendation_direction: result.recommendation_direction || '',
  };
}

/**
 * Step Mix: 최종 초안 조합
 *
 * When `workerResults` carry `workerId` + `name`, the LLM is asked to cite
 * contributors per section, and we resolve names → IDs so the UI can draw
 * bidirectional hover attribution (section ↔ agent).
 */
export async function runMix(
  problemText: string,
  snapshots: AnalysisSnapshot[],
  questionsAndAnswers: Array<{ question: FlowQuestion; answer: FlowAnswer }>,
  decisionMaker: string | null,
  workerResults?: Array<{ task: string; result: string; name?: string; workerId?: string }>,
  signal?: AbortSignal,
  leadSynthesis?: LeadSynthesisResult | null,
  userNotes?: string | null,
  onToken?: (text: string) => void,
): Promise<MixResult> {
  const locale = getCurrentLanguage();
  const { system, user: userPrompt } = buildMixPrompt(
    problemText, snapshots, questionsAndAnswers, decisionMaker, workerResults, locale, leadSynthesis,
  );
  // Append user notes to the user prompt if provided
  const user = userNotes?.trim()
    ? `${userPrompt}\n\n<user-notes>\n사용자가 직접 추가한 의견입니다. 초안에 반드시 반영하세요:\n${userNotes.trim()}\n</user-notes>`
    : userPrompt;

  const shape = { title: 'string' as const, executive_summary: 'string' as const, sections: 'array' as const, key_assumptions: 'array' as const, next_steps: 'array' as const };
  const result = onToken
    ? await callLLMStreamThenParse<MixResponse>(
        [{ role: 'user', content: user }],
        { system, maxTokens: 4000, signal, shape },
        onToken,
      )
    : await callLLMJson<MixResponse>(
        [{ role: 'user', content: user }],
        { system, maxTokens: 4000, signal, shape },
      );

  // Build name → workerId lookup for attribution resolution.
  const nameToId = new Map<string, string>();
  if (workerResults) {
    for (const w of workerResults) {
      if (w.name && w.workerId) nameToId.set(w.name.toLowerCase().trim(), w.workerId);
    }
  }

  // Heuristic fallback pool — only workers with real identity can be attributed.
  const heuristicPool: WorkerSource[] = (workerResults || [])
    .filter((w): w is Required<Pick<typeof w, 'workerId' | 'name'>> & typeof w => !!w.workerId && !!w.name)
    .map(w => ({ workerId: w.workerId, name: w.name, result: w.result }));

  const resolveContributors = (names: string[] | undefined): { names: string[]; ids: string[] } => {
    if (!names || names.length === 0) return { names: [], ids: [] };
    const cleanNames: string[] = [];
    const ids: string[] = [];
    for (const raw of names) {
      if (typeof raw !== 'string' || !raw.trim()) continue;
      const id = nameToId.get(raw.toLowerCase().trim());
      if (id) {
        cleanNames.push(raw.trim());
        ids.push(id);
      }
    }
    return { names: cleanNames, ids };
  };

  // Merge LLM attribution with heuristic fallback — only fills when LLM yields nothing.
  const resolveWithFallback = (names: string[] | undefined, fallbackContent: string) => {
    const fromLLM = resolveContributors(names);
    if (fromLLM.ids.length > 0 || heuristicPool.length === 0) return fromLLM;
    const heuristic = resolveContributorsHeuristic(fallbackContent, heuristicPool);
    if (heuristic.length === 0) return fromLLM;
    return {
      names: heuristic.map(h => h.name),
      ids: heuristic.map(h => h.workerId),
    };
  };

  const sections = (result.sections || []).map(s => {
    // Sentence-level first: resolve each sentence's contributors individually.
    const sentences = Array.isArray(s.sentences) && s.sentences.length > 0
      ? s.sentences
          .filter((sent): sent is NonNullable<typeof sent> => !!sent && typeof sent.text === 'string')
          .map(sent => {
            const { names, ids } = resolveWithFallback(sent.contributors, sent.text);
            return {
              text: sent.text,
              contributor_names: names,
              contributor_worker_ids: ids,
            };
          })
      : undefined;

    // If sentences exist, section content = concatenation (for legacy renderers + fallback).
    const content = sentences && sentences.length > 0
      ? sentences.map(sent => sent.text).join(' ')
      : (s.content || '');

    // Section-level attribution: union of sentence IDs when sentences exist; otherwise fallback to LLM-section / heuristic.
    let sectionNames: string[];
    let sectionIds: string[];
    if (sentences && sentences.length > 0) {
      const idSet = new Set<string>();
      const nameSet = new Set<string>();
      for (const sent of sentences) {
        (sent.contributor_worker_ids || []).forEach(id => idSet.add(id));
        (sent.contributor_names || []).forEach(n => nameSet.add(n));
      }
      sectionIds = Array.from(idSet);
      sectionNames = Array.from(nameSet);
      // If sentence-level attribution also came up empty, try heuristic on the whole section.
      if (sectionIds.length === 0) {
        const fallback = resolveWithFallback(undefined, content);
        sectionIds = fallback.ids;
        sectionNames = fallback.names;
      }
    } else {
      const fallback = resolveWithFallback(s.contributors, s.content || '');
      sectionIds = fallback.ids;
      sectionNames = fallback.names;
    }

    return {
      heading: s.heading || '',
      content,
      contributor_names: sectionNames,
      contributor_worker_ids: sectionIds,
      sentences,
    };
  });

  return {
    title: result.title || (locale === 'ko' ? '기획안' : 'Proposal'),
    executive_summary: result.executive_summary || '',
    sections,
    key_assumptions: result.key_assumptions || [],
    next_steps: result.next_steps || [],
  };
}

/**
 * Step DM: 판단자 피드백 생성 (unified review-prompt)
 */
export async function runDMFeedback(
  mix: MixResult,
  decisionMaker: string,
  problemContext: string,
  signal?: AbortSignal,
  mode: 'quick' | 'deep' = 'quick',
  onToken?: (text: string) => void,
): Promise<DMFeedbackResult> {
  const locale = getCurrentLanguage();
  const docText = formatMixForReview(mix);

  const { system, user } = buildReviewPrompt(
    { name: decisionMaker, role: decisionMaker },
    docText,
    problemContext,
    { mode, locale },
  );

  const shape = { first_reaction: 'string' as const, good_parts: 'array' as const, concerns: 'array' as const, approval_condition: 'string' as const };
  const result = onToken
    ? await callLLMStreamThenParse<DMFeedbackResponse>(
        [{ role: 'user', content: user }],
        { system, maxTokens: 2000, signal, shape },
        onToken,
      )
    : await callLLMJson<DMFeedbackResponse>(
        [{ role: 'user', content: user }],
        { system, maxTokens: 2000, signal, shape },
      );

  return dmResponseToResult(result, decisionMaker, '', locale);
}

/**
 * Overreach ("시험한다"): inflate the plan into escalating success-claims so the
 * user stops where they stop believing. Returns one genuine strength + the
 * ordered claim ladder (ids assigned here, `overreached: true`). Callers must
 * handle the failure/degenerate case (e.g. <3 claims) by skipping the step.
 */
export async function runOverreach(
  snapshot: AnalysisSnapshot,
  mix: MixResult,
  signal?: AbortSignal,
  onToken?: (text: string) => void,
): Promise<{ strength: string; claims: LoadBearingClaim[] }> {
  const locale = getCurrentLanguage();
  const { system, user } = buildOverreachPrompt(snapshot, mix, locale);

  const shape = { strength: 'string' as const, claims: 'array' as const };
  const result = onToken
    ? await callLLMStreamThenParse<{ strength?: string; claims?: unknown[] }>(
        [{ role: 'user', content: user }],
        { system, maxTokens: 1200, signal, shape },
        onToken,
      )
    : await callLLMJson<{ strength?: string; claims?: unknown[] }>(
        [{ role: 'user', content: user }],
        { system, maxTokens: 1200, signal, shape },
      );

  // Each rung is { claim, assumption } — the claim is the escalating success
  // sentence; the assumption is the belief that rung adds (what a flinch here
  // surfaces). Tolerate plain strings / {text} too, so a malformed shape degrades
  // to claim-only rather than dropping the whole ladder.
  const claims: LoadBearingClaim[] = (result.claims || [])
    .map((c): LoadBearingClaim | null => {
      if (typeof c === 'string') {
        const text = c.trim();
        return text ? { id: generateId(), text, overreached: true } : null;
      }
      if (c && typeof c === 'object') {
        const o = c as { claim?: unknown; text?: unknown; assumption?: unknown };
        const text = (typeof o.claim === 'string' ? o.claim : typeof o.text === 'string' ? o.text : '').trim();
        if (!text) return null;
        const assumption = typeof o.assumption === 'string' ? o.assumption.trim() : undefined;
        return { id: generateId(), text, assumption: assumption || undefined, overreached: true };
      }
      return null;
    })
    .filter((c): c is LoadBearingClaim => c !== null);

  return { strength: (result.strength || '').trim(), claims };
}

/**
 * No-flinch fallback: the user believed every claim. Name the single riskiest
 * assumption they're betting on. Returns it as a `highest_load` claim.
 */
export async function runHighestLoad(
  claims: LoadBearingClaim[],
  snapshot: AnalysisSnapshot,
  signal?: AbortSignal,
): Promise<LoadBearingClaim> {
  const locale = getCurrentLanguage();
  const { system, user } = buildHighestLoadPrompt(claims.map((c) => c.text), snapshot, locale);

  const shape = { text: 'string' as const };
  // 'fast': one short sentence out — sonnet latency buys nothing here.
  const result = await callLLMJson<{ text?: string }>(
    [{ role: 'user', content: user }],
    { system, maxTokens: 400, signal, shape, model: 'fast' },
  );

  return {
    id: generateId(),
    text: (result.text || '').trim() || (snapshot.weakest_assumption?.assumption ?? ''),
    overreached: false,
    highest_load: true,
  };
}

/**
 * Step DM (Boss): Boss agent 성격 기반 피드백 (unified review-prompt)
 */
export async function runBossDMFeedback(
  mix: MixResult,
  agent: Agent,
  problemContext: string,
  signal?: AbortSignal,
  mode: 'quick' | 'deep' = 'quick',
  onToken?: (text: string) => void,
): Promise<DMFeedbackResult> {
  const locale = getCurrentLanguage();
  const docText = formatMixForReview(mix);

  const { system, user } = buildReviewPrompt(
    { name: agent.name, role: agent.role || (locale === 'ko' ? '팀장' : 'Team Lead') },
    docText,
    problemContext,
    { mode, locale, agent },
  );

  const shape = { first_reaction: 'string' as const, good_parts: 'array' as const, concerns: 'array' as const, approval_condition: 'string' as const };
  const result = onToken
    ? await callLLMStreamThenParse<DMFeedbackResponse>(
        [{ role: 'user', content: user }],
        { system, maxTokens: 2000, signal, shape },
        onToken,
      )
    : await callLLMJson<DMFeedbackResponse>(
        [{ role: 'user', content: user }],
        { system, maxTokens: 2000, signal, shape },
      );

  return dmResponseToResult(result, agent.name, agent.role || (locale === 'ko' ? '팀장' : 'Team Lead'), locale);
}

// ── Helpers ──

function formatMixForReview(mix: MixResult): string {
  return [
    `# ${mix.title}`,
    `> ${mix.executive_summary}`,
    ...mix.sections.map(s => `## ${s.heading}\n${s.content}`),
    `## ${getCurrentLanguage() === 'ko' ? '핵심 가정' : 'Key Assumptions'}\n${mix.key_assumptions.map(a => `- ${a}`).join('\n')}`,
    `## ${getCurrentLanguage() === 'ko' ? '다음 단계' : 'Next Steps'}\n${mix.next_steps.map(s => `- ${s}`).join('\n')}`,
  ].join('\n\n');
}

function dmResponseToResult(
  result: DMFeedbackResponse,
  fallbackName: string,
  fallbackRole: string,
  locale: string,
): DMFeedbackResult {
  return {
    persona_name: result.persona_name || fallbackName,
    persona_role: result.persona_role || fallbackRole,
    first_reaction: result.first_reaction || '',
    good_parts: result.good_parts || [],
    concerns: (result.concerns || []).filter(c => !!c && typeof c === 'object').map((c): DMConcern => ({
      text: String(c.text || ''),
      severity: c.severity || 'important',
      fix_suggestion: String(c.fix_suggestion || ''),
      applied: c.severity === 'critical',
    })),
    would_ask: result.would_ask || [],
    approval_condition: result.approval_condition || '',
  };
}

/**
 * Step Final: 피드백 반영 후 최종 문서
 *
 * Returns both a rendered markdown string (for copy/export) AND a structured
 * `finalMix` whose sections carry the original mix's attribution forward.
 *
 * Attribution preservation strategy:
 * 1. If no DM concerns were applied, finalMix = original mix (no change).
 * 2. If the LLM rewrote sections to apply fixes, we MATCH each new section to
 *    an original one by heading similarity and transplant `contributor_*`.
 * 3. Sections that don't match anything (new or heavily rewritten) fall through
 *    the normal heuristic pool — same workerResults used at mix time.
 */
export async function runFinalDeliverable(
  mix: MixResult,
  dmFeedback: DMFeedbackResult,
  signal?: AbortSignal,
  workerSources?: WorkerSource[],
  onToken?: (text: string) => void,
): Promise<{ markdown: string; finalMix: MixResult }> {
  const appliedFixes = dmFeedback.concerns
    .filter(c => c.applied)
    .map(c => ({ concern: c.text, fix: c.fix_suggestion }));

  const locale = getCurrentLanguage();
  if (appliedFixes.length === 0) {
    return {
      markdown: formatMixAsMarkdown(mix, undefined, locale),
      finalMix: mix, // No change — keep attribution as-is.
    };
  }

  const { system, user } = buildFinalDeliverablePrompt(mix, appliedFixes, locale);

  const shape = { title: 'string' as const, executive_summary: 'string' as const, sections: 'array' as const };
  const result = onToken
    ? await callLLMStreamThenParse<FinalResponse>(
        [{ role: 'user', content: user }],
        { system, maxTokens: 4000, signal, shape },
        onToken,
      )
    : await callLLMJson<FinalResponse>(
        [{ role: 'user', content: user }],
        { system, maxTokens: 4000, signal, shape },
      );

  // Build heading → original section lookup for attribution transplant.
  const originalByHeading = new Map<string, MixResult['sections'][number]>();
  for (const s of mix.sections) {
    originalByHeading.set(normalizeHeading(s.heading), s);
  }

  const rewrittenSections = (result.sections || mix.sections).map(newSec => {
    const key = normalizeHeading(newSec.heading || '');
    const orig = originalByHeading.get(key);
    if (orig) {
      // Heading matched — transplant the original attribution onto the new content.
      return {
        heading: newSec.heading || orig.heading,
        content: newSec.content || orig.content,
        contributor_names: orig.contributor_names,
        contributor_worker_ids: orig.contributor_worker_ids,
        // Sentence-level attribution doesn't transplant cleanly when text changed — drop it.
        sentences: undefined,
      };
    }
    // No match — fall back to heuristic on the fresh content using the original worker pool.
    const content = newSec.content || '';
    if (workerSources && workerSources.length > 0 && content.length > 0) {
      const heuristic = resolveContributorsHeuristic(content, workerSources);
      return {
        heading: newSec.heading || '',
        content,
        contributor_names: heuristic.map(h => h.name),
        contributor_worker_ids: heuristic.map(h => h.workerId),
      };
    }
    return {
      heading: newSec.heading || '',
      content,
      contributor_names: [],
      contributor_worker_ids: [],
    };
  });

  const finalMix: MixResult = {
    title: result.title || mix.title,
    executive_summary: result.executive_summary || mix.executive_summary,
    sections: rewrittenSections,
    key_assumptions: result.key_assumptions || mix.key_assumptions,
    next_steps: result.next_steps || mix.next_steps,
  };

  return {
    markdown: formatMixAsMarkdown(finalMix, result.changes_applied, locale),
    finalMix,
  };
}

// Normalize heading for fuzzy match — strips punctuation, lowercases, collapses whitespace.
function normalizeHeading(h: string): string {
  return h
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '')
    .trim();
}

// ─── Helpers ───

function formatMixAsMarkdown(mix: MixResult, changes?: string[], locale: 'ko' | 'en' = 'en'): string {
  const lines: string[] = [
    `# ${mix.title}`,
    '',
    `> ${mix.executive_summary}`,
    '',
  ];

  for (const section of mix.sections) {
    lines.push(`## ${section.heading}`, '', section.content, '');
  }

  if (mix.key_assumptions.length > 0) {
    lines.push(locale === 'ko' ? '## 전제 조건' : '## Key Assumptions', '');
    for (const a of mix.key_assumptions) {
      lines.push(`- ${a}`);
    }
    lines.push('');
  }

  if (mix.next_steps.length > 0) {
    lines.push(locale === 'ko' ? '## 다음 단계' : '## Next Steps', '');
    for (const s of mix.next_steps) {
      lines.push(`- ${s}`);
    }
    lines.push('');
  }

  if (changes && changes.length > 0) {
    lines.push('---', '', locale === 'ko' ? '*반영된 수정사항:*' : '*Changes applied:*');
    for (const c of changes) {
      lines.push(`- ${c}`);
    }
  }

  return lines.join('\n');
}

// ─── Navigator 메타 리뷰 ───

export interface NavigatorReview {
  overall: string;
  contradictions: string[];
  blind_spots: string[];
  verdict: string;
}

export async function runNavigatorReview(
  problemText: string,
  workerResults: Array<{ agentName: string; agentRole: string; task: string; result: string }>,
  signal?: AbortSignal,
): Promise<NavigatorReview | null> {
  // W1.5①: the unlock gate is cosmetic now — navigator review runs whenever
  // the agent exists (XP/level remain as progression flavor only).
  const navigator = useAgentStore.getState().getAgent('navigator');
  if (!navigator) return null;

  const locale = getCurrentLanguage();
  const { system, user } = buildNavigatorReviewPrompt(problemText, workerResults, locale);

  try {
    // 'fast': a 500-token meta-note rendered as one card — cheap tier suffices,
    // and this rides alongside the user-blocking mix pipeline.
    const result = await callLLMJson<NavigatorReview>(
      [{ role: 'user', content: user }],
      { system, maxTokens: 500, signal, model: 'fast', shape: { overall: 'string', contradictions: 'array', blind_spots: 'array', verdict: 'string' } },
    );

    // 항해장 XP 적립
    useAgentStore.getState().recordActivity('navigator', 'review_given', problemText.slice(0, 100));

    return result;
  } catch (err) {
    if (process.env.NODE_ENV === 'development') {
      console.warn('[navigator-review] failed:', err instanceof Error ? err.message : err);
    }
    return null;
  }
}

/* ─── Cross-Agent Debate (Phase 5) ─── */

export type { DebateResult };

/**
 * Critical stakes에서 Stage 1 결과에 대해 Critic이 반론을 생성.
 * runNavigatorReview 이후에 호출. LLM 1회.
 */
export async function runDebate(
  problemText: string,
  workerResults: Array<{ agentName: string; agentRole: string; framework: string | null; result: string }>,
): Promise<DebateResult | null> {
  // Critic 에이전트 찾기
  const agents = useAgentStore.getState().getUnlockedAgents();
  const critic = agents.find(a => (a.keywords || []).some(kw => ['리스크', '위험', '비판', 'risk', 'danger', 'critique'].includes(kw)));
  if (!critic) return null;

  const locale = getCurrentLanguage();
  const criticName = (locale === 'en' && critic.nameEn) ? critic.nameEn : critic.name;
  const criticRole = (locale === 'en' && critic.roleEn) ? critic.roleEn : critic.role;
  return runDebateRound({
    problemText,
    stage1Results: workerResults,
    criticName,
    criticExpertise: critic.expertise || criticRole,
    locale,
  });
}

/* ─── Navigator Revision (Post-finalize iteration) ───────────────── */

export interface NavigatorRevisionResult {
  revised_text: string;
  change_summary: string;
}

/**
 * Post-finalize revision loop. User has a complete draft in hand and wants
 * the 항해장(Navigator) to edit it per a natural-language directive.
 *
 * Unlike runFinalDeliverable (which synthesizes a fresh final from mix +
 * concerns), this function is a minimal-invasive text-level edit: it assumes
 * the document is already good and only touches what the directive targets.
 *
 * Pure function — caller records the result via `useProgressiveStore.addDraft`.
 */
export async function runNavigatorRevision(params: {
  currentFinalText: string;
  directive: string;
  problemContext: string;
  currentVersionLabel: string;
  priorDrafts?: Array<{ version_label: string; change_summary: string }>;
  signal?: AbortSignal;
}): Promise<NavigatorRevisionResult> {
  const {
    currentFinalText,
    directive,
    problemContext,
    currentVersionLabel,
    priorDrafts,
    signal,
  } = params;

  const locale = getCurrentLanguage();

  const systemKo = `당신은 선원들의 분석을 종합하는 항해장(Navigator)입니다. 이미 완성된 기획안을, 사용자의 수정 요청에 따라 최소 침습 원칙으로 편집합니다.

## 원칙
1. **원본 구조 유지** — 섹션 제목, 순서, 전체 톤을 보존합니다. directive가 명시적으로 구조 변경을 요구할 때만 변경합니다.
2. **지시 범위 정확히 파악** — directive가 가리키는 범위(전체/섹션/문장)만 수정합니다. 범위 밖은 **한 글자도 손대지 않습니다**.
3. **사실 보존** — 숫자, 고유명사, 기존에 합의된 가정은 directive가 명시적으로 뒤집지 않는 한 유지합니다.
4. **문체 일관성** — 수정 부분이 나머지와 이질적이지 않도록 톤과 어휘를 맞춥니다.
5. **모호한 지시의 해석** — directive가 추상적("더 공격적으로", "덜 낙관적으로")이면, 그 의도에 가장 부합하는 구체적 변경 2~3개를 골라 적용합니다.
6. **change_summary** — 무엇이 바뀌었는지 40자 이내로 명확히. "섹션 3 재무 가정 보수화", "톤을 더 직설적으로" 같은 구체적 기술. "개선함" 같은 추상어 금지.

## 반환 JSON (다른 말 없이 JSON만)
{
  "revised_text": "수정된 전체 마크다운 (전체 반환, 부분 X)",
  "change_summary": "한 줄 요약 (40자 이내)"
}`;

  const systemEn = `You are the Navigator of an orchestra of expert agents. A complete document already exists; your job is to edit it per the user's directive with minimum-invasive edits.

## Principles
1. **Preserve original structure** — section headings, order, tone. Change them only if the directive explicitly requires it.
2. **Scope precisely** — touch only the part the directive targets. Do not change anything outside that scope.
3. **Preserve facts** — numbers, proper names, agreed assumptions stay unless the directive explicitly overrides them.
4. **Tone consistency** — edits must feel of a piece with the surrounding prose.
5. **Interpret abstract directives** — if the directive is vague ("more aggressive", "less optimistic"), pick 2-3 concrete changes that best capture the intent.
6. **change_summary** — describe what changed in ≤ 40 chars. Concrete, not abstract ("tightened financial section", not "improved it").

## Return JSON only
{
  "revised_text": "the entire revised markdown",
  "change_summary": "one-line summary (≤ 40 chars)"
}`;

  const priorBlock = priorDrafts && priorDrafts.length > 0
    ? (locale === 'ko'
        ? `\n\n## 이전 버전 이력\n${priorDrafts.map((d) => `- ${d.version_label}: ${d.change_summary}`).join('\n')}`
        : `\n\n## Prior version history\n${priorDrafts.map((d) => `- ${d.version_label}: ${d.change_summary}`).join('\n')}`)
    : '';

  const userKo = `## 원래 문제 맥락
${problemContext}

## 현재 버전 ${currentVersionLabel}
${currentFinalText}

## 수정 요청
${directive}${priorBlock}`;

  const userEn = `## Original problem context
${problemContext}

## Current version ${currentVersionLabel}
${currentFinalText}

## Revision request
${directive}${priorBlock}`;

  const result = await callLLMJson<NavigatorRevisionResult>(
    [{ role: 'user', content: locale === 'ko' ? userKo : userEn }],
    {
      system: locale === 'ko' ? systemKo : systemEn,
      maxTokens: 4000,
      signal,
      shape: { revised_text: 'string', change_summary: 'string' },
    },
  );

  // Record activity if 항해장 agent exists (even if not fully unlocked — this
  // is a meta-capability separate from task-based unlock progression).
  try {
    useAgentStore.getState().recordActivity(
      'navigator',
      'review_given',
      `revision:${directive.slice(0, 60)}`,
    );
  } catch {
    // Non-critical — revision itself succeeded.
  }

  return {
    revised_text: (result.revised_text || '').trim(),
    change_summary: (result.change_summary || '').trim().slice(0, 60),
  };
}
