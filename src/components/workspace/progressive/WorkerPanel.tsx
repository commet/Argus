'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { motion, AnimatePresence, useAnimationControls } from 'framer-motion';
import { Users, ChevronUp, X, Settings, Plus, Trash2, Loader2 } from 'lucide-react';
import { useProgressiveStore } from '@/stores/useProgressiveStore';
import { useShallow } from 'zustand/react/shallow';
import { WorkerAvatar, AvatarRow } from './WorkerAvatar';
import { TypingDots } from './shared/AgentVisuals';
import { AgentSidebar } from './AgentSidebar';
import { useAgentAttentionStore } from '@/stores/useAgentAttentionStore';
import {
  getBuiltinPersonas,
  loadCustomization,
  updatePersonaName,
  addCustomPersona,
  removeCustomPersona,
  type CustomPersonaInput,
} from '@/lib/worker-personas';
import type { WorkerTask } from '@/stores/types';
import type { WorkerContext } from '@/lib/worker-engine';
import { useAgentStore } from '@/stores/useAgentStore';
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

// ─── Persona Settings Panel ───

const EMOJI_OPTIONS = ['🔍', '🎯', '📊', '✍️', '⚠️', '🎨', '⚖️', '📝', '⚙️', '📋', '🧠', '💡', '🛡️', '📈', '🎤', '🌍'];
const COLOR_OPTIONS = ['#3B82F6', '#8B5CF6', '#10B981', '#F59E0B', '#EF4444', '#EC4899', '#6B7280', '#06B6D4', '#14B8A6', '#A855F7'];

function PersonaSettings({ onClose }: { onClose: () => void }) {
  const locale = useLocale();
  const L = (ko: string, en: string) => locale === 'ko' ? ko : en;
  const builtins = getBuiltinPersonas(locale);
  const [customization, setCustomization] = useState(loadCustomization);
  const [addMode, setAddMode] = useState(false);
  const [newPersona, setNewPersona] = useState<CustomPersonaInput>({
    id: '', name: '', role: '', emoji: '🧠', expertise: '', tone: '', color: '#3B82F6', keywords: [],
  });
  const [keywordInput, setKeywordInput] = useState('');

  const handleNameChange = (id: string, name: string) => {
    updatePersonaName(id, name);
    setCustomization(loadCustomization());
  };

  const handleAddPersona = () => {
    if (!newPersona.name.trim() || !newPersona.role.trim()) return;
    const id = `custom_${Date.now()}`;
    const keywords = keywordInput.split(',').map(k => k.trim()).filter(Boolean);
    addCustomPersona({ ...newPersona, id, keywords });
    setCustomization(loadCustomization());
    setNewPersona({ id: '', name: '', role: '', emoji: '🧠', expertise: '', tone: '', color: '#3B82F6', keywords: [] });
    setKeywordInput('');
    setAddMode(false);
  };

  const handleRemoveCustom = (id: string) => {
    removeCustomPersona(id);
    setCustomization(loadCustomization());
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-[12px] font-semibold text-[var(--text-primary)]">{L('팀원 설정', 'Team Settings')}</span>
        <button onClick={onClose} className="text-[12px] text-[var(--accent)] cursor-pointer">{L('완료', 'Done')}</button>
      </div>

      {/* Built-in persona names */}
      <div className="space-y-1.5">
        <p className="text-[12.5px] text-[var(--text-secondary)] font-medium">{L('기본 팀원 이름 변경', 'Rename default members')}</p>
        {builtins.map(p => (
          <div key={p.id} className="flex items-center gap-2">
            <span className="text-[13px] w-6 text-center">{p.emoji}</span>
            <input
              defaultValue={customization.nameOverrides[p.id] || p.name}
              placeholder={p.name}
              maxLength={20}
              onBlur={(e) => handleNameChange(p.id, e.target.value)}
              className="flex-1 px-2 py-1 rounded-lg bg-[var(--bg)] border border-[var(--border-subtle)] text-[12.5px] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:border-[var(--accent)]/30"
            />
            <span className="text-[12px] text-[var(--text-secondary)] w-20 truncate">{p.role}</span>
          </div>
        ))}
      </div>

      {/* Custom personas */}
      {customization.customPersonas.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[12px] text-[var(--text-tertiary)] font-medium">{L('추가된 팀원', 'Custom members')}</p>
          {customization.customPersonas.map(p => (
            <div key={p.id} className="flex items-center gap-2">
              <span className="text-[13px] w-6 text-center">{p.emoji}</span>
              <span className="flex-1 text-[12.5px] text-[var(--text-primary)]">{p.name}</span>
              <span className="text-[12.5px] text-[var(--text-tertiary)]">{p.role}</span>
              <button onClick={() => handleRemoveCustom(p.id)} className="p-1.5 text-red-500 hover:text-[var(--danger)] hover:bg-[var(--danger)]/10 rounded-lg cursor-pointer transition-colors" aria-label={L('삭제', 'Delete')}>
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Add new persona */}
      {!addMode ? (
        <button
          onClick={() => setAddMode(true)}
          className="flex items-center gap-1.5 text-[12.5px] text-[var(--accent)] hover:underline cursor-pointer"
        >
          <Plus size={12} /> {L('새 팀원 추가', 'Add new member')}
        </button>
      ) : (
        <div className="space-y-2 p-3 rounded-xl bg-[var(--bg)] border border-[var(--border-subtle)]">
          <p className="text-[12px] font-semibold text-[var(--text-primary)]">{L('새 팀원', 'New member')}</p>

          {/* Emoji picker */}
          <div className="flex flex-wrap gap-1">
            {EMOJI_OPTIONS.map(e => (
              <button key={e} onClick={() => setNewPersona(p => ({ ...p, emoji: e }))}
                className={`text-[14px] w-7 h-7 rounded-lg cursor-pointer ${newPersona.emoji === e ? 'bg-[var(--accent)]/10 ring-1 ring-[var(--accent)]/30' : 'hover:bg-[var(--bg)]'}`}>
                {e}
              </button>
            ))}
          </div>

          <div className="flex gap-2">
            <input value={newPersona.name} onChange={e => setNewPersona(p => ({ ...p, name: e.target.value }))}
              placeholder={L('이름', 'Name')} maxLength={10}
              className="flex-1 px-2 py-1.5 rounded-lg bg-[var(--surface)] border border-[var(--border-subtle)] text-[12.5px] focus:outline-none focus:border-[var(--accent)]/30" />
            <input value={newPersona.role} onChange={e => setNewPersona(p => ({ ...p, role: e.target.value }))}
              placeholder={L('역할 (e.g., 데이터 사이언티스트)', 'Role (e.g., Data Scientist)')} maxLength={20}
              className="flex-1 px-2 py-1.5 rounded-lg bg-[var(--surface)] border border-[var(--border-subtle)] text-[12.5px] focus:outline-none focus:border-[var(--accent)]/30" />
          </div>

          <textarea value={newPersona.expertise} onChange={e => setNewPersona(p => ({ ...p, expertise: e.target.value }))}
            placeholder={L('전문 영역 설명 (프롬프트에 주입됩니다)', 'Describe expertise (injected into prompts)')} maxLength={100}
            className="w-full px-2 py-1.5 rounded-lg bg-[var(--surface)] border border-[var(--border-subtle)] text-[12.5px] resize-none focus:outline-none focus:border-[var(--accent)]/30" rows={2} />

          <input value={newPersona.tone} onChange={e => setNewPersona(p => ({ ...p, tone: e.target.value }))}
            placeholder={L('말투 스타일 (e.g., 데이터 기반으로 차분하게)', 'Tone style (e.g., calm and data-driven)')} maxLength={60}
            className="w-full px-2 py-1.5 rounded-lg bg-[var(--surface)] border border-[var(--border-subtle)] text-[12.5px] focus:outline-none focus:border-[var(--accent)]/30" />

          <input value={keywordInput} onChange={e => setKeywordInput(e.target.value)} maxLength={120}
            placeholder={L('매칭 키워드 (쉼표 구분: 데이터, 분석, ML)', 'Matching keywords (comma-separated: data, analysis, ML)')}
            className="w-full px-2 py-1.5 rounded-lg bg-[var(--surface)] border border-[var(--border-subtle)] text-[12.5px] focus:outline-none focus:border-[var(--accent)]/30" />

          {/* Color picker */}
          <div className="flex gap-1">
            {COLOR_OPTIONS.map(c => (
              <button key={c} onClick={() => setNewPersona(p => ({ ...p, color: c }))}
                className={`w-5 h-5 rounded-full cursor-pointer ${newPersona.color === c ? 'ring-2 ring-offset-1 ring-[var(--accent)]' : ''}`}
                style={{ backgroundColor: c }} />
            ))}
          </div>

          <div className="flex justify-end gap-2">
            <button onClick={() => setAddMode(false)} className="px-3 py-1.5 text-[12px] text-[var(--text-tertiary)] cursor-pointer">{L('취소', 'Cancel')}</button>
            <button onClick={handleAddPersona} disabled={!newPersona.name.trim() || !newPersona.role.trim()}
              className="px-3 py-1.5 text-[12px] text-[var(--accent-fg)] font-semibold rounded-lg disabled:opacity-30 cursor-pointer"
              style={{ background: 'var(--gradient-gold)' }}>{L('추가', 'Add')}</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Team header with active personas ───

function TeamHeader({ workers, onOpenSettings, settingsOpen }: { workers: WorkerTask[]; onOpenSettings: () => void; settingsOpen: boolean }) {
  const locale = useLocale();
  const L = (ko: string, en: string) => locale === 'ko' ? ko : en;
  const doneCount = workers.filter(w => w.status === 'done').length;
  const settledCount = workers.filter(isWorkerSettled).length;
  const runningCount = workers.filter(w => w.status === 'running' || w.status === 'ai_preparing').length;
  const attentionCount = workers.filter(workerNeedsAttention).length;
  const pendingCount = Math.max(0, workers.length - settledCount - runningCount);

  const activeEmojis = workers
    .filter(w => (w.status === 'running' || w.status === 'ai_preparing') && w.persona)
    .map(w => w.persona!.emoji);

  return (
    <>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users size={14} className="text-[var(--accent)]" />
          <span className="text-[13px] font-semibold text-[var(--text-primary)]">{L('팀', 'Team')}</span>
          <span className="text-[12.5px] text-[var(--text-secondary)] bg-[var(--bg)] px-2 py-0.5 rounded-full">
            {settledCount}/{workers.length}
          </span>
          {activeEmojis.length > 0 && (
            <span className="text-[12px]">{activeEmojis.join('')}</span>
          )}
        </div>
        <button type="button" onClick={onOpenSettings} aria-expanded={settingsOpen} aria-controls="worker-team-settings" className="p-2 text-[var(--text-tertiary)] hover:text-[var(--accent)] hover:bg-[var(--bg)] rounded-lg cursor-pointer transition-colors" title={L('팀원 설정', 'Team settings')} aria-label={L('팀원 설정', 'Team settings')}>
          <Settings size={14} />
        </button>
      </div>

      {/* Progress bar */}
      <div
        role="progressbar"
        aria-label={L('팀 작업 처리 상태', 'Team task status')}
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
          runningCount > 0 ? L(`${runningCount}명 작업 중`, `${runningCount} working`) : '',
          attentionCount > 0 ? L(`${attentionCount}건 확인 필요`, `${attentionCount} need attention`) : '',
          pendingCount > 0 ? L(`${pendingCount}명 대기 중`, `${pendingCount} pending`) : '',
        ].filter(Boolean).join(' · ') || L('모든 작업 완료', 'All tasks complete')}
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
  const [showSettings, setShowSettings] = useState(false);

  if (workers.length === 0) return null;

  const sorted = sortedWorkers(workers);

  return (
    <div className={`p-4 space-y-3 ${className ?? ''}`}>
      <TeamHeader workers={workers} settingsOpen={showSettings} onOpenSettings={() => setShowSettings(!showSettings)} />

      <AnimatePresence>
        {showSettings && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.3, ease: EASE }} className="overflow-hidden">
            <div id="worker-team-settings" className="pb-3 border-b border-[var(--border-subtle)]">
              <PersonaSettings onClose={() => setShowSettings(false)} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

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
                {w.persona?.name || 'AI'}
                {(() => {
                  const lv = w.agent_id ? useAgentStore.getState().getAgent(w.agent_id)?.level : undefined;
                  return lv != null && lv >= 2 ? (
                    <span className="agent-lv ml-1" style={{ fontSize: 12.5, padding: '0px 5px' }} data-level={lv}>
                      Lv.{lv}
                    </span>
                  ) : null;
                })()}
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
                  <Users size={14} className="text-[var(--accent)]" />
                  <span id={drawerTitleId} className="text-[13px] font-semibold text-[var(--text-primary)]">{L('팀', 'Team')}</span>
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
