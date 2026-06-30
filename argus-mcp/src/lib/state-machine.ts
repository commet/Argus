import type { ContractEntry } from './ledger-replay.js';
import { asDate } from './resolve-today.js';

/**
 * Decision lifecycle (blueprint §3.2). State is DERIVED from the ledger fold,
 * never stored. `due` is not a stored status — it is `sealed` whose check_by
 * has arrived. The MCP protocol does not enforce call order, so these guards
 * (run against freshly-replayed state) are the only thing that does.
 */
export type DecisionState = 'absent' | 'opened' | 'sealed' | 'due' | 'settled' | 'dismissed';

export type LedgerEventType = 'harvest' | 'seal' | 'amend' | 'dismiss' | 'settle';

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
  absent: new Set<LedgerEventType>(['harvest', 'seal', 'settle']), // seal/settle self-create (B1); settle then still needs a seal (see guard)
  opened: new Set<LedgerEventType>(['seal', 'amend', 'dismiss']),
  sealed: new Set<LedgerEventType>(['amend', 'dismiss', 'settle']),
  due: new Set<LedgerEventType>(['dismiss', 'settle']), // no amend once due — goalpost guard (m4)
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
        'Cannot settle a decision that was never sealed.',
        'Call argus_seal with a falsifiable predicate and a check-by date first.',
      );
    }
    if (current === 'settled') {
      throw new GuardError('ALREADY_SETTLED', 'This decision is already settled (append-only — no re-judging).', 'Use argus_recall to read the receipt.');
    }
    if (current === 'dismissed') {
      throw new GuardError('DECISION_CLOSED', 'This decision was dismissed.', 'Open a new decision if reality changed.');
    }
    return; // sealed | due → settle OK
  }

  if (event === 'amend' && current === 'due') {
    throw new GuardError('GOALPOST_MOVED', 'Cannot move the check-by date once it has arrived.', 'Settle the decision against reality instead.');
  }

  if ((current === 'settled' || current === 'dismissed')) {
    throw new GuardError('DECISION_CLOSED', `This decision is ${current}; it cannot accept a ${event}.`, 'Open a new decision instead — closed decisions are not reopened.');
  }

  if (!ALLOWED[current].has(event)) {
    throw new GuardError(
      'ILLEGAL_TRANSITION',
      `A '${event}' is not allowed from state '${current}'.`,
      event === 'seal' ? 'Open the decision first with argus_open_decision.' : undefined,
    );
  }
}
