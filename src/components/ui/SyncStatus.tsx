'use client';

import { useState, useEffect, useCallback } from 'react';
import { Cloud, CloudOff, Loader2 } from 'lucide-react';
import { useLocale } from '@/hooks/useLocale';

type SyncState = 'synced' | 'syncing' | 'offline' | 'error';

/**
 * Sync status indicator — shows Supabase sync health.
 * Listens to custom events dispatched by db operations.
 */
export function SyncStatus() {
  const locale = useLocale();
  const L = (ko: string, en: string) => locale === 'ko' ? ko : en;
  const [state, setState] = useState<SyncState>('synced');
  const [lastError, setLastError] = useState<string | null>(null);

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
    // Detect online/offline
    const handleOnline = () => setState(prev => prev === 'offline' ? 'synced' : prev);
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

  // Auto-recover from a transient sync-write failure so the badge never sticks red.
  // (For a localStorage-first app a failed cloud write isn't fatal — data is local —
  // so the error is a transient signal, not a permanent state.)
  useEffect(() => {
    if (state !== 'error') return;
    const t = setTimeout(() => {
      setState(typeof navigator !== 'undefined' && !navigator.onLine ? 'offline' : 'synced');
      setLastError(null);
    }, 8000);
    return () => clearTimeout(t);
  }, [state, lastError]);

  const config = {
    synced: {
      icon: <Cloud size={12} />,
      color: 'text-green-600',
      bg: 'bg-green-50',
      border: 'border-green-200',
      label: L('동기화됨', 'Synced'),
    },
    syncing: {
      icon: <Loader2 size={12} className="animate-spin" />,
      color: 'text-blue-600',
      bg: 'bg-blue-50',
      border: 'border-blue-200',
      label: L('동기화 중...', 'Syncing...'),
    },
    offline: {
      icon: <CloudOff size={12} />,
      color: 'text-amber-600',
      bg: 'bg-amber-50',
      border: 'border-amber-200',
      label: L('오프라인', 'Offline'),
    },
    error: {
      icon: <CloudOff size={12} />,
      color: 'text-red-600',
      bg: 'bg-red-50',
      border: 'border-red-200',
      label: L('동기화 실패', 'Sync failed'),
    },
  }[state];

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
