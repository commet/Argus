import { describe, it, expect, beforeEach, afterEach } from 'vitest';

/**
 * Read-side hydration guard (L0). getStorage must never hand back a value whose
 * shape can't satisfy the caller's fallback — old/corrupt/concurrently-mangled
 * localStorage holding the wrong shape would otherwise crash consumers that
 * immediately `.filter`/`.map`/`.length` the result.
 *
 * The module guards on `typeof window`, so we stub a minimal window +
 * localStorage on globalThis (the test env is `node`).
 */

class MemoryStorage {
  private m = new Map<string, string>();
  getItem(k: string) { return this.m.has(k) ? this.m.get(k)! : null; }
  setItem(k: string, v: string) { this.m.set(k, v); }
  removeItem(k: string) { this.m.delete(k); }
  setRaw(k: string, v: string) { this.m.set(k, v); }
}

let store: MemoryStorage;

beforeEach(() => {
  store = new MemoryStorage();
  (globalThis as Record<string, unknown>).window = {};
  (globalThis as Record<string, unknown>).localStorage = store;
});

afterEach(() => {
  delete (globalThis as Record<string, unknown>).window;
  delete (globalThis as Record<string, unknown>).localStorage;
});

async function load() {
  // Imported lazily so the global stubs are in place first.
  return await import('../storage');
}

describe('getStorage hydration guard', () => {
  it('returns a well-formed array unchanged', async () => {
    const { getStorage } = await load();
    store.setRaw('k', JSON.stringify([1, 2, 3]));
    expect(getStorage('k', [] as number[])).toEqual([1, 2, 3]);
  });

  it('falls back when the stored value is an object but the fallback is an array', async () => {
    const { getStorage } = await load();
    store.setRaw('k', JSON.stringify({ corrupted: true }));
    expect(getStorage('k', [] as unknown[])).toEqual([]);
  });

  it('falls back when the stored value is an array but the fallback is an object', async () => {
    const { getStorage } = await load();
    store.setRaw('k', JSON.stringify([1, 2]));
    expect(getStorage('k', { ok: false })).toEqual({ ok: false });
  });

  it('falls back when the stored value is JSON null', async () => {
    const { getStorage } = await load();
    store.setRaw('k', 'null');
    expect(getStorage('k', [] as unknown[])).toEqual([]);
  });

  it('falls back on malformed JSON', async () => {
    const { getStorage } = await load();
    store.setRaw('k', '{not valid json');
    expect(getStorage('k', [] as unknown[])).toEqual([]);
  });

  it('returns the fallback when the key is absent', async () => {
    const { getStorage } = await load();
    expect(getStorage('missing', [] as unknown[])).toEqual([]);
  });

  it('preserves a stored object when the fallback is an object', async () => {
    const { getStorage } = await load();
    store.setRaw('k', JSON.stringify({ a: 1 }));
    expect(getStorage('k', { a: 0 })).toEqual({ a: 1 });
  });

  it('does not over-reject primitives that match a primitive fallback', async () => {
    const { getStorage } = await load();
    store.setRaw('k', JSON.stringify('hello'));
    expect(getStorage('k', '')).toBe('hello');
  });
});
