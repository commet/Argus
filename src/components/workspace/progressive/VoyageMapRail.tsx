'use client';

/**
 * VoyageMapRail — the standing decision companion. It has two peer views:
 * evidence traces the current claim to user input, team material, and explicitly
 * unverified assumptions; route preserves the spatial checkpoint/fork chart.
 *
 * Why a rail and not a modal: the user asked to *see, at a glance and at all
 * times*, "어느 갈림길에서 어떤 결정을 내리며 가고 있는지" — and to be able to
 * step back. The focus-mode lesson (this surface was the #1 mid-voyage clutter)
 * is honored two ways: it is COLLAPSIBLE to a slim spine (state remembered in
 * `voyage_map_collapsed`), and each section is restrained — read-first: the
 * trail's one-tap "다른 길로" / "이 길로" handles stay inline, while the spatial
 * step-back surface is deferred to the 전체 해도 modal. Each
 * child owns its own header (해도 eyebrow / 항해일지 / 분석 팀), so the rail adds
 * only hairline separators — no duplicate labels.
 *
 * Spine note (CLAUDE.md zero-judgment): the map is pure navigation/state — forks,
 * lanes, waypoints, agent status. It renders no verdict, no weighted pole, no
 * convergence score. It surfaces the territory; it never judges the route.
 */

import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Compass, Map as MapIcon, Maximize2, PanelLeftClose, PanelLeftOpen,
  Milestone, GitBranch, ArrowLeft, SearchCheck,
} from 'lucide-react';
import { useProgressiveStore } from '@/stores/useProgressiveStore';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { useLocale } from '@/hooks/useLocale';
import { Modal } from '@/components/ui/Modal';
import type { Waypoint } from '@/stores/types';
import { SeaChart } from './SeaChart';
import { VoyageChart } from './VoyageChart';
import { WaypointCard } from './shared/WaypointCard';
import { isWorkingStatus } from './AgentSidebar';
import { useWorkers } from './WorkerPanel';
import { EASE } from './shared/constants';
import { DecisionEvidenceMap } from './DecisionEvidenceMap';

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
        {L('답을 고르거나 이전 답으로 돌아가면 결정의 갈래가 여기에 기록돼요.',
           'Decision branches appear here as you answer or return to an earlier choice.')}
      </p>
    </div>
  );
}

/* ═══ Hero — the unified map: a spatial chart + the tapped turn's card ═══
   The founder's "map-first, tap reveals a card": the parchment chart is the
   surface; tapping a logged point shows THAT turn's story in one card below
   (defaulting to the current position). No parallel Logbook list — the card IS
   the log, read one turn at a time, spatially. */
function VoyageMapHero() {
  const locale = useLocale();
  const L = (ko: string, en: string) => (locale === 'ko' ? ko : en);
  const session = useProgressiveStore(s => s.sessions.find(ss => ss.id === s.currentSessionId));
  const forkBranch = useProgressiveStore(s => s.forkBranch);
  const locked = useProgressiveStore(s => s.isBranchingLocked());
  const [chartOpen, setChartOpen] = useState(false);
  const [pickedCp, setPickedCp] = useState<string | null>(null);

  const checkpoints = useMemo(() => session?.checkpoints || [], [session?.checkpoints]);
  const branches = session?.branches || [];
  const waypoints = useMemo(() => session?.waypoints || [], [session?.waypoints]);
  const activeBranch = branches.find(b => b.id === session?.active_branch_id) ?? null;
  const activeId = session?.active_checkpoint_id ?? null;
  const hasChart = checkpoints.length > 0;
  const multiBranch = branches.length > 1;

  const wpByCp = useMemo(() => {
    const m = new Map<string, Waypoint>();
    for (const w of waypoints) m.set(w.checkpoint_id, w);
    return m;
  }, [waypoints]);
  const parentOf = useMemo(() => new Map(checkpoints.map(c => [c.id, c.parent_id])), [checkpoints]);
  const assumptionsByCp = useMemo(
    () => new Map(checkpoints.map(c => [c.id, c.state_snapshot?.snapshots?.slice(-1)?.[0]?.hidden_assumptions || []])),
    [checkpoints],
  );

  // The card shows the picked turn, defaulting to the current position. Picking
  // a node with no logged turn falls through to current (the card stays stable).
  const shownCp = (pickedCp && wpByCp.has(pickedCp)) ? pickedCp : activeId;
  const shownWp = shownCp ? wpByCp.get(shownCp) ?? null : null;
  const isCurrent = shownCp === activeId;

  // Take the road not taken — fork from the point *before* the turn so the user
  // re-decides at that fork (same rule the trail used).
  const takeRoad = (cpId: string, label: string) => {
    if (locked) return;
    forkBranch(parentOf.get(cpId) ?? cpId, label);
  };

  return (
    <div className="px-4 pt-4">
      {/* Eyebrow + full-chart entry */}
      <div className="flex items-center justify-between mb-2">
        <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--accent)]">
          <Compass size={11} /> {L('결정 갈래', 'Decision branches')}
        </span>
        {hasChart && (
          <button
            onClick={() => setChartOpen(true)}
            title={L('전체 결정 지도 — 이전 지점으로 돌아가기', 'Full decision map — return to an earlier point')}
            className="inline-flex items-center gap-1 text-[10px] text-[var(--text-tertiary)] hover:text-[var(--accent)] transition-colors cursor-pointer"
          >
            <Maximize2 size={10} /> {L('전체 결정 지도', 'Full decision map')}
          </button>
        )}
      </div>

      {/* The chart card — an antique sea-chart (SeaChart self-frames: parchment +
          neatline + shadow). Tapping a node picks that turn for the card below;
          the eyebrow "전체 해도" opens the full pan/zoom/rewind surface.
          Fixed height + fit-to-box (SeaChart fills it with preserveAspect
          'meet'), so the WHOLE voyage — crucially the current ship — is always
          in view; before, a route taller than the box scrolled "you are here"
          off the bottom. */}
      {hasChart ? (
        <div className="relative block w-full h-[300px] rounded-[10px] ring-1 ring-[rgba(120,90,30,0.20)]">
          <SeaChart
            variant="compact"
            checkpoints={checkpoints}
            branches={branches}
            waypoints={waypoints}
            activeBranchId={activeBranch?.id ?? null}
            activeCheckpointId={activeId}
            onPick={(id) => setPickedCp(id)}
          />
        </div>
      ) : (
        <EmptyChart />
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
          <span className="text-[var(--text-tertiary)]/70">· {L('점을 탭하면 그 결정이 아래에 펼쳐져요', 'Tap a point to read that turn below')}</span>
        </div>
      )}

      {/* The picked / current turn — the unified narration card (replaces the
          old "지금" caption AND the parallel Logbook list). */}
      {hasChart && shownWp && (
        <div className="mt-2.5">
          <WaypointCard
            waypoint={shownWp}
            assumptions={assumptionsByCp.get(shownWp.checkpoint_id) || []}
            locked={locked}
            onTakeRoad={takeRoad}
            eyebrow={isCurrent ? L('지금', 'Now') : undefined}
            dense
          />
          {!isCurrent && (
            <button
              onClick={() => setPickedCp(null)}
              className="mt-1.5 inline-flex items-center gap-1 text-[10px] font-medium text-[var(--text-tertiary)] hover:text-[var(--accent)] transition-colors cursor-pointer"
            >
              <ArrowLeft size={10} /> {L('지금 위치로', 'Back to current')}
            </button>
          )}
        </div>
      )}

      {/* Single-course nudge → toward the product's core "take another path". */}
      {hasChart && !multiBranch && waypoints.length > 0 && (
        <p className="mt-2 px-0.5 text-[10px] leading-[1.5] text-[var(--text-tertiary)]">
          {L('아직 한 갈래예요. 위 지도에서 이전 지점으로 돌아가 다른 답을 선택할 수 있어요.',
             'There is one branch so far. Return to an earlier point above to try a different answer.')}
        </p>
      )}

      <Modal open={chartOpen} onClose={() => setChartOpen(false)} title={L('전체 결정 지도', 'Full decision map')} widthClass="max-w-2xl">
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
      title={L('판단 지도 펼치기', 'Expand decision map')}
      aria-label={L('판단 지도 펼치기', 'Expand decision map')}
      className="w-12 h-full flex flex-col items-center pt-4 gap-4 cursor-pointer group hover:bg-[var(--accent)]/[0.04] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--accent)]/50"
    >
      <span className="w-9 h-9 rounded-lg flex items-center justify-center text-[var(--text-tertiary)] group-hover:text-[var(--accent)] transition-colors">
        <PanelLeftOpen size={16} />
      </span>

      <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-[var(--text-tertiary)] group-hover:text-[var(--accent)] [writing-mode:vertical-rl] rotate-180 transition-colors">
        {L('판단 지도', 'Decision map')}
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
          <span className="flex flex-col items-center gap-0.5" title={L('결정 갈래', 'Decision branches')}>
            <GitBranch size={12} className="text-[var(--accent)]/70" />
            <span className="text-[9px] font-semibold text-[var(--text-secondary)] tabular-nums">{branchCount}</span>
          </span>
        )}
        {running > 0 && (
          <span className="relative flex items-center justify-center" title={L('분석 중인 AI 검토자', 'AI reviewers working')}>
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
  const [view, setView] = useState<'evidence' | 'route'>('route');

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
      aria-label={L('판단 지도', 'Decision map')}
    >
      {/* Rail header */}
      <div className="flex items-center justify-between px-4 pt-4 sticky top-0 z-10 bg-[var(--bg)]/80 backdrop-blur-sm pb-2">
        <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--text-secondary)]">
          <SearchCheck size={13} className="text-[var(--accent)]" /> {L('판단 지도', 'Decision map')}
        </span>
        <button
          onClick={() => updateSettings({ voyage_map_collapsed: true })}
          title={L('판단 지도 접기', 'Collapse decision map')}
          aria-label={L('판단 지도 접기', 'Collapse decision map')}
          className="w-7 h-7 rounded-lg flex items-center justify-center text-[var(--text-tertiary)] hover:text-[var(--accent)] hover:bg-[var(--accent)]/8 transition-colors cursor-pointer"
        >
          <PanelLeftClose size={14} />
        </button>
      </div>

      <div className="mx-4 mb-3 grid grid-cols-2 border-b border-[var(--border-subtle)]" role="tablist" aria-label={L('판단 지도 보기', 'Decision map view')}>
        <button
          type="button"
          role="tab"
          aria-selected={view === 'route'}
          onClick={() => setView('route')}
          className={`inline-flex min-h-10 items-center justify-center gap-1.5 border-b-2 text-[11px] font-semibold transition-colors ${view === 'route' ? 'border-[var(--accent)] text-[var(--text-primary)]' : 'border-transparent text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'}`}
        >
          <MapIcon size={12} /> {L('갈래', 'Branches')}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={view === 'evidence'}
          onClick={() => setView('evidence')}
          className={`inline-flex min-h-10 items-center justify-center gap-1.5 border-b-2 text-[11px] font-semibold transition-colors ${view === 'evidence' ? 'border-[var(--accent)] text-[var(--text-primary)]' : 'border-transparent text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'}`}
        >
          <SearchCheck size={12} /> {L('근거', 'Evidence')}
        </button>
      </div>

      {/* Route remains the visual first view; evidence is its operational peer.
          The route keeps the chart + tapped turn card. The parallel Logbook
          list was removed here (voyage redesign step 4) — it re-stated the same
          waypoints the chart already shows. A turn's narration now lives in one
          place: tap its point on the chart. The full vertical trail survives as
          the mobile bottom-drawer (LogbookDrawer) where there's no room for a
          map. Crew activity stays out of the rail too (duplicated by the
          left-column "선원들이 일하고 있어요" header). */}
      {view === 'evidence' ? <DecisionEvidenceMap /> : <VoyageMapHero />}
    </motion.aside>
  );
}
