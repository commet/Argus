/**
 * orchestration-pattern.ts — "일이 협업 구조를 부른다"
 *
 * The classifier tells us WHAT kind of decision and HOW heavy it is; this module
 * turns that into HOW the lenses should collaborate (the pattern) and HOW hard to
 * verify it. LLM 호출 없음, 결정론적 — 같은 입력 → 같은 계획.
 *
 * Inspired by the agent-team "pattern catalog" idea (Pipeline / Fan-out / Producer-
 * Reviewer / Supervisor ...) but adapted to Argus's job: a *decision* tool, not a
 * code-team factory. Two Argus-specific choices:
 *   1) Verification is a CONSTANT, not a critical-only stage — it is the product's
 *      identity ("surface the reader's blind side"). stakes only scales its DEPTH.
 *   2) The user's pre-AI lean (from Bind) feeds verify depth: leaning on an
 *      important call = confirmation-bias risk → review harder, even if not critical.
 *
 * Spine guard (CLAUDE.md): a *light* verify must be a single neutral crux question,
 * never a disclaimed verdict — so a flat decision never gets a manufactured fork.
 */

import type { InputClassification } from './orchestrator-classify';

/**
 * Collaboration shape for a run.
 * - single:      one lens does the work, then a light check (cheapest path — keeps
 *                trivial questions trivial, easing the activation cliff)
 * - parallel:    independent lenses at once → synthesize → verify (the default)
 * - review_loop: parallel → adversarial review with retry (heavy/irreversible)
 *
 * (A 'sequential'/pipeline shape is intentionally deferred until step dependencies
 *  are wired — see DESIGN doc. It is rare for decisions and needs a depends-on graph.)
 */
export type CollaborationPattern = 'single' | 'parallel' | 'review_loop';

/** How hard the always-on verification pass pushes. */
export type VerifyDepth = 'light' | 'standard' | 'deep';

export interface OrchestrationPlan {
  pattern: CollaborationPattern;
  verifyDepth: VerifyDepth;
  /** Human-readable why, for traces / debugging (never shown as a verdict). */
  reason: string;
}

export interface OrchestrationSignals {
  /** The user already leans one way (a Bind rope exists) — confirmation-bias risk. */
  userLeaning?: boolean;
}

/**
 * Decide the collaboration pattern + verification depth for a run.
 *
 * @param classification  output of classifyInput (stakes / decisionType / ...)
 * @param workerCount     how many AI lenses the plan assigned
 * @param signals         Argus-specific signals (e.g. the user's pre-AI lean)
 */
export function planOrchestration(
  classification: InputClassification,
  workerCount: number,
  signals?: OrchestrationSignals,
): OrchestrationPlan {
  const { stakes, decisionType } = classification;
  const onFire = decisionType === 'on_fire';
  const leaning = !!signals?.userLeaning;

  // ── Verify depth — ALWAYS on; stakes only scales it ──
  // deep:  irreversible (critical), a crisis (on_fire), or leaning on an important
  //        call (confirmation bias — push back harder).
  // light: genuinely small (routine + few lenses) → one neutral crux question only.
  // standard: everything else.
  let verifyDepth: VerifyDepth;
  if (stakes === 'critical' || onFire || (leaning && stakes === 'important')) {
    verifyDepth = 'deep';
  } else if (stakes === 'routine' && workerCount <= 2) {
    verifyDepth = 'light';
  } else {
    verifyDepth = 'standard';
  }

  // ── Pattern ──
  let pattern: CollaborationPattern;
  let reason: string;
  if (workerCount <= 1) {
    pattern = 'single';
    reason = 'one lens — do the work, then a light blind-side check';
  } else if (verifyDepth === 'deep') {
    pattern = 'review_loop';
    reason = onFire
      ? 'crisis — generate, then adversarially review before settling'
      : stakes === 'critical'
        ? 'irreversible — generate, then adversarially review before settling'
        : 'leaning on an important call — review the conclusion against the lean';
  } else {
    pattern = 'parallel';
    reason = 'independent lenses in parallel → synthesize → verify';
  }

  return { pattern, verifyDepth, reason };
}
