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
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useLocale } from '@/hooks/useLocale';
import type { Waypoint, WaypointType } from '@/stores/types';

export const WP_META: Record<WaypointType, { Icon: LucideIcon; color: string; ko: string; en: string }> = {
  departure:     { Icon: Sailboat,      color: 'var(--text-secondary)', ko: '출항',      en: 'Departure' },
  course_change: { Icon: Milestone,     color: 'var(--accent)',         ko: '침로 변경',  en: 'Course change' },
  reef:          { Icon: AlertTriangle, color: '#b4541e',               ko: '암초',      en: 'Reef' },
  sighting:      { Icon: Eye,           color: '#2d6b8a',               ko: '관측',      en: 'Sighting' },
  headwind:      { Icon: Wind,          color: '#6b4c9a',               ko: '역풍',      en: 'Headwind' },
  helm:          { Icon: Hand,          color: '#8a6d2d',               ko: '선장의 키',  en: 'Helm' },
  anchorage:     { Icon: Anchor,        color: '#2d6b2d',               ko: '정박',      en: 'Anchorage' },
};

/* ── The narration body, shared by the timeline row (expanded) and the card ── */
export function WaypointDetail({
  waypoint, assumptions, locked, onTakeRoad,
}: {
  waypoint: Waypoint;
  assumptions: string[];
  locked: boolean;
  onTakeRoad: (checkpointId: string, label: string) => void;
}) {
  const locale = useLocale();
  const L = (ko: string, en: string) => (locale === 'ko' ? ko : en);
  const notTaken = (waypoint.alternatives || []).filter(a => !a.taken);

  return (
    <div className="space-y-1.5">
      {waypoint.significance && (
        <p className="text-[11px] leading-[1.5] text-[var(--text-secondary)]">{waypoint.significance}</p>
      )}
      {waypoint.trigger && (
        <p className="text-[11px] leading-[1.5] text-[var(--text-secondary)]">
          <span className="font-semibold">{L('계기', 'Trigger')}:</span> {waypoint.trigger}
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
            onClick={() => onTakeRoad(waypoint.checkpoint_id, alt.label)}
            disabled={locked}
            className={`mt-0.5 inline-flex items-center gap-1 text-[10px] font-semibold text-[var(--accent)] hover:underline cursor-pointer ${locked ? 'opacity-40 cursor-not-allowed' : ''}`}
          >
            <GitBranch size={9} /> {L('이 길 가보기', 'Sail this path')}
          </button>
        </div>
      ))}
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
    </div>
  );
}

/* ── A standalone, always-open card: type chip + headline + body + action ── */
export function WaypointCard({
  waypoint, assumptions, locked, onTakeRoad, action, eyebrow,
}: {
  waypoint: Waypoint;
  assumptions: string[];
  locked: boolean;
  onTakeRoad: (checkpointId: string, label: string) => void;
  action?: React.ReactNode;
  /** Optional small label above the type (e.g. "지금" for the current turn). */
  eyebrow?: string;
}) {
  const locale = useLocale();
  const meta = WP_META[waypoint.type];
  const { Icon } = meta;
  const emphasize = waypoint.type === 'course_change';

  return (
    <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] px-3 py-2.5">
      <div className="flex items-start gap-2">
        <span
          className="shrink-0 flex items-center justify-center rounded-full mt-0.5"
          style={{
            width: 19, height: 19,
            background: 'var(--bg)',
            boxShadow: emphasize ? `0 0 0 2px ${meta.color}40` : `0 0 0 1px ${meta.color}30`,
          }}
        >
          <Icon size={emphasize ? 13 : 12} style={{ color: meta.color }} strokeWidth={2} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-1.5">
            {eyebrow && (
              <span className="shrink-0 text-[8.5px] font-bold uppercase tracking-[0.14em] text-[var(--accent)]">
                {eyebrow}
              </span>
            )}
            <span className="text-[9px] font-bold uppercase tracking-[0.1em]" style={{ color: meta.color }}>
              {locale === 'ko' ? meta.ko : meta.en}
            </span>
          </div>
          <div className={`mt-0.5 text-[12px] leading-[1.4] text-[var(--text-primary)] ${emphasize ? 'font-semibold' : ''}`}>
            {waypoint.headline}
          </div>
        </div>
      </div>

      <div className="mt-2">
        <WaypointDetail waypoint={waypoint} assumptions={assumptions} locked={locked} onTakeRoad={onTakeRoad} />
      </div>

      {action && <div className="mt-2.5">{action}</div>}
    </div>
  );
}
