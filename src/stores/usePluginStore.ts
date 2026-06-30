import { create } from 'zustand';
import { fetchFromSupabase } from '@/lib/db';
import { supabase, getCurrentUserId } from '@/lib/supabase';
import { generateId } from '@/lib/uuid';
import type { PluginDecision, PluginBearing } from './types';

/**
 * Read-only view of plugin-originated content imported into the user's account
 * (plugin_decisions / plugin_bearings). Server-only: these rows are created by
 * the import flow (lib/plugin-import.ts) and live in Supabase, so there is no
 * localStorage mirror — loading requires an authenticated session.
 */
interface PluginState {
  decisions: PluginDecision[];
  bearings: PluginBearing[];
  loading: boolean;
  loaded: boolean;
  loadData: () => Promise<void>;
  settleDecision: (id: string, outcome: 'happened' | 'avoided' | 'partial') => Promise<void>;
  deferDecision: (id: string, checkBy: string) => Promise<void>;
}

export const usePluginStore = create<PluginState>((set, get) => ({
  decisions: [],
  bearings: [],
  loading: false,
  loaded: false,
  loadData: async () => {
    set({ loading: true });
    try {
      const [decisions, bearings] = await Promise.all([
        fetchFromSupabase<PluginDecision>('plugin_decisions'),
        fetchFromSupabase<PluginBearing>('plugin_bearings'),
      ]);
      set({ decisions, bearings, loading: false, loaded: true });
    } catch {
      set({ loading: false, loaded: true });
    }
  },
  settleDecision: async (id, outcome) => {
    const userId = await getCurrentUserId();
    if (!userId) throw new Error('not_logged_in');
    const current = get().decisions.find((d) => d.id === id);
    if (!current?.ledger_id) throw new Error('decision_not_found');
    const now = new Date().toISOString();
    const eventId = `web:${current.ledger_id}:settle:${generateId()}`;
    const payload = { event: 'settle', id: current.ledger_id, outcome, at: now };
    const patch = { status: 'settled' as const, outcome, settled_at: now };

    const { error: eventError } = await supabase.from('plugin_events').insert({
      id: generateId(),
      user_id: userId,
      plugin_decision_id: id,
      ledger_id: current.ledger_id,
      event_id: eventId,
      event: 'settle',
      payload,
      source: 'webapp',
    });
    if (eventError) throw eventError;

    const { error: updateError } = await supabase
      .from('plugin_decisions')
      .update(patch)
      .eq('id', id)
      .eq('user_id', userId);
    if (updateError) throw updateError;

    set((state) => ({
      decisions: state.decisions.map((d) => (d.id === id ? { ...d, ...patch } : d)),
    }));
  },
  deferDecision: async (id, checkBy) => {
    const userId = await getCurrentUserId();
    if (!userId) throw new Error('not_logged_in');
    const current = get().decisions.find((d) => d.id === id);
    if (!current?.ledger_id) throw new Error('decision_not_found');
    const now = new Date().toISOString();
    const eventId = `web:${current.ledger_id}:amend:${generateId()}`;
    const payload = { event: 'amend', id: current.ledger_id, check_by: checkBy, at: now };
    const history = [
      ...(Array.isArray(current.history) ? current.history : []),
      {
        predicate: current.predicate,
        falsified_if: current.falsified_if,
        check_by: current.check_by,
        amended_at: now,
      },
    ];
    const patch = { status: 'sealed' as const, check_by: checkBy, history };

    const { error: eventError } = await supabase.from('plugin_events').insert({
      id: generateId(),
      user_id: userId,
      plugin_decision_id: id,
      ledger_id: current.ledger_id,
      event_id: eventId,
      event: 'amend',
      payload,
      source: 'webapp',
    });
    if (eventError) throw eventError;

    const { error: updateError } = await supabase
      .from('plugin_decisions')
      .update(patch)
      .eq('id', id)
      .eq('user_id', userId);
    if (updateError) throw updateError;

    set((state) => ({
      decisions: state.decisions.map((d) => (d.id === id ? { ...d, ...patch } : d)),
    }));
  },
}));
