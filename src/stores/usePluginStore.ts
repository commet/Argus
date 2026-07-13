import { create } from 'zustand';
import { fetchFromSupabase } from '@/lib/db';
import { supabase, getCurrentUserId } from '@/lib/supabase';
import { generateId } from '@/lib/uuid';
import { fold } from '@/lib/decision-kernel';
import {
  closePluginRecord,
  deferPluginReturn,
  recordPluginAnswer,
  reforgePluginDecision,
  type PluginSemanticRecord,
} from '@/lib/semantic-plugin';
import type { PluginDecision, PluginBearing, PluginEvent } from './types';

function semanticRecords(events: PluginEvent[]): Record<string, PluginSemanticRecord> {
  const byDecision: Record<string, PluginSemanticRecord> = {};
  for (const event of events) {
    if (event.event !== 'semantic_v3' || !event.plugin_decision_id) continue;
    const semantic = (event.payload as { semantic_events?: unknown }).semantic_events;
    if (!Array.isArray(semantic)) continue;
    const current = byDecision[event.plugin_decision_id];
    const next = [...(current?.events ?? []), ...semantic] as PluginSemanticRecord['events'];
    const state = fold(next);
    const judgment = [...state.judgments.values()][0];
    if (!judgment?.active_return_contract_id) continue;
    byDecision[event.plugin_decision_id] = {
      judgment_id: judgment.id,
      return_contract_id: judgment.active_return_contract_id,
      events: next,
    };
  }
  return byDecision;
}

interface PluginState {
  decisions: PluginDecision[];
  bearings: PluginBearing[];
  semantic: Record<string, PluginSemanticRecord>;
  loading: boolean;
  loaded: boolean;
  loadError: boolean;
  loadData: () => Promise<void>;
  reforgeDecision: (id: string) => Promise<void>;
  recordDecisionAnswer: (id: string, outcome: 'happened' | 'avoided' | 'partial') => Promise<void>;
  deferDecision: (id: string, checkBy: string) => Promise<void>;
  closeDecisionRecord: (id: string) => Promise<void>;
}

export const usePluginStore = create<PluginState>((set, get) => {
  async function writeSemantic(decision: PluginDecision, events: PluginSemanticRecord['events']) {
    const userId = await getCurrentUserId();
    if (!userId) throw new Error('not_logged_in');
    const eventId = `web:plugin:v3:${decision.ledger_id}:${generateId()}`;
    const { error } = await supabase.from('plugin_events').insert({
      id: generateId(), user_id: userId, plugin_decision_id: decision.id,
      ledger_id: decision.ledger_id, event_id: eventId, event: 'semantic_v3',
      payload: { semantic_events: events }, source: 'webapp',
    });
    if (error) throw error;
    return events;
  }

  function current(id: string) {
    const decision = get().decisions.find((item) => item.id === id);
    if (!decision?.ledger_id) throw new Error('decision_not_found');
    return decision;
  }

  return {
    decisions: [], bearings: [], semantic: {}, loading: false, loaded: false, loadError: false,
    loadData: async () => {
      set({ loading: true, loadError: false });
      try {
        const [decisions, bearings, events] = await Promise.all([
          fetchFromSupabase<PluginDecision>('plugin_decisions'),
          fetchFromSupabase<PluginBearing>('plugin_bearings'),
          fetchFromSupabase<PluginEvent>('plugin_events'),
        ]);
        set({ decisions, bearings, semantic: semanticRecords(events), loading: false, loaded: true, loadError: false });
      } catch {
        set({ loading: false, loaded: true, loadError: true });
      }
    },
    reforgeDecision: async (id) => {
      const decision = current(id);
      if (get().semantic[id]) return;
      const record = reforgePluginDecision(decision, generateId());
      await writeSemantic(decision, record.events);
      set((state) => ({ semantic: { ...state.semantic, [id]: record } }));
    },
    recordDecisionAnswer: async (id, outcome) => {
      const decision = current(id);
      const record = get().semantic[id];
      if (!record) throw new Error('semantic_reforge_required');
      const state = fold(record.events);
      const judgment = state.judgments.get(record.judgment_id);
      if (judgment?.resolution) throw new Error('answer_already_recorded');
      const events = recordPluginAnswer(decision, record, generateId(), outcome);
      await writeSemantic(decision, events);
      set((state) => ({ semantic: { ...state.semantic, [id]: { ...record, events: [...record.events, ...events] } } }));
    },
    deferDecision: async (id, checkBy) => {
      const decision = current(id);
      const record = get().semantic[id];
      if (!record) throw new Error('semantic_reforge_required');
      const events = deferPluginReturn(decision, record, generateId(), checkBy);
      await writeSemantic(decision, events);
      set((state) => ({ semantic: { ...state.semantic, [id]: { ...record, events: [...record.events, ...events] } } }));
    },
    closeDecisionRecord: async (id) => {
      const decision = current(id);
      const record = get().semantic[id];
      if (!record) throw new Error('semantic_reforge_required');
      const judgment = fold(record.events).judgments.get(record.judgment_id);
      if (!judgment?.resolution) throw new Error('resolution_required');
      const events = closePluginRecord(decision, record, generateId(), judgment.resolution.id);
      await writeSemantic(decision, events);
      set((state) => ({ semantic: { ...state.semantic, [id]: { ...record, events: [...record.events, ...events] } } }));
    },
  };
});
