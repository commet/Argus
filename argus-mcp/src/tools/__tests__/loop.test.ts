import { describe, it, expect } from 'vitest';
import { tmpArgusDir, body, isError } from '../../test-helpers.js';
import { init } from '../init-config.js';
import { openDecision } from '../open-decision.js';
import { seal } from '../seal.js';
import { settle } from '../settle.js';
import { recall } from '../recall.js';
import { checkIn } from '../check-in.js';

const FUTURE = '2027-01-01';
const PAST = '2026-01-01';

describe('seal → settle happy path', () => {
  it('opens, seals with receipt fields, settles, and the receipt has zero AI verdict', async () => {
    const dir = tmpArgusDir();
    await init.handler({ argus_dir: dir });

    const opened = body(await openDecision.handler({
      argus_dir: dir, id: 'migrate-db', decision: 'Move the DB to the new region',
      stakes: 'high', reversibility: 'one_way_door', status_quo: 'Stay on the old region',
      crux_question: 'Is the cutover window actually wide enough for the index rebuild?',
    }));
    expect(opened['ok']).toBe(true);
    expect((opened['data'] as Record<string, unknown>)['harvest_written']).toBe(true);
    expect((opened['over_fire_gate'] as Record<string, unknown>)['fired']).toBe(true);

    const sealed = body(await seal.handler({
      argus_dir: dir, id: 'migrate-db',
      predicate: 'Cutover downtime is under 5 minutes', check_by: FUTURE, predicate_owner: 'user',
      real_question: 'Can we cut over without a maintenance window users notice?',
      unverified_assumption: 'The index rebuild fits inside the replication lag budget',
      human_only: 'Whether a 5-minute blip is acceptable to our customers',
      human_judgment: 'I think it is worth the risk this quarter', basis: 'judgment',
    }));
    expect(sealed['ok']).toBe(true);

    const settled = body(await settle.handler({
      argus_dir: dir, id: 'migrate-db', outcome: 'held', outcome_source: 'user_stated',
      what_happened: 'Cutover took 3 minutes, no customer reports',
    }));
    expect(settled['ok']).toBe(true);
    const data = settled['data'] as Record<string, unknown>;
    expect(data['ai_verdict']).toBe(null);
    const receipt = data['receipt'] as Record<string, unknown>;
    expect(receipt['ai_verdict']).toBe(null);
    expect(receipt['real_question']).toContain('maintenance window');
    expect(receipt['human_judgment']).toContain('worth the risk');
    expect(receipt['assumption_held']).toBe(true);
    expect(String(data['receipt_text'])).toContain('AI VERDICT');
    expect(String(data['receipt_text'])).toContain('NONE');
  });
});

describe('structural spine enforcement', () => {
  it('refuses settle without a prior seal (NO_PRIOR_SEAL)', async () => {
    const dir = tmpArgusDir();
    await openDecision.handler({ argus_dir: dir, id: 'd1', decision: 'x', stakes: 'high', reversibility: 'one_way_door', status_quo: 'y' });
    const r = await settle.handler({ argus_dir: dir, id: 'd1', outcome: 'held', outcome_source: 'user_stated', what_happened: 'z' });
    expect(isError(r)).toBe(true);
    expect(body(r)['error_code']).toBe('NO_PRIOR_SEAL');
  });

  it('B1 regression: a seal without a prior open does NOT evaporate', async () => {
    const dir = tmpArgusDir();
    // seal directly, no open_decision first
    const s = body(await seal.handler({ argus_dir: dir, id: 'orphan', predicate: 'Revenue grows 10 percent', check_by: FUTURE, predicate_owner: 'user' }));
    expect(s['ok']).toBe(true);
    // it must now be settleable (the contract exists, not lost)
    const settled = await settle.handler({ argus_dir: dir, id: 'orphan', outcome: 'partial', outcome_source: 'user_stated', what_happened: 'Grew 6 percent' });
    expect(isError(settled)).toBe(false);
    expect(body(settled)['ok']).toBe(true);
  });

  it('refuses an empty predicate and a past check_by', async () => {
    const dir = tmpArgusDir();
    const empty = await seal.handler({ argus_dir: dir, id: 'd2', predicate: 'short', check_by: FUTURE, predicate_owner: 'user' });
    expect(body(empty)['error_code']).toBe('EMPTY_PREDICATE');
    const past = await seal.handler({ argus_dir: dir, id: 'd2', predicate: 'A real falsifiable prediction here', check_by: PAST, predicate_owner: 'user' });
    expect(body(past)['error_code']).toBe('BAD_CHECK_BY');
  });

  it('blocks a crux that carries a directional lean', async () => {
    const dir = tmpArgusDir();
    const r = await openDecision.handler({
      argus_dir: dir, id: 'd3', decision: 'choice', stakes: 'high', reversibility: 'one_way_door', status_quo: 'stay',
      crux_question: 'You should go with option A, right?',
    });
    expect(isError(r)).toBe(true);
    expect(body(r)['error_code']).toBe('CRUX_CARRIES_LEAN');
  });
});

describe('explicit skip trace (spine: escape kept, omission honest)', () => {
  it('seals without an assumption but records it as skipped, not blank', async () => {
    const dir = tmpArgusDir();
    const s = body(await seal.handler({ argus_dir: dir, id: 'bare', predicate: 'Signups exceed 100 in a month', check_by: FUTURE, predicate_owner: 'user' }));
    expect(s['ok']).toBe(true);
    expect((s['data'] as Record<string, unknown>)['skipped']).toContain('unverified_assumption');
    expect(String(s['surface'])).toContain('skipped');

    const settled = body(await settle.handler({ argus_dir: dir, id: 'bare', outcome: 'held', outcome_source: 'user_stated', what_happened: 'got 140' }));
    const receipt = (settled['data'] as Record<string, unknown>)['receipt'] as Record<string, unknown>;
    expect(receipt['unverified_assumption']).toBe('(skipped)');
    expect(String((settled['data'] as Record<string, unknown>)['receipt_text'])).toContain('you skipped naming this');
  });
});

describe('over-fire restraint writes no harvest', () => {
  it('low-stakes decision returns leave_as_is and never opens', async () => {
    const dir = tmpArgusDir();
    const r = body(await openDecision.handler({ argus_dir: dir, id: 'flat', decision: 'which font', stakes: 'low', reversibility: 'easily_reversible', status_quo: 'keep current' }));
    expect((r['data'] as Record<string, unknown>)['harvest_written']).toBe(false);
    expect((r['data'] as Record<string, unknown>)['fork_emitted']).toBe(false);
    expect(r['next_actions']).toContain('leave_as_is');
  });
});

describe('check_in and today override', () => {
  it('reports a contract as due when today is overridden past its check_by', async () => {
    const dir = tmpArgusDir();
    await seal.handler({ argus_dir: dir, id: 'due1', predicate: 'Launch ships before the date', check_by: '2026-08-01', predicate_owner: 'user', today_override: '2026-07-01' });
    const due = body(await checkIn.handler({ argus_dir: dir, today_override: '2026-09-01' }))['data'] as Record<string, unknown>;
    expect(due['due_count']).toBe(1);
    const none = body(await checkIn.handler({ argus_dir: dir, today_override: '2026-07-15' }))['data'] as Record<string, unknown>;
    expect(none['due_count']).toBe(0);
  });
});

describe('track record reports frequency only, never a tier', () => {
  it('never emits a judgment tier or score', async () => {
    const dir = tmpArgusDir();
    await seal.handler({ argus_dir: dir, id: 't1', predicate: 'Something measurable happens', check_by: FUTURE, predicate_owner: 'user' });
    await settle.handler({ argus_dir: dir, id: 't1', outcome: 'held', outcome_source: 'user_stated', what_happened: 'it did' });
    const tr = body(await recall.handler({ argus_dir: dir, view: 'track_record' }));
    const data = tr['data'] as Record<string, unknown>;
    expect(data['judgment_tier']).toBe(null);
    expect(data['judgment_score']).toBe(null);
    expect(data['frequency_statement']).toBeTruthy();
  });
});
