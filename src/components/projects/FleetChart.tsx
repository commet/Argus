'use client';

import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ChartPlate } from '@/components/ui/ChartPlate';
import { VoyageShip } from '@/components/ui/VoyageElements';
import { getVoyageState, VOYAGE_STATE_META, type VoyageLeg } from '@/lib/voyage-state';
import { contractStatus } from '@/lib/decision-contract';
import { firstVoyageInscription } from '@/lib/record-summary';
import { sharedGrounds } from '@/lib/judgment-graph';
import type { JudgmentReceipt } from '@/lib/review';
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
  /** Which harbor the vessel sailed from — a project voyage or a sealed
   *  review/MCP receipt. One sea, one time axis; the kind only routes the
   *  click (project detail vs /tools/review). */
  kind: 'project' | 'receipt';
}

/** An undersea current — a shared premise literally connecting the ships that
 *  stand on it (judgment graph, normalized-text equality; nothing inferred). */
interface Current {
  key: string;
  text: string;
  drifted: boolean;
  shipIds: string[];
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
  receipts,
  onSelectReceipt,
}: {
  projects: Project[];
  reframeItems: ReframeItem[];
  recastItems: RecastItem[];
  synthesizeItems: SynthesizeItem[];
  feedbackHistory: FeedbackRecord[];
  progressiveSessions: ProgressiveSession[];
  locale: 'ko' | 'en';
  onSelect: (projectId: string) => void;
  /** Sealed review/MCP receipts join the same sea (one harbor, P0-6 ①). */
  receipts?: JudgmentReceipt[];
  onSelectReceipt?: (receiptId: string) => void;
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
        kind: 'project',
      });
    }

    // Sealed review/MCP receipts are vessels too — the fleet is EVERY committed
    // decision, whichever door it sailed from. Same derived-state brain as the
    // contracts above (started+sealed → sailing family; settled → the same
    // outcome mapping contractAllGraded uses) — no second state machine.
    for (const r of receipts ?? []) {
      const sealedFollowups = (r.falsifiable_followups ?? []).filter((f) => f.sealed_at);
      if (sealedFollowups.length === 0) continue;
      const settled = r.state === 'settled' || sealedFollowups.every((f) => !!f.settled_at);
      const createdAt = sealedFollowups.map((f) => f.sealed_at!).sort()[0] || r.created_at || '';
      const state = getVoyageState(
        {
          started: true,
          completedAllLegs: true,
          lastActivityAt: r.updated_at || createdAt,
          hasCoda: settled,
          lastLeg: null,
          outcomeVerdict: settled ? 'mixed' : 'pending',
        },
        now,
      );
      list.push({
        id: r.receipt_id,
        name: r.source_title || '',
        state,
        sealedDate: createdAt ? String(createdAt).slice(0, 10) : '',
        createdAt,
        kind: 'receipt',
      });
    }

    // The ONE ordering: seal date ascending. No state grouping, ever.
    list.sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''));
    return list;
  }, [projects, reframeItems, recastItems, synthesizeItems, feedbackHistory, progressiveSessions, receipts]);

  // Undersea currents — shared ground between charted vessels (judgment graph).
  // Drawn only between ships actually on this sheet; a current with fewer than
  // two charted ships has nothing to connect.
  const currents = useMemo<Current[]>(() => {
    if (!receipts?.length) return [];
    const charted = new Set(ships.map((s) => s.id));
    return sharedGrounds(receipts)
      .map((g) => ({
        key: g.key,
        text: g.text,
        drifted: !!g.drift,
        shipIds: [...new Set(g.members.map((m) => m.receipt_id))].filter((id) => charted.has(id)),
      }))
      .filter((c) => c.shipIds.length >= 2);
  }, [receipts, ships]);

  // Current arcs need real x-positions: ships lay out in a flex row, so we
  // measure after paint (refs → centers relative to the row) and re-measure on
  // resize. jsdom returns zero-rects — the arcs degenerate harmlessly in tests.
  const rowRef = useRef<HTMLDivElement | null>(null);
  const shipRefs = useRef(new Map<string, HTMLButtonElement>());
  const [geom, setGeom] = useState<{ centers: Record<string, number>; width: number; height: number } | null>(null);
  useLayoutEffect(() => {
    const row = rowRef.current;
    if (!row || collapsed || currents.length === 0) { setGeom(null); return; }
    const measure = () => {
      const box = row.getBoundingClientRect();
      const centers: Record<string, number> = {};
      for (const [id, el] of shipRefs.current) {
        const r = el.getBoundingClientRect();
        centers[id] = r.left - box.left + r.width / 2;
      }
      setGeom({ centers, width: row.scrollWidth, height: row.getBoundingClientRect().height });
    };
    measure();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    ro?.observe(row);
    return () => ro?.disconnect();
  }, [collapsed, currents.length, ships.length]);

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
            {/* The route: a single dotted line under the fleet = the one time axis.
                When currents run, the row keeps extra water below the route so
                the arcs have depth to dive into. */}
            <div
              ref={rowRef}
              className={`relative flex items-end gap-3 sm:gap-5 min-w-min py-3 px-1 ${currents.length > 0 ? 'pb-10' : ''}`}
              role="list"
            >
              {/* Dotted route rule — static (no animation to pause). */}
              <div
                aria-hidden
                className={`absolute left-1 right-1 ${currents.length > 0 ? 'bottom-[58px]' : 'bottom-[30px]'} border-t border-dashed border-[var(--bp-ink)]/25`}
              />

              {/* 해류 — undersea currents: a shared premise drawn as an arc
                  diving below the route between the ships that stand on it.
                  Ink-quiet when steady; --warning when its last re-check
                  drifted. A map of facts, never a verdict (거울 조항). */}
              {geom && currents.length > 0 && (
                <svg
                  aria-hidden
                  className="absolute inset-0 z-0 pointer-events-none"
                  width="100%"
                  height="100%"
                  viewBox={`0 0 ${Math.max(1, geom.width)} ${Math.max(1, geom.height)}`}
                  preserveAspectRatio="none"
                >
                  {currents.map((c, ci) => {
                    const xs = c.shipIds
                      .map((id) => geom.centers[id])
                      .filter((x): x is number => typeof x === 'number')
                      .sort((a, b) => a - b);
                    if (xs.length < 2) return null;
                    const routeY = geom.height - 58; // mirrors bottom-[58px]
                    const depth = 18 + ci * 12;
                    const d = xs
                      .slice(0, -1)
                      .map((x1, i) => {
                        const x2 = xs[i + 1];
                        return `M ${x1} ${routeY} Q ${(x1 + x2) / 2} ${routeY + depth} ${x2} ${routeY}`;
                      })
                      .join(' ');
                    return (
                      <path
                        key={c.key}
                        data-testid="fleet-current"
                        data-drifted={c.drifted ? '1' : '0'}
                        d={d}
                        fill="none"
                        stroke={c.drifted ? 'var(--warning)' : 'var(--bp-ink)'}
                        strokeOpacity={c.drifted ? 0.75 : 0.22}
                        strokeWidth={c.drifted ? 1.8 : 1.2}
                      />
                    );
                  })}
                </svg>
              )}

              {ships.map((ship) => {
                const meta = VOYAGE_STATE_META[ship.state];
                const label = L(meta.ko, meta.en);
                const hover = ship.sealedDate ? `${ship.name} · ${ship.sealedDate}` : ship.name;
                return (
                  <button
                    key={ship.id}
                    type="button"
                    role="listitem"
                    ref={(el) => {
                      if (el) shipRefs.current.set(ship.id, el);
                      else shipRefs.current.delete(ship.id);
                    }}
                    onClick={() => (ship.kind === 'receipt' ? onSelectReceipt?.(ship.id) : onSelect(ship.id))}
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
