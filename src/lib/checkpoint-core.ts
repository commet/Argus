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
  return predicates.find((p) => p.source === 'governing_idea') ?? predicates[0];
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
): PrimaryCheckpoint | null {
  const top = pickPrimaryPredicate(contract.predicates || []);
  if (!top) return null;

  const handle: ReturnHandle = seed?.return_handle
    ?? (contract.check_in_at
      ? { kind: 'date', value: contract.check_in_at, auto_due: true }
      : { kind: 'manual', value: '', auto_due: false });

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
    authorship: seed?.authorship ?? 'ai_suggested',
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
