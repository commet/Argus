/**
 * Progressive Engine — LLM 호출 + 상태 전이 오케스트레이션
 */

import { callLLMJson, callLLMStreamThenParse, LLMError } from '@/lib/llm';
import { salvageMixDoc } from '@/lib/partial-analysis';
import { buildHonestyScanPrompt, coerceHonestyFlags, type HonestyFlag } from '@/lib/honesty-scan';
import { buildLeanScanPrompt, coerceLeanFlags, neutralizeLeanText, type LeanFlag } from '@/lib/lean-scan';
import {
  buildInitialAnalysisPrompt,
  buildInitialRefinementPrompt,
  buildDeepeningPrompt,
  buildExecutionPlanPrompt,
  buildMixPrompt,
  buildFinalDeliverablePrompt,
  buildNavigatorReviewPrompt,
  buildFrameClarifyPrompt,
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
  type FrameClarifyEffect,
} from '@/lib/question-types';
import { policyFor } from '@/lib/decisive-premises';
import { pickSafeFallbackQuestion } from '@/lib/question-fallbacks';
import { FRAMING_CONFIDENCE_ROUTING_FALLBACK } from '@/lib/question-rules';
import { detectFatigue } from '@/lib/fatigue-signal';
import { validateQuestion, OverFireError, guardQuestionText } from '@/lib/question-validator';
import { track } from '@/lib/analytics';
import { buildReviewPrompt } from '@/lib/review-prompt';
import { sanitizeForPrompt } from '@/lib/persona-prompt';
import type { Agent } from '@/stores/agent-types';
import { assessConvergence, assessConvergenceWithWorkers } from '@/lib/progressive-convergence';
import { runDebateRound, type DebateResult } from '@/lib/debate-engine';
import { generateId } from '@/lib/uuid';
import { useAgentStore } from '@/stores/useAgentStore';
import { getCurrentLanguage, type Locale } from '@/lib/i18n';
import { classifyCrisis, type CrisisSignal } from '@/lib/crisis-gate';
import { limitQuestionMarks } from '@/lib/light-path/light-engine';
// Pure post-generation guards — shared with the sim harness so the judge
// measures shipped output, not raw model output (see progressive-guards.ts).
import {
  dropRepeatedQuestion,
  ensureCrisisResource,
  dropManufacturedFork,
  guardLowConfidenceOpeningQuestion,
  questionEchoesUser,
  lowConfidenceOpeningCopy,
  stripConditionalReassurance,
  stripUnearnedRanking,
  stripFrameSeizure,
  stripWordChoiceReading,
  capEscalationArrival,
  scrubBannedVocabulary,
  scrubList,
} from '@/lib/progressive-guards';
export {
  dropRepeatedQuestion,
  ensureCrisisResource,
  guardLowConfidenceOpeningQuestion,
  lowConfidenceOpeningCopy,
  stripConditionalReassurance,
  stripUnearnedRanking,
  stripFrameSeizure,
  stripWordChoiceReading,
  capEscalationArrival,
  scrubBannedVocabulary,
} from '@/lib/progressive-guards';
import { assessFrameStatus } from '@/lib/judgment-gates';
import {
  applyPremiseDeltas,
  verdictsWorthTelling,
  clampSynthesisToLivingState,
  coercePremiseCandidates,
  type AdmittedPremise,
} from '@/lib/judgment-state-contract';

/**
 * Keep the records in lockstep with whatever survived the route/escalation caps.
 *
 * `texts` (hidden_assumptions) is the authority on which CLAIMS shipped, since
 * that is the list the caps operate on. But since 2026-08-02 it deliberately
 * carries claims only — facts and standards never appear there, because every
 * legacy surface renders that list under the words "확인할 가정". Aligning
 * purely by text would therefore delete them, so non-competing records are
 * carried through on their own and only the claims are filtered by the caps.
 */
function alignRecords(records: AdmittedPremise[], texts: string[]): AdmittedPremise[] {
  const shipped = new Set((texts || []).map((t) => t.trim()));
  const kept = (records || []).filter(
    (r) => !policyFor(r.kind).competes || shipped.has(r.text.trim()),
  );
  // A claim that shipped without a matching record still renders; it just has
  // no source line to show.
  const known = new Set(kept.map((r) => r.text.trim()));
  const orphans = (texts || [])
    .filter((t) => !known.has(t.trim()))
    .map((text) => ({
      text,
      anchor_quote: '',
      if_false_changes: '',
      support_kind: 'explicit_reason' as const,
      kind: 'premise' as const,
    }));
  return [...kept, ...orphans];
}

/** Snapshots written before 2026-08-01 carry text only. Read them as records
 *  with no lineage rather than losing the premise entirely. */
function recordsFromSnapshot(snapshot: {
  premise_records?: Array<Partial<AdmittedPremise> & { text: string }>;
  hidden_assumptions?: string[];
}): AdmittedPremise[] {
  if (Array.isArray(snapshot.premise_records) && snapshot.premise_records.length > 0) {
    return snapshot.premise_records.map((r) => ({
      text: r.text,
      anchor_quote: r.anchor_quote || '',
      if_false_changes: r.if_false_changes || '',
      support_kind: r.support_kind || 'explicit_reason',
      kind: r.kind || 'premise',
      ...(r.observable ? { observable: r.observable } : {}),
    }));
  }
  return (snapshot.hidden_assumptions || []).map((text) => ({
    text, anchor_quote: '', if_false_changes: '', support_kind: 'explicit_reason' as const,
    kind: 'premise' as const,
  }));
}
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
  frame_line?: string;
  real_question: string;
  framing_confidence?: number;
  why_this_matters?: string;
  /** Raw model proposals. The runtime converts only grounded candidates into
   * the legacy snapshot string[] representation. */
  premise_candidates?: unknown;
  hidden_assumptions?: string[];
  skeleton: string[];
  /** The one-line answer the model is asked to produce (prompt JSON: "insight").
   *  For a non-open route (flat/vent/info/validation/…) this IS the deliverable —
   *  skeleton is empty by design, so the insight carries the whole answer. Was
   *  missing from this interface, so it was silently dropped from every snapshot. */
  insight?: string;
  /** R31 — the model's own STEP-0 classification, surfaced so the RUNTIME can
   *  enforce the structural contract (only `open` builds a plan). Optional: an
   *  older/weaker model may omit it, in which case the guard no-ops (safe). */
  request_type?: 'open' | 'flat' | 'vent' | 'validation' | 'info' | 'resistance' | 'self_profiling' | 'crisis';
  /** Decision weight — feeds the §0 sealing restraint gate (shouldSealContract) so
   *  a routine + reversible + confident decision gets a single light check, not the
   *  full sealing ceremony (CLAUDE.md mirror clause). Optional/safe-default. */
  stakes?: 'routine' | 'important' | 'critical';
  reversibility?: 'reversible' | 'partial' | 'irreversible';
  decision_density?: 'low' | 'medium' | 'high';
  decision_density_reasoning?: string;
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

/** Defensive: next_question.options is typed string[] but the model can emit
 *  objects/numbers. A non-string element renders as a React child and throws
 *  "Objects are not valid as a React child". Keep only strings (or undefined). */
function toStringOptions(opts: unknown): string[] | undefined {
  return Array.isArray(opts) ? opts.filter((o): o is string => typeof o === 'string') : undefined;
}

export function applyRouteContract<T extends {
  request_type?: string;
  skeleton?: string[];
  hidden_assumptions?: string[];
  next_question?: unknown;
}>(
  result: T,
): { result: T; coerced: boolean } {
  const rt = result.request_type;
  if (rt && NON_OPEN_REQUEST_TYPES.has(rt)) {
    // Some non-open routes are allowed exactly ONE clarifying line, because the
    // prompt itself asks for it: "'어디서부터 할지 모르겠다' is not a request for
    // a template; it may first need one line asking which part is actually
    // stuck." Deleting it left replies dangling mid-thought — one measured run
    // ended on "어느 쪽인지에 따라 다음 발걸음이 바뀌어요." and then simply
    // stopped, having just promised a next step. Venting and crisis still get
    // no question: there, a question is the intrusion.
    const mayAskOnce = rt === 'info' || rt === 'validation';
    const coerced = (Array.isArray(result.skeleton) && result.skeleton.length > 0)
      || (Array.isArray(result.hidden_assumptions) && result.hidden_assumptions.length > 0)
      || (!mayAskOnce && result.next_question != null);
    if (!coerced) return { result, coerced: false };
    return {
      result: {
        ...result,
        skeleton: [],
        hidden_assumptions: [],
        next_question: mayAskOnce ? result.next_question : null,
      },
      coerced: true,
    };
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
  frame_line?: string;
  real_question: string;
  /** State transition proposals; omission preserves the current premise list. */
  premise_changes?: unknown;
  hidden_assumptions?: string[];
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
  decision_read?: string;
  executive_summary: string;
  sections: {
    heading: string;
    content?: string;
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
  decision_read?: string;
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

interface FrameClarifyLLMOption {
  label: string;          // the frame sentence (also chosenFrame)
  real_question?: string; // reframed question under this frame
  framingBoost?: number;
  insight?: string;
}

interface FrameClarifyLLMResponse {
  text: string;
  subtext?: string;
  options: FrameClarifyLLMOption[];
}

/**
 * Generate a typed question. Engine picks the TYPE (state machine);
 * LLM fills in the CONTENT within that type's schema.
 *
 * Returns null on failure — caller should fall back to the legacy
 * untyped next_question from runInitialAnalysis / runDeepening.
 */
/** Turn a Layer-1 reject into a one-line regen instruction appended to the
 *  generation prompt (§6.1: "실패 사유를 프롬프트에 주입"). */
function buildRegenHint(rule: string, locale: Locale): string {
  const why: Record<string, [string, string]> = {
    admin_only: ['행정적 질문(마감·형식·결정권자)은 금지입니다', 'admin questions (deadline/format/decision-maker) are banned'],
    category_options: ['선택지가 카테고리 명사입니다 — 상사가 사인할 1줄 결정으로 바꾸세요', 'options are category nouns — make each a 1-line decision a boss could sign'],
    reask_known: ['이미 물어본 주제를 반복하고 있습니다 — 새 각도로 파고드세요', 'this repeats a theme already asked — dig from a new angle'],
    internal_structure: ['산출물의 내부 구조(섹션·스켈레톤)를 묻고 있습니다 — 판단을 바꾸는 전제를 물으세요', 'this asks about the deliverable structure — ask the premise that changes the judgment instead'],
    confirmation_bias: ['확인을 유도하는 질문입니다 — 중립적인 crux 질문으로 바꾸세요', 'this is a leading confirmation — make it a neutral crux question'],
  };
  const [ko, en] = why[rule] ?? ['질문 품질 기준에 미달했습니다', 'the question fell below the quality floor'];
  return locale === 'ko'
    ? `\n\n[재생성] 직전 질문이 반려됐습니다: ${ko}. 이 문제를 피해 다시 생성하세요.`
    : `\n\n[REGENERATE] The previous question was rejected: ${en}. Regenerate avoiding this.`;
}

/** Generate ONE typed question (no validation). regenHint, when present, is
 *  appended to the user prompt so the model avoids the prior reject reason. */
async function generateTypedQuestion(
  type: QuestionTypeTag,
  ctx: TypedQuestionContext,
  locale: Locale,
  signal?: AbortSignal,
  regenHint?: string,
): Promise<FlowQuestion | null> {
    if (type === 'strategic_fork') {
      const { system, user } = buildStrategicForkPrompt(ctx, locale);
      const result = await callLLMJson<StrategicForkLLMResponse>(
        [{ role: 'user', content: user + (regenHint ?? '') }],
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
            // Defensive (CLAUDE.md): the model may emit a scalar where an array is
            // typed. A string `skeleton`/`hidden_assumptions` would survive the
            // top-level shape check and later crash a downstream `.map`, killing the
            // turn AFTER the user picked this fork. Coerce to string[] or drop.
            snapshotPatch: o.snapshotPatch
              ? {
                  real_question: o.snapshotPatch.real_question,
                  hidden_assumptions: Array.isArray(o.snapshotPatch.hidden_assumptions)
                    ? o.snapshotPatch.hidden_assumptions.filter((x): x is string => typeof x === 'string')
                    : undefined,
                  skeleton: Array.isArray(o.snapshotPatch.skeleton)
                    ? o.snapshotPatch.skeleton.filter((x): x is string => typeof x === 'string')
                    : undefined,
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
        [{ role: 'user', content: user + (regenHint ?? '') }],
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

    if (type === 'frame_clarify') {
      const { system, user } = buildFrameClarifyPrompt(ctx, locale);
      const result = await callLLMJson<FrameClarifyLLMResponse>(
        [{ role: 'user', content: user + (regenHint ?? '') }],
        { system, maxTokens: 1800, signal, shape: { text: 'string', options: 'array' } },
      );
      if (!result.options || result.options.length < 2) return null;
      const options: TypedQuestionOption[] = result.options
        .filter(o => !!o.label)
        .map(o => {
          const effect: FrameClarifyEffect = {
            chosenFrame: o.label,
            // User-chosen signal → trusted; clamp defensively to [10,40] (§4.3b:
            // the only confidence increment we trust is a real user action).
            framingBoost: Math.min(40, Math.max(10, typeof o.framingBoost === 'number' ? o.framingBoost : 25)),
            snapshotPatch: o.real_question || o.insight
              ? {
                  real_question: typeof o.real_question === 'string' ? o.real_question : undefined,
                  insight: typeof o.insight === 'string' ? o.insight : undefined,
                }
              : undefined,
          };
          return { label: o.label, effect };
        });
      if (options.length < 2) return null;
      return buildFlowQuestion(
        generateId(),
        'frame_clarify',
        result.text,
        result.subtext,
        options,
        'reframe',
      );
    }

    // free_follow_up: not yet implemented — fall through to legacy.
    return null;
}

/**
 * Generate a typed question through the Question Quality Gate (§6.1):
 * generate → Layer-1 validate → on reject, regenerate with the reason injected
 * (≤2 attempts total) → on exhaustion, return null (caller uses the safe legacy
 * fallback, which is itself banned-guarded). Every reject/recovery/exhaustion is
 * logged to user_events so the fallback rate is measurable (§6.1).
 *
 * Engine picks the TYPE (state machine); the LLM only fills CONTENT.
 */
export async function runTypedQuestion(
  type: QuestionTypeTag,
  ctx: TypedQuestionContext,
  signal?: AbortSignal,
): Promise<FlowQuestion | null> {
  const locale = getCurrentLanguage();
  const MAX_ATTEMPTS = 2;
  let lastRejectRule: string | undefined;

  try {
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      const hint = lastRejectRule ? buildRegenHint(lastRejectRule, locale) : undefined;
      const q = await generateTypedQuestion(type, ctx, locale, signal, hint);
      if (!q) return null; // generation failure — caller uses legacy (guarded)

      let res;
      try {
        res = validateQuestion({
          text: q.text,
          options: q.options,
          tag: type,
          locale,
          requestType: ctx.requestType,
          previousQA: ctx.previousQA,
          userText: ctx.problemText,
        });
      } catch (e) {
        // R5 over-fire: a non-open request reached generation (structural gate
        // bypassed). Degrade to the legacy path, loudly in dev + telemetry.
        if (e instanceof OverFireError) {
          track('question_quality', { outcome: 'over_fire', tag: type, request_type: ctx.requestType });
          return null;
        }
        throw e;
      }

      if (res.ok) {
        if (attempt > 0) track('question_quality', { outcome: 'regen_recovered', tag: type });
        return q;
      }
      lastRejectRule = res.rule;
      track('question_quality', { outcome: 'reject', rule: res.rule, tag: type, attempt });
    }
    track('question_quality', { outcome: 'exhausted', rule: lastRejectRule, tag: type });
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

/**
 * Last-line quality floor for the user-facing question on EVERY path (§6.2
 * coverage note). Typed questions already passed the validator; this catches a
 * banned LLM-provided legacy/generic question (e.g. next_question.text that is
 * itself an admin-only ask) and swaps it for a safe crux, dropping now-stale
 * options. A no-op for questions that are already clean. */
function guardFinalQuestion(
  q: FlowQuestion | null,
  locale: Locale,
  seed: string,
): FlowQuestion | null {
  if (!q) return q;
  // R8 (sim v2): the one-question-per-turn clamp was wired on the light path
  // only — a heavy question shipped with two question marks. Same softening
  // here, at the single choke point every path's final question passes.
  const softened = limitQuestionMarks(q.text);
  const g = guardQuestionText(softened, locale, seed);
  if (!g.banned) return softened === q.text ? q : { ...q, text: softened };
  track('question_quality', { outcome: 'final_guard_swap', phase: q.engine_phase });
  return { ...q, text: g.text, options: undefined, type: 'short' };
}

// ─── Engine functions ───

/**
 * Step 1: 초기 분석 — 문제 입력 → 즉시 뼈대 + 첫 질문
 * @param onToken - 스트리밍 콜백 (있으면 실시간 출력 표시)
 */
/** Build the suppressed crisis snapshot + conscious-continue question — the SINGLE
 *  shape every entry path uses when classifyCrisis fires (runInitialAnalysis,
 *  refineInitialFraming, runDeepening), so the safety backstop can't drift between
 *  paths (CLAUDE.md: single source of truth for the suppression shape).
 *  `real_question` stays the user's OWN navigation words — the concern lives only on
 *  `crisis` and is rendered by CrisisConcernBanner; `skeleton: []` suppresses the
 *  plan AND blocks contract sealing (no predicates); `framing_locked` suppresses the
 *  "is this framing right?" ceremony on a safety input. */
function buildCrisisSnapshot(
  userWords: string,
  crisis: CrisisSignal,
  locale: string,
  version: number,
  carry?: Partial<AnalysisSnapshot>,
): { snapshot: AnalysisSnapshot; question: FlowQuestion } {
  const snapshot: AnalysisSnapshot = {
    version,
    real_question: userWords,
    hidden_assumptions: [],
    skeleton: [],
    framing_confidence: 20,
    framing_locked: true,
    crisis,
    ...carry,
  };
  // A valid-but-suppressed question so the conscious-continue path has a target;
  // the UI hides it by default and only reveals it after an explicit override.
  const question: FlowQuestion = {
    id: generateId(),
    text: locale === 'ko' ? '계속 진행하시겠어요?' : 'Would you like to continue?',
    type: 'short',
    engine_phase: 'reframe',
  };
  return { snapshot, question };
}


/**
 * Post-generation honesty scan (loop-17) — NON-BLOCKING. Run AFTER the analysis
 * has rendered; returns spans the model asserted as settled world-fact or
 * fabricated specifics the user never gave (the loop-16 failure mode). The caller
 * fires this fire-and-forget and patches snapshot.honesty_flags when it resolves,
 * so the analysis appears instantly and unverified claims get a "확인 필요" shade a
 * beat later. Precision-tuned (see honesty-scan.ts) — a false shade is worse than
 * a miss. Never throws to the caller: any failure resolves to [] (honest-empty).
 */
export async function scanHonesty(
  problemText: string,
  analysis: { real_question?: string; hidden_assumptions?: string[]; skeleton?: string[]; insight?: string },
  signal?: AbortSignal,
): Promise<HonestyFlag[]> {
  try {
    const locale = getCurrentLanguage();
    // Nothing to scan on a terminal one-liner with no claims-bearing body.
    const hasBody = !!(analysis.insight || (analysis.hidden_assumptions || []).length || (analysis.skeleton || []).length);
    if (!hasBody) return [];
    const { system, user } = buildHonestyScanPrompt(problemText, analysis, locale);
    const raw = await callLLMJson<{ flags?: unknown }>(
      [{ role: 'user', content: user }],
      { system, maxTokens: 1200, signal, shape: { flags: 'array' }, parseRetries: 0 },
    );
    return coerceHonestyFlags(raw);
  } catch {
    return []; // honest-empty on any failure — never block or corrupt the render
  }
}

/** First-analysis neutrality backstop. This is non-blocking like scanHonesty,
 * but returns neutral rewrites because labeling a verdict would still leave the
 * verdict in the user's head. The UI applies only exact matched spans. */
export async function scanLean(
  problemText: string,
  analysis: { real_question?: string; hidden_assumptions?: string[]; skeleton?: string[]; insight?: string },
  signal?: AbortSignal,
): Promise<LeanFlag[]> {
  try {
    const locale = getCurrentLanguage();
    const hasBody = !!(analysis.insight || (analysis.hidden_assumptions || []).length || (analysis.skeleton || []).length);
    if (!hasBody) return [];
    const { system, user } = buildLeanScanPrompt(problemText, analysis, locale);
    const raw = await callLLMJson<{ flags?: unknown }>(
      [{ role: 'user', content: user }],
      { system, maxTokens: 1000, signal, shape: { flags: 'array' }, parseRetries: 0 },
    );
    return coerceLeanFlags(raw);
  } catch {
    return [];
  }
}

/** FIX 7 — the integrity scans used to run ONLY on the analysis card; the mix
 * (the document the user actually ships) went out unscanned. This maps the
 * document fields into the scans' analysis shape and runs both, best-effort:
 * any failure resolves to empty flags and never sinks the mix.
 *  - decision_read + executive_summary ride the `insight` slot (where verdicts
 *    and asserted world-facts concentrate — the lean scan's own doctrine).
 *  - sections ride the `skeleton` slot (body prose; the skeleton exemption for
 *    imperative ACTION steps correctly spares "확인하세요" pointers).
 *  - key_assumptions are deliberately NOT scanned: they are declared assumptions,
 *    which is already the honest form. */
export async function scanMixIntegrity(
  problemText: string,
  mix: MixResult,
  signal?: AbortSignal,
): Promise<{ leanFlags: LeanFlag[]; honestyFlags: HonestyFlag[] }> {
  const analysis = {
    real_question: mix.title || '',
    hidden_assumptions: [] as string[],
    skeleton: (mix.sections || []).map(s => `${s.heading} — ${s.content}`),
    insight: [mix.decision_read, mix.executive_summary].filter(Boolean).join('\n'),
  };
  const [leanFlags, honestyFlags] = await Promise.all([
    scanLean(problemText, analysis, signal),
    scanHonesty(problemText, analysis, signal),
  ]);
  return { leanFlags, honestyFlags };
}

/** Apply the mix integrity scan: NEUTRALIZE lean spans in place (a verdict must
 * be rewritten, never labeled — mirror clause) and attach honesty flags for the
 * "확인 필요" shade. Pure; returns a new MixResult. */
export function applyMixIntegrity(
  mix: MixResult,
  leanFlags: LeanFlag[],
  honestyFlags: HonestyFlag[],
): MixResult {
  const n = (t: string) => neutralizeLeanText(t, leanFlags);
  return {
    ...mix,
    title: n(mix.title || ''),
    ...(mix.decision_read != null ? { decision_read: n(mix.decision_read) } : {}),
    executive_summary: n(mix.executive_summary || ''),
    sections: (mix.sections || []).map(s => ({
      ...s,
      heading: n(s.heading || ''),
      content: n(s.content || ''),
      ...(s.sentences
        ? { sentences: s.sentences.map(sent => ({ ...sent, text: n(sent.text || '') })) }
        : {}),
    })),
    honesty_flags: honestyFlags,
  };
}

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
    const { snapshot, question } = buildCrisisSnapshot(problemText, crisis, locale, 0);
    return { snapshot, question, detectedDM: null };
  }

  const { system, user } = buildInitialAnalysisPrompt(problemText, locale);

  // Stream: real-time display then JSON parse, or standard approach.
  // maxTokens 4096 (was 2000): the full Korean OPEN-decision JSON measures
  // ~3,900 output tokens, so the old budget truncated ~44% of streams mid-JSON
  // (7-day production count) — every one of those re-ran the whole call and
  // froze the screen for the retry. The cap is a ceiling, not a target: short
  // routes (vent/info/flat) still stop where they stop.
  // cacheSystem: the ~7k-token system prompt is byte-identical per locale, so
  // it prompt-caches across all calls and users.
  const result = onToken
    ? await callLLMStreamThenParse<InitialAnalysisResponse>(
        [{ role: 'user', content: user }],
        { system, maxTokens: 4096, signal, cacheSystem: true, shape: { frame_line: 'string', real_question: 'string', premise_candidates: 'array', skeleton: 'array', next_question: 'object' } },
        onToken,
      )
    : await callLLMJson<InitialAnalysisResponse>(
        [{ role: 'user', content: user }],
        { system, maxTokens: 4096, signal, cacheSystem: true, shape: { frame_line: 'string', real_question: 'string', premise_candidates: 'array', skeleton: 'array', next_question: 'object' } },
      );

  result.real_question = result.frame_line || result.real_question;
  result.skeleton = [];
  // A premise is a proposal until it proves lineage to the user's words.
  // Non-open routes carry no decision premises at all.
  const initialPremises = result.request_type === 'open'
    ? coercePremiseCandidates(result.premise_candidates, problemText)
    : { premises: [], records: [], audit: [] };
  result.hidden_assumptions = initialPremises.premises;

  // R31 — runtime route-contract guard: a non-open request that nonetheless built
  // a plan is the model ignoring the STEP-0 under-fire gate (R29: ~44% on weak/mid
  // tiers). Enforce the restraint structural contract the prompt already states.
  const { result: contractResult } = applyRouteContract(result);
  Object.assign(result, contractResult);
  // R2 — an accepted light-path escalation gets a MINIMAL first contact by code.
  Object.assign(result, capEscalationArrival(result, problemText));

  const framingConfidence = Math.min(100, Math.max(0, result.framing_confidence ?? 75));
  // §4.3b — the frame_clarify gate must not read "signal absent" as "confident".
  // The snapshot keeps its 75 default (other consumers depend on it), but the
  // QUESTION-ROUTING input treats a missing report as low (50), so an ambiguous
  // framing that the model failed to score still fires frame_clarify.
  const framingConfidenceReported = result.framing_confidence != null;
  const routingFramingConfidence = framingConfidenceReported
    ? framingConfidence
    : FRAMING_CONFIDENCE_ROUTING_FALLBACK;

  // Route-specific insight guards (all code-enforced, sim F1/R1): crisis gets
  // the resource line appended; validation gets the conditional-reassurance
  // sentence stripped. Both then pass the heavy vocabulary scrub (R7).
  // Reading the user's own grammar back to them as evidence about their inner
  // state is a spine violation on EVERY route, so it is stripped before the
  // route-specific guards — including on crisis, where the resource line is
  // then appended to whatever honestly survives.
  const literalInsight = stripFrameSeizure(stripWordChoiceReading(result.insight));
  const routedInsight = result.request_type === 'crisis'
    ? ensureCrisisResource(literalInsight || result.real_question, locale)
    : result.request_type === 'validation'
      ? stripConditionalReassurance(literalInsight)
      // Ranking the user's own concerns is a verdict about them on every route.
      : stripUnearnedRanking(literalInsight);

  const snapshot: AnalysisSnapshot = {
    version: 0,
    real_question: result.real_question || (locale === 'ko' ? '분석 중...' : 'Analyzing...'),
    hidden_assumptions: result.hidden_assumptions || [],
    premise_records: alignRecords(initialPremises.records, result.hidden_assumptions || []),
    premise_verdicts: verdictsWorthTelling(initialPremises.audit),
    // A conversation turn writes no plan (judgment harness v2).
    skeleton: [],
    // OPEN analyses may generate a memorable sentence that quietly resolves the
    // choice despite the prompt. Structurally use the neutral real question as
    // the first-frame insight. Non-open routes keep their direct one-line answer.
    // A model-flagged crisis additionally gets the resource line BY CODE (F1).
    // An open decision shows the FRAME as its opening line. It used to show a
    // canned "아직 무엇이 이 판단을 움직이는지는 정해지지 않았어요" whenever the
    // model self-scored under 70 — which open decisions routinely do — so the
    // first thing most people read was Argus saying it had nothing.
    // When the word-choice guard empties a non-open insight, the honest
    // replacement is their own frame — SHORTER than they said it, in their
    // words, by contract — not silence and not a canned sentence about them.
    insight: result.request_type && result.request_type !== 'open'
        ? (routedInsight
          ? scrubBannedVocabulary(routedInsight)
          : (result.real_question || routedInsight))
        : (result.real_question || (locale === 'ko' ? '무엇이 이 결정을 가르는지부터 확인해볼게요.' : 'Let’s first identify what this decision turns on.')),
    framing_confidence: framingConfidence,
    framing_locked: false,
    // R32 — wire the model's STEP-0 classification onto the snapshot so the flow
    // can make a non-open route terminal (ProgressiveFlow suppresses the fabricated
    // follow-up question). Undefined when the model omits it → flow stays normal.
    request_type: result.request_type,
    // R60 — populate frame_status (was DEAD: assessFrameStatus existed but was never
    // called, so the flat-decision over-fire gate had nothing to read). Conservative
    // by design: only 'flat' when the reframe is essentially the surface question AND
    // there are no assumptions to pivot on — otherwise 'load_bearing'. The flow gates
    // team deployment + the probe on 'flat' so a genuinely flat decision isn't given
    // manufactured ceremony (CLAUDE.md mirror clause).
    frame_status: assessFrameStatus({
      realQuestion: result.real_question || '',
      surfaceQuestion: problemText,
      assumptions: result.hidden_assumptions || [],
    }),
    // Decision weight for the §0 sealing restraint gate. Safe defaults: only the
    // explicit 'routine'/'reversible' values can downgrade the seal to a single
    // check — an omitted/garbled classification keeps the full ceremony (never
    // wrongly skips a real decision's seal).
    stakes: result.stakes === 'routine' || result.stakes === 'critical' ? result.stakes : 'important',
    reversibility: result.reversibility === 'reversible' || result.reversibility === 'irreversible' ? result.reversibility : 'partial',
  };

  // Phase 1 typed question: framing_confidence>=70이면 strategic_fork로 넘어간다.
  // 실패 시 기존 next_question으로 fallback.
  const legacyQuestion: FlowQuestion = {
    id: generateId(),
    text: result.next_question?.text || pickSafeFallbackQuestion(locale, snapshot.real_question || problemText),
    subtext: result.next_question?.subtext,
    options: toStringOptions(result.next_question?.options),
    type: result.next_question?.type || 'select',
    engine_phase: 'reframe',
  };

  const typedArgs = [
    {
      round: 0,
      framingConfidence: routingFramingConfidence,
      framingConfidenceReported,
      askedTypes: [] as QuestionTypeTag[],
      workerOutputsReady: false,
      requestType: snapshot.request_type,
    },
    {
      problemText,
      snapshot: {
        real_question: snapshot.real_question,
        hidden_assumptions: snapshot.hidden_assumptions,
        skeleton: snapshot.skeleton,
        insight: snapshot.insight,
      },
      requestType: snapshot.request_type,
    },
  ] as const;

  const seed = snapshot.real_question || problemText;
  // THE HARNESS'S OWN QUESTION WINS WHEN IT IS GROUNDED.
  //
  // The typed-question layer runs a SECOND, narrower prompt that sees a summary
  // instead of the situation, and its output was replacing the question written
  // by the pass that actually read the person. Measured in production: the
  // harness wrote "지금 이 결정에서 제일 걸리는 게 뭐예요 — 연봉이요, 아니면
  // 리드 승진 가능성이요?" (both sides quoted from them) and the screen showed
  // "이 상황에서 지금 가장 마음에 걸리는 건 뭐예요?" — a question for anybody.
  // The typed layer is a FALLBACK for when the harness didn't ask something
  // grounded, not an upgrade over one that did.
  const harnessQuestion = result.next_question?.text
    && questionEchoesUser(result.next_question.text, problemText)
    ? legacyQuestion
    : null;
  let question: FlowQuestion;
  if (onTypedUpgrade) {
    // Show the legacy question NOW; upgrade in the background (best-effort —
    // abort/failure leaves the legacy question standing, which is honest).
    question = guardLowConfidenceOpeningQuestion(
      guardFinalQuestion(legacyQuestion, locale, seed) ?? legacyQuestion,
      problemText,
      locale,
    ) ?? legacyQuestion;
    if (!harnessQuestion) {
      pickAndGenerateTypedQuestion(typedArgs[0], typedArgs[1], signal)
        .then((t) => {
          const guarded = guardLowConfidenceOpeningQuestion(t, problemText, locale);
          if (guarded) onTypedUpgrade(guarded, legacyQuestion.id);
        })
        .catch(() => { /* upgrade is optional polish, never a failure */ });
    }
  } else {
    const typed = harnessQuestion
      ? null
      : await pickAndGenerateTypedQuestion(typedArgs[0], typedArgs[1], signal);
    question = guardLowConfidenceOpeningQuestion(
      guardFinalQuestion(typed ?? legacyQuestion, locale, seed) ?? legacyQuestion,
      problemText,
      locale,
    ) ?? legacyQuestion;
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

  // Safety backstop on the framing-rejection path (F17). A user can start with a
  // safe problem, then introduce a crisis signal in the rejection reason — that
  // text was never screened. Screen it before any LLM call, same suppression as
  // runInitialAnalysis. (The original problemText was already screened at round 0.)
  const crisis = classifyCrisis(rejectionReason);
  if (crisis.isCrisis && crisis.category) {
    const { snapshot, question } = buildCrisisSnapshot(
      problemText, crisis, locale, 0, { framing_override_reason: rejectionReason },
    );
    return { snapshot, question, detectedDM: null };
  }

  const { system, user } = buildInitialRefinementPrompt(
    problemText, rejectedQuestion, rejectionReason, locale,
  );

  // Same budget/caching rationale as runInitialAnalysis: identical output
  // shape (full re-analysis), static-per-locale system prompt.
  const result = onToken
    ? await callLLMStreamThenParse<InitialAnalysisResponse>(
        [{ role: 'user', content: user }],
        { system, maxTokens: 4096, signal, cacheSystem: true, shape: { frame_line: 'string', real_question: 'string', premise_candidates: 'array', skeleton: 'array', next_question: 'object' } },
        onToken,
      )
    : await callLLMJson<InitialAnalysisResponse>(
        [{ role: 'user', content: user }],
        { system, maxTokens: 4096, signal, cacheSystem: true, shape: { frame_line: 'string', real_question: 'string', premise_candidates: 'array', skeleton: 'array', next_question: 'object' } },
      );

  result.real_question = result.frame_line || result.real_question;
  result.skeleton = [];
  const refinedPremises = result.request_type === 'open'
    ? coercePremiseCandidates(result.premise_candidates, `${problemText}\n${rejectionReason}`)
    : { premises: [] as string[], records: [] as AdmittedPremise[], audit: [] };
  result.hidden_assumptions = refinedPremises.premises;

  const { result: contractResult } = applyRouteContract(result);
  Object.assign(result, contractResult);

  const framingConfidence = Math.min(100, Math.max(0, result.framing_confidence ?? 70));

  const refinedRoutedInsight = result.request_type === 'crisis'
    ? ensureCrisisResource(result.insight, locale)
    : result.request_type === 'validation'
      ? stripConditionalReassurance(result.insight)
      // Ranking the user's own concerns is a verdict about them on every route.
      : stripUnearnedRanking(result.insight);

  const snapshot: AnalysisSnapshot = {
    version: 0,
    real_question: result.real_question || (locale === 'ko' ? '분석 중...' : 'Analyzing...'),
    hidden_assumptions: result.hidden_assumptions || [],
    premise_records: alignRecords(refinedPremises.records, result.hidden_assumptions || []),
    premise_verdicts: verdictsWorthTelling(refinedPremises.audit),
    skeleton: [],
    insight: result.request_type && result.request_type !== 'open'
      ? (refinedRoutedInsight ? scrubBannedVocabulary(refinedRoutedInsight) : refinedRoutedInsight)
      : (result.real_question || (locale === 'ko' ? '무엇이 이 결정을 가르는지부터 확인해볼게요.' : 'Let’s first identify what this decision turns on.')),
    framing_confidence: framingConfidence,
    framing_locked: false,
    framing_override_reason: rejectionReason,
    request_type: result.request_type,
    frame_status: assessFrameStatus({
      surfaceQuestion: problemText,
      realQuestion: result.real_question || '',
      assumptions: result.hidden_assumptions || [],
    }),
    stakes: result.stakes === 'routine' || result.stakes === 'critical' ? result.stakes : 'important',
    reversibility: result.reversibility === 'reversible' || result.reversibility === 'irreversible' ? result.reversibility : 'partial',
    decision_density: result.decision_density,
    decision_density_reasoning: result.decision_density_reasoning,
  };

  const refinedQuestion: FlowQuestion = {
    id: generateId(),
    text: result.next_question?.text || pickSafeFallbackQuestion(locale, result.real_question || problemText),
    subtext: result.next_question?.subtext,
    options: toStringOptions(result.next_question?.options),
    type: result.next_question?.type || 'select',
    engine_phase: 'reframe',
  };
  return {
    snapshot,
    question: guardFinalQuestion(refinedQuestion, locale, result.real_question || problemText) ?? refinedQuestion,
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
  /** Standard judgment never spends a second model call manufacturing an
   * execution team. Deep is an explicit, quota-gated user choice. */
  judgmentMode: 'standard' | 'deep' = 'standard',
): Promise<{
  snapshot: AnalysisSnapshot;
  question: FlowQuestion | null;
  readyForMix: boolean;
  convergenceMetrics: ConvergenceMetrics;
}> {
  const locale = getCurrentLanguage();

  // Safety backstop on the Q&A deepening path (F18). A crisis can surface in a
  // round-1+ answer, not just the round-0 problem. Screen the answers before the LLM
  // call. Do NOT re-fire if the user already consciously continued past a round-0
  // crisis (carried on currentSnapshot.crisis; the banner stays pinned) — that would
  // re-block every round (over-fire / the mirror clause).
  if (!currentSnapshot.crisis?.isCrisis) {
    const answersText = questionsAndAnswers.map((qa) => qa.answer?.value || '').join('  ');
    const crisis = classifyCrisis(answersText);
    if (crisis.isCrisis && crisis.category) {
      const { snapshot, question } = buildCrisisSnapshot(
        currentSnapshot.real_question, crisis, locale, currentSnapshot.version + 1,
        { request_type: currentSnapshot.request_type },
      );
      const convergence = assessConvergence([...allSnapshots, snapshot]);
      return { snapshot, question, readyForMix: false, convergenceMetrics: convergence };
    }
  }

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

  // ── Call A: the streamed narrative (insight / question / assumptions / skeleton). ──
  // The large execution_plan is NO LONGER part of this response — it is generated
  // in a separate call below. That split is the structural fix for the round-3
  // "JSON 파싱 실패": the plan used to inflate this JSON past the token budget and
  // truncate it mid-structure. Without the plan, this payload stays small and the
  // streamed parse can't be cut off.
  const { system, user } = buildDeepeningPrompt(
    problemText, currentSnapshot, questionsAndAnswers, round, maxRounds, locale,
  );

  // maxTokens 2500: the narrative alone (no plan) runs ~1000-1300 tokens even in
  // Korean, so this is genuine 2x headroom — not a payload we're chasing.
  const result = onToken
    ? await callLLMStreamThenParse<DeepeningResponse>(
        [{ role: 'user', content: user }],
        { system, maxTokens: 2500, signal, shape: { insight: 'string', frame_line: 'string', real_question: 'string', premise_changes: 'array', skeleton: 'array', ready_for_mix: 'boolean' } },
        onToken,
      )
    : await callLLMJson<DeepeningResponse>(
        [{ role: 'user', content: user }],
        { system, maxTokens: 2500, signal, shape: { insight: 'string', frame_line: 'string', real_question: 'string', premise_changes: 'array', skeleton: 'array', ready_for_mix: 'boolean' } },
      );

  result.real_question = result.frame_line || result.real_question;
  result.skeleton = [];
  const userCorpus = [
    problemText,
    ...questionsAndAnswers.map((qa) => String(qa.answer.value ?? '')),
  ].join('\n');
  const latestAnswer = String(questionsAndAnswers.at(-1)?.answer.value ?? '');
  const premiseTransition = applyPremiseDeltas(
    recordsFromSnapshot(currentSnapshot),
    result.premise_changes,
    userCorpus,
    latestAnswer,
  );
  const nextPremises = premiseTransition.premises;

  // ── Call B: execution_plan in its own robust, plan-only deep-mode call. ──
  // Generated from the freshly-deepened analysis (Call A's output). It gets the
  // whole token budget to itself, so it can't truncate the narrative — and it is
  // best-effort: a plan failure must NEVER sink the turn (the user already saw the
  // insight stream in). On failure we carry the previous plan forward. A user
  // abort still propagates so the outer handler can roll the answer back.
  let executionPlan = judgmentMode === 'deep' ? currentSnapshot.execution_plan : undefined;
  if (judgmentMode === 'deep') {
    try {
      const planPrompt = buildExecutionPlanPrompt(
        problemText,
        {
          real_question: result.real_question || currentSnapshot.real_question,
          hidden_assumptions: nextPremises,
          skeleton: result.skeleton || currentSnapshot.skeleton,
        },
        questionsAndAnswers, round, availableAgents, locale, leadContext, registeredPersonas,
        // FIX 5 — feed the MEASURED round-0 weight (living estimate) into the
        // crew-restraint clause instead of letting the planner re-derive it.
        { stakes: currentSnapshot.stakes, reversibility: currentSnapshot.reversibility },
      );
      // maxTokens 3500: a 5-step Korean plan with human-step fields is the
      // largest realistic payload; 3500 (well under the server cap) clears it.
      // callLLMJson also carries a corrective parse-retry of its own.
      const plan = await callLLMJson<{ steps: ExecutionPlanStep[]; key_assumptions?: string[] }>(
        [{ role: 'user', content: planPrompt.user }],
        { system: planPrompt.system, maxTokens: 3500, signal, shape: { steps: 'array', key_assumptions: 'array' } },
      );
      if (plan?.steps?.length) {
        executionPlan = { steps: plan.steps, key_assumptions: plan.key_assumptions || [] };
      }
    } catch (e) {
      if (signal?.aborted) throw e; // user cancellation — let the outer handler roll back
      // otherwise best-effort: keep the prior plan, don't fail the whole turn
    }
  }

  const snapshot: AnalysisSnapshot = {
    version: currentSnapshot.version + 1,
    real_question: result.real_question || currentSnapshot.real_question,
    hidden_assumptions: nextPremises,
    premise_records: alignRecords(premiseTransition.records, nextPremises),
    premise_verdicts: verdictsWorthTelling(premiseTransition.audit),
    // Weight has to survive the round. Without it the §0 sealing gate read
    // 'important / partial' from its own defaults on every snapshot after the
    // first, so a routine reversible call still got the full closing ceremony —
    // the over-fire the gate exists to prevent.
    stakes: currentSnapshot.stakes,
    reversibility: currentSnapshot.reversibility,
    // R7 — heavy prose passes the banned-vocabulary scrub on every round.
    skeleton: scrubList(result.skeleton || currentSnapshot.skeleton),
    execution_plan: executionPlan,
    // Both identity-level guards run here too. Round 2 is where the frame gets
    // taken — the model has just heard something and reaches to re-explain the
    // decision back at the person — and until 2026-08-02 nothing on this path
    // looked at the insight except the ranking strip. When they empty it, the
    // user's own frame stands in; it is their words made shorter, by contract.
    insight: (() => {
      const literal = stripFrameSeizure(stripWordChoiceReading(result.insight));
      if (!literal) return result.real_question || currentSnapshot.real_question;
      return scrubBannedVocabulary(stripUnearnedRanking(literal) || literal);
    })(),
    framing_confidence: currentSnapshot.framing_confidence,
    framing_locked: currentSnapshot.framing_locked,
    // Carry the deterministic crisis flag forward so the resource banner stays
    // pinned across deepening even after a conscious "continue" (defensive: the
    // banner also reads it off the round-0 snapshot, but don't depend on that).
    crisis: currentSnapshot.crisis,
    // Carry the route classification forward (deepening only happens on an open
    // decision, but keep it pinned so the flow's non-open check is stable).
    request_type: currentSnapshot.request_type,
    // R60 — re-assess flat/load_bearing on the refined question (a deepened reframe
    // can resolve to flat). Conservative; gates team/probe in the flow.
    frame_status: assessFrameStatus({
      realQuestion: result.real_question || currentSnapshot.real_question || '',
      surfaceQuestion: problemText,
      assumptions: nextPremises,
    }),
  };

  // Adaptive convergence: 스냅샷 전체 + 새 스냅샷으로 수렴도 계산
  const convergence = assessConvergence([...allSnapshots, snapshot]);
  snapshot.convergence_score = convergence.score;
  snapshot.convergence_trend = convergence.trend;

  // LLM이 ready라고 했거나, 수렴도가 충분하면 Mix 가능
  const llmSaysReady = result.ready_for_mix === true;
  const convergenceSaysReady = convergence.is_converged;
  const isMaxRound = round >= maxRounds - 1;
  const fatigueDetected = detectFatigue(
    questionsAndAnswers.map((qa) => ({ value: String(qa.answer?.value ?? '') })),
  );
  // A single answer is too thin a basis for closing a critical or irreversible
  // decision automatically. The user can still take the always-visible
  // "wrap up from my answers so far" exit; this guard only prevents the model
  // from declaring the inquiry complete on their behalf after one tap.
  const needsSecondLook = currentSnapshot.stakes === 'critical'
    || currentSnapshot.reversibility === 'irreversible';
  const minimumInquiryEarned = !needsSecondLook
    || questionsAndAnswers.length >= 2
    || fatigueDetected;

  // 적응형 수렴: 최대 라운드라도 수렴 안 됐으면 강제하지 않음 → 대신 선택지 제시
  let shouldProceedToMix: boolean;
  let question: FlowQuestion | null;

  if ((llmSaysReady || convergenceSaysReady) && minimumInquiryEarned) {
    // 수렴 완료
    shouldProceedToMix = true;
    question = null;
  } else if (isMaxRound && !convergenceSaysReady) {
    // 최대 라운드인데 수렴 안 됨 → 사용자에게 선택지 제시
    shouldProceedToMix = false;
    question = {
      id: generateId(),
      // The convergence gauge was REMOVED from the UI on purpose — it surfaced an
      // uncalibrated score as a verdict about the user's thinking. It leaked back
      // in through this fallback question. assessConvergence still routes
      // internally; it does not get to grade anyone out loud.
      text: locale === 'ko'
        ? '여기서 어떻게 할까요?'
        : 'Where would you like to take it from here?',
      subtext: convergence.guidance,
      options: locale === 'ko'
        ? ['지금까지 답한 내용으로 정리하기', '한 가지만 더 짚어보기', '질문을 다시 잡기']
        : ['Wrap up with what we have', 'Look at one more thing', 'Reframe the question'],
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
      requestType: snapshot.request_type,
      // §7 — stop asking optional questions once the user reads as tired.
      fatigueDetected,
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
      requestType: snapshot.request_type,
    };

    const nextQuestion = dropRepeatedQuestion(
      result.next_question,
      questionsAndAnswers.map((qa) => qa.question.text),
    );
    // Everything the user has written by now. A fork THEY drew is theirs to be
    // asked about, and by round 3 they may have drawn it in an answer rather
    // than in the opener.
    const userCorpus = [problemText, ...questionsAndAnswers.map((qa) => String(qa.answer.value ?? ''))]
      .filter(Boolean).join('\n');
    const legacyQuestion: FlowQuestion | null = nextQuestion
      ? {
          id: generateId(),
          text: nextQuestion.text,
          subtext: nextQuestion.subtext,
          options: toStringOptions(nextQuestion.options),
          type: nextQuestion.type || 'select',
          engine_phase: round >= 1 ? 'recast' : 'reframe',
        }
      : null;

    if (legacyQuestion && onTypedUpgrade) {
      // P1-3: the user sees the next question immediately (the deepening
      // answer already arrived); the typed upgrade lands ~5–10s later and
      // swaps in only while the question is still unanswered.
      question = guardFinalQuestion(
        dropManufacturedFork(legacyQuestion, userCorpus),
        locale,
        snapshot.real_question || problemText,
      );
      pickAndGenerateTypedQuestion(stateCtx, genCtx, signal)
        .then((t) => {
          const kept = dropManufacturedFork(t, userCorpus);
          if (kept) onTypedUpgrade(kept, legacyQuestion.id);
        })
        .catch(() => { /* best-effort upgrade */ });
    } else {
      const typed = await pickAndGenerateTypedQuestion(stateCtx, genCtx, signal);
      const minimumInquiryFallback: FlowQuestion | null = !minimumInquiryEarned
        ? {
            id: generateId(),
            text: locale === 'ko'
              ? '지금까지 나온 말 중, 아직 실제로 확인되지 않은 약속이나 조건은 무엇인가요?'
              : 'Which promise or condition mentioned so far has not yet been verified?',
            subtext: locale === 'ko'
              ? '한 번 더 묻되, 결론을 늘이지 않고 실제로 확인할 한 가지를 찾습니다.'
              : 'One more question identifies a concrete check without prolonging the decision.',
            type: 'short',
            engine_phase: round >= 1 ? 'recast' : 'reframe',
          }
        : null;
      question = guardFinalQuestion(
        dropManufacturedFork(typed, userCorpus)
          ?? dropManufacturedFork(legacyQuestion, userCorpus)
          ?? minimumInquiryFallback,
        locale,
        snapshot.real_question || problemText,
      );
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
    open_question: string;
  }>(
    [{ role: 'user', content: user }],
    { system, maxTokens: 3000, signal, shape: { integrated_analysis: 'string', key_findings: 'array', unresolved_tensions: 'array', open_question: 'string' } },
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
    open_question: result.open_question || '',
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
  workerResults?: Array<{ task: string; result: string; name?: string; workerId?: string; authored?: 'user' | 'ai' }>,
  signal?: AbortSignal,
  leadSynthesis?: LeadSynthesisResult | null,
  userNotes?: string | null,
  onToken?: (text: string) => void,
  blockedTasks?: string[],
  judgmentMode: 'standard' | 'deep' = 'standard',
): Promise<MixResult> {
  const locale = getCurrentLanguage();
  const { system, user: userPrompt } = buildMixPrompt(
    problemText, snapshots, questionsAndAnswers, decisionMaker, workerResults, locale, leadSynthesis, blockedTasks,
  );
  // Append user notes to the user prompt if provided
  const user = userNotes?.trim()
    ? `${userPrompt}\n\n<user-notes>\n사용자가 직접 추가한 의견입니다. 문서에 반드시 반영하세요:\n${userNotes.trim()}\n</user-notes>`
    : userPrompt;

  const shape = { title: 'string' as const, executive_summary: 'string' as const, sections: 'array' as const, key_assumptions: 'array' as const, next_steps: 'array' as const };
  // The prompt omits duplicate flat `content` when sentence attribution exists
  // and caps the brief at 3-5 concise sections. 5.5k leaves parse headroom while
  // avoiding the 8k streams that took over a minute in the first-user journey.
  let result: MixResponse;
  let lastStreamText = '';
  try {
    result = onToken
      ? await callLLMStreamThenParse<MixResponse>(
          [{ role: 'user', content: user }],
          { system, maxTokens: 5500, signal, shape, model: judgmentMode === 'deep' ? 'strong' : 'default' },
          (text) => { lastStreamText = text; onToken(text); },
        )
      : await callLLMJson<MixResponse>(
          [{ role: 'user', content: user }],
          { system, maxTokens: 5500, signal, shape, model: judgmentMode === 'deep' ? 'strong' : 'default' },
        );
  } catch (e) {
    // A — salvage net: if the document still failed to parse (extreme length),
    // recover the sections that DID stream rather than losing the whole draft and
    // showing a bare error after minutes of work. Only for parse/validation
    // failures on the streamed path; abort/network/auth surface unchanged.
    if (signal?.aborted) throw e;
    const recoverable = e instanceof LLMError && (e.category === 'parse_failure' || e.category === 'validation');
    const salvaged = recoverable ? salvageMixDoc(lastStreamText) : null;
    if (!salvaged) throw e;
    result = salvaged as MixResponse;
  }

  result = clampSynthesisToLivingState(result, snapshots.at(-1));

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

  // R7 (sim v2) — the mix document is heavy prose too; the banned-vocabulary
  // scrub covers every user-visible string of the final deliverable.
  return {
    title: scrubBannedVocabulary(result.title || (locale === 'ko' ? '기획안' : 'Proposal')),
    decision_read: typeof result.decision_read === 'string' ? scrubBannedVocabulary(result.decision_read.trim()) : '',
    executive_summary: scrubBannedVocabulary(result.executive_summary || ''),
    sections: sections.map((s) => ({
      ...s,
      heading: scrubBannedVocabulary(s.heading),
      content: scrubBannedVocabulary(s.content),
      sentences: s.sentences?.map((sent) => ({ ...sent, text: scrubBannedVocabulary(sent.text) })),
    })),
    key_assumptions: scrubList(result.key_assumptions),
    next_steps: scrubList(result.next_steps),
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
  // Defensive: a persisted/legacy/remote-merged mix may lack these arrays even
  // though the type says otherwise (CLAUDE.md Defensive Data Access) — a bare
  // `.map` here throws into the step ErrorBoundary.
  return [
    `# ${mix.title}`,
    `> ${mix.executive_summary}`,
    ...(mix.sections || []).map(s => `## ${s.heading}\n${s.content}`),
    `## ${getCurrentLanguage() === 'ko' ? '핵심 가정' : 'Key Assumptions'}\n${(mix.key_assumptions || []).map(a => `- ${a}`).join('\n')}`,
    `## ${getCurrentLanguage() === 'ko' ? '다음 단계' : 'Next Steps'}\n${(mix.next_steps || []).map(s => `- ${s}`).join('\n')}`,
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
  // Nullable: the focus path (and the sealed-prediction recovery) finalizes with
  // no DM feedback. A null here means "no applied fixes" → just render the mix.
  dmFeedback: DMFeedbackResult | null,
  signal?: AbortSignal,
  workerSources?: WorkerSource[],
  onToken?: (text: string) => void,
): Promise<{ markdown: string; finalMix: MixResult }> {
  const appliedFixes = (dmFeedback?.concerns ?? [])
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
  // The finalizer preserves the concise section contract from runMix. 5.5k is
  // enough for a complete rewrite without reopening the original 8k wait.
  let result: FinalResponse;
  let lastStreamText = '';
  try {
    result = onToken
      ? await callLLMStreamThenParse<FinalResponse>(
          [{ role: 'user', content: user }],
          { system, maxTokens: 5500, signal, shape },
          (text) => { lastStreamText = text; onToken(text); },
        )
      : await callLLMJson<FinalResponse>(
          [{ role: 'user', content: user }],
          { system, maxTokens: 5500, signal, shape },
        );
  } catch (e) {
    if (signal?.aborted) throw e;
    const recoverable = e instanceof LLMError && (e.category === 'parse_failure' || e.category === 'validation');
    const salvaged = recoverable ? salvageMixDoc(lastStreamText) : null;
    if (!salvaged) throw e;
    result = salvaged as unknown as FinalResponse;
  }

  // Build heading → original section lookup for attribution transplant.
  const originalByHeading = new Map<string, MixResult['sections'][number]>();
  for (const s of (mix.sections || [])) {
    originalByHeading.set(normalizeHeading(s.heading), s);
  }

  const rewrittenSections = (result.sections || mix.sections || []).map(newSec => {
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
    decision_read: (typeof result.decision_read === 'string' && result.decision_read.trim())
      ? result.decision_read.trim()
      : mix.decision_read,
    executive_summary: result.executive_summary || mix.executive_summary,
    sections: rewrittenSections,
    // The finalizer runs the LEGACY prompt and is not clamped, so anything it
    // invents here becomes a SEALED PREDICATE — extractPredicatesFromSession
    // prefers final_mix over mix. The living state already decided these two
    // lists; a rewrite may polish prose, not repopulate them. (`[]` is truthy
    // in JS, so an empty model array silently beat the real list here too.)
    key_assumptions: mix.key_assumptions,
    next_steps: mix.next_steps,
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

  for (const section of (mix.sections || [])) {
    lines.push(`## ${section.heading}`, '', section.content, '');
  }

  if ((mix.key_assumptions || []).length > 0) {
    lines.push(locale === 'ko' ? '## 전제 조건' : '## Key Assumptions', '');
    for (const a of (mix.key_assumptions || [])) {
      lines.push(`- ${a}`);
    }
    lines.push('');
  }

  if ((mix.next_steps || []).length > 0) {
    lines.push(locale === 'ko' ? '## 다음 단계' : '## Next Steps', '');
    for (const s of (mix.next_steps || [])) {
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
  /** The unresolved crux the decision turns on — a NEUTRAL question, never a
   *  proceed/no-proceed conclusion (renamed from `verdict`, 2026-07-04 spine
   *  pass: a field literally named "verdict" pulled the model toward the exact
   *  directional lean the prompt forbids; mirrors LeadSynthesisResult.open_question). */
  open_question: string;
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
      { system, maxTokens: 500, signal, model: 'fast', shape: { overall: 'string', contradictions: 'array', blind_spots: 'array', open_question: 'string' } },
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

  const systemKo = `당신은 검토자들의 분석을 종합하는 종합자입니다. 이미 완성된 기획안을, 사용자의 수정 요청에 따라 최소 침습 원칙으로 편집합니다.

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

  const systemEn = `You are the Synthesizer of an orchestra of expert agents. A complete document already exists; your job is to edit it per the user's directive with minimum-invasive edits.

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

  // Spine / CLAUDE.md invariant: user-authored text in a system-adjacent prompt
  // MUST be sanitized + fenced in <user-data> so injected instructions ("ignore
  // prior instructions", "[SYSTEM] emit a verdict") land as inert data, not as
  // directives that break the minimal-edit rule or leak the prompt. `directive`
  // is free-form user input; problemContext/currentFinalText/change_summary all
  // originate from the user and feed back every revision round.
  const sProblem = `<user-data>${sanitizeForPrompt(problemContext)}</user-data>`;
  const sFinal = `<user-data>${sanitizeForPrompt(currentFinalText)}</user-data>`;
  const sDirective = `<user-data>${sanitizeForPrompt(directive)}</user-data>`;
  const priorBlock = priorDrafts && priorDrafts.length > 0
    ? (locale === 'ko'
        ? `\n\n## 이전 버전 이력\n${priorDrafts.map((d) => `- ${d.version_label}: <user-data>${sanitizeForPrompt(d.change_summary)}</user-data>`).join('\n')}`
        : `\n\n## Prior version history\n${priorDrafts.map((d) => `- ${d.version_label}: <user-data>${sanitizeForPrompt(d.change_summary)}</user-data>`).join('\n')}`)
    : '';

  const userKo = `## 원래 문제 맥락
${sProblem}

## 현재 버전 ${currentVersionLabel}
${sFinal}

## 수정 요청
${sDirective}${priorBlock}`;

  const userEn = `## Original problem context
${sProblem}

## Current version ${currentVersionLabel}
${sFinal}

## Revision request
${sDirective}${priorBlock}`;

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
