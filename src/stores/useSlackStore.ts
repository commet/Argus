'use client';

import { create } from 'zustand';
import { supabase } from '@/lib/supabase';
import { getCurrentUserId } from '@/lib/supabase';

export interface SlackConnection {
  id: string;
  team_id: string;
  team_name: string;
  created_at: string;
}

export interface SlackChannel {
  id: string;
  name: string;
  is_private: boolean;
}

interface SlackState {
  connections: SlackConnection[];
  channels: SlackChannel[];
  channelsLoading: boolean;
  sending: boolean;
  /** False until loadConnections resolves once — distinguishes "still fetching"
   *  from "loaded and empty" so the panel doesn't flash a false "not connected". */
  loaded: boolean;

  loadConnections: () => Promise<void>;
  disconnect: (connectionId: string) => Promise<void>;
  loadChannels: () => Promise<void>;
  sendToSlack: (channelId: string, title: string, content: string) => Promise<{ ok: boolean; error?: string }>;
  isConnected: () => boolean;
}

async function getAuthToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token || null;
}

export const useSlackStore = create<SlackState>((set, get) => ({
  connections: [],
  channels: [],
  channelsLoading: false,
  sending: false,
  loaded: false,

  loadConnections: async () => {
    const userId = await getCurrentUserId();
    if (!userId) { set({ connections: [], loaded: true }); return; }

    // ALWAYS set loaded, even on a rejected fetch (see useTelegramStore) — else a
    // network failure leaves loaded=false forever and the panel spins indefinitely.
    try {
      const { data } = await supabase
        .from('slack_connections')
        .select('id, team_id, team_name, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      set({ connections: data || [], loaded: true });
    } catch {
      set({ loaded: true });
    }
  },

  disconnect: async (connectionId: string) => {
    const userId = await getCurrentUserId();
    if (!userId) return;

    await supabase
      .from('slack_connections')
      .delete()
      .eq('id', connectionId)
      .eq('user_id', userId);

    set({ connections: get().connections.filter(c => c.id !== connectionId), channels: [] });
  },

  loadChannels: async () => {
    set({ channelsLoading: true });
    try {
      const token = await getAuthToken();
      if (!token) return;

      const res = await fetch('/api/slack/channels', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.channels) {
        set({ channels: data.channels });
      } else if (data.error) {
        // Connection expired
        if (res.status === 401) {
          set({ connections: [], channels: [] });
        }
      }
    } finally {
      set({ channelsLoading: false });
    }
  },

  sendToSlack: async (channelId: string, title: string, content: string) => {
    set({ sending: true });
    try {
      const token = await getAuthToken();
      if (!token) return { ok: false, error: 'Not authenticated' };

      const res = await fetch('/api/slack/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ channelId, title, content }),
      });

      const data = await res.json();
      if (data.ok) return { ok: true };

      // Handle revoked token
      if (res.status === 401) {
        set({ connections: [], channels: [] });
      }
      return { ok: false, error: data.error || 'Failed to send' };
    } finally {
      set({ sending: false });
    }
  },

  isConnected: () => get().connections.length > 0,
}));
