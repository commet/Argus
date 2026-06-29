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
  ChevronDown, ChevronUp, Map as MapIcon, Compass, X,
} from 'lucide-react';
import { useProgressiveStore } from '@/stores/useProgressiveStore';
import { useLocale } from '@/hooks/useLocale';
import { getActivePath } from '@/lib/version-tree';
import { Modal } from '@/components/ui/Modal';
import { VoyageChart } from '@/components/workspace/progressive/VoyageChart';
import { WP_META, WaypointDetail } from '@/components/workspace/progressive/shared/WaypointCard';

export function Logbook({ hideChartButton = false }: { hideChartButton?: boolean } = {}) {
  const locale = useLocale();
  const L = (ko: string, en: string) => (locale === 'ko' ? ko : en);
  const session = useProgressiveStore(s => s.sessions.find(ss => ss.id === s.currentSessionId));
  const forkBranch = useProgressiveStore(s => s.forkBranch);

  const [openId, setOpenId] = useState<string | null>(null);
  const [chartOpen, setChartOpen] = useState(false);

  const { waypoints, parentOf, assumptionsByCp } = useMemo(() => {
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

  // Hold the "이 길 가보기" fork while the engine streams or workers are in flight
  // (shared lock — same rule the chart uses).
  const locked = useProgressiveStore(s => s.isBranchingLocked());

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
            {L('분석이 진행되면 결정의 흐름 — 항로를 바꾼 순간들 — 이 여기 차곡차곡 쌓여요.',
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
        {/* When embedded under the Voyage Map hero (which owns the chart), the
            hero's "전체 해도" button is the single chart entry point — suppress
            this duplicate. Standalone (mobile drawer, classic) keeps it. */}
        {!hideChartButton && (
          <button
            onClick={() => setChartOpen(true)}
            className="inline-flex items-center gap-1 text-[10.5px] text-[var(--text-tertiary)] hover:text-[var(--accent)] transition-colors cursor-pointer"
          >
            <MapIcon size={11} /> {L('전체 해도', 'Full chart')}
          </button>
        )}
      </div>

      {/* Branch switch / anchor / delete chips removed (voyage redesign step 3a):
          managing named courses is git-ceremony. The 항해일지 is now read-only
          narration of the ACTIVE course; returning to an explored course lives in
          the 해도 ("이 길로"), and exploring a road-not-taken keeps its own
          "이 길 가보기" below. */}

      {/* Waypoints */}
      <ol className="relative">
        {waypoints.map((w, i) => {
          const meta = WP_META[w.type];
          const { Icon } = meta;
          const isOpen = openEntry === w.id;
          const isLast = i === waypoints.length - 1;
          const emphasize = w.type === 'course_change';
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
                  {/* Collapsed = a ONE-line trail entry (a glanceable "where I've
                      been" log), not the full question — that lives in the left
                      column. Expanding (tap) still reveals the full headline +
                      significance/trigger below, so nothing is lost. */}
                  <div className={`text-[11.5px] leading-[1.4] text-[var(--text-primary)] ${emphasize ? 'font-semibold' : ''} ${isOpen ? '' : 'line-clamp-1'}`}>
                    {w.headline}
                  </div>
                </div>
                <ChevronDown
                  size={12}
                  className={`shrink-0 mt-0.5 text-[var(--text-tertiary)] transition-transform ${isOpen ? 'rotate-180' : ''}`}
                />
              </button>

              {isOpen && (
                <div className="mt-1.5 animate-fade-in">
                  {/* Narration body shared with the rail/chart WaypointCard, so a
                      turn's story reads identically wherever it surfaces (single
                      source of truth). The generic per-row "fork here" CTA on a
                      turn with NO road-not-taken stays removed — manufacturing a
                      fork on a flat decision violates the mirror clause; real
                      roads-not-taken keep their own "이 길 가보기" inside the body. */}
                  <WaypointDetail
                    waypoint={w}
                    assumptions={assumptions}
                    locked={locked}
                    onTakeRoad={takeRoad}
                  />
                </div>
              )}
            </li>
          );
        })}
      </ol>

      {/* Full chart (해도) — the spatial exploration / rewind surface. When the
          chart button is suppressed (embedded under the Voyage Map hero, which
          owns the single chart entry point), nothing can open this Modal, so we
          don't mount it — the hero's chart is the one source of truth. */}
      {!hideChartButton && (
        <Modal open={chartOpen} onClose={() => setChartOpen(false)} title={L('전체 해도', 'Full chart')}>
          <VoyageChart onNavigated={() => setChartOpen(false)} />
        </Modal>
      )}
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
