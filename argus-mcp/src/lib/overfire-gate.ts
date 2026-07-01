/**
 * Over-fire gate (blueprint §3.3 — the mirror clause as code).
 *
 * `zero judgment` is wider than "don't judge the user" — it also means don't
 * judge WHETHER to intervene. This gate runs inside argus_open_decision BEFORE
 * any crux question is formed. On a flat / low-stakes / reversible / already-
 * closed decision it returns restraint ("leave as is"), emitting no question
 * and no fork.
 *
 * HONEST LIMIT (M2): the inputs are CLAIMED by the model, not measured. The gate
 * cannot be more right than its inputs — it is a restraint bias, not a
 * correcting oracle. Contradictory inputs are flagged for one re-confirmation,
 * and the inputs are logged so post-hoc evals can measure input accuracy.
 */

export type Stakes = 'trivial' | 'low' | 'moderate' | 'high';
export type Reversibility = 'one_way_door' | 'costly_to_reverse' | 'easily_reversible';

export interface DecisionSignals {
  stakes: Stakes;
  reversibility: Reversibility;
  already_decided?: boolean;
  is_vent?: boolean;
  is_factual?: boolean;
}

export interface GateVerdict {
  fire: boolean;
  reason: string;
  response: 'fire' | 'leave_as_is' | 'reconfirm';
}

export function overfireGate(s: DecisionSignals): GateVerdict {
  // Contradictory signals → ask once before trusting them (M2).
  if (s.reversibility === 'easily_reversible' && s.stakes === 'high') {
    return {
      fire: false,
      reason: 'contradictory_signals',
      response: 'reconfirm',
    };
  }

  if (s.is_vent)        return { fire: false, reason: 'vent', response: 'leave_as_is' };
  if (s.is_factual)     return { fire: false, reason: 'factual', response: 'leave_as_is' };
  if (s.already_decided) return { fire: false, reason: 'already_closed', response: 'leave_as_is' };

  // Reversible + not high stakes → restraint (the cost of being wrong is an undo).
  if (s.reversibility === 'easily_reversible' && s.stakes !== 'high') {
    return { fire: false, reason: 'reversible_low_stakes', response: 'leave_as_is' };
  }

  // Genuinely low/trivial stakes → restraint.
  if (s.stakes === 'trivial' || s.stakes === 'low') {
    return { fire: false, reason: 'low_stakes', response: 'leave_as_is' };
  }

  return { fire: true, reason: 'consequential_open_fork', response: 'fire' };
}
