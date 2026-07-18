'use client';

import { useEffect, useState, useCallback, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, AlertTriangle, Info, X } from 'lucide-react';
import type { ToastVariant } from '@/lib/toast';
import { useLocale } from '@/hooks/useLocale';

interface ToastItem { id: number; message: string; variant: ToastVariant }

const STYLE: Record<ToastVariant, { box: string; icon: ReactNode }> = {
  info: { box: 'border-[var(--border)] bg-[var(--surface)] text-[var(--text-primary)]', icon: <Info size={14} className="text-[var(--accent)]" /> },
  success: { box: 'border-[var(--success)]/30 bg-[var(--success)]/10 text-[var(--success)]', icon: <Check size={14} /> },
  error: { box: 'border-[var(--danger)]/30 bg-[var(--danger)]/10 text-[var(--danger)]', icon: <AlertTriangle size={14} /> },
};

let seq = 0;

/** Global toast renderer. Mount once (in Header, alongside the other toasts). */
export function Toast() {
  const locale = useLocale();
  const [items, setItems] = useState<ToastItem[]>([]);
  const remove = useCallback((id: number) => setItems((xs) => xs.filter((x) => x.id !== id)), []);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as { message?: string; variant?: ToastVariant } | undefined;
      if (!detail?.message) return;
      const id = ++seq;
      setItems((xs) => [...xs, { id, message: detail.message!, variant: detail.variant ?? 'info' }]);
      setTimeout(() => remove(id), 4600);
    };
    window.addEventListener('argus:toast', handler);
    return () => window.removeEventListener('argus:toast', handler);
  }, [remove]);

  return (
    <div className="fixed top-14 right-4 z-[60] flex flex-col gap-2 max-w-xs pointer-events-none">
      <AnimatePresence initial={false}>
        {items.map((t) => {
          const s = STYLE[t.variant];
          return (
            <motion.div
              key={t.id}
              layout
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              role="status"
              aria-live="polite"
              className={`pointer-events-auto flex items-start gap-2 rounded-lg border px-3 py-2 shadow-[var(--shadow-md)] ${s.box}`}
            >
              <span className="mt-0.5 shrink-0">{s.icon}</span>
              <span className="text-[12px] leading-snug flex-1">{t.message}</span>
              <button onClick={() => remove(t.id)} aria-label={locale === 'ko' ? '닫기' : 'Close'} className="shrink-0 opacity-70 hover:opacity-100 cursor-pointer transition-opacity">
                <X size={12} />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
