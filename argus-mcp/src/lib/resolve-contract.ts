import { replayLedger, type ContractEntry } from './ledger-replay.js';
import { deriveState, type DecisionState } from './state-machine.js';
import { receiptPath } from './layout.js';
import { readReceipt, type Receipt } from './receipt.js';

/**
 * The single resolver every tool uses (blueprint §3.0, B2). One `id` =
 * session = contract = receipt path segment. No `contract_id` / `label`
 * dimension exists. Given an id, this is the only way to read its current
 * state, predicate, check-by, and receipt.
 */
export interface ResolvedContract {
  id: string;
  state: DecisionState;
  entry: ContractEntry | undefined;
  predicate?: string;
  check_by?: string;
  receiptPath: string;
  receipt: Receipt | null;
  /** errno when the ledger EXISTS but could not be read. A write path must
   *  refuse rather than act on a fold it knows is blind (audit 2026-07-27:
   *  an unreadable ledger let a second seal land on an id that was already
   *  sealed, silently moving its check-by — the exact goalpost move the state
   *  machine exists to refuse). */
  unreadable?: string;
}

export function resolveContract(argusDir: string, id: string, today: string): ResolvedContract {
  const ledger = replayLedger(argusDir, today);
  const entry = ledger.contracts.get(id);
  return {
    id,
    state: deriveState(entry, today),
    entry,
    ...(ledger.integrity.unreadable ? { unreadable: ledger.integrity.unreadable } : {}),
    predicate: entry?.predicate,
    check_by: entry?.check_by,
    receiptPath: receiptPath(argusDir, id),
    receipt: readReceipt(argusDir, id),
  };
}
