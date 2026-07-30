/**
 * One bad premise must not take down the nightly run (2026-07-28).
 *
 * Found by running the watcher for real: `materiality_rule` comes from jsonb, the
 * DB does not type-check it, and `evaluateMateriality` sits OUTSIDE the
 * researcher's try/catch — so a legacy/hand-written rule like `{type:'delta'}`
 * (no `params`) throws a TypeError out of investigatePremise. The cron had no
 * try/catch of its own, so that single premise aborted the whole GET: every other
 * user's premises went unchecked that night, and any findings already computed in
 * the same pass were dropped, because persistence runs after both loops.
 *
 * This exercises the real route with a poisoned first premise and a healthy
 * second one, and asserts the healthy one still gets researched, recorded and
 * persisted — and that the skipped one is REPORTED, never silently swallowed.
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';

const investigate = vi.fn();
vi.mock('@/lib/premise-researcher', () => ({ investigatePremise: (...a: unknown[]) => investigate(...a) }));
vi.mock('@/lib/web-research', () => ({ webSearchEnabled: () => true }));
vi.mock('resend', () => ({ Resend: class { emails = { send: vi.fn() }; } }));

const updated: Array<{ id: string; next_check_by: string | null }> = [];

const makePoisoned = () => ({
  premise_id: 'p_bad', ordinal: 1, kind: 'premise', text: '망가진 규칙을 가진 전제',
  external: true, load_bearing: true, source: 'user_stated', status: 'active',
  amend_history: [], recheck_count: 0, auto_watch: true,
  added_ts: '2026-01-01T00:00:00.000Z',
  materiality_rule: { type: 'delta' }, // ← no `params`: throws inside the researcher
});
const makeHealthy = () => ({
  premise_id: 'p_ok', ordinal: 2, kind: 'premise', text: '멀쩡한 전제',
  external: true, load_bearing: true, source: 'user_stated', status: 'active',
  amend_history: [], recheck_count: 0, auto_watch: true,
  added_ts: '2026-01-01T00:00:00.000Z',
});

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    from: (table: string) => table === 'decision_items'
      ? (() => {
      // 두 번째 소스(decision_items, 2026-07-30) 쿼리 체인: .select().eq().eq().eq().limit()
      // 이 테스트의 관심사는 receipts 경로이므로 빈 목록을 준다 — 다만 체인은
      // 진짜 모양대로 받아야 한다 (체인이 끊기면 라우트 전체가 죽어 가짜 빨간불).
          const chain = { eq: () => chain, limit: () => Promise.resolve({ data: [], error: null }) } as never;
          return { select: () => chain };
        })()
      : ({
      select: () => ({
        eq: () => ({ single: () => Promise.resolve({ data: null }) }),
        is: () => ({
          eq: () => ({
            not: () => ({
              lte: () => ({
                limit: () => Promise.resolve({
                  data: [{
                    id: 'row_1', user_id: 'u1', next_check_by: '2026-07-01', companion_notified_at: null,
                    data: { receipt_id: 'row_1', source_title: 'T', tracked_premises: [makePoisoned(), makeHealthy()] },
                  }],
                  error: null,
                }),
              }),
            }),
          }),
        }),
      }),
      update: (patch: { next_check_by?: string | null }) => ({
        eq: (_c: string, id: string) => { if (table === 'review_receipts') updated.push({ id, next_check_by: patch.next_check_by ?? null }); return Promise.resolve({ error: null }); },
        in: () => Promise.resolve({ error: null }),
      }),
      upsert: () => Promise.resolve({ error: null }),
    }),
    auth: { admin: { getUserById: () => Promise.resolve({ data: { user: { email: 'u@example.com' } } }) } },
  }),
}));

beforeEach(() => {
  updated.length = 0;
  investigate.mockReset();
  vi.stubEnv('CRON_SECRET', 'secret');
  vi.stubEnv('PREMISE_WATCH_ENABLED', 'true');
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://x.supabase.co');
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'svc');
  vi.stubEnv('RESEND_API_KEY', '');
});

const req = () => new Request('https://argus.voyage/api/cron/premise-watch', {
  headers: { authorization: 'Bearer secret' },
}) as never;

describe('premise-watch — one poisoned premise cannot abort the run', () => {
  it('researches the healthy premise, persists it, and reports the skipped one', async () => {
    investigate.mockImplementation((input: { text: string }) => {
      if (input.text === makePoisoned().text) throw new TypeError("Cannot read properties of undefined (reading 'D')");
      return Promise.resolve({ verdict: 'quiet', fact: '확인함', source_url: 'https://x.example', source_date: '2026-07-20', confidence: 'high' });
    });

    const { GET } = await import('../route');
    const res = await GET(req());
    const body = await res.json();

    expect(res.status).toBe(200);
    // the healthy premise was still investigated…
    expect(investigate).toHaveBeenCalledTimes(2);
    expect(body.researched).toBe(2); // 카운터는 던지기 전에 오른다
    // …its receipt was still written (the whole point — findings are not lost)…
    expect(updated.map((u) => u.id)).toContain('row_1');
    // …and the failure is surfaced, not swallowed.
    expect(body.failed_premises).toBe(1);
  });

  it('a run with no poisoned premise reports zero failures', async () => {
    investigate.mockResolvedValue({ verdict: 'quiet', fact: '확인함', source_url: 'https://x.example', source_date: '2026-07-20', confidence: 'high' });
    const { GET } = await import('../route');
    const body = await (await GET(req())).json();
    expect(body.failed_premises).toBe(0);
    expect(body.researched).toBe(2);
  });
});
