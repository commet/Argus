'use client';

import { create } from 'zustand';
import { supabase, getCurrentUserId } from '@/lib/supabase';

export interface TelegramConnection {
  id: string;
  chat_id: string;
  chat_title: string | null;
  chat_type: string | null;
  created_at: string;
}

interface TelegramState {
  connections: TelegramConnection[];
  sending: boolean;
  /** False until loadConnections has resolved once. Lets the UI tell "still
   *  fetching" apart from "loaded and genuinely empty" — without it, the panel
   *  flashed "아직 연결되지 않았어요" during the Supabase round-trip even for users
   *  who ARE connected. */
  loaded: boolean;

  loadConnections: () => Promise<void>;
  startConnect: () => Promise<{ ok: boolean; link?: string; error?: string }>;
  disconnect: (id: string) => Promise<void>;
  sendToTelegram: (
    title: string,
    content: string,
    opts?: { chatId?: string; context?: string },
  ) => Promise<{ ok: boolean; error?: string }>;
  isConnected: () => boolean;
}

async function getAuthToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token || null;
}

export const useTelegramStore = create<TelegramState>((set, get) => ({
  connections: [],
  sending: false,
  loaded: false,

  loadConnections: async () => {
    const userId = await getCurrentUserId();
    // Anonymous → no connections, but the query DID resolve: mark loaded so the
    // UI shows the login hint, not a perpetual "not connected" or a spinner.
    if (!userId) { set({ connections: [], loaded: true }); return; }
    // ALWAYS set loaded, even if the fetch REJECTS (network/DNS failure throws
    // rather than resolving with {error}). Without the try/catch a rejected query
    // would leave loaded=false forever → a permanent "연결 확인 중…" spinner.
    try {
      const { data } = await supabase
        .from('telegram_connections')
        .select('id, chat_id, chat_title, chat_type, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      set({ connections: data || [], loaded: true });
    } catch {
      set({ loaded: true });
    }
  },

  startConnect: async () => {
    const token = await getAuthToken();
    if (!token) return { ok: false, error: 'Not authenticated' };
    const res = await fetch('/api/telegram/connect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({}),
    });
    const data = await res.json();
    if (res.ok && data.link) return { ok: true, link: data.link };
    if (res.status === 503) return { ok: false, error: 'unconfigured' };
    return { ok: false, error: data.error || 'Could not start connect flow' };
  },

  disconnect: async (id: string) => {
    const userId = await getCurrentUserId();
    if (!userId) return;
    await supabase.from('telegram_connections').delete().eq('id', id).eq('user_id', userId);
    set({ connections: get().connections.filter((c) => c.id !== id) });
  },

  sendToTelegram: async (title, content, opts = {}) => {
    set({ sending: true });
    try {
      const token = await getAuthToken();
      if (!token) return { ok: false, error: 'Not authenticated' };
      const res = await fetch('/api/telegram/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ chatId: opts.chatId, title, content, context: opts.context }),
      });
      const data = await res.json();
      if (data.ok) return { ok: true };
      // Stale connection was dropped server-side — refresh local list.
      if (res.status === 409) await get().loadConnections();
      return { ok: false, error: data.error || 'Failed to send' };
    } finally {
      set({ sending: false });
    }
  },

  isConnected: () => get().connections.length > 0,
}));
