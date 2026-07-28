/**
 * The per-run investigation cache must key on the researcher's FULL input, not on
 * the premise text (2026-07-29).
 *
 * `investigatePremise` decides `material` vs `quiet` from the baseline date (which
 * sources it is even allowed to see), the prior numeric value, and the declared
 * materiality rule. The cache existed to stop paying Brave + Claude twice for the
 * same question — but it was keyed on normalized text alone, so two users who both
 * track "한국은행 기준금리" got ONE verdict, computed against whichever of them the
 * loop reached first. The second user's receipt then recorded a drift judged
 * against a baseline and a prior value that were never theirs.
 *
 * That is the exact failure mode this repo's LLM-glue invariant is about: nothing
 * errors, the recorded finding reads perfectly plausible, and it is wrong.
 *
 * What makes this red: sharing a result between two premises whose inputs differ.
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';

const investigate = vi.fn();
vi.mock('@/lib/premise-researcher', () => ({ investigatePremise: (...a: unknown[]) => investigate(...a) }));
vi.mock('@/lib/web-research', () => ({ webSearchEnabled: () => true }));
vi.mock('resend', () => ({ Resend: class { emails = { send: vi.fn() }; } }));

const SAME_TEXT = '한국은행 기준금리';

function premise(over: Record<string, unknown> = {}) {
  return {
    premise_id: 'p_rate', ordinal: 1, kind: 'premise', text: SAME_TEXT,
    external: true, load_bearing: true, source: 'user_stated', status: 'active',
    amend_history: [], recheck_count: 0, auto_watch: true,
    added_ts: '2026-01-01T00:00:00.000Z',
    ...over,
  };
}

/** Two accounts, same premise wording, DIFFERENT baselines and prior values. */
let rows: unknown[] = [];

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({ single: () => Promise.resolve({ data: null }) }),
        is: () => ({ eq: () => ({ not: () => ({ lte: () => ({ limit: () => Promise.resolve({ data: rows, error: null }) }) }) }) }),
      }),
      update: () => ({ eq: () => Promise.resolve({ error: null }), in: () => Promise.resolve({ error: null }) }),
      upsert: () => Promise.resolve({ error: null }),
    }),
    auth: { admin: { getUserById: () => Promise.resolve({ data: { user: { email: 'u@example.com' } } }) } },
  }),
}));

beforeEach(() => {
  investigate.mockReset();
  investigate.mockResolvedValue({
    verdict: 'quiet', fact: '확인함', source_url: 'https://x.example',
    source_date: '2026-07-20', confidence: 'high',
  });
  vi.stubEnv('CRON_SECRET', 'secret');
  vi.stubEnv('PREMISE_WATCH_ENABLED', 'true');
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://x.supabase.co');
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'svc');
  vi.stubEnv('RESEND_API_KEY', '');
});

const req = () => new Request('https://argus.voyage/api/cron/premise-watch', {
  headers: { authorization: 'Bearer secret' },
}) as never;

describe('premise-watch investigation cache', () => {
  it('does NOT share a verdict between two users whose prior values differ', async () => {
    rows = [
      {
        id: 'row_a', user_id: 'user_a', next_check_by: '2026-07-01', companion_notified_at: null,
        data: {
          receipt_id: 'row_a', source_title: 'A',
          tracked_premises: [premise({ last_recheck: { finding: '2.50', numeric_value: 2.5, drifted: false, baseline_only: true, source: 'url', ts: '2026-02-01T00:00:00.000Z' } })],
        },
      },
      {
        id: 'row_b', user_id: 'user_b', next_check_by: '2026-07-01', companion_notified_at: null,
        data: {
          receipt_id: 'row_b', source_title: 'B',
          tracked_premises: [premise({ last_recheck: { finding: '2.75', numeric_value: 2.75, drifted: false, baseline_only: true, source: 'url', ts: '2026-06-01T00:00:00.000Z' } })],
        },
      },
    ];

    const { GET } = await import('../route');
    await GET(req());

    expect(investigate).toHaveBeenCalledTimes(2);
    const calls = investigate.mock.calls.map((c) => c[0] as { priorValue?: number; baselineYMD: string });
    expect(calls.map((c) => c.priorValue).sort()).toEqual([2.5, 2.75]);
    // …and each was researched against its OWN baseline, not the other's.
    expect(new Set(calls.map((c) => c.baselineYMD)).size).toBe(2);
  });

  it('still shares a verdict when the inputs are genuinely identical (cost guard intact)', async () => {
    const identical = () => premise({
      last_recheck: { finding: '2.50', numeric_value: 2.5, drifted: false, baseline_only: true, source: 'url', ts: '2026-06-01T00:00:00.000Z' },
    });
    rows = [
      { id: 'row_a', user_id: 'user_a', next_check_by: '2026-07-01', companion_notified_at: null, data: { receipt_id: 'row_a', source_title: 'A', tracked_premises: [identical()] } },
      { id: 'row_b', user_id: 'user_b', next_check_by: '2026-07-01', companion_notified_at: null, data: { receipt_id: 'row_b', source_title: 'B', tracked_premises: [identical()] } },
    ];

    const { GET } = await import('../route');
    const body = await (await GET(req())).json();

    expect(investigate).toHaveBeenCalledTimes(1);
    expect(body.researched).toBe(1);
  });

  it('does not share between a premise and an open_question with the same wording', async () => {
    rows = [{
      id: 'row_a', user_id: 'user_a', next_check_by: '2026-07-01', companion_notified_at: null,
      data: {
        receipt_id: 'row_a', source_title: 'A',
        tracked_premises: [
          premise({ premise_id: 'p_1' }),
          premise({ premise_id: 'p_2', ordinal: 2, kind: 'open_question', load_bearing: false }),
        ],
      },
    }];

    const { GET } = await import('../route');
    await GET(req());

    // A fact re-check and an unresolved question are different questions to ask,
    // even when the user wrote the same sentence for both.
    expect(investigate).toHaveBeenCalledTimes(2);
  });
});
