/**
 * voyage-nav — the single source of truth for "what happens when you tap a
 * point on the 해도 (chart)".
 *
 * Tapping a past checkpoint is one user intent — "go back there" — but it
 * resolves to one of two mechanics, and the OLD code decided silently inside
 * `navigateToCheckpoint` so the confirm dialog couldn't tell the user which it
 * would be (it always said "new course", even when it actually just returned to
 * a path already sailed). This pure resolver lets BOTH the store action and the
 * chart's confirm copy read the same decision, so the action is explicit.
 *
 *   - fork   → the point is on the course you're already sailing (or shared
 *              ancestry); continuing from it diverges into a new line.
 *   - switch → the point belongs to another course you already explored;
 *              returning to it is just stepping back onto that line.
 *   - noop   → it's where you already are.
 */

import { getActivePath } from './version-tree';
import type { VoyageCheckpoint, VoyageBranch } from '@/stores/types';

export type CheckpointNav =
  | { action: 'noop' }
  | { action: 'fork'; fromCheckpointId: string }
  | { action: 'switch'; branchId: string };

export function resolveCheckpointNav(
  checkpoints: VoyageCheckpoint[],
  branches: VoyageBranch[],
  activeBranchId: string | null | undefined,
  activeCheckpointId: string | null | undefined,
  checkpointId: string,
): CheckpointNav {
  if (!checkpointId || checkpointId === activeCheckpointId) return { action: 'noop' };

  const active = branches.find(b => b.id === activeBranchId) ?? null;
  const activeIds = active
    ? new Set(getActivePath(checkpoints, active.head_checkpoint_id).map(c => c.id))
    : new Set<string>();

  // On the current course (including shared ancestry) → fork to diverge here.
  if (activeIds.has(checkpointId)) return { action: 'fork', fromCheckpointId: checkpointId };

  // Belongs to another existing course → switch to that branch.
  const owning = branches.find(b =>
    b.id !== activeBranchId &&
    getActivePath(checkpoints, b.head_checkpoint_id).some(c => c.id === checkpointId));
  if (owning) return { action: 'switch', branchId: owning.id };

  // Unowned point (e.g. a freshly-forked head with no divergent checkpoint) → fork.
  return { action: 'fork', fromCheckpointId: checkpointId };
}
