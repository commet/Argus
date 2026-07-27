import { toolError } from './envelope.js';
import type { ResolvedContract } from './resolve-contract.js';
import type { McpToolResult } from './envelope.js';

/**
 * A write must never act on a fold it knows is blind.
 *
 * Found by adversarial audit, 2026-07-27. When the ledger file exists but
 * cannot be READ (permissions, a directory in its place, EIO, a lock held by a
 * co-writer), the replay used to return an empty state. Every consequence
 * followed from that one lie:
 *
 *   - every read surface said "no decisions on record"
 *   - `argus_resolve` answered NO_PRIOR_SEAL for a prediction on disk
 *   - `deriveState` returned `absent`, so `guardTransition(absent,'seal')`
 *     PASSED — including the re-guard inside the ledger lock — and a second
 *     seal landed on an already-sealed id, silently moving its check-by. That
 *     is precisely the GOALPOST_MOVED the state machine exists to refuse.
 *
 * The lock protects against concurrency. Nothing protected against a read that
 * lies. This does: every write path calls it first and refuses out loud.
 *
 * Reads deliberately do NOT use this — a read degrades to an honest empty
 * answer plus the `integrity.unreadable` flag. Only writes must stop.
 */
export function refuseIfLedgerUnreadable(tool: string, current: Pick<ResolvedContract, 'unreadable'>): McpToolResult | null {
  if (!current.unreadable) return null;
  return toolError({
    ok: false,
    tool,
    error_code: 'LEDGER_UNREADABLE',
    message: `The decision record exists but could not be read (${current.unreadable}). Nothing was written; acting now could overwrite a record that is already there.`,
    recovery: 'Check permissions on .argus/ledger/ledger.jsonl (and that it is a file, not a directory), close any other program holding it, then try again. Nothing was lost; the record is intact on disk.',
  });
}
