/**
 * Typed Question System — Q 설계의 핵심
 *
 * 문제: 기존 엔진은 모든 질문을 "generic follow-up"으로 생성해서 사용자는
 * 왜 이걸 물어보는지 모른 채 답하고, 답해도 구조적 효과가 없었음.
 *
 * 해법: 질문에 *타입*을 부여한다. 타입별로 프롬프트 + 효과 schema가 다르다.
 * LLM은 타입 안에서 *내용만* 생성한다. 타입 선택은 엔진 state machine이 한다.
 *
 * - strategic_fork: 방향을 결정한다. 답 → decisionLine + 팀 재구성
 * - weakness_check: 약점을 찌른다. 답 → weakestAssumption + nextThreeDays
 * - frame_clarify : 모호함을 해소한다. framing_confidence<70일 때만.
 * - free_follow_up: 기본 sequence 후 사용자가 명시적으로 더 묻기를 원할 때.
 */

import type { AnalysisSnapshot, FlowQuestion } from '@/stores/types';
import { FRAME_CLARIFY_CONFIDENCE_GATE } from '@/lib/question-rules';

// ─── Type tags ───

export type QuestionTypeTag =
  | 'frame_clarify'
  | 'strategic_fork'
  | 'weakness_check'
  | 'free_follow_up';

// ─── Per-type effect schemas ───

/**
 * strategic_fork — 전략 갈림길. 각 옵션은 "상사가 사인할 수 있는 1줄 결정"이다.
 * 답이 선택되면 snapshot이 그 결정을 향해 맞춰진다.
 */
export interface StrategicForkEffect {
  /** 상사가 사인할 수 있는 1줄 결정문. 카테고리 금지. */
  decisionLine: string;
  /** 이 방향이 타당한 한 줄 근거 */
  rationale?: string;
  /** 이 방향에 합류하면 좋을 역할 키워드 (예: "숫자", "리스크", "실행") */
  addsWorkerRole?: string;
  /** 이 방향을 가장 잘 맞을 DM 원형 (예: "ceo", "executive", "investor") */
  dmKey?: string;
  /** 선택 시 snapshot에 덮어쓸 필드들 */
  snapshotPatch?: SnapshotPatch;
}

/**
 * weakness_check — 약점 검증. 각 옵션은 다른 검증 경로다.
 * 답이 선택되면 가장 위험한 가정 + 다음 3일 계획이 결정된다.
 */
export interface WeaknessCheckEffect {
  weakestAssumption: { assumption: string; explanation: string };
  nextThreeDays: string[];
  /** DM이 이 경로를 보고 첫 마디로 뭐라 할지 — Phase 3에서 DM 프롬프트에 주입 */
  dmFirstReaction?: string;
  snapshotPatch?: SnapshotPatch;
}

/**
 * frame_clarify — 모호함 해소. 답은 real_question을 재정의한다.
 * (DESIGN-clarify-question-system-v2 §4.3)
 */
export interface FrameClarifyEffect {
  /** 선택된 frame 문장 — 다음 질문 프롬프트 컨텍스트로 소비된다. 필수(판별자). */
  chosenFrame: string;
  /** 이 답을 받으면 framing_confidence가 올라간다 (보통 +20~30, 엔진이 clamp) */
  framingBoost?: number;
  snapshotPatch?: SnapshotPatch;
}

export type SnapshotPatch = Partial<{
  real_question: string;
  hidden_assumptions: string[];
  skeleton: string[];
  insight: string;
}>;

export type QuestionEffect =
  | StrategicForkEffect
  | WeaknessCheckEffect
  | FrameClarifyEffect;

// ─── Typed question shape ───

export interface TypedQuestionOption {
  label: string;
  effect: QuestionEffect;
}

/**
 * FlowQuestion에 얹히는 메타 — 기존 UI는 `options: string[]`만 보고 렌더하고,
 * 답이 들어오면 ProgressiveFlow가 여기서 효과를 꺼내 snapshot에 적용한다.
 * 영구 저장되므로 JSON-safe 필드만 담는다.
 */
export interface TypedQuestionMeta {
  tag: QuestionTypeTag;
  options: TypedQuestionOption[];
}

// ─── State machine ───

export interface QuestionStateContext {
  round: number;
  framingConfidence: number;
  askedTypes: QuestionTypeTag[];
  workerOutputsReady: boolean;
  /** 사용자가 기본 sequence 이후 "한 번 더 물어봐"를 눌렀을 때 */
  userRequestedMore?: boolean;
  /** snapshot.request_type — the structural fire-gate (§4.7). A confirmed
   *  non-'open' request routes to NO typed question (defense in depth over the
   *  route contract). Undefined is treated permissively (older models omit it),
   *  matching the validator's R5, so typed questions don't vanish silently. */
  requestType?: string;
  /** Whether STEP-0 actually reported framing_confidence (§4.3b). When false,
   *  the caller passes FRAMING_CONFIDENCE_ROUTING_FALLBACK as framingConfidence
   *  so "signal absent" fires frame_clarify instead of reading as confident. */
  framingConfidenceReported?: boolean;
  /** Deterministic fatigue read (§7). When true, the router stops asking the
   *  remaining OPTIONAL questions — a tired user isn't spent on a weakness_check.
   *  An explicit "한 번 더"(userRequestedMore) still overrides it. */
  fatigueDetected?: boolean;
}

/**
 * 다음 질문의 타입을 결정한다. null이면 기본 sequence가 끝났다는 뜻 —
 * 엔진은 mix로 넘어가거나 사용자에게 분기 UX를 보여줘야 한다.
 *
 * 순서:
 *   1. framing_confidence < 70 + 안 물었음 → frame_clarify
 *   2. strategic_fork 안 물었음 → strategic_fork
 *   3. 워커 output 나왔고 weakness_check 안 물었음 → weakness_check
 *   4. 그 외 → null (기본 sequence 종료)
 *   5. 사용자가 더 물어봐달라 요청 → free_follow_up
 */
export function pickNextQuestionType(
  ctx: QuestionStateContext,
): QuestionTypeTag | null {
  // Structural fire-gate (§4.7): a confirmed non-open request routes to no typed
  // question. This is defense in depth over the route contract (R32) — the gate
  // lives in the code signature, not a prompt. Undefined request_type is treated
  // permissively (see QuestionStateContext.requestType).
  if (ctx.requestType && ctx.requestType !== 'open') return null;

  // Explicit "한 번 더" overrides everything — the user asked for it.
  if (ctx.userRequestedMore) return 'free_follow_up';

  // Fatigue (§7): stop spending the remaining optional questions on a tired user.
  // Only meaningfully true after ≥2 answers (or an explicit stop cue), so the
  // essential early questions are never skipped by accident.
  if (ctx.fatigueDetected) return null;

  const asked = new Set(ctx.askedTypes);

  if (ctx.framingConfidence < FRAME_CLARIFY_CONFIDENCE_GATE && !asked.has('frame_clarify')) {
    return 'frame_clarify';
  }
  if (!asked.has('strategic_fork')) {
    return 'strategic_fork';
  }
  if (ctx.workerOutputsReady && !asked.has('weakness_check')) {
    return 'weakness_check';
  }
  return null;
}

// ─── Effect application ───

/**
 * snapshot_patch를 snapshot에 덮어쓴다. patch가 비어있는 필드는 그대로 둔다.
 */
export function applySnapshotPatch(
  snapshot: AnalysisSnapshot,
  patch: SnapshotPatch | undefined,
): AnalysisSnapshot {
  if (!patch) return snapshot;
  return {
    ...snapshot,
    real_question: patch.real_question ?? snapshot.real_question,
    // PREMISES AND PLAN ARE NOT PATCHABLE FROM A TAP.
    //
    // A typed question's options carry a `snapshotPatch` the model wrote in
    // advance — including 2–3 hidden_assumptions and a 5-step skeleton. Applying
    // those wrote model-invented premises straight into the living state with no
    // anchor, no counterfactual, and no trip through the premise contract: one
    // tap and Argus "knew" things the user never said. The contract is the only
    // door (judgment-state-contract.ts), and the conversation writes no plan.
    //
    // What a tap legitimately updates is the FRAMING — the question being asked
    // and the line describing it.
    hidden_assumptions: snapshot.hidden_assumptions,
    skeleton: snapshot.skeleton,
    insight: patch.insight ?? snapshot.insight,
  };
}

/**
 * Consume a frame_clarify answer (§4.3 consumption contract): apply its
 * snapshotPatch (the reframed real_question etc.) AND raise framing_confidence
 * by framingBoost — a signal that came from the user's own choice, so it's
 * trusted (unlike an LLM self-report). chosenFrame is recorded as the framing
 * override reason so the next question's prompt can carry it. Clamped [0,100].
 */
export function applyFrameClarifyEffect(
  snapshot: AnalysisSnapshot,
  effect: FrameClarifyEffect,
): AnalysisSnapshot {
  const patched = applySnapshotPatch(snapshot, effect.snapshotPatch);
  const boost = typeof effect.framingBoost === 'number' ? effect.framingBoost : 20;
  const raised = Math.min(100, Math.max(0, (patched.framing_confidence ?? 50) + boost));
  return {
    ...patched,
    framing_confidence: raised,
    framing_override_reason: effect.chosenFrame || patched.framing_override_reason,
  };
}

/**
 * FlowQuestion에서 사용자가 선택한 label에 매칭되는 effect를 꺼낸다.
 * 옵션 텍스트가 정확히 일치하지 않으면 (trim 후에도) null.
 */
export function findEffectForAnswer(
  question: FlowQuestion,
  answerValue: string,
): QuestionEffect | null {
  const meta = (question as FlowQuestion & { typed?: TypedQuestionMeta }).typed;
  if (!meta) return null;
  const normalized = answerValue.trim();
  const match = meta.options.find(o => o.label.trim() === normalized);
  return match?.effect ?? null;
}

// ─── Compatibility bridge ───

/**
 * TypedQuestion을 기존 FlowQuestion에 입힌다. UI는 options: string[]만 보므로
 * 기존 QuestionCard가 수정 없이 그대로 동작한다.
 */
export function buildFlowQuestion(
  id: string,
  tag: QuestionTypeTag,
  text: string,
  subtext: string | undefined,
  options: TypedQuestionOption[],
  enginePhase: 'reframe' | 'recast',
): FlowQuestion {
  const q: FlowQuestion & { typed?: TypedQuestionMeta } = {
    id,
    text,
    subtext,
    options: options.map(o => o.label),
    type: 'select',
    engine_phase: enginePhase,
    typed: { tag, options },
  };
  return q;
}
