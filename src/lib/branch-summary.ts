/**
 * Branch comparison summary — distills a course-line's *head* into the few
 * things you weigh when choosing between explored courses: the question it
 * settled on, the assumptions still in play, how many turns it took, and
 * whether it reached a deliverable. Pure, so it's unit-testable.
 */

import { getActivePath } from '@/lib/version-tree';
import type { VoyageBranch, VoyageCheckpoint, Waypoint, BranchStatus } from '@/stores/types';

export interface BranchSummary {
  id: string;
  name: string;
  color: string;
  status: BranchStatus;
  realQuestion: string;
  assumptions: string[];
  turns: number;
  hasFinal: boolean;
}

export function branchHeadSummary(
  checkpoints: VoyageCheckpoint[],
  waypoints: Waypoint[],
  branch: VoyageBranch,
): BranchSummary {
  const path = getActivePath(checkpoints, branch.head_checkpoint_id);
  const pathIds = new Set(path.map(c => c.id));
  const head = path[path.length - 1];
  const snap = head?.state_snapshot.snapshots.slice(-1)[0];
  return {
    id: branch.id,
    name: branch.name,
    color: branch.color,
    status: branch.status,
    realQuestion: snap?.real_question || '',
    assumptions: (snap?.hidden_assumptions || []).slice(0, 3),
    turns: waypoints.filter(w => pathIds.has(w.checkpoint_id)).length,
    hasFinal: !!head?.state_snapshot.final_deliverable,
  };
}
