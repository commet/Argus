'use client';

/**
 * PersonaPoolModal — overlay for picking a persona to add to the team.
 *
 * Two modes:
 *   • mode='task'  — user clicked "+ 다른 시각 추가" on a specific task.
 *                    Modal header shows the task. All personas, when picked,
 *                    are added to that target group.
 *   • mode='free'  — user clicked "+ 새 팀원 추가" with no specific task in
 *                    mind. Modal computes the best-matching task per persona
 *                    (heuristic) and shows the preview "→ goes to: <task>"
 *                    on each card. Picking a persona adds it to its matched
 *                    group automatically — no separate task assignment step.
 *
 * The merged persona pool comes from getPersonaPool() (built-in + custom).
 * Personas already in a group (task-mode) or in *every* available group with
 * room (free-mode) are disabled.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X as XIcon, Search, Sparkles, Check, ArrowRight, Brain } from 'lucide-react';
import { useLocale } from '@/hooks/useLocale';
import { getPersonaPool } from '@/lib/worker-personas';
import { useAgentStore } from '@/stores/useAgentStore';
import { agentToWorkerPersona } from '@/lib/agent-adapters';
import { getAgentStats } from '@/lib/agent-stats';
import type { Agent } from '@/stores/agent-types';
import type { WorkerPersona } from '@/stores/types';
import { EASE } from './shared/constants';
import { WorkerAvatar } from './WorkerAvatar';

export interface PoolModalGroupInfo {
  groupId: string;
  task: string;
  aiScope?: string | null;
  expectedOutput?: string | null;
  memberCount: number;
  /** Personas already in this group — used to prevent duplicates per group. */
  personaIds: string[];
}

/** Info for mode='replace' — swap one worker's persona for another. */
export interface PoolModalReplaceInfo {
  task: string;
  aiScope?: string | null;
  expectedOutput?: string | null;
  /** The persona currently in this worker — shown as "현재 담당", not pickable. */
  currentPersonaId?: string;
  /** Personas held by OTHER members of the same task group — shown as
   *  "이미 추가됨" so a swap can't create a duplicate within the group. */
  siblingPersonaIds?: string[];
}

// Sentinel matchedGroupId for replace-mode picks (no group is targeted —
// the parent closes over the worker id and calls replaceWorkerPersona).
const REPLACE_SENTINEL = '__replace__';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  mode: 'task' | 'free' | 'replace';
  /** Required for mode='task'. Identifies which group the modal targets. */
  targetGroupId?: string;
  /** Required for mode='replace'. The worker being swapped. */
  replaceInfo?: PoolModalReplaceInfo;
  /** All current task groups (used for matching in free-mode and as the
   *  source of truth for the target group's task text in task-mode). */
  groups: PoolModalGroupInfo[];
  /** Maximum personas allowed per group. */
  maxPerGroup: number;
  /** In task/free mode, matchedGroupId is the group the persona lands in.
   *  In replace mode it is REPLACE_SENTINEL — the parent ignores it. */
  onSelect: (persona: WorkerPersona, matchedGroupId: string) => void;
}

// Heuristic relevance score — text-overlap between persona role/expertise/tone
// and a task description. Used both to rank personas (task-mode) and to pick
// the best-matching group per persona (free-mode).
function scorePersonaForTask(persona: WorkerPersona, taskText: string, scopeText: string): number {
  const haystack = `${persona.role} ${persona.expertise} ${persona.tone}`.toLowerCase();
  const tokens = [
    ...taskText.toLowerCase().split(/[\s,.\-·:;()\[\]!?]+/),
    ...scopeText.toLowerCase().split(/[\s,.\-·:;()\[\]!?]+/),
  ].filter(t => t.length >= 2);
  if (tokens.length === 0) return 0;
  let hits = 0;
  for (const t of tokens) {
    if (haystack.includes(t)) hits += 1;
  }
  return hits;
}

interface PersonaPlacement {
  persona: WorkerPersona;
  /** When the persona is one of the unlocked Agents, this exposes growth
   *  data (xp/level/observations) for stat cues. Custom worker personas
   *  outside the agent system have agent=null. */
  agent: Agent | null;
  /** Which group this persona will land in if picked. null when no group has
   *  room or the persona is already in every available group. */
  matchedGroupId: string | null;
  matchedTask: string | null;
  /** Used to disable the row with the right reason. */
  reason: 'addable' | 'already-in' | 'all-full';
  score: number;
}

interface PersonaSource {
  persona: WorkerPersona;
  agent: Agent | null;
}

function computePlacements(
  sources: PersonaSource[],
  groups: PoolModalGroupInfo[],
  maxPerGroup: number,
  mode: 'task' | 'free' | 'replace',
  targetGroupId: string | undefined,
  replaceInfo: PoolModalReplaceInfo | undefined,
): PersonaPlacement[] {
  if (mode === 'replace') {
    if (!replaceInfo) return [];
    // Pickable = anyone except the current persona or a persona already held
    // by another member of the same group (would duplicate). No room logic —
    // we're swapping a single slot, not adding to a group.
    const siblings = new Set(replaceInfo.siblingPersonaIds || []);
    return sources.map(s => {
      const isCurrent = !!replaceInfo.currentPersonaId && s.persona.id === replaceInfo.currentPersonaId;
      const isSibling = siblings.has(s.persona.id);
      const blocked = isCurrent || isSibling;
      const score = scorePersonaForTask(s.persona, replaceInfo.task, `${replaceInfo.aiScope || ''} ${replaceInfo.expectedOutput || ''}`);
      return {
        persona: s.persona,
        agent: s.agent,
        matchedGroupId: blocked ? null : REPLACE_SENTINEL,
        matchedTask: replaceInfo.task,
        reason: blocked ? 'already-in' : 'addable',
        score,
      };
    });
  }
  if (mode === 'task') {
    const target = groups.find(g => g.groupId === targetGroupId);
    if (!target) return [];
    const targetFull = target.memberCount >= maxPerGroup;
    return sources.map(s => {
      const inGroup = target.personaIds.includes(s.persona.id);
      const score = scorePersonaForTask(s.persona, target.task, `${target.aiScope || ''} ${target.expectedOutput || ''}`);
      return {
        persona: s.persona,
        agent: s.agent,
        matchedGroupId: inGroup || targetFull ? null : target.groupId,
        matchedTask: target.task,
        reason: inGroup ? 'already-in' : targetFull ? 'all-full' : 'addable',
        score,
      };
    });
  }
  // free mode — find best-matching group per persona that has room and
  // doesn't already contain them.
  return sources.map(s => {
    let best: { groupId: string; task: string; score: number } | null = null;
    let anyAddable = false;
    for (const g of groups) {
      if (g.memberCount >= maxPerGroup) continue;
      if (g.personaIds.includes(s.persona.id)) continue;
      anyAddable = true;
      const score = scorePersonaForTask(s.persona, g.task, `${g.aiScope || ''} ${g.expectedOutput || ''}`);
      if (!best || score > best.score) {
        best = { groupId: g.groupId, task: g.task, score };
      }
    }
    if (!best) {
      // Either every group is full, or the persona is already in every
      // group with room. Distinguish for tooltip clarity.
      const inAll = groups.every(g => g.personaIds.includes(s.persona.id));
      return {
        persona: s.persona,
        agent: s.agent,
        matchedGroupId: null,
        matchedTask: null,
        reason: inAll && !anyAddable ? 'already-in' : 'all-full',
        score: 0,
      };
    }
    return {
      persona: s.persona,
      agent: s.agent,
      matchedGroupId: best.groupId,
      matchedTask: best.task,
      reason: 'addable',
      score: best.score,
    };
  });
}

export function PersonaPoolModal({
  isOpen, onClose, mode, targetGroupId, replaceInfo, groups, maxPerGroup, onSelect,
}: Props) {
  const locale = useLocale();
  const L = (ko: string, en: string) => locale === 'ko' ? ko : en;
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Reset search whenever the modal opens — feels fresh per session.
  useEffect(() => {
    if (isOpen) setQuery('');
  }, [isOpen]);

  // ESC closes
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  // Lock body scroll while open
  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [isOpen]);

  // Build the unified pool: unlocked Agents (rich growth data) merged with
  // any custom WorkerPersonas that don't already exist as agents. Agents
  // win on id collision so growth cues stay attached.
  const personaSources = useMemo<PersonaSource[]>(() => {
    const unlocked = useAgentStore.getState().getUnlockedAgents();
    const fromAgents: PersonaSource[] = unlocked.map(a => ({
      persona: agentToWorkerPersona(a),
      agent: a,
    }));
    const agentIds = new Set(unlocked.map(a => a.id));
    const customPool = getPersonaPool(locale).filter(p => !agentIds.has(p.id));
    const fromCustom: PersonaSource[] = customPool.map(p => ({ persona: p, agent: null }));
    return [...fromAgents, ...fromCustom];
  }, [locale, isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  const placements = useMemo(
    () => computePlacements(personaSources, groups, maxPerGroup, mode, targetGroupId, replaceInfo),
    [personaSources, groups, maxPerGroup, mode, targetGroupId, replaceInfo],
  );

  // Detect global "no room anywhere" so we can show a top-of-modal banner
  // explaining why nothing can be added.
  const allGroupsFull = mode === 'free' && groups.length > 0 && groups.every(g => g.memberCount >= maxPerGroup);
  const targetGroup = mode === 'task' ? groups.find(g => g.groupId === targetGroupId) ?? null : null;
  const targetGroupFull = !!targetGroup && targetGroup.memberCount >= maxPerGroup;

  const { recommended, others, filtered } = useMemo(() => {
    // Filter by query (matches name / role / expertise)
    const q = query.trim().toLowerCase();
    const matchesQuery = (p: PersonaPlacement) => {
      if (!q) return true;
      return (
        p.persona.name.toLowerCase().includes(q) ||
        p.persona.role.toLowerCase().includes(q) ||
        p.persona.expertise.toLowerCase().includes(q)
      );
    };
    const matched = placements.filter(matchesQuery);

    // When searching, present a single ranked list (no recommended split).
    if (q) {
      // Order: addable > already-in > all-full, ties by score desc.
      const order: Record<PersonaPlacement['reason'], number> = {
        'addable': 0, 'already-in': 1, 'all-full': 2,
      };
      const sorted = matched.slice().sort((a, b) => {
        if (order[a.reason] !== order[b.reason]) return order[a.reason] - order[b.reason];
        return b.score - a.score;
      });
      return { recommended: [], others: [], filtered: sorted };
    }

    // Default: rank addables by score, separate the top scorers as "recommended".
    const addables = matched.filter(p => p.reason === 'addable');
    addables.sort((a, b) => b.score - a.score);

    const rec = addables.filter(p => p.score > 0).slice(0, 4);
    const recIds = new Set(rec.map(p => p.persona.id));
    const restAddable = addables.filter(p => !recIds.has(p.persona.id));
    const nonAddable = matched.filter(p => p.reason !== 'addable');
    return { recommended: rec, others: [...restAddable, ...nonAddable], filtered: [] };
  }, [placements, query]);

  const handlePick = (p: PersonaPlacement) => {
    if (p.reason !== 'addable' || !p.matchedGroupId) return;
    onSelect(p.persona, p.matchedGroupId);
  };

  const renderCard = (p: PersonaPlacement) => {
    const disabled = p.reason !== 'addable';
    const reasonLabel =
      p.reason === 'already-in'
        ? (mode === 'replace' && replaceInfo?.currentPersonaId === p.persona.id
            ? L('현재 담당', 'Current')
            : L('이미 추가됨', 'Already in'))
      : p.reason === 'all-full' ? L('빈 자리 없음', 'No room')
      : null;
    // Pull live growth stats only when this persona is a real Agent.
    // Custom personas just don't get the cue line.
    const stats = p.agent ? getAgentStats(p.agent.id) : null;
    const together = stats ? stats.totalTasks + stats.totalSyntheses : 0;
    const familiarityLabel = stats
      ? (together === 0
          ? L('처음 모시는 분', 'First time')
          : stats.familiarity === 'few'
            ? L(`${together}번 함께`, `${together}× together`)
            : stats.familiarity === 'familiar'
              ? L(`${together}번 함께 · 익숙한 동료`, `${together}× together · familiar`)
              : L(`${together}번 함께 · 오랜 동료`, `${together}× together · long-time partner`))
      : null;
    return (
      <button
        key={p.persona.id}
        onClick={() => handlePick(p)}
        disabled={disabled}
        className={`w-full text-left flex items-start gap-3 px-3 py-3 rounded-xl border transition-all ${
          disabled
            ? 'border-[var(--border-subtle)] bg-[var(--surface)] cursor-not-allowed opacity-55'
            : 'border-[var(--border-subtle)] bg-[var(--surface)] hover:border-[var(--accent)]/40 hover:shadow-[var(--shadow-sm)] cursor-pointer'
        }`}
      >
        <WorkerAvatar persona={p.persona} size="md" />
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-1.5 flex-wrap">
            <span className="text-[14px] font-semibold text-[var(--text-primary)]">{p.persona.name}</span>
            <span className="text-[12.5px] text-[var(--text-tertiary)]">{p.persona.role}</span>
            {stats && (
              <span className="text-[12px] font-medium text-[var(--accent)]/80 tabular-nums">
                Lv.{stats.agent.level}
              </span>
            )}
          </div>
          <p className="text-[12px] text-[var(--text-secondary)] line-clamp-2 mt-0.5 leading-[1.5]">
            {p.persona.expertise}
          </p>
          {/* Growth cue — together count + observation badge. Tertiary tone
              so it doesn't compete with the primary task-match preview. */}
          {familiarityLabel && (
            <div className="mt-1 flex items-center gap-1.5 text-[12px] text-[var(--text-tertiary)]">
              <span>{familiarityLabel}</span>
              {stats && stats.observationCount >= 3 && (
                <span className="inline-flex items-center gap-0.5 text-[var(--accent)]/70">
                  <Brain size={9} /> {stats.observationCount}
                </span>
              )}
            </div>
          )}
          {/* Free-mode preview: which task this persona will land in */}
          {mode === 'free' && p.matchedTask && p.reason === 'addable' && (
            <div className="mt-1.5 flex items-center gap-1 text-[12.5px] text-[var(--accent)] line-clamp-1">
              <ArrowRight size={10} className="shrink-0" />
              <span className="truncate">
                <span className="text-[var(--text-tertiary)]">{L('이 작업에 추가:', 'Goes to:')}</span> {p.matchedTask}
              </span>
            </div>
          )}
        </div>
        {reasonLabel && (
          <span className="shrink-0 inline-flex items-center gap-1 text-[12px] font-medium text-[var(--text-tertiary)] mt-1">
            {p.reason === 'already-in' && <Check size={11} />}
            {reasonLabel}
          </span>
        )}
      </button>
    );
  };

  // Header content varies by mode
  const headerEyebrow = mode === 'task'
    ? L('이 작업에 추가할 팀원', 'Add to this task')
    : mode === 'replace'
      ? L('이 팀원과 교체', 'Replace this member')
      : L('새 팀원 추가', 'Add a team member');
  const headerTitle = mode === 'task'
    ? (targetGroup?.task || L('작업', 'task'))
    : mode === 'replace'
      ? (replaceInfo?.task || L('작업', 'task'))
      : L('어떤 분을 모실지 골라주세요. 어울리는 작업에 자동으로 배정돼요.', "Pick someone — we'll match them to the most fitting task automatically.");
  const headerSub = mode === 'task'
    ? targetGroup?.aiScope || null
    : mode === 'replace'
      ? replaceInfo?.aiScope || null
      : null;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[60] bg-black/45"
            onClick={onClose}
            aria-hidden
          />
          {/* Dialog */}
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={mode === 'replace' ? L('팀원 교체', 'Replace member') : L('팀원 추가', 'Add a team member')}
            initial={{ opacity: 0, y: 24, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            transition={{ duration: 0.28, ease: EASE }}
            className="fixed inset-0 z-[61] flex items-center justify-center p-3 md:p-6 pointer-events-none"
          >
            <div className="pointer-events-auto w-full max-w-xl max-h-[85dvh] flex flex-col rounded-2xl bg-[var(--surface)] border border-[var(--border-subtle)] shadow-[var(--shadow-xl)] overflow-hidden">
              {/* Header */}
              <div className="px-5 py-4 border-b border-[var(--border-subtle)] flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="text-[12px] font-bold uppercase tracking-[0.18em] text-[var(--accent)] mb-1">
                    {headerEyebrow}
                  </div>
                  <p className={`${mode === 'task' ? 'text-[14px] font-medium text-[var(--text-primary)] line-clamp-2' : 'text-[13px] text-[var(--text-secondary)]'} leading-snug`}>
                    {headerTitle}
                  </p>
                  {headerSub && (
                    <p className="text-[12.5px] text-[var(--text-tertiary)] mt-1 line-clamp-1">
                      {headerSub}
                    </p>
                  )}
                </div>
                <button
                  onClick={onClose}
                  className="shrink-0 p-2 rounded-lg hover:bg-[var(--bg)] transition-colors cursor-pointer min-w-[44px] min-h-[44px] flex items-center justify-center"
                  aria-label={L('닫기', 'Close')}
                >
                  <XIcon size={16} className="text-[var(--text-tertiary)]" />
                </button>
              </div>

              {/* Search */}
              <div className="px-5 pt-4 pb-3 border-b border-[var(--border-subtle)]/60">
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)] pointer-events-none" />
                  <input
                    ref={inputRef}
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder={L('이름 · 역할 · 전문 분야로 검색', 'Search name, role, or expertise')}
                    className="w-full pl-9 pr-3 py-2 rounded-xl text-[13px] bg-[var(--bg)] border border-[var(--border-subtle)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:border-[var(--accent)]/40"
                  />
                </div>
                {targetGroupFull && mode === 'task' && (
                  <p className="text-[12.5px] text-amber-700 dark:text-amber-300 mt-2 leading-snug">
                    {L('한 작업에 최대 5명까지 추가할 수 있어요. 일부를 빼고 다시 추가하세요.', 'Up to 5 per task. Remove one to add another.')}
                  </p>
                )}
                {allGroupsFull && (
                  <p className="text-[12.5px] text-amber-700 dark:text-amber-300 mt-2 leading-snug">
                    {L('모든 작업에 5명이 다 찼어요. 어딘가에서 한 명 빼고 다시 시도하세요.', 'Every task is full. Remove one somewhere first.')}
                  </p>
                )}
              </div>

              {/* List */}
              <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
                {/* Search mode: flat list */}
                {query.trim() && (
                  <>
                    {filtered.length === 0 ? (
                      <p className="text-center text-[12px] text-[var(--text-tertiary)] py-8">
                        {L('일치하는 페르소나가 없어요', 'No personas match')}
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {filtered.map(renderCard)}
                      </div>
                    )}
                  </>
                )}
                {/* Default mode: recommended + others */}
                {!query.trim() && (
                  <>
                    {recommended.length > 0 && (
                      <div>
                        <div className="flex items-center gap-1.5 px-2 mb-2">
                          <Sparkles size={11} className="text-[var(--accent)]" />
                          <span className="text-[12px] font-bold uppercase tracking-[0.16em] text-[var(--accent)]">
                            {mode === 'task' || mode === 'replace'
                              ? L('이 작업에 잘 맞는 팀원', 'Recommended for this task')
                              : L('지금 팀에 잘 어울릴 팀원', 'Recommended for your team')}
                          </span>
                        </div>
                        <div className="space-y-2">
                          {recommended.map(renderCard)}
                        </div>
                      </div>
                    )}
                    {others.length > 0 && (
                      <div>
                        <div className="px-2 mb-2 mt-1">
                          <span className="text-[12px] font-bold uppercase tracking-[0.16em] text-[var(--text-tertiary)]">
                            {recommended.length > 0 ? L('전체 풀', 'All personas') : L('팀원 풀', 'Persona pool')}
                          </span>
                        </div>
                        <div className="space-y-2">
                          {others.map(renderCard)}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
