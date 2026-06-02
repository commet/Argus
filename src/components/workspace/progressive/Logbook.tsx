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

import { useMemo, useState } from 'react';
import {
  Sailboat, Milestone, AlertTriangle, Eye, Wind, Anchor, ChevronDown, ChevronUp,
  Map as MapIcon, Flag, GitBranch, Compass, X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useProgressiveStore } from '@/stores/useProgressiveStore';
import { useLocale } from '@/hooks/useLocale';
import { getActivePath } from '@/lib/version-tree';
import { Modal } from '@/components/ui/Modal';
import { VoyageChart } from '@/components/workspace/progressive/VoyageChart';
import type { ProgressivePhase, WaypointType } from '@/stores/types';

const WP_META: Record<WaypointType, { Icon: LucideIcon; color: string; ko: string; en: string }> = {
  departure:     { Icon: Sailboat,      color: 'var(--text-secondary)', ko: '출항',      en: 'Departure' },
  course_change: { Icon: Milestone,     color: 'var(--accent)',         ko: '침로 변경',  en: 'Course change' },
  reef:          { Icon: AlertTriangle, color: '#b4541e',               ko: '암초',      en: 'Reef' },
  sighting:      { Icon: Eye,           color: '#2d6b8a',               ko: '관측',      en: 'Sighting' },
  headwind:      { Icon: Wind,          color: '#6b4c9a',               ko: '역풍',      en: 'Headwind' },
  anchorage:     { Icon: Anchor,        color: '#2d6b2d',               ko: '정박',      en: 'Anchorage' },
};

/** While the engine is mid-stream we hold branch mutations — switching or
 *  forking out from under a running analysis would strand it. */
const WORKING_PHASES: ProgressivePhase[] = ['analyzing', 'mixing', 'lead_synthesizing'];

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
      checkpoints.map(c => [c.id, c.state_snapshot.snapshots.slice(-1)[0]?.hidden_assumptions || []]),
    );
    return { waypoints: list, branches, activeBranch: active, parentOf, assumptionsByCp };
  }, [session]);

  const lastId = waypoints[waypoints.length - 1]?.id ?? null;
  const openEntry = openId !== null ? openId : lastId;
  const toggle = (id: string) => setOpenId(openEntry === id ? '' : id);

  // Hold branch mutations while the engine streams *or* workers are in flight —
  // switching/forking out from under either would strand the running work.
  const phaseBusy = session ? WORKING_PHASES.includes(session.phase) : false;
  const workersBusy = !!session
    && session.worker_deploy_phase === 'deployed'
    && (session.workers || []).some(w => w.status === 'running' || w.status === 'ai_preparing' || w.status === 'pending');
  const locked = phaseBusy || workersBusy;
  const multiBranch = branches.length > 1;

  // "Take the road not taken" — fork from the checkpoint *before* the turn so
  // the user re-decides at that fork. Falls back to the turn checkpoint itself.
  const takeRoad = (waypointCheckpointId: string, label: string) => {
    if (locked) return;
    const forkPoint = parentOf.get(waypointCheckpointId) ?? waypointCheckpointId;
    forkBranch(forkPoint, label);
    setChartOpen(false);
  };

  if (waypoints.length === 0) return null;

  return (
    <aside className="px-4 py-4" aria-label={L('항해일지', "Ship's log")}>
      {/* Header */}
      <div className="flex items-center justify-between mb-2.5">
        <h3 className="text-[12px] font-bold text-[var(--text-primary)] tracking-tight">
          {L('항해일지', "Ship's log")}
        </h3>
        <button
          onClick={() => setChartOpen(true)}
          className="inline-flex items-center gap-1 text-[10.5px] text-[var(--text-tertiary)] hover:text-[var(--accent)] transition-colors cursor-pointer"
        >
          <MapIcon size={11} /> {L('전체 해도', 'Full chart')}
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
                  className={`inline-flex items-center rounded-full text-[10.5px] font-medium max-w-[150px] transition-all ${
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
                    className={`inline-flex items-center gap-1 pl-2 ${isActive ? 'pr-2' : 'pr-1'} py-1 min-w-0 cursor-pointer ${locked && !isActive ? 'opacity-40 cursor-not-allowed' : ''} ${isActive ? '' : 'hover:text-[var(--text-primary)]'}`}
                  >
                    {b.status === 'anchored' ? <Flag size={9} className="shrink-0" /> : <GitBranch size={9} className="shrink-0" />}
                    <span className="truncate">{b.name}</span>
                  </button>
                  {!isActive && (
                    <button
                      onClick={() => !locked && deleteBranch(b.id)}
                      disabled={locked}
                      aria-label={L('분기 삭제', 'Delete branch')}
                      className={`pr-1.5 pl-0.5 py-1 text-[var(--text-tertiary)] hover:text-[var(--danger)] cursor-pointer ${locked ? 'opacity-40 cursor-not-allowed' : ''}`}
                    >
                      <X size={9} />
                    </button>
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
              className={`inline-flex items-center gap-1 text-[10.5px] font-medium text-[var(--accent)] hover:underline cursor-pointer ${locked ? 'opacity-40 cursor-not-allowed' : ''}`}
            >
              <Anchor size={10} /> {L('이 항로로 확정', 'Anchor this course')}
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
                    <p className="text-[10.5px] leading-[1.5] text-[var(--text-tertiary)]">
                      <span className="font-semibold">{L('계기', 'Trigger')}:</span> {w.trigger}
                    </p>
                  )}
                  {notTaken.map((alt, j) => (
                    <div
                      key={j}
                      className="text-[10.5px] leading-[1.45] text-[var(--text-tertiary)] pl-2 border-l border-dashed"
                      style={{ borderColor: 'var(--text-tertiary)' }}
                    >
                      <div>
                        <span className="opacity-70">↘ {L('가지 않은 길', 'Road not taken')}:</span>{' '}
                        <span className="italic">{alt.label}</span>
                        {alt.why_abandoned && <span className="opacity-70"> — {alt.why_abandoned}</span>}
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
                          <li key={k} className="text-[10px] leading-[1.45] text-[var(--text-tertiary)] flex gap-1">
                            <span className="opacity-50 shrink-0">·</span><span>{a}</span>
                          </li>
                        ))}
                      </ul>
                    </details>
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
          className={`fixed inset-x-0 z-40 flex items-center justify-between px-4 py-3 bg-[var(--surface)] border-t border-[var(--border-subtle)] min-h-[52px] cursor-pointer ${offset ? 'bottom-[56px]' : 'bottom-0'}`}
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
          <div className="fixed bottom-0 inset-x-0 z-50 max-h-[82vh] rounded-t-2xl bg-[var(--surface)] shadow-[var(--shadow-xl)] overflow-y-auto">
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
