import { describe, it, expect } from 'vitest';
import { tmpArgusDir, body, isError } from '../../test-helpers.js';
import { premises } from '../premises.js';
import { recheck } from '../recheck.js';
import { seal } from '../seal.js';
import { appendLedger } from '../../lib/ledger-append.js';

const TODAY = '2026-07-02';

async function sealedDecision(dir: string, id = 'd1'): Promise<void> {
  const r = await seal.handler({
    argus_dir: dir, id,
    predicate: 'we migrate with under 5 minutes of downtime',
    check_by: '2026-09-01', predicate_owner: 'user', today_override: TODAY,
  });
  expect(isError(r)).toBe(false);
}

const aiPremise = (text: string, over: Record<string, unknown> = {}) => ({
  text, kind: 'premise', external: true, load_bearing: true, source: 'ai', ai_original: text, ...over,
});

describe('argus_premises op=add', () => {
  it('records premises, echoes them in full, arms monitoring for load-bearing external', async () => {
    const dir = tmpArgusDir();
    await sealedDecision(dir);
    const r = await premises.handler({
      argus_dir: dir, id: 'd1', op: 'add', today_override: TODAY,
      premises: [
        aiPremise('base rate stays at 3.5% through 2026'),
        { text: 'rent out or live in it ourselves', kind: 'open_question', source: 'user' },
      ],
    });
    expect(isError(r)).toBe(false);
    const b = body(r);
    const echo = (b['data'] as Record<string, unknown>)['premises'] as Array<Record<string, unknown>>;
    expect(echo).toHaveLength(2);
    expect(echo[0]['ref']).toBe('P1');
    expect(echo[0]['monitored']).toBe(true);
    expect(echo[1]['monitored']).toBe(false); // open questions are never monitored
    expect(String(b['surface'])).toContain('re-checked against what actually happens');
  });

  it('refuses ai-sourced premises without ai_original (PROVENANCE_REQUIRED)', async () => {
    const dir = tmpArgusDir();
    await sealedDecision(dir);
    const r = await premises.handler({
      argus_dir: dir, id: 'd1', op: 'add', today_override: TODAY,
      premises: [{ text: 'model-drafted premise', kind: 'premise', source: 'ai' }],
    });
    expect(isError(r)).toBe(true);
    expect(body(r)['error_code']).toBe('PROVENANCE_REQUIRED');
  });

  it('caps active premises at 5 and load-bearing at 2', async () => {
    const dir = tmpArgusDir();
    await sealedDecision(dir);
    const five = ['a1', 'a2', 'a3', 'a4', 'a5'].map((t) => aiPremise(`premise ${t}`, { load_bearing: false }));
    expect(isError(await premises.handler({ argus_dir: dir, id: 'd1', op: 'add', premises: five, today_override: TODAY }))).toBe(false);
    const over = await premises.handler({ argus_dir: dir, id: 'd1', op: 'add', premises: [aiPremise('one too many')], today_override: TODAY });
    expect(body(over)['error_code']).toBe('PREMISE_CAP');

    const dir2 = tmpArgusDir();
    await sealedDecision(dir2);
    const threeLb = ['x', 'y', 'z'].map((t) => aiPremise(`lb ${t}`));
    const lb = await premises.handler({ argus_dir: dir2, id: 'd1', op: 'add', premises: threeLb, today_override: TODAY });
    expect(body(lb)['error_code']).toBe('PREMISE_CAP');
  });

  it('re-adding the same text is idempotent (skipped_duplicates)', async () => {
    const dir = tmpArgusDir();
    await sealedDecision(dir);
    await premises.handler({ argus_dir: dir, id: 'd1', op: 'add', premises: [aiPremise('same fact')], today_override: TODAY });
    const again = await premises.handler({ argus_dir: dir, id: 'd1', op: 'add', premises: [aiPremise('Same  FACT ')], today_override: TODAY });
    expect(isError(again)).toBe(false);
    expect((body(again)['data'] as Record<string, unknown>)['skipped_duplicates']).toBe(1);
    // an active same-text dup must NOT be reported as retired
    expect((body(again)['data'] as Record<string, unknown>)['skipped_retired']).toBeUndefined();
    expect(String(body(again)['surface'])).toContain('already recorded and active');
  });

  it('re-adding a RETIRED premise is not silently swallowed as "already recorded"', async () => {
    const dir = tmpArgusDir();
    await sealedDecision(dir);
    await premises.handler({ argus_dir: dir, id: 'd1', op: 'add', premises: [aiPremise('rate holds')], today_override: TODAY });
    // retire P1, then try to add the same fact again
    await premises.handler({ argus_dir: dir, id: 'd1', op: 'amend', ref: 'P1', action: 'retire', today_override: TODAY });
    const readd = await premises.handler({ argus_dir: dir, id: 'd1', op: 'add', premises: [aiPremise('rate holds')], today_override: TODAY });
    expect(isError(readd)).toBe(false);
    const d = body(readd)['data'] as Record<string, unknown>;
    expect(d['skipped_retired']).toEqual(['P1']);      // surfaced, not hidden
    expect(String(body(readd)['surface'])).toContain('retired earlier'); // honest, not "already recorded"
  });

  it('refuses on an absent decision (premises never self-create)', async () => {
    const dir = tmpArgusDir();
    const r = await premises.handler({ argus_dir: dir, id: 'ghost', op: 'add', premises: [aiPremise('x')], today_override: TODAY });
    expect(isError(r)).toBe(true);
    expect(body(r)['error_code']).toBe('ILLEGAL_TRANSITION');
  });

  it('locks once due (PREMISE_LOCKED — no retroactive premise-planting)', async () => {
    const dir = tmpArgusDir();
    await sealedDecision(dir); // check_by 2026-09-01
    const r = await premises.handler({ argus_dir: dir, id: 'd1', op: 'add', premises: [aiPremise('late premise')], today_override: '2026-09-02' });
    expect(body(r)['error_code']).toBe('PREMISE_LOCKED');
  });
});

describe('argus_premises op=amend / op=resolve', () => {
  it('refine records the user wording and keeps ai_original provenance', async () => {
    const dir = tmpArgusDir();
    await sealedDecision(dir);
    await premises.handler({ argus_dir: dir, id: 'd1', op: 'add', premises: [aiPremise('rates stay flat')], today_override: TODAY });
    const r = await premises.handler({ argus_dir: dir, id: 'd1', op: 'amend', ref: 'P1', action: 'refine', text: 'rates stay flat through 2026', today_override: TODAY });
    expect(isError(r)).toBe(false);
    expect(String(body(r)['surface'])).toContain('your words');
    expect(String(body(r)['surface'])).toContain('original stays on the record');
  });

  it('amend by bad ref → NO_SUCH_PREMISE with the listing in recovery', async () => {
    const dir = tmpArgusDir();
    await sealedDecision(dir);
    await premises.handler({ argus_dir: dir, id: 'd1', op: 'add', premises: [aiPremise('a')], today_override: TODAY });
    const r = await premises.handler({ argus_dir: dir, id: 'd1', op: 'amend', ref: 'P9', action: 'retire', today_override: TODAY });
    expect(body(r)['error_code']).toBe('NO_SUCH_PREMISE');
    expect(String(body(r)['recovery'])).toContain('P1=');
  });

  it('resolve closes an open question in the user words; premise refuses', async () => {
    const dir = tmpArgusDir();
    await sealedDecision(dir);
    await premises.handler({
      argus_dir: dir, id: 'd1', op: 'add', today_override: TODAY,
      premises: [aiPremise('a fact'), { text: 'sell or hold', kind: 'open_question', source: 'user' }],
    });
    const wrong = await premises.handler({ argus_dir: dir, id: 'd1', op: 'resolve', ref: 'P1', decision: 'x', today_override: TODAY });
    expect(body(wrong)['error_code']).toBe('NOT_AN_OPEN_QUESTION');

    const r = await premises.handler({ argus_dir: dir, id: 'd1', op: 'resolve', ref: 'P2', decision: 'hold for one more year', today_override: TODAY });
    expect(isError(r)).toBe(false);
    expect((body(r)['data'] as Record<string, unknown>)['decision_owner']).toBe('user');
  });

  it('resolve without a decision (and no elicitation host) → RESOLVE_NEEDS_DECISION, never drafted', async () => {
    const dir = tmpArgusDir();
    await sealedDecision(dir);
    await premises.handler({ argus_dir: dir, id: 'd1', op: 'add', premises: [{ text: 'q', kind: 'open_question', source: 'user' }], today_override: TODAY });
    const r = await premises.handler({ argus_dir: dir, id: 'd1', op: 'resolve', ref: 'P1', today_override: TODAY });
    expect(body(r)['error_code']).toBe('RESOLVE_NEEDS_DECISION');
    expect(String(body(r)['recovery'])).toContain('never draft');
  });
});

describe('argus_recheck', () => {
  async function withPremise(dir: string): Promise<void> {
    await sealedDecision(dir);
    await premises.handler({ argus_dir: dir, id: 'd1', op: 'add', premises: [aiPremise('base rate stays at 3.5%')], today_override: TODAY });
  }

  it('first re-check records a baseline and never alerts', async () => {
    const dir = tmpArgusDir();
    await withPremise(dir);
    const r = await recheck.handler({ argus_dir: dir, id: 'd1', ref: 'P1', finding: 'base rate 3.5%', numeric_value: 3.5, source: 'url', source_detail: 'https://bok.example', today_override: TODAY });
    expect(isError(r)).toBe(false);
    const d = body(r)['data'] as Record<string, unknown>;
    expect(d['baseline_only']).toBe(true);
    expect(d['drifted']).toBe(false);
    expect(String(body(r)['surface'])).toContain('Baseline recorded');
  });

  it('numeric drift fires mechanically on a 10%+ move; surface returns the handle', async () => {
    const dir = tmpArgusDir();
    await withPremise(dir);
    await recheck.handler({ argus_dir: dir, id: 'd1', ref: 'P1', finding: 'base rate 3.5%', numeric_value: 3.5, source: 'url', today_override: TODAY });
    const r = await recheck.handler({ argus_dir: dir, id: 'd1', ref: 'P1', finding: 'base rate 4.0% after hikes', numeric_value: 4.0, source: 'url', today_override: TODAY });
    const b = body(r);
    expect((b['data'] as Record<string, unknown>)['drifted']).toBe(true);
    expect(String(b['surface'])).toContain('your call'); // handle returned, never a directive
  });

  it('text premise with a baseline requires an explicit changed assertion', async () => {
    const dir = tmpArgusDir();
    await withPremise(dir);
    await recheck.handler({ argus_dir: dir, id: 'd1', ref: 'P1', finding: 'supply stays high', source: 'host_reported', today_override: TODAY });
    const missing = await recheck.handler({ argus_dir: dir, id: 'd1', ref: 'P1', finding: 'supply seems lower now', source: 'host_reported', today_override: TODAY });
    expect(body(missing)['error_code']).toBe('RECHECK_NEEDS_ASSERTION');

    const asserted = await recheck.handler({ argus_dir: dir, id: 'd1', ref: 'P1', finding: 'supply dropped sharply', changed: true, source: 'url', source_detail: 'https://news.example', today_override: TODAY });
    expect((body(asserted)['data'] as Record<string, unknown>)['drifted']).toBe(true);
  });

  it('flags an integrity note when changed=true but the finding equals the baseline', async () => {
    const dir = tmpArgusDir();
    await withPremise(dir);
    await recheck.handler({ argus_dir: dir, id: 'd1', ref: 'P1', finding: 'supply stays high', source: 'url', today_override: TODAY });
    const r = await recheck.handler({ argus_dir: dir, id: 'd1', ref: 'P1', finding: ' Supply stays HIGH ', changed: true, source: 'host_reported', today_override: TODAY });
    expect(String((body(r)['data'] as Record<string, unknown>)['integrity_note'] ?? '')).toContain('identical');
  });

  it('apply_to_matching fans out to other decisions holding the same monitored fact', async () => {
    const dir = tmpArgusDir();
    await withPremise(dir); // d1
    await seal.handler({ argus_dir: dir, id: 'd2', predicate: 'second bet holds', check_by: '2026-10-01', predicate_owner: 'user', today_override: TODAY });
    await premises.handler({ argus_dir: dir, id: 'd2', op: 'add', premises: [aiPremise('Base rate stays at 3.5%')], today_override: TODAY });

    const r = await recheck.handler({ argus_dir: dir, id: 'd1', ref: 'P1', finding: 'base rate 3.5%', numeric_value: 3.5, source: 'url', apply_to_matching: true, today_override: TODAY });
    const applied = (body(r)['data'] as Record<string, unknown>)['applied_to_matching'] as Array<Record<string, unknown>>;
    expect(applied).toHaveLength(1);
    expect(applied[0]['decision_id']).toBe('d2');
  });

  it('refuses on a settled decision (DECISION_CLOSED)', async () => {
    const dir = tmpArgusDir();
    await withPremise(dir);
    await appendLedger(dir, [{ id: 'd1', event: 'settle', outcome: 'held' }], new Date().toISOString());
    const r = await recheck.handler({ argus_dir: dir, id: 'd1', ref: 'P1', finding: 'x again', numeric_value: 1, source: 'url', today_override: TODAY });
    expect(body(r)['error_code']).toBe('DECISION_CLOSED');
  });
});

// ── M2 materiality wiring: 3-valued status + the mirror-clause spine ──────────

describe('argus_recheck — M2 materiality (§4 3-value wiring, mirror clause)', () => {
  async function withRuledPremise(dir: string, rule?: Record<string, unknown>): Promise<void> {
    await sealedDecision(dir);
    await premises.handler({
      argus_dir: dir, id: 'd1', op: 'add', today_override: TODAY,
      premises: [{ text: 'base rate stays at 3.5%', kind: 'premise', external: true, load_bearing: true, source: 'ai', ai_original: 'base rate stays at 3.5%', ...(rule ? { materiality_rule: rule } : {}) }],
    });
  }

  it('material → surface says changed AND auto-attaches the handle (argus_recall)', async () => {
    const dir = tmpArgusDir();
    await withRuledPremise(dir); // no rule → scale-free heuristic
    await recheck.handler({ argus_dir: dir, id: 'd1', ref: 'P1', finding: '3.5%', numeric_value: 3.5, source: 'url', today_override: TODAY });
    const r = await recheck.handler({ argus_dir: dir, id: 'd1', ref: 'P1', finding: '4.2%', numeric_value: 4.2, source: 'url', today_override: TODAY });
    const b = body(r);
    expect((b['data'] as Record<string, unknown>)['materiality']).toBe('material');
    expect((b['data'] as Record<string, unknown>)['drifted']).toBe(true);
    expect(b['next_actions']).toContain('argus_history');
  });

  it('MIRROR CLAUSE: uncertain NEVER auto-attaches argus_recall (no manufactured fork)', async () => {
    const dir = tmpArgusDir();
    // a bare sign flip with zero_meaningful undeclared → uncertain (under-fire)
    await withRuledPremise(dir);
    await recheck.handler({ argus_dir: dir, id: 'd1', ref: 'P1', finding: '+0.5', numeric_value: 0.5, source: 'url', today_override: TODAY });
    const r = await recheck.handler({ argus_dir: dir, id: 'd1', ref: 'P1', finding: '-0.3', numeric_value: -0.3, source: 'url', today_override: TODAY });
    const b = body(r);
    expect((b['data'] as Record<string, unknown>)['materiality']).toBe('uncertain');
    expect((b['data'] as Record<string, unknown>)['drifted']).toBe(false);
    expect(b['next_actions']).not.toContain('argus_recall'); // the spine: no auto-fork
    // M4: finding is Latin/numeric ("-0.3") ⇒ English surface. The spine proxy
    // is the returned-handle phrase in the resolved locale ("your call").
    expect(String(b['surface'])).toContain('your call'); // fact only, handle stays with the user
  });

  it('unchanged stays quiet, no handle', async () => {
    const dir = tmpArgusDir();
    await withRuledPremise(dir);
    await recheck.handler({ argus_dir: dir, id: 'd1', ref: 'P1', finding: '3.50%', numeric_value: 3.5, source: 'url', today_override: TODAY });
    const r = await recheck.handler({ argus_dir: dir, id: 'd1', ref: 'P1', finding: '3.52%', numeric_value: 3.52, source: 'url', today_override: TODAY });
    const b = body(r);
    expect((b['data'] as Record<string, unknown>)['materiality']).toBe('unchanged');
    expect(b['next_actions']).not.toContain('argus_recall');
  });

  it('a declared step rule fires material where the global-10% heuristic would stay silent', async () => {
    const dir = tmpArgusDir();
    await withRuledPremise(dir, { type: 'step', params: { S: 0.25, N: 1 } });
    await recheck.handler({ argus_dir: dir, id: 'd1', ref: 'P1', finding: '3.50%', numeric_value: 3.5, source: 'url', today_override: TODAY });
    // 3.50 → 3.25 is a 7% move (heuristic: silent) but a full policy notch (step: material)
    const r = await recheck.handler({ argus_dir: dir, id: 'd1', ref: 'P1', finding: '3.25%', numeric_value: 3.25, source: 'url', today_override: TODAY });
    expect((body(r)['data'] as Record<string, unknown>)['materiality']).toBe('material');
  });

  it('the materiality_rule survives ledger replay (jsonb-nested, no migration)', async () => {
    const dir = tmpArgusDir();
    await withRuledPremise(dir, { type: 'threshold', params: { line: 4.0, direction: 'below' }, modifiers: { boundary: 'inclusive' } });
    await recheck.handler({ argus_dir: dir, id: 'd1', ref: 'P1', finding: '4.30%', numeric_value: 4.3, source: 'url', today_override: TODAY });
    // crossing below 4.0 fires via the persisted threshold rule
    const r = await recheck.handler({ argus_dir: dir, id: 'd1', ref: 'P1', finding: '3.95%', numeric_value: 3.95, source: 'url', today_override: TODAY });
    expect((body(r)['data'] as Record<string, unknown>)['materiality']).toBe('material');
  });
});

// ── the 6-turn hand simulation (plan v5 §11) as a living integration test ──

describe('journey: open → premises → amend → seal-side recheck → resolve → drift', () => {
  it('threads the whole loop by ordinals only', async () => {
    const dir = tmpArgusDir();

    // T1+T3: seal the decision, add 3 premises (2 facts + 1 open question)
    await sealedDecision(dir, 'dongtan');
    await premises.handler({
      argus_dir: dir, id: 'dongtan', op: 'add', today_override: TODAY,
      premises: [
        aiPremise('base rate stays flat in 2026'),
        aiPremise('housing supply stays high for 3 years', { load_bearing: false }),
        { text: 'rent it out vs live in it', kind: 'open_question', source: 'user' },
      ],
    });

    // T2: user narrows P1 (their wording; provenance survives)
    const t2 = await premises.handler({ argus_dir: dir, id: 'dongtan', op: 'amend', ref: 'P1', action: 'refine', text: 'base rate stays flat within 2026', today_override: TODAY });
    expect(isError(t2)).toBe(false);

    // T4: two weeks later — baseline, then a real hike fires drift
    await recheck.handler({ argus_dir: dir, id: 'dongtan', ref: 'P1', finding: 'base rate 3.50%', numeric_value: 3.5, source: 'url', today_override: '2026-07-16' });
    const t4 = await recheck.handler({ argus_dir: dir, id: 'dongtan', ref: 'P1', finding: 'base rate 3.75% after a 25bp hike', numeric_value: 3.75, source: 'url', source_detail: 'https://bok.example/rate', today_override: '2026-07-30' });
    const t4b = body(t4);
    expect((t4b['data'] as Record<string, unknown>)['drifted']).toBe(false); // 7% move < 10% threshold — quiet, no nag
    const t4c = await recheck.handler({ argus_dir: dir, id: 'dongtan', ref: 'P1', finding: 'base rate 4.25% after successive hikes', numeric_value: 4.25, source: 'url', today_override: '2026-08-20' });
    expect((body(t4c)['data'] as Record<string, unknown>)['drifted']).toBe(true);

    // T5: user closes the open question in their own words
    const t5 = await premises.handler({ argus_dir: dir, id: 'dongtan', op: 'resolve', ref: 'P3', decision: 'we live in it ourselves', today_override: TODAY });
    expect(isError(t5)).toBe(false);

    // The envelope never carries a fork/lean-shaped key anywhere in this journey.
    for (const res of [t2, t4, t4c, t5]) {
      const keys = JSON.stringify(Object.keys(body(res)['data'] as Record<string, unknown>));
      for (const forbidden of ['options', 'poles', 'lean', 'tilt', 'recommendation']) {
        expect(keys).not.toContain(`"${forbidden}"`);
      }
    }
  });
});
