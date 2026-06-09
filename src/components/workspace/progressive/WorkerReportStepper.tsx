'use client';

/**
 * WorkerReportStepper — the one-at-a-time crew-review stepper lifted out of
 * ProgressiveFlow. Derives its cursor from the shared focus channel
 * (focusedWorkerId) so the rail and the body card stay one selection, and
 * renders the current WorkerReportBlock with its review actions. Parent keeps
 * the deployPhase/final_ guard; behaviour-preserving (returns null on an empty
 * crew exactly as the inline IIFE did).
 */

import type { Dispatch, SetStateAction, RefObject } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { WorkerReportBlock } from './WorkerCard';
import { useLocale } from '@/hooks/useLocale';
import { EASE } from './shared/constants';
import type { WorkerTask } from '@/stores/types';
import type { useWorkerActions } from '@/hooks/useWorkerActions';
import type { PoolModalState } from './TeamAssignmentModal';

interface WorkerReportStepperProps {
  workers: WorkerTask[];
  focusedWorkerId: string | null;
  setFocusedWorker: (id: string | null) => void;
  workerActions: ReturnType<typeof useWorkerActions>;
  setPoolModal: Dispatch<SetStateAction<PoolModalState>>;
  workerSectionRef: RefObject<HTMLDivElement | null>;
}

export function WorkerReportStepper({ workers, focusedWorkerId, setFocusedWorker, workerActions, setPoolModal, workerSectionRef }: WorkerReportStepperProps) {
  const locale = useLocale();
  const L = (ko: string, en: string) => (locale === 'ko' ? ko : en);
            const ordered = [...workers].sort((a, b) => a.step_index - b.step_index);
            if (ordered.length === 0) return null;
            const total = ordered.length;
            // Cursor is derived from the shared focus channel. Unset / not-found
            // (e.g. focus from a prior session) falls back to the first worker.
            const focusedIdx = ordered.findIndex(w => w.id === focusedWorkerId);
            const cursor = focusedIdx >= 0 ? focusedIdx : 0;
            const current = ordered[cursor];
            const goTo = (i: number) => setFocusedWorker(ordered[Math.max(0, Math.min(i, total - 1))]?.id ?? null);
            // A worker counts as "handled" once the user has acted: AI approve/
            // exclude sets `approved`, SELF submit also sets approved:true, errors
            // are terminal.
            const handled = (w: WorkerTask) => w.approved != null || w.status === 'error';
            const remainingToReview = ordered.filter(w => !handled(w) && w.status === 'done').length;
            const advance = () => goTo(cursor + 1);
            return (
              <div ref={workerSectionRef} className="space-y-3">
                {/* Progress — clickable dots + N/total */}
                <div className="flex items-center justify-between px-1">
                  <span className="text-[12px] font-semibold text-[var(--text-secondary)]">
                    {L('에이전트 검토', 'Review agents')}
                    {remainingToReview > 0 && (
                      <span className="font-normal text-[var(--text-tertiary)] ml-1.5">· {L(`${remainingToReview}명 남음`, `${remainingToReview} left`)}</span>
                    )}
                  </span>
                  <div className="flex items-center gap-2.5">
                    <div className="flex items-center gap-1.5">
                      {ordered.map((w, i) => (
                        <button key={w.id} onClick={() => setFocusedWorker(w.id)}
                          aria-label={`${i + 1}/${total}`} aria-current={i === cursor}
                          className={`rounded-full transition-all cursor-pointer ${
                            i === cursor ? 'w-5 h-2 bg-[var(--accent)]'
                              : handled(w) ? 'w-2 h-2 bg-[var(--accent)]/45'
                                : 'w-2 h-2 bg-[var(--border)]'
                          }`} />
                      ))}
                    </div>
                    <span className="text-[11px] tabular-nums text-[var(--text-tertiary)]">{cursor + 1}/{total}</span>
                  </div>
                </div>
                {/* Current worker card — slides on step change */}
                <AnimatePresence mode="wait">
                  <motion.div key={current.id}
                    initial={{ opacity: 0, x: 14 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -14 }}
                    transition={{ duration: 0.26, ease: EASE }}>
                    <WorkerReportBlock
                      worker={current}
                      onSubmitInput={current.status === 'waiting_input' ? workerActions.handleSubmit : undefined}
                      onRetry={(current.status === 'error' || current.status === 'done') ? workerActions.handleRetry : undefined}
                      onApprove={current.status === 'done' ? workerActions.handleApprove : undefined}
                      onReject={current.status === 'done' ? workerActions.handleReject : undefined}
                      onReassign={current.status === 'done' && current.agent_type !== 'human' && current.agent_type !== 'self'
                        ? (id) => setPoolModal({ mode: 'replace', workerId: id, rerun: true })
                        : undefined}
                      onAdvance={cursor < total - 1 ? advance : undefined}
                    />
                  </motion.div>
                </AnimatePresence>
                {/* Step navigation — go back to revisit, or skip ahead */}
                <div className="flex items-center justify-between px-1 pt-0.5">
                  <button onClick={() => goTo(cursor - 1)}
                    disabled={cursor === 0}
                    className="text-[12px] text-[var(--text-tertiary)] hover:text-[var(--text-primary)] disabled:opacity-30 cursor-pointer disabled:cursor-default transition-colors">
                    ← {L('이전', 'Prev')}
                  </button>
                  {cursor < total - 1 && (
                    <button onClick={advance}
                      className="text-[12px] text-[var(--text-tertiary)] hover:text-[var(--text-primary)] cursor-pointer transition-colors">
                      {L('나중에 보기', 'Later')} →
                    </button>
                  )}
                </div>
              </div>
            );
  }
