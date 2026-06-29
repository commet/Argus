/**
 * Branch-map layout — numeric verification of the git-graph geometry (this is
 * how we "see" the chart without a browser): lane assignment, row ordering,
 * finite coordinates, trunk-stays-lane-0, fork-gets-its-own-lane.
 */

import { describe, it, expect } from 'vitest';
import { layoutBranchMap, BM } from '@/lib/branch-map-layout';
import type { VoyageBranch, VoyageCheckpoint, VoyageCheckpointState } from '@/stores/types';

const st = (): VoyageCheckpointState => ({
  phase: 'conversing', round: 0, questions: [], answers: [], snapshots: [],
  workers: [], worker_deploy_phase: 'none', mix: null, dm_feedback: null,
  final_deliverable: null, final_mix: null, user_notes: null, decision_maker: null, lead_synthesis: null,
});
const c = (id: string, parent: string | null, t: string): VoyageCheckpoint => ({
  id, parent_id: parent, stage: 'briefing', label: id, created_at: t, state_snapshot: st(),
});

describe('layoutBranchMap', () => {
  it('lays out a trunk + one fork as two lanes, time flowing down', () => {
    // c1 ← c2 (main head),  c1 ← c3 (fork head)
    const checkpoints = [
      c('c1', null, '2026-01-01T00:00:01Z'),
      c('c2', 'c1', '2026-01-01T00:00:02Z'),
      c('c3', 'c1', '2026-01-01T00:00:03Z'),
    ];
    const branches: VoyageBranch[] = [
      { id: 'main', name: '본 항로', head_checkpoint_id: 'c2', forked_from_checkpoint_id: null, color: '#2d4a7c', created_at: 'a' },
      { id: 'fork', name: '분기', head_checkpoint_id: 'c3', forked_from_checkpoint_id: 'c1', color: '#8b6914', created_at: 'b' },
    ];
    const { nodes, width, height, laneByBranch } = layoutBranchMap(checkpoints, branches);

    expect(laneByBranch).toEqual({ main: 0, fork: 1 });
    const byId = Object.fromEntries(nodes.map(n => [n.id, n]));
    // trunk + main child in lane 0; fork-exclusive child in lane 1
    expect(byId.c1.lane).toBe(0);
    expect(byId.c2.lane).toBe(0);
    expect(byId.c3.lane).toBe(1);
    // chronological rows → increasing y
    expect(byId.c1.y).toBeLessThan(byId.c2.y);
    expect(byId.c2.y).toBeLessThan(byId.c3.y);
    // fork lane sits to the right of trunk
    expect(byId.c3.x).toBeGreaterThan(byId.c1.x);
    expect(byId.c3.x).toBe(BM.LEFT + BM.LANE_W);
    // heads flagged
    expect(byId.c2.isHead).toBe(true);
    expect(byId.c3.isHead).toBe(true);
    expect(byId.c1.isHead).toBe(false);
    // colors from owning branch
    expect(byId.c2.color).toBe('#2d4a7c');
    expect(byId.c3.color).toBe('#8b6914');
    // sane canvas
    expect(Number.isFinite(width) && width > 0).toBe(true);
    expect(Number.isFinite(height) && height > 0).toBe(true);
    nodes.forEach(n => { expect(Number.isFinite(n.x) && Number.isFinite(n.y)).toBe(true); });
  });

  it('keeps a single linear voyage entirely in lane 0', () => {
    const checkpoints = [
      c('c1', null, '2026-01-01T00:00:01Z'),
      c('c2', 'c1', '2026-01-01T00:00:02Z'),
    ];
    const branches: VoyageBranch[] = [
      { id: 'main', name: 'm', head_checkpoint_id: 'c2', forked_from_checkpoint_id: null, color: '#2d4a7c', created_at: 'a' },
    ];
    const { nodes } = layoutBranchMap(checkpoints, branches);
    expect(nodes.every(n => n.lane === 0)).toBe(true);
  });

  it('returns an empty canvas for no checkpoints', () => {
    expect(layoutBranchMap([], []).nodes).toHaveLength(0);
  });
});
