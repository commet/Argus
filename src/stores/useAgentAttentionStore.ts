'use client';

/**
 * Lightweight cross-component store for "the agents are paying attention" cues.
 *
 * Used by:
 * - Input flows (Q/A, QuickChat, retry) — call `ping(source)` to make every active
 *   agent row flash briefly, communicating that the user's input was received.
 * - Traceability hover — `setHoveredAttribution({ source: 'section' | 'agent', id })`
 *   so the sidebar and the draft can highlight each other bi-directionally.
 *
 * Not persisted; purely ephemeral state.
 */

import { useEffect } from 'react';
import { create } from 'zustand';

export type PingSource =
  | 'answer'
  | 'chat'
  | 'retry'
  | 'deploy'
  // Completion events — fire a toast so users notice new output below the fold.
  | 'workers_done'
  | 'mix_done'
  | 'dm_ready'
  | 'final_done';

export type AttributionHover =
  | { kind: 'section'; sectionIndex: number; contributorIds: string[] }
  | { kind: 'sentence'; sectionIndex: number; sentenceIndex: number; contributorIds: string[] }
  | { kind: 'agent'; workerId: string }
  | null;

interface AgentAttentionState {
  // Input → agent ping
  lastPingAt: number;
  lastPingSource: PingSource | null;
  ping: (source: PingSource) => void;

  // Review focus ↔ rail station — the one agent currently being read.
  // Orthogonal to `hovered` (which is done-only draft↔agent attribution): focus
  // is click-driven and persistent, hover is transient. The body review stepper
  // and the rail roster both project from this single id, so clicking a rail row
  // and reading a body card are one selection. id-based (not index) so it stays
  // stable when the crew list re-sorts.
  focusedWorkerId: string | null;
  setFocusedWorker: (id: string | null) => void;

  // Draft ↔ sidebar hover attribution
  hovered: AttributionHover;
  /**
   * When true, hover is "pinned" — tap-to-lock on touch devices. Hover leave
   * events don't clear it; only an explicit tap elsewhere (handled globally)
   * or a toggle tap on the same element does.
   */
  sticky: boolean;
  setHovered: (h: AttributionHover, sticky?: boolean) => void;
  clearHovered: () => void;
}

export const useAgentAttentionStore = create<AgentAttentionState>((set, get) => ({
  lastPingAt: 0,
  lastPingSource: null,
  ping: (source) => set({ lastPingAt: Date.now(), lastPingSource: source }),

  focusedWorkerId: null,
  setFocusedWorker: (id) => set({ focusedWorkerId: id }),

  hovered: null,
  sticky: false,
  setHovered: (h, sticky = false) => {
    // Sticky hover is a hard lock — transient hover events (hover-start/end)
    // can NOT override it. Only another sticky set or explicit clearHovered()
    // can override. This keeps a tapped section pinned while the user peeks
    // around with the mouse on desktop.
    const current = get();
    if (current.sticky && !sticky) return;
    set({ hovered: h, sticky });
  },
  clearHovered: () => set({ hovered: null, sticky: false }),
}));

/**
 * useAttributionClickOutside — document-level listener that clears sticky hover
 * when the user clicks outside any element marked `data-attribution-source`.
 *
 * Mount this hook once at a high-enough level (e.g. ProgressiveFlow) so it
 * lives through the entire workspace session. Only acts when sticky is true;
 * desktop hover behavior is untouched.
 */
export function useAttributionClickOutside() {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onDocClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      const store = useAgentAttentionStore.getState();
      if (!store.sticky) return;
      // If the click landed inside any attribution source, let that element's
      // own onTap decide what to do (toggle/replace). Otherwise clear.
      if (target && target.closest?.('[data-attribution-source]')) return;
      store.clearHovered();
    };
    document.addEventListener('click', onDocClick, true); // capture phase — beats stopPropagation
    return () => document.removeEventListener('click', onDocClick, true);
  }, []);
}

