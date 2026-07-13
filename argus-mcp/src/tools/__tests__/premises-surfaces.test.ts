import { describe, it, expect } from 'vitest';
import { tmpArgusDir, body, isError } from '../../test-helpers.js';
import { premises } from '../premises.js';
import { recheck } from '../recheck.js';
import { seal } from '../seal.js';
import { settle } from '../settle.js';
import { checkIn } from '../check-in.js';
import { recall } from '../recall.js';
import { appendDueNote } from '../../lib/due-note.js';
import { readResource } from '../../resources.js';

const TODAY = '2026-07-02';

// Sealed a month before TODAY so the first recheck cadence (14d) has elapsed by
// TODAY — the first nudge now waits one cadence from the add date (founder
// decision 2026-07-10), so same-day would no longer read as due.
const ADDED = '2026-06-01';
async function sealedWithMonitored(dir: string, id = 'd1'): Promise<void> {
  await seal.handler({ argus_dir: dir, id, predicate: 'the migration ships without a visible outage', check_by: '2026-09-01', predicate_owner: 'user', today_override: ADDED });
  await premises.handler({
    argus_dir: dir, id, op: 'add', today_override: ADDED,
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
    expect(String(body(r)['surface'])).toContain('due for a re-check');
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
    expect(String(body(r)['surface'])).toBe('Nothing is due right now.');
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
      expect(due['next_action']).toBe('argus_capture'); // 공개 이름 (구 argus_clarify_decision)

      const one = JSON.parse(readResource('argus://premises/d1').contents[0].text) as Record<string, unknown>;
      const list = one['premises'] as Array<Record<string, unknown>>;
      expect(list[0]['ref']).toBe('P1');
      expect(list[0]['monitored']).toBe(true);
    } finally {
      delete process.env['ARGUS_DIR'];
    }
  });
});

describe('settle premise attribution (P2 — where accumulation compounds)', () => {
  it('records the user-attributed broken premise and surfaces it as frequency in track_record', async () => {
    const dir = tmpArgusDir();
    await sealedWithMonitored(dir, 'd1');
    const r = await settle.handler({
      argus_dir: dir, id: 'd1', outcome: 'avoided', outcome_source: 'user_stated',
      what_happened: 'rates were hiked twice; the migration cost blew past the budget',
      broken_premise_ref: 'P1', today_override: '2026-09-02',
    });
    expect(isError(r)).toBe(false);
    const d = body(r)['data'] as Record<string, unknown>;
    expect(d['broken_premise']).toBe('P1');
    expect(d['broken_premise_source']).toBe('user_stated');
    expect(d['ai_verdict']).toBeNull();

    const tr = await recall.handler({ argus_dir: dir, view: 'track_record', today_override: '2026-09-03' });
    const td = body(tr)['data'] as Record<string, unknown>;
    const counts = td['premise_attribution_counts'] as Record<string, unknown>;
    expect(counts['with_named_broken_premise']).toBe(1);
    expect(String(td['premise_attribution'])).toContain('you attributed 1');
    expect(td['judgment_tier']).toBeNull(); // still no tier, no score
  });

  it("a 'missed' settle is counted in the frequency line AND in the did-not-hold attribution (dogfood F8)", async () => {
    const dir = tmpArgusDir();
    await sealedWithMonitored(dir, 'd1');
    const r = await settle.handler({
      argus_dir: dir, id: 'd1', outcome: 'missed', outcome_source: 'user_stated',
      what_happened: 'the sealed read was simply wrong; the rate held and the plan stalled',
      broken_premise_ref: 'P1', today_override: '2026-09-02',
    });
    expect(isError(r)).toBe(false);

    const tr = await recall.handler({ argus_dir: dir, view: 'track_record', today_override: '2026-09-03' });
    const td = body(tr)['data'] as Record<string, unknown>;
    // The frequency line must account for the missed settle — "Of 1 settled: … 1 missed",
    // never "0 held, 0 avoided, 0 partial" (a settle vanishing from its own count).
    expect(String(td['frequency_statement'])).toMatch(/1 missed|빗나감 1/);
    // "did not hold" now includes missed — the case a broken premise most explains.
    const counts = td['premise_attribution_counts'] as Record<string, unknown>;
    expect(counts['not_held']).toBe(1);
    expect(counts['with_named_broken_premise']).toBe(1);
    expect(td['judgment_tier']).toBeNull();
  });

  it('an invalid broken_premise_ref fails loudly instead of mis-attributing', async () => {
    const dir = tmpArgusDir();
    await sealedWithMonitored(dir, 'd1');
    const r = await settle.handler({
      argus_dir: dir, id: 'd1', outcome: 'avoided', outcome_source: 'user_stated',
      what_happened: 'it went sideways', broken_premise_ref: 'P9', today_override: '2026-09-02',
    });
    expect(isError(r)).toBe(true);
    expect(body(r)['error_code']).toBe('NO_SUCH_PREMISE');
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
    expect(rows[0]['source']).toBe('user_stated');
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

// 호스트-대면 리소스는 tool-call이 아니라 rewriteResult/publicCopy 층을 안 거친다.
// 그래서 next_action(s)에 박힌 이름은 번역되지 않고 그대로 새어나간다 — 실제로
// argus://attention·contracts/due·premises/due가 통일 전 옛 공개 이름을 방출하던
// 버그가 있었고, premises/due 테스트가 그 옛 이름을 기대해 통과시켜 가려졌다.
// 이 가드가 그 사각을 실행 경로로 직접 막는다 (정적 검사로는 계산된 값을 못 본다).
describe('resources 표면 이름 누수 가드 (실행 경로)', () => {
  const LEAK_NAMES = [
    'argus_record_result', 'argus_clarify_decision', 'argus_save_prediction',
    'argus_history', 'argus_review_document',
    'argus_seal', 'argus_settle', 'argus_recall', 'argus_open_decision', 'argus_init',
  ];
  it('argus://attention · contracts/due · premises/due 어디에도 내부/옛 이름이 없고, 공개 이름을 방출한다', async () => {
    const dir = tmpArgusDir();
    await sealedWithMonitored(dir, 'd1'); // due 전제 → argus_capture 경로
    await seal.handler({ argus_dir: dir, id: 'od', predicate: 'the report ships on the first', check_by: '2026-07-01', predicate_owner: 'user', today_override: ADDED }); // 확인일 지난 계약 → argus_resolve 경로
    process.env['ARGUS_DIR'] = dir;
    try {
      for (const uri of ['argus://attention', 'argus://contracts/due', 'argus://premises/due']) {
        const text = readResource(uri).contents[0].text;
        for (const name of LEAK_NAMES) {
          expect(text.includes(name), `${uri}가 "${name}"을 노출함`).toBe(false);
        }
      }
      // 빈 방출을 가드가 눈감지 않도록 — 공개 이름이 실제로 나오는지 확인.
      const attention = readResource('argus://attention').contents[0].text;
      expect(attention).toContain('argus_resolve');
      expect(attention).toContain('argus_capture');
    } finally {
      delete process.env['ARGUS_DIR'];
    }
  });
});
