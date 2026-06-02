/**
 * branchHeadSummary — distills a course's head for comparison.
 */

import { describe, it, expect } from 'vitest';
import { branchHeadSummary } from '@/lib/branch-summary';
import type { VoyageBranch, VoyageCheckpoint, VoyageCheckpointState, Waypoint } from '@/stores/types';

const base = (over: Partial<VoyageCheckpointState>): VoyageCheckpointState => ({
  phase: 'conversing', round: 0, questions: [], answers: [], snapshots: [],
  workers: [], worker_deploy_phase: 'none', mix: null, dm_feedback: null,
  final_deliverable: null, final_mix: null, user_notes: null, decision_maker: null, lead_synthesis: null,
  ...over,
});
const cp = (id: string, parent: string | null, t: string, st: VoyageCheckpointState): VoyageCheckpoint =>
  ({ id, parent_id: parent, stage: 'briefing', label: id, created_at: t, state_snapshot: st });

describe('branchHeadSummary', () => {
  it('summarizes the head snapshot: question, top-3 assumptions, turns, hasFinal', () => {
    const checkpoints = [
      cp('c1', null, 't1', base({ snapshots: [{ version: 0, real_question: '초기 질문', hidden_assumptions: [], skeleton: [] }] })),
      cp('c2', 'c1', 't2', base({
        snapshots: [{ version: 1, real_question: '이탈의 진짜 원인은?', hidden_assumptions: ['a', 'b', 'c', 'd'], skeleton: [] }],
        final_deliverable: '완성 문서',
      })),
    ];
    const branch: VoyageBranch = { id: 'm', name: '본 항로', head_checkpoint_id: 'c2', forked_from_checkpoint_id: null, status: 'sailing', color: '#000', created_at: 'a' };
    const waypoints: Waypoint[] = [
      { id: 'w1', checkpoint_id: 'c1', type: 'departure', headline: 'x', created_at: 'a' },
      { id: 'w2', checkpoint_id: 'c2', type: 'course_change', headline: 'y', created_at: 'b' },
      { id: 'wX', checkpoint_id: 'off', type: 'reef', headline: 'off-path', created_at: 'c' },
    ];

    const s = branchHeadSummary(checkpoints, waypoints, branch);
    expect(s.realQuestion).toBe('이탈의 진짜 원인은?');
    expect(s.assumptions).toEqual(['a', 'b', 'c']); // top 3
    expect(s.turns).toBe(2); // only on-path waypoints (wX excluded)
    expect(s.hasFinal).toBe(true);
    expect(s.name).toBe('본 항로');
  });

  it('handles a head with no snapshot gracefully', () => {
    const checkpoints = [cp('c1', null, 't1', base({}))];
    const branch: VoyageBranch = { id: 'm', name: 'm', head_checkpoint_id: 'c1', forked_from_checkpoint_id: null, status: 'sailing', color: '#000', created_at: 'a' };
    const s = branchHeadSummary(checkpoints, [], branch);
    expect(s.realQuestion).toBe('');
    expect(s.assumptions).toEqual([]);
    expect(s.turns).toBe(0);
    expect(s.hasFinal).toBe(false);
  });
});
