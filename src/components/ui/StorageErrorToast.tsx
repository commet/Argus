'use client';

/**
 * StorageErrorToast — surfaces a localStorage write failure (especially
 * QuotaExceededError) so a swallowed write no longer silently loses the
 * user's work ("don't lose your thinking" is the product thesis).
 *
 * Listens to the `argus:storage-error` CustomEvent dispatched by setStorage()
 * in lib/storage.ts. Uses a window CustomEvent (no store import) on purpose —
 * storage.ts must stay free of the circular-dependency risk it documents.
 *
 * Mounted once in the global Header.
 */

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle } from 'lucide-react';
import { useLocale } from '@/hooks/useLocale';

const VISIBLE_MS = 6000;

export function StorageErrorToast() {
  const locale = useLocale();
  const L = (ko: string, en: string) => (locale === 'ko' ? ko : en);
  const [toast, setToast] = useState<{ at: number; quota: boolean } | null>(null);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      setToast({ at: Date.now(), quota: !!detail?.quota });
    };
    window.addEventListener('argus:storage-error', handler);
    return () => window.removeEventListener('argus:storage-error', handler);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), VISIBLE_MS);
    return () => clearTimeout(t);
  }, [toast]);

  const message = toast?.quota
    ? L('저장 공간이 가득 차 일부 변경이 저장되지 않았어요. 오래된 항목을 정리해 주세요.',
        'Storage is full — some changes were not saved. Please clear old items.')
    : L('변경 사항을 저장하지 못했어요. 다시 시도해 주세요.',
        'Could not save your changes. Please try again.');

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
          className="fixed top-14 right-4 z-50 flex items-start gap-2 max-w-xs rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 shadow-md"
        >
          <AlertTriangle size={14} className="mt-0.5 shrink-0 text-amber-600" />
          <span className="text-[12px] leading-snug text-amber-800">{message}</span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
