'use client';

/**
 * WaypointCard — the single home of a decision-turn's narration.
 *
 * Step 4 of the voyage redesign unifies 해도 + 항해일지 into one surface: the
 * spatial chart IS the surface, and tapping a point reveals THIS card. Before,
 * the same waypoint was rendered twice — once as a chart node, once as a row in
 * a parallel Logbook list — which read as "the same thing, twice" (the mess the
 * founder flagged). Now the narration lives in exactly one place:
 *
 *   - WP_META          — the per-type icon/label/color table (shared).
 *   - WaypointDetail    — the narration BODY (significance, trigger, roads-not-
 *                         taken + "이 길 가보기", assumptions drill-down). Reused
 *                         by the Logbook timeline's expanded row AND the card.
 *   - WaypointCard      — a standalone, always-open bordered card: type chip +
 *                         headline + WaypointDetail + an optional action slot
 *                         (e.g. the chart's "이 지점에서 항해" rewind button).
 *                         Used by the rail (current turn) and the full 해도
 *                         (the tapped node).
 *
 * Spine (CLAUDE.md zero-judgment): this surfaces what happened — the turn, its
 * trigger, the road not taken — and offers navigation handles. It renders no
 * verdict, no weighted pole, no convergence score.
 */

import {
  Sailboat, Milestone, AlertTriangle, Eye, Wind, Anchor, ChevronDown, GitBranch, Hand,
  CornerDownRight, Zap,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useLocale } from '@/hooks/useLocale';
import type { Waypoint, WaypointType } from '@/stores/types';

export const WP_META: Record<WaypointType, { Icon: LucideIcon; color: string; ko: string; en: string }> = {
  departure:     { Icon: Sailboat,      color: 'var(--text-secondary)', ko: '시작',       en: 'Start' },
  course_change: { Icon: Milestone,     color: 'var(--accent)',         ko: '방향 변경',   en: 'Direction change' },
  reef:          { Icon: AlertTriangle, color: '#b4541e',               ko: '위험',       en: 'Risk' },
  sighting:      { Icon: Eye,           color: '#2d6b8a',               ko: '발견',       en: 'Finding' },
  headwind:      { Icon: Wind,          color: '#6b4c9a',               ko: '제약',       en: 'Constraint' },
  helm:          { Icon: Hand,          color: '#8a6d2d',               ko: '사용자 결정', en: 'User decision' },
  anchorage:     { Icon: Anchor,        color: '#2d6b2d',               ko: '완료',       en: 'Completed' },
};

/* ── The narration body, shared by the timeline row (expanded) and the card ── */
export function WaypointDetail({
  waypoint, assumptions, locked, onTakeRoad, dense = false,
}: {
  waypoint: Waypoint;
  assumptions: string[];
  locked: boolean;
  onTakeRoad: (checkpointId: string, label: string) => void;
  /** 공정 5-5 텍스트 다이어트 — the rail is a MAP, not an essay: in the narrow
   *  side rail the narration folds behind one details toggle so the branch
   *  handle ("이 길 가보기") stays the visible thing. The full-chart modal keeps
   *  the open narration (dense=false). */
  dense?: boolean;
}) {
  const locale = useLocale();
  const L = (ko: string, en: string) => (locale === 'ko' ? ko : en);
  const notTaken = (waypoint.alternatives || []).filter(a => !a.taken);
  const hasNarration = !!(waypoint.significance || waypoint.trigger);
  const hasMore = notTaken.length > 0 || assumptions.length > 0;

  const narration = hasNarration && (
    <>
      {waypoint.significance && (
        <p className="text-[13px] leading-[1.55] text-[var(--text-secondary)]">{waypoint.significance}</p>
      )}
      {waypoint.trigger && (
        <p className="flex items-start gap-1.5 text-[12.5px] leading-[1.5] text-[var(--text-tertiary)]">
          <Zap size={11} className="mt-[1.5px] shrink-0 text-[var(--text-tertiary)]" />
          <span><span className="font-semibold text-[var(--text-secondary)]">{L('계기', 'Trigger')}</span> · {waypoint.trigger}</span>
        </p>
      )}
    </>
  );

  return (
    <div className="space-y-2">
      {/* Narration — open in the full chart; folded to one line in the rail. */}
      {dense && hasNarration ? (
        <details className="group/n">
          <summary className="text-[12px] text-[var(--text-tertiary)] cursor-pointer hover:text-[var(--accent)] list-none flex items-center gap-1">
            <ChevronDown size={9} className="transition-transform group-open/n:rotate-180" />
            {L('왜 이 갈림길인가', 'Why this turn')}
          </summary>
          <div className="mt-1.5 space-y-2">{narration}</div>
        </details>
      ) : narration}

      {/* Divider between "what happened" and the branch handle / drill-down */}
      {!dense && hasNarration && hasMore && <div className="h-px bg-[var(--border-subtle)]/70" />}

      {/* Roads not taken — each a distinct inset affordance: the option you were
          offered, why it was set aside, and a real button to go sail it now. */}
      {notTaken.map((alt, j) => (
        <div key={j} className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg)] px-2.5 py-2">
          <div className="mb-1 flex items-center gap-1 text-[12.5px] font-bold uppercase tracking-[0.1em] text-[var(--text-tertiary)]">
            <CornerDownRight size={10} /> {L('보류한 선택지', 'Options set aside')}
          </div>
          <p className={`text-[12.5px] leading-[1.45] text-[var(--text-secondary)] ${dense ? 'line-clamp-2' : ''}`}>
            <span className="font-medium italic text-[var(--text-primary)]">{alt.label}</span>
            {alt.why_abandoned && alt.why_abandoned_source === 'user' && (
              <span className="text-[var(--text-tertiary)]"> — {alt.why_abandoned}</span>
            )}
          </p>
          <button
            onClick={() => onTakeRoad(waypoint.checkpoint_id, alt.label)}
            disabled={locked}
            className={`mt-2 inline-flex items-center gap-1 rounded-md border border-[var(--accent)]/35 px-2 py-1 text-[12px] font-semibold text-[var(--accent)] transition-colors hover:bg-[var(--accent)]/10 cursor-pointer ${locked ? 'opacity-40 cursor-not-allowed' : ''}`}
          >
            <GitBranch size={10} /> {L('이 길 가보기', 'Sail this path')}
          </button>
        </div>
      ))}

      {assumptions.length > 0 && (
        <details className="group/d">
          <summary className="text-[12px] text-[var(--text-tertiary)] cursor-pointer hover:text-[var(--accent)] list-none flex items-center gap-1">
            <ChevronDown size={9} className="transition-transform group-open/d:rotate-180" />
            {L(`이 시점의 가정 ${assumptions.length}`, `${assumptions.length} assumptions in play`)}
          </summary>
          <ul className="mt-1 space-y-0.5 pl-2">
            {assumptions.map((a, k) => (
              <li key={k} className="text-[12.5px] leading-[1.5] text-[var(--text-secondary)] flex gap-1">
                <span className="text-[var(--text-tertiary)] shrink-0">·</span><span>{a}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

/* ── A standalone, always-open card: type chip + headline + body + action ── */
export function WaypointCard({
  waypoint, assumptions, locked, onTakeRoad, action, eyebrow, dense = false,
}: {
  waypoint: Waypoint;
  assumptions: string[];
  locked: boolean;
  onTakeRoad: (checkpointId: string, label: string) => void;
  action?: React.ReactNode;
  /** Optional small label above the type (e.g. "지금" for the current turn). */
  eyebrow?: string;
  /** Rail-side text diet — clamp the headline, fold the narration. */
  dense?: boolean;
}) {
  const locale = useLocale();
  const meta = WP_META[waypoint.type];
  const { Icon } = meta;

  return (
    <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] px-3.5 py-3">
      {/* Meta row — a tinted type chip (icon + label) on the left, a solid
          "지금" status pill on the right. Clear, distinct roles instead of two
          cramped micro-labels. */}
      <div className="flex items-center justify-between gap-2 mb-2">
        <span
          className="inline-flex items-center gap-1.5 rounded-md px-2 py-1"
          style={{ background: `color-mix(in srgb, ${meta.color} 13%, transparent)`, color: meta.color }}
        >
          <Icon size={12} strokeWidth={2.2} />
          <span className="text-[12px] font-bold tracking-tight">{locale === 'ko' ? meta.ko : meta.en}</span>
        </span>
        {eyebrow && (
          <span className="shrink-0 inline-flex items-center rounded-full bg-[var(--accent)] px-2 py-[3px] text-[12.5px] font-bold uppercase tracking-[0.12em] text-white">
            {eyebrow}
          </span>
        )}
      </div>

      {/* Headline — the focal point of the card. In the rail it clamps to two
          lines (full text lives one tap away in the 전체 해도). */}
      <div
        className={`text-[14px] leading-[1.4] font-semibold text-[var(--text-primary)] ${dense ? 'line-clamp-2' : ''}`}
        title={dense ? waypoint.headline : undefined}
      >
        {waypoint.headline}
      </div>

      <div className="mt-2.5">
        <WaypointDetail waypoint={waypoint} assumptions={assumptions} locked={locked} onTakeRoad={onTakeRoad} dense={dense} />
      </div>

      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}
