'use client';

import { useState, useEffect, useCallback } from 'react';
import { Cloud, CloudOff, Loader2 } from 'lucide-react';
import { useLocale } from '@/hooks/useLocale';
import { useAuth, hasKnownUser } from '@/lib/auth';

type SyncState = 'idle' | 'synced' | 'syncing' | 'offline' | 'error' | 'backup_pending';

/**
 * Sync status indicator — shows Supabase sync health.
 * Listens to custom events dispatched by db operations.
 *
 * Honesty rules (P1-C1 + P0-5):
 * - Starts 'idle' and renders NOTHING until a real sync event arrives — the
 *   green "Synced" is only shown after reportSyncSuccess() confirmed a write.
 * - Lives OUTSIDE the login gate: a signed-out returning user (knew-you flag)
 *   sees an amber "saving to this device only" instead of silence; a
 *   first-time anonymous visitor sees nothing (no badge noise); offline is
 *   shown to everyone.
 */
export function SyncStatus() {
  const locale = useLocale();
  const L = (ko: string, en: string) => locale === 'ko' ? ko : en;
  const { user, loading: authLoading } = useAuth();
  const [state, setState] = useState<SyncState>('idle');
  const [lastError, setLastError] = useState<string | null>(null);
  // Read in an effect (not during render) to avoid a hydration mismatch.
  const [knewYou, setKnewYou] = useState(false);
  useEffect(() => { setKnewYou(hasKnownUser()); }, [user]);

  const handleSyncEvent = useCallback((e: Event) => {
    const detail = (e as CustomEvent).detail;
    if (detail?.status === 'syncing') {
      setState('syncing');
    } else if (detail?.status === 'synced') {
      setState('synced');
      setLastError(null);
    } else if (detail?.status === 'error') {
      setState('error');
      setLastError(detail?.message || L('동기화 실패', 'Sync failed'));
    }
  }, [L]);

  useEffect(() => {
    // Detect online/offline. Coming back online returns to 'idle', not
    // 'synced' — we haven't confirmed a successful write yet (state facts only).
    const handleOnline = () => setState(prev => prev === 'offline' ? 'idle' : prev);
    const handleOffline = () => setState('offline');

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('argus:sync', handleSyncEvent);

    if (!navigator.onLine) setState('offline');

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('argus:sync', handleSyncEvent);
    };
  }, [handleSyncEvent]);

  // P2 honesty: a failed cloud write must NOT auto-flip to a green "Synced" — that's
  // a lie about the user's most important data (the sealed contract may not be in the
  // cloud at all). After the transient window, downgrade red→amber "backup pending"
  // (honest: saved locally, not yet backed up). A real success event clears it to
  // synced; offline is detected separately.
  useEffect(() => {
    if (state !== 'error') return;
    const t = setTimeout(() => {
      if (typeof navigator !== 'undefined' && !navigator.onLine) { setState('offline'); setLastError(null); }
      else setState('backup_pending');
    }, 8000);
    return () => clearTimeout(t);
  }, [state, lastError]);

  // ── Visibility gate (before any badge) ──
  // Offline is a device fact — show it to everyone, signed in or not.
  if (state !== 'offline') {
    if (!user) {
      if (authLoading || !knewYou) return null; // first-time anonymous: no badge noise
      // Signed-out returning user: work IS saving locally, cloud backup is not.
      return (
        <div
          className="inline-flex items-center gap-1.5 text-[11px] px-2 py-0.5 rounded-full border text-[var(--warning)] bg-[var(--warning)]/10 border-[var(--warning)]/30"
          title={L('로그인하면 클라우드 백업이 이어져요', 'Sign in to resume cloud backup')}
        >
          <CloudOff size={12} />
          <span>{L('이 기기에만 저장 중', 'Saving to this device only')}</span>
        </div>
      );
    }
    // Signed in but no sync event yet this session — say nothing rather than
    // an unverified green "Synced".
    if (state === 'idle') return null;
  }

  const config = {
    synced: {
      icon: <Cloud size={12} />,
      color: 'text-[var(--success)]',
      bg: 'bg-[var(--success)]/10',
      border: 'border-[var(--success)]/25',
      label: L('동기화됨', 'Synced'),
    },
    syncing: {
      icon: <Loader2 size={12} className="animate-spin" />,
      color: 'text-[var(--ai-fg)]',
      bg: 'bg-[var(--ai)]',
      border: 'border-[var(--ai-fg)]/20',
      label: L('동기화 중...', 'Syncing...'),
    },
    offline: {
      icon: <CloudOff size={12} />,
      color: 'text-[var(--warning)]',
      bg: 'bg-[var(--warning)]/10',
      border: 'border-[var(--warning)]/30',
      label: L('오프라인', 'Offline'),
    },
    error: {
      icon: <CloudOff size={12} />,
      color: 'text-[var(--danger)]',
      bg: 'bg-[var(--danger)]/10',
      border: 'border-[var(--danger)]/25',
      label: L('동기화 실패', 'Sync failed'),
    },
    backup_pending: {
      icon: <CloudOff size={12} />,
      color: 'text-[var(--warning)]',
      bg: 'bg-[var(--warning)]/10',
      border: 'border-[var(--warning)]/30',
      label: L('이 기기에 저장됨 · 백업 보류', 'Saved locally · backup pending'),
    },
  }[state as Exclude<SyncState, 'idle'>]; // 'idle' returned null above

  return (
    <div
      className={`inline-flex items-center gap-1.5 text-[11px] px-2 py-0.5 rounded-full border ${config.color} ${config.bg} ${config.border}`}
      title={lastError || config.label}
    >
      {config.icon}
      <span>{config.label}</span>
    </div>
  );
}
