// Event-sourced case reducer — v1.0 §5 (state model incl. DORMANT), §6
// (adoption gate, append-only lineage, re-derivation inputs).
//
// The reducer is where "plausible" physically cannot masquerade as "adopted":
// a Decision Card exists in CaseState only because a card_adopted event folded.
// Violations THROW (HarnessViolation) — canonical-layer wires break loudly.

import { Ledger } from './ledger';
import {
  type AdoptedDecisionCard,
  type CasePhaseState,
  type CaseState,
  type DecisionCardDraft,
  HarnessViolation,
  type IsoTime,
  type LedgerEvent,
  type RederivationInputs,
} from './types';

const ADOPTED_STATE_TO_CASE: Record<string, CasePhaseState> = {
  decide: 'DECIDED',
  test: 'TESTING',
  research: 'RESEARCHING',
  defer: 'DEFERRED',
  reframe: 'REFRAMED',
  stop: 'STOPPED',
};

export function initialCaseState(caseId: string): CaseState {
  return {
    caseId,
    state: 'OPEN',
    supersededCards: [],
    queuedReturns: [],
    observations: [],
    recordRevealed: false,
    lessons: [],
    linkedCases: [],
  };
}

export function foldCase(ledger: Ledger, caseId: string): CaseState {
  let s = initialCaseState(caseId);
  for (const event of ledger.forCase(caseId)) {
    s = applyEvent(s, event);
  }
  return s;
}

export function applyEvent(prev: CaseState, event: LedgerEvent): CaseState {
  const s: CaseState = { ...prev, observations: [...prev.observations], lessons: [...prev.lessons], queuedReturns: [...prev.queuedReturns], supersededCards: [...prev.supersededCards], linkedCases: [...prev.linkedCases] };

  switch (event.type) {
    case 'user_utterance':
    case 'external_source':
      return s;

    case 'ai_proposal': {
      // Proposals never mutate canonical state (§10.1) — but the constitution's
      // BASELINE clause ("preserve the pre-AI position BEFORE directional
      // help") is mechanical here, not aspirational: no AI proposal may fold
      // before the case's baseline was either captured or honestly declared
      // absent. (Added by the implementation review pass — the rule existed in
      // prose only, which is exactly the silent-wire failure this repo bans.)
      if (s.baseline === undefined) {
        throw new HarnessViolation(
          'PROPOSAL_BEFORE_BASELINE',
          'an AI proposal cannot fold before baseline_captured or baseline_not_captured',
        );
      }
      return s;
    }

    case 'baseline_captured': {
      if (s.baseline && s.baseline !== 'not_captured') {
        // Baseline is a pre-AI snapshot; a second capture would be a rewrite.
        throw new HarnessViolation('BASELINE_REWRITE', 'baseline was already captured; it cannot be re-captured after AI help');
      }
      s.baseline = { lean: event.lean, statedReasons: event.statedReasons };
      return s;
    }
    case 'baseline_not_captured': {
      if (s.baseline && s.baseline !== 'not_captured') {
        throw new HarnessViolation('BASELINE_REWRITE', 'cannot mark baseline absent after it was captured');
      }
      s.baseline = 'not_captured'; // honest absence — §2.2: never reconstructed
      return s;
    }

    case 'card_adopted': {
      if (event.adoption.mode === 'decline') {
        // A declined draft leaves no card. Session value stands; continuity
        // honestly does not (§6.6).
        return s;
      }
      if (s.card) {
        throw new HarnessViolation(
          'OVERWRITE_FORBIDDEN',
          `case already has adopted card ${s.card.cardId}; use card_superseded, the past is not editable`,
        );
      }
      s.card = toAdoptedCard(event.cardId, event.caseId, event.at, event.card, event.adoption);
      s.state = ADOPTED_STATE_TO_CASE[event.card.adoptedState] ?? s.state;
      return s;
    }

    case 'card_superseded': {
      if (!s.card || s.card.cardId !== event.oldCardId) {
        throw new HarnessViolation('SUPERSEDE_TARGET_MISSING', `cannot supersede ${event.oldCardId}: not the current card`);
      }
      if (event.adoption.mode === 'decline') {
        throw new HarnessViolation('SUPERSEDE_WITHOUT_ADOPTION', 'a superseding card must itself be adopted');
      }
      const old = { ...s.card, supersededBy: event.newCardId };
      s.supersededCards.push(old);
      s.card = toAdoptedCard(event.newCardId, event.caseId, event.at, event.card, event.adoption);
      s.state = ADOPTED_STATE_TO_CASE[event.card.adoptedState] ?? s.state;
      return s;
    }

    case 'action_reported': {
      requireCard(s, 'action_reported');
      // ACTING requires a report from reality, not a plan (§5.1).
      s.state = 'ACTING';
      return s;
    }

    case 'return_armed': {
      requireCard(s, 'return_armed');
      if (s.activeReturn) {
        // One active return per case (§7.2); the chain queues the rest.
        s.queuedReturns.push(event.contract);
        return s;
      }
      s.activeReturn = { contract: event.contract, armedAt: event.at };
      s.state = 'AWAITING_SIGNAL';
      return s;
    }

    case 'observation': {
      s.observations.push({ id: event.id, text: event.text, at: event.observedAt });
      if (s.state === 'AWAITING_SIGNAL' || s.state === 'ACTING') s.state = 'RETURNED';
      return s;
    }

    case 'recall_probe_answer': {
      if (s.recordRevealed) {
        // The probe only means something before the reveal (§7.3) — a probe
        // after reveal would launder hindsight as unaided recall.
        throw new HarnessViolation('PROBE_AFTER_REVEAL', 'recall probe must be collected before the record is revealed');
      }
      s.recallProbeAnswer = event.text;
      return s;
    }

    case 'record_revealed': {
      // Observation-first ordering (§7.3): the recorded choice/rationale may
      // only be revealed after at least one observation from reality.
      if (s.observations.length === 0) {
        throw new HarnessViolation('REVEAL_BEFORE_OBSERVATION', 'the record may not be revealed before an observation is collected');
      }
      s.recordRevealed = true;
      return s;
    }

    case 'return_closed': {
      if (!s.activeReturn) {
        throw new HarnessViolation('CLOSE_WITHOUT_ACTIVE_RETURN', 'no active return to close');
      }
      s.activeReturn = undefined;
      // Chain activation (§7.2): closing one return promotes the next link.
      const next = s.queuedReturns.shift();
      if (next) {
        s.activeReturn = { contract: next, armedAt: event.at };
        s.state = 'AWAITING_SIGNAL';
      } else {
        s.state = 'REVIEWED';
      }
      // Reset per-return probe/reveal guards for the next cycle.
      s.recordRevealed = false;
      s.recallProbeAnswer = undefined;
      return s;
    }

    case 'lesson_candidate': {
      s.lessons.push({ id: event.id, text: event.text, scope: event.scope, approved: false });
      return s;
    }
    case 'lesson_approved': {
      const idx = s.lessons.findIndex((l) => l.id === event.candidateId);
      if (idx === -1) {
        throw new HarnessViolation('APPROVE_UNKNOWN_LESSON', `lesson candidate ${event.candidateId} not found`);
      }
      // Replace, don't mutate — the array is copied but its objects were
      // shared with the previous state; in-place mutation would corrupt any
      // held prior snapshot (found by the implementation review pass).
      s.lessons[idx] = { ...s.lessons[idx], approved: true };
      return s;
    }

    case 'case_dormant': {
      if (s.state === 'DORMANT') return s;
      s.stateBeforeDormant = s.state;
      s.state = 'DORMANT'; // honest record, no notification (§5.1)
      return s;
    }
    case 'case_reopened': {
      if (s.state !== 'DORMANT') {
        throw new HarnessViolation('REOPEN_NON_DORMANT', 'only a DORMANT case can be reopened');
      }
      s.state = s.stateBeforeDormant ?? 'OPEN';
      s.stateBeforeDormant = undefined;
      return s;
    }

    case 'case_linked': {
      if (!event.confirmedByUser) {
        // §5.4: Argus proposes, the user confirms. An unconfirmed link folding
        // into state would be silent auto-merge.
        throw new HarnessViolation('UNCONFIRMED_CASE_LINK', 'case links fold only with user confirmation');
      }
      s.linkedCases.push(event.relatesTo);
      return s;
    }
  }
}

function toAdoptedCard(
  cardId: string,
  caseId: string,
  at: IsoTime,
  card: DecisionCardDraft,
  adoption: Extract<AdoptedDecisionCard['adoption'], { mode: 'accept' | 'edit_then_accept' }>,
): AdoptedDecisionCard {
  const cloned = JSON.parse(JSON.stringify(card)) as DecisionCardDraft;
  return { ...cloned, cardId, caseId, adoptedAt: at, adoption };
}

function requireCard(s: CaseState, what: string): void {
  if (!s.card) {
    throw new HarnessViolation('CANONICAL_WRITE_WITHOUT_ADOPTION', `${what} requires an adopted card — nothing is canonical before adoption`);
  }
}

// ---------------------------------------------------------------------------
// Re-derivation (v1.0 §6.1): the only inputs a new session's working model may
// be rebuilt from. The return type cannot carry prior model output — check 14
// is enforced by construction, not by review.
// ---------------------------------------------------------------------------

export function rebuildWorkingModelInputs(ledger: Ledger, caseId: string): RederivationInputs {
  const state = foldCase(ledger, caseId);
  const sourceEvents = ledger
    .forCase(caseId)
    .filter(
      (e): e is Extract<LedgerEvent, { type: 'user_utterance' | 'external_source' | 'observation' | 'baseline_captured' }> =>
        e.type === 'user_utterance' || e.type === 'external_source' || e.type === 'observation' || e.type === 'baseline_captured',
    );
  return {
    card: state.card,
    sourceEvents,
    approvedLessons: state.lessons.filter((l) => l.approved).map(({ id, text, scope }) => ({ id, text, scope })),
  };
}

// DORMANT transition rule (v1.0 §5.1): date backstop elapsed + grace period of
// silence. Pure function of injected time — the caller decides when to append
// the case_dormant event this recommends.
export const DORMANT_GRACE_MS = 14 * 24 * 60 * 60 * 1000; // 2 weeks default

export function shouldGoDormant(state: CaseState, lastUserActivityAt: IsoTime, now: IsoTime): boolean {
  if (state.state === 'DORMANT' || state.state === 'REVIEWED') return false;
  const active = state.activeReturn;
  if (!active) return false;
  const t = active.contract.trigger;
  const backstop = t.type === 'date' ? t.date : t.type === 'manual' ? undefined : t.dateBackstop;
  if (!backstop) return false;
  const nowMs = new Date(now).getTime();
  return nowMs > new Date(backstop).getTime() && nowMs - new Date(lastUserActivityAt).getTime() > DORMANT_GRACE_MS;
}
