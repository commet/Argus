/**
 * Judgment Checkpoint core — the DETERMINISTIC brain of the seal→settle loop
 * (DESIGN-judgment-checkpoints-v2). Pure, `now`/dates injected, no LLM, no fs.
 *
 * A "판단 체크포인트" is a skin over DecisionContract (types live in stores/types).
 * This module is the logic the doc insists must be deterministic, not modelled:
 *  - verdictFromTap / tapFromVerdict — the 4-tap ⇄ verdict mapping, made
 *    deterministic by the checkpoint's `expectation` (§7.2). The event-layer
 *    enum has no home for "my read was wrong", so the new 'missed' literal does.
 *  - chooseCheckpointType — routes on clarify-v2's actual outputs (§4.6).
 *  - deriveExpectation / derivePrimaryCheckpoint — seal-time construction (§3.1,
 *    §12 Phase 0): a checkpoint seed if present, else the top predicate + a date
 *    handle (existing behavior preserved).
 *  - nextAmbiguityHandle — an unclear is never a dead end; the next handle's
 *    cadence reuses premises-core's reponder math, never a model invention (§7.3).
 */

import type {
  PredicateVerdict,
  PredicateSource,
  ReturnHandle,
  PrimaryCheckpoint,
  DecisionContract,
} from '@/stores/types';
import { addDays, DEFAULT_REPONDER_CADENCE_DAYS } from './premises-core';

export type CheckpointType = PrimaryCheckpoint['type'];
export type CheckpointExpectation = PrimaryCheckpoint['expectation'];
export type ReturnHandleKind = ReturnHandle['kind'];

/** The four taps of the 30-second return screen (§7.1). */
export type ReturnTap = 'mostly_right' | 'missed' | 'mixed' | 'unclear';

/**
 * §7.2 — the 4-tap → stored verdict mapping, made deterministic by the
 * checkpoint's expectation. "대체로 맞았다" means the event went the way the
 * checkpoint expected (occur→happened, not_occur→avoided); "빗나갔다" is a
 * judgment-layer miss regardless of direction; mixed/unclear are uniform. Pure.
 */
export function verdictFromTap(tap: ReturnTap, expectation: CheckpointExpectation): PredicateVerdict {
  switch (tap) {
    case 'mostly_right': return expectation === 'occur' ? 'happened' : 'avoided';
    case 'missed': return 'missed';
    case 'mixed': return 'partial';
    case 'unclear': return 'unknown';
  }
}

/**
 * The reverse (§7.2) — recover the tap label from a stored verdict, so existing
 * data displays in the 4-tap frame. `expectation` disambiguates
 * happened/avoided. Returns null for 'pending' (not yet answered). A verdict
 * that contradicts the expectation (e.g. happened when we expected not_occur)
 * reads as 'missed' — the outcome went against the read. Round-trips with
 * verdictFromTap for the four taps (test-pinned).
 */
export function tapFromVerdict(verdict: PredicateVerdict, expectation: CheckpointExpectation): ReturnTap | null {
  switch (verdict) {
    case 'happened': return expectation === 'occur' ? 'mostly_right' : 'missed';
    case 'avoided': return expectation === 'not_occur' ? 'mostly_right' : 'missed';
    case 'missed': return 'missed';
    case 'partial': return 'mixed';
    case 'unknown': return 'unclear';
    case 'pending': return null;
  }
}

/**
 * §4.6 — deterministic checkpoint-type routing on clarify-v2's real signals.
 * Order matters: a date/metric handle is an outcome; a reaction risk is a
 * reaction; a linked premise is evidence; an explicit threshold is standard;
 * the FALLBACK is drift (forcing outcome would manufacture fake precision).
 */
export function chooseCheckpointType(ctx: {
  returnHandleKind: ReturnHandleKind;
  hasLinkedPremise: boolean;
  hasExplicitThresholdOrCondition: boolean;
  primaryRiskIsReaction: boolean;
}): CheckpointType {
  if (ctx.returnHandleKind === 'date' || ctx.returnHandleKind === 'metric') return 'outcome';
  if (ctx.primaryRiskIsReaction) return 'reaction';
  if (ctx.hasLinkedPremise) return 'evidence';
  if (ctx.hasExplicitThresholdOrCondition) return 'standard';
  return 'drift';
}

/**
 * §3.1 — the checkpoint's expected direction, filled deterministically at seal.
 * A governing bet is expected to hold ('occur'). A risk predicate phrased as
 * something to AVOID ("피하면"/avoid/steer clear) is 'not_occur'; otherwise the
 * risk is checked for whether it materialized ('occur'). Judgment-undecidable →
 * 'occur' default (never a manufactured direction).
 */
export function deriveExpectation(source: PredicateSource, checkPrompt: string): CheckpointExpectation {
  if (source === 'risk') {
    const t = (checkPrompt || '').toLowerCase();
    // Korean stems conjugate (피하다→피한다, 막다→막는다), so match the stem +
    // common endings rather than a bare literal.
    if (/피[하한할해]|회피|막(아|는|을)|방지|예방|avoid|prevent|steer\s*clear|안\s*(일어|생기|터)/.test(t)) {
      return 'not_occur';
    }
  }
  return 'occur';
}

/** Pick the decision's representative predicate: the governing bet if present,
 *  else the first. */
export function pickPrimaryPredicate<T extends { source: PredicateSource }>(predicates: T[]): T | undefined {
  if (!predicates || predicates.length === 0) return undefined;
  const attributed = predicates as Array<T & {
    authored?: 'user' | 'ai_surfaced';
    attribution?: { authority?: string };
  }>;
  // A return question must prefer a judgment the user actually owns. The old
  // governing-first order routinely selected an AI-surfaced premise and the UI
  // then called it "the call you made".
  return attributed.find((p) =>
    p.source === 'user_lean'
    && p.authored !== 'ai_surfaced'
    && p.attribution?.authority !== 'ai_suggested')
    ?? attributed.find((p) =>
      p.source === 'governing_idea'
      && p.authored !== 'ai_surfaced'
      && p.attribution?.authority !== 'ai_suggested')
    ?? attributed.find((p) => p.source === 'user_lean')
    ?? attributed.find((p) => p.source === 'governing_idea')
    ?? attributed[0];
}

/**
 * §12 Phase 0 step 3 — designate the primary checkpoint at seal. If a
 * checkpoint seed was carried, the caller passes it as `seed` (its authorship
 * wins). Otherwise auto-construct from the top predicate + a date handle,
 * preserving the existing seal behavior. Returns null when there is nothing to
 * point at (a contract with no predicates). Pure.
 */
export function derivePrimaryCheckpoint(
  contract: Pick<DecisionContract, 'predicates' | 'check_in_at'>,
  seed?: Partial<PrimaryCheckpoint> & { predicate_id?: string },
  today?: string,
): PrimaryCheckpoint | null {
  const top = pickPrimaryPredicate(contract.predicates || []);
  if (!top) return null;

  let handle: ReturnHandle = seed?.return_handle
    ?? (contract.check_in_at
      ? { kind: 'date', value: contract.check_in_at, auto_due: true }
      : { kind: 'manual', value: '', auto_due: false });
  // §9.2 — a non-date handle is born with a silence cap so it can never sleep
  // forever. A date handle is untouched (it fires on its own).
  if (today) handle = armCheckpointSilence(handle, today);

  const linked = seed?.linked_premise_ids ?? [];
  const type = seed?.type ?? chooseCheckpointType({
    returnHandleKind: handle.kind,
    hasLinkedPremise: linked.length > 0,
    hasExplicitThresholdOrCondition: false,
    primaryRiskIsReaction: top.source === 'risk' && !!(top as { persona_id?: string }).persona_id,
  });

  return {
    predicate_id: seed?.predicate_id ?? top.id,
    check_prompt: seed?.check_prompt ?? top.text,
    expected_signal: seed?.expected_signal,
    negative_signal: seed?.negative_signal,
    return_handle: handle,
    linked_premise_ids: linked,
    authorship: seed?.authorship
      ?? ((top as { authored?: string; attribution?: { authority?: string } }).authored === 'user'
        || ['user_asserted', 'user_adopted'].includes(
          (top as { attribution?: { authority?: string } }).attribution?.authority ?? '',
        )
        ? 'user_authored'
        : 'ai_suggested'),
    type,
    expectation: seed?.expectation ?? deriveExpectation(top.source, seed?.check_prompt ?? top.text),
  };
}

/**
 * §7.3 — an unclear is not a dead end: propose the next (lighter) handle. The
 * cadence reuses premises-core's reponder default (never a model invention); a
 * prior date handle is extended from itself, otherwise from `today`. Pure.
 */
export function nextAmbiguityHandle(prev: ReturnHandle | undefined, today: string): ReturnHandle {
  const base = prev?.kind === 'date' && prev.value ? prev.value.slice(0, 10) : today;
  return { kind: 'date', value: addDays(base, DEFAULT_REPONDER_CADENCE_DAYS), auto_due: true };
}

/** Read a legacy contract's expectation defensively — absent → 'occur' (§7.2). */
export function checkpointExpectation(c: Pick<DecisionContract, 'primary_checkpoint'>): CheckpointExpectation {
  return c.primary_checkpoint?.expectation ?? 'occur';
}

// ── due-ness for the return handle (§9.2 — "never due" is impossible) ────────

/** Default silence cap for a non-date handle: past this, a soft nudge replaces
 *  the (impossible) auto-due so it can't sleep forever (§9.2). */
export const CHECKPOINT_SILENCE_CAP_DAYS = 30;

function dateOnly(s?: string): string | undefined {
  return s && s.length >= 10 ? s.slice(0, 10) : undefined;
}

/**
 * Is this checkpoint due as of `today` (YYYY-MM-DD)? §9.2:
 *  - a `date` auto_due handle is due when its date has arrived (the existing
 *    check-in path already surfaces these);
 *  - a NON-date handle can't auto-fire, so it becomes due only once its silence
 *    cap is reached — a soft nudge, never a hard "settle now". An un-armed
 *    non-date handle (no silence_until) is never due until armed, so it never
 *    nags before its time. Pure.
 */
export function isCheckpointDue(cp: Pick<PrimaryCheckpoint, 'return_handle'>, today: string): boolean {
  const t = dateOnly(today);
  if (!t) return false;
  const h = cp.return_handle;
  if (h.kind === 'date' && h.auto_due) {
    const d = dateOnly(h.value);
    return !!d && d <= t;
  }
  const cap = dateOnly(h.silence_until);
  return !!cap && cap <= t;
}

/**
 * Arm the silence cap on a non-date handle so "never due" is structurally
 * impossible (§9.2): sets silence_until = today + days. A `date` auto_due handle
 * (it fires on its own) and an already-armed handle are returned unchanged. Pure.
 */
export function armCheckpointSilence(
  handle: ReturnHandle,
  today: string,
  days: number = CHECKPOINT_SILENCE_CAP_DAYS,
): ReturnHandle {
  if (handle.kind === 'date' && handle.auto_due) return handle;
  if (handle.silence_until) return handle;
  const base = dateOnly(today);
  if (!base) return handle;
  return { ...handle, silence_until: addDays(base, days) };
}
