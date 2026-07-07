import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { DecisionItem } from '@/lib/decision-items';

/**
 * useDecisionItemsStore holds user-scoped premises (a USER_DATA table). The pure
 * transforms live in decision-items.ts (already tested); here we cover the
 * store's OWN wiring: id-dedup on addItems, the toggleMonitoring branch that
 * asserts external=true, decision-scoped selectors, and that every write is
 * persisted + upserted. Storage + db are stubbed; the real helpers run.
 */

const mem = new Map<string, unknown>();
vi.mock('@/lib/storage', async (orig) => {
  const actual = await orig<typeof import('@/lib/storage')>();
  return {
    ...actual,
    getStorage: <T>(key: string, def: T): T => (mem.has(key) ? (mem.get(key) as T) : def),
    setStorage: (key: string, val: unknown) => { mem.set(key, val); },
  };
});

const upsertSpy = vi.fn();
let mergeResult: DecisionItem[] = [];
vi.mock('@/lib/db', () => ({
  upsertToSupabase: (...a: unknown[]) => upsertSpy(...a),
  loadAndMerge: () => Promise.resolve(mergeResult),
}));

import { useDecisionItemsStore } from '../useDecisionItemsStore';

function mkItem(id: string, decisionId: string, extra: Partial<DecisionItem> = {}): DecisionItem {
  return {
    id, decision_id: decisionId, type: 'assumption', text: `t-${id}`,
    source: 'ai', authored: 'ai', edits: [], external: false, load_bearing: false,
    alert: { mode: 'off' }, status: 'active', created_at: '2026-01-01T00:00:00Z', ...extra,
  } as DecisionItem;
}

beforeEach(() => {
  mem.clear();
  upsertSpy.mockClear();
  mergeResult = [];
  useDecisionItemsStore.setState({ items: [] });
});

describe('addItems', () => {
  it('adds fresh items, persists locally, and upserts each', () => {
    useDecisionItemsStore.getState().addItems([mkItem('a', 'd1'), mkItem('b', 'd1')]);
    expect(useDecisionItemsStore.getState().items.map((i) => i.id)).toEqual(['a', 'b']);
    expect(mem.get('sot_decision_items')).toBeDefined();
    expect(upsertSpy).toHaveBeenCalledTimes(2);
  });

  it('skips items whose id is already present (no duplicate, no re-upsert)', () => {
    useDecisionItemsStore.getState().addItems([mkItem('a', 'd1')]);
    upsertSpy.mockClear();
    useDecisionItemsStore.getState().addItems([mkItem('a', 'd1', { text: 'dup' }), mkItem('c', 'd1')]);
    expect(useDecisionItemsStore.getState().items.map((i) => i.id)).toEqual(['a', 'c']);
    expect(upsertSpy).toHaveBeenCalledTimes(1); // only 'c'
  });
});

describe('toggleMonitoring', () => {
  it('turning ON sets mode on_change AND marks the item external (so watch is not a no-op)', () => {
    useDecisionItemsStore.getState().addItems([mkItem('a', 'd1')]);
    useDecisionItemsStore.getState().toggleMonitoring('a');
    const item = useDecisionItemsStore.getState().items[0];
    expect(item.alert.mode).toBe('on_change');
    expect(item.external).toBe(true);
    expect(item.updated_at).toBeTruthy();
  });

  it('toggling again turns monitoring OFF', () => {
    useDecisionItemsStore.getState().addItems([mkItem('a', 'd1', { alert: { mode: 'on_change' }, external: true })]);
    useDecisionItemsStore.getState().toggleMonitoring('a');
    expect(useDecisionItemsStore.getState().items[0].alert.mode).toBe('off');
  });

  it('is a no-op for an unknown id', () => {
    useDecisionItemsStore.getState().addItems([mkItem('a', 'd1')]);
    upsertSpy.mockClear();
    useDecisionItemsStore.getState().toggleMonitoring('nope');
    expect(upsertSpy).not.toHaveBeenCalled();
  });
});

describe('decision-scoped selectors', () => {
  it('itemsForDecision returns only items for that decision', () => {
    useDecisionItemsStore.getState().addItems([mkItem('a', 'd1'), mkItem('b', 'd2'), mkItem('c', 'd1')]);
    expect(useDecisionItemsStore.getState().itemsForDecision('d1').map((i) => i.id)).toEqual(['a', 'c']);
  });

  it('overrideSummary is computed over that decision only', () => {
    useDecisionItemsStore.getState().addItems([mkItem('a', 'd1'), mkItem('b', 'd2')]);
    const summary = useDecisionItemsStore.getState().overrideSummary('d1');
    // Only d1's single AI item is counted — proves d2's item is excluded (would
    // be aiItems: 2 if the selector leaked across decisions).
    expect(summary).toMatchObject({ aiItems: 1, added: 0, overturned: 0 });
  });
});

describe('loadData', () => {
  it('shows local first, then merges remote (remote wins on id, local-only kept)', async () => {
    mem.set('sot_decision_items', [mkItem('a', 'd1', { text: 'local-a' }), mkItem('b', 'd1', { text: 'local-b' })]);
    mergeResult = [mkItem('a', 'd1', { text: 'remote-a' })];

    useDecisionItemsStore.getState().loadData();
    expect(useDecisionItemsStore.getState().items.map((i) => i.id)).toEqual(['a', 'b']);

    await Promise.resolve(); await Promise.resolve();
    const byId = Object.fromEntries(useDecisionItemsStore.getState().items.map((i) => [i.id, i.text]));
    expect(byId).toEqual({ a: 'remote-a', b: 'local-b' });
  });
});
