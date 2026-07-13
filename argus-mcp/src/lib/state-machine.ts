import type { ContractEntry } from './ledger-replay.js';
import { asDate } from './resolve-today.js';

/**
 * Decision lifecycle (blueprint §3.2). State is DERIVED from the ledger fold,
 * never stored. `due` is not a stored status — it is `sealed` whose check_by
 * has arrived. The MCP protocol does not enforce call order, so these guards
 * (run against freshly-replayed state) are the only thing that does.
 */
export type DecisionState = 'absent' | 'opened' | 'sealed' | 'due' | 'settled' | 'dismissed';

export type LedgerEventType =
  | 'harvest' | 'seal' | 'amend' | 'dismiss' | 'settle'
  // defer: at the check-by, reality had not answered yet (the user said
  // still_pending). NOT a settlement — the contract re-arms with a new check_by
  // and stays alive. Reachable ONLY from `due` via a still_pending answer, so it
  // cannot be used to move a goalpost on a knowable outcome (the outcome is, by
  // definition, still unknown).
  | 'defer'
  // living premises (plan v5): the facts/open questions a decision rests on
  // premise_reconsider (M3) = the user chose `still_open`: defer, not resolve.
  | 'premise_add' | 'premise_amend' | 'premise_recheck' | 'premise_resolve' | 'premise_reconsider';

export function deriveState(entry: ContractEntry | undefined, today: string): DecisionState {
  if (!entry) return 'absent';
  switch (entry.status) {
    case 'candidate': return 'opened';
    case 'settled': return 'settled';
    case 'dismissed': return 'dismissed';
    case 'sealed': {
      const d = asDate(entry.check_by);
      return d && d <= today ? 'due' : 'sealed';
    }
    default: return 'absent';
  }
}

/** Which events each state accepts. `harvest` from `absent` opens; re-harvest is an idempotent no-op handled by the caller. */
const ALLOWED: Record<DecisionState, Set<LedgerEventType>> = {
  // premise_* NEVER self-creates (unlike seal's B1) — a premise belongs to a
  // decision's narrative, so absent refuses it (plan v5 §6.2).
  absent: new Set<LedgerEventType>(['harvest', 'seal', 'settle']), // seal/settle self-create (B1); settle then still needs a seal (see guard)
  opened: new Set<LedgerEventType>(['seal', 'amend', 'dismiss', 'premise_add', 'premise_amend', 'premise_recheck', 'premise_resolve', 'premise_reconsider']),
  sealed: new Set<LedgerEventType>(['amend', 'dismiss', 'settle', 'premise_add', 'premise_amend', 'premise_recheck', 'premise_resolve', 'premise_reconsider']),
  // due: no premise_add (retroactive premise-planting rigs calibration) and no
  // premise_amend (retiring the premise that's about to be proven wrong is the
  // goalpost guard one level down) — recheck/resolve/reconsider stay open
  // (deferring or closing an open_question is never a goalpost move; plan v5 §6.2).
  // defer lives here (not in `sealed`): still_pending before the check-by is
  // PREMATURE, so a deferral can only originate once due. It re-arms check_by
  // forward — legitimate because the outcome is genuinely unknown, which is the
  // one thing the goalpost guard on `amend` is NOT protecting against.
  due: new Set<LedgerEventType>(['dismiss', 'settle', 'defer', 'premise_recheck', 'premise_resolve', 'premise_reconsider']), // no amend once due — goalpost guard (m4)
  settled: new Set<LedgerEventType>([]), // terminal — no reopen (mirror clause)
  dismissed: new Set<LedgerEventType>([]), // terminal
};

export class GuardError extends Error {
  code: string;
  recovery?: string;
  constructor(code: string, message: string, recovery?: string) {
    super(message);
    this.name = 'GuardError';
    this.code = code;
    this.recovery = recovery;
  }
}

function eventArticle(event: LedgerEventType): string {
  return /^[aeiou]/i.test(event) ? 'an' : 'a';
}

/**
 * A refusal must name a move that ACTUALLY works from this state, or the caller
 * loops on the same advice (the dead-end class: the old premise-on-absent hint
 * said "open it first", but re-opening a restrained decision just returns
 * restraint again). Every branch below is derived from ALLOWED + the guards
 * above, so the state each one addresses is the only state that can reach it.
 */
function illegalRecovery(current: DecisionState, event: LedgerEventType): string | undefined {
  switch (true) {
    // seal is legal from absent|opened, and settled|dismissed threw DECISION_CLOSED
    // above — so we are necessarily ALREADY sealed (sealed|due). "Open it first"
    // sent the caller to argus_open_decision, which cannot un-seal an append-only
    // ledger: it returns the same state, and the same error, forever.
    case event === 'seal':
      return current === 'due'
        ? 'This prediction is already saved and its check-by has arrived. Record what reality did with argus_resolve (if reality has not answered, use still_pending and defer it). A saved prediction is never saved twice.'
        : 'This prediction is already saved. Change it with argus_capture action="change_prediction", or record the outcome with argus_resolve once the check-by arrives. A saved prediction cannot be quietly rewritten.';

    // premise_* can only reach here from `absent` (opened/sealed allow them all;
    // due sends add/amend to PREMISE_LOCKED). Adding is recoverable — seal
    // self-creates the contract — so nothing the user meant to track is lost.
    case event === 'premise_add':
      return "This decision isn't open for tracking yet. Open it with argus_capture action=\"open\", or save its prediction with argus_predict, then add the premise.";

    // recheck/resolve/reconsider/amend act on a premise that must ALREADY exist,
    // so the seal-first advice above is off-target for them.
    case event.startsWith('premise_'):
      return 'No decision with this id is being tracked, so it has no premises to act on. Check the id with argus_patterns view="all".';

    // defer only exists to re-arm a bet whose check-by has arrived.
    case event === 'defer':
      // On `absent` there is no decision at all, so "argus_amend moves it" is a
      // dead end (amend is refused on absent too). Point at the id instead.
      if (current === 'absent') {
        return 'No decision with this id exists yet. Check the id with argus_patterns view="all"; start one with argus_capture or argus_predict.';
      }
      return 'A decision can only be deferred once its check-by has arrived. Before then, change the date with argus_capture action="change_prediction".';

    case event === 'amend' || event === 'dismiss':
      return 'No decision with this id exists yet. Check the id with argus_patterns view="all"; start one with argus_capture or argus_predict.';

    default:
      return undefined;
  }
}

/**
 * Throw if `event` is illegal from the decision's current derived state.
 * Encodes the spine's structural refusals:
 *  - settle without a prior seal  → NO_PRIOR_SEAL
 *  - settle an already-settled    → ALREADY_SETTLED
 *  - amend after check_by (due)    → GOALPOST_MOVED
 *  - any event on a closed decision → DECISION_CLOSED
 */
export function guardTransition(
  current: DecisionState,
  event: LedgerEventType,
): void {
  // settle is special: it must have a real seal behind it, not a self-created shell.
  if (event === 'settle') {
    if (current === 'opened' || current === 'absent') {
      throw new GuardError(
        'NO_PRIOR_SEAL',
        'Cannot record a result for a prediction that was never saved.',
        'Call argus_predict with a falsifiable predicate and a check-by date first. ' +
          "(If this id came from argus_settings action=sync and starts with 'mcp_', use the id without that prefix. Record a web-saved prediction in the web app.)",
      );
    }
    if (current === 'settled') {
      throw new GuardError('ALREADY_SETTLED', 'This decision already has a recorded result (append-only — no re-judging).', 'Use argus_patterns view="receipt" to read it.');
    }
    if (current === 'dismissed') {
      throw new GuardError('DECISION_CLOSED', 'This decision was dismissed.', 'Open a new decision if reality changed.');
    }
    return; // sealed | due → settle OK
  }

  if (event === 'amend' && current === 'due') {
    throw new GuardError('GOALPOST_MOVED', 'Cannot move the check-by date once it has arrived.', 'Record the actual result instead.');
  }

  // Premise writes lock once the check-by has arrived: adding a premise after
  // the fact plants retroactive support, and editing/retiring one right before
  // settlement is the goalpost guard one level down (plan v5 §6.2).
  if ((event === 'premise_add' || event === 'premise_amend') && current === 'due') {
    throw new GuardError(
      'PREMISE_LOCKED',
      'Premises are locked once the check-by date has arrived.',
      'Record the actual result first with argus_resolve; the premise record stays as it was when you committed.',
    );
  }

  if ((current === 'settled' || current === 'dismissed')) {
    throw new GuardError('DECISION_CLOSED', `This decision is ${current}; it cannot accept ${eventArticle(event)} ${event}.`, 'Open a new decision instead — closed decisions are not reopened.');
  }

  if (!ALLOWED[current].has(event)) {
    throw new GuardError(
      'ILLEGAL_TRANSITION',
      `A '${event}' is not allowed from state '${current}'.`,
      illegalRecovery(current, event),
    );
  }
}
