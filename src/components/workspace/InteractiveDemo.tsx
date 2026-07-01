'use client';

import { useState, useEffect, useRef, useCallback, useMemo, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight, Sparkles, Check, ArrowRight, UserCheck, Loader2, ChevronDown } from 'lucide-react';
import { WorkerAvatar } from './progressive/WorkerAvatar';
import type { DemoScenario } from '@/lib/demo-data';
import { applyPatch, buildFinal } from '@/lib/demo-data';
import type { AnalysisSnapshot, DMConcern } from '@/stores/types';
import { track } from '@/lib/analytics';
import { EASE, SPRING } from './progressive/shared/constants';
import { renderInline, renderMd } from './progressive/shared/renderMd';
import { AnalysisCard } from './progressive/shared/AnalysisCard';
import { UpdateSummaryChip } from './progressive/shared/UpdateSummaryChip';
import { QuestionCard } from './progressive/shared/QuestionCard';
import { TypingDots, AvatarRipple, ShimmerBar, tickersFor } from './progressive/shared/AgentVisuals';

/* ═══ Phase State Machine ═══ */
type DemoPhase =
  | 'typing'
  | 'team'
  | 'analysis'
  | 'q1'
  | 'update1'
  | 'q2'
  | 'update2'
  | 'workers'
  | 'draft'
  | 'matching'
  | 'dm'
  | 'final';

// v2: Q1 → update1 (세 번째 워커 합류) → workers → Q2 (워커 결과 본 후 검증 선택) → update2 → draft
const PHASE_ORDER: DemoPhase[] = ['typing', 'team', 'analysis', 'q1', 'update1', 'workers', 'q2', 'update2', 'draft', 'matching', 'dm', 'final'];
const phaseGte = (current: DemoPhase, target: DemoPhase) => PHASE_ORDER.indexOf(current) >= PHASE_ORDER.indexOf(target);

/* diffItems, renderInline, renderMd — imported from shared/ */

/* ═══════════════════════════════════════════════════════════
   TYPING INPUT — char-by-char animation
   ═══════════════════════════════════════════════════════════ */

/* Build [start, end) ranges for highlight phrases inside the text. Sorted +
   non-overlapping (later overlaps drop). */
function buildHighlightRanges(text: string, highlights?: string[]): Array<[number, number]> {
  if (!highlights || highlights.length === 0) return [];
  const raw: Array<[number, number]> = [];
  for (const h of highlights) {
    if (!h) continue;
    let idx = 0;
    while ((idx = text.indexOf(h, idx)) !== -1) {
      raw.push([idx, idx + h.length]);
      idx += h.length;
    }
  }
  raw.sort((a, b) => a[0] - b[0]);
  const merged: Array<[number, number]> = [];
  for (const r of raw) {
    if (merged.length === 0 || r[0] >= merged[merged.length - 1][1]) merged.push(r);
  }
  return merged;
}

/** Render `text.slice(0, typed)` with highlight ranges as <strong>. */
function renderTypedWithHighlights(text: string, typed: number, ranges: Array<[number, number]>): ReactNode[] {
  const out: ReactNode[] = [];
  let pos = 0;
  for (let i = 0; i < ranges.length; i++) {
    const [s, e] = ranges[i];
    if (s >= typed) break;
    if (s > pos) out.push(<span key={`p${i}`}>{text.slice(pos, s)}</span>);
    const visibleEnd = Math.min(e, typed);
    out.push(
      <strong key={`h${i}`} className="font-semibold text-[var(--text-primary)]">
        {text.slice(s, visibleEnd)}
      </strong>,
    );
    pos = visibleEnd;
    if (visibleEnd < e) return out; // typing inside this highlight, no more after
  }
  if (pos < typed) out.push(<span key="tail">{text.slice(pos, typed)}</span>);
  return out;
}

function TypingInput({ text, highlights, onDone, locale = 'ko' }: {
  text: string;
  highlights?: string[];
  onDone: () => void;
  locale?: 'ko' | 'en';
}) {
  const [typed, setTyped] = useState(0);
  const doneRef = useRef(false);
  const typedRef = useRef(0);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;
  const ranges = useMemo(() => buildHighlightRanges(text, highlights), [text, highlights]);

  // Skip-to-end: click the input to fill instantly + finish soon
  const skip = () => {
    typedRef.current = text.length;
    setTyped(text.length);
    if (!doneRef.current) {
      doneRef.current = true;
      setTimeout(() => onDoneRef.current(), 250);
    }
  };

  useEffect(() => {
    let frame: number;
    // Faster baseline (~27ms avg) vs old (~55ms avg) — ~2x speed.
    const charDelay = (ch: string) => {
      const base = 18 + Math.random() * 18; // 18–36ms
      // Brief pause at sentence ends so the rhythm doesn't feel mechanical
      if (ch === '.' || ch === '?' || ch === '!') return base + 150;
      if (ch === ',') return base + 60;
      return base;
    };
    let nextAt = performance.now() + 200;
    typedRef.current = 0;
    doneRef.current = false;

    const tick = (now: number) => {
      if (now >= nextAt && typedRef.current < text.length) {
        const ch = text.charAt(typedRef.current);
        typedRef.current += 1;
        setTyped(typedRef.current);
        if (typedRef.current >= text.length && !doneRef.current) {
          doneRef.current = true;
          setTimeout(() => onDoneRef.current(), 400);
        }
        nextAt = now + charDelay(ch);
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [text]);

  const isTyping = typed < text.length;

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: EASE }}
      onClick={isTyping ? skip : undefined}
      role={isTyping ? 'button' : undefined}
      tabIndex={isTyping ? 0 : undefined}
      onKeyDown={isTyping ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); skip(); } } : undefined}
      aria-label={isTyping ? (locale === 'ko' ? '클릭해서 건너뛰기' : 'Click to skip') : undefined}
      className={`relative flex items-start gap-3 px-5 py-3.5 rounded-2xl bg-[var(--surface)] border border-[var(--border-subtle)] w-full ${isTyping ? 'cursor-pointer hover:border-[var(--accent)]/30 transition-colors' : ''}`}>
      <div className="w-6 h-6 rounded-full bg-[var(--text-primary)] flex items-center justify-center shrink-0 mt-0.5">
        <span className="text-[var(--bg)] text-[10px] font-bold">{locale === 'ko' ? '나' : 'Me'}</span>
      </div>
      <p className="flex-1 text-[14px] text-[var(--text-primary)] leading-relaxed">
        {ranges.length > 0
          ? renderTypedWithHighlights(text, typed, ranges)
          : text.slice(0, typed)}
        {isTyping && <span className="inline-block w-[2px] h-[16px] bg-[var(--accent)] ml-0.5 align-middle animate-pulse" />}
      </p>
      {isTyping && (
        <span className="shrink-0 self-center text-[10px] text-[var(--text-tertiary)] tracking-wide">
          <span className="sm:hidden">{locale === 'ko' ? '탭해서 건너뛰기' : 'Tap to skip'}</span>
          <span className="hidden sm:inline">{locale === 'ko' ? '클릭해 건너뛰기' : 'Click to skip'}</span>
        </span>
      )}
    </motion.div>
  );
}

/* ═══════════════════════════════════════════════════════════
   TEAM ENTRANCE — stagger avatars
   ═══════════════════════════════════════════════════════════ */

function TeamEntrance({ scenario, onDone, locale = 'ko' }: { scenario: DemoScenario; onDone: () => void; locale?: 'ko' | 'en' }) {
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;
  useEffect(() => {
    const t = setTimeout(() => onDoneRef.current(), 2500);
    return () => clearTimeout(t);
  }, []);

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: EASE }}
      className="rounded-xl bg-[var(--accent)]/[0.03] border border-[var(--accent)]/10 p-4 space-y-2.5">
      {scenario.team.map((p, i) => (
        <motion.div key={p.id} initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 + i * 0.3, duration: 0.4, ease: EASE }}
          className="flex items-center gap-3">
          <WorkerAvatar persona={p} size="sm" />
          <span className="text-[13px] font-medium text-[var(--text-primary)]">{p.name}</span>
          <span className="text-[11px] text-[var(--text-tertiary)]">{p.role}</span>
        </motion.div>
      ))}
      <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.2, duration: 0.4 }}
        className="text-[11px] text-[var(--text-tertiary)] pt-1">
        {locale === 'ko' ? '팀이 모였어요. 상황을 살펴볼게요...' : 'Team assembled. Analyzing the situation...'}
      </motion.p>
    </motion.div>
  );
}

/* ═══════════════════════════════════════════════════════════
   TEAM ENTRANCE TRIGGER — desktop invisible timing bridge
   ═══════════════════════════════════════════════════════════ */

function TeamEntranceTrigger({ onDone }: { onDone: () => void }) {
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;
  useEffect(() => {
    const t = setTimeout(() => onDoneRef.current(), 1500);
    return () => clearTimeout(t);
  }, []);
  return null;
}

/* DemoAnalysisCard → replaced by shared AnalysisCard */

/* DemoQuestionCard → replaced by shared QuestionCard */

/* ═══════════════════════════════════════════════════════════
   WORKER MINI BAR — inline status indicator
   ═══════════════════════════════════════════════════════════ */

function WorkerMiniBar({ scenario, visibleCount }: { scenario: DemoScenario; visibleCount: number }) {
  const total = scenario.workers.length;
  const pct = total > 0 ? Math.round((visibleCount / total) * 100) : 0;
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: EASE }}
      className="rounded-xl bg-[var(--bg)] border border-[var(--border-subtle)] overflow-hidden">
      {/* Progress bar */}
      <div className="h-[2px] bg-[var(--border-subtle)]">
        <motion.div className="h-full" style={{ background: 'var(--gradient-gold)' }}
          initial={{ width: '0%' }} animate={{ width: `${pct}%` }} transition={{ duration: 0.6, ease: EASE }} />
      </div>
      <div className="flex items-center gap-3 px-4 py-2.5">
        {scenario.workers.map((w, i) => (
          <div key={w.persona.id} className="flex items-center gap-1.5">
            <WorkerAvatar persona={w.persona} size="sm" pulse={i >= visibleCount} />
            <span className={`text-[11px] transition-colors duration-300 ${i < visibleCount ? 'text-[var(--text-primary)] font-medium' : 'text-[var(--text-tertiary)]'}`}>
              {w.persona.name}
            </span>
            {i < visibleCount && <Check size={10} className="text-emerald-500" />}
          </div>
        ))}
      </div>
    </motion.div>
  );
}

/* ═══════════════════════════════════════════════════════════
   WORKER REPORT — inline report block
   ═══════════════════════════════════════════════════════════ */

function DemoWorkerReport({ worker }: { worker: DemoScenario['workers'][number] }) {
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: EASE }}>
      <div className="flex items-start gap-3">
        <div className="w-[3px] self-stretch rounded-full mt-1 shrink-0" style={{ backgroundColor: worker.persona.color + '40' }} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <WorkerAvatar persona={worker.persona} size="sm" />
            <span className="text-[13px] font-semibold text-[var(--text-primary)]">{worker.persona.name}</span>
            <span className="text-[11px] text-[var(--text-tertiary)]">{worker.persona.role}</span>
          </div>
          <p className="text-[11px] text-[var(--accent)] mb-2 pl-0.5">{worker.task}</p>
          {worker.completionNote && (
            <p className="text-[12px] text-[var(--text-secondary)] mb-2 italic pl-0.5">
              &ldquo;{worker.completionNote}&rdquo;
            </p>
          )}
          <div className="text-[13px] leading-[1.75] rounded-xl p-4 bg-[var(--bg)]/60 text-[var(--text-primary)] space-y-0.5">
            {renderMd(worker.result)}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

/* ═══════════════════════════════════════════════════════════
   AGENT SIDEBAR — right panel showing agent status + results
   ═══════════════════════════════════════════════════════════ */

type AgentStatus = 'waiting' | 'working' | 'done';

function getAgentStatuses(phase: DemoPhase, visibleWorkers: number, total: number): AgentStatus[] {
  if (!phaseGte(phase, 'analysis')) return Array(total).fill('waiting');
  // analysis: 첫 번째(다은)만 working
  if (phase === 'analysis') {
    return Array.from({ length: total }, (_, i) => i === 0 ? 'working' : 'waiting') as AgentStatus[];
  }
  // q1: 다은 + 현우 working, 세 번째는 아직 합류 전 (total=2인 시점)
  if (phase === 'q1') {
    return Array.from({ length: total }, (_, i) => i < 2 ? 'working' : 'waiting') as AgentStatus[];
  }
  // update1: 세 번째 워커 합류 — 셋 다 working
  if (phase === 'update1') {
    return Array(total).fill('working') as AgentStatus[];
  }
  // workers: stagger done
  if (phase === 'workers') {
    return Array.from({ length: total }, (_, i) => i < visibleWorkers ? 'done' : 'working') as AgentStatus[];
  }
  // q2, update2, draft onward — all done
  return Array(total).fill('done') as AgentStatus[];
}

function AgentRow({ worker, status, expanded, onToggle, locale = 'ko' }: {
  worker: DemoScenario['workers'][number];
  status: AgentStatus;
  expanded: boolean;
  onToggle: () => void;
  locale?: 'ko' | 'en';
}) {
  const L = (ko: string, en: string) => locale === 'ko' ? ko : en;
  const isDone = status === 'done';
  const isWorking = status === 'working';

  // Live activity ticker — rotates while working
  const tickers = tickersFor(worker.persona.id, worker.task);
  const [tickerIdx, setTickerIdx] = useState(0);
  useEffect(() => {
    if (!isWorking) return;
    const id = setInterval(() => {
      setTickerIdx(i => (i + 1) % tickers.length);
    }, 2200);
    return () => clearInterval(id);
  }, [isWorking, tickers.length]);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: 16, scale: 0.96 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: -8, transition: { duration: 0.2 } }}
      transition={{ duration: 0.45, ease: EASE }}
      className={`rounded-xl border transition-all duration-300 relative overflow-hidden ${
        isDone ? 'border-emerald-300/50 dark:border-emerald-700/30 bg-emerald-50/30 dark:bg-emerald-950/10 shadow-sm' :
        isWorking ? 'border-[var(--accent)]/40 bg-[var(--accent)]/[0.07] shadow-[0_0_18px_-4px_rgba(180,160,100,0.25)]' :
        'border-transparent bg-transparent opacity-25'
      }`}
    >
      {isWorking && <ShimmerBar color={worker.persona.color} />}
      <button
        onClick={isDone ? onToggle : undefined}
        className={`w-full flex items-center gap-3 p-3 ${isDone ? 'cursor-pointer' : 'cursor-default'}`}
      >
        <div className="relative shrink-0">
          {isWorking && <AvatarRipple color={worker.persona.color} />}
          <div
            className={`w-8 h-8 rounded-full flex items-center justify-center text-[13px] relative ${
              isWorking ? 'ring-2 ring-[var(--accent)]/25' : ''
            }`}
            style={{ backgroundColor: worker.persona.color + (isWorking ? '30' : '20'), color: worker.persona.color }}
          >
            {worker.persona.emoji}
          </div>
        </div>
        <div className="flex-1 text-left min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-[13px] font-semibold text-[var(--text-primary)] truncate">{worker.persona.name}</span>
            <span className="text-[11px] text-[var(--text-tertiary)] truncate">{worker.persona.role}</span>
          </div>
          {isWorking && (
            <div className="mt-0.5 h-[15px] relative overflow-hidden">
              <AnimatePresence mode="wait">
                <motion.p
                  key={tickerIdx}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.35, ease: EASE }}
                  className="text-[11px] truncate flex items-center gap-1.5 absolute inset-0"
                  style={{ color: worker.persona.color }}
                >
                  <span className="truncate">{tickers[tickerIdx]}</span>
                  <TypingDots color={worker.persona.color} />
                </motion.p>
              </AnimatePresence>
            </div>
          )}
          {isDone && worker.completionNote && (
            <p className="text-[11px] text-[var(--text-secondary)] mt-0.5 italic truncate">
              &ldquo;{worker.completionNote}&rdquo;
            </p>
          )}
        </div>
        {status === 'waiting' && <span className="text-[9px] text-[var(--text-tertiary)]/50 shrink-0 uppercase tracking-wider">{L('대기', 'standby')}</span>}
        {isWorking && (
          <span className="inline-flex items-center gap-1.5 shrink-0 px-2 py-0.5 rounded-full bg-[var(--accent)]/12 text-[var(--accent)]">
            <Loader2 size={10} className="animate-spin" />
            <span className="text-[10px] font-semibold">{L('진행 중', 'live')}</span>
          </span>
        )}
        {isDone && (
          <div className="flex items-center gap-1 shrink-0">
            <div className="w-5 h-5 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
              <Check size={10} className="text-emerald-600 dark:text-emerald-400" />
            </div>
            {expanded && <ChevronDown size={12} className="text-[var(--text-tertiary)] rotate-180 transition-transform duration-200" />}
          </div>
        )}
      </button>

      {/* Expandable result */}
      <AnimatePresence>
        {expanded && isDone && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: EASE }}
            className="overflow-hidden"
          >
            <div className="px-3.5 pb-3.5 border-t border-[var(--border-subtle)] mt-0">
              <div className="pt-3 text-[12px] leading-[1.75] max-h-[300px] overflow-y-auto text-[var(--text-primary)] space-y-0.5">
                {renderMd(worker.result)}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function DemoAgentSidebar({ scenario, workers, phase, visibleWorkers, locale = 'ko' }: {
  scenario: DemoScenario;
  workers: DemoScenario['workers'];
  phase: DemoPhase;
  visibleWorkers: number;
  locale?: 'ko' | 'en';
}) {
  const L = (ko: string, en: string) => locale === 'ko' ? ko : en;
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);
  const total = workers.length;
  const statuses = getAgentStatuses(phase, visibleWorkers, total);
  const doneCount = statuses.filter(s => s === 'done').length;
  const workingCount = statuses.filter(s => s === 'working').length;
  const progressPct = phaseGte(phase, 'draft') ? 100 :
    phaseGte(phase, 'workers') ? Math.round((doneCount / total) * 100) :
    phaseGte(phase, 'q1') ? Math.round((workingCount / total) * 30) : 0;

  return (
    <div className="p-4 space-y-3.5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--text-secondary)]">{L('분석 팀', 'Analysis Team')}</span>
        {phase === 'analysis' && (
          <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}
            className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-[var(--bg)] text-[10px] text-[var(--text-tertiary)] font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--text-tertiary)] animate-pulse" />
            {L('모이는 중', 'assembling')}
          </motion.span>
        )}
        {workingCount > 0 && phaseGte(phase, 'q1') && !phaseGte(phase, 'draft') && (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-[var(--accent)]/10 text-[10px] text-[var(--accent)] font-semibold">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] animate-pulse" />
            {L(`${workingCount}명 분석 중`, `${workingCount} analyzing`)}
          </span>
        )}
        {phaseGte(phase, 'draft') && (
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

      {/* Agent rows — sequentially revealed: only render once active (working/done) */}
      <div className="space-y-2">
        <AnimatePresence initial={false}>
          {workers.map((w, i) => {
            if (statuses[i] === 'waiting') return null;
            return (
              <AgentRow
                key={w.persona.id}
                worker={w}
                status={statuses[i]}
                expanded={expandedIdx === i}
                onToggle={() => setExpandedIdx(expandedIdx === i ? null : i)}
                locale={locale}
              />
            );
          })}
        </AnimatePresence>

        {/* Dynamic slot — Q1 답 전에 "? — 당신의 답이 결정" 플레이스홀더 (scenario1 v2 전용) */}
        {scenario.draftV2 && !phaseGte(phase, 'update1') && phaseGte(phase, 'analysis') && (
          <motion.div
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.3 } }}
            transition={{ delay: 0.4, duration: 0.45, ease: EASE }}
            className="rounded-xl border border-dashed border-[var(--accent)]/40 bg-[var(--accent)]/[0.03] p-3 flex items-center gap-3"
          >
            <div className="w-8 h-8 rounded-full border-2 border-dashed border-[var(--accent)]/40 flex items-center justify-center text-[14px] text-[var(--accent)]/60 shrink-0">
              ?
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[12px] font-semibold text-[var(--text-primary)]">{L('? — 세 번째 동료', '? — Third teammate')}</div>
              <p className="text-[10px] text-[var(--accent)] leading-snug mt-0.5">
                {L('당신의 Q1 답에 따라 누가 합류할지 정해져요', 'Your answer to Q1 decides who joins')}
              </p>
            </div>
          </motion.div>
        )}

        {/* Pending hint — shows how many more will join (기존 시나리오 2/3용) */}
        {(() => {
          if (scenario.draftV2) return null; // v2는 위 dynamic slot이 대체
          const pending = statuses.filter(s => s === 'waiting').length;
          if (pending === 0 || phaseGte(phase, 'workers')) return null;
          return (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ delay: 0.2 }}
              className="flex items-center gap-2 px-3 pt-1 text-[10px] text-[var(--text-tertiary)]"
            >
              <span className="w-1 h-1 rounded-full bg-[var(--text-tertiary)]/40" />
              <span>{L(`${pending}명 더 합류 예정`, `${pending} more joining`)}</span>
            </motion.div>
          );
        })()}
      </div>

      {/* Summary section — appears when all done */}
      <AnimatePresence>
        {phaseGte(phase, 'draft') && (
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
                <span className="text-[10px] font-bold text-[var(--accent)] uppercase tracking-wider">{L('요약', 'Summary')}</span>
              </div>
              {workers.map((w) => (
                <div key={w.persona.id} className="flex items-start gap-2">
                  <div className="w-4 h-4 rounded-full flex items-center justify-center text-[8px] shrink-0 mt-0.5"
                    style={{ backgroundColor: w.persona.color + '20' }}>{w.persona.emoji}</div>
                  <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed">
                    {w.completionNote || w.task}
                  </p>
                </div>
              ))}
              <div className="pt-1.5 border-t border-[var(--accent)]/10">
                <p className="text-[10px] text-[var(--accent)]/70 flex items-center gap-1">
                  <ArrowRight size={8} />
                  {L('아래 기획안에 반영됨', 'Reflected in the draft below')}
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   MOBILE AGENT COMPACT BAR — shown below analysis on mobile
   ═══════════════════════════════════════════════════════════ */

function DemoAgentCompactBar({ workers, phase, visibleWorkers, locale = 'ko' }: {
  workers: DemoScenario['workers'];
  phase: DemoPhase;
  visibleWorkers: number;
  locale?: 'ko' | 'en';
}) {
  if (!phaseGte(phase, 'analysis')) return null;
  const total = workers.length;
  const statuses = getAgentStatuses(phase, visibleWorkers, total);
  const activeWorkers = workers.filter((_, i) => statuses[i] !== 'waiting');
  const workingCount = statuses.filter(s => s === 'working').length;
  const allDone = statuses.every(s => s === 'done');

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: EASE }}
      className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[var(--surface)] border border-[var(--border-subtle)]"
    >
      <div className="flex -space-x-1.5">
        <AnimatePresence initial={false}>
          {activeWorkers.map((w) => {
            const idx = workers.indexOf(w);
            const isWorking = statuses[idx] === 'working';
            return (
              <motion.div
                key={w.persona.id}
                layout
                initial={{ opacity: 0, scale: 0.6, x: -8 }}
                animate={{ opacity: 1, scale: 1, x: 0 }}
                exit={{ opacity: 0, scale: 0.6 }}
                transition={{ duration: 0.35, ease: EASE }}
                className={`w-6 h-6 rounded-full flex items-center justify-center text-[9px] border-2 border-[var(--surface)] ${
                  isWorking ? 'animate-pulse ring-1 ring-[var(--accent)]/30' : ''
                }`}
                style={{ backgroundColor: w.persona.color + '20' }}
              >
                {w.persona.emoji}
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
      <span className="text-[10px] text-[var(--text-secondary)] flex-1 inline-flex items-center gap-1.5">
        {allDone ? (locale === 'ko' ? '분석 완료' : 'Analysis done') : <>{locale === 'ko' ? `${workingCount}명 분석 중` : `${workingCount} analyzing`} <TypingDots /></>}
      </span>
      {workingCount > 0 && !allDone && (
        <Loader2 size={11} className="animate-spin text-[var(--accent)]" />
      )}
      {allDone && (
        <Check size={11} className="text-emerald-500" />
      )}
    </motion.div>
  );
}

/* ═══════════════════════════════════════════════════════════
   DRAFT CARD — mix preview
   ═══════════════════════════════════════════════════════════ */

function DemoDraftCard({ draft }: { draft: DemoScenario['draft'] }) {
  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, ease: EASE }}>
      <div className="rounded-2xl p-[1px] bg-gradient-to-b from-[var(--accent)]/20 to-transparent">
        <div className="rounded-[calc(1rem-1px)] bg-[var(--surface)]">
          <div className="h-[2px]" style={{ background: 'var(--gradient-gold)' }} />
          <div className="p-5 md:p-8 space-y-5">
            <span className="text-[9px] font-bold text-[var(--accent)] uppercase tracking-[0.2em] bg-[var(--accent)]/8 px-3 py-1 rounded-full">Draft</span>
            <h2 className="text-[20px] md:text-[24px] font-bold text-[var(--text-primary)] leading-tight">{draft.title}</h2>
            <blockquote className="border-l-[3px] border-[var(--accent)]/20 pl-5 text-[14px] text-[var(--text-secondary)] italic leading-relaxed">
              {renderInline(draft.executive_summary)}
            </blockquote>
            {draft.sections.slice(0, 3).map((s, i) => (
              <div key={i}>
                <h3 className="text-[14px] font-bold text-[var(--text-primary)] mb-1.5">{s.heading}</h3>
                <p className="text-[13px] text-[var(--text-primary)] leading-[1.8]">{renderInline(s.content)}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

/* ═══════════════════════════════════════════════════════════
   DRAFT CARD V2 — 응축 카드 (scenario 1 전용)
   Q1 답 → 세 번째 워커 + 결재 한 줄
   Q2 답 → 약한 가정 + 다음 3일
   ═══════════════════════════════════════════════════════════ */

type DemoThirdWorker = NonNullable<DemoScenario['q1']['effects'][string]['thirdWorker']>;
type DemoWeakestAssumption = NonNullable<DemoScenario['q2']['effects'][string]['weakestAssumption']>;

function DemoDraftCardV2({
  draft,
  q1Answer,
  q2Answer,
  workers,
  thirdWorker,
  decisionLine,
  weakestAssumption,
  nextThreeDays,
  locale = 'ko',
}: {
  draft: NonNullable<DemoScenario['draftV2']>;
  q1Answer: string | null;
  q2Answer: string | null;
  workers: DemoScenario['workers'];
  thirdWorker: DemoThirdWorker | null;
  decisionLine: string | null;
  weakestAssumption: DemoWeakestAssumption | null;
  nextThreeDays: string[] | null;
  locale?: 'ko' | 'en';
}) {
  const L = (ko: string, en: string) => locale === 'ko' ? ko : en;

  // Runtime values (Q1/Q2가 default를 덮어씀)
  const finalDecisionLine = decisionLine ?? draft.decisionLineDefault;
  const finalWeakest = weakestAssumption ?? draft.weakestAssumptionDefault;
  const finalNextThreeDays = nextThreeDays ?? draft.nextThreeDaysDefault;

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, ease: EASE }}>
      <div className="rounded-2xl p-[1px] bg-gradient-to-b from-[var(--accent)]/20 to-transparent">
        <div className="rounded-[calc(1rem-1px)] bg-[var(--surface)]">
          <div className="h-[2px]" style={{ background: 'var(--gradient-gold)' }} />
          <div className="p-5 md:p-8 space-y-6">
            {/* Header — 사용자 답 출처 표시 */}
            {(q1Answer || q2Answer) && (
              <div className="pb-3 border-b border-[var(--border-subtle)] space-y-1.5">
                {q1Answer && (
                  <div className="flex items-start gap-2">
                    <Sparkles size={12} className="text-[var(--accent)] shrink-0 mt-0.5" />
                    <div className="text-[11px] text-[var(--text-secondary)] leading-relaxed flex-1">
                      <span className="font-semibold text-[var(--accent)] mr-1.5">Q1</span>
                      <span className="font-medium text-[var(--text-primary)]">{q1Answer}</span>
                      {thirdWorker && (
                        <span className="block mt-0.5 pl-[18px]">
                          → <span className="inline-flex items-center gap-1" style={{ color: thirdWorker.persona.color }}>
                            <span>{thirdWorker.persona.emoji}</span>
                            <span className="font-semibold">{thirdWorker.persona.name}</span>
                          </span>
                          <span className="text-[var(--text-tertiary)] ml-1">
                            {L('합류', 'joined')}
                          </span>
                        </span>
                      )}
                    </div>
                  </div>
                )}
                {q2Answer && (
                  <div className="flex items-start gap-2">
                    <Sparkles size={12} className="text-[var(--accent)] shrink-0 mt-0.5" />
                    <div className="text-[11px] text-[var(--text-secondary)] leading-relaxed flex-1">
                      <span className="font-semibold text-[var(--accent)] mr-1.5">Q2</span>
                      <span className="font-medium text-[var(--text-primary)]">{q2Answer}</span>
                      <span className="text-[var(--text-tertiary)] ml-1">
                        → {L('다음 3일과 약한 가정이 정해졌어요', 'set your next 3 days + the weakest assumption')}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div>
              <span className="text-[9px] font-bold text-[var(--accent)] uppercase tracking-[0.2em] bg-[var(--accent)]/8 px-3 py-1 rounded-full inline-block mb-3">Draft</span>
              <h2 className="text-[20px] md:text-[24px] font-bold text-[var(--text-primary)] leading-tight">{draft.title}</h2>
            </div>

            {/* 💡 결재 한 줄 */}
            <div className="rounded-xl bg-[var(--accent)]/[0.05] border border-[var(--accent)]/15 p-4">
              <p className="text-[10px] font-bold text-[var(--accent)] uppercase tracking-wider mb-1.5">
                💡 {L('결재 한 줄', 'Decision line')}
              </p>
              <p className="text-[15px] md:text-[16px] text-[var(--text-primary)] leading-[1.55] font-medium">
                &ldquo;{finalDecisionLine}&rdquo;
              </p>
            </div>

            {/* 팀이 만든 한 줄들 */}
            <div>
              <h3 className="text-[11px] font-bold text-[var(--text-tertiary)] uppercase tracking-wider mb-3.5">
                {L('팀이 만든 한 줄들', 'What the team built')}
              </h3>
              <div className="space-y-4">
                {draft.workerSummariesDefault.map((summary) => {
                  const worker = workers.find(w => w.persona.id === summary.personaId);
                  if (!worker) return null;
                  return (
                    <div key={summary.personaId} className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center text-[13px] shrink-0"
                        style={{ backgroundColor: worker.persona.color + '22', color: worker.persona.color }}>
                        {worker.persona.emoji}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[13px] font-semibold text-[var(--text-primary)]">
                          {worker.persona.name}
                          <span className="text-[var(--text-tertiary)] font-normal ml-1.5">— {summary.headline}</span>
                        </div>
                        <ul className="mt-1 space-y-1">
                          {summary.lines.map((line, j) => (
                            <li key={j} className="text-[12px] md:text-[13px] text-[var(--text-secondary)] leading-[1.6] flex gap-2">
                              <span className="text-[var(--accent)]/50 shrink-0">└</span>
                              <span>{renderInline(line)}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  );
                })}
                {thirdWorker && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3, duration: 0.5, ease: EASE }}
                    className="flex items-start gap-3"
                  >
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-[13px] shrink-0 ring-2"
                      style={{
                        backgroundColor: thirdWorker.persona.color + '22',
                        color: thirdWorker.persona.color,
                        ['--tw-ring-color' as string]: thirdWorker.persona.color + '40',
                      }}>
                      {thirdWorker.persona.emoji}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[13px] font-semibold text-[var(--text-primary)]">
                          {thirdWorker.persona.name}
                        </span>
                        <span className="text-[11px] text-[var(--text-tertiary)]">— {thirdWorker.task}</span>
                        <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-[var(--accent)]/10 text-[var(--accent)]">
                          {L('당신의 답으로 합류', 'joined by your choice')}
                        </span>
                      </div>
                      <p className="mt-1 text-[12px] md:text-[13px] text-[var(--text-secondary)] leading-[1.6] italic">
                        &ldquo;{thirdWorker.completionNote}&rdquo;
                      </p>
                    </div>
                  </motion.div>
                )}
              </div>
            </div>

            {/* ⚠ 가장 약한 가정 */}
            <div className="rounded-xl border border-amber-400/30 bg-amber-50/30 dark:bg-amber-950/10 p-4">
              <p className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider mb-1.5">
                ⚠ {L('가장 약한 가정', 'Weakest assumption')} <span className="font-normal text-[var(--text-tertiary)] normal-case">({L('대표님이 먼저 물을 거예요', 'CEO will ask first')})</span>
              </p>
              <p className="text-[14px] md:text-[15px] text-[var(--text-primary)] leading-[1.55] font-medium">
                &ldquo;{finalWeakest.assumption}&rdquo;
              </p>
              <p className="text-[12px] text-[var(--text-secondary)] leading-[1.6] mt-1.5">
                → {finalWeakest.explanation}
              </p>
            </div>

            {/* 📌 다음 3일 */}
            <div>
              <p className="text-[10px] font-bold text-[var(--accent)]/80 uppercase tracking-wider mb-2.5">
                📌 {L('다음 3일', 'Next 3 days')}
              </p>
              <ol className="space-y-2">
                {finalNextThreeDays.map((step, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-[13px] md:text-[14px] text-[var(--text-primary)] leading-[1.55]">
                    <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-[var(--accent)]/12 text-[10px] font-bold text-[var(--accent)] shrink-0 mt-0.5">{i + 1}</span>
                    <span>{renderInline(step)}</span>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

/* ═══════════════════════════════════════════════════════════
   DM FEEDBACK — with interactive toggles
   ═══════════════════════════════════════════════════════════ */

function DemoDMFeedback({ fb, onToggle, onDone, showDoneButton = true, locale = 'ko' }: {
  fb: DemoScenario['dmVariants'][string];
  onToggle: (i: number) => void;
  onDone: () => void;
  showDoneButton?: boolean;
  locale?: 'ko' | 'en';
}) {
  const L = (ko: string, en: string) => locale === 'ko' ? ko : en;
  const appliedCount = fb.concerns.filter(c => c.applied).length;

  return (
    <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, ease: EASE }}>
      <div className="rounded-2xl md:rounded-[2rem] bg-[var(--surface)] border border-[var(--border-subtle)] shadow-[var(--shadow-sm)]">
        <div className="p-6 md:p-10 space-y-7">
          {/* Persona — single line, quiet */}
          <div className="flex items-center gap-2.5 text-[12px] text-[var(--text-tertiary)]">
            <div className="w-7 h-7 rounded-full bg-[var(--accent)]/8 flex items-center justify-center">
              <UserCheck size={13} className="text-[var(--accent)]" />
            </div>
            <span className="font-semibold text-[13px] text-[var(--text-primary)]">{fb.persona_name}</span>
            <span className="text-[var(--text-tertiary)]">·</span>
            <span>{fb.persona_role}</span>
          </div>

          {/* The reaction — main quote, no border decoration */}
          <blockquote className="text-[19px] md:text-[21px] text-[var(--text-primary)] leading-[1.55] font-medium tracking-[-0.005em]">
            &ldquo;{fb.first_reaction}&rdquo;
          </blockquote>

          {/* Concerns — the work area */}
          {fb.concerns.length > 0 && (
            <div className="pt-2">
              <div className="flex items-baseline justify-between mb-4">
                <h4 className="text-[11px] font-bold text-[var(--text-tertiary)] uppercase tracking-[0.12em]">
                  {L('수정 요청', 'Revisions')} <span className="text-[var(--text-tertiary)]/60">({fb.concerns.length})</span>
                </h4>
                <span className="text-[11px] text-[var(--text-tertiary)]">
                  {appliedCount > 0
                    ? L(`${appliedCount}건 반영됨`, `${appliedCount} applied`)
                    : L('반영할 항목을 선택하세요', 'Select to apply')}
                </span>
              </div>
              <div className="space-y-2.5">
                {fb.concerns.map((c: DMConcern, i: number) => (
                  <button
                    key={i}
                    onClick={() => onToggle(i)}
                    className={`group w-full text-left rounded-2xl border p-4 md:p-5 cursor-pointer transition-all duration-500 ${
                      c.applied
                        ? 'border-[var(--accent)]/30 bg-[var(--accent)]/[0.04]'
                        : 'border-[var(--border-subtle)] bg-[var(--bg)] hover:border-[var(--accent)]/30 hover:bg-[var(--accent)]/[0.02]'
                    }`}
                    style={{ transitionTimingFunction: 'cubic-bezier(0.32,0.72,0,1)' }}
                  >
                    <div className="flex items-start gap-3.5">
                      {/* Toggle indicator */}
                      <div className={`mt-0.5 w-[18px] h-[18px] rounded-full border-[1.5px] flex items-center justify-center shrink-0 transition-all duration-300 ${
                        c.applied
                          ? 'bg-[var(--accent)] border-[var(--accent)]'
                          : 'border-[var(--border-strong)] group-hover:border-[var(--accent)]/60'
                      }`}>
                        {c.applied && <Check size={11} strokeWidth={3} className="text-white" />}
                      </div>
                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <p className="text-[14px] md:text-[15px] text-[var(--text-primary)] leading-[1.55] font-medium">
                          {c.text}
                        </p>
                        <p className="text-[12px] md:text-[13px] text-[var(--text-secondary)] leading-[1.55] mt-1.5">
                          {c.fix_suggestion}
                        </p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Approval condition — quiet closing line */}
          <div className="pt-2">
            <p className="text-[10px] font-bold text-[var(--accent)]/80 uppercase tracking-[0.14em] mb-2">
              {L('결정 조건', 'Decision condition')}
            </p>
            <p className="text-[14px] md:text-[15px] text-[var(--text-primary)] leading-[1.6]">
              {fb.approval_condition}
            </p>
          </div>

          {/* Done button */}
          {showDoneButton && (
            <motion.button onClick={onDone} whileTap={{ scale: 0.98 }}
              className="w-full flex items-center justify-center gap-2 px-6 py-4 text-white rounded-2xl text-[14px] font-semibold shadow-[var(--shadow-sm)] cursor-pointer mt-2"
              style={{ background: 'var(--gradient-gold)' }}>
              {L('반영하고 최종 문서 보기', 'Apply and see final document')} <ChevronRight size={14} />
            </motion.button>
          )}
        </div>
      </div>
    </motion.div>
  );
}

/* ═══════════════════════════════════════════════════════════
   FINAL CARD — with variant swap
   ═══════════════════════════════════════════════════════════ */

/* ───── Answer chip with click-to-change dropdown ───── */
function AnswerChip({
  label,
  currentValue,
  options,
  onChange,
  isOverridden,
}: {
  label: string;
  currentValue: string;
  options: string[];
  onChange: (v: string) => void;
  isOverridden?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  return (
    <div ref={ref} className="relative inline-block">
      <button
        onClick={() => setOpen(!open)}
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border cursor-pointer transition-colors ${
          isOverridden
            ? 'bg-[var(--accent)]/12 border-[var(--accent)]/40'
            : 'bg-[var(--surface)] border-[var(--border-subtle)] hover:border-[var(--accent)]/30'
        }`}
      >
        <span className="font-bold text-[var(--accent)]">{label}</span>
        <span className="text-[var(--text-primary)] font-medium max-w-[200px] truncate">{currentValue}</span>
        <ChevronDown size={9} className="text-[var(--text-tertiary)]" />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
            className="absolute top-full mt-1 left-0 min-w-[min(280px,calc(100vw-2rem))] max-w-[min(360px,calc(100vw-2rem))] rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] shadow-2xl z-50 py-1.5 overflow-hidden"
          >
            {options.map((opt) => {
              const isCurrent = opt === currentValue;
              return (
                <button
                  key={opt}
                  onClick={() => { onChange(opt); setOpen(false); }}
                  className={`w-full text-left px-3 py-2 text-[12px] flex items-start gap-2 transition-colors ${
                    isCurrent
                      ? 'bg-[var(--accent)]/8 text-[var(--text-primary)] font-medium'
                      : 'text-[var(--text-secondary)] hover:bg-[var(--accent)]/5 hover:text-[var(--text-primary)]'
                  }`}
                >
                  <Check size={11} className={`mt-1 shrink-0 ${isCurrent ? 'text-[var(--accent)]' : 'opacity-0'}`} />
                  <span className="flex-1 leading-[1.5]">{opt}</span>
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ───── Final card — with override-and-morph support ───── */
function DemoFinalCard({
  scenario,
  concerns,
  q1Answer,
  q2Answer,
  dmKey: initialDmKey,
  locale = 'ko',
}: {
  scenario: DemoScenario;
  concerns: DMConcern[];
  q1Answer?: string | null;
  q2Answer?: string | null;
  dmKey?: string | null;
  locale?: 'ko' | 'en';
}) {
  const L = (ko: string, en: string) => locale === 'ko' ? ko : en;
  const [copied, setCopied] = useState(false);

  // Local override state — user can re-pick Q1/Q2 inside the final card
  const [q1Override, setQ1Override] = useState<string | null>(null);
  const [q2Override, setQ2Override] = useState<string | null>(null);

  const effectiveQ1 = q1Override ?? q1Answer ?? null;
  const effectiveQ2 = q2Override ?? q2Answer ?? null;

  // Derive dynamic data from effective answers
  const q1Effect = effectiveQ1 ? scenario.q1.effects[effectiveQ1] : undefined;
  const q2Effect = effectiveQ2 ? scenario.q2.effects[effectiveQ2] : undefined;
  const effectiveThirdWorker = q1Effect?.thirdWorker ?? null;
  const effectiveDecisionLine = q1Effect?.decisionLine ?? null;
  const effectiveWeakest = q2Effect?.weakestAssumption ?? null;
  const effectiveNextThree = q2Effect?.nextThreeDays ?? null;
  const effectiveDmKey = q1Effect?.dmKey ?? initialDmKey ?? 'ceo';
  const effectiveDm = scenario.dmVariants[effectiveDmKey];

  const liveContent = useMemo(
    () => buildFinal(scenario, concerns, {
      decisionLine: effectiveDecisionLine,
      thirdWorker: effectiveThirdWorker,
      weakestAssumption: effectiveWeakest,
      nextThreeDays: effectiveNextThree,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [scenario, concerns, effectiveDecisionLine, effectiveThirdWorker, effectiveWeakest, effectiveNextThree],
  );

  const handleCopy = () => {
    navigator.clipboard.writeText(liveContent).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleDownload = () => {
    const blob = new Blob([liveContent], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${L('기획안', 'plan')}-${Date.now()}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleReset = () => {
    setQ1Override(null);
    setQ2Override(null);
  };

  const isOverridden = !!(q1Override || q2Override);
  const hasAttribution = !!(effectiveQ1 || effectiveQ2 || effectiveThirdWorker || effectiveDm);

  const q1Options = Object.keys(scenario.q1.effects);
  const q2Options = Object.keys(scenario.q2.effects);

  return (
    <motion.div initial={{ opacity: 0, y: 30, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.9, ease: EASE }}>
      <div className="rounded-2xl md:rounded-[2rem] bg-[var(--surface)] border border-[var(--border-subtle)] shadow-[var(--shadow-xl)] overflow-hidden">
        {/* Header — minimal, paper-like */}
        <div className="px-6 md:px-10 py-3.5 flex items-center justify-between border-b border-[var(--border-subtle)]">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--accent)' }} />
            <span className="text-[10px] font-bold text-[var(--text-tertiary)] uppercase tracking-[0.14em]">
              {L('완성된 기획안', 'Final Document')}
            </span>
          </div>
          <div className="flex items-center gap-1">
            {isOverridden && (
              <button onClick={handleReset}
                className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg text-[11px] font-medium cursor-pointer text-[var(--text-tertiary)] hover:text-[var(--accent)] hover:bg-[var(--accent)]/[0.05] transition-all">
                ↺ {L('원래 답으로', 'Reset')}
              </button>
            )}
            <button onClick={handleCopy}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[12px] font-medium cursor-pointer transition-all duration-200 ${
                copied
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-[var(--text-secondary)] hover:text-[var(--accent)] hover:bg-[var(--accent)]/[0.05]'
              }`}>
              {copied ? <><Check size={12} /> {L('복사됨', 'Copied')}</> : <>{L('복사', 'Copy')}</>}
            </button>
            <button onClick={handleDownload}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[12px] font-medium cursor-pointer transition-all duration-200 text-[var(--text-secondary)] hover:text-[var(--accent)] hover:bg-[var(--accent)]/[0.05]">
              {L('.md 저장', '.md')}
            </button>
          </div>
        </div>

        {/* Attribution chips — clickable to change answers */}
        {hasAttribution && (
          <div className="px-6 md:px-10 py-3 border-b border-[var(--border-subtle)] bg-[var(--accent)]/[0.025]">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-[11px]">
              <Sparkles size={11} className="text-[var(--accent)] shrink-0" />
              <span className="text-[var(--text-tertiary)]">
                {isOverridden
                  ? L('다른 답으로 시뮬레이션 중이에요', 'Simulating with different answers')
                  : L('이 문서는 당신의 답으로 만들어졌어요 — 클릭해서 다른 답도 비교해보세요', 'This document was shaped by your answers — click to compare')}
              </span>
              {effectiveQ1 && (
                <AnswerChip
                  label="Q1"
                  currentValue={effectiveQ1}
                  options={q1Options}
                  onChange={(v) => setQ1Override(v === q1Answer ? null : v)}
                  isOverridden={!!q1Override}
                />
              )}
              {effectiveQ2 && (
                <AnswerChip
                  label="Q2"
                  currentValue={effectiveQ2}
                  options={q2Options}
                  onChange={(v) => setQ2Override(v === q2Answer ? null : v)}
                  isOverridden={!!q2Override}
                />
              )}
              {effectiveThirdWorker && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[var(--surface)] border" style={{ borderColor: effectiveThirdWorker.persona.color + '40' }}>
                  <span style={{ color: effectiveThirdWorker.persona.color }}>{effectiveThirdWorker.persona.emoji}</span>
                  <span className="font-semibold" style={{ color: effectiveThirdWorker.persona.color }}>{effectiveThirdWorker.persona.name}</span>
                  <span className="text-[var(--text-tertiary)]">{L('합류', 'joined')}</span>
                </span>
              )}
              {effectiveDm && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[var(--surface)] border border-[var(--border-subtle)]">
                  <UserCheck size={9} className="text-[var(--text-tertiary)]" />
                  <span className="text-[var(--text-primary)] font-medium">{effectiveDm.persona_name}</span>
                  <span className="text-[var(--text-tertiary)]">{L('검토', 'reviewed')}</span>
                </span>
              )}
            </div>
          </div>
        )}

        {/* Document — paper-like generous padding. Key on liveContent so renderMd remounts on change */}
        <AnimatePresence mode="wait">
          <motion.div
            key={liveContent.slice(0, 100)}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.3, ease: EASE }}
            className="px-6 md:px-12 py-8 md:py-12 space-y-0 text-[14px] leading-[1.8]"
          >
            {renderMd(liveContent)}
          </motion.div>
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

/* ═══════════════════════════════════════════════════════════
   DM MATCHING TRANSITION — bridge between draft and dm
   ═══════════════════════════════════════════════════════════ */

function DMMatchingTransition({ personaName, personaRole, locale, onDone }: {
  personaName: string;
  personaRole: string;
  locale: 'ko' | 'en';
  onDone: () => void;
}) {
  const L = (ko: string, en: string) => locale === 'ko' ? ko : en;
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;
  const [step, setStep] = useState(0);

  const steps = [
    L('초안 검토 중', 'Reading the draft'),
    L('결정 맥락 추출', 'Extracting decision context'),
    L('의사결정권자 페르소나 매칭', 'Matching decision-maker persona'),
  ];

  useEffect(() => {
    const t1 = setTimeout(() => setStep(1), 100);
    const t2 = setTimeout(() => setStep(2), 800);
    const t3 = setTimeout(() => setStep(3), 1500);
    const t4 = setTimeout(() => setStep(4), 2300);
    const t5 = setTimeout(() => onDoneRef.current(), 3300);
    return () => { [t1, t2, t3, t4, t5].forEach(clearTimeout); };
  }, []);

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: EASE }}
      className="rounded-2xl md:rounded-[2rem] p-[1px] bg-gradient-to-b from-[var(--border-subtle)] to-transparent">
      <div className="rounded-[calc(1rem-1px)] md:rounded-[calc(2rem-1px)] bg-[var(--surface)] p-8 md:p-10 min-h-[280px] flex flex-col items-center justify-center">
        <AnimatePresence mode="wait">
          {step < 4 ? (
            <motion.div key="steps"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.3, ease: EASE }}
              className="w-full max-w-sm space-y-3.5"
            >
              {steps.map((label, i) => {
                const reached = step > i + 1;
                const active = step === i + 1;
                const dim = step < i + 1;
                return (
                  <motion.div key={i}
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: dim ? 0.3 : 1, x: 0 }}
                    transition={{ duration: 0.4, ease: EASE }}
                    className="flex items-center gap-3"
                  >
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center transition-all duration-500 ${
                      reached ? 'bg-[var(--accent)]' : active ? 'bg-[var(--accent)]/15 border border-[var(--accent)]/40' : 'bg-[var(--border-subtle)]'
                    }`}>
                      {reached ? (
                        <Check size={11} className="text-white" />
                      ) : active ? (
                        <motion.div className="w-1.5 h-1.5 rounded-full bg-[var(--accent)]"
                          animate={{ scale: [0.6, 1.2, 0.6], opacity: [0.6, 1, 0.6] }}
                          transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
                        />
                      ) : null}
                    </div>
                    <span className={`text-[13px] transition-colors duration-500 ${
                      reached || active ? 'text-[var(--text-primary)] font-medium' : 'text-[var(--text-tertiary)]'
                    }`}>
                      {label}{active ? '...' : ''}
                    </span>
                  </motion.div>
                );
              })}
            </motion.div>
          ) : (
            <motion.div key="reveal"
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.6, ease: EASE }}
              className="flex flex-col items-center text-center gap-4"
            >
              <motion.div
                initial={{ scale: 0.6, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.1, duration: 0.6, ease: EASE }}
                className="w-16 h-16 rounded-full bg-[var(--accent)]/10 border border-[var(--accent)]/25 flex items-center justify-center"
              >
                <UserCheck size={28} className="text-[var(--accent)]" />
              </motion.div>
              <div>
                <p className="text-[10px] font-bold text-[var(--accent)] uppercase tracking-[0.18em] mb-1.5">
                  {L('매칭 완료', 'Matched')}
                </p>
                <p className="text-[18px] font-bold text-[var(--text-primary)]">{personaName}</p>
                <p className="text-[13px] text-[var(--text-tertiary)] mt-0.5">{personaRole}</p>
              </div>
              <motion.div
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5, duration: 0.4 }}
                className="text-[12px] text-[var(--text-secondary)] mt-2 flex items-center gap-2"
              >
                <TypingDots />
                <span>{L('가상 피드백을 생성하는 중', 'Generating simulated feedback')}</span>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

/* ═══════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════════ */

type Locale = 'ko' | 'en';

interface InteractiveDemoProps {
  scenario: DemoScenario;
  locale?: Locale;
  onStartReal: () => void;
  onBack: () => void;
}

export function InteractiveDemo({ scenario, locale = 'ko', onStartReal, onBack }: InteractiveDemoProps) {
  const L = (ko: string, en: string) => locale === 'ko' ? ko : en;
  const [phase, setPhase] = useState<DemoPhase>('typing');
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const dmRef = useRef<HTMLDivElement>(null);
  const matchingRef = useRef<HTMLDivElement>(null);
  const analysisRef = useRef<HTMLDivElement>(null);

  // Snapshot history
  const [snapshots, setSnapshots] = useState<AnalysisSnapshot[]>([]);
  const [q1Answer, setQ1Answer] = useState<string | null>(null);
  const [q2Answer, setQ2Answer] = useState<string | null>(null);
  const [dmKey, setDmKey] = useState<string>('ceo');
  const [concerns, setConcerns] = useState<DMConcern[]>([]);
  const [visibleWorkers, setVisibleWorkers] = useState(0);

  // v2: Q1 답이 결정하는 것들 (scenario1 전용, 다른 시나리오는 null로 남음)
  type ThirdWorker = NonNullable<DemoScenario['q1']['effects'][string]['thirdWorker']>;
  type WeakestAssumption = NonNullable<DemoScenario['q2']['effects'][string]['weakestAssumption']>;
  const [thirdWorker, setThirdWorker] = useState<ThirdWorker | null>(null);
  const [decisionLine, setDecisionLine] = useState<string | null>(null);
  // v2: Q2 답이 결정하는 것들
  const [weakestAssumption, setWeakestAssumption] = useState<WeakestAssumption | null>(null);
  const [nextThreeDays, setNextThreeDays] = useState<string[] | null>(null);
  const [dmFirstReactionOverride, setDmFirstReactionOverride] = useState<string | null>(null);

  // Runtime workers = default workers + thirdWorker (Q1 답 후)
  const runtimeWorkers = thirdWorker
    ? [...scenario.workers, thirdWorker]
    : scenario.workers;

  // Track for analytics
  const entryRef = useRef(Date.now());
  useEffect(() => {
    track('demo_enter', { scenario: scenario.id });
  }, [scenario.id]);

  // Auto-scroll on phase change (debounced to prevent flicker from parent re-renders)
  const lastScrollPhase = useRef<string>('');
  const scrollToBottom = useCallback(() => {
    setTimeout(() => {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }, 150);
  }, []);

  useEffect(() => {
    const key = `${phase}-${visibleWorkers}`;
    if (key === lastScrollPhase.current) return;
    lastScrollPhase.current = key;
    // Snapshot updated (Q1/Q2 answered): scroll to AnalysisCard top so user starts reading from real_question
    if (phase === 'update1' || phase === 'update2') {
      setTimeout(() => {
        analysisRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 200);
    } else if (phase === 'dm') {
      setTimeout(() => {
        dmRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 200);
    } else if (phase === 'matching') {
      setTimeout(() => {
        matchingRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 200);
    } else {
      scrollToBottom();
    }
  }, [phase, visibleWorkers, scrollToBottom]);

  // Auto-advance for non-interactive phases
  const advance = useCallback((nextPhase: DemoPhase, delay: number) => {
    const t = setTimeout(() => setPhase(nextPhase), delay);
    return () => clearTimeout(t);
  }, []);

  // Phase: analysis → show v0, give 다은 visible solo time, then pause at q1
  useEffect(() => {
    if (phase === 'analysis') {
      setSnapshots([scenario.analysis]);
      return advance('q1', 2200);
    }
  }, [phase, scenario.analysis, advance]);

  // Phase: update1 → apply Q1 patch + 세 번째 워커 합류 + 결재 한 줄 세팅 → workers로 진행
  useEffect(() => {
    if (phase !== 'update1' || !q1Answer) return;
    const effect = scenario.q1.effects[q1Answer];
    if (effect) {
      setSnapshots(s => {
        const prev = s[s.length - 1];
        return [...s, applyPatch(prev, effect.snapshotPatch)];
      });
      setDmKey(effect.dmKey);
      // v2: Q1 답으로 세 번째 워커 합류 + 결재 한 줄
      if (effect.thirdWorker) setThirdWorker(effect.thirdWorker);
      if (effect.decisionLine) setDecisionLine(effect.decisionLine);
    }
    return advance('workers', 1500);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, q1Answer]);

  // Phase: workers → stagger reveal, then Q2 (워커 결과를 본 후 검증 선택)
  useEffect(() => {
    if (phase !== 'workers') return;
    setVisibleWorkers(0);
    const total = runtimeWorkers.length;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const delays = [800, 1600, 2400]; // stagger (세 번째 워커는 합류 뉘앙스를 주려고 조금 길게)
    for (let i = 0; i < total; i++) {
      timers.push(setTimeout(() => setVisibleWorkers(i + 1), delays[i]));
    }
    // 마지막 워커 등장 후 1.8초 여유 → Q2로
    timers.push(setTimeout(() => setPhase('q2'), delays[total - 1] + 1800));
    return () => timers.forEach(clearTimeout);
  }, [phase, runtimeWorkers.length]);

  // Phase: update2 → apply Q2 patch + 약한 가정 / 다음 3일 / DM 첫 반응 세팅 → draft로 진행
  useEffect(() => {
    if (phase !== 'update2' || !q2Answer) return;
    const effect = scenario.q2.effects[q2Answer];
    if (effect) {
      setSnapshots(s => {
        const prev = s[s.length - 1];
        return [...s, applyPatch(prev, effect.snapshotPatch)];
      });
      // v2: Q2 답으로 약한 가정 / 다음 3일 / DM 첫 반응 덮어쓰기
      if (effect.weakestAssumption) setWeakestAssumption(effect.weakestAssumption);
      if (effect.nextThreeDays) setNextThreeDays(effect.nextThreeDays);
      if (effect.dmFirstReaction) setDmFirstReactionOverride(effect.dmFirstReaction);
    }
    return advance('draft', 1500);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, q2Answer]);

  // Phase: draft → initialize concerns (DM is triggered by CTA button, not auto-advance)
  useEffect(() => {
    if (phase === 'draft') {
      const dm = scenario.dmVariants[dmKey];
      if (dm) {
        setConcerns(dm.concerns.map(c => ({ ...c, applied: false })));
      }
    }
  }, [phase, scenario.dmVariants, dmKey]);

  // Handlers
  const handleQ1 = (v: string) => {
    setQ1Answer(v);
    track('demo_q1', { scenario: scenario.id, answer: v });
    setTimeout(() => setPhase('update1'), 400);
  };

  const handleQ2 = (v: string) => {
    setQ2Answer(v);
    track('demo_q2', { scenario: scenario.id, answer: v });
    setTimeout(() => setPhase('update2'), 400);
  };

  const handleToggle = (i: number) => {
    setConcerns(prev => prev.map((c, j) => j === i ? { ...c, applied: !c.applied } : c));
  };

  const handleDMDone = () => {
    track('demo_complete', {
      scenario: scenario.id,
      q1: q1Answer,
      q2: q2Answer,
      concerns_applied: concerns.filter(c => c.applied).length,
      time_ms: Date.now() - entryRef.current,
    });
    setPhase('final');
  };

  const currentSnapshot = snapshots[snapshots.length - 1] || null;
  const prevSnapshot = snapshots.length > 1 ? snapshots[snapshots.length - 2] : null;
  const dm = scenario.dmVariants[dmKey];
  const isDone = phase === 'final';
  // finalContent는 DemoFinalCard 안에서 직접 계산 (override-and-morph 지원)

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-[var(--border-subtle)] shrink-0 bg-[var(--surface)] z-10">
        <button onClick={onBack} className="min-h-[44px] px-3 -ml-3 text-[12px] text-[var(--text-tertiary)] hover:text-[var(--accent)] cursor-pointer transition-colors">
          &larr; {L('돌아가기', 'Back')}
        </button>
        <span className="text-[11px] text-[var(--text-tertiary)]">
          {scenario.icon} {scenario.title} {L('데모', 'Demo')}
        </span>
        <div className="w-16" />
      </div>

      {/* Content: main column (scroll) + sidebar column (own space) */}
      <div className="flex-1 overflow-hidden flex">
        {/* Main column — grows, scrolls independently */}
        <div ref={scrollRef} className="flex-1 h-full overflow-y-auto">
          <div className="max-w-2xl mx-auto px-5 md:px-6 py-6 space-y-5">

            {/* 1. Typing input */}
            {phaseGte(phase, 'typing') && (
              <TypingInput text={scenario.problemText} highlights={scenario.problemHighlights} onDone={() => setPhase('team')} locale={locale} />
            )}

            {/* 2. Team entrance — sidebar replaces this on desktop, keep for mobile timing */}
            <div className="lg:hidden">
              {phaseGte(phase, 'team') && (
                <TeamEntrance scenario={scenario} onDone={() => setPhase('analysis')} locale={locale} />
              )}
            </div>
            {/* Desktop: invisible trigger for team→analysis transition */}
            <div className="hidden lg:block">
              {phase === 'team' && <TeamEntranceTrigger onDone={() => setPhase('analysis')} />}
            </div>

            {/* 3. Analysis card (v0) */}
            {phaseGte(phase, 'analysis') && currentSnapshot && (
              <div ref={analysisRef} className="scroll-mt-4">
                <AnalysisCard snapshot={currentSnapshot} prevSnapshot={prevSnapshot} locale={locale} />
              </div>
            )}

            {/* Mobile: compact agent bar — hide after draft since sidebar summary / connector takes over */}
            <div className="lg:hidden">
              {!phaseGte(phase, 'draft') && (
                <DemoAgentCompactBar workers={runtimeWorkers} phase={phase} visibleWorkers={visibleWorkers} locale={locale} />
              )}
            </div>

            {/* 4. Q1 */}
            {phase === 'q1' && (
              <QuestionCard
                question={scenario.q1.question}
                onAnswer={handleQ1}
                allowFreeText={false}
                locale={locale}
              />
            )}

            {/* Q1 answer pill + team flow indicator */}
            {q1Answer && phaseGte(phase, 'update1') && (
              <div className="flex items-center gap-2 flex-wrap">
                <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={SPRING}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[var(--surface)] border border-[var(--border-subtle)] text-[11px]">
                  <Check size={10} className="text-[var(--accent)]" />
                  <span className="text-[var(--text-primary)] font-medium">{q1Answer}</span>
                </motion.div>
                <motion.span initial={{ opacity: 0, x: -4 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 }}
                  className="text-[10px] text-[var(--accent)]/60 flex items-center gap-1">
                  <ArrowRight size={9} /> {L('팀 분석에 반영', 'sent to team')}
                </motion.span>
              </div>
            )}

          {/* 5. Team status bar — workers working / done */}
          <AnimatePresence mode="wait">
            {phase === 'workers' && (
              <motion.div key="team-working"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6, transition: { duration: 0.25 } }}
                transition={{ duration: 0.4, ease: EASE }}
                className="flex items-center gap-3 px-4 py-3 rounded-xl bg-[var(--accent)]/[0.04] border border-[var(--accent)]/15"
              >
                <Loader2 size={14} className="animate-spin text-[var(--accent)] shrink-0" />
                <span className="text-[13px] text-[var(--text-primary)] font-medium">
                  {L('당신의 답변을 바탕으로 팀이 분석 중이에요', 'Team is analyzing based on your answers')}
                </span>
                <span className="text-[11px] text-[var(--accent)] font-semibold shrink-0">{visibleWorkers}/{runtimeWorkers.length}</span>
              </motion.div>
            )}
            {phaseGte(phase, 'q2') && !phaseGte(phase, 'draft') && (
              <motion.div key="team-done"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, transition: { duration: 0.2 } }}
                transition={{ duration: 0.4, ease: EASE }}
                className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-[var(--surface)] border border-[var(--border-subtle)]"
              >
                <div className="flex -space-x-1.5">
                  {runtimeWorkers.map(w => (
                    <div key={w.persona.id} className="w-5 h-5 rounded-full flex items-center justify-center text-[8px] border-2 border-[var(--surface)]"
                      style={{ backgroundColor: w.persona.color + '20' }}>{w.persona.emoji}</div>
                  ))}
                </div>
                <span className="text-[12px] text-[var(--text-secondary)] flex-1">
                  {L('팀 분석 완료 — 다음 단계를 골라주세요', 'Analysis complete — pick next step')}
                </span>
                <Check size={12} className="text-emerald-500" />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Update summary chip — surfaces Q1 result at user's eye level
              so the evolution in AnalysisCard above doesn't get missed. */}
          {snapshots.length > 1 && phaseGte(phase, 'workers') && !phaseGte(phase, 'draft') && (
            <UpdateSummaryChip
              snapshot={snapshots[snapshots.length - 1]}
              prevSnapshot={snapshots[snapshots.length - 2]}
              onSeeDetail={() =>
                analysisRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
              }
              locale={locale}
            />
          )}

          {/* 6. Q2 — workers 결과를 본 후 검증 방법 선택 */}
          {phase === 'q2' && (
            <QuestionCard
              question={scenario.q2.question}
              onAnswer={handleQ2}
              allowFreeText={false}
              locale={locale}
            />
          )}

          {/* Q2 answer pill */}
          {q2Answer && phaseGte(phase, 'update2') && (
            <div className="flex items-center gap-2 flex-wrap">
              <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={SPRING}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[var(--surface)] border border-[var(--border-subtle)] text-[11px]">
                <Check size={10} className="text-[var(--accent)]" />
                <span className="text-[var(--text-primary)] font-medium">{q2Answer}</span>
              </motion.div>
              <motion.span initial={{ opacity: 0, x: -4 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 }}
                className="text-[10px] text-[var(--accent)]/60 flex items-center gap-1">
                <ArrowRight size={9} /> {L('기획안에 반영', 'added to draft')}
              </motion.span>
            </div>
          )}

          {/* 7-8. Draft → DM page transition (single AnimatePresence for sync) */}
          <AnimatePresence mode="wait">
            {phase === 'draft' && (
              <motion.div key="draft-page"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -16, transition: { duration: 0.35, ease: EASE } }}
                transition={{ duration: 0.7, ease: EASE }}
              >
                {scenario.draftV2 ? (
                  <DemoDraftCardV2
                    draft={scenario.draftV2}
                    q1Answer={q1Answer}
                    q2Answer={q2Answer}
                    workers={runtimeWorkers}
                    thirdWorker={thirdWorker}
                    decisionLine={decisionLine}
                    weakestAssumption={weakestAssumption}
                    nextThreeDays={nextThreeDays}
                    locale={locale}
                  />
                ) : (
                  <DemoDraftCard draft={scenario.draft} />
                )}

                {/* CTA to enter DM feedback */}
                <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.0, duration: 0.5, ease: EASE }}
                  className="text-center py-6">
                  <p className="text-[13px] text-[var(--text-secondary)] mb-3">
                    {L('초안이 완성됐어요. 이걸 받아본 사람은 뭐라고 할까요?', 'The draft is ready. What would the person who reads this say?')}
                  </p>
                  <motion.button
                    onClick={() => setPhase('matching')}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="inline-flex items-center gap-2.5 px-6 py-3.5 rounded-2xl text-[15px] font-semibold text-white cursor-pointer shadow-lg hover:shadow-xl transition-shadow"
                    style={{ background: 'var(--gradient-gold)' }}
                  >
                    <UserCheck size={18} />
                    {L('의사결정권자 반응 보기', 'See decision-maker reaction')}
                    <ChevronRight size={15} />
                  </motion.button>
                </motion.div>
              </motion.div>
            )}

            {phase === 'matching' && dm && (
              <motion.div key="matching-page" ref={matchingRef}
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -16, transition: { duration: 0.3, ease: EASE } }}
                transition={{ duration: 0.5, ease: EASE }}
              >
                <DMMatchingTransition
                  personaName={dm.persona_name}
                  personaRole={dm.persona_role}
                  locale={locale}
                  onDone={() => setPhase('dm')}
                />
              </motion.div>
            )}

            {phaseGte(phase, 'dm') && dm && (
              <motion.div key="dm-page" ref={dmRef}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -16, transition: { duration: 0.3, ease: EASE } }}
                transition={{ duration: 0.6, delay: 0.1, ease: EASE }}
              >
                {/* Page divider */}
                <div className="flex items-center gap-4 py-4 mb-2">
                  <div className="flex-1 h-px bg-gradient-to-r from-transparent via-[var(--accent)]/20 to-transparent" />
                  <span className="text-[10px] font-bold text-[var(--accent)] uppercase tracking-widest">{L('다음 단계', 'Next Step')}</span>
                  <div className="flex-1 h-px bg-gradient-to-r from-transparent via-[var(--accent)]/20 to-transparent" />
                </div>

                <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25, duration: 0.5, ease: EASE }}
                  className="text-center pb-4">
                  <h3 className="text-[20px] md:text-[22px] font-bold text-[var(--text-primary)] tracking-tight">
                    {L('의사결정권자의 반응', 'Decision-maker\'s reaction')}
                  </h3>
                  <p className="text-[13px] text-[var(--text-secondary)] mt-1.5">
                    {L('초안을 본 의사결정권자의 피드백이에요', 'Here\'s how the decision-maker reacted to your draft')}
                  </p>
                </motion.div>
                <DemoDMFeedback
                  fb={{
                    ...dm,
                    concerns,
                    first_reaction: dmFirstReactionOverride ?? dm.first_reaction,
                  }}
                  onToggle={handleToggle}
                  onDone={handleDMDone}
                  showDoneButton={phase !== 'final'}
                  locale={locale}
                />
              </motion.div>
            )}
          </AnimatePresence>

          {/* 9. Final */}
          {phase === 'final' && (
            <>
              <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.5, ease: EASE }}
                className="flex items-center justify-center gap-2 py-3">
                <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: 'var(--gradient-gold)' }}>
                  <Check size={14} className="text-white" />
                </div>
                <p className="text-[14px] font-medium text-[var(--text-primary)]">
                  {concerns.filter(c => c.applied).length > 0
                    ? L(`피드백 ${concerns.filter(c => c.applied).length}건 반영 완료`, `${concerns.filter(c => c.applied).length} feedback item(s) applied`)
                    : L('초안 그대로 완성', 'Completed as-is')}
                </p>
              </motion.div>
              <AnimatePresence mode="wait">
                <DemoFinalCard
                  key={concerns.map(c => c.applied ? '1' : '0').join('')}
                  scenario={scenario}
                  concerns={concerns}
                  q1Answer={q1Answer}
                  q2Answer={q2Answer}
                  dmKey={dmKey}
                  locale={locale}
                />
              </AnimatePresence>
            </>
          )}

            <div ref={bottomRef} className="h-4" />
          </div>
        </div>

        {/* Agent sidebar — own column, not absolute. Reserves space so
            main column stays stable when it appears. */}
        {phaseGte(phase, 'analysis') && (
          <motion.aside
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3, duration: 0.5, ease: EASE }}
            className="hidden lg:flex w-[280px] xl:w-[300px] shrink-0 h-full overflow-y-auto border-l border-[var(--border-subtle)] bg-[var(--bg)]/30 flex-col"
          >
            <div className="p-4">
              <DemoAgentSidebar scenario={scenario} workers={runtimeWorkers} phase={phase} visibleWorkers={visibleWorkers} locale={locale} />
            </div>
          </motion.aside>
        )}
      </div>

      {/* Bottom CTA */}
      <div className={`shrink-0 border-t border-[var(--border-subtle)] bg-[var(--surface)] transition-all duration-500 ${
        isDone ? 'shadow-[var(--glow-gold)]' : ''
      }`}>
        {/* Phase progress dots */}
        <div className="max-w-2xl mx-auto px-5 pt-3 flex items-center justify-center gap-1.5">
          {(locale === 'ko' ? ['상황', '팀', '검증', '피드백', '완성'] : ['Analysis', 'Team', 'Validate', 'Feedback', 'Done']).map((label, i) => {
            const milestones: DemoPhase[] = ['analysis', 'workers', 'q2', 'dm', 'final'];
            const reached = phaseGte(phase, milestones[i]);
            const current = i === milestones.findIndex(m => !phaseGte(phase, m)) || (isDone && i === milestones.length - 1);
            return (
              <div key={i} className="flex items-center gap-1.5">
                {i > 0 && <div className={`w-4 h-px transition-colors duration-500 ${reached ? 'bg-[var(--accent)]/40' : 'bg-[var(--border-subtle)]'}`} />}
                <div className={`flex items-center gap-1 transition-all duration-300 ${current ? 'opacity-100' : reached ? 'opacity-60' : 'opacity-25'}`}>
                  <div className={`w-1.5 h-1.5 rounded-full transition-colors duration-500 ${reached ? 'bg-[var(--accent)]' : 'bg-[var(--text-tertiary)]'}`} />
                  <span className={`text-[9px] ${current ? 'text-[var(--accent)] font-semibold' : 'text-[var(--text-tertiary)]'}`}>{label}</span>
                </div>
              </div>
            );
          })}
        </div>
        <div className="max-w-2xl mx-auto px-5 pb-3 pt-2.5 flex items-center justify-between gap-3">
          <p className="text-[12px] text-[var(--text-secondary)]">
            {isDone ? L('내 상황으로 해보면 어떨까요?', 'Want to try with your own situation?') : ''}
          </p>
          <button onClick={onStartReal}
            className={`inline-flex items-center gap-2 px-6 py-3 text-white rounded-full text-[14px] font-semibold cursor-pointer min-h-[44px] transition-all duration-300 ${
              isDone ? 'shadow-[var(--glow-gold-intense)] hover:-translate-y-[1px]' : 'opacity-60 hover:opacity-90'
            }`}
            style={{ background: 'var(--gradient-gold)' }}>
            {L('내 상황으로 시작하기', 'Start with my situation')} <ChevronRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
