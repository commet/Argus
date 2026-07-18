'use client';

/**
 * BranchMap — the 해도's branching course-graph (git-graph style). Renders the
 * pure layout from lib/branch-map-layout: colored course-lines per branch,
 * forks as diagonal edges into a new lane, nodes clickable to pick a point.
 *
 * Visual encoding:
 *   - line/node color = owning branch color
 *   - active branch = brighter + thicker; active checkpoint = ringed
 *   - a node that carries a ship's-log waypoint is filled (vs hollow)
 */

import { useMemo, useId } from 'react';
import { layoutBranchMap, BM } from '@/lib/branch-map-layout';
import { useLocale } from '@/hooks/useLocale';
import type { VoyageBranch, VoyageCheckpoint, Waypoint } from '@/stores/types';

interface BranchMapProps {
  checkpoints: VoyageCheckpoint[];
  branches: VoyageBranch[];
  waypoints: Waypoint[];
  activeBranchId: string | null;
  activeCheckpointId: string | null;
  onPick: (checkpointId: string) => void;
}

/** Smooth edge from parent (px,py) down to child (cx,cy). Straight in-lane;
 *  an S-curve when the child sits in a different (fork) lane. */
function edgePath(px: number, py: number, cx: number, cy: number): string {
  if (px === cx) return `M ${px} ${py} L ${cx} ${cy}`;
  const my = (py + cy) / 2;
  return `M ${px} ${py} C ${px} ${my}, ${cx} ${my}, ${cx} ${cy}`;
}

export function BranchMap({
  checkpoints, branches, waypoints, activeBranchId, activeCheckpointId, onPick,
}: BranchMapProps) {
  const locale = useLocale();
  const L = (ko: string, en: string) => (locale === 'ko' ? ko : en);
  const { nodes, width, height } = useMemo(
    () => layoutBranchMap(checkpoints, branches),
    [checkpoints, branches],
  );

  // Unique per-instance grid id — the rail renders one BranchMap inline AND a
  // second inside the 전체 해도 modal, so a hardcoded id would collide (invalid
  // HTML; url(#id) would resolve to whichever appears first). Strip colons from
  // useId() so the value is safe inside an SVG url(#…) reference.
  const gridId = 'bmgrid-' + useId().replace(/:/g, '');

  const byId = useMemo(() => new Map(nodes.map(n => [n.id, n])), [nodes]);
  const waypointCps = useMemo(() => new Set(waypoints.map(w => w.checkpoint_id)), [waypoints]);

  if (nodes.length === 0) return null;

  // Floor the viewBox width so a 1–2 lane voyage doesn't get upscaled into
  // giant nodes when the SVG stretches to the container.
  const vbW = Math.max(width, BM.MIN_VIEW_W);

  return (
    <svg
      width="100%"
      viewBox={`0 0 ${vbW} ${height}`}
      className="overflow-visible"
      preserveAspectRatio="xMinYMin meet"
      // Nodes are interactive (pick to jump) — role="img" would prune them
      // from the a11y tree, so expose the chart as a group instead.
      role="group"
      aria-label={L('결정 갈래 차트', 'Decision branch chart')}
    >
      <defs>
        <pattern id={gridId} width="20" height="20" patternUnits="userSpaceOnUse">
          <path d="M 20 0 L 0 0 0 20" stroke="currentColor" strokeWidth="0.4" fill="none" />
        </pattern>
      </defs>
      <rect x="0" y="0" width={vbW} height={height} fill={`url(#${gridId})`} className="text-[var(--text-tertiary)]" opacity="0.16" />

      {/* Edges — colored by the branch the segment leads into */}
      {nodes.map((n) => {
        if (!n.parentId) return null;
        const p = byId.get(n.parentId);
        if (!p) return null;
        const isActiveBranch = n.branchId === activeBranchId;
        return (
          <path
            key={`e-${n.id}`}
            d={edgePath(p.x, p.y, n.x, n.y)}
            fill="none"
            stroke={n.color}
            strokeWidth={isActiveBranch ? 1.6 : 1.1}
            strokeLinecap="round"
            opacity={isActiveBranch ? 1 : 0.75}
          />
        );
      })}

      {/* Nodes */}
      {nodes.map((n) => {
        const isActiveBranch = n.branchId === activeBranchId;
        const isActiveCp = n.id === activeCheckpointId;
        const hasWaypoint = waypointCps.has(n.id);
        const r = hasWaypoint ? BM.NODE_R : BM.NODE_R - 2;
        return (
          <g key={`n-${n.id}`} className="cursor-pointer" onClick={() => onPick(n.id)}
            role="button" tabIndex={0}
            aria-label={L(`경유지 ${n.id}`, `waypoint ${n.id}`)}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onPick(n.id); } }}>
            {/* active checkpoint ring */}
            {isActiveCp && (
              <circle cx={n.x} cy={n.y} r={r + 3.5} fill="none" stroke={n.color} strokeWidth="1.2" opacity="0.5" />
            )}
            <circle
              cx={n.x}
              cy={n.y}
              r={r}
              fill={hasWaypoint ? n.color : 'var(--surface)'}
              stroke={n.color}
              strokeWidth={isActiveBranch ? 1.6 : 1.2}
            />
            {/* invisible larger hit area */}
            <circle cx={n.x} cy={n.y} r={BM.NODE_R + 7} fill="transparent" />
          </g>
        );
      })}
    </svg>
  );
}
