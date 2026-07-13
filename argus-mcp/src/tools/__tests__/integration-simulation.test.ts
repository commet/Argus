import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { review } from '../review.js';
import { seal } from '../seal.js';
import { settle } from '../settle.js';
import { tmpArgusDir, body, isError } from '../../test-helpers.js';

const MEMO = `# 온보딩 리빌드 전략\n\n## 문제\nretention이 낮다\n\n## 제안\n3단계로 리빌드한다\n\n## 근거\n- 경쟁사도 3단계\n- 인터뷰 피드백`;
const DECK = `# 시장\n- TAM 10조\n\n---\n\n# Ask\n- 20억`;

const ORIG = process.env.ARGUS_TOKEN;
beforeEach(() => { delete process.env.ARGUS_TOKEN; vi.restoreAllMocks(); });
afterEach(() => { if (ORIG === undefined) delete process.env.ARGUS_TOKEN; else process.env.ARGUS_TOKEN = ORIG; });

describe('MCP simulation — argus_review across shapes', () => {
  it('memo: routes base lenses, points at seal, no verdict', async () => {
    const res = await review.handler({ text: MEMO, source_kind: 'markdown', concerns: ['evidence'] });
    expect(isError(res)).toBe(false);
    const d = body(res).data as Record<string, unknown>;
    const lenses = (d.lenses as { id: string }[]).map((l) => l.id);
    expect(lenses).toContain('claim_evidence');
    expect(lenses).toContain('human_judgment');
    expect((body(res).next_actions as string[])).toContain('argus_save_prediction');
    expect(String(body(res).surface)).not.toMatch(/진행하세요|틀렸|추천/);
  });

  it('deck text: routes the deck-narrative lens', async () => {
    const res = await review.handler({ text: DECK, source_kind: 'pptx' });
    const d = body(res).data as Record<string, unknown>;
    expect((d.lenses as { id: string }[]).map((l) => l.id)).toContain('deck_narrative');
  });

  it('empty + unreadable binary degrade honestly instead of faking', async () => {
    expect(body(await review.handler({ text: '' })).error_code).toBe('EMPTY');
    // Binaries are parsed now; an unreadable path INSIDE the readable root fails
    // honestly (never a fake review). A path outside every opted-in project is
    // refused earlier by the read boundary — a different, also-honest refusal.
    expect(body(await review.handler({ file_path: `${process.cwd()}/deck.pptx` })).error_code).toBe('READ_FAILED');
    expect(body(await review.handler({ file_path: '/x/deck.pptx' })).error_code).toBe('PATH_NOT_ALLOWED');
  });
});

describe('MCP simulation — full loop with account sync', () => {
  it('seal then settle both mirror to the account with the right payloads', async () => {
    process.env.ARGUS_TOKEN = 'argus_pat_sim';
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    const dir = tmpArgusDir();
    const id = 'sim-decision';

    const sealed = await seal.handler({
      argus_dir: dir, id, predicate: 'cutover 다운타임 5분 미만', check_by: '2027-01-01',
      predicate_owner: 'user', human_judgment: '내가 책임진다',
    });
    expect(isError(sealed)).toBe(false);
    expect((body(sealed).data as Record<string, unknown>).account_synced).toBe(true);

    const settled = await settle.handler({
      argus_dir: dir, id, outcome: 'held', outcome_source: 'user_stated', what_happened: '4분 다운타임',
    });
    expect(isError(settled)).toBe(false);
    expect((body(settled).data as Record<string, unknown>).account_synced).toBe(true);

    // two account calls: a seal then a settle, both to /api/mcp/seal
    const actions = fetchSpy.mock.calls.map((c) => JSON.parse((c[1] as RequestInit).body as string).action);
    expect(actions).toEqual(['seal', 'settle']);
    expect(String(fetchSpy.mock.calls[0][0])).toContain('/api/mcp/seal');
  });

  it('stays local-only (no network) when no token is set', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const dir = tmpArgusDir();
    const res = await seal.handler({ argus_dir: dir, id: 'local1', predicate: '무언가 참이 된다 반드시', check_by: '2027-01-01', predicate_owner: 'user' });
    expect((body(res).data as Record<string, unknown>).account_synced).toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
    // no_token is the chosen default, not a failure — the surface stays silent.
    expect(String(body(res).surface)).not.toContain('sync');
  });

  it('a FAILED sync with a token set speaks up on seal and settle (P1-E4: the email will not come)', async () => {
    process.env.ARGUS_TOKEN = 'argus_pat_sim';
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}', { status: 500 }));
    const dir = tmpArgusDir();
    const id = 'sync-fail';

    const sealed = await seal.handler({
      argus_dir: dir, id, predicate: 'cutover 다운타임 5분 미만', check_by: '2027-01-01', predicate_owner: 'user',
    });
    expect(isError(sealed)).toBe(false); // the local seal stands
    const sealData = body(sealed).data as Record<string, unknown>;
    expect(sealData.account_synced).toBe(false);
    expect(sealData.account_sync_reason).toBe('http_500');
    // M4: the surface follows the predicate's language — Korean predicate ⇒
    // Korean sync-failure line. The FACT it must convey is unchanged: sync
    // failed + the reason + the email won't fire until it syncs.
    expect(String(body(sealed).surface)).toContain('계정 동기화가 안 됐습니다');
    expect(String(body(sealed).surface)).toContain('이메일 알림이 오지 않습니다');

    const settled = await settle.handler({
      argus_dir: dir, id, outcome: 'held', outcome_source: 'user_stated', what_happened: '4분 다운타임',
    });
    expect(isError(settled)).toBe(false);
    const settleData = body(settled).data as Record<string, unknown>;
    expect(settleData.account_synced).toBe(false);
    expect(settleData.account_sync_reason).toBe('http_500');
    expect(String(body(settled).surface)).toContain('계정 동기화가 안 됐습니다'); // Korean what_happened ⇒ Korean line
  });

  it('an expired account token speaks up on seal with a one-line no-email surface', async () => {
    process.env.ARGUS_TOKEN = 'argus_pat_expired';
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}', { status: 401 }));
    const dir = tmpArgusDir();

    const sealed = await seal.handler({
      argus_dir: dir,
      id: 'expired-token',
      predicate: 'cutover downtime stays under five minutes',
      check_by: '2027-01-01',
      predicate_owner: 'user',
    });

    expect(isError(sealed)).toBe(false);
    const sealData = body(sealed).data as Record<string, unknown>;
    expect(sealData.account_synced).toBe(false);
    expect(sealData.account_sync_reason).toBe('http_401');
    const surface = String(body(sealed).surface);
    // M0: the surface speaks human — the machine enum stays in data only.
    expect(surface).toContain('HTTP 401');
    expect(surface).toContain('expired');
    expect(surface).not.toContain('http_401');
    expect(surface).toMatch(/email reminder won't fire/i);
  });
});

describe('MCP simulation — settle outcome is required, never inferred', () => {
  it('with no outcome and no elicitation support, refuses (does not guess)', async () => {
    const dir = tmpArgusDir();
    const id = 'needs-outcome';
    await seal.handler({ argus_dir: dir, id, predicate: '무언가 참이 된다 반드시', check_by: '2027-01-01', predicate_owner: 'user' });
    const res = await settle.handler({ argus_dir: dir, id, outcome_source: 'user_stated', what_happened: '어떻게 됐다' });
    expect(isError(res)).toBe(true);
    expect(body(res).error_code).toBe('OUTCOME_REQUIRED');
  });
});
