'use client';

/**
 * AccountSyncToast — confirms that local-first work was migrated to the account
 * on sign-in ("your thinking is now saved to your account"). Listens for the
 * `argus:account-synced` CustomEvent dispatched after migrateLocalToAccount()
 * (lib/account-migration.ts), mirroring StorageErrorToast's window-event pattern
 * to avoid coupling auth ↔ stores. Mounted once globally in Providers.
 */

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check } from 'lucide-react';
import { useLocale } from '@/hooks/useLocale';

const VISIBLE_MS = 5000;

export function AccountSyncToast() {
  const locale = useLocale();
  const L = (ko: string, en: string) => (locale === 'ko' ? ko : en);
  const [toast, setToast] = useState<{ at: number; count: number; partial: boolean } | null>(null);

  useEffect(() => {
    const handler = (e: Event) => {
      const count = (e as CustomEvent).detail?.count ?? 0;
      const partial = !!(e as CustomEvent).detail?.partial;
      if (count > 0) setToast({ at: Date.now(), count, partial });
    };
    window.addEventListener('argus:account-synced', handler);
    return () => window.removeEventListener('argus:account-synced', handler);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), VISIBLE_MS);
    return () => clearTimeout(t);
  }, [toast]);

  return (
    <AnimatePresence>
      {toast && (
        <motion.div
          key={toast.at}
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          role="status"
          aria-live="polite"
          className="fixed top-14 right-4 z-50 flex items-start gap-2 max-w-xs rounded-lg border border-[var(--border-subtle)] bg-[var(--surface)] px-3 py-2 shadow-md"
        >
          <Check size={14} className="mt-0.5 shrink-0 text-[var(--primary)]" />
          <span className="text-[12px] leading-snug text-[var(--text-primary)]">
            {toast.partial
              ? /* 04 S8: at least one push failed — don't claim "saved"; point at the
                   sync badge, which owns the honest state. */
                L(`결정 ${toast.count}건을 계정으로 옮기는 중이에요 — 상태는 상단 동기화 표시에서 확인돼요.`,
                  `Moving ${toast.count} decision${toast.count === 1 ? '' : 's'} to your account — the sync indicator up top shows the status.`)
              : L(`결정 ${toast.count}건을 계정에 저장했어요 — 이제 어디서나 이어서.`,
                  `Saved ${toast.count} decision${toast.count === 1 ? '' : 's'} to your account — continue anywhere now.`)}
          </span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
