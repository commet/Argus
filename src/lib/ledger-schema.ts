/**
 * Ledger schema convention — the unified decision object (W1.2).
 *
 * ONE loop, THREE doors (web deep session · helm plan-approval · plugin scan
 * harvest) — and the only thing they share, by founder decision, is THIS
 * SCHEMA. No shared tables, no sync plumbing until H5 (one person actually
 * uses two doors) is proven. Each surface keeps its own storage:
 *
 *   web    projects.decision_contract jsonb  (DecisionContract, stores/types.ts)
 *   plugin .argus/ledger/ledger.jsonl        (/argus:scan, /argus:seal, /argus:settle)
 *   helm   .argus/ledger/ (reuses plugin ledger semantics)
 *
 * This file is the single source of truth for the SHAPE those surfaces agree
 * on. The plugin ledger is plain JSONL, so the contract is enforced by
 * shape-match tests and import parsers — change a field on either side and the
 * tests fail.
 *
 * ── Field map: canonical ⇄ watch (ledger.mjs replay state) ──
 *   id            id              sha256(session|quote).slice(0,8) on watch;
 *                                 generateId() on web
 *   source        (implied)      watch entries are all source 'watch'; the
 *                                 converter stamps it explicitly
 *   decision      decision        one sentence: what was decided
 *   quote         quote           the user's own words the decision rests on
 *                                 (P2 인용 앵커)
 *   predicate     predicate       the falsifiable statement
 *   falsified_if  falsified_if    what observation would disprove it
 *   check_by      check_by        ISO date to return and settle
 *   status        status          candidate → sealed → settled | dismissed
 *   outcome       outcome         happened | avoided | partial (settle 시)
 *   history       history         superseded values, oldest first — amend
 *                                 never overwrites (변침도 기록이다)
 *
 * Surface language note: predicate/falsified_if are INTERNAL names. The user
 * sees "물어봐 줄까요?" / "그래서, 어떻게 됐어요?" — never 내기/반증/predicate.
 */

import type { Project, DecisionContract, Predicate, PredicateVerdict } from '@/stores/types';

export type LedgerDecisionSource = 'web' | 'helm' | 'watch';
export type LedgerDecisionStatus = 'candidate' | 'sealed' | 'settled' | 'dismissed';
/** Settle vocabulary — identical to watch CLI (`argus-watch settle <id> <outcome>`)
 *  and to the web's scored PredicateVerdicts. "아직" is NOT an outcome: it
 *  amends check_by instead (see amendCheckIn in decision-contract.ts /
 *  `settle … pending` in watch). */
export type LedgerOutcome = 'happened' | 'avoided' | 'partial';

export interface LedgerAmendment {
  predicate?: string;
  falsified_if?: string;
  check_by?: string;
  amended_at: string;
}

/** The unified decision object — the JSON shape all three doors agree on. */
export interface LedgerDecision {
  id: string;
  source: LedgerDecisionSource;
  /** What was decided, one sentence. */
  decision: string;
  /** The user's own words this decision rests on (P2 인용 앵커). May be empty
   *  on web until the live path carries the user's restated bet through. */
  quote: string;
  /** The falsifiable statement. */
  predicate: string;
  /** What observation would disprove it. */
  falsified_if: string;
  /** ISO date (YYYY-MM-DD or full ISO) to return and settle. */
  check_by: string | null;
  status: LedgerDecisionStatus;
  outcome?: LedgerOutcome;
  /** Superseded values, oldest first. Never overwritten. */
  history: LedgerAmendment[];
}

/** Canonical field names — the shape-match tests iterate THIS list. */
export const LEDGER_DECISION_FIELDS = [
  'id',
  'source',
  'decision',
  'quote',
  'predicate',
  'falsified_if',
  'check_by',
  'status',
  'outcome',
  'history',
] as const;

/** Fields the watch replay materializes natively (everything except `source`,
 *  which is implied by the storage location and stamped by the converter). */
export const WATCH_NATIVE_FIELDS = LEDGER_DECISION_FIELDS.filter((f) => f !== 'source');

/** Map a web scored verdict to the shared outcome vocabulary.
 *  `unknown`/`pending` → null (not settled — those never score). */
export function verdictToOutcome(v: PredicateVerdict | undefined): LedgerOutcome | null {
  if (v === 'happened' || v === 'avoided' || v === 'partial') return v;
  return null;
}

/**
 * Web → unified: one LedgerDecision per predicate (watch's unit is one
 * decision = one predicate, so the web contract fans out). Pure projection —
 * reads only, the jsonb stays the storage format.
 */
export function contractToLedgerDecisions(
  project: Pick<Project, 'id' | 'name'>,
  contract: DecisionContract | null | undefined,
  /** The user's restated bet (session.falsification.real_bet), when available. */
  quote?: string | null,
): LedgerDecision[] {
  if (!contract) return [];
  const predicates: Predicate[] = Array.isArray(contract.predicates) ? contract.predicates : [];
  const history: LedgerAmendment[] = (contract.history || []).map((h) => ({
    check_by: h.check_in_at,
    amended_at: h.amended_at,
  }));
  return predicates.map((p) => {
    const outcome = verdictToOutcome(p.verdict);
    return {
      id: `${contract.id}:${p.id}`,
      source: 'web' as const,
      decision: project.name,
      quote: quote || '',
      predicate: p.text,
      // The web card frames each predicate as a yes/no question; its negation
      // is the falsifier. Until the probe path emits explicit falsified_if,
      // this is the honest mechanical derivation.
      falsified_if: `아님: ${p.text}`,
      check_by: contract.check_in_at ?? null,
      status: outcome ? 'settled' : 'sealed',
      ...(outcome ? { outcome } : {}),
      history,
    };
  });
}

/**
 * Watch → unified: stamp the implied source. `raw` is a replayed decision from
 * loadLedger() (tools/argus-watch/lib/ledger.mjs). Defensive: ledger lines are
 * append-only JSONL written by multiple tool versions.
 */
export function watchToLedgerDecision(raw: Record<string, unknown>): LedgerDecision {
  const str = (v: unknown) => (typeof v === 'string' ? v : '');
  const status = str(raw.status);
  const outcome = str(raw.outcome);
  return {
    id: str(raw.id),
    source: 'watch',
    decision: str(raw.decision),
    quote: str(raw.quote),
    predicate: str(raw.predicate),
    falsified_if: str(raw.falsified_if),
    check_by: typeof raw.check_by === 'string' ? raw.check_by : null,
    status: (['candidate', 'sealed', 'settled', 'dismissed'] as const).includes(
      status as LedgerDecisionStatus,
    )
      ? (status as LedgerDecisionStatus)
      : 'candidate',
    ...(outcome === 'happened' || outcome === 'avoided' || outcome === 'partial'
      ? { outcome: outcome as LedgerOutcome }
      : {}),
    history: Array.isArray(raw.history) ? (raw.history as LedgerAmendment[]) : [],
  };
}
