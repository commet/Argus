'use client';

import { create } from 'zustand';
import { supabase, getCurrentUserId } from '@/lib/supabase';
import { timeoutSignal } from '@/lib/timeout-signal';

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
  loadError: boolean;

  loadConnections: () => Promise<void>;
  startConnect: () => Promise<{ ok: boolean; link?: string; error?: string }>;
  disconnect: (id: string) => Promise<{ ok: boolean }>;
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
  loadError: false,

  loadConnections: async () => {
    const userId = await getCurrentUserId();
    // Anonymous → no connections, but the query DID resolve: mark loaded so the
    // UI shows the login hint, not a perpetual "not connected" or a spinner.
    if (!userId) { set({ connections: [], loaded: true, loadError: false }); return; }
    // ALWAYS set loaded, even if the fetch REJECTS (network/DNS failure throws
    // rather than resolving with {error}). Without the try/catch a rejected query
    // would leave loaded=false forever → a permanent "연결 확인 중…" spinner.
    try {
      const { data, error } = await supabase
        .from('telegram_connections')
        .select('id, chat_id, chat_title, chat_type, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      if (error) { set({ connections: [], loaded: true, loadError: true }); return; }
      set({ connections: data || [], loaded: true, loadError: false });
    } catch {
      set({ connections: [], loaded: true, loadError: true });
    }
  },

  startConnect: async () => {
    // P1-C4: a network throw here used to propagate to the caller and skip
    // its setPending(false) — one failed fetch meant a permanent spinner.
    // Always resolve with a value; the caller maps 'network' to honest copy.
    try {
      const token = await getAuthToken();
      if (!token) return { ok: false, error: 'Not authenticated' };
      const res = await fetch('/api/telegram/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({}),
        signal: timeoutSignal(),
      });
      const data = await res.json();
      if (res.ok && data.link) return { ok: true, link: data.link };
      if (res.status === 503) return { ok: false, error: 'unconfigured' };
      return { ok: false, error: data.error || 'Could not start connect flow' };
    } catch {
      return { ok: false, error: 'network' };
    }
  },

  disconnect: async (id: string) => {
    const userId = await getCurrentUserId();
    if (!userId) return { ok: false };
    const { error } = await supabase.from('telegram_connections').delete().eq('id', id).eq('user_id', userId);
    if (error) return { ok: false };
    set({ connections: get().connections.filter((c) => c.id !== id) });
    return { ok: true };
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
        signal: timeoutSignal(),
      });
      const data = await res.json();
      if (data.ok) return { ok: true };
      // Stale connection was dropped server-side — refresh local list.
      if (res.status === 409) await get().loadConnections();
      return { ok: false, error: data.error || 'Failed to send' };
    } catch {
      return { ok: false, error: 'Network error' };
    } finally {
      set({ sending: false });
    }
  },

  isConnected: () => get().connections.length > 0,
}));
