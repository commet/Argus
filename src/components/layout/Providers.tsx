'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { stripLocale } from '@/lib/locale-path';
import { AuthProvider } from '@/lib/auth';
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
  const loadAgents = useAgentStore(s => s.loadAgents);
  const loadSettings = useSettingsStore(s => s.loadSettings);
  const loadProjects = useProjectStore(s => s.loadProjects);
  const loadPersonas = usePersonaStore(s => s.loadData);
  const isMarketing = MARKETING_PATHS.has(stripLocale(pathname ?? '/'));

  useEffect(() => {
    initErrorSensors(); // capture uncaught errors everywhere (incl. marketing pages)
    if (isMarketing) return;
    loadAgents();
    loadSettings();
    loadProjects();
    loadPersonas();
  }, [isMarketing, loadAgents, loadSettings, loadProjects, loadPersonas]);

  useEffect(() => {
    const retrySync = () => {
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

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <StoreInitializer />
      {children}
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
