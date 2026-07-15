'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Plus, Repeat, X as XIcon, Compass, Sparkles, Brain, UserCheck, Pencil, ChevronRight, SlidersHorizontal } from 'lucide-react';
import { useLocale } from '@/hooks/useLocale';
import { getAgentStats } from '@/lib/agent-stats';
import type { WorkerTask } from '@/stores/types';
import { WorkerAvatar } from './WorkerAvatar';
import { personaName, personaRole } from './shared/persona-format';
import { EASE } from './shared/constants';

/* ═══ Team Deploy Banner — 팀 구성 확인 ═══ */
const MAX_PERSONAS_PER_GROUP = 5;

export function TeamDeployBanner({
  workers, onDeploy, onUpdateWorker, onOpenPool, onRemoveWorker, onUpdateTask, onOpenFreePool, onReplaceWorker, onSetGroupTrack,
}: {
  workers: WorkerTask[];
  onDeploy: () => void;
  onUpdateWorker?: (id: string, partial: Partial<WorkerTask>) => void;
  /** Open the persona-pool modal in *task mode* for a given task group. */
  onOpenPool?: (taskGroupId: string) => void;
  /** Remove a single worker. The store enforces the "last-survivor" rule. */
  onRemoveWorker?: (workerId: string) => void;
  /** Save a new task description for the entire group. */
  onUpdateTask?: (taskGroupId: string, newText: string) => void;
  /** Open the persona-pool modal in *free mode* — no specific target. */
  onOpenFreePool?: () => void;
  /** Open the persona-pool modal in *replace mode* for one AI worker. */
  onReplaceWorker?: (workerId: string) => void;
  /** Switch a group's track: AI teammate / my own call / ask a person. */
  onSetGroupTrack?: (taskGroupId: string, track: 'ai' | 'self' | 'human') => void;
}) {
  const locale = useLocale();
  const L = (ko: string, en: string) => locale === 'ko' ? ko : en;
  // Inline edit state — only one group is in edit mode at a time. Captured
  // on enter, committed on blur/Enter, discarded on Escape.
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  // Hick's Law: a task group exposed 8–12 simultaneous controls (edit · add lens ·
  // per-member replace/remove · 3-way track toggle · add member · deploy) at the
  // exact moment the user just wants to start. Default to a clean preview (team
  // composition + one deploy CTA); all customization lives behind this toggle.
  // Nothing is removed — every control is one tap away (spine: friction escape kept).
  const [adjusting, setAdjusting] = useState(false);

  // Group workers by task_group_id so users can see which personas are
  // tackling the same task. Legacy sessions without group ids fall back to
  // worker.id (each worker = its own group of 1, identical to old behavior).
  const groups = (() => {
    const map = new Map<string, WorkerTask[]>();
    const order: string[] = [];
    for (const w of workers) {
      const gid = w.task_group_id || w.id;
      const existing = map.get(gid);
      if (existing) {
        existing.push(w);
      } else {
        map.set(gid, [w]);
        order.push(gid);
      }
    }
    return order.map(gid => {
      const members = (map.get(gid) || []).slice();
      // Sort: AI first (preserve add order), then self, then human.
      members.sort((a, b) => {
        const at = (a.agent_type || 'ai') === 'ai' ? 0 : a.agent_type === 'self' ? 1 : 2;
        const bt = (b.agent_type || 'ai') === 'ai' ? 0 : b.agent_type === 'self' ? 1 : 2;
        return at - bt;
      });
      return { groupId: gid, members, seed: members[0] };
    }).sort((a, b) => a.seed.step_index - b.seed.step_index);
  })();
  const total = workers.length;
  const staggerDelay = 0.07;
  // Whether any customization affordance exists at all — gates the "Adjust team" toggle.
  const canAdjust = !!(onOpenPool || onRemoveWorker || onUpdateTask || onOpenFreePool || onReplaceWorker || onSetGroupTrack);

  const renderRow = (w: WorkerTask, i: number, groupSize: number) => {
    const displayName = w.agent_type === 'human'
      ? (w.contact?.name || w.question_to_human?.slice(0, 15) || L('외부 확인', 'External'))
      : w.agent_type === 'self'
        ? L('내 판단', 'My decision')
        : (personaName(w.persona, locale) || 'AI');
    const roleText = w.agent_type === 'human'
      ? L('확인 요청', 'External check')
      : w.agent_type === 'self'
        ? L('세션 중 직접 답변', 'Answered in session')
        : personaRole(w.persona, locale);

    const isAI = (w.agent_type || 'ai') === 'ai';
    const canRemove = !!onRemoveWorker && groupSize > 1;
    const canReplace = !!onReplaceWorker && isAI;
    return (
      <motion.div key={w.id}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 + i * staggerDelay, duration: 0.3, ease: EASE }}
        className="group/row flex items-start gap-3 py-2.5 first:pt-0 last:pb-0">
        {/* Avatar */}
        {w.agent_type === 'human'
          ? <div className="w-8 h-8 rounded-full bg-[var(--bg)] flex items-center justify-center text-[14px] shrink-0 mt-0.5 border border-[var(--border-subtle)]">👤</div>
          : w.agent_type === 'self'
            ? <div className="w-8 h-8 rounded-full bg-[var(--bg)] flex items-center justify-center text-[14px] shrink-0 mt-0.5 border border-[var(--border-subtle)]">🧠</div>
            : <WorkerAvatar persona={w.persona} size="md" />
        }
        {/* Content — two-tier hierarchy:
            Line 1 = primary identity (name + origin badge)
            Line 2 = secondary context (role · expertise · growth cue)
            Scope/contact rows only when relevant. Cleaner than the
            previous flat-wrap of 5 inline pieces. */}
        <div className="flex-1 min-w-0">
          {/* Primary line — name + manual badge only */}
          <div className="flex items-baseline gap-1.5 flex-wrap">
            <span className="text-[14px] font-semibold text-[var(--text-primary)]">
              {displayName}
            </span>
            {w.added_manually && (
              <span className="inline-flex items-center gap-0.5 text-[9px] font-bold uppercase tracking-[0.1em] text-[var(--accent)] bg-[var(--accent)]/[0.08] border border-[var(--accent)]/20 px-1.5 py-0.5 rounded-full">
                {L('직접 추가', 'Added')}
              </span>
            )}
          </div>
          {/* Secondary line — role · expertise · growth cue. Single row,
              tertiary tone so it reads as supporting metadata. */}
          {(roleText
            || ((w.agent_type || 'ai') === 'ai' && w.persona?.expertise)
            || ((w.agent_type || 'ai') === 'ai' && w.agent_id)
          ) && (
            <div className="flex items-center gap-x-1.5 text-[11px] text-[var(--text-tertiary)] mt-0.5 leading-snug">
              {roleText && <span className="truncate">{roleText}</span>}
              {(w.agent_type || 'ai') === 'ai' && w.persona?.expertise && roleText && (
                <span className="text-[var(--text-tertiary)]/60">·</span>
              )}
              {(w.agent_type || 'ai') === 'ai' && w.persona?.expertise && (
                <span className="truncate">{w.persona.expertise}</span>
              )}
              {(w.agent_type || 'ai') === 'ai' && w.agent_id && (() => {
                const stats = getAgentStats(w.agent_id);
                if (!stats) return null;
                const together = stats.totalTasks + stats.totalSyntheses;
                return (
                  <span className="shrink-0 ml-auto inline-flex items-center gap-1 tabular-nums">
                    <span className="text-[var(--accent)]/75 font-medium">Lv.{stats.agent.level}</span>
                    {together > 0
                      ? <span>· {together}{L('회', '×')}</span>
                      : <span className="text-[var(--accent)]/60">· {L('처음', 'first')}</span>}
                    {stats.observationCount >= 3 && (
                      <span className="inline-flex items-center gap-0.5 text-[var(--accent)]/70">
                        <Brain size={9} className="inline" />{stats.observationCount}
                      </span>
                    )}
                  </span>
                );
              })()}
            </div>
          )}
          {/* Why-this-agent — one quiet line surfacing the router's rationale
              (or "직접 지정" after a manual swap). The richest part of the
              engine, finally shown to the captain. AI workers only. */}
          {isAI && w.assignment_reason && (
            <div className="flex items-start gap-1 text-[11px] text-[var(--text-tertiary)] mt-1 leading-snug">
              <Compass size={10} className="shrink-0 mt-[2px] text-[var(--accent)]/55" />
              <span className="min-w-0">{w.assignment_reason}</span>
            </div>
          )}
          {/* Scope preview — neutral tone, no color pills */}
          {(w.ai_scope || w.self_scope) && (
            <div className="mt-1.5 space-y-0.5 text-[11px] leading-[1.55]">
              {w.ai_scope && (
                <div className="flex gap-1.5">
                  <span className="text-[var(--text-tertiary)] font-medium shrink-0 min-w-[1.5rem]">AI</span>
                  <span className="text-[var(--text-secondary)]">{w.ai_scope}</span>
                </div>
              )}
              {w.self_scope && (
                <div className="flex gap-1.5">
                  <span className="text-[var(--accent)] font-medium shrink-0 min-w-[1.5rem]">{L('나', 'Me')}</span>
                  <span className="text-[var(--text-secondary)]">{w.self_scope}</span>
                </div>
              )}
            </div>
          )}
          {/* Human worker: contact input */}
          {w.agent_type === 'human' && onUpdateWorker && (
            <div className="flex items-center gap-2 mt-2">
              <select
                value={w.contact?.channel || 'email'}
                onChange={(e) => onUpdateWorker(w.id, { contact: { channel: e.target.value as 'email' | 'slack', name: w.contact?.name || '', address: w.contact?.address || '' } })}
                className="text-[11px] px-2 py-1 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface)] cursor-pointer"
                onClick={(e) => e.stopPropagation()}>
                <option value="email">Email</option>
                <option value="slack">Slack</option>
              </select>
              <input
                type="text"
                value={w.contact?.address || ''}
                onChange={(e) => onUpdateWorker(w.id, { contact: { channel: w.contact?.channel || 'email', name: w.contact?.name || '', address: e.target.value } })}
                placeholder={w.contact?.channel === 'slack' ? 'Slack User ID' : 'email@example.com'}
                className="flex-1 text-[11px] px-2.5 py-1 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:border-[var(--accent)]/30"
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          )}
        </div>
        {/* Row controls — swap (AI only) + remove. Only in "Adjust team" mode, so
            they are always-visible (not hover-gated — that failed on touch and hid
            the affordance) and sized for Fitt's Law (36px). Swap lets the captain
            override the auto-cast even on a sole-member task (where remove is blocked). */}
        {adjusting && (canReplace || canRemove) && (
          <div className="shrink-0 mt-0.5 flex items-center gap-1">
            {canReplace && (
              <button
                onClick={() => onReplaceWorker!(w.id)}
                className="w-9 h-9 rounded-full flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--accent)] hover:bg-[var(--accent)]/[0.08] transition-colors cursor-pointer"
                aria-label={L('이 팀원 교체', 'Replace this member')}
                title={L('이 팀원 교체', 'Replace this member')}
              >
                <Repeat size={15} />
              </button>
            )}
            {canRemove && (
              <button
                onClick={() => onRemoveWorker!(w.id)}
                className="w-9 h-9 rounded-full flex items-center justify-center text-[var(--text-secondary)] hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors cursor-pointer"
                aria-label={L('이 팀원 빼기', 'Remove this member')}
                title={L('이 팀원 빼기', 'Remove this member')}
              >
                <XIcon size={15} />
              </button>
            )}
          </div>
        )}
      </motion.div>
    );
  };

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: EASE }}
      className="rounded-2xl bg-[var(--surface)] border border-[var(--border-subtle)] p-5 md:p-6">

      {/* Header — quiet eyebrow + count. The hint line is intentionally
          terse; the row CTAs ("+ 다른 시각" / "+ 새 팀원") communicate
          the actions themselves. */}
      <div className="flex items-start justify-between mb-4 gap-3">
        <div className="min-w-0">
          <div className="text-[10px] font-bold text-[var(--accent)] uppercase tracking-[0.14em] mb-1">
            {L('투입할 팀', 'Your team')}
          </div>
          <p className="text-[14px] text-[var(--text-secondary)]">
            {L(`${total}명이 분석할 준비가 됐어요`, `${total} teammates ready to work`)}
          </p>
          <p className="text-[12px] text-[var(--text-tertiary)] mt-1 leading-relaxed">
            {adjusting
              ? L('맡을 사람을 바꾸거나, 빼거나, 더할 수 있어요.', 'Swap, remove, or add who handles what.')
              : L('그대로 시작해도 되고, 손보고 시작해도 돼요.', 'Start as-is, or adjust the team first.')}
          </p>
        </div>
        {canAdjust && (
          <button
            type="button"
            onClick={() => setAdjusting((v) => !v)}
            aria-pressed={adjusting}
            className={`shrink-0 inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium border transition-colors cursor-pointer ${
              adjusting
                ? 'border-[var(--accent)]/40 text-[var(--accent)] bg-[var(--accent)]/[0.06]'
                : 'border-[var(--border-subtle)] text-[var(--text-secondary)] hover:border-[var(--text-secondary)]/40 hover:bg-[var(--bg)]'
            }`}
          >
            <SlidersHorizontal size={12} />
            {adjusting ? L('완료', 'Done') : L('팀 손보기', 'Adjust team')}
          </button>
        )}
      </div>

      {/* Groups — each task gets its own block with members + add button */}
      <div className="space-y-3">
        {groups.map((g, gi) => {
          const groupSize = g.members.length;
          const seedTrack = (g.seed.agent_type || 'ai') as 'ai' | 'self' | 'human';
          // Adding extra "lenses" only makes sense on an AI task.
          const canAdd = !!onOpenPool && groupSize < MAX_PERSONAS_PER_GROUP && seedTrack === 'ai';
          // Leaving the AI track is blocked while multiple lenses share the task
          // (one task can't route to several people).
          const canLeaveAI = groupSize <= 1;
          const baseIndex = gi * 3; // approximate stagger across groups
          // Origin signals — drive the group's visual accent + heading badge.
          const hasManual = g.members.some(m => m.added_manually);
          const taskEdited = !!g.seed.original_task && g.seed.task !== g.seed.original_task;
          const userTouched = hasManual || taskEdited;
          return (
            <motion.div
              key={g.groupId}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: gi * staggerDelay, duration: 0.35, ease: EASE }}
              className={`rounded-xl border px-4 py-3.5 transition-colors ${
                userTouched
                  ? 'border-[var(--accent)]/30 bg-[var(--accent)]/[0.025]'
                  : 'border-[var(--border-subtle)]/70 bg-[var(--bg)]/40'
              }`}
            >
              {/* Task heading + add button */}
              <div className="flex items-start justify-between gap-3 mb-2.5">
                <div className="flex-1 min-w-0">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--text-tertiary)] mb-1 flex items-center gap-1.5 flex-wrap">
                    <span>{L(`Task ${gi + 1}`, `Task ${gi + 1}`)}</span>
                    {groupSize > 1 && (
                      <span className="text-[var(--accent)] normal-case tracking-normal">
                        · {groupSize}{L('명', groupSize > 1 ? ' members' : ' member')}
                      </span>
                    )}
                    {taskEdited && (
                      <span className="inline-flex items-center gap-0.5 text-[var(--accent)] normal-case tracking-normal font-medium">
                        <Pencil size={9} />
                        {L('수정됨', 'edited')}
                      </span>
                    )}
                  </div>
                  {editingGroupId === g.groupId && onUpdateTask ? (
                    // Inline edit mode — saves on blur or Enter, discards on Escape.
                    <textarea
                      autoFocus
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      onBlur={() => {
                        const next = editText.trim();
                        if (next && next !== g.seed.task) {
                          onUpdateTask(g.groupId, next);
                        }
                        setEditingGroupId(null);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          (e.target as HTMLTextAreaElement).blur();
                        } else if (e.key === 'Escape') {
                          setEditingGroupId(null);
                        }
                      }}
                      maxLength={280}
                      rows={2}
                      className="w-full text-[13px] text-[var(--text-primary)] leading-snug bg-[var(--surface)] border border-[var(--accent)]/40 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-[var(--accent)] resize-none"
                    />
                  ) : (
                    <p
                      onClick={() => {
                        if (!adjusting || !onUpdateTask) return;
                        setEditingGroupId(g.groupId);
                        setEditText(g.seed.task);
                      }}
                      className={`text-[13px] text-[var(--text-primary)] leading-snug line-clamp-2 ${adjusting && onUpdateTask ? 'cursor-text hover:bg-[var(--bg)]/50 -mx-1 px-1 rounded transition-colors' : ''}`}
                      title={adjusting && onUpdateTask ? L('클릭해서 수정', 'Click to edit') : undefined}
                    >
                      {g.seed.task}
                    </p>
                  )}
                </div>
                {adjusting && onOpenPool && (
                  <button
                    onClick={() => canAdd && onOpenPool(g.groupId)}
                    disabled={!canAdd}
                    className={`shrink-0 inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition-all ${
                      canAdd
                        ? 'text-[var(--accent)] bg-[var(--accent)]/[0.06] hover:bg-[var(--accent)]/[0.12] border border-[var(--accent)]/25 cursor-pointer'
                        : 'text-[var(--text-tertiary)] bg-[var(--bg)] border border-[var(--border-subtle)] cursor-not-allowed opacity-60'
                    }`}
                    title={canAdd
                      ? L('이 task에 다른 시각 추가', 'Add another perspective to this task')
                      : L('최대 5명까지 추가할 수 있어요', 'Up to 5 personas per task')}
                  >
                    <Plus size={11} />
                    {canAdd ? L('다른 시각', 'Another lens') : L('가득', 'Full')}
                  </button>
                )}
              </div>
              {/* Members */}
              <div className="divide-y divide-[var(--border-subtle)]/40 border-t border-[var(--border-subtle)]/40 pt-1">
                {g.members.map((w, mi) => renderRow(w, baseIndex + mi, groupSize))}
              </div>

              {/* Track control — who handles this task. Surfaces the human
                  collaboration tracks (내가 직접 / 사람에게) that were otherwise
                  fixed by the planner. AI is the default; switching to a person
                  reveals the contact / self-input flow downstream. */}
              {adjusting && onSetGroupTrack && (() => {
                const opts: { key: 'ai' | 'self' | 'human'; label: string; icon: typeof Sparkles }[] = [
                  { key: 'ai', label: L('AI 팀원', 'AI teammate'), icon: Sparkles },
                  { key: 'self', label: L('내가 직접', 'I decide'), icon: Brain },
                  { key: 'human', label: L('사람에게', 'Ask a person'), icon: UserCheck },
                ];
                return (
                  <div className="mt-3 pt-2.5 border-t border-[var(--border-subtle)]/40 flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] text-[var(--text-tertiary)] shrink-0">{L('누가 맡을까요?', 'Who handles this?')}</span>
                    <div className="inline-flex rounded-lg border border-[var(--border-subtle)] overflow-hidden">
                      {opts.map(o => {
                        const active = seedTrack === o.key;
                        // Leaving AI is blocked when multiple lenses share the task.
                        const blocked = seedTrack === 'ai' && o.key !== 'ai' && !canLeaveAI;
                        const Icon = o.icon;
                        return (
                          <button
                            key={o.key}
                            onClick={() => { if (!active && !blocked) onSetGroupTrack(g.groupId, o.key); }}
                            disabled={active || blocked}
                            title={blocked ? L('여러 명일 땐 한 명만 남기고 바꿔주세요', 'Reduce to one member first') : undefined}
                            className={`inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium transition-colors ${
                              active
                                ? 'bg-[var(--accent)]/[0.12] text-[var(--accent)] cursor-default'
                                : blocked
                                  ? 'text-[var(--text-tertiary)] opacity-50 cursor-not-allowed'
                                  : 'text-[var(--text-secondary)] hover:bg-[var(--bg)] cursor-pointer'
                            }`}
                          >
                            <Icon size={11} /> {o.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}
            </motion.div>
          );
        })}
      </div>

      {/* Free-mode "+ 새 팀원 추가" — agent-centric. The pool modal computes
          the best-matching task per persona and adds them directly. */}
      {adjusting && onOpenFreePool && (() => {
        const everyGroupFull = groups.length > 0 && groups.every(g => g.members.length >= MAX_PERSONAS_PER_GROUP);
        return (
          <button
            onClick={() => !everyGroupFull && onOpenFreePool()}
            disabled={everyGroupFull}
            className={`mt-3 w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-[12px] font-medium border-dashed transition-all ${
              everyGroupFull
                ? 'border border-[var(--border-subtle)] text-[var(--text-tertiary)] cursor-not-allowed opacity-60'
                : 'border border-[var(--accent)]/25 text-[var(--accent)] hover:bg-[var(--accent)]/[0.04] hover:border-[var(--accent)]/45 cursor-pointer'
            }`}
            title={everyGroupFull
              ? L('모든 task가 5명으로 가득 찼어요', 'Every task is at 5 personas')
              : L('어울리는 task에 자동으로 배정됩니다', 'Automatically matched to the best-fitting task')}
          >
            <Plus size={12} />
            {L('새 팀원 추가', 'Add a team member')}
            <span className="text-[10px] text-[var(--text-tertiary)] font-normal">
              {everyGroupFull ? '' : L(' · 어울리는 task에 자동 배정', ' · auto-match to a task')}
            </span>
          </button>
        );
      })()}

      {/* Start button — primary CTA. Starts the team working (was "출항"; the
          set-sail wording is reserved for nautical companion features now). */}
      <motion.button onClick={onDeploy} whileTap={{ scale: 0.98 }}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 + groups.length * staggerDelay, duration: 0.4, ease: EASE }}
        className="mt-5 w-full flex items-center justify-center gap-2 px-5 py-3.5 text-[var(--accent-fg)] rounded-xl text-[14px] font-semibold cursor-pointer shadow-[var(--shadow-sm)] hover:shadow-[var(--shadow-lg)] transition-shadow"
        style={{ background: 'var(--gradient-gold)' }}>
        {L('팀 투입', 'Start')} <ChevronRight size={14} />
      </motion.button>
    </motion.div>
  );
}
