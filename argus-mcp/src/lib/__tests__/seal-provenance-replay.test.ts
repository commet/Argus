import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { replayLedger } from '../ledger-replay.js';

/**
 * Provenance must survive the fold, not just the write.
 *
 * `predicate_owner` used to live only in the bearing seed, the receipt and the
 * v2 mirror — none of which the webapp push reads. Recording it on the seal
 * EVENT makes it part of the append-only record every reader replays, which is
 * what lets the account render an Argus draft as a draft instead of as the
 * user's own judgment. Absence stays absence: an old ledger is unknown, and no
 * reader may promote unknown to 'user'.
 */
describe('replayLedger — seal provenance', () => {
  let dir: string;

  const writeLedger = (events: Record<string, unknown>[]) => {
    const ledgerDir = join(dir, 'ledger');
    mkdirSync(ledgerDir, { recursive: true });
    writeFileSync(
      join(ledgerDir, 'ledger.jsonl'),
      events.map((e) => JSON.stringify(e)).join('\n') + '\n',
      'utf8',
    );
  };

  beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'argus-prov-')); });
  afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

  it('carries ai_surfaced through the fold', () => {
    writeLedger([
      { id: 'd1', event: 'harvest', decision: 'Move billing', ts: '2026-07-20T09:00:00Z' },
      { id: 'd1', event: 'seal', predicate: 'Billing migrated by Aug 5', check_by: '2026-08-05', predicate_owner: 'ai_surfaced', ts: '2026-07-20T09:05:00Z' },
    ]);
    const state = replayLedger(dir, '2026-07-25');
    expect(state.contracts.get('d1')?.predicate_owner).toBe('ai_surfaced');
  });

  it("carries the user's own through the fold", () => {
    writeLedger([
      { id: 'd2', event: 'harvest', decision: 'Hold price', ts: '2026-07-20T09:00:00Z' },
      { id: 'd2', event: 'seal', predicate: 'No price change before Q4', check_by: '2026-10-01', predicate_owner: 'user', ts: '2026-07-20T09:05:00Z' },
    ]);
    const state = replayLedger(dir, '2026-07-25');
    expect(state.contracts.get('d2')?.predicate_owner).toBe('user');
  });

  it('leaves an older ledger unknown rather than defaulting it to the user', () => {
    writeLedger([
      { id: 'd3', event: 'harvest', decision: 'Old', ts: '2026-05-01T09:00:00Z' },
      { id: 'd3', event: 'seal', predicate: 'Shipped by June', check_by: '2026-06-01', ts: '2026-05-01T09:05:00Z' },
    ]);
    const state = replayLedger(dir, '2026-07-25');
    expect(state.contracts.get('d3')?.predicate_owner).toBeUndefined();
  });

  it('refuses a value outside the vocabulary', () => {
    writeLedger([
      { id: 'd4', event: 'harvest', decision: 'X', ts: '2026-07-20T09:00:00Z' },
      { id: 'd4', event: 'seal', predicate: 'p', check_by: '2026-08-05', predicate_owner: 'the_user_obviously', ts: '2026-07-20T09:05:00Z' },
    ]);
    const state = replayLedger(dir, '2026-07-25');
    expect(state.contracts.get('d4')?.predicate_owner).toBeUndefined();
  });
});
