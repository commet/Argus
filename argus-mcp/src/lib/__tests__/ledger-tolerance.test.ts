import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { tmpArgusDir } from '../../test-helpers.js';
import { replayLedger } from '../ledger-replay.js';

/**
 * Forward-compat tolerance (plan v5 §6.3). A ledger written by a NEWER argus-mcp
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
      JSON.stringify({ v: 2, ts: '2026-07-01T00:00:00Z', id: 'd1', event: 'premise_add', premise_id: 'p1', text: 'rates stay flat' }),
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
