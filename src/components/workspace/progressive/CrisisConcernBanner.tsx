'use client';

/**
 * CrisisConcernBanner — the deterministic crisis backstop's visible surface
 * (decision 3: warn + a real resource, NEVER a hard block).
 *
 * Rendered at the top of the live progressive flow whenever crisis-gate.ts's
 * high-precision classifier fired on the round-0 input. It shows the concern +
 * a real resource (both come from formatConcernMessage, so the hotline copy
 * lives in exactly one place and re-localizes on reload). While `blocking` is
 * true the decision machinery below is suppressed; one conscious "continue
 * anyway" tap re-enters the normal flow — and the resource stays pinned even
 * then. The copy is the user's SAFETY, surfaced as a concern; it is never a
 * verdict about who they are (the triggering substring is never shown).
 */

import { motion } from 'framer-motion';
import { AlertTriangle } from 'lucide-react';
import { formatConcernMessage, type CrisisSignal } from '@/lib/crisis-gate';

export function CrisisConcernBanner({
  crisis,
  locale,
  blocking,
  onContinue,
}: {
  crisis: CrisisSignal;
  locale: 'ko' | 'en';
  /** True until the user consciously continues — gates the "continue" affordance. */
  blocking: boolean;
  onContinue: () => void;
}) {
  if (!crisis.isCrisis || !crisis.category) return null;
  const L = (ko: string, en: string) => (locale === 'ko' ? ko : en);

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className="mx-4 mt-3 p-4 rounded-xl border border-amber-500/40 bg-amber-500/5"
      role="note"
    >
      <div className="flex items-start gap-2.5">
        <AlertTriangle size={16} className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0 space-y-2.5">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-400">
            {L('잠깐만요', 'One moment')}
          </p>
          <p className="text-[13px] text-[var(--text-primary)] leading-[1.6] whitespace-pre-wrap">
            {formatConcernMessage(crisis.category, locale)}
          </p>
          {blocking && (
            <button
              onClick={onContinue}
              className="text-[12px] font-medium text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] underline underline-offset-2 cursor-pointer transition-colors"
            >
              {L('그래도 계속 진행할게요', 'Continue anyway')}
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
}
