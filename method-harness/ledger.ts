// Append-only ledger (v1.0 §6.2). The event array is the only canonical truth;
// everything else is a fold. Overwrite is structurally impossible — there is no
// update API, only append.

import { HarnessViolation, type IsoTime, type LedgerEvent } from './types';

export class Ledger {
  private events: LedgerEvent[] = [];
  private ids = new Set<string>();

  append(event: LedgerEvent): void {
    if (this.ids.has(event.id)) {
      throw new HarnessViolation('DUPLICATE_EVENT_ID', `event id ${event.id} already appended`);
    }
    const last = this.events[this.events.length - 1];
    if (last && event.at < last.at) {
      // Time only moves forward in the canonical record. Late-arriving facts
      // are appended with their observation time in the payload (observedAt),
      // but the append itself is now.
      throw new HarnessViolation('TIME_REGRESSION', `event ${event.id} at ${event.at} precedes last event at ${last.at}`);
    }
    this.ids.add(event.id);
    this.events.push(event);
  }

  all(): readonly LedgerEvent[] {
    return this.events;
  }

  forCase(caseId: string): LedgerEvent[] {
    return this.events.filter((e) => e.caseId === caseId);
  }

  byId(id: string): LedgerEvent | undefined {
    return this.events.find((e) => e.id === id);
  }
}

const normalize = (s: string): string => s.toLowerCase().replace(/\s+/g, ' ').trim();

// Lineage check for recommendation grounding (v1.0 §4.4): does this quoted
// value claim trace to something the user actually said or adopted?
//
// This verifies LINEAGE (the utterance/adoption exists and contains the quote),
// NOT ENTAILMENT (that the recommendation follows from the value). Entailment
// stays with the model — which is exactly why change conditions are mandatory.
export function claimTracesToUser(ledger: Ledger, eventId: string, quotedText: string): { ok: boolean; reason: string } {
  const event = ledger.byId(eventId);
  if (!event) return { ok: false, reason: `ref ${eventId} does not exist in the ledger` };

  if (event.type === 'user_utterance') {
    return normalize(event.text).includes(normalize(quotedText))
      ? { ok: true, reason: 'user_said' }
      : { ok: false, reason: `quote not found in utterance ${eventId}` };
  }
  if (event.type === 'card_adopted' || event.type === 'card_superseded') {
    const card = event.card;
    const haystack = normalize(
      [card.question, card.choiceOrPolicy, ...card.rationale.values, ...card.rationale.materialBeliefs.map((b) => b.belief)].join(' • '),
    );
    return haystack.includes(normalize(quotedText))
      ? { ok: true, reason: 'user_adopted' }
      : { ok: false, reason: `quote not found in adopted card ${eventId}` };
  }
  return { ok: false, reason: `ref ${eventId} is ${event.type}, not a user utterance or adoption` };
}

// Pulled vs pushed (v1.0 §4.4 hierarchy): a recommendation is "pulled" only if
// the ledger holds a user utterance asking for direction. Machine-checkable —
// the model's own `initiative` field is a claim to verify, not a fact.
const PULL_PATTERNS = [/추천/, /권해/, /어떻게\s*하는\s*게\s*좋/, /뭘\s*골라/, /어느\s*쪽/, /\brecommend/i, /what\s+would\s+you\s+(do|choose|pick)/i, /which\s+(one\s+)?should\s+i/i, /your\s+(call|recommendation|take)/i];

export function userPulledRecommendation(ledger: Ledger, caseId: string): boolean {
  return ledger
    .forCase(caseId)
    .some((e) => e.type === 'user_utterance' && PULL_PATTERNS.some((p) => p.test(e.text)));
}

let counter = 0;
export function nextEventId(prefix = 'evt'): string {
  counter += 1;
  return `${prefix}_${counter.toString(36).padStart(6, '0')}`;
}

export function resetEventIds(): void {
  counter = 0;
}

export function isoAfter(base: IsoTime, ms: number): IsoTime {
  return new Date(new Date(base).getTime() + ms).toISOString();
}
