import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { tmpArgusDir } from '../../test-helpers.js';
import { replayLedger } from '../ledger-replay.js';

/**
 * Forward-compat tolerance (plan v5 §6.3). A ledger written by a NEWER argus-decision-mcp
 * may contain event types this binary doesn't know (e.g. premise_*). Those are
 * versioned, well-formed events — skipping them must NOT raise the corruption
 * counter, or every old install reports a false integrity alarm the moment a new
 * binary touches the ledger. Only unparseable/unversioned junk stays "dropped".
 */

function writeLedger(dir: string, lines: string[]): void {
  fs.mkdirSync(path.join(dir, 'ledger'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'ledger', 'ledger.jsonl'), lines.join('\n') + '\n');
}

const seal = (id: string) =>
  JSON.stringify({ v: 1, ts: '2026-07-01T00:00:00Z', id, event: 'seal', predicate: 'ships before friday', check_by: '2099-01-01' });

describe('replay tolerance for unknown versioned events', () => {
  it('skips a versioned unknown event silently (skipped_unknown, not dropped)', () => {
    const dir = tmpArgusDir();
    writeLedger(dir, [
      seal('d1'),
      // an event type from a FUTURE argus-decision-mcp this binary has never heard of
      JSON.stringify({ v: 2, ts: '2026-07-01T00:00:00Z', id: 'd1', event: 'premise_supersede', premise_id: 'p1' }),
    ]);
    const s = replayLedger(dir, '2026-07-02');
    expect(s.integrity.dropped_lines).toBe(0);
    expect(s.integrity.skipped_unknown).toBe(1);
    expect(s.contracts.get('d1')?.status).toBe('sealed'); // known events unaffected
  });

  it('still counts unversioned unknown events and torn lines as dropped', () => {
    const dir = tmpArgusDir();
    writeLedger(dir, [
      seal('d1'),
      JSON.stringify({ id: 'd1', event: 'mystery_no_version' }), // no v → dropped
      '{torn json', // unparseable → dropped
    ]);
    const s = replayLedger(dir, '2026-07-02');
    expect(s.integrity.dropped_lines).toBe(2);
    expect(s.integrity.skipped_unknown).toBe(0);
  });

  it('empty/missing ledger reports zero for both counters', () => {
    const dir = tmpArgusDir();
    const s = replayLedger(dir, '2026-07-02');
    expect(s.integrity).toEqual({ dropped_lines: 0, skipped_unknown: 0 });
  });
});

describe('plugin-written events on the SHARED ledger (O2 방1 cross-surface vocab)', () => {
  it('a plugin wake event — even an OLD unstamped one — is known, not corruption', () => {
    const dir = tmpArgusDir();
    writeLedger(dir, [
      seal('lean:s1'),
      // pre-2026-07-17 plugin shape: no v, no ts, only at — used to count as dropped
      JSON.stringify({ id: 'lean:s1', event: 'wake', lean_before: 'x', lean_after: 'y', at: '2026-07-02T00:00:00Z' }),
    ]);
    const s = replayLedger(dir, '2026-07-02');
    expect(s.integrity.dropped_lines).toBe(0);
    expect(s.contracts.get('lean:s1')?.status).toBe('sealed'); // wake is not a decision transition
  });

  it("legacy outcome 'happened' buckets as held — total_settled equals the bucket sum again", () => {
    const dir = tmpArgusDir();
    writeLedger(dir, [
      seal('d1'),
      JSON.stringify({ id: 'd1', event: 'settle', outcome: 'happened', at: '2026-07-02T10:00:00Z' }),
    ]);
    const s = replayLedger(dir, '2026-07-03');
    expect(s.stats.total_settled).toBe(1);
    expect(s.stats.held).toBe(1); // was 0 — the bucket silently missed plugin settles
    expect(s.contracts.get('d1')?.outcome).toBe('happened'); // bytes stay honest; only the bucket aliases
  });

  it("a plugin settle stamped only with `at` still gets its settled date (ts/at dual read)", () => {
    const dir = tmpArgusDir();
    writeLedger(dir, [
      seal('d2'),
      JSON.stringify({ id: 'd2', event: 'settle', outcome: 'held', at: '2026-07-02T10:00:00Z' }),
    ]);
    const s = replayLedger(dir, '2026-07-03');
    expect(s.contracts.get('d2')?.settled_on).toBe('2026-07-02');
  });
});
