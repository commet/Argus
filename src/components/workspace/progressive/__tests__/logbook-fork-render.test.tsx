/**
 * Logbook generic fork affordance — every turn (except the anchorage, and
 * except course-changes which use their road-not-taken) offers "fork a new
 * course here", so the core "go back & choose differently" is discoverable
 * right where the user reads their history.
 */

import { describe, it, expect, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import type { ProgressiveSession, VoyageCheckpoint, Waypoint, VoyageCheckpointState } from '@/stores/types';

const emptyState = (): VoyageCheckpointState => ({
  phase: 'conversing', round: 0, questions: [], answers: [], snapshots: [],
  workers: [], worker_deploy_phase: 'none', mix: null, dm_feedback: null,
  final_deliverable: null, final_mix: null, user_notes: null, decision_maker: null, lead_synthesis: null,
});
const checkpoints: VoyageCheckpoint[] = [
  { id: 'c1', parent_id: null, stage: 'origin', label: 'o', created_at: '2026-01-01T00:00:01.000Z', state_snapshot: emptyState() },
  { id: 'c2', parent_id: 'c1', stage: 'briefing', label: 'b', created_at: '2026-01-01T00:00:02.000Z', state_snapshot: emptyState() },
];
// last waypoint is a reef (no alternatives, not anchorage) → opens by default → generic fork shows
const waypoints: Waypoint[] = [
  { id: 'w1', checkpoint_id: 'c1', type: 'departure', headline: '출항', created_at: 'a' },
  { id: 'w2', checkpoint_id: 'c2', type: 'reef', headline: '가정이 좌초됨', created_at: 'b' },
];
const session: ProgressiveSession = {
  id: 's1', project_id: 'p1', problem_text: 'x', decision_maker: null,
  phase: 'conversing', round: 0, max_rounds: 5, questions: [], answers: [], snapshots: [], workers: [],
  worker_deploy_phase: 'none', mix: null, dm_feedback: null, final_deliverable: null,
  checkpoints, active_checkpoint_id: 'c2', waypoints,
  branches: [{ id: 'm', name: '본 항로', head_checkpoint_id: 'c2', forked_from_checkpoint_id: null, status: 'sailing', color: '#2d4a7c', created_at: 'a' }],
  active_branch_id: 'm', created_at: 'a', updated_at: 'b',
};

vi.mock('@/stores/useProgressiveStore', () => ({
  useProgressiveStore: (selector: (s: unknown) => unknown) => selector({
    sessions: [session], currentSessionId: 's1',
    switchBranch: () => {}, anchorBranch: () => {}, forkBranch: () => null,
    deleteBranch: () => {}, isBranchingLocked: () => false,
  }),
}));
vi.mock('@/hooks/useLocale', () => ({ useLocale: () => 'ko' }));
vi.mock('@/components/workspace/progressive/VoyageChart', () => ({ VoyageChart: () => null }));

import { Logbook } from '@/components/workspace/progressive/Logbook';

describe('Logbook generic fork', () => {
  it('offers "fork a new course here" on a non-anchorage turn without alternatives', () => {
    const html = renderToStaticMarkup(createElement(Logbook));
    expect(html).toContain('이 시점에서 다른 길로');
  });
});
