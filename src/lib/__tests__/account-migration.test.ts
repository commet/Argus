import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  failures: 0,
  progressiveUpserts: 0,
  pushError: { message: 'write failed' } as { message: string } | null,
}));

vi.mock('@/lib/supabase', () => ({
  getCurrentUserId: () => Promise.resolve('user-1'),
  supabase: {
    from: () => ({
      select: () => ({ eq: () => Promise.resolve({ data: [], error: null }) }),
      upsert: () => {
        mocks.progressiveUpserts++;
        return Promise.resolve({ error: mocks.pushError });
      },
    }),
  },
}));

vi.mock('@/lib/db', () => ({ loadAndMerge: () => Promise.resolve([]) }));
vi.mock('@/lib/sync-health', () => ({
  getSyncFailureCount: () => mocks.failures,
  reportSyncFailure: () => { mocks.failures++; },
}));
vi.mock('@/lib/storage', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/storage')>();
  return {
    ...actual,
    getStorage: (key: string, fallback: unknown) => key === actual.STORAGE_KEYS.PROGRESSIVE_SESSIONS
      ? [{ id: 'session-1', project_id: 'project-1', phase: 'complete', workers: [], updated_at: '2026-07-11T00:00:00Z' }]
      : fallback,
  };
});

import { migrateLocalToAccount } from '../account-migration';

describe('migrateLocalToAccount', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mocks.failures = 0;
    mocks.progressiveUpserts = 0;
    mocks.pushError = { message: 'write failed' };
  });

  afterEach(() => vi.useRealTimers());

  it('reports a progressive-session failure and remains retryable', async () => {
    const firstPromise = migrateLocalToAccount();
    await vi.runAllTimersAsync();
    const first = await firstPromise;
    expect(first.partial).toBe(true);
    expect(mocks.progressiveUpserts).toBe(1);

    const secondPromise = migrateLocalToAccount();
    await vi.runAllTimersAsync();
    const second = await secondPromise;
    expect(second.partial).toBe(true);
    expect(mocks.progressiveUpserts).toBe(2);
  });
});
