'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { stripLocale } from '@/lib/locale-path';
import { AuthProvider, useAuth } from '@/lib/auth';
import { AccountSyncToast } from '@/components/ui/AccountSyncToast';
import { SessionExpiredToast } from '@/components/ui/SessionExpiredToast';
import { StorageErrorToast } from '@/components/ui/StorageErrorToast';
import { Toast } from '@/components/ui/Toast';
import { initErrorSensors } from '@/lib/error-sensors';
import { useAgentStore } from '@/stores/useAgentStore';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { useProjectStore } from '@/stores/useProjectStore';
import { usePersonaStore } from '@/stores/usePersonaStore';

// Marketing surfaces don't need the app's data graph — booting four stores
// (with Supabase SELECTs for signed-in users) on the landing page taxed the
// first impression for nothing. App routes still warm everything on mount.
const MARKETING_PATHS = new Set(['/', '/login', '/terms', '/privacy']);

function StoreInitializer() {
  const pathname = usePathname();
  const { loading: authLoading } = useAuth();
  const loadAgents = useAgentStore(s => s.loadAgents);
  const loadSettings = useSettingsStore(s => s.loadSettings);
  const loadProjects = useProjectStore(s => s.loadProjects);
  const loadPersonas = usePersonaStore(s => s.loadData);
  const appPath = stripLocale(pathname ?? '/');
  const isMarketing = MARKETING_PATHS.has(appPath);
  const isAuthCallback = appPath.startsWith('/auth/callback');

  useEffect(() => {
    initErrorSensors(); // capture uncaught errors everywhere (incl. marketing pages)
    // Do not let store reads race the service-role anonymous→account transfer.
    // AuthProvider keeps loading=true until claim + local migration finish.
    if (isMarketing || isAuthCallback || authLoading) return;
    loadAgents();
    loadSettings();
    loadProjects();
    loadPersonas();
  }, [isMarketing, isAuthCallback, authLoading, loadAgents, loadSettings, loadProjects, loadPersonas]);

  useEffect(() => {
    // Coalesce: SyncStatus is mounted twice on purpose (desktop + mobile shells),
    // so one `online` event emits two retries and doubles the upload work.
    // Guarding the single consumer covers every emitter, present and future.
    let lastRunAt = 0;
    const retrySync = () => {
      const now = Date.now();
      if (now - lastRunAt < 2000) return;
      lastRunAt = now;
      // The visible retry is deliberately scoped to decision records. Loading
      // unrelated stores in parallel can emit a success that masks a failed
      // project upload. loadAndMerge retries locally-newer project rows.
      loadProjects();
    };
    window.addEventListener('argus:sync-retry', retrySync);
    return () => window.removeEventListener('argus:sync-retry', retrySync);
  }, [loadProjects]);

  return null;
}

function AuthReadinessGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { loading } = useAuth();
  const appPath = stripLocale(pathname ?? '/');
  const canRenderWhileChecking = MARKETING_PATHS.has(appPath) || appPath.startsWith('/auth/callback');

  // App pages have their own store-loading effects, so guarding only the shared
  // StoreInitializer is insufficient. Keep the app surface unmounted until
  // account ownership is settled. Marketing and the callback stay mounted
  // because they drive authentication itself.
  if (loading && !canRenderWhileChecking) {
    const ko = pathname?.startsWith('/ko') === true;
    return (
      <div className="min-h-screen flex items-center justify-center" role="status" aria-live="polite">
        <div className="text-center">
          <div aria-hidden="true" className="w-5 h-5 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin motion-reduce:animate-none mx-auto mb-3" />
          <p className="text-[13px] text-[var(--text-secondary)]">
            {ko ? '계정의 작업을 안전하게 연결하는 중이에요…' : 'Safely connecting your account work...'}
          </p>
        </div>
      </div>
    );
  }

  return children;
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <StoreInitializer />
      <AuthReadinessGate>{children}</AuthReadinessGate>
      <AccountSyncToast />
      {/* System alerts must exist on every viewport. They used to sit inside
          Header's desktop-only controls, so mobile storage failures and lapsed
          sessions were completely silent. */}
      <StorageErrorToast />
      <SessionExpiredToast />
      <Toast />
    </AuthProvider>
  );
}
