'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, Loader2, ChevronDown, Sparkles, ArrowRight, RefreshCw, AlertCircle } from 'lucide-react';
import { useWorkers, useWorkerContext } from './WorkerPanel';
import { WorkerAvatar } from './WorkerAvatar';
import type { WorkerTask, PipelineStage } from '@/stores/types';
import { useAgentStore } from '@/stores/useAgentStore';
import { useProgressiveStore } from '@/stores/useProgressiveStore';
import { useLocale } from '@/hooks/useLocale';
import { EASE } from './shared/constants';
import { renderMd } from './shared/renderMd';
import { TypingDots, AvatarRipple, ShimmerBar, tickersFor, useAttentionPulse, AttentionFlash } from './shared/AgentVisuals';
import { useAgentAttentionStore } from '@/stores/useAgentAttentionStore';
import { useWorkerActions } from '@/hooks/useWorkerActions';
import { localizePersona } from '@/lib/worker-personas';

// ─── Status helpers ───

const PENDING_STATUSES = new Set<WorkerTask['status']>(['pending', 'ai_preparing']);

function isPending(w: WorkerTask) {
  return PENDING_STATUSES.has(w.status);
}

export function isWorkingStatus(s: WorkerTask['status']) {
  return s === 'running' || s === 'sent' || s === 'waiting_response';
}

function StatusBadge({ worker, locale }: { worker: WorkerTask; locale: string }) {
  const L = (ko: string, en: string) => locale === 'ko' ? ko : en;
  if (isWorkingStatus(worker.status)) {
    return (
      <span className="inline-flex items-center gap-1.5 shrink-0 px-2 py-0.5 rounded-full bg-[var(--accent)]/12 text-[var(--accent)]">
        <Loader2 size={10} className="animate-spin" />
        <span className="text-[10px] font-semibold">{L('진행 중', 'Live')}</span>
      </span>
    );
  }
  if (worker.status === 'done') {
    return (
      <div className="w-5 h-5 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center shrink-0">
        <Check size={10} className="text-emerald-600 dark:text-emerald-400" />
      </div>
    );
  }
  if (worker.status === 'waiting_input') {
    return (
      <span className="inline-flex items-center gap-1 shrink-0 px-2 py-0.5 rounded-full bg-[var(--accent)]/10 text-[var(--accent)]">
        <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] animate-pulse" />
        <span className="text-[10px] font-medium">{L('입력 필요', 'Input')}</span>
      </span>
    );
  }
  if (worker.status === 'error') {
    return <span className="text-[9px] text-red-500 font-medium shrink-0">{L('오류', 'Error')}</span>;
  }
  return <span className="text-[9px] text-[var(--text-tertiary)]/50 shrink-0 uppercase tracking-wider">{L('대기', 'standby')}</span>;
}

// ─── Agent Row — DemoAgentSidebar style with real data ───

// Word-boundary safe truncation — returns last ~80 chars, starting after a word break
function tailSnippet(text: string, max: number = 80): string {
  const trimmed = text.trim();
  if (trimmed.length <= max) return trimmed;
  const tail = trimmed.slice(-max);
  // If we cut mid-word, skip to the next word boundary
  const firstSpace = tail.indexOf(' ');
  const sliced = firstSpace > 0 && firstSpace < max - 20 ? tail.slice(firstSpace + 1) : tail;
  return '…' + sliced;
}

function AgentRow({ worker, expanded, onToggle, enterIndex, onRetry }: {
  worker: WorkerTask;
  expanded: boolean;
  onToggle: () => void;
  enterIndex: number;
  onRetry?: (id: string) => void;
}) {
  const locale = useLocale();
  const L = (ko: string, en: string) => locale === 'ko' ? ko : en;
  const isDone = worker.status === 'done';
  const isWorking = isWorkingStatus(worker.status);
  const isError = worker.status === 'error';

  const personaColor = worker.persona?.color || 'var(--accent)';
  const lv = worker.agent_id ? useAgentStore.getState().getAgent(worker.agent_id)?.level : undefined;

  // ── Attention ping — brief gold flash when user submits input
  const pulsing = useAttentionPulse(isWorking);

  // ── Hover attribution (draft ↔ agent) — matches section, sentence, or agent kinds
  const hovered = useAgentAttentionStore(s => s.hovered);
  const setHovered = useAgentAttentionStore(s => s.setHovered);
  const clearHovered = useAgentAttentionStore(s => s.clearHovered);
  const isHighlighted =
    (hovered?.kind === 'agent' && hovered.workerId === worker.id) ||
    (hovered?.kind === 'section' && hovered.contributorIds.includes(worker.id)) ||
    (hovered?.kind === 'sentence' && hovered.contributorIds.includes(worker.id));
  const isDimmed = hovered != null && !isHighlighted;

  // ── Live activity ticker (fallback when no stream_text)
  // Honesty: only a REAL stream snippet earns specific lines. Without one we
  // must not fabricate persona-specific actions ("analyzing competitor cases",
  // "modeling costs") that may not be happening — that's theater that misleads.
  // Fall back to the worker's genuine assigned task + neutral "working" lines.
  const tickers = tickersFor(undefined, worker.task);
  const [tickerIdx, setTickerIdx] = useState(0);
  useEffect(() => {
    if (!isWorking) return;
    const id = setInterval(() => {
      setTickerIdx(i => (i + 1) % tickers.length);
    }, 2200);
    return () => clearInterval(id);
  }, [isWorking, tickers.length]);

  // ── Word-boundary-safe stream snippet
  const streamSnippet = worker.stream_text ? tailSnippet(worker.stream_text, 80) : '';
  const liveLine = streamSnippet || tickers[tickerIdx];

  // ── Completion reveal — auto-expand the result when status flips to done.
  // No auto-collapse timer: the old 2.8s snap-shut yanked text away mid-read
  // and made the rail jump. It stays open until the user toggles the row.
  const [autoRevealed, setAutoRevealed] = useState(false);
  const prevStatusRef = useRef(worker.status);
  useEffect(() => {
    const wasDone = prevStatusRef.current === 'done';
    prevStatusRef.current = worker.status;
    if (!wasDone && worker.status === 'done' && worker.result) {
      setAutoRevealed(true);
    }
  }, [worker.status, worker.result]);

  const showResult = (expanded || autoRevealed) && isDone && worker.result;

  return (
    <motion.div
      layout
      data-attribution-source="agent"
      initial={{ opacity: 0, x: 16, scale: 0.96 }}
      animate={{
        opacity: isDimmed ? 0.4 : 1,
        x: 0,
        scale: isHighlighted ? 1.015 : 1,
      }}
      exit={{ opacity: 0, x: -8, transition: { duration: 0.2 } }}
      transition={{ duration: 0.45, ease: EASE, delay: Math.min(enterIndex, 2) * 0.18 }}
      onHoverStart={() => { if (isDone) setHovered({ kind: 'agent', workerId: worker.id }); }}
      onHoverEnd={() => setHovered(null)}
      onTap={() => {
        // Tap-to-lock: touch users can pin the hover state by tapping the row avatar area.
        // Only done rows expose attribution — pending/running rows are no-op.
        if (!isDone) return;
        const alreadyLocked = hovered?.kind === 'agent' && hovered.workerId === worker.id;
        if (alreadyLocked) {
          clearHovered();
        } else {
          setHovered({ kind: 'agent', workerId: worker.id }, true);
        }
      }}
      className={`rounded-xl border transition-all duration-300 relative overflow-hidden ${
        isHighlighted ? 'ring-2 ring-[var(--accent)]/60 border-[var(--accent)]/50 shadow-[0_0_22px_-4px_rgba(180,160,100,0.35)]' :
        isDone ? 'border-emerald-300/50 dark:border-emerald-700/30 bg-emerald-50/30 dark:bg-emerald-950/10 shadow-sm' :
        isWorking ? 'border-[var(--accent)]/40 bg-[var(--accent)]/[0.07] shadow-[0_0_18px_-4px_rgba(180,160,100,0.25)]' :
        isError ? 'border-red-300/40 bg-red-50/20 dark:bg-red-950/10' :
        'border-[var(--border-subtle)] bg-[var(--surface)]'
      }`}
    >
      <AttentionFlash active={pulsing} color={personaColor} />
      {isWorking && <ShimmerBar color={personaColor} />}

      {/* Completion celebration sweep — a single golden bar sliding across the row when auto-revealed */}
      {autoRevealed && (
        <motion.div
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ duration: 2.2, ease: 'easeOut' }}
          className="absolute bottom-0 left-0 right-0 h-[2px] origin-left pointer-events-none z-10"
          style={{ background: 'var(--gradient-gold)' }}
        />
      )}

      <button
        onClick={isDone ? () => {
          // Auto-revealed (not user-pinned) rows close on first tap; otherwise toggle.
          if (autoRevealed && !expanded) setAutoRevealed(false);
          else onToggle();
        } : undefined}
        className={`w-full flex items-center gap-3 p-3 ${isDone ? 'cursor-pointer' : 'cursor-default'}`}
      >
        <div className="relative shrink-0">
          {isWorking && <AvatarRipple color={personaColor} />}
          <WorkerAvatar persona={worker.persona} size="sm" pulse={isWorking} />
        </div>
        <div className="flex-1 text-left min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-[13px] font-semibold text-[var(--text-primary)] truncate">
              {worker.persona ? localizePersona(worker.persona, locale).name : 'AI'}
            </span>
            {lv != null && lv >= 2 && (
              <span className="agent-lv" style={{ fontSize: 9, padding: '0px 5px' }} data-level={lv}>
                Lv.{lv}
              </span>
            )}
          </div>
          {isWorking && (
            <div className="mt-0.5 h-[15px] relative overflow-hidden">
              <AnimatePresence mode="wait">
                <motion.p
                  key={streamSnippet ? 'stream' : `tick-${tickerIdx}`}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.35, ease: EASE }}
                  className="text-[11px] truncate flex items-center gap-1.5 absolute inset-0"
                  style={{ color: personaColor }}
                >
                  <span className="truncate">{liveLine}</span>
                  <TypingDots color={personaColor} />
                </motion.p>
              </AnimatePresence>
            </div>
          )}
          {isDone && worker.completion_note && (
            <p className="text-[11px] text-[var(--text-secondary)] mt-0.5 italic truncate">
              &ldquo;{worker.completion_note}&rdquo;
            </p>
          )}
          {isError && worker.error && (
            <p className="text-[11px] text-red-600 dark:text-red-400 mt-0.5 truncate flex items-center gap-1">
              <AlertCircle size={10} className="shrink-0" />
              <span className="truncate">{worker.error}</span>
            </p>
          )}
          {!isWorking && !isDone && !isError && worker.task && (
            <p className="text-[11px] text-[var(--text-secondary)] mt-0.5 truncate">{worker.task}</p>
          )}
        </div>
        <StatusBadge worker={worker} locale={locale} />
        {isError && onRetry && (
          <button
            onClick={(e) => { e.stopPropagation(); onRetry(worker.id); }}
            className="shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-semibold text-[var(--accent)] bg-[var(--accent)]/8 hover:bg-[var(--accent)]/15 border border-[var(--accent)]/20 cursor-pointer transition-colors"
            title={L('다시 시도', 'Retry')}
          >
            <RefreshCw size={9} />
            {L('재시도', 'Retry')}
          </button>
        )}
        {isDone && expanded && <ChevronDown size={12} className="text-[var(--text-tertiary)] rotate-180 transition-transform duration-200 shrink-0" />}
      </button>

      {/* Expandable result — manual expand OR auto-reveal on completion */}
      <AnimatePresence>
        {showResult && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: EASE }}
            className="overflow-hidden"
          >
            <div className="px-3.5 pb-3.5 border-t border-[var(--border-subtle)] mt-0">
              {autoRevealed && !expanded && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="pt-2.5 flex items-center gap-1.5 text-[10px] text-[var(--accent)] font-semibold uppercase tracking-wider"
                >
                  <Sparkles size={9} />
                  <span>{L('방금 끝낸 분석', 'Just finished')}</span>
                </motion.div>
              )}
              <div className="pt-3 text-[12px] leading-[1.75] max-h-[300px] overflow-y-auto text-[var(--text-primary)] space-y-0.5">
                {renderMd(worker.result || '')}
              </div>
              {worker.validation_score != null && (
                <div className="mt-2 flex items-center gap-1.5">
                  {/* Descriptive, not "N/100" — score numerals are verdict language */}
                  <span className={`text-[10px] font-medium ${worker.validation_passed ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
                    {worker.validation_passed ? L('확인 통과', 'Checked') : L('확인 필요', 'Needs a look')}
                  </span>
                  {worker.validation_passed && <Check size={10} className="text-emerald-500" />}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─── Stage transition celebration banner — 4s auto-hide ───

function StageTransitionBanner({ nextStageLabel, previousStageLabel, locale }: {
  nextStageLabel: string;
  previousStageLabel: string;
  locale: string;
}) {
  const L = (ko: string, en: string) => locale === 'ko' ? ko : en;
  return (
    <motion.div
      initial={{ opacity: 0, y: -8, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -6 }}
      transition={{ duration: 0.5, ease: EASE }}
      className="relative rounded-xl p-[1px] bg-gradient-to-r from-emerald-400/30 via-[var(--accent)]/40 to-[var(--accent)]/20 overflow-hidden"
    >
      {/* Sliding highlight sweep */}
      <motion.div
        initial={{ x: '-100%' }}
        animate={{ x: '200%' }}
        transition={{ duration: 2, ease: 'easeOut', delay: 0.2 }}
        className="absolute inset-0 w-1/2 pointer-events-none"
        style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.25), transparent)' }}
      />
      <div className="rounded-[calc(0.75rem-1px)] bg-[var(--surface)] px-3 py-2.5 flex items-center gap-2.5 relative">
        <motion.div
          initial={{ scale: 0, rotate: -180 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.1 }}
          className="w-6 h-6 rounded-full flex items-center justify-center shrink-0"
          style={{ background: 'var(--gradient-gold)' }}
        >
          <Sparkles size={11} className="text-white" />
        </motion.div>
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-bold text-[var(--text-primary)] leading-tight">
            {previousStageLabel
              ? L(`${previousStageLabel} 완료`, `${previousStageLabel} complete`)
              : L('첫 단계 완료', 'First stage complete')}
          </p>
          <p className="text-[10px] text-[var(--accent)] mt-0.5 flex items-center gap-1">
            <ArrowRight size={9} />
            {L(`이제 ${nextStageLabel} 시작`, `Now starting ${nextStageLabel}`)}
          </p>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Stage divider — shown between stage groups in multi-stage pipelines ───

function StageDivider({ stage, index, isFirst, allStageDone, locale }: {
  stage: PipelineStage;
  index: number;
  isFirst: boolean;
  allStageDone: boolean;
  locale: string;
}) {
  const L = (ko: string, en: string) => locale === 'ko' ? ko : en;
  const romanIdx = ['Ⅰ', 'Ⅱ', 'Ⅲ', 'Ⅳ', 'Ⅴ'][index] || `${index + 1}`;

  return (
    <motion.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: EASE }}
      className={`flex items-center gap-2.5 ${isFirst ? 'pt-1' : 'pt-4'} pb-1`}
    >
      <span className={`text-[9px] font-bold tracking-[0.12em] uppercase shrink-0 ${
        allStageDone ? 'text-emerald-600 dark:text-emerald-400' : 'text-[var(--accent)]'
      }`}>
        Stage {romanIdx} — {locale === 'en' ? (stage.labelEn || stage.label) : stage.label}
      </span>
      <div className="flex-1 h-px bg-gradient-to-r from-[var(--accent)]/25 to-transparent" />
      {allStageDone && (
        <Check size={9} className="text-emerald-500 shrink-0" />
      )}
      {!allStageDone && (
        <span className="text-[9px] text-[var(--accent)] shrink-0 flex items-center gap-1">
          <span className="w-1 h-1 rounded-full bg-[var(--accent)] animate-pulse" />
          {L('진행 중', 'live')}
        </span>
      )}
    </motion.div>
  );
}

// ─── Main sidebar ───

export function AgentSidebar({ className }: { className?: string }) {
  const locale = useLocale();
  const L = (ko: string, en: string) => locale === 'ko' ? ko : en;
  const workers = useWorkers();
  const context = useWorkerContext();
  const { handleRetry } = useWorkerActions(context);
  const stages = useProgressiveStore(s => {
    const session = s.sessions.find(ss => ss.id === s.currentSessionId);
    return session?.stages;
  });
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Stage transition celebration: when a stage finishes, briefly celebrate on the NEXT stage's banner.
  // Tracks previously-completed stage IDs via a ref; on re-render we diff to detect a new completion.
  const completedStagesRef = useRef<Set<string>>(new Set());
  const [celebratingNextStageId, setCelebratingNextStageId] = useState<string | null>(null);
  useEffect(() => {
    if (!stages || stages.length < 2) return;
    // Compute currently-completed stages (all workers in stage done)
    const newlyCompleted: string[] = [];
    for (const stage of stages) {
      if (completedStagesRef.current.has(stage.id)) continue;
      const stageWorkers = workers.filter(w => w.stage_id === stage.id);
      if (stageWorkers.length === 0) continue;
      if (stageWorkers.every(w => w.status === 'done')) {
        newlyCompleted.push(stage.id);
        completedStagesRef.current.add(stage.id);
      }
    }
    if (newlyCompleted.length === 0) return;
    // Find the "next" stage after the most recently completed one
    const lastCompletedIdx = stages.findIndex(s => s.id === newlyCompleted[newlyCompleted.length - 1]);
    const nextStage = stages[lastCompletedIdx + 1];
    if (!nextStage) return;
    // Defer to next microtask to avoid react-hooks/set-state-in-effect
    const show = setTimeout(() => setCelebratingNextStageId(nextStage.id), 0);
    const hide = setTimeout(() => setCelebratingNextStageId(null), 4000);
    return () => {
      clearTimeout(show);
      clearTimeout(hide);
    };
  }, [stages, workers]);

  if (workers.length === 0) return null;

  const doneCount = workers.filter(w => w.status === 'done').length;
  const runningCount = workers.filter(w => isWorkingStatus(w.status)).length;
  const waitingInputCount = workers.filter(w => w.status === 'waiting_input').length;
  const pendingCount = workers.filter(isPending).length;
  const allDone = doneCount === workers.length;
  const progressPct = workers.length > 0 ? Math.round((doneCount / workers.length) * 100) : 0;
  // Sequential reveal: hide pending workers from the sidebar — they slide in once active
  const visibleWorkers = workers.filter(w => !isPending(w));

  // Group workers by stage for multi-stage pipelines (Critical mode: Stage 1 분석 → Stage 2 검증)
  const hasStages = !!stages && stages.length > 1;
  const groupedByStage: Array<{ stage: PipelineStage | null; workers: WorkerTask[] }> = hasStages
    ? (stages!
        .map(stage => ({
          stage,
          workers: visibleWorkers.filter(w => w.stage_id === stage.id),
        }))
        .filter(g => g.workers.length > 0))
    : [{ stage: null, workers: visibleWorkers }];

  return (
    <div className={`p-4 space-y-3.5 ${className ?? ''}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--text-secondary)]">
          {L('분석 팀', 'Analysis Team')}
        </span>
        {runningCount > 0 && (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-[var(--accent)]/10 text-[10px] text-[var(--accent)] font-semibold">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] animate-pulse" />
            {runningCount} {L('분석 중', 'analyzing')}
            <TypingDots />
          </span>
        )}
        {waitingInputCount > 0 && runningCount === 0 && (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-[var(--accent)]/10 text-[10px] text-[var(--accent)] font-medium">
            {L('입력 대기', 'Awaiting input')} {waitingInputCount}
          </span>
        )}
        {allDone && (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-100/60 dark:bg-emerald-900/20 text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">
            <Check size={10} />
            {L('완료', 'Complete')}
          </span>
        )}
      </div>

      {/* Progress bar */}
      <div className="h-[2px] bg-[var(--border-subtle)] rounded-full overflow-hidden">
        <motion.div
          className="h-full rounded-full"
          style={{ background: 'var(--gradient-gold)' }}
          initial={{ width: '0%' }}
          animate={{ width: `${progressPct}%` }}
          transition={{ duration: 0.6, ease: EASE }}
        />
      </div>

      {/* Empty "preparing" state — visible when all workers are still pending (before first activation) */}
      {visibleWorkers.length === 0 && pendingCount > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: EASE }}
          className="flex flex-col items-center gap-2 py-6 text-center"
        >
          <div className="relative">
            <Loader2 size={18} className="animate-spin text-[var(--accent)]" />
          </div>
          <p className="text-[11px] text-[var(--text-secondary)] font-medium">
            {L(`${pendingCount}명의 팀원 배정 중`, `Assembling ${pendingCount} team members`)}
          </p>
          <p className="text-[10px] text-[var(--text-tertiary)]">
            {L('잠시만요', 'One moment')}<TypingDots />
          </p>
        </motion.div>
      )}

      {/* Agent rows — sequential reveal, grouped by stage when pipeline has multiple stages */}
      <div className="space-y-2">
        {groupedByStage.map((group, groupIdx) => (
          <div key={group.stage?.id || 'all'} className="space-y-2">
            {hasStages && group.stage && celebratingNextStageId === group.stage.id && (
              <StageTransitionBanner
                nextStageLabel={locale === 'en' ? (group.stage.labelEn || group.stage.label) : group.stage.label}
                previousStageLabel={groupedByStage[groupIdx - 1]?.stage?.label || ''}
                locale={locale}
              />
            )}
            {hasStages && group.stage && (
              <StageDivider
                stage={group.stage}
                index={groupIdx}
                isFirst={groupIdx === 0}
                allStageDone={group.workers.every(w => w.status === 'done')}
                locale={locale}
              />
            )}
            <AnimatePresence initial={false}>
              {group.workers.map((w, i) => (
                <AgentRow
                  key={w.id}
                  worker={w}
                  expanded={expandedId === w.id}
                  onToggle={() => setExpandedId(expandedId === w.id ? null : w.id)}
                  enterIndex={i}
                  onRetry={handleRetry}
                />
              ))}
            </AnimatePresence>
          </div>
        ))}

        {pendingCount > 0 && !allDone && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ delay: 0.2 }}
            className="flex items-center gap-2 px-3 pt-1 text-[10px] text-[var(--text-tertiary)]"
          >
            <span className="w-1 h-1 rounded-full bg-[var(--text-tertiary)]/40" />
            <span>{L(`${pendingCount}명 더 합류 예정`, `${pendingCount} more joining`)}</span>
          </motion.div>
        )}
      </div>

      {/* Summary section — appears when all done */}
      <AnimatePresence>
        {allDone && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.5, ease: EASE }}
            className="overflow-hidden"
          >
            <div className="rounded-xl border border-[var(--accent)]/15 bg-[var(--accent)]/[0.03] p-3.5 space-y-2">
              <div className="flex items-center gap-1.5">
                <Sparkles size={11} className="text-[var(--accent)]" />
                <span className="text-[10px] font-bold text-[var(--accent)] uppercase tracking-wider">
                  {L('요약', 'Summary')}
                </span>
              </div>
              {workers.map(w => (
                <div key={w.id} className="flex items-start gap-2">
                  <WorkerAvatar persona={w.persona} size="sm" />
                  <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed">
                    {w.completion_note || w.task}
                  </p>
                </div>
              ))}
              <div className="pt-1.5 border-t border-[var(--accent)]/10">
                <p className="text-[10px] text-[var(--accent)]/70 flex items-center gap-1">
                  <ArrowRight size={8} />
                  {L('아래 기획안에 반영됨', 'Reflected in the document below')}
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
