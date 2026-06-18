'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { AuthProvider } from '@/lib/auth';
import { UnlockToast } from '@/components/agents/UnlockToast';
import { AccountSyncToast } from '@/components/ui/AccountSyncToast';
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
  const isMarketing = MARKETING_PATHS.has(pathname ?? '/');

  useEffect(() => {
    if (isMarketing) return;
    loadAgents();
    loadSettings();
    loadProjects();
    loadPersonas();
  }, [isMarketing, loadAgents, loadSettings, loadProjects, loadPersonas]);

  return null;
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <StoreInitializer />
      {children}
      <UnlockToast />
      <AccountSyncToast />
    </AuthProvider>
  );
}
