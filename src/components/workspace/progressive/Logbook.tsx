'use client';

/**
 * Logbook — 항해일지. The live ship's-log rail and the hub for branch control.
 *
 * Reads the active branch's narrated waypoints as a vertical dashed course-line
 * (the decision *narrative* — turns, not steps), and exposes the interactive
 * branch verbs:
 *   - switch  — branch chips (when more than one course-line exists)
 *   - fork    — "이 길 가보기" on a course-change's road-not-taken
 *   - anchor  — "이 항로로 확정" once you've explored alternatives
 *   - 전체 해도 — opens the spatial VoyageChart in a modal (the exploration view)
 *
 * Branch membership is derived (not stored) via the shared `getActivePath`.
 * Branch mutations are blocked while the engine is mid-stream (working phase) to
 * avoid forking/switching out from under a running analysis.
 */

import { useEffect, useMemo, useState } from 'react';
import {
  Sailboat, Milestone, AlertTriangle, Eye, Wind, Anchor, ChevronDown, ChevronUp,
  Map as MapIcon, Flag, GitBranch, Compass, X, Hand,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useProgressiveStore } from '@/stores/useProgressiveStore';
import { useLocale } from '@/hooks/useLocale';
import { getActivePath } from '@/lib/version-tree';
import { Modal } from '@/components/ui/Modal';
import { VoyageChart } from '@/components/workspace/progressive/VoyageChart';
import type { WaypointType } from '@/stores/types';

const WP_META: Record<WaypointType, { Icon: LucideIcon; color: string; ko: string; en: string }> = {
  departure:     { Icon: Sailboat,      color: 'var(--text-secondary)', ko: '출항',      en: 'Departure' },
  course_change: { Icon: Milestone,     color: 'var(--accent)',         ko: '침로 변경',  en: 'Course change' },
  reef:          { Icon: AlertTriangle, color: '#b4541e',               ko: '암초',      en: 'Reef' },
  sighting:      { Icon: Eye,           color: '#2d6b8a',               ko: '관측',      en: 'Sighting' },
  headwind:      { Icon: Wind,          color: '#6b4c9a',               ko: '역풍',      en: 'Headwind' },
  helm:          { Icon: Hand,          color: '#8a6d2d',               ko: '선장의 키',  en: 'Helm' },
  anchorage:     { Icon: Anchor,        color: '#2d6b2d',               ko: '정박',      en: 'Anchorage' },
};

export function Logbook() {
  const locale = useLocale();
  const L = (ko: string, en: string) => (locale === 'ko' ? ko : en);
  const session = useProgressiveStore(s => s.sessions.find(ss => ss.id === s.currentSessionId));
  const switchBranch = useProgressiveStore(s => s.switchBranch);
  const anchorBranch = useProgressiveStore(s => s.anchorBranch);
  const forkBranch = useProgressiveStore(s => s.forkBranch);
  const deleteBranch = useProgressiveStore(s => s.deleteBranch);

  const [openId, setOpenId] = useState<string | null>(null);
  const [chartOpen, setChartOpen] = useState(false);
  // Two-step delete confirm — deleting a course is destructive (the explored
  // path is gone), so the X arms a confirm rather than deleting on first click.
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const { waypoints, branches, activeBranch, parentOf, assumptionsByCp } = useMemo(() => {
    const empty = { waypoints: [], branches: [], activeBranch: null, parentOf: new Map<string, string | null>(), assumptionsByCp: new Map<string, string[]>() };
    if (!session) return empty;
    const branches = session.branches || [];
    const active = branches.find(b => b.id === session.active_branch_id) ?? null;
    const headId = active?.head_checkpoint_id ?? session.active_checkpoint_id ?? null;
    const checkpoints = session.checkpoints || [];
    const path = getActivePath(checkpoints, headId);
    const order = new Map(path.map((c, i) => [c.id, i]));
    const list = (session.waypoints || [])
      .filter(w => order.has(w.checkpoint_id))
      .sort((a, b) => (order.get(a.checkpoint_id)! - order.get(b.checkpoint_id)!));
    const parentOf = new Map(checkpoints.map(c => [c.id, c.parent_id]));
    // Drill-down material: the hidden assumptions captured at each checkpoint.
    const assumptionsByCp = new Map(
      checkpoints.map(c => [c.id, c.state_snapshot?.snapshots?.slice(-1)?.[0]?.hidden_assumptions || []]),
    );
    return { waypoints: list, branches, activeBranch: active, parentOf, assumptionsByCp };
  }, [session]);

  const lastId = waypoints[waypoints.length - 1]?.id ?? null;
  const openEntry = openId !== null ? openId : lastId;
  const toggle = (id: string) => setOpenId(openEntry === id ? '' : id);

  // Hold branch mutations while the engine streams or workers are in flight
  // (shared lock — same rule the chart uses).
  const locked = useProgressiveStore(s => s.isBranchingLocked());

  // Disarm a pending delete-confirm if its target is no longer a deletable,
  // non-active course (switched-to-active / removed) or while branching is
  // locked — otherwise a stale confirm could re-surface armed.
  useEffect(() => {
    if (!confirmDeleteId) return;
    const stillDeletable = branches.some(b => b.id === confirmDeleteId && b.id !== activeBranch?.id);
    if (!stillDeletable || locked) setConfirmDeleteId(null);
  }, [confirmDeleteId, branches, activeBranch?.id, locked]);
  const multiBranch = branches.length > 1;

  // "Take the road not taken" — fork from the checkpoint *before* the turn so
  // the user re-decides at that fork. Falls back to the turn checkpoint itself.
  const takeRoad = (waypointCheckpointId: string, label: string) => {
    if (locked) return;
    const forkPoint = parentOf.get(waypointCheckpointId) ?? waypointCheckpointId;
    forkBranch(forkPoint, label);
    setChartOpen(false);
  };

  // Empty state — the rail can be visible (e.g. workers running) before the
  // first waypoint is logged. Give the log an identity instead of a void so
  // the user knows the decision trail collects here. Only when a voyage exists.
  if (waypoints.length === 0) {
    if (!session) return null;
    return (
      <aside className="px-4 py-4" aria-label={L('항해일지', "Ship's log")}>
        <h3 className="text-[12px] font-bold text-[var(--text-primary)] tracking-tight mb-2.5">
          {L('항해일지', "Ship's log")}
        </h3>
        <div className="rounded-xl border border-dashed border-[var(--border-subtle)] px-3 py-4 space-y-1.5">
          <div className="flex items-center gap-1.5">
            <Compass size={13} className="text-[var(--accent)]/60 shrink-0" />
            <span className="text-[11.5px] font-medium text-[var(--text-secondary)]">
              {L('아직 항해 기록이 없어요', 'No log entries yet')}
            </span>
          </div>
          <p className="text-[10.5px] leading-[1.5] text-[var(--text-tertiary)]">
            {L('분석이 진행되면 결정의 흐름 — 침로를 바꾼 순간들 — 이 여기 차곡차곡 쌓여요.',
               'As the analysis unfolds, your decision trail — the moments you changed course — collects here.')}
          </p>
        </div>
      </aside>
    );
  }

  return (
    <aside className="px-4 py-4" aria-label={L('항해일지', "Ship's log")}>
      {/* Header */}
      <div className="flex items-center justify-between mb-2.5">
        <h3 className="text-[12px] font-bold text-[var(--text-primary)] tracking-tight">
          {L('항해일지', "Ship's log")}
        </h3>
        <button
          onClick={() => setChartOpen(true)}
          className="inline-flex items-center gap-1 py-2.5 min-h-[44px] text-[12px] text-[var(--text-tertiary)] hover:text-[var(--accent)] transition-colors cursor-pointer"
        >
          <MapIcon size={12} /> {L('전체 해도', 'Full chart')}
        </button>
      </div>

      {/* Branch switcher — only once a fork exists */}
      {multiBranch && (
        <div className="mb-3 space-y-1.5">
          <div className="flex flex-wrap gap-1">
            {branches.map(b => {
              const isActive = b.id === activeBranch?.id;
              return (
                <span
                  key={b.id}
                  className={`inline-flex items-center rounded-full text-[12px] font-medium max-w-[150px] transition-all ${
                    isActive
                      ? 'text-white shadow-[var(--shadow-xs)]'
                      : 'text-[var(--text-secondary)] bg-[var(--bg)] border border-[var(--border-subtle)]'
                  }`}
                  style={isActive ? { background: b.color } : undefined}
                >
                  <button
                    onClick={() => !isActive && !locked && switchBranch(b.id)}
                    disabled={locked && !isActive}
                    title={b.name}
                    className={`inline-flex items-center gap-1 pl-2 ${isActive ? 'pr-2' : 'pr-1'} py-2.5 min-h-[44px] min-w-0 cursor-pointer ${locked && !isActive ? 'opacity-40 cursor-not-allowed' : ''} ${isActive ? '' : 'hover:text-[var(--text-primary)]'}`}
                  >
                    {b.status === 'anchored' ? <Flag size={9} className="shrink-0" /> : <GitBranch size={9} className="shrink-0" />}
                    <span className="truncate">{b.name}</span>
                  </button>
                  {!isActive && (
                    confirmDeleteId === b.id ? (
                      <span className="inline-flex items-center gap-2 pr-1.5 pl-1">
                        <button
                          onClick={() => setConfirmDeleteId(null)}
                          aria-label={L('취소', 'Cancel')}
                          className="px-3 min-h-[44px] inline-flex items-center justify-center text-[12px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
                        >
                          {L('취소', 'Cancel')}
                        </button>
                        <button
                          onClick={() => { setConfirmDeleteId(null); if (!locked) deleteBranch(b.id); }}
                          disabled={locked}
                          className={`px-3 min-h-[44px] inline-flex items-center justify-center text-[12px] font-semibold text-[var(--danger)] hover:underline cursor-pointer ${locked ? 'opacity-40 cursor-not-allowed' : ''}`}
                        >
                          {L('삭제', 'Delete')}
                        </button>
                      </span>
                    ) : (
                      <button
                        onClick={() => setConfirmDeleteId(b.id)}
                        disabled={locked}
                        aria-label={L('항로 삭제', 'Delete course')}
                        className={`p-2.5 min-w-[44px] min-h-[44px] flex items-center justify-center text-[var(--text-tertiary)] hover:text-[var(--danger)] cursor-pointer ${locked ? 'opacity-40 cursor-not-allowed' : ''}`}
                      >
                        <X size={14} />
                      </button>
                    )
                  )}
                </span>
              );
            })}
          </div>
          {activeBranch?.status === 'anchored' ? (
            <span className="inline-flex items-center gap-1 text-[10.5px] font-semibold text-[var(--accent)]">
              <Flag size={10} /> {L(`최종 항로 · ${branches.length}개 중 선택`, `Anchored · chosen from ${branches.length}`)}
            </span>
          ) : activeBranch && (
            <button
              onClick={() => !locked && anchorBranch(activeBranch.id)}
              disabled={locked}
              className={`inline-flex items-center justify-center gap-1.5 px-4 min-h-[44px] rounded-lg text-[12px] font-semibold text-[var(--accent)] border border-[var(--accent)]/40 hover:bg-[var(--accent)]/8 cursor-pointer ${locked ? 'opacity-40 cursor-not-allowed' : ''}`}
            >
              <Anchor size={12} /> {L('이 항로로 확정', 'Anchor this course')}
            </button>
          )}
        </div>
      )}

      {/* Waypoints */}
      <ol className="relative">
        {waypoints.map((w, i) => {
          const meta = WP_META[w.type];
          const { Icon } = meta;
          const isOpen = openEntry === w.id;
          const isLast = i === waypoints.length - 1;
          const emphasize = w.type === 'course_change';
          const notTaken = (w.alternatives || []).filter(a => !a.taken);
          const assumptions = assumptionsByCp.get(w.checkpoint_id) || [];

          return (
            <li key={w.id} className="relative pl-7 pb-3 last:pb-0">
              {!isLast && (
                <span
                  className="absolute top-[18px] bottom-0 border-l border-dashed"
                  style={{ left: 8, borderColor: 'var(--accent)', opacity: 0.35 }}
                  aria-hidden
                />
              )}
              <span
                className="absolute left-0 top-[2px] flex items-center justify-center rounded-full"
                style={{
                  width: 17, height: 17,
                  background: 'var(--surface)',
                  boxShadow: emphasize ? `0 0 0 2px ${meta.color}40` : 'none',
                }}
              >
                <Icon size={emphasize ? 14 : 12} style={{ color: meta.color }} strokeWidth={2} />
              </span>

              <button
                onClick={() => toggle(w.id)}
                className="w-full text-left flex items-start gap-1.5 group cursor-pointer min-h-[20px]"
              >
                <div className="flex-1 min-w-0">
                  <div
                    className="text-[9px] font-bold uppercase tracking-[0.1em] mb-0.5"
                    style={{ color: meta.color }}
                  >
                    {L(meta.ko, meta.en)}
                  </div>
                  <div className={`text-[12px] leading-[1.45] text-[var(--text-primary)] ${emphasize ? 'font-semibold' : ''} ${isOpen ? '' : 'line-clamp-2'}`}>
                    {w.headline}
                  </div>
                </div>
                <ChevronDown
                  size={12}
                  className={`shrink-0 mt-0.5 text-[var(--text-tertiary)] transition-transform ${isOpen ? 'rotate-180' : ''}`}
                />
              </button>

              {isOpen && (
                <div className="mt-1.5 space-y-1.5 animate-fade-in">
                  {w.significance && (
                    <p className="text-[11px] leading-[1.5] text-[var(--text-secondary)]">{w.significance}</p>
                  )}
                  {w.trigger && (
                    <p className="text-[11px] leading-[1.5] text-[var(--text-secondary)]">
                      <span className="font-semibold">{L('계기', 'Trigger')}:</span> {w.trigger}
                    </p>
                  )}
                  {notTaken.map((alt, j) => (
                    <div
                      key={j}
                      className="text-[11px] leading-[1.5] text-[var(--text-secondary)] pl-2 border-l border-dashed"
                      style={{ borderColor: 'var(--border)' }}
                    >
                      <div>
                        <span className="font-medium text-[var(--text-tertiary)]">↘ {L('가지 않은 길', 'Road not taken')}:</span>{' '}
                        <span className="italic">{alt.label}</span>
                        {alt.why_abandoned && <span className="text-[var(--text-tertiary)]"> — {alt.why_abandoned}</span>}
                      </div>
                      <button
                        onClick={() => takeRoad(w.checkpoint_id, alt.label)}
                        disabled={locked}
                        className={`mt-0.5 inline-flex items-center gap-1 text-[10px] font-semibold text-[var(--accent)] hover:underline cursor-pointer ${locked ? 'opacity-40 cursor-not-allowed' : ''}`}
                      >
                        <GitBranch size={9} /> {L('이 길 가보기', 'Sail this path')}
                      </button>
                    </div>
                  ))}
                  {/* Drill-down — the hidden assumptions in play at this turn. */}
                  {assumptions.length > 0 && (
                    <details className="group/d">
                      <summary className="text-[10px] text-[var(--text-tertiary)] cursor-pointer hover:text-[var(--accent)] list-none flex items-center gap-1">
                        <ChevronDown size={9} className="transition-transform group-open/d:rotate-180" />
                        {L(`이 시점의 가정 ${assumptions.length}`, `${assumptions.length} assumptions in play`)}
                      </summary>
                      <ul className="mt-1 space-y-0.5 pl-2">
                        {assumptions.map((a, k) => (
                          <li key={k} className="text-[10.5px] leading-[1.5] text-[var(--text-secondary)] flex gap-1">
                            <span className="text-[var(--text-tertiary)] shrink-0">·</span><span>{a}</span>
                          </li>
                        ))}
                      </ul>
                    </details>
                  )}
                  {/* Generic re-entry — fork a new course from this exact point.
                      Makes the core "go back & choose differently" reachable at
                      every turn (course-changes use their road-not-taken above;
                      the anchorage is the end, nothing to fork forward). */}
                  {w.type !== 'anchorage' && notTaken.length === 0 && (
                    <button
                      onClick={() => { if (!locked) { forkBranch(w.checkpoint_id); setChartOpen(false); } }}
                      disabled={locked}
                      className={`inline-flex items-center gap-1 text-[10px] font-medium text-[var(--text-tertiary)] hover:text-[var(--accent)] cursor-pointer ${locked ? 'opacity-40 cursor-not-allowed' : ''}`}
                    >
                      <GitBranch size={9} /> {L('이 시점에서 다른 길로', 'Fork a new course here')}
                    </button>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ol>

      {/* Full chart (해도) — the spatial exploration / rewind surface */}
      <Modal open={chartOpen} onClose={() => setChartOpen(false)} title={L('전체 해도', 'Full chart')}>
        <VoyageChart />
      </Modal>
    </aside>
  );
}

/**
 * LogbookDrawer — mobile access to the ship's log. A collapsed bottom bar that
 * expands into a bottom sheet wrapping the same <Logbook/>. Sits above the
 * worker drawer (when present) so the two don't collide. Wrap the caller in
 * `lg:hidden`; the desktop rail uses <Logbook/> directly.
 */
export function LogbookDrawer({ offset }: { offset?: boolean }) {
  const locale = useLocale();
  const L = (ko: string, en: string) => (locale === 'ko' ? ko : en);
  const [open, setOpen] = useState(false);
  const count = useProgressiveStore(s => {
    const sess = s.sessions.find(ss => ss.id === s.currentSessionId);
    return sess?.waypoints?.length ?? 0;
  });
  if (count === 0) return null;

  return (
    <>
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className={`fixed inset-x-0 z-40 flex items-center justify-between px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] bg-[var(--surface)] border-t border-[var(--border-subtle)] min-h-[52px] cursor-pointer ${offset ? 'bottom-[calc(56px+env(safe-area-inset-bottom))]' : 'bottom-0'}`}
        >
          <span className="flex items-center gap-2 text-[13px] font-semibold text-[var(--text-primary)]">
            <Compass size={15} className="text-[var(--accent)]" />
            {L('항해일지', "Ship's log")}
            <span className="text-[11px] font-normal text-[var(--text-tertiary)] tabular-nums">{count}</span>
          </span>
          <ChevronUp size={16} className="text-[var(--text-tertiary)]" />
        </button>
      )}
      {open && (
        <>
          <div className="fixed inset-0 z-50 bg-black/30" onClick={() => setOpen(false)} aria-hidden />
          <div className="fixed bottom-0 inset-x-0 z-50 max-h-[82dvh] rounded-t-2xl bg-[var(--surface)] shadow-[var(--shadow-xl)] overflow-y-auto pb-[env(safe-area-inset-bottom)]">
            <div className="sticky top-0 z-10 flex items-center justify-end px-2 py-1.5 bg-[var(--surface)] border-b border-[var(--border-subtle)]">
              <button
                onClick={() => setOpen(false)}
                aria-label={L('닫기', 'Close')}
                className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center text-[var(--text-tertiary)] cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>
            <Logbook />
          </div>
        </>
      )}
    </>
  );
}
