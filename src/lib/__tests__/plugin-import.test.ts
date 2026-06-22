import { describe, it, expect } from 'vitest';
import { parseLedger, parseBearing, classify } from '../plugin-parse';

// Pure parsers (no IO) carry the fold logic — lock them here.

describe('parseLedger (port of tools/argus-watch/lib/ledger.mjs loadLedger)', () => {
  const seq = [
    { event: 'harvest', id: 'a1b2c3d4', project: 'my-cli', session: 's-xyz', decided_at: '2026-04-24T09:15:00Z', quote: '"split auth"', decision: 'Split auth module', type: 'architecture', stakes: 'high', at: '2026-04-24T09:16:00Z' },
    { event: 'seal', id: 'a1b2c3d4', predicate: 'Split done by week-end', falsified_if: 'still monolithic May 1', check_by: '2026-05-01', at: '2026-04-24T14:30:00Z' },
    { event: 'amend', id: 'a1b2c3d4', check_by: '2026-05-10', at: '2026-04-28T11:00:00Z' },
    { event: 'settle', id: 'a1b2c3d4', outcome: 'partial', note: 'permissions extracted', at: '2026-05-12T10:00:00Z' },
  ].map((e) => JSON.stringify(e)).join('\n');

  it('folds harvest→seal→amend→settle into one decision', () => {
    const out = parseLedger(seq);
    expect(out).toHaveLength(1);
    const d = out[0];
    expect(d.ledger_id).toBe('a1b2c3d4');
    expect(d.status).toBe('settled');
    expect(d.decision).toBe('Split auth module');
    expect(d.stakes).toBe('high');
    expect(d.predicate).toBe('Split done by week-end');
    expect(d.check_by).toBe('2026-05-10');           // amend updated it
    expect(d.outcome).toBe('partial');
    expect(d.settle_note).toBe('permissions extracted');
  });

  it('preserves the pre-amend value in history (변침도 기록)', () => {
    const d = parseLedger(seq)[0];
    expect(d.history).toHaveLength(1);
    expect(d.history![0].check_by).toBe('2026-05-01');   // the value before amend
    expect(d.history![0].amended_at).toBe('2026-04-28T11:00:00Z');
  });

  it('harvest-only stays a candidate; dismiss marks dismissed', () => {
    const candidate = parseLedger(JSON.stringify({ event: 'harvest', id: 'x1', quote: 'q', at: 't' }));
    expect(candidate[0].status).toBe('candidate');

    const dismissed = parseLedger([
      JSON.stringify({ event: 'harvest', id: 'x2', quote: 'q', at: 't1' }),
      JSON.stringify({ event: 'dismiss', id: 'x2', reason: 'not mine', at: 't2' }),
    ].join('\n'));
    expect(dismissed[0].status).toBe('dismissed');
    expect(dismissed[0].dismiss_reason).toBe('not mine');
  });

  it('ignores blank lines and malformed JSON', () => {
    const out = parseLedger('\n{bad json}\n' + JSON.stringify({ event: 'harvest', id: 'ok', quote: 'q', at: 't' }) + '\n\n');
    expect(out).toHaveLength(1);
    expect(out[0].ledger_id).toBe('ok');
  });

  it('drops a seal with no prior harvest (orphan event)', () => {
    const out = parseLedger(JSON.stringify({ event: 'seal', id: 'orphan', predicate: 'p', at: 't' }));
    expect(out).toHaveLength(0);
  });
});

describe('parseBearing', () => {
  it('extracts course + contract_seed and keeps raw', () => {
    const obj = {
      label: 'v0.1',
      current_course: { status: 'proceed', summary: 'ship the spike' },
      contract_seed: { predicate: 'users seal ≥1 decision in week 1', check_by: '1w', pass_condition: 'row lands', fail_condition: 'no row' },
      next_helm: 'open the import page',
    };
    const b = parseBearing(obj)!;
    expect(b).not.toBeNull();
    expect(b.label).toBe('v0.1');
    expect(b.current_course?.summary).toBe('ship the spike');
    expect(b.contract_seed?.predicate).toContain('seal');
    expect(b.raw).toEqual(obj);
  });

  it('returns null for a non-bearing object', () => {
    expect(parseBearing({ hello: 'world' })).toBeNull();
  });
});

describe('classify', () => {
  it('detects a JSONL ledger by the event field', () => {
    expect(classify('{"event":"harvest","id":"a","at":"t"}\n{"event":"seal","id":"a"}')).toBe('ledger');
  });
  it('detects a bearing object', () => {
    expect(classify(JSON.stringify({ current_course: { status: 'proceed' } }))).toBe('bearing');
    expect(classify(JSON.stringify({ contract_seed: { predicate: 'p' } }))).toBe('bearing');
  });
  it('returns unknown for unrelated or empty content', () => {
    expect(classify('')).toBe('unknown');
    expect(classify(JSON.stringify({ foo: 1 }))).toBe('unknown');
    expect(classify('just text')).toBe('unknown');
  });
});
