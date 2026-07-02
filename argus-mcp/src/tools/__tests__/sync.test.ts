import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { sync } from '../sync.js';

const ORIG = process.env.ARGUS_TOKEN;
beforeEach(() => { delete process.env.ARGUS_TOKEN; vi.restoreAllMocks(); });
afterEach(() => { if (ORIG === undefined) delete process.env.ARGUS_TOKEN; else process.env.ARGUS_TOKEN = ORIG; });

describe('argus_sync', () => {
  it('explains how to connect when no token is set', async () => {
    const res = await sync.handler({});
    expect(res.isError).toBe(true);
    expect(res.structuredContent?.error_code).toBe('NOT_CONNECTED');
  });

  it('lists account receipts and flags what is due', async () => {
    process.env.ARGUS_TOKEN = 'argus_pat_x';
    const receipts = [
      { id: 'mcp_a', source_title: 'A', state: 'sealed', next_check_by: '2020-01-01', due: true, core_question: 'q', open_predicates: [{ predicate: 'p', check_by: '2020-01-01' }] },
      { id: 'mcp_b', source_title: 'B', state: 'sealed', next_check_by: '2999-01-01', due: false, core_question: 'q', open_predicates: [] },
    ];
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ ok: true, receipts }), { status: 200 }));
    const res = await sync.handler({});
    expect(res.isError).toBeFalsy();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const d = res.structuredContent?.data as any;
    expect(d.total).toBe(2);
    expect(d.due).toBe(1);
    expect(res.structuredContent?.next_actions).toContain('argus_settle');
  });

  it('P0-8: hands back local_id (mcp_ prefix stripped) and the settle path per receipt', async () => {
    process.env.ARGUS_TOKEN = 'argus_pat_x';
    const receipts = [
      // terminal-sealed: account id carries the mcp_ prefix → settle locally with the bare id
      { id: 'mcp_migrate-db', source_title: 'A', state: 'sealed', next_check_by: '2020-01-01', due: true, core_question: 'q', open_predicates: [] },
      // web-sealed: no prefix → settles in the web dashboard, never via argus_settle
      { id: 'rcpt_web1', source_title: 'B', state: 'sealed', next_check_by: '2020-01-02', due: true, core_question: 'q', open_predicates: [] },
    ];
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ ok: true, receipts }), { status: 200 }));
    const res = await sync.handler({});
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const d = res.structuredContent?.data as any;
    expect(d.receipts[0].local_id).toBe('migrate-db');
    expect(d.receipts[0].settle_path).toBe('argus_settle (use local_id)');
    expect(d.receipts[1].local_id).toBeNull();
    expect(d.receipts[1].settle_path).toBe('webapp');
    // the surface routes both kinds instead of "정산은 argus_settle로" (which broke 100% of settles)
    expect(String(res.structuredContent?.surface)).toContain('local_id');
    expect(String(res.structuredContent?.surface)).toContain('웹 대시보드');
  });

  it('limits the listing and reports has_more when the account has more', async () => {
    process.env.ARGUS_TOKEN = 'argus_pat_x';
    const many = Array.from({ length: 5 }, (_, i) => ({ id: `r${i}`, source_title: `T${i}`, state: 'sealed', next_check_by: null, due: false, core_question: '', open_predicates: [] }));
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ ok: true, receipts: many }), { status: 200 }));
    const res = await sync.handler({ limit: 2 });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const d = res.structuredContent?.data as any;
    expect(d.count).toBe(2);
    expect(d.total).toBe(5);
    expect(d.has_more).toBe(true);
    expect(d.truncation_note).toBeTruthy();
  });

  it('due_only filters to just the due receipts', async () => {
    process.env.ARGUS_TOKEN = 'argus_pat_x';
    const receipts = [
      { id: 'a', source_title: 'A', state: 'sealed', next_check_by: '2020-01-01', due: true, core_question: '', open_predicates: [] },
      { id: 'b', source_title: 'B', state: 'sealed', next_check_by: '2999-01-01', due: false, core_question: '', open_predicates: [] },
    ];
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ ok: true, receipts }), { status: 200 }));
    const res = await sync.handler({ due_only: true });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const d = res.structuredContent?.data as any;
    expect(d.receipts).toHaveLength(1);
    expect(d.receipts[0].id).toBe('a');
  });
});
