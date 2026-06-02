/**
 * Branch-map layout — pure geometry for the 해도's branching course-graph.
 *
 * Git-graph style: time flows downward (one row per checkpoint, chronological),
 * each branch gets a vertical lane (column), and a fork is a diagonal edge from
 * the parent's lane into the child's lane. Kept as a pure function so the
 * coordinates can be unit-tested without rendering (this is how we "see" the
 * chart without a browser).
 *
 * Lane assignment: branches are ordered (main/trunk first, then by creation),
 * and each checkpoint is claimed by the LOWEST-lane branch whose lineage
 * contains it. So shared ancestry stays in the trunk lane and only the
 * fork-exclusive checkpoints sit in a fork's lane — exactly the git-graph shape.
 */

import { getActivePath } from '@/lib/version-tree';
import type { VoyageBranch, VoyageCheckpoint, VoyageStage } from '@/stores/types';

export const BM = {
  LANE_W: 28,   // horizontal gap between lanes
  ROW_H: 40,    // vertical gap between checkpoints
  LEFT: 22,     // left margin (lane 0 x)
  TOP: 20,      // top margin (row 0 y)
  NODE_R: 6,    // node radius
  RIGHT_PAD: 18,
  BOTTOM: 20,
} as const;

export interface BranchMapNode {
  id: string;
  parentId: string | null;
  x: number;
  y: number;
  lane: number;
  branchId: string | null;
  color: string;
  isHead: boolean;          // a branch head (leaf)
  stage: VoyageStage;
  label: string;
}

export interface BranchMapLayout {
  nodes: BranchMapNode[];
  width: number;
  height: number;
  laneByBranch: Record<string, number>;
}

export function layoutBranchMap(
  checkpoints: VoyageCheckpoint[],
  branches: VoyageBranch[],
): BranchMapLayout {
  if (checkpoints.length === 0) {
    return { nodes: [], width: BM.LEFT * 2, height: BM.TOP * 2, laneByBranch: {} };
  }

  // Trunk first, then by creation — gives stable, readable lane order.
  const ordered = [...branches].sort((a, b) => {
    const aTrunk = a.forked_from_checkpoint_id == null;
    const bTrunk = b.forked_from_checkpoint_id == null;
    if (aTrunk !== bTrunk) return aTrunk ? -1 : 1;
    return (a.created_at || '').localeCompare(b.created_at || '');
  });

  const laneByBranch: Record<string, number> = {};
  ordered.forEach((b, i) => { laneByBranch[b.id] = i; });

  // Claim each checkpoint to the lowest-lane branch that contains it.
  const cpLane = new Map<string, number>();
  const cpBranch = new Map<string, string>();
  ordered.forEach((b, lane) => {
    for (const c of getActivePath(checkpoints, b.head_checkpoint_id)) {
      if (!cpLane.has(c.id)) { cpLane.set(c.id, lane); cpBranch.set(c.id, b.id); }
    }
  });

  const headIds = new Set(branches.map(b => b.head_checkpoint_id));
  const colorByBranch = new Map(branches.map(b => [b.id, b.color]));

  // One row per checkpoint, chronological (parents precede children).
  const sorted = [...checkpoints].sort((a, b) => (a.created_at || '').localeCompare(b.created_at || ''));
  const rowOf = new Map(sorted.map((c, i) => [c.id, i]));

  const nodes: BranchMapNode[] = sorted.map((c) => {
    const lane = cpLane.get(c.id) ?? 0;
    const branchId = cpBranch.get(c.id) ?? null;
    return {
      id: c.id,
      parentId: c.parent_id,
      lane,
      x: BM.LEFT + lane * BM.LANE_W,
      y: BM.TOP + (rowOf.get(c.id) ?? 0) * BM.ROW_H,
      branchId,
      color: (branchId && colorByBranch.get(branchId)) || 'var(--text-tertiary)',
      isHead: headIds.has(c.id),
      stage: c.stage,
      label: c.label,
    };
  });

  const maxLane = nodes.reduce((m, n) => Math.max(m, n.lane), 0);
  const width = BM.LEFT + maxLane * BM.LANE_W + BM.NODE_R + BM.RIGHT_PAD;
  const height = BM.TOP + (sorted.length - 1) * BM.ROW_H + BM.BOTTOM;

  return { nodes, width, height, laneByBranch };
}
