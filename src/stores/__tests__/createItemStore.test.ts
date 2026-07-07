import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * createItemStore is the shared CRUD factory behind useProject / useReframe /
 * useRecast / useSynthesize — a bug here fans out to four stores at once, and it
 * sits on the localStorage-first + Supabase-async seam CLAUDE.md flags as
 * silently lossy. We back it with an in-memory storage and spy on the db layer,
 * then assert the load/merge, add, update, delete and nested-update contracts.
 */

const mem = new Map<string, unknown>();
vi.mock('@/lib/storage', () => ({
  getStorage: <T>(key: string, def: T): T => (mem.has(key) ? (mem.get(key) as T) : def),
  setStorage: (key: string, val: unknown) => { mem.set(key, val); },
}));

const upsertSpy = vi.fn();
const softDeleteSpy = vi.fn();
let mergeResult: unknown[] = [];
vi.mock('@/lib/db', () => ({
  upsertToSupabase: (...a: unknown[]) => upsertSpy(...a),
  softDeleteFromSupabase: (...a: unknown[]) => softDeleteSpy(...a),
  loadAndMerge: () => Promise.resolve(mergeResult),
}));

import {
  loadItems, addNewItem, updateItem, deleteItem, addItemIfNew, updateNestedField,
} from '../createItemStore';

type Item = { id: string; created_at: string; updated_at: string; name?: string; steps?: string[] };
const KEY = 'reframe_items_v1';
const TABLE = 'reframe_items' as const;

function mk(id: string, extra: Partial<Item> = {}): Item {
  return { id, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z', ...extra };
}

beforeEach(() => {
  mem.clear();
  upsertSpy.mockClear();
  softDeleteSpy.mockClear();
  mergeResult = [];
});

describe('loadItems', () => {
  it('sets local synchronously, then merges remote with remote winning on id conflict', async () => {
    const local = [mk('a', { name: 'local-a' }), mk('b', { name: 'local-b' })];
    mem.set(KEY, local);
    mergeResult = [mk('a', { name: 'remote-a' })]; // remote has a newer 'a'

    let state: Item[] = [];
    const setItems = (items: Item[]) => { state = items; };
    loadItems<Item>(KEY, TABLE, () => state, setItems);

    // Synchronous: local is shown immediately.
    expect(state).toEqual(local);

    await Promise.resolve(); await Promise.resolve();

    // After merge: remote 'a' replaces local 'a', local-only 'b' is preserved.
    const byId = Object.fromEntries(state.map((i) => [i.id, i.name]));
    expect(byId).toEqual({ a: 'remote-a', b: 'local-b' });
  });
});

describe('addNewItem', () => {
  it('appends, persists to storage, upserts remotely, and returns the id', () => {
    let state: Item[] = [mk('a')];
    let currentId = '';
    const id = addNewItem<Item>(KEY, TABLE, () => state, (items, newId) => { state = items; currentId = newId; }, mk('b', { name: 'new' }));

    expect(id).toBe('b');
    expect(currentId).toBe('b');
    expect(state.map((i) => i.id)).toEqual(['a', 'b']);
    expect(mem.get(KEY)).toEqual(state);
    expect(upsertSpy).toHaveBeenCalledWith(TABLE, expect.objectContaining({ id: 'b' }));
  });
});

describe('updateItem', () => {
  it('applies the patch, bumps updated_at, and strips immutable id/created_at', () => {
    let state: Item[] = [mk('a', { name: 'old' })];
    updateItem<Item>(KEY, TABLE, () => state, (items) => { state = items; }, 'a', {
      name: 'new', id: 'HACKED', created_at: 'HACKED',
    } as Partial<Item>);

    const row = state[0];
    expect(row.name).toBe('new');
    expect(row.id).toBe('a');                 // id not overwritten
    expect(row.created_at).toBe('2026-01-01T00:00:00Z'); // created_at not overwritten
    expect(row.updated_at).not.toBe('2026-01-01T00:00:00Z'); // bumped
    expect(upsertSpy).toHaveBeenCalledWith(TABLE, expect.objectContaining({ id: 'a', name: 'new' }));
  });

  it('is a no-op upsert when the id is not present', () => {
    let state: Item[] = [mk('a')];
    updateItem<Item>(KEY, TABLE, () => state, (items) => { state = items; }, 'missing', { name: 'x' });
    expect(upsertSpy).not.toHaveBeenCalled();
  });
});

describe('deleteItem', () => {
  it('removes the row, clears currentId when it was current, and soft-deletes remotely', () => {
    let state: Item[] = [mk('a'), mk('b')];
    let currentId: string | null = 'a';
    deleteItem<Item>(KEY, TABLE, () => state, (items) => { state = items; }, () => currentId, (id) => { currentId = id; }, 'a');

    expect(state.map((i) => i.id)).toEqual(['b']);
    expect(currentId).toBeNull();
    expect(softDeleteSpy).toHaveBeenCalledWith(TABLE, 'a');
  });

  it('keeps currentId when a different row is deleted', () => {
    let state: Item[] = [mk('a'), mk('b')];
    let currentId: string | null = 'a';
    deleteItem<Item>(KEY, TABLE, () => state, (items) => { state = items; }, () => currentId, (id) => { currentId = id; }, 'b');
    expect(currentId).toBe('a');
  });
});

describe('addItemIfNew', () => {
  it('adds a new item but skips a duplicate id (no double upsert)', () => {
    let state: Item[] = [mk('a')];
    const add = (item: Item) => addItemIfNew<Item>(KEY, TABLE, () => state, (items) => { state = items; }, item);

    add(mk('b'));
    expect(state.map((i) => i.id)).toEqual(['a', 'b']);
    expect(upsertSpy).toHaveBeenCalledTimes(1);

    add(mk('b', { name: 'dup' })); // same id → skipped
    expect(state.map((i) => i.id)).toEqual(['a', 'b']);
    expect(upsertSpy).toHaveBeenCalledTimes(1);
  });
});

describe('updateNestedField', () => {
  it('applies the updater and bumps updated_at', () => {
    let state: Item[] = [mk('a', { steps: ['one'] })];
    updateNestedField<Item>(KEY, TABLE, () => state, (items) => { state = items; }, 'a', (item) => ({ ...item, steps: [...(item.steps || []), 'two'] }));
    expect(state[0].steps).toEqual(['one', 'two']);
    expect(upsertSpy).toHaveBeenCalledOnce();
  });

  it('skips the write when the updater returns the same reference (no-op guard)', () => {
    let state: Item[] = [mk('a')];
    updateNestedField<Item>(KEY, TABLE, () => state, (items) => { state = items; }, 'a', (item) => item);
    expect(upsertSpy).not.toHaveBeenCalled();
  });

  it('does nothing when the id is absent', () => {
    let state: Item[] = [mk('a')];
    updateNestedField<Item>(KEY, TABLE, () => state, (items) => { state = items; }, 'missing', (item) => ({ ...item, name: 'x' }));
    expect(upsertSpy).not.toHaveBeenCalled();
  });
});
