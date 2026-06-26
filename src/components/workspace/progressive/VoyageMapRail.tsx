'use client';

/**
 * VoyageMapRail — the left-hand voyage companion. Restores (and elevates) the
 * decision-fork map + crew-activity surface that the W1.6 focus-mode demoted to
 * a complete-only right rail (the "사라진 지도"). Three stacked sections, each a
 * window onto the SAME voyage object — never a re-statement:
 *
 *   1. 해도 (Chart)   — an INLINE branching course-graph (the spatial fork map):
 *                       where the decision split, which lane you're on, and the
 *                       entry point to the full interactive chart (rewind / fork
 *                       / anchor / compare). This is the hero.
 *   2. 항해일지 (Trail) — the Logbook narrative: the turns you took, the roads
 *                       not taken, and the one-tap "다른 길로" handles.
 *   3. 분석 팀 (Crew)   — live agent activity (status, stream, results).
 *
 * Why a rail and not a modal: the user asked to *see, at a glance and at all
 * times*, "어느 갈림길에서 어떤 결정을 내리며 가고 있는지" — and to be able to
 * step back. The focus-mode lesson (this surface was the #1 mid-voyage clutter)
 * is honored two ways: it is COLLAPSIBLE to a slim spine (state remembered in
 * `voyage_map_collapsed`), and each section is restrained — read-first: the
 * trail's one-tap handles (switch / fork / anchor) stay inline, while the
 * spatial rewind / compare surface is deferred to the 전체 해도 modal. Each
 * child owns its own header (해도 eyebrow / 항해일지 / 분석 팀), so the rail adds
 * only hairline separators — no duplicate labels.
 *
 * Spine note (CLAUDE.md zero-judgment): the map is pure navigation/state — forks,
 * lanes, waypoints, agent status. It renders no verdict, no weighted pole, no
 * convergence score. It surfaces the territory; it never judges the route.
 */

import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Compass, Map as MapIcon, Maximize2, PanelLeftClose, PanelLeftOpen,
  Milestone, GitBranch, Anchor,
} from 'lucide-react';
import { useProgressiveStore } from '@/stores/useProgressiveStore';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { useLocale } from '@/hooks/useLocale';
import { Modal } from '@/components/ui/Modal';
import { SeaChart } from './SeaChart';
import { VoyageChart } from './VoyageChart';
import { Logbook } from './Logbook';
import { AgentSidebar, isWorkingStatus } from './AgentSidebar';
import { useWorkers } from './WorkerPanel';
import { EASE } from './shared/constants';

/* ─── Empty chart — the map has an identity before the first fork is logged ─── */
function EmptyChart() {
  const locale = useLocale();
  const L = (ko: string, en: string) => (locale === 'ko' ? ko : en);
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-4 py-7 text-center">
      <motion.div
        animate={{ rotate: [0, 8, -8, 0] }}
        transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
        className="text-[var(--accent)]/45"
      >
        <Compass size={26} strokeWidth={1.4} />
      </motion.div>
      <p className="text-[11px] leading-[1.55] text-[var(--text-tertiary)] max-w-[180px]">
        {L('이 결정의 갈림길이 여기 해도로 그려져요. 답을 고르고 침로를 바꿀 때마다 길이 이어져요.',
           "This decision's forks chart here. Each answer and course-change extends the route.")}
      </p>
    </div>
  );
}

/* ═══ Hero — the inline branching course-graph (the spatial fork map) ═══ */
function VoyageMapHero() {
  const locale = useLocale();
  const L = (ko: string, en: string) => (locale === 'ko' ? ko : en);
  const session = useProgressiveStore(s => s.sessions.find(ss => ss.id === s.currentSessionId));
  const [chartOpen, setChartOpen] = useState(false);

  const checkpoints = session?.checkpoints || [];
  const branches = session?.branches || [];
  const waypoints = session?.waypoints || [];
  const activeBranch = branches.find(b => b.id === session?.active_branch_id) ?? null;
  const activeId = session?.active_checkpoint_id ?? null;
  const hasChart = checkpoints.length > 0;
  const multiBranch = branches.length > 1;
  // The wordless compact chart gets ONE line of context: what the current
  // position actually is (its waypoint headline) — the rest of the words live
  // in the 항해일지 below and the full 해도.
  const currentWp = waypoints.find(w => w.checkpoint_id === activeId) ?? null;

  return (
    <div className="px-4 pt-4">
      {/* Eyebrow + full-chart entry */}
      <div className="flex items-center justify-between mb-2">
        <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--accent)]">
          <Compass size={11} /> {L('해도', 'Chart')}
        </span>
        {hasChart && (
          <button
            onClick={() => setChartOpen(true)}
            title={L('전체 해도 — 되돌아가기 · 분기 · 확정 · 비교', 'Full chart — rewind · fork · anchor · compare')}
            className="inline-flex items-center gap-1 text-[10px] text-[var(--text-tertiary)] hover:text-[var(--accent)] transition-colors cursor-pointer"
          >
            <Maximize2 size={10} /> {L('전체 해도', 'Full chart')}
          </button>
        )}
      </div>

      {/* The chart card — an antique sea-chart (SeaChart is self-framed:
          parchment + neatline + shadow), tappable to open the full chart. */}
      {hasChart ? (
        <div
          role="button"
          tabIndex={0}
          aria-label={L('전체 해도 열기', 'Open full chart')}
          onClick={() => setChartOpen(true)}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setChartOpen(true); } }}
          className="relative block w-full max-h-[330px] overflow-y-auto cursor-pointer group rounded-[10px] ring-1 ring-[rgba(120,90,30,0.20)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/60"
        >
          <SeaChart
            variant="compact"
            checkpoints={checkpoints}
            branches={branches}
            waypoints={waypoints}
            activeBranchId={activeBranch?.id ?? null}
            activeCheckpointId={activeId}
          />
          <div className="sticky bottom-0 -mt-6 px-3 py-1.5 bg-gradient-to-t from-[rgba(20,14,4,0.55)] to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
            <span className="text-[9.5px] text-[#f6eedb] font-semibold inline-flex items-center gap-1">
              <Maximize2 size={9} /> {L('눌러서 펼치기', 'Tap to open the chart')}
            </span>
          </div>
        </div>
      ) : (
        <EmptyChart />
      )}

      {/* Current-position caption — gives the wordless compact chart one line of
          meaning: where "지금" actually is. */}
      {hasChart && currentWp && (
        <p className="mt-2 px-0.5 text-[10.5px] leading-[1.45] text-[var(--text-secondary)] flex items-baseline gap-1.5">
          <span className="shrink-0 text-[8.5px] font-bold uppercase tracking-[0.14em] text-[var(--accent)]">
            {L('지금', 'Now')}
          </span>
          <span className="min-w-0 line-clamp-2">{currentWp.headline}</span>
        </p>
      )}

      {/* Compact legend — the SVG marks can't explain themselves */}
      {hasChart && (
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 mt-2 px-0.5 text-[9px] text-[var(--text-tertiary)]">
          <span className="inline-flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--accent)' }} />
            {L('기록된 결정', 'Logged turn')}
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--accent)', outline: '1px solid var(--accent)', outlineOffset: '1.5px' }} />
            {L('현재', 'Here')}
          </span>
          {branches.some(b => b.status === 'anchored') && (
            <span className="inline-flex items-center gap-1">
              <Anchor size={9} className="text-[var(--accent)]" /> {L('확정', 'Anchored')}
            </span>
          )}
        </div>
      )}

      {/* Single-course nudge → toward the product's core "take another path".
          Gated on waypoints too, so it never points at a 'trail below' that the
          rail hasn't rendered (the trail is gated on the same signal). */}
      {hasChart && !multiBranch && waypoints.length > 0 && (
        <p className="mt-1.5 px-0.5 text-[9.5px] leading-[1.5] text-[var(--text-tertiary)]">
          {L('아직 한 갈래예요. 아래 흐름에서 갈림길로 돌아가 다른 길을 내볼 수 있어요.',
             'One course so far. Step back to a fork in the trail below to try another path.')}
        </p>
      )}

      <Modal open={chartOpen} onClose={() => setChartOpen(false)} title={L('전체 해도', 'Full chart')} widthClass="max-w-2xl">
        <VoyageChart onNavigated={() => setChartOpen(false)} />
      </Modal>
    </div>
  );
}

/* ═══ Collapsed spine — a slim glanceable edge (focus-mode honored) ═══ */
function CollapsedSpine({ onExpand }: { onExpand: () => void }) {
  const locale = useLocale();
  const L = (ko: string, en: string) => (locale === 'ko' ? ko : en);
  const workers = useWorkers();
  const running = workers.filter(w => isWorkingStatus(w.status)).length;
  // Two primitive selectors — NOT a {…} selector, which would mint a fresh
  // object every render and trip zustand v5's "getSnapshot should be cached".
  const waypointCount = useProgressiveStore(s => {
    const sess = s.sessions.find(ss => ss.id === s.currentSessionId);
    return sess?.waypoints?.length ?? 0;
  });
  const branchCount = useProgressiveStore(s => {
    const sess = s.sessions.find(ss => ss.id === s.currentSessionId);
    return sess?.branches?.length ?? 0;
  });

  // One control, one focus stop, one accessible name — the whole spine expands
  // the rail (two adjacent buttons with the same label were a redundant,
  // indistinguishable pair for screen readers).
  return (
    <button
      onClick={onExpand}
      title={L('항해 지도 펼치기', 'Expand voyage map')}
      aria-label={L('항해 지도 펼치기', 'Expand voyage map')}
      className="w-12 h-full flex flex-col items-center pt-4 gap-4 cursor-pointer group hover:bg-[var(--accent)]/[0.04] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--accent)]/50"
    >
      <span className="w-9 h-9 rounded-lg flex items-center justify-center text-[var(--text-tertiary)] group-hover:text-[var(--accent)] transition-colors">
        <PanelLeftOpen size={16} />
      </span>

      <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-[var(--text-tertiary)] group-hover:text-[var(--accent)] [writing-mode:vertical-rl] rotate-180 transition-colors">
        {L('항해 지도', 'Voyage map')}
      </span>

      {/* Glanceable counts */}
      <span className="flex flex-col items-center gap-3 mt-1">
        {waypointCount > 0 && (
          <span className="flex flex-col items-center gap-0.5" title={L('결정 기점', 'Decision turns')}>
            <Milestone size={12} className="text-[var(--accent)]/70" />
            <span className="text-[9px] font-semibold text-[var(--text-secondary)] tabular-nums">{waypointCount}</span>
          </span>
        )}
        {branchCount > 1 && (
          <span className="flex flex-col items-center gap-0.5" title={L('항로 갈래', 'Courses')}>
            <GitBranch size={12} className="text-[var(--accent)]/70" />
            <span className="text-[9px] font-semibold text-[var(--text-secondary)] tabular-nums">{branchCount}</span>
          </span>
        )}
        {running > 0 && (
          <span className="relative flex items-center justify-center" title={L('분석 중인 팀원', 'Crew analyzing')}>
            <span className="absolute w-3 h-3 rounded-full bg-[var(--accent)]/25 animate-ping" />
            <span className="w-2 h-2 rounded-full bg-[var(--accent)]" />
          </span>
        )}
      </span>
    </button>
  );
}

/* ═══ The rail ═══ */
export function VoyageMapRail() {
  const locale = useLocale();
  const L = (ko: string, en: string) => (locale === 'ko' ? ko : en);
  const collapsed = useSettingsStore(s => s.settings.voyage_map_collapsed ?? false);
  const updateSettings = useSettingsStore(s => s.updateSettings);
  const workers = useWorkers();
  const hasWorkers = workers.length > 0;
  const hasWaypoints = useProgressiveStore(s => {
    const sess = s.sessions.find(ss => ss.id === s.currentSessionId);
    return (sess?.waypoints?.length ?? 0) > 0;
  });

  if (collapsed) {
    return (
      <div className="w-12 h-full border-r border-[var(--border-subtle)]/50 bg-[var(--bg)]/40">
        <CollapsedSpine onExpand={() => updateSettings({ voyage_map_collapsed: false })} />
      </div>
    );
  }

  return (
    <motion.aside
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.4, ease: EASE }}
      className="w-72 xl:w-80 h-full overflow-y-auto border-r border-[var(--border-subtle)]/50 bg-[var(--bg)]/40 pb-8"
      aria-label={L('항해 지도', 'Voyage map')}
    >
      {/* Rail header */}
      <div className="flex items-center justify-between px-4 pt-4 sticky top-0 z-10 bg-[var(--bg)]/80 backdrop-blur-sm pb-2">
        <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--text-secondary)]">
          <MapIcon size={13} className="text-[var(--accent)]" /> {L('항해 지도', 'Voyage map')}
        </span>
        <button
          onClick={() => updateSettings({ voyage_map_collapsed: true })}
          title={L('지도 접기', 'Collapse map')}
          aria-label={L('지도 접기', 'Collapse map')}
          className="w-7 h-7 rounded-lg flex items-center justify-center text-[var(--text-tertiary)] hover:text-[var(--accent)] hover:bg-[var(--accent)]/8 transition-colors cursor-pointer"
        >
          <PanelLeftClose size={14} />
        </button>
      </div>

      {/* 1. The chart (hero) */}
      <VoyageMapHero />

      {/* 2. Decision trail — Logbook owns its own "항해일지" header. Only once
            turns are logged, so the rail never shows an empty duplicate. */}
      {hasWaypoints && (
        <div className="mt-3 pt-1 border-t border-[var(--border-subtle)]/50">
          <Logbook hideChartButton />
        </div>
      )}

      {/* 3. Crew activity — AgentSidebar owns its own "분석 팀" header. */}
      {hasWorkers && (
        <div className="mt-1 pt-1 border-t border-[var(--border-subtle)]/50">
          <AgentSidebar />
        </div>
      )}
    </motion.aside>
  );
}
