vi.mock('@/lib/supabase', () => ({
  supabase: { from: vi.fn(), auth: { getSession: vi.fn() } },
  getCurrentUserId: vi.fn(() => Promise.resolve(null)),
}));

vi.mock('@/lib/storage', () => ({
  getStorage: vi.fn((_key: string, fallback: unknown) => fallback),
  setStorage: vi.fn(),
}));

vi.mock('@/lib/error-handler', () => ({
  handleError: vi.fn(),
}));

import { mergeByTimestamp, loadAndMerge } from '@/lib/db';
import { supabase, getCurrentUserId } from '@/lib/supabase';
import { getStorage, setStorage } from '@/lib/storage';

interface TestItem {
  id: string;
  name: string;
  updated_at?: string;
  created_at?: string;
}

describe('mergeByTimestamp', () => {
  /* ── Empty arrays ── */

  it('returns empty array when both local and remote are empty', () => {
    const result = mergeByTimestamp<TestItem>([], []);
    expect(result).toEqual([]);
  });

  it('returns local items when remote is empty', () => {
    const local: TestItem[] = [
      { id: '1', name: 'Local A', updated_at: '2025-01-01T00:00:00Z' },
    ];
    const result = mergeByTimestamp(local, []);
    expect(result).toEqual(local);
  });

  it('returns remote items when local is empty', () => {
    const remote: TestItem[] = [
      { id: '1', name: 'Remote A', updated_at: '2025-01-01T00:00:00Z' },
    ];
    const result = mergeByTimestamp([], remote);
    expect(result).toEqual(remote);
  });

  /* ── Items only in one side ── */

  it('keeps items only in local', () => {
    const local: TestItem[] = [
      { id: '1', name: 'Local only', updated_at: '2025-01-01T00:00:00Z' },
    ];
    const remote: TestItem[] = [
      { id: '2', name: 'Remote only', updated_at: '2025-01-01T00:00:00Z' },
    ];
    const result = mergeByTimestamp(local, remote);
    expect(result).toHaveLength(2);
    expect(result.find(i => i.id === '1')?.name).toBe('Local only');
  });

  it('keeps items only in remote', () => {
    const local: TestItem[] = [
      { id: '1', name: 'Local only', updated_at: '2025-01-01T00:00:00Z' },
    ];
    const remote: TestItem[] = [
      { id: '2', name: 'Remote only', updated_at: '2025-01-01T00:00:00Z' },
    ];
    const result = mergeByTimestamp(local, remote);
    expect(result).toHaveLength(2);
    expect(result.find(i => i.id === '2')?.name).toBe('Remote only');
  });

  /* ── Same ID, timestamp comparison ── */

  it('picks remote when remote is newer', () => {
    const local: TestItem[] = [
      { id: '1', name: 'Old local', updated_at: '2025-01-01T00:00:00Z' },
    ];
    const remote: TestItem[] = [
      { id: '1', name: 'New remote', updated_at: '2025-06-01T00:00:00Z' },
    ];
    const result = mergeByTimestamp(local, remote);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('New remote');
  });

  it('picks local when local is newer', () => {
    const local: TestItem[] = [
      { id: '1', name: 'New local', updated_at: '2025-06-01T00:00:00Z' },
    ];
    const remote: TestItem[] = [
      { id: '1', name: 'Old remote', updated_at: '2025-01-01T00:00:00Z' },
    ];
    const result = mergeByTimestamp(local, remote);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('New local');
  });

  /* ── Fallbacks ── */

  it('falls back to created_at when updated_at is missing', () => {
    const local: TestItem[] = [
      { id: '1', name: 'Local old', created_at: '2025-01-01T00:00:00Z' },
    ];
    const remote: TestItem[] = [
      { id: '1', name: 'Remote newer', created_at: '2025-06-01T00:00:00Z' },
    ];
    const result = mergeByTimestamp(local, remote);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Remote newer');
  });

  it('local wins in tie when both timestamps are missing', () => {
    const local: TestItem[] = [
      { id: '1', name: 'Local wins' },
    ];
    const remote: TestItem[] = [
      { id: '1', name: 'Remote loses' },
    ];
    const result = mergeByTimestamp(local, remote);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Local wins');
  });

  /* ── Multiple items ── */

  it('merges multiple items correctly', () => {
    const local: TestItem[] = [
      { id: '1', name: 'Local v1', updated_at: '2025-01-01T00:00:00Z' },
      { id: '2', name: 'Local only', updated_at: '2025-03-01T00:00:00Z' },
      { id: '3', name: 'Local newer', updated_at: '2025-06-01T00:00:00Z' },
    ];
    const remote: TestItem[] = [
      { id: '1', name: 'Remote v2', updated_at: '2025-06-01T00:00:00Z' },
      { id: '3', name: 'Remote older', updated_at: '2025-01-01T00:00:00Z' },
      { id: '4', name: 'Remote only', updated_at: '2025-04-01T00:00:00Z' },
    ];
    const result = mergeByTimestamp(local, remote);

    expect(result).toHaveLength(4);
    expect(result.find(i => i.id === '1')?.name).toBe('Remote v2');
    expect(result.find(i => i.id === '2')?.name).toBe('Local only');
    expect(result.find(i => i.id === '3')?.name).toBe('Local newer');
    expect(result.find(i => i.id === '4')?.name).toBe('Remote only');
  });
});

/* ── P1-C7 regression: delete propagation via remote tombstones ──
 *
 * A row soft-deleted on another device (deleted_at set) used to survive as a
 * local ghost forever: the client filtered tombstones AFTER the fetch, so the
 * ghost's id was missing from remoteIds, got classified as "local-only", and
 * was re-pushed on EVERY load (the upsert payload has no deleted_at, so the
 * server stayed deleted — but the futile push looped for good).
 */
describe('loadAndMerge — tombstone propagation (P1-C7)', () => {
  afterEach(() => {
    vi.mocked(getCurrentUserId).mockImplementation(() => Promise.resolve(null));
    vi.mocked(getStorage).mockImplementation((_key: string, fallback: unknown) => fallback);
    vi.mocked(setStorage).mockClear();
    vi.mocked(supabase.from).mockReset();
  });

  it('removes remote-tombstoned rows locally and does NOT re-push them as local-only', async () => {
    vi.mocked(getCurrentUserId).mockImplementation(() => Promise.resolve('user-1'));
    vi.mocked(getStorage).mockImplementation(() => ([
      { id: 'ghost', name: 'deleted on another device', updated_at: '2025-01-01T00:00:00Z' },
      { id: 'offline-new', name: 'created offline here', updated_at: '2025-01-02T00:00:00Z' },
      { id: 'alive', name: 'local copy', updated_at: '2025-01-01T00:00:00Z' },
    ]));
    const upsert = vi.fn().mockResolvedValue({ error: null });
    const order = vi.fn().mockResolvedValue({
      data: [
        // Tombstone is NEWER than the local ghost — must still be removed, not merged back.
        { id: 'ghost', name: 'deleted on another device', updated_at: '2025-06-01T00:00:00Z', deleted_at: '2025-06-01T00:00:00Z' },
        // A live row WITHOUT a deleted_at field (older table / no column) stays alive — backward-safe.
        { id: 'alive', name: 'remote copy', updated_at: '2025-01-01T00:00:00Z' },
      ],
      error: null,
    });
    const eq = vi.fn(() => ({ order }));
    const select = vi.fn(() => ({ eq }));
    vi.mocked(supabase.from).mockReturnValue({ select, upsert } as never);

    const result = await loadAndMerge<TestItem>('projects', 'sot_projects');

    // Ghost is gone from the merge result AND from what gets saved locally.
    expect(result.map(i => i.id).sort()).toEqual(['alive', 'offline-new']);
    const saved = vi.mocked(setStorage).mock.calls.find(c => c[0] === 'sot_projects')?.[1] as TestItem[];
    expect(saved.map(i => i.id).sort()).toEqual(['alive', 'offline-new']);

    // The ghost must NOT be re-pushed as "local-only" (the eternal futile push);
    // the genuinely-offline item still uploads.
    expect(upsert).toHaveBeenCalledTimes(1);
    const pushed = upsert.mock.calls[0][0] as Array<{ id: string }>;
    expect(pushed.map(p => p.id)).toEqual(['offline-new']);
  });
});
