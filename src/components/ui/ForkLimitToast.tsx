'use client';

/**
 * ForkLimitToast — surfaces the branch (course) cap so a refused fork no
 * longer fails silently. `forkBranch` returns null at MAX_BRANCHES and the
 * "fork a new course" action did nothing visible; this makes the limit legible
 * and tells the user how to recover (delete a course first).
 *
 * Listens to the `argus:fork-blocked` CustomEvent dispatched by forkBranch in
 * stores/useProgressiveStore.ts. Uses a window CustomEvent (no store import)
 * so the store stays free of a component dependency — same pattern as
 * StorageErrorToast.
 *
 * Mounted once in the global Header.
 */

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { GitBranch } from 'lucide-react';
import { useLocale } from '@/hooks/useLocale';

const VISIBLE_MS = 5000;

export function ForkLimitToast() {
  const locale = useLocale();
  const L = (ko: string, en: string) => (locale === 'ko' ? ko : en);
  const [toast, setToast] = useState<{ at: number; max: number } | null>(null);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      setToast({ at: Date.now(), max: Number(detail?.max) || 0 });
    };
    window.addEventListener('argus:fork-blocked', handler);
    return () => window.removeEventListener('argus:fork-blocked', handler);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), VISIBLE_MS);
    return () => clearTimeout(t);
  }, [toast]);

  const message = toast?.max
    ? L(`항로는 최대 ${toast.max}개까지 만들 수 있어요. 기존 항로를 정리하면 새로 낼 수 있어요.`,
        `You can keep up to ${toast.max} courses. Delete one to start a new course.`)
    : L('더 이상 새 항로를 만들 수 없어요. 기존 항로를 정리해 주세요.',
        'Cannot create another course. Please delete an existing one.');

  return (
    <AnimatePresence>
      {toast && (
        <motion.div
          key={toast.at}
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          role="alert"
          aria-live="assertive"
          className="fixed top-14 right-4 z-50 flex items-start gap-2 max-w-xs rounded-lg border border-[var(--accent)]/40 bg-[var(--surface)] px-3 py-2 shadow-md"
        >
          <GitBranch size={14} className="mt-0.5 shrink-0 text-[var(--accent)]" />
          <span className="text-[12px] leading-snug text-[var(--text-secondary)]">{message}</span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
