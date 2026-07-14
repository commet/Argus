/**
 * The non-negotiable semantic invariants (handoff §"Non-negotiable semantic
 * invariants"), checked against the ADMITTED stream after every mutating step.
 * A failure here is a product defect, not a scenario authoring problem — the
 * gateway/kernel admitted something the constitution forbids, or mutated what
 * it must preserve.
 */
import { fold as foldUntyped, foldAsOf, projectJudgment, type SemanticState } from '../../../src/lib/decision-kernel';

// The façade's runtime export comes from the compiled kernel (js), so pin the
// erased source type exactly as the production adapters do.
const fold = foldUntyped as (events: readonly unknown[]) => SemanticState;
type Fold = SemanticState;

export interface InvariantFailure {
  id: string;
  detail: string;
}

const AUTHORIAL = new Set([
  'judgment_sealed', 'premise_adopted', 'premise_retired', 'return_promised',
  'return_deferred', 'return_contract_superseded', 'resolution_asserted',
  'judgment_closed', 'judgment_withdrawn', 'judgment_superseded', 'judgment_erased',
]);

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`);
    return `{${entries.join(',')}}`;
  }
  return JSON.stringify(value);
}

function projectionsSignature(state: Fold, now: string): string {
  const parts: string[] = [];
  for (const id of [...state.judgments.keys()].sort()) {
    parts.push(stableStringify(projectJudgment(state, id, now)));
  }
  return parts.join('|');
}

/**
 * Check the full stream. `previousSnapshot` is the stable-stringified admitted
 * stream before this step (append-only witness).
 */
export function checkStreamInvariants(args: {
  events: readonly unknown[];
  previousSnapshot: readonly string[];
  currentSnapshot: readonly string[];
  now: string;
}): InvariantFailure[] {
  const failures: InvariantFailure[] = [];
  const { events, previousSnapshot, currentSnapshot, now } = args;

  // I2 — append-only: the prior admitted stream must be a byte-stable prefix.
  if (currentSnapshot.length < previousSnapshot.length) {
    failures.push({ id: 'I2_APPEND_ONLY', detail: `stream shrank ${previousSnapshot.length}→${currentSnapshot.length}` });
  } else {
    for (const [index, prior] of previousSnapshot.entries()) {
      if (currentSnapshot[index] !== prior) {
        failures.push({ id: 'I2_APPEND_ONLY', detail: `admitted event at index ${index} was rewritten` });
        break;
      }
    }
  }

  const state = fold(events);

  // I1 — anomalies that may NEVER exist in an admitted stream. Note the split:
  // ILLEGAL_TRANSITION / UNKNOWN_REFERENCE anomalies are the reducer's
  // sanctioned way of PRESERVING a genuinely-concurrent contradictory act as a
  // visible conflict (invariant 8 of the handoff), so they are reported as
  // conflict markers, not failures — scenarios assert whether a race happened.
  // INVALID_EVENT / MISSING_AUTHORITY / idempotency anomalies have no legal
  // path into an admitted stream under any interleaving.
  const CRITICAL = new Set(['INVALID_EVENT', 'MISSING_AUTHORITY', 'DUPLICATE_IDEMPOTENCY', 'IDEMPOTENCY_CONFLICT']);
  for (const anomaly of state.anomalies) {
    if (CRITICAL.has(anomaly.code)) {
      failures.push({ id: 'I1_ADMITTED_ANOMALY', detail: `${anomaly.code} on ${anomaly.event_id}: ${anomaly.detail}` });
    }
  }

  // I9 — every admitted authorial event carries recorded human authorization.
  for (const raw of events) {
    const event = raw as { event?: string; event_id?: string; authority?: { authorized_by?: { kind?: string }; authorization_mode?: string; authorization_ref?: unknown } };
    if (!event.event || !AUTHORIAL.has(event.event)) continue;
    const authority = event.authority;
    if (authority?.authorized_by?.kind !== 'human' || !authority.authorization_mode || !authority.authorization_ref) {
      failures.push({ id: 'I9_AUTHORITY', detail: `${event.event} ${event.event_id ?? '?'} admitted without human authorization` });
    }
  }

  // I3 — resolution never closes; close requires the matching resolution.
  for (const judgment of state.judgments.values()) {
    if (judgment.closed && !judgment.resolution) {
      failures.push({ id: 'I3_CLOSE_WITHOUT_RESOLUTION', detail: `judgment ${judgment.id} is closed with no resolution` });
    }
  }

  // I8 — replay determinism: JSON round-trip then refold → identical projections.
  const replayed = fold(JSON.parse(JSON.stringify(events)) as unknown[]);
  if (projectionsSignature(state, now) !== projectionsSignature(replayed, now)) {
    failures.push({ id: 'I8_REPLAY_DETERMINISM', detail: 'projections differ after JSON round-trip refold' });
  }

  // I10 — hindsight boundary: as-of an earlier recorded_at, later events are
  // invisible (foldAsOf must never leak the future into the past).
  const recordedAts = events
    .map((raw) => (raw as { time?: { recorded_at?: string } }).time?.recorded_at)
    .filter((value): value is string => typeof value === 'string')
    .sort();
  if (recordedAts.length > 1) {
    const cut = recordedAts[Math.floor(recordedAts.length / 2) - 1]!;
    const past = foldAsOf(events, cut);
    const leaked = [...past.idempotency.keys()].length;
    const expected = events.filter((raw) => {
      const at = (raw as { time?: { recorded_at?: string } }).time?.recorded_at;
      return typeof at === 'string' && at <= cut;
    }).length;
    if (leaked > expected) {
      failures.push({ id: 'I10_HINDSIGHT', detail: `as-of ${cut} folded ${leaked} events; only ${expected} were recorded by then` });
    }
  }

  return failures;
}

/** Sanctioned conflict markers (preserved contradictory acts) in the stream. */
export function conflictMarkers(events: readonly unknown[]): string[] {
  return fold(events).anomalies
    .filter((a) => a.code === 'ILLEGAL_TRANSITION' || a.code === 'UNKNOWN_REFERENCE')
    .map((a) => `${a.code}:${a.event_id}`);
}

/**
 * I7 — cross-surface projection equality: the same admitted history must
 * project identically regardless of which surface reads it. Surfaces all call
 * the same kernel, so this guards accidental divergence via serialization.
 */
export function checkCrossSurfaceProjection(events: readonly unknown[], judgmentId: string, now: string): InvariantFailure[] {
  const direct = projectJudgment(fold(events), judgmentId, now);
  const reserialized = projectJudgment(fold(JSON.parse(JSON.stringify(events)) as unknown[]), judgmentId, now);
  if (stableStringify(direct) !== stableStringify(reserialized)) {
    return [{ id: 'I7_CROSS_SURFACE', detail: `projection of ${judgmentId} differs across read paths` }];
  }
  return [];
}
