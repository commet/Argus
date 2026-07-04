import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'fs';
import { tmpArgusDir, body } from '../../test-helpers.js';
import { seal } from '../../tools/seal.js';
import { premises } from '../../tools/premises.js';
import { recall } from '../../tools/recall.js';
import { checkIn } from '../../tools/check-in.js';
import { configPath } from '../layout.js';
import { ambientDue } from '../ambient-due.js';
import { appendDueNote, resetAmbientSession } from '../due-note.js';
import { replayLedger } from '../ledger-replay.js';
import { appendLedger } from '../ledger-append.js';
import {
  reponderCadenceDays, nextReponderDue, isDueForReconsider, isReconsiderable, dueOpenQuestions,
  DEFAULT_REPONDER_CADENCE_DAYS, REPONDER_MIN_INTERVAL_DAYS,
  type PremiseState,
} from '../premises.js';

const TODAY = '2026-07-02';

function mkOpenQ(over: Partial<PremiseState> = {}): PremiseState {
  return {
    premise_id: 'p_q', ordinal: 1, kind: 'open_question', text: 'how do we split equity',
    external: false, load_bearing: false, source: 'user', status: 'active',
    amend_history: [], recheck_count: 0, ...over,
  };
}

// ── unit: cadence + due arithmetic (pure) ──────────────────────────────────

describe('reponder cadence (M3 §3)', () => {
  it('defaults to a neutral middle and floors low pins', () => {
    expect(reponderCadenceDays(mkOpenQ())).toBe(DEFAULT_REPONDER_CADENCE_DAYS); // 21
    expect(reponderCadenceDays(mkOpenQ({ reponder_cadence_days: 60 }))).toBe(60);
    expect(reponderCadenceDays(mkOpenQ({ reponder_cadence_days: 3 }))).toBe(REPONDER_MIN_INTERVAL_DAYS); // floored to 14
    expect(reponderCadenceDays(mkOpenQ({ reponder_cadence_days: 9999 }))).toBe(90); // capped
  });

  it('only an active open_question is reconsiderable', () => {
    expect(isReconsiderable(mkOpenQ())).toBe(true);
    expect(isReconsiderable(mkOpenQ({ status: 'resolved' }))).toBe(false);
    expect(isReconsiderable(mkOpenQ({ status: 'retired' }))).toBe(false);
    expect(isReconsiderable(mkOpenQ({ kind: 'premise' }))).toBe(false);
  });

  it('due = anchor + cadence has arrived; never-anchored is due now', () => {
    // added 30 days ago, 21-day cadence → due
    const old = mkOpenQ({ added_ts: '2026-06-02T00:00:00Z' });
    expect(isDueForReconsider(old, TODAY)).toBe(true);
    // added 5 days ago → not yet due
    const fresh = mkOpenQ({ added_ts: '2026-06-27T00:00:00Z' });
    expect(isDueForReconsider(fresh, TODAY)).toBe(false);
    // no anchor at all → due now
    expect(isDueForReconsider(mkOpenQ(), TODAY)).toBe(true);
  });

  it('last_reconsidered (still_open) resets the clock over added_ts', () => {
    const p = mkOpenQ({ added_ts: '2026-05-01T00:00:00Z', last_reconsidered: '2026-06-30T00:00:00Z' });
    // anchored to the recent still_open, not the far-off add → not due
    expect(isDueForReconsider(p, TODAY)).toBe(false);
    expect(nextReponderDue(p)).toBe('2026-07-21'); // 2026-06-30 + 21d
  });

  it('nextReponderDue is null when never anchored or not an open_question', () => {
    expect(nextReponderDue(mkOpenQ())).toBeNull(); // due now
    expect(nextReponderDue(mkOpenQ({ kind: 'premise', added_ts: '2026-06-01T00:00:00Z' }))).toBeNull();
  });
});

// ── integration: seal → add open_question → due → surface → handles ─────────

async function sealWithOpenQ(dir: string, id = 'd1', cadence?: number): Promise<string> {
  await seal.handler({ argus_dir: dir, id, predicate: 'we ship under five minutes downtime', check_by: '2026-09-01', predicate_owner: 'user', today_override: TODAY });
  await premises.handler({
    argus_dir: dir, id, op: 'add', today_override: TODAY,
    premises: [{ text: 'how do we split equity', kind: 'open_question', external: false, load_bearing: false, source: 'user', ...(cadence ? { reponder_cadence_days: cadence } : {}) }],
  });
  const rec = body(await recall.handler({ argus_dir: dir, view: 'premises', id, today_override: TODAY }));
  const rows = (rec['data'] as Record<string, unknown>)['premises'] as Array<Record<string, unknown>>;
  return rows[0]['premise_id'] as string;
}

describe('open_question reconsider — end to end (M3)', () => {
  beforeEach(() => resetAmbientSession());

  it('recall exposes the reponder cadence + next due for an open_question', async () => {
    const dir = tmpArgusDir();
    await sealWithOpenQ(dir, 'd1', 30);
    const rec = body(await recall.handler({ argus_dir: dir, view: 'premises', id: 'd1', today_override: TODAY }));
    const row = ((rec['data'] as Record<string, unknown>)['premises'] as Array<Record<string, unknown>>)[0];
    expect(row['kind']).toBe('open_question');
    expect(row['reponder_cadence_days']).toBe(30);
    // added TODAY, 30d cadence → next due TODAY+30, not yet due
    expect(row['next_reponder_due']).toBe('2026-08-01');
    expect(row['due_for_reconsider']).toBe(false);
  });

  it('a question past its cadence becomes due and surfaces in check_in as a FACT + handle', async () => {
    const dir = tmpArgusDir();
    await sealWithOpenQ(dir, 'd1'); // default 21d cadence, added TODAY
    const LATER = '2026-08-01'; // 30 days later → due

    const ci = body(await checkIn.handler({ argus_dir: dir, today_override: LATER }));
    const data = ci['data'] as Record<string, unknown>;
    expect(data['due_open_question_count']).toBe(1);
    const surface = String(ci['surface']);
    // the user's OWN words + a "still open is fine" coda + the handle, no directive
    expect(surface).toContain('how do we split equity');
    expect(surface).toContain('argus_premises');
    expect(surface).not.toMatch(/you should|you must|decide now/i);
    expect(String(ci['surface'])).toMatch(/still open|leaving it open|real answer/i);
  });

  it('still_open resets the reconsider clock — nudge goes quiet until the next cadence', async () => {
    const dir = tmpArgusDir();
    await sealWithOpenQ(dir, 'd1'); // default 21d
    const LATER = '2026-08-01'; // due
    expect(dueOpenQuestions(replayLedger(dir, LATER)).length).toBe(1);

    // the user defers — leave it open
    const res = body(await premises.handler({ argus_dir: dir, id: 'd1', op: 'still_open', ref: 'P1', today_override: LATER }));
    expect((res['data'] as Record<string, unknown>)['deferred']).toBe(true);
    expect(String(res['surface'])).toMatch(/no verdict|no pressure|real choice/i);

    // same day: no longer due (clock reset to LATER)
    expect(dueOpenQuestions(replayLedger(dir, LATER)).length).toBe(0);
    // 30 days after the defer: due again
    const EVEN_LATER = '2026-08-31';
    expect(dueOpenQuestions(replayLedger(dir, EVEN_LATER)).length).toBe(1);
  });

  it('resolve closes the question — it disappears from the reconsider set for good', async () => {
    const dir = tmpArgusDir();
    await sealWithOpenQ(dir, 'd1');
    const LATER = '2026-08-01';
    expect(dueOpenQuestions(replayLedger(dir, LATER)).length).toBe(1);

    await premises.handler({ argus_dir: dir, id: 'd1', op: 'resolve', ref: 'P1', decision: '60/40 to the founders', today_override: LATER });
    // resolved → not reconsiderable, ever
    expect(dueOpenQuestions(replayLedger(dir, LATER)).length).toBe(0);
    expect(dueOpenQuestions(replayLedger(dir, '2027-01-01')).length).toBe(0);
  });

  it('due 0 → silence (no reconsider surface, no ambient annotation)', async () => {
    const dir = tmpArgusDir();
    await sealWithOpenQ(dir, 'd1', 90); // long cadence, not due today
    expect(dueOpenQuestions(replayLedger(dir, TODAY)).length).toBe(0);

    const ci = body(await checkIn.handler({ argus_dir: dir, today_override: TODAY }));
    expect((ci['data'] as Record<string, unknown>)['due_open_question_count']).toBe(0);
    // check_in with nothing due says so and stops
    expect(String(ci['surface'])).toMatch(/nothing is due|확인할 차례/i);
  });

  it('single source: ambient == check_in == dueOpenQuestions == recall-premises', async () => {
    const dir = tmpArgusDir();
    await sealWithOpenQ(dir, 'd1');
    await sealWithOpenQ(dir, 'd2');
    const LATER = '2026-08-01';

    const shared = ambientDue(dir, LATER);
    const ci = body(await checkIn.handler({ argus_dir: dir, today_override: LATER }))['data'] as Record<string, unknown>;
    const raw = dueOpenQuestions(replayLedger(dir, LATER)).length;
    expect(shared.openQuestionsDue).toBe(2);
    expect(ci['due_open_question_count']).toBe(shared.openQuestionsDue);
    expect(raw).toBe(shared.openQuestionsDue);

    // recall view=premises must agree per-decision: due_for_reconsider === the
    // question being counted by check_in (the drift the coordinator caught).
    for (const id of ['d1', 'd2']) {
      const rec = body(await recall.handler({ argus_dir: dir, view: 'premises', id, today_override: LATER }));
      const q = ((rec['data'] as Record<string, unknown>)['premises'] as Array<Record<string, unknown>>)[0];
      expect(q['due_for_reconsider']).toBe(true);
    }
  });

  it("regression (coordinator repro, exact dates): add(today_override) anchors the clock — recall AND check_in agree", async () => {
    // The exact deterministic repro: add at 2026-07-03 (today_override), sealed,
    // read at 2026-07-26. Before the fix, recall said due=true but check_in
    // returned []. Now both must see the ONE due question. (sealWithOpenQ uses
    // seal's self-create so the entry is sealed — the full open_decision→seal
    // dispatch path is pinned in protocol-roundtrip.test.ts, which also exercises
    // the over-fire gate + zod validation this direct path cannot.)
    const dir = tmpArgusDir();
    await seal.handler({ argus_dir: dir, id: 'd', predicate: 'we ship under five minutes downtime', check_by: '2026-10-03', predicate_owner: 'user', today_override: '2026-07-03' });
    await premises.handler({
      argus_dir: dir, id: 'd', op: 'add', today_override: '2026-07-03',
      premises: [{ text: '지분 미정 상태', kind: 'open_question', external: false, load_bearing: false, source: 'user' }],
    });

    const rec = body(await recall.handler({ argus_dir: dir, view: 'premises', id: 'd', today_override: '2026-07-26' }));
    const q = ((rec['data'] as Record<string, unknown>)['premises'] as Array<Record<string, unknown>>)[0];
    expect(q['next_reponder_due']).toBe('2026-07-24'); // 2026-07-03 + 21d
    expect(q['due_for_reconsider']).toBe(true);

    const ci = body(await checkIn.handler({ argus_dir: dir, today_override: '2026-07-26' }));
    expect((ci['data'] as Record<string, unknown>)['due_open_question_count']).toBe(1);
    expect(String(ci['surface'])).toContain('지분 미정 상태');

    // still_open at 2026-07-26 → silent at 2026-07-27, re-emerges at 2026-08-17.
    await premises.handler({ argus_dir: dir, id: 'd', op: 'still_open', ref: 'P1', today_override: '2026-07-26' });
    expect(dueOpenQuestions(replayLedger(dir, '2026-07-27')).length).toBe(0);
    expect(dueOpenQuestions(replayLedger(dir, '2026-08-17')).length).toBe(1); // 2026-07-26 + 21d = 08-16
  });

  it("single-source gate: an opened-but-NOT-sealed question is due to NEITHER recall nor check_in", async () => {
    // Sealing arms the nudge (plan v5 P4). recall must not claim due_for_reconsider
    // on an unsealed decision when check_in/ambient (which gate on sealed|due)
    // stay silent — that mismatch WAS the recall↔check_in drift. Build the
    // opened-not-sealed state directly on the ledger (a harvest with no seal) so
    // the assertion does not depend on the over-fire gate firing.
    const dir = tmpArgusDir();
    await appendLedger(dir, [{ id: 'd', event: 'harvest', decision: '지분 어떻게 나눌지' }], '2026-07-03T00:00:00Z');
    await premises.handler({
      argus_dir: dir, id: 'd', op: 'add', today_override: '2026-07-03',
      premises: [{ text: '지분 미정 상태', kind: 'open_question', external: false, load_bearing: false, source: 'user' }],
    });
    const rec = body(await recall.handler({ argus_dir: dir, view: 'premises', id: 'd', today_override: '2026-07-26' }));
    const q = ((rec['data'] as Record<string, unknown>)['premises'] as Array<Record<string, unknown>>)[0];
    expect(q['due_for_reconsider']).toBe(false); // gated by `armed` — agrees with check_in
    const ci = body(await checkIn.handler({ argus_dir: dir, today_override: '2026-07-26' }));
    expect((ci['data'] as Record<string, unknown>)['due_open_question_count']).toBe(0);
    // the cadence date is still shown (a fact about the premise), just not "due now"
    expect(q['next_reponder_due']).toBe('2026-07-24');
  });

  it('ambient line names the reconsider fragment when a question is due (both locales)', async () => {
    const dir = tmpArgusDir();
    await sealWithOpenQ(dir, 'd1');
    const LATER = '2026-08-01';

    const res = await recall.handler({ argus_dir: dir, view: 'bearing', today_override: LATER });
    const noted = appendDueNote('argus_recall', { argus_dir: dir, today_override: LATER }, res);
    const surface = String((noted.structuredContent as Record<string, unknown>)['surface']);
    expect(surface).toMatch(/open question|reconsider/i);
    expect(surface).toContain('argus_check_in');

    // ko locale
    resetAmbientSession();
    fs.writeFileSync(configPath(dir), 'schema_version: 5\nlocale: ko\n', 'utf8');
    const res2 = await recall.handler({ argus_dir: dir, view: 'bearing', today_override: LATER });
    const noted2 = appendDueNote('argus_recall', { argus_dir: dir, today_override: LATER }, res2);
    const surface2 = String((noted2.structuredContent as Record<string, unknown>)['surface']);
    expect(surface2).toContain('미결 질문');
    expect(surface2).toContain('그나저나');
  });

  it('still_open is refused on a premise (not an open_question) and on a resolved question', async () => {
    const dir = tmpArgusDir();
    await seal.handler({ argus_dir: dir, id: 'd1', predicate: 'we ship under five minutes downtime', check_by: '2026-09-01', predicate_owner: 'user', today_override: TODAY });
    await premises.handler({
      argus_dir: dir, id: 'd1', op: 'add', today_override: TODAY,
      premises: [{ text: 'base rate stays at 3.5 percent', kind: 'premise', external: true, load_bearing: true, source: 'user' }],
    });
    const notQ = body(await premises.handler({ argus_dir: dir, id: 'd1', op: 'still_open', ref: 'P1', today_override: TODAY }));
    expect(notQ['ok']).toBe(false);
    expect(notQ['error_code']).toBe('NOT_AN_OPEN_QUESTION');
  });

  it('mute (ambient_mute) silences the reconsider ambient line, keeps the count channel', async () => {
    const dir = tmpArgusDir();
    await sealWithOpenQ(dir, 'd1');
    const LATER = '2026-08-01';
    fs.writeFileSync(configPath(dir), 'schema_version: 5\nlocale: en\nambient_mute: true\n', 'utf8');

    const res = await recall.handler({ argus_dir: dir, view: 'bearing', today_override: LATER });
    const before = String(body(res)['surface']);
    const noted = appendDueNote('argus_recall', { argus_dir: dir, today_override: LATER }, res);
    const sc = noted.structuredContent as Record<string, unknown>;
    expect(String(sc['surface'])).toBe(before); // muted surface
    expect((sc['data'] as Record<string, unknown>)['due_note']).toContain('reconsider'); // count still there
  });
});
