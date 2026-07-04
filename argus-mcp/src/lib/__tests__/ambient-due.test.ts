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
import { groupDuePremises, duePremises } from '../premises.js';

const TODAY = '2026-07-02';
const LATER = '2026-08-16';

/** Seal a decision with one monitored (external + load_bearing) premise so it
 *  becomes due for a reality re-check. */
async function sealedWithMonitored(dir: string, id = 'd1', checkBy = '2026-08-01'): Promise<void> {
  await seal.handler({ argus_dir: dir, id, predicate: 'we ship under five minutes downtime', check_by: checkBy, predicate_owner: 'user', today_override: TODAY });
  await premises.handler({
    argus_dir: dir, id, op: 'add', today_override: TODAY,
    premises: [{ text: 'base rate stays at 3.5 percent', kind: 'premise', external: true, load_bearing: true, source: 'ai', ai_original: 'base rate stays at 3.5 percent' }],
  });
}

describe('ambient-due: single source of due counts (M1 §1.3)', () => {
  beforeEach(() => resetAmbientSession());

  it('is silent (empty line, no annotation) when nothing is due', async () => {
    const dir = tmpArgusDir();
    // a sealed decision that is NOT due, and no monitored premise
    await seal.handler({ argus_dir: dir, id: 'quiet', predicate: 'quiet decision predicate here', check_by: '2026-12-01', predicate_owner: 'user', today_override: TODAY });
    const due = ambientDue(dir, TODAY);
    expect(due.contractsDue).toBe(0);
    expect(due.premiseFactsDue).toBe(0);

    const res = await recall.handler({ argus_dir: dir, view: 'bearing', today_override: TODAY });
    const before = String(body(res)['surface']);
    const noted = appendDueNote('argus_recall', { argus_dir: dir, today_override: TODAY }, res);
    const sc = noted.structuredContent as Record<string, unknown>;
    expect(String(sc['surface'])).toBe(before); // surface untouched — silence
    expect('due_note' in ((sc['data'] as Record<string, unknown>))).toBe(false);
  });

  it('renders exactly ONE ambient fact line at the END of the surface when due', async () => {
    const dir = tmpArgusDir();
    await sealedWithMonitored(dir);
    const due = ambientDue(dir, TODAY);
    expect(due.premiseFactsDue).toBe(1);

    const res = await recall.handler({ argus_dir: dir, view: 'bearing', today_override: TODAY });
    const original = String(body(res)['surface']);
    const noted = appendDueNote('argus_recall', { argus_dir: dir, today_override: TODAY }, res);
    const surface = String((noted.structuredContent as Record<string, unknown>)['surface']);

    // appended (starts with the tool's own surface, then the ambient tail)
    expect(surface.startsWith(original)).toBe(true);
    expect(surface.length).toBeGreaterThan(original.length);
    // one line, a fact + the check_in handle, never a directive
    expect(surface).toContain('argus_check_in');
    expect(surface).toContain('re-check');
    expect(surface).not.toMatch(/you should|you must|revisit this decision/i);
  });

  it("matches check_in's counts exactly (single source — no drift)", async () => {
    const dir = tmpArgusDir();
    await sealedWithMonitored(dir, 'd1');
    await sealedWithMonitored(dir, 'd2', '2026-06-01'); // a second, past-due contract

    const ci = body(await checkIn.handler({ argus_dir: dir, today_override: LATER }))['data'] as Record<string, unknown>;
    const shared = ambientDue(dir, LATER);
    expect(shared.premiseFactsDue).toBe(ci['due_premise_count']);
    // both contracts are past check-by by LATER; the ambient contract count is
    // the ledger.overdue set, which check_in's due_count includes.
    expect(shared.contractsDue).toBeGreaterThan(0);
    expect(ci['due_count']).toBeGreaterThanOrEqual(shared.contractsDue);
    // the grouping primitive is literally shared
    const state = replayLedger(dir, LATER);
    expect(groupDuePremises(duePremises(state)).length).toBe(shared.premiseFactsDue);
  });

  it('fires the surface line at most ONCE per session; the count channel persists', async () => {
    const dir = tmpArgusDir();
    await sealedWithMonitored(dir);

    const r1 = await recall.handler({ argus_dir: dir, view: 'bearing', today_override: TODAY });
    const s1 = String(body(r1)['surface']);
    const n1 = appendDueNote('argus_recall', { argus_dir: dir, today_override: TODAY }, r1);
    expect(String((n1.structuredContent as Record<string, unknown>)['surface']).length).toBeGreaterThan(s1.length);

    const r2 = await recall.handler({ argus_dir: dir, view: 'bearing', today_override: TODAY });
    const s2 = String(body(r2)['surface']);
    const n2 = appendDueNote('argus_recall', { argus_dir: dir, today_override: TODAY }, r2);
    const sc2 = n2.structuredContent as Record<string, unknown>;
    // second call: surface line suppressed (session-once) …
    expect(String(sc2['surface'])).toBe(s2);
    // … but the machine count channel still annotates
    expect('due_note' in (sc2['data'] as Record<string, unknown>)).toBe(true);
  });

  it('respects ambient_mute: true (surface line silenced, count channel kept)', async () => {
    const dir = tmpArgusDir();
    await sealedWithMonitored(dir);
    fs.writeFileSync(configPath(dir), 'schema_version: 5\nlocale: en\nambient_mute: true\n', 'utf8');

    const res = await recall.handler({ argus_dir: dir, view: 'bearing', today_override: TODAY });
    const before = String(body(res)['surface']);
    const noted = appendDueNote('argus_recall', { argus_dir: dir, today_override: TODAY }, res);
    const sc = noted.structuredContent as Record<string, unknown>;
    expect(String(sc['surface'])).toBe(before); // muted
    expect('due_note' in (sc['data'] as Record<string, unknown>)).toBe(true); // count still there
  });

  it('renders the ambient line in Korean when the config locale is ko', async () => {
    const dir = tmpArgusDir();
    await sealedWithMonitored(dir);
    fs.writeFileSync(configPath(dir), 'schema_version: 5\nlocale: ko\n', 'utf8');

    const res = await recall.handler({ argus_dir: dir, view: 'bearing', today_override: TODAY });
    const noted = appendDueNote('argus_recall', { argus_dir: dir, today_override: TODAY }, res);
    const surface = String((noted.structuredContent as Record<string, unknown>)['surface']);
    expect(surface).toContain('그나저나');
    expect(surface).toContain('argus_check_in');
  });

  it('never touches errors or the argus_check_in tool itself', async () => {
    const dir = tmpArgusDir();
    await sealedWithMonitored(dir);
    // check_in is skipped (it IS the due surface)
    const ci = await checkIn.handler({ argus_dir: dir, today_override: TODAY });
    const ciSurface = String(body(ci)['surface']);
    const ciNoted = appendDueNote('argus_check_in', { argus_dir: dir, today_override: TODAY }, ci);
    expect(String((ciNoted.structuredContent as Record<string, unknown>)['surface'])).toBe(ciSurface);

    // an error result is returned untouched
    const err = await recall.handler({ argus_dir: dir, view: 'premises', today_override: TODAY }); // PREMISES_NEEDS_ID
    const untouched = appendDueNote('argus_recall', { argus_dir: dir }, err);
    expect(untouched.isError).toBe(true);
  });
});
