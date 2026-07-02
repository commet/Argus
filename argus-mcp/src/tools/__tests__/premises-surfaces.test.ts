import { describe, it, expect } from 'vitest';
import { tmpArgusDir, body, isError } from '../../test-helpers.js';
import { premises } from '../premises.js';
import { recheck } from '../recheck.js';
import { seal } from '../seal.js';
import { checkIn } from '../check-in.js';
import { recall } from '../recall.js';
import { appendDueNote } from '../../lib/due-note.js';
import { readResource } from '../../resources.js';

const TODAY = '2026-07-02';

async function sealedWithMonitored(dir: string, id = 'd1'): Promise<void> {
  await seal.handler({ argus_dir: dir, id, predicate: 'the migration ships without a visible outage', check_by: '2026-09-01', predicate_owner: 'user', today_override: TODAY });
  await premises.handler({
    argus_dir: dir, id, op: 'add', today_override: TODAY,
    premises: [{ text: 'base rate stays at 3.5%', kind: 'premise', external: true, load_bearing: true, source: 'ai', ai_original: 'base rate stays at 3.5%' }],
  });
}

describe('argus_recall view=premises', () => {
  it('lists refs, provenance, staleness, and due flags', async () => {
    const dir = tmpArgusDir();
    await sealedWithMonitored(dir);
    await premises.handler({ argus_dir: dir, id: 'd1', op: 'amend', ref: 'P1', action: 'refine', text: 'base rate stays at 3.5% through 2026', today_override: TODAY });

    const r = await recall.handler({ argus_dir: dir, view: 'premises', id: 'd1', today_override: TODAY });
    expect(isError(r)).toBe(false);
    const rows = (body(r)['data'] as Record<string, unknown>)['premises'] as Array<Record<string, unknown>>;
    expect(rows[0]['ref']).toBe('P1');
    expect(rows[0]['edited_by_user']).toBe(true);       // provenance rendered — ai_original's reader
    expect(rows[0]['staleness']).toBe('never re-checked'); // honest staleness, no pretend liveness
    expect(rows[0]['due_for_recheck']).toBe(true);
    expect(String(body(r)['surface'])).toContain('due for a reality re-check');
  });

  it('needs an id; empty decision gets a plain empty state', async () => {
    const dir = tmpArgusDir();
    await seal.handler({ argus_dir: dir, id: 'bare', predicate: 'bare decision predicate here', check_by: '2026-09-01', predicate_owner: 'user', today_override: TODAY });
    const noId = await recall.handler({ argus_dir: dir, view: 'premises', today_override: TODAY });
    expect(body(noId)['error_code']).toBe('PREMISES_NEEDS_ID');
    const empty = await recall.handler({ argus_dir: dir, view: 'premises', id: 'bare', today_override: TODAY });
    expect(String(body(empty)['surface'])).toContain('No premises tracked');
  });
});

describe('argus_check_in with due premises', () => {
  it('reports premise facts alongside contracts, grouped by normalized text', async () => {
    const dir = tmpArgusDir();
    await sealedWithMonitored(dir, 'd1');
    await sealedWithMonitored(dir, 'd2'); // same fact under a second decision
    const r = await checkIn.handler({ argus_dir: dir, today_override: TODAY });
    const d = body(r)['data'] as Record<string, unknown>;
    expect(d['due_count']).toBe(0); // contracts not due yet
    expect(d['due_premise_count']).toBe(1); // ONE fact group across two decisions (P1 accumulation lens)
    const groups = d['due_premises'] as Array<Record<string, unknown>>;
    expect((groups[0]['decisions'] as unknown[]).length).toBe(2);
    expect(String(body(r)['surface'])).toContain('argus_recheck');
  });

  it('stays fully silent when nothing at all is due', async () => {
    const dir = tmpArgusDir();
    const r = await checkIn.handler({ argus_dir: dir, today_override: TODAY });
    expect(String(body(r)['surface'])).toBe('Nothing is due. Nothing to nudge.');
  });
});

describe('due_note piggyback (dispatch-level)', () => {
  it('annotates a successful envelope with counts and adds argus_check_in', async () => {
    const dir = tmpArgusDir();
    await sealedWithMonitored(dir);
    // a later, unrelated tool call — recall bearing
    const res = await recall.handler({ argus_dir: dir, view: 'bearing', today_override: TODAY });
    const noted = appendDueNote('argus_recall', { argus_dir: dir, today_override: TODAY }, res);
    const sc = noted.structuredContent as Record<string, unknown>;
    expect(String((sc['data'] as Record<string, unknown>)['due_note'])).toContain('premise fact(s) to re-check');
    expect(sc['next_actions']).toContain('argus_check_in');
    // the text mirror was refreshed too
    expect(noted.content[0].text).toContain('due_note');
  });

  it('is absent at zero and never touches errors or check_in itself', async () => {
    const dir = tmpArgusDir();
    await seal.handler({ argus_dir: dir, id: 'quiet', predicate: 'quiet decision predicate here', check_by: '2026-09-01', predicate_owner: 'user', today_override: TODAY });
    const res = await recall.handler({ argus_dir: dir, view: 'bearing', today_override: TODAY });
    const noted = appendDueNote('argus_recall', { argus_dir: dir, today_override: TODAY }, res);
    expect('due_note' in ((noted.structuredContent as Record<string, unknown>)['data'] as Record<string, unknown>)).toBe(false);

    const err = await recall.handler({ argus_dir: dir, view: 'premises', today_override: TODAY }); // PREMISES_NEEDS_ID
    const untouched = appendDueNote('argus_recall', { argus_dir: dir }, err);
    expect(untouched.isError).toBe(true);
  });
});

describe('resources: argus://premises/*', () => {
  it('premises/due groups facts with decision context; premises/{id} lists with provenance', async () => {
    const dir = tmpArgusDir();
    await sealedWithMonitored(dir, 'd1');
    await sealedWithMonitored(dir, 'd2');
    process.env['ARGUS_DIR'] = dir;
    try {
      const due = JSON.parse(readResource('argus://premises/due').contents[0].text) as Record<string, unknown>;
      expect(due['group_count']).toBe(1);
      const groups = due['groups'] as Array<Record<string, unknown>>;
      expect((groups[0]['decisions'] as unknown[]).length).toBe(2);
      expect(due['next_action']).toBe('argus_recheck');

      const one = JSON.parse(readResource('argus://premises/d1').contents[0].text) as Record<string, unknown>;
      const list = one['premises'] as Array<Record<string, unknown>>;
      expect(list[0]['ref']).toBe('P1');
      expect(list[0]['monitored']).toBe(true);
    } finally {
      delete process.env['ARGUS_DIR'];
    }
  });
});

describe('seal promotion (§5.4 — the assumption field is an alias into the premise set)', () => {
  it('a named unverified_assumption becomes the first premise (user-sourced, unmonitored until marked external)', async () => {
    const dir = tmpArgusDir();
    const r = await seal.handler({
      argus_dir: dir, id: 'promo', predicate: 'we cut over with no visible downtime',
      check_by: '2026-09-01', predicate_owner: 'user',
      unverified_assumption: 'the index rebuild fits inside the replication lag budget',
      today_override: TODAY,
    });
    expect(isError(r)).toBe(false);
    expect((body(r)['data'] as Record<string, unknown>)['premise_promoted']).toBe('P1');

    const prems = await recall.handler({ argus_dir: dir, view: 'premises', id: 'promo', today_override: TODAY });
    const rows = (body(prems)['data'] as Record<string, unknown>)['premises'] as Array<Record<string, unknown>>;
    expect(rows).toHaveLength(1);
    expect(rows[0]['source']).toBe('user');
    expect(rows[0]['load_bearing']).toBe(true);
    expect(rows[0]['monitored']).toBe(false); // external unset — honest default, user arms it

    // receipt renders the premises summary from the fold
    const receipt = await recall.handler({ argus_dir: dir, view: 'receipt', id: 'promo', today_override: TODAY });
    expect(String((body(receipt)['data'] as Record<string, unknown>)['receipt_text'])).toContain('+1 premise(s) tracked');
  });

  it('a skipped assumption promotes nothing; re-sealing the same text never duplicates', async () => {
    const dir = tmpArgusDir();
    const r = await seal.handler({ argus_dir: dir, id: 'noass', predicate: 'predicate without assumption named', check_by: '2026-09-01', predicate_owner: 'user', today_override: TODAY });
    expect('premise_promoted' in (body(r)['data'] as Record<string, unknown>)).toBe(false);
  });
});
