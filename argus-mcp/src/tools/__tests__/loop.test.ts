import { describe, it, expect, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
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

describe("settle outcome 'missed' — judgment-layer miss parity (checkpoints v2 §7.2)", () => {
  it("accepts 'missed' and records assumption_held = false (the read was wrong, not a held bet)", async () => {
    const dir = tmpArgusDir();
    await init.handler({ argus_dir: dir });
    await openDecision.handler({
      argus_dir: dir, id: 'bet1', decision: 'Ship the new pricing page this sprint',
      stakes: 'high', reversibility: 'costly_to_reverse', status_quo: 'Keep the old page',
      crux_question: 'Will the new page actually lift conversion the way we expect?',
    });
    await seal.handler({
      argus_dir: dir, id: 'bet1', predicate: 'Conversion rises within two weeks', check_by: FUTURE,
      predicate_owner: 'user', human_judgment: 'I think the clearer tiers will land',
    });
    const settled = body(await settle.handler({
      argus_dir: dir, id: 'bet1', outcome: 'missed', outcome_source: 'user_stated',
      what_happened: 'Conversion was flat — my read was wrong',
    }));
    expect(settled['ok']).toBe(true);
    const data = settled['data'] as Record<string, unknown>;
    expect(data['outcome']).toBe('missed');
    expect(data['ai_verdict']).toBe(null);
    const receipt = data['receipt'] as Record<string, unknown>;
    expect(receipt['outcome']).toBe('missed');
    expect(receipt['assumption_held']).toBe(false); // a miss is not a held bet
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
    // the seal offers to name the assumption as an INVITATION, not a "you
    // skipped it" deficiency report (experience loop, amender)
    expect(String(s['surface'])).toContain('assumption');
    expect(String(s['surface'])).not.toContain('without naming');

    const settled = body(await settle.handler({ argus_dir: dir, id: 'bare', outcome: 'held', outcome_source: 'user_stated', what_happened: 'got 140' }));
    const receipt = (settled['data'] as Record<string, unknown>)['receipt'] as Record<string, unknown>;
    expect(receipt['unverified_assumption']).toBe('(skipped)');
    // skipped fields render neutrally now (no "you skipped" completeness nag)
    const rt = String((settled['data'] as Record<string, unknown>)['receipt_text']);
    expect(rt).toContain('(none)');
    expect(rt).not.toContain('you skipped');
  });
});

describe('over-fire restraint withholds ceremony but still records (기록과 의식 분리)', () => {
  it('low-stakes decision is recorded quietly — no crux, no fork, no seal push', async () => {
    const dir = tmpArgusDir();
    const r = body(await openDecision.handler({ argus_dir: dir, id: 'flat', decision: 'which font', stakes: 'low', reversibility: 'easily_reversible', status_quo: 'keep current' }));
    const data = r['data'] as Record<string, unknown>;
    // Recorded: the user's own decision is kept regardless of stakes — deciding
    // it "isn't worth keeping" would itself be a judgment (zero-judgment).
    expect(data['harvest_written']).toBe(true);
    // But the ceremony is withheld: no fork, no manufactured crux, gate not fired.
    expect(data['fork_emitted']).toBe(false);
    expect(data['crux_question']).toBeNull();
    expect((r['over_fire_gate'] as Record<string, unknown>)['fired']).toBe(false);
    // Restraint: the handle is returned, but no seal is nudged on a low-stakes call.
    expect(r['next_actions']).toContain('leave_as_is');
    expect(r['next_actions']).not.toContain('argus_seal');
    // Prove the record is real, not just a flag: it is readable afterward. If
    // persistence ever re-couples to the gate, this turns red.
    const seen = body(await recall.handler({ argus_dir: dir, view: 'contracts' }))['data'] as Record<string, unknown>;
    expect((seen['contracts'] as unknown[]).length).toBe(1);
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

  it('include_upcoming_days actually returns upcoming contracts (P1-E4: no accepted-then-discarded argument)', async () => {
    const dir = tmpArgusDir();
    await seal.handler({ argus_dir: dir, id: 'soon', predicate: 'Launch ships before the date', check_by: '2026-08-01', predicate_owner: 'user', today_override: '2026-07-01' });
    const r = body(await checkIn.handler({ argus_dir: dir, today_override: '2026-07-25', include_upcoming_days: 14 }));
    const data = r['data'] as Record<string, unknown>;
    expect(data['due_count']).toBe(0);
    const upcoming = data['upcoming'] as Array<Record<string, unknown>>;
    expect(upcoming).toHaveLength(1);
    expect(upcoming[0]['id']).toBe('soon');
    expect(upcoming[0]['check_by']).toBe('2026-08-01');
    expect(String(r['surface'])).toContain('coming due within 14 day(s)');
    expect(String(r['surface'])).toContain('Informational');

    // Outside the window → no upcoming, no line.
    const far = body(await checkIn.handler({ argus_dir: dir, today_override: '2026-07-01', include_upcoming_days: 7 }));
    expect((far['data'] as Record<string, unknown>)['upcoming']).toEqual([]);
    expect(String(far['surface'])).not.toContain('coming due');
  });

  it('P1-E3 anchor mirror: a due contract carries its seal date and the user\'s own words back', async () => {
    const dir = tmpArgusDir();
    await seal.handler({
      argus_dir: dir, id: 'mirror1', predicate: 'Churn stays under 3 percent', check_by: '2026-08-01',
      predicate_owner: 'user', human_judgment: 'I hire now; waiting kills the H2 roadmap',
      today_override: '2026-07-01',
    });
    const TODAY = '2026-08-16';
    const r = body(await checkIn.handler({ argus_dir: dir, today_override: TODAY }));
    const due = (r['data'] as Record<string, unknown>)['due'] as Array<Record<string, unknown>>;
    // sealed_at is the receipt's real wall-clock seal date (not today_override) —
    // assert the derived arithmetic, not a hardcoded date.
    const sealedAt = String(due[0]['sealed_at']);
    expect(sealedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    const expectedDays = Math.round((Date.parse(TODAY + 'T00:00:00Z') - Date.parse(sealedAt + 'T00:00:00Z')) / 86400000);
    expect(due[0]['days_since_seal']).toBe(expectedDays);
    expect(due[0]['your_words_then']).toBe('I hire now; waiting kills the H2 roadmap');
    // The surface mirrors the words — date arithmetic, no welcome greeting.
    const surface = String(r['surface']);
    expect(surface).toContain(`${expectedDays} day(s) since you saved this`);
    expect(surface).toContain('I hire now; waiting kills the H2 roadmap');
    expect(surface).toContain('argus_resolve');
    expect(surface).not.toMatch(/welcome back|great to see/i);
  });

  it('P1-E3: a skipped judgment falls back to the count line — no invented quote', async () => {
    const dir = tmpArgusDir();
    await seal.handler({
      argus_dir: dir, id: 'mirror2', predicate: 'Signups exceed 100 in a month', check_by: '2026-08-01',
      predicate_owner: 'user', today_override: '2026-07-01',
    });
    const r = body(await checkIn.handler({ argus_dir: dir, today_override: '2026-08-16' }));
    const due = (r['data'] as Record<string, unknown>)['due'] as Array<Record<string, unknown>>;
    expect(due[0]['your_words_then']).toBeUndefined();
    expect(String(due[0]['sealed_at'])).toMatch(/^\d{4}-\d{2}-\d{2}$/); // the date fact still lands
    expect(String(r['surface'])).toContain('past check-by');
    expect(String(r['surface'])).not.toContain('(skipped)');
  });

  it('P1-E3/E1: the ko locale config renders the Korean anchor mirror', async () => {
    const dir = tmpArgusDir();
    await seal.handler({
      argus_dir: dir, id: 'mirror3', predicate: 'Churn stays under 3 percent', check_by: '2026-08-01',
      predicate_owner: 'user', human_judgment: '지금 뽑는다. 늦추면 하반기 로드맵이 전부 밀린다',
      today_override: '2026-07-01',
    });
    fs.writeFileSync(path.join(dir, 'config.yaml'), 'schema_version: 1\nlocale: ko\n');
    const r = body(await checkIn.handler({ argus_dir: dir, today_override: '2026-08-16' }));
    const surface = String(r['surface']);
    expect(surface).toMatch(/예측을 저장한 지 \d+일/);
    expect(surface).toContain('그때 당신은 이렇게 적었습니다');
    expect(surface).toContain('지금 뽑는다');
  });

  it('hints at account-sealed judgments when nothing is due locally but a token is set (P1-E4 ③, no network)', async () => {
    const dir = tmpArgusDir();
    const orig = process.env.ARGUS_TOKEN;
    try {
      process.env.ARGUS_TOKEN = 'argus_pat_test';
      const fetchSpy = vi.spyOn(globalThis, 'fetch');
      const r = body(await checkIn.handler({ argus_dir: dir, today_override: '2026-07-01' }));
      expect(String(r['surface'])).toContain('argus_settings action=sync');
      expect(fetchSpy).not.toHaveBeenCalled(); // check_in stays local and deterministic

      delete process.env.ARGUS_TOKEN;
      const silent = body(await checkIn.handler({ argus_dir: dir, today_override: '2026-07-01' }));
      expect(String(silent['surface'])).toBe('Nothing is due right now.');
    } finally {
      if (orig === undefined) delete process.env.ARGUS_TOKEN; else process.env.ARGUS_TOKEN = orig;
      vi.restoreAllMocks();
    }
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
