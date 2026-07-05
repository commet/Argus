import { create } from 'zustand';
import { getStorage, setStorage, STORAGE_KEYS } from '@/lib/storage';
import { loadAndMerge, upsertToSupabase } from '@/lib/db';
import {
  recordEdit,
  setAlertMode,
  registerDismissal,
  markRechecked,
  summarizeOverrides,
  type DecisionItem,
  type EditAction,
  type AlertMode,
  type OverrideSummary,
} from '@/lib/decision-items';

/**
 * Decision items store — localStorage-first, Supabase-merge (same pattern as the
 * other synced stores). Domain mutations wrap the pure helpers in decision-items.ts
 * (recordEdit / setAlertMode / registerDismissal) and stamp `updated_at` so
 * cross-device merge keeps the latest edit. Every write persists the changed item.
 *
 * Table + column contract: supabase/migrations/20260701_decision_items.sql,
 * guarded by schema-drift.test (decision_items) and persistence-contract.test
 * (DECISION_ITEMS → decision_items). Design:
 * docs/DESIGN-decision-items-living-premises-2026-07-01.md
 */

const TABLE = 'decision_items' as const;
const KEY = STORAGE_KEYS.DECISION_ITEMS;

interface DecisionItemsState {
  items: DecisionItem[];
  loadData: () => void;
  /** Add freshly-extracted (or user-added) items; skips ids already present. */
  addItems: (incoming: DecisionItem[]) => void;
  /** Record a user edit to an AI-extracted item (the signal). */
  editItem: (id: string, action: EditAction, newText: string, note?: string) => void;
  setAlert: (id: string, mode: AlertMode) => void;
  /** Bell toggle for a premise: turning ON also marks it `external` (the user is
   *  asserting this is a real-world fact worth watching) — otherwise the alert
   *  would be a no-op, since monitoredPremises / the plugin re-check require
   *  `external === true`. Turning OFF just sets mode off. */
  toggleMonitoring: (id: string) => void;
  dismissAlert: (id: string) => void;
  /** Pull-based recheck confirmation: the fact still holds (or record its new
   *  value) — resets the recheck clock without a dismissal (gap #1). */
  markRechecked: (id: string, value?: string) => void;
  itemsForDecision: (decisionId: string) => DecisionItem[];
  overrideSummary: (decisionId: string) => OverrideSummary;
}

export const useDecisionItemsStore = create<DecisionItemsState>((set, get) => {
  /** Persist the full list locally and upsert the one changed item to Supabase. */
  const persist = (items: DecisionItem[], changed?: DecisionItem) => {
    set({ items });
    setStorage(KEY, items);
    if (changed) upsertToSupabase(TABLE, changed);
  };

  /** Apply a pure transform to one item, stamp updated_at, persist. */
  const mutate = (id: string, fn: (item: DecisionItem) => DecisionItem) => {
    const current = get().items;
    const target = current.find((i) => i.id === id);
    if (!target) return;
    const changed = { ...fn(target), updated_at: new Date().toISOString() };
    persist(
      current.map((i) => (i.id === id ? changed : i)),
      changed,
    );
  };

  return {
    items: [],

    loadData: () => {
      const local = getStorage<DecisionItem[]>(KEY, []);
      set({ items: local });
      loadAndMerge<DecisionItem>(TABLE, KEY).then((merged) => {
        const current = get().items;
        const newLocal = current.filter((c) => !merged.find((m) => m.id === c.id));
        set({ items: [...merged, ...newLocal] });
      });
    },

    addItems: (incoming) => {
      const current = get().items;
      const seen = new Set(current.map((i) => i.id));
      const fresh = incoming.filter((i) => i && !seen.has(i.id));
      if (fresh.length === 0) return;
      const items = [...current, ...fresh];
      setStorage(KEY, items);
      set({ items });
      // Upsert each fresh item (async, fire-and-forget).
      for (const item of fresh) upsertToSupabase(TABLE, item);
    },

    editItem: (id, action, newText, note) =>
      mutate(id, (item) => recordEdit(item, action, newText, Date.now(), note)),

    setAlert: (id, mode) => mutate(id, (item) => setAlertMode(item, mode)),

    toggleMonitoring: (id) =>
      mutate(id, (item) =>
        item.alert?.mode === 'on_change'
          ? setAlertMode(item, 'off')
          : { ...setAlertMode(item, 'on_change'), external: true },
      ),

    dismissAlert: (id) => mutate(id, (item) => registerDismissal(item, Date.now())),

    markRechecked: (id, value) => mutate(id, (item) => markRechecked(item, Date.now(), value)),

    itemsForDecision: (decisionId) => get().items.filter((i) => i.decision_id === decisionId),

    overrideSummary: (decisionId) =>
      summarizeOverrides(get().items.filter((i) => i.decision_id === decisionId)),
  };
});
