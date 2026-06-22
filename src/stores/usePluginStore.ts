import { create } from 'zustand';
import { fetchFromSupabase } from '@/lib/db';
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
}

export const usePluginStore = create<PluginState>((set) => ({
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
}));
