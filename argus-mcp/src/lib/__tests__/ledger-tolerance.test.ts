import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { tmpArgusDir } from '../../test-helpers.js';
import { replayLedger } from '../ledger-replay.js';
import { readReceipt } from '../receipt.js';
import { withLedgerLock } from '../ledger-append.js';
import { receiptPath, ledgerPath } from '../layout.js';

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

  it('a settle with an UNKNOWN outcome keeps total_settled == sum(buckets) (guru fuzz G1)', () => {
    const dir = tmpArgusDir();
    writeLedger(dir, [
      seal('d1'),
      JSON.stringify({ v: 1, ts: '2026-07-01T01:00:00Z', id: 'd1', event: 'settle', outcome: 'held' }),
      seal('d2'),
      // a corrupt / externally-synced settle whose outcome is not a known bucket
      JSON.stringify({ v: 1, ts: '2026-07-01T02:00:00Z', id: 'd2', event: 'settle', outcome: 'exploded' }),
    ]);
    const s = replayLedger(dir, '2026-07-02');
    const st = s.stats;
    const bucketSum = st.held + st.avoided + st.partial + st.still_pending + st.missed;
    expect(st.total_settled).toBe(bucketSum); // invariant holds (was 2 vs 1)
    expect(st.total_settled).toBe(1);         // only the categorizable settle counts
    expect(s.contracts.get('d2')?.status).toBe('settled'); // d2 still marked settled
  });

  it('a terminal settle with outcome still_pending is NOT counted (four-bucket display reconciles, F3)', () => {
    const dir = tmpArgusDir();
    writeLedger(dir, [
      seal('d1'),
      JSON.stringify({ v: 1, ts: '2026-07-01T01:00:00Z', id: 'd1', event: 'settle', outcome: 'held' }),
      seal('d2'),
      JSON.stringify({ v: 1, ts: '2026-07-01T02:00:00Z', id: 'd2', event: 'settle', outcome: 'still_pending' }),
    ]);
    const st = replayLedger(dir, '2026-07-02').stats;
    // displayed buckets are held/avoided/partial/missed — total must equal their sum
    expect(st.total_settled).toBe(st.held + st.avoided + st.partial + st.missed);
    expect(st.total_settled).toBe(1);
    expect(st.still_pending).toBe(0);
  });

  it('a per-line BOM (concat / PowerShell co-writer) does not drop the adjacent event (F4)', () => {
    const dir = tmpArgusDir();
    const bom = '﻿';
    writeLedger(dir, [
      seal('d1'),
      bom + JSON.stringify({ v: 1, ts: '2026-07-01T01:00:00Z', id: 'd1', event: 'settle', outcome: 'held' }),
    ]);
    const s = replayLedger(dir, '2026-07-02');
    expect(s.integrity.dropped_lines).toBe(0);          // BOM line parsed, not dropped
    expect(s.stats.total_settled).toBe(1);              // the settle survived
    expect(s.contracts.get('d1')?.status).toBe('settled');
  });

  it('a corrupt (non-object) receipt file degrades to null, never crashes the render (F5)', () => {
    const dir = tmpArgusDir();
    fs.mkdirSync(path.dirname(receiptPath(dir, 'x')), { recursive: true });
    for (const junk of ['42', '"a string"', '[]', 'null']) {
      fs.writeFileSync(receiptPath(dir, 'x'), junk);
      expect(readReceipt(dir, 'x')).toBeNull(); // not a plain object → null, no throw downstream
    }
  });

  it('a crash-leftover lock held by a DEAD pid is stolen, so a write is not blocked (F1)', async () => {
    const dir = tmpArgusDir();
    fs.mkdirSync(path.dirname(ledgerPath(dir)), { recursive: true });
    // a lock left by a process that is gone (pid 0x7FFFFFFF is not alive)
    fs.writeFileSync(ledgerPath(dir) + '.lock', JSON.stringify({ nonce: 'dead', pid: 0x7fffffff, started_at: new Date().toISOString() }));
    const t0 = Date.now();
    const out = await withLedgerLock(dir, async () => 'ran');
    expect(out).toBe('ran');           // fn executed (dead-pid lock was stolen, not waited on)
    expect(Date.now() - t0).toBeLessThan(2000); // did not block for the full ~3s wait
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
