'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { motion, AnimatePresence, useAnimationControls } from 'framer-motion';
import { ScanSearch, ChevronUp, X, Loader2 } from 'lucide-react';
import { useProgressiveStore } from '@/stores/useProgressiveStore';
import { useShallow } from 'zustand/react/shallow';
import { WorkerAvatar, AvatarRow } from './WorkerAvatar';
import { TypingDots } from './shared/AgentVisuals';
import { AgentSidebar } from './AgentSidebar';
import { useAgentAttentionStore } from '@/stores/useAgentAttentionStore';
import type { WorkerTask } from '@/stores/types';
import { personaReviewLabel } from './shared/persona-format';
import type { WorkerContext } from '@/lib/worker-engine';
import { useLocale } from '@/hooks/useLocale';
import { EASE } from './shared/constants';
const EMPTY: WorkerTask[] = [];

function isWorkerSettled(worker: WorkerTask): boolean {
  return worker.status === 'done' || worker.status === 'error' || worker.status === 'validation_failed' ||
    worker.status === 'waiting_input' || worker.status === 'blocked' ||
    (worker.agent_type === 'human' && (worker.status === 'sent' || worker.status === 'waiting_response'));
}

function workerNeedsAttention(worker: WorkerTask): boolean {
  return isWorkerSettled(worker) && worker.status !== 'done';
}

// ─── Shared hooks for worker data ───

export function useWorkers(): WorkerTask[] {
  return useProgressiveStore(
    useShallow(s => {
      const session = s.sessions.find(ss => ss.id === s.currentSessionId);
      return session?.workers ?? EMPTY;
    })
  );
}

export function useWorkerContext(): WorkerContext | null {
  const session = useProgressiveStore(s => {
    const { sessions, currentSessionId } = s;
    return sessions.find(ss => ss.id === currentSessionId) || null;
  });
  if (!session || session.snapshots.length === 0) return null;
  const latest = session.snapshots[session.snapshots.length - 1];
  return {
    problemText: session.problem_text,
    realQuestion: latest.real_question,
    skeleton: latest.skeleton,
    hiddenAssumptions: latest.hidden_assumptions,
    qaHistory: session.questions.map((q, i) => ({
      q: q.text,
      a: session.answers[i]?.value ?? '',
    })).filter(qa => qa.a),
  };
}

// ─── Sorted worker list by priority ───

function sortedWorkers(workers: WorkerTask[]): WorkerTask[] {
  const order: Record<string, number> = {
    waiting_input: 0,
    running: 1,
    pending: 2,
    error: 3,
    done: 4,
  };
  return [...workers].sort((a, b) => (order[a.status] ?? 5) - (order[b.status] ?? 5));
}

// ─── Review header ───

function ReviewHeader({ workers }: { workers: WorkerTask[] }) {
  const locale = useLocale();
  const L = (ko: string, en: string) => locale === 'ko' ? ko : en;
  const doneCount = workers.filter(w => w.status === 'done').length;
  const settledCount = workers.filter(isWorkerSettled).length;
  const runningCount = workers.filter(w => w.status === 'running' || w.status === 'ai_preparing').length;
  const attentionCount = workers.filter(workerNeedsAttention).length;
  const pendingCount = Math.max(0, workers.length - settledCount - runningCount);

  return (
    <>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ScanSearch size={14} className="text-[var(--accent)]" />
          <span className="text-[13px] font-semibold text-[var(--text-primary)]">{L('검토 진행', 'Review progress')}</span>
          <span className="text-[12.5px] text-[var(--text-secondary)] bg-[var(--bg)] px-2 py-0.5 rounded-full">
            {settledCount}/{workers.length}
          </span>
        </div>
      </div>

      {/* Progress bar */}
      <div
        role="progressbar"
        aria-label={L('검토 처리 상태', 'Review status')}
        aria-valuemin={0}
        aria-valuemax={workers.length}
        aria-valuenow={settledCount}
        aria-valuetext={L(`${workers.length}건 중 ${settledCount}건 처리 · 결과 ${doneCount}건 완료`, `${settledCount} of ${workers.length} settled · ${doneCount} completed`)}
        className="h-1 rounded-full bg-[var(--border-subtle)] overflow-hidden"
      >
        <motion.div
          className="h-full rounded-full"
          style={{ background: 'var(--gradient-gold)' }}
          initial={{ width: 0 }}
          animate={{ width: `${(settledCount / workers.length) * 100}%` }}
          transition={{ duration: 0.6, ease: EASE }}
        />
      </div>

      {/* Status summary */}
      <p className="text-[12px] text-[var(--text-secondary)]" aria-live="polite">
        {[
          runningCount > 0 ? L(`${runningCount}건 검토 중`, `${runningCount} in progress`) : '',
          attentionCount > 0 ? L(`${attentionCount}건 확인 필요`, `${attentionCount} need attention`) : '',
          pendingCount > 0 ? L(`${pendingCount}건 대기 중`, `${pendingCount} pending`) : '',
        ].filter(Boolean).join(' · ') || L('모든 검토 완료', 'All reviews complete')}
      </p>
    </>
  );
}

// ─── Status dot for compact view ───

function StatusIndicator({ worker }: { worker: WorkerTask }) {
  if (worker.status === 'running' || worker.status === 'ai_preparing') return <Loader2 size={10} className="animate-spin text-blue-500" />;
  if (worker.status === 'done' && worker.approved === true) return <span className="w-2 h-2 rounded-full bg-emerald-500 block" />;
  if (worker.status === 'done' && worker.approved === false) return <span className="w-2 h-2 rounded-full bg-red-400 block" />;
  if (worker.status === 'done') return <span className="w-2 h-2 rounded-full bg-amber-400 block" />;
  if (worker.status === 'error' || worker.status === 'validation_failed') return <span className="w-2 h-2 rounded-full bg-red-500 block" />;
  if (worker.status === 'waiting_input' || worker.status === 'blocked') return <span className="w-2 h-2 rounded-full bg-[var(--accent)] animate-pulse block" />;
  if (worker.status === 'sent' || worker.status === 'waiting_response') return <span className="w-2 h-2 rounded-full bg-blue-400 block" />;
  return <span className="w-2 h-2 rounded-full bg-[var(--text-tertiary)] block" />;
}

function statusText(worker: WorkerTask, locale: string = 'ko'): string {
  const L = (ko: string, en: string) => locale === 'ko' ? ko : en;
  if (worker.status === 'running' || worker.status === 'ai_preparing') return L('작업 중', 'Working');
  if (worker.status === 'done' && worker.approved === true) return L('반영', 'Applied');
  if (worker.status === 'done' && worker.approved === false) return L('제외', 'Excluded');
  if (worker.status === 'done') return L('완료', 'Done');
  if (worker.status === 'error') return L('오류', 'Error');
  if (worker.status === 'validation_failed') return L('결과 확인 필요', 'Check result');
  if (worker.status === 'blocked') return L('입력 대기', 'Waiting on input');
  if (worker.status === 'sent' || worker.status === 'waiting_response') return L('답변 대기', 'Awaiting reply');
  if (worker.status === 'waiting_input') return L('입력 필요', 'Input needed');
  return L('대기', 'Pending');
}

// ─── Desktop Panel (compact status board) ───

export function WorkerPanel({ className }: { className?: string }) {
  const locale = useLocale();
  const workers = useWorkers();

  if (workers.length === 0) return null;

  const sorted = sortedWorkers(workers);

  return (
    <div className={`p-4 space-y-3 ${className ?? ''}`}>
      <ReviewHeader workers={workers} />

      {/* Compact status rows — no result bodies */}
      <div className="space-y-1">
        {sorted.map(w => (
          <motion.div key={w.id} layout
            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl hover:bg-[var(--bg)]/50 transition-colors"
          >
            <WorkerAvatar persona={w.persona} size="sm" pulse={w.status === 'running'} />
            <div className="flex-1 min-w-0">
              <p className="text-[12px] font-medium text-[var(--text-primary)] truncate">
                {w.persona ? personaReviewLabel(w.persona, locale) : (locale === 'ko' ? 'AI 검토' : 'AI review')}
              </p>
              <p className="text-[12.5px] text-[var(--text-secondary)] truncate" title={w.task}>{w.task}</p>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <StatusIndicator worker={w} />
              <span className="text-[12px] text-[var(--text-secondary)]">{statusText(w, locale)}</span>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

// ─── Mobile Drawer ───

export function WorkerDrawer({ className }: { className?: string }) {
  const locale = useLocale();
  const L = (ko: string, en: string) => locale === 'ko' ? ko : en;
  const [open, setOpen] = useState(false);
  const drawerId = useId();
  const drawerTitleId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const workers = useWorkers();

  const settledCount = workers.filter(isWorkerSettled).length;
  const attentionCount = workers.filter(workerNeedsAttention).length;
  const waitingCount = workers.filter(w => w.status === 'waiting_input').length;
  const runningCount = workers.filter(w => w.status === 'running' || w.status === 'ai_preparing').length;

  // Imperative peek animation — mobile users don't see the workers_done toast
  // unless they're looking up. This adds a bottom-bar bounce + brief ring so
  // the cue is in peripheral vision near the drawer handle itself.
  // Single effect so workers_done + waiting_input bounces never race each
  // other on the same AnimationControls.
  const peekControls = useAnimationControls();
  const [celebrate, setCelebrate] = useState(false);
  const lastPingAt = useAgentAttentionStore(s => s.lastPingAt);
  const lastPingSource = useAgentAttentionStore(s => s.lastPingSource);
  const prevWaitingRef = useRef(waitingCount);
  useEffect(() => {
    // Highest priority: workers_done celebration. Latches into `celebrate` for
    // a brief glow; the bounce plays once per ping.
    if (lastPingSource === 'workers_done' && lastPingAt > 0) {
      peekControls.start({
        // Modest amplitude — at -14px the bar collided with the LogbookDrawer
        // stacked ~56px above it on mobile complete screens.
        y: [0, -6, 0, -3, 0],
        transition: { duration: 0.95, delay: 0.1, ease: EASE },
      });
      setCelebrate(true);
      const t = setTimeout(() => setCelebrate(false), 1800);
      return () => clearTimeout(t);
    }
  }, [lastPingAt, lastPingSource, peekControls]);
  useEffect(() => {
    // Lower priority: nudge only on the rising edge of waiting_input count.
    // Initial mount doesn't bounce (prev == current).
    if (waitingCount > prevWaitingRef.current && waitingCount > 0) {
      peekControls.start({ y: [0, -3, 0], transition: { duration: 0.5, delay: 0.5 } });
    }
    prevWaitingRef.current = waitingCount;
  }, [waitingCount, peekControls]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        setOpen(false);
        return;
      }
      if (event.key !== 'Tab' || !panelRef.current) return;
      const focusable = Array.from(panelRef.current.querySelectorAll<HTMLElement>('button:not([disabled]), [href], input:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'));
      if (focusable.length === 0) { event.preventDefault(); return; }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && (document.activeElement === first || !panelRef.current.contains(document.activeElement))) {
        event.preventDefault(); last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault(); first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const raf = requestAnimationFrame(() => panelRef.current?.focus());
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      cancelAnimationFrame(raf);
      document.body.style.overflow = previousOverflow;
      triggerRef.current?.focus();
    };
  }, [open]);

  if (workers.length === 0) return null;

  return (
    <div className={className}>
      {/* Sticky bottom bar — height: ~56px (py-3.5 × 2 + content) */}
      <motion.button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
        aria-expanded={open}
        aria-controls={drawerId}
        aria-haspopup="dialog"
        className={`fixed bottom-0 inset-x-0 z-40 flex items-center justify-between px-4 py-3.5 pb-[calc(0.875rem+env(safe-area-inset-bottom))] bg-[var(--surface)] border-t cursor-pointer min-h-[56px] transition-colors duration-500 ${
          celebrate
            ? 'border-t-[var(--accent)]/70 shadow-[0_-8px_24px_-6px_rgba(180,160,100,0.35)]'
            : attentionCount > 0
              ? 'border-t-[var(--accent)]/40 border-[var(--border-subtle)]'
              : 'border-[var(--border-subtle)]'
        }`}
        animate={peekControls}
      >
        <div className="flex items-center gap-2 flex-wrap min-w-0">
          <AvatarRow personas={workers.map(w => w.persona)} maxShow={3} />
          <span className="text-[12px] font-semibold text-[var(--text-primary)] shrink-0">
            {L('팀', 'Team')} {settledCount}/{workers.length}
          </span>
          {attentionCount > 0 && (
            <span className="text-[12px] font-medium text-[var(--accent)] bg-[var(--accent)]/10 px-2 py-0.5 rounded-full shrink-0">
              {L('확인', 'Check')} {attentionCount}
            </span>
          )}
          {runningCount > 0 && attentionCount === 0 && (
            <span className="inline-flex items-center gap-1.5 text-[12px] text-[var(--accent)] bg-[var(--accent)]/8 px-2 py-0.5 rounded-full shrink-0">
              {L('진행', 'Active')} {runningCount}
              <TypingDots />
            </span>
          )}
        </div>
        <ChevronUp size={16} className="text-[var(--text-tertiary)] shrink-0" />
      </motion.button>

      {/* Half-sheet overlay — compact status list */}
      <AnimatePresence>
        {open && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-black/30" onClick={() => setOpen(false)} aria-hidden="true" />
            <motion.div
              ref={panelRef}
              id={drawerId}
              tabIndex={-1}
              role="dialog"
              aria-modal="true"
              aria-labelledby={drawerTitleId}
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="fixed bottom-0 inset-x-0 z-50 max-h-[75dvh] rounded-t-2xl bg-[var(--surface)] shadow-[var(--shadow-xl)] overflow-hidden flex flex-col"
            >
              <div className="flex items-center justify-between px-4 py-3.5 border-b border-[var(--border-subtle)] shrink-0">
                <div className="flex items-center gap-2">
                  <ScanSearch size={14} className="text-[var(--accent)]" />
                  <span id={drawerTitleId} className="text-[13px] font-semibold text-[var(--text-primary)]">{L('검토 진행', 'Review progress')}</span>
                  <span className="text-[12.5px] text-[var(--text-secondary)] bg-[var(--bg)] px-2 py-0.5 rounded-full">
                    {settledCount}/{workers.length}
                  </span>
                </div>
                <button type="button" onClick={() => setOpen(false)} className="p-2.5 cursor-pointer min-w-[44px] min-h-[44px] flex items-center justify-center" aria-label={L('닫기', 'Close')}>
                  <X size={18} className="text-[var(--text-tertiary)]" />
                </button>
              </div>

              {/* Full-richness content — reuse desktop sidebar exactly so mobile has parity */}
              <div className="flex-1 overflow-y-auto pb-[env(safe-area-inset-bottom)]">
                <AgentSidebar />
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
