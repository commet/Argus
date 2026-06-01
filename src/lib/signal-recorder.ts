/**
 * Signal Recorder — Navigator's Journal
 *
 * Fire-and-forget quality signal recording.
 * Captures implicit user behavior signals for learning loops.
 *
 * Pattern: localStorage (instant, capped) + Supabase (async, permanent)
 */

import { getStorage, setStorage, STORAGE_KEYS } from './storage';
import { insertToSupabase } from './db';
import { generateId } from './uuid';
import type { QualitySignal } from '@/stores/types';

const MAX_LOCAL_SIGNALS = 500;

/**
 * Record a quality signal. Never blocks UI.
 */
export function recordSignal(
  signal: Omit<QualitySignal, 'id' | 'created_at'>
): void {
  const full: QualitySignal = {
    ...signal,
    id: generateId(),
    created_at: new Date().toISOString(),
  };

  // localStorage — capped FIFO
  const local = getStorage<QualitySignal[]>(STORAGE_KEYS.QUALITY_SIGNALS, []);
  const updated = [...local, full];
  if (updated.length > MAX_LOCAL_SIGNALS) {
    updated.splice(0, updated.length - MAX_LOCAL_SIGNALS);
  }
  setStorage(STORAGE_KEYS.QUALITY_SIGNALS, updated);

  // Supabase — fire-and-forget
  insertToSupabase('quality_signals', full);
}

/**
 * Get signals from localStorage, optionally filtered.
 */
export function getSignals(filter?: {
  tool?: string;
  signal_type?: string;
  project_id?: string;
}): QualitySignal[] {
  const all = getStorage<QualitySignal[]>(STORAGE_KEYS.QUALITY_SIGNALS, []);
  if (!filter) return all;
  return all.filter(s =>
    (!filter.tool || s.tool === filter.tool) &&
    (!filter.signal_type || s.signal_type === filter.signal_type) &&
    (!filter.project_id || s.project_id === filter.project_id)
  );
}

/**
 * Get signals by type, most recent first.
 */
export function getSignalsByType(signal_type: string, limit = 50): QualitySignal[] {
  return getSignals({ signal_type })
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, limit);
}
