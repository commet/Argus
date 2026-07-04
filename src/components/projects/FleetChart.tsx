'use client';

import { useMemo, useState } from 'react';
import { ChartPlate } from '@/components/ui/ChartPlate';
import { VoyageShip } from '@/components/ui/VoyageElements';
import { getVoyageState, VOYAGE_STATE_META, type VoyageLeg } from '@/lib/voyage-state';
import { contractStatus } from '@/lib/decision-contract';
import { firstVoyageInscription } from '@/lib/record-summary';
import type {
  Project,
  ReframeItem,
  RecastItem,
  SynthesizeItem,
  FeedbackRecord,
  ProgressiveSession,
} from '@/stores/types';
import { ChevronDown } from 'lucide-react';

/**
 * FleetChart (S4 함대 해도 — 최소형) — the user's sealed voyages laid out on ONE
 * sea-chart sheet, oldest-first along a single dotted route.
 *
 * This is 100% a composition of EXISTING ink assets: ChartPlate (the plate that
 * production never mounted until now) + VoyageShip (per-project rig, value-
 * unchanged) + getVoyageState (the single derived-state brain). It draws nothing
 * new — no new rig, no new palette.
 *
 * SPINE — the composition itself is the risk (거울 조항 / B3):
 *  - A single time axis (created_at ascending) is the ONLY ordering. There is NO
 *    grouping by state, NO re-sorting wrecked/adrift together, NO count badges.
 *    A wreck sits wherever its seal date places it, beside a verified voyage, so
 *    the sheet is a timeline of what set out — never a scoreboard of pass/fail.
 *  - rigOf values are untouched; no ship is enlarged / dimmed / highlighted to
 *    single it out. verified alone raises a gold flag (VoyageShip's own rule).
 *  - Ships are click-to-open only (setCurrentProjectId). No CTA button rides a
 *    ship — the whitespace is a fact, not a nudge.
 *  - Renders only at 2+ ships. Below that there is no fleet to chart.
 *  - Motion: VoyageShip inherits the global prefers-reduced-motion pause; the
 *    route line is static SVG (nothing to stop).
 *
 * The left inscription is a pure elapsed FACT (첫 항해 {date} · N주째) — never a
 * streak, never a continuity claim; it reads identically across empty gaps.
 */

const SHIP_SIZE = 34;

interface FleetShip {
  id: string;
  name: string;
  state: ReturnType<typeof getVoyageState>;
  sealedDate: string; // YYYY-MM-DD of created_at (seal), for hover
  createdAt: string;
}

// Project-list step index → voyage leg (page order: reframe, recast, rehearse, synthesize)
const STEP_IDX_TO_LEG: ReadonlyArray<VoyageLeg> = ['reframe', 'recast', 'rehearse', 'synthesize'];

export function FleetChart({
  projects,
  reframeItems,
  recastItems,
  synthesizeItems,
  feedbackHistory,
  progressiveSessions,
  locale,
  onSelect,
}: {
  projects: Project[];
  reframeItems: ReframeItem[];
  recastItems: RecastItem[];
  synthesizeItems: SynthesizeItem[];
  feedbackHistory: FeedbackRecord[];
  progressiveSessions: ProgressiveSession[];
  locale: 'ko' | 'en';
  onSelect: (projectId: string) => void;
}) {
  const L = (ko: string, en: string) => (locale === 'ko' ? ko : en);
  const [collapsed, setCollapsed] = useState(false);

  // B2 — derived-state cache. getVoyageState is derived (never stored), so each
  // ship is recomputed per render; memo keyed on the projects + per-tool signals
  // so it only rebuilds when the underlying record actually changes. Mirrors the
  // signal derivation in project/page.tsx's projectMetricsMap (same brain).
  const ships = useMemo<FleetShip[]>(() => {
    const now = Date.now();
    const list: FleetShip[] = [];
    for (const p of projects) {
      // Retro (practice) voyages are isolated from the accumulation face, the
      // same W1 origin:'retro' invariant summarizeRecord and the Logbook honour:
      // the fleet chart is the record of decisions made blind, not rehearsals.
      if (p.decision_contract?.origin === 'retro') continue;
      const r = reframeItems.filter((d) => d.project_id === p.id);
      const rc = recastItems.filter((o) => o.project_id === p.id);
      const sy = synthesizeItems.filter((s) => s.project_id === p.id);
      const fb = feedbackHistory.filter((f) => f.project_id === p.id);
      const lastR = r[r.length - 1];
      const lastRc = rc[rc.length - 1];
      const lastF = fb[fb.length - 1];
      const lastS = sy[sy.length - 1];

      const statuses = [
        lastR?.status === 'done' || lastR ? true : false,
        lastRc?.status === 'done' || lastRc ? true : false,
        !!lastF,
        sy.length > 0,
      ];
      const legacyDone =
        (lastR?.status === 'done' ? 1 : 0) +
          (lastRc?.status === 'done' ? 1 : 0) +
          (lastF ? 1 : 0) +
          (sy.length > 0 ? 1 : 0) ===
        4;
      const hasProgress = statuses.some(Boolean);

      const voyageSession = progressiveSessions.find((s) => s.project_id === p.id);
      const contractSealed = !!p.decision_contract;
      const contractAllGraded = p.decision_contract
        ? contractStatus(p.decision_contract, 0).allGraded
        : false;
      const voyageComplete = voyageSession?.phase === 'complete';
      const hasVoyage = !!voyageSession || contractSealed;
      const startedEff = hasProgress || hasVoyage;
      const doneEff = legacyDone || voyageComplete || contractAllGraded;

      // Last-activity signal — same candidate walk as projectMetricsMap.
      const candidates: Array<{ idx: number; at: string }> = [];
      if (lastR?.updated_at || lastR?.created_at) candidates.push({ idx: 0, at: lastR.updated_at || lastR.created_at });
      if (lastRc?.updated_at || lastRc?.created_at) candidates.push({ idx: 1, at: lastRc.updated_at || lastRc.created_at });
      if (lastF?.created_at) candidates.push({ idx: 2, at: lastF.created_at });
      if (lastS?.created_at) candidates.push({ idx: 3, at: lastS.created_at });
      candidates.sort((a, b) => b.at.localeCompare(a.at));
      const lastActivityStepIdx = candidates[0]?.idx ?? -1;
      const lastActivityAt = candidates[0]?.at || p.updated_at || p.created_at || '';

      // Only SEALED voyages belong on the fleet chart — the accumulation face is
      // the record of committed decisions, not every scratch project.
      if (!contractSealed) continue;

      const state = getVoyageState(
        {
          started: startedEff,
          completedAllLegs: doneEff || contractSealed,
          lastActivityAt,
          hasCoda: !!p.meta_reflection || contractAllGraded,
          lastLeg: lastActivityStepIdx >= 0 ? STEP_IDX_TO_LEG[lastActivityStepIdx] : null,
          outcomeVerdict: contractAllGraded ? 'mixed' : p.outcome?.verdict,
        },
        now,
      );

      const createdAt = p.created_at || lastActivityAt || '';
      list.push({
        id: p.id,
        name: p.name,
        state,
        sealedDate: createdAt ? String(createdAt).slice(0, 10) : '',
        createdAt,
      });
    }
    // The ONE ordering: seal date ascending. No state grouping, ever.
    list.sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''));
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projects, reframeItems, recastItems, synthesizeItems, feedbackHistory, progressiveSessions]);

  // B3(a) — below two ships there is no fleet to chart.
  if (ships.length < 2) return null;

  const firstDate = ships[0]?.sealedDate || '';
  // Pure elapsed fact — NOT a streak. Identical across empty gaps. Shared brain
  // (record-summary) so the "오늘로 N주째" wording can't drift from the Logbook.
  const inscription = firstVoyageInscription(firstDate || undefined, Date.now(), locale);

  return (
    <ChartPlate
      label={L('함대 · FLEET', 'FLEET · 함대')}
      className="!py-0"
    >
      {/* ChartPlate centers its children; the fleet wants a full-width band, so
          this inner block overrides the plate's default centered column. */}
      <div className="w-full text-left">
        <div className="flex items-center justify-between gap-3 mb-1">
          {inscription ? (
            <span className="text-[10px] font-mono uppercase tracking-[0.14em] text-[var(--bp-ink-soft)]/80 tabular-nums">
              {inscription}
            </span>
          ) : (
            <span />
          )}
          <button
            type="button"
            onClick={() => setCollapsed((c) => !c)}
            aria-expanded={!collapsed}
            className="inline-flex items-center gap-1 text-[10px] font-mono uppercase tracking-[0.14em] text-[var(--bp-ink-soft)]/70 hover:text-[var(--bp-ink)] transition-colors cursor-pointer"
          >
            {collapsed ? L('펼치기', 'Show') : L('접기', 'Hide')}
            <ChevronDown
              size={12}
              className={`transition-transform ${collapsed ? '-rotate-90' : ''}`}
              aria-hidden
            />
          </button>
        </div>

        {!collapsed && (
          <div className="relative w-full overflow-x-auto">
            {/* The route: a single dotted line under the fleet = the one time axis. */}
            <div
              className="relative flex items-end gap-3 sm:gap-5 min-w-min py-3 px-1"
              role="list"
            >
              {/* Dotted route rule — static (no animation to pause). */}
              <div
                aria-hidden
                className="absolute left-1 right-1 bottom-[30px] border-t border-dashed border-[var(--bp-ink)]/25"
              />
              {ships.map((ship) => {
                const meta = VOYAGE_STATE_META[ship.state];
                const label = L(meta.ko, meta.en);
                const hover = ship.sealedDate ? `${ship.name} · ${ship.sealedDate}` : ship.name;
                return (
                  <button
                    key={ship.id}
                    type="button"
                    role="listitem"
                    onClick={() => onSelect(ship.id)}
                    title={hover}
                    aria-label={`${ship.name} — ${label}${ship.sealedDate ? ` (${ship.sealedDate})` : ''}`}
                    className="relative z-[1] shrink-0 flex flex-col items-center gap-0.5 rounded-lg px-1 pt-1 pb-0 hover:bg-[var(--bp-ink)]/[0.04] transition-colors cursor-pointer group"
                  >
                    <VoyageShip state={ship.state} size={SHIP_SIZE} title={hover} />
                    <span className="text-[9px] font-mono tabular-nums text-[var(--bp-ink-soft)]/60 whitespace-nowrap">
                      {ship.sealedDate ? ship.sealedDate.slice(5) : ''}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </ChartPlate>
  );
}
