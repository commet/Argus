import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { sync } from '../sync.js';
import { seal } from '../seal.js';
import { tmpArgusDir } from '../../test-helpers.js';

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
    expect(res.structuredContent?.next_actions).toContain('argus_record_result');
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
    expect(d.receipts[0].settle_path).toBe('argus_record_result (use local_id)');
    expect(d.receipts[1].local_id).toBeNull();
    expect(d.receipts[1].settle_path).toBe('webapp');
    // the surface routes both kinds instead of a blanket "settle with argus_settle" (which broke 100% of settles)
    // (no argus_dir → no config → base 'en' voice; the ko voice is covered below)
    expect(String(res.structuredContent?.surface)).toContain('local_id');
    expect(String(res.structuredContent?.surface)).toContain('web dashboard');
  });

  it('F2: does not suggest argus_settle when every due receipt is web-sealed', async () => {
    process.env.ARGUS_TOKEN = 'argus_pat_x';
    const receipts = [
      { id: 'rcpt_web1', source_title: 'Web only', state: 'sealed', next_check_by: '2020-01-01', due: true, core_question: 'q', open_predicates: [] },
    ];
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ ok: true, receipts }), { status: 200 }));

    const res = await sync.handler({});
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const d = res.structuredContent?.data as any;
    expect(d.due).toBe(1);
    expect(d.local_settleable_due).toBe(0);
    expect(d.receipts[0].settle_path).toBe('webapp');
    expect(res.structuredContent?.next_actions).toEqual(['stop']);
    expect(String(res.structuredContent?.surface)).toContain('web dashboard');
  });

  it('P1-E1: the locale config drives the surface voice (ko config → Korean surface)', async () => {
    process.env.ARGUS_TOKEN = 'argus_pat_x';
    const dir = tmpArgusDir();
    fs.writeFileSync(path.join(dir, 'config.yaml'), 'schema_version: 1\nlocale: ko\n');
    const receipts = [
      { id: 'mcp_a', source_title: 'A', state: 'sealed', next_check_by: '2020-01-01', due: true, core_question: 'q', open_predicates: [] },
    ];
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ ok: true, receipts }), { status: 200 }));
    const res = await sync.handler({ argus_dir: dir });
    expect(String(res.structuredContent?.surface)).toContain('웹 대시보드');
    expect(String(res.structuredContent?.surface)).toContain('local_id');
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

  it('P0-8④: flags settled_in_account when the web settled what the local ledger still holds sealed', async () => {
    // Local ledger: seal 'migrate-db' (no token yet → purely local, no push).
    const dir = tmpArgusDir();
    await seal.handler({
      argus_dir: dir, id: 'migrate-db',
      predicate: 'Cutover downtime is under 5 minutes', check_by: '2027-01-01', predicate_owner: 'user',
    });

    // Account: the same judgment (mcp_ prefix) was settled on the WEB.
    process.env.ARGUS_TOKEN = 'argus_pat_x';
    const receipts = [
      { id: 'mcp_migrate-db', source_title: 'A', state: 'settled', next_check_by: null, due: false, core_question: 'q', open_predicates: [] },
      // still live in both places → no flag
      { id: 'mcp_other', source_title: 'B', state: 'sealed', next_check_by: '2999-01-01', due: false, core_question: 'q', open_predicates: [] },
    ];
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ ok: true, receipts }), { status: 200 }));

    const res = await sync.handler({ argus_dir: dir });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const d = res.structuredContent?.data as any;
    expect(d.receipts[0].settled_in_account).toBe(true);
    expect(d.receipts[1].settled_in_account).toBeUndefined();
    // Surface tells the user; the local ledger is NOT auto-settled (user runs argus_settle).
    // (tmp dir has no config → base 'en' voice)
    expect(String(res.structuredContent?.surface)).toContain('1 result(s) already recorded on the web');
    expect(String(res.structuredContent?.surface)).toContain('argus_record_result');
  });

  it('P0-8④: cross-check degrades silently when no local dir is bound', async () => {
    const origDir = process.env.ARGUS_DIR;
    delete process.env.ARGUS_DIR;
    try {
      process.env.ARGUS_TOKEN = 'argus_pat_x';
      const receipts = [
        { id: 'mcp_x', source_title: 'X', state: 'settled', next_check_by: null, due: false, core_question: 'q', open_predicates: [] },
      ];
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ ok: true, receipts }), { status: 200 }));
      const res = await sync.handler({});
      expect(res.isError).toBeFalsy();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const d = res.structuredContent?.data as any;
      expect(d.receipts[0].settled_in_account).toBeUndefined(); // cannot claim what the local ledger says
    } finally {
      if (origDir === undefined) delete process.env.ARGUS_DIR; else process.env.ARGUS_DIR = origDir;
    }
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
