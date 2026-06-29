/**
 * Logbook does NOT manufacture a fork on a flat point. A waypoint with no real
 * road-not-taken must not offer a generic "fork a new course here" — that invents
 * a branch the analysis never surfaced (spine: zero-judgment / mirror clause).
 * Rewind-from-anywhere lives in the chart; real roads-not-taken keep their own
 * "이 길 가보기".
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
  branches: [{ id: 'm', name: '본 항로', head_checkpoint_id: 'c2', forked_from_checkpoint_id: null, color: '#2d4a7c', created_at: 'a' }],
  active_branch_id: 'm', created_at: 'a', updated_at: 'b',
};

vi.mock('@/stores/useProgressiveStore', () => ({
  useProgressiveStore: (selector: (s: unknown) => unknown) => selector({
    sessions: [session], currentSessionId: 's1',
    switchBranch: () => {}, forkBranch: () => null,
    isBranchingLocked: () => false,
  }),
}));
vi.mock('@/hooks/useLocale', () => ({ useLocale: () => 'ko' }));
vi.mock('@/components/workspace/progressive/VoyageChart', () => ({ VoyageChart: () => null }));

import { Logbook } from '@/components/workspace/progressive/Logbook';

describe('Logbook does not manufacture a fork on a flat point', () => {
  it('does NOT offer a generic "fork a new course here" on a turn without real alternatives', () => {
    const html = renderToStaticMarkup(createElement(Logbook));
    expect(html).not.toContain('이 시점에서 다른 길로');
  });
});
