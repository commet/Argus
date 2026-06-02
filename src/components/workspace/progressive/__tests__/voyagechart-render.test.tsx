/**
 * VoyageChart render smoke test — confirms the chart renders without throwing
 * after the navigateToCheckpoint rewiring, given a seeded multi-checkpoint
 * session. Catches selector/markup regressions the type-checker can't.
 */

import { describe, it, expect, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import type { ProgressiveSession, VoyageCheckpoint, VoyageCheckpointState } from '@/stores/types';

const emptyState = (): VoyageCheckpointState => ({
  phase: 'conversing', round: 0, questions: [], answers: [], snapshots: [],
  workers: [], worker_deploy_phase: 'none', mix: null, dm_feedback: null,
  final_deliverable: null, final_mix: null, user_notes: null, decision_maker: null, lead_synthesis: null,
});
const checkpoints: VoyageCheckpoint[] = [
  { id: 'c1', parent_id: null, stage: 'origin', label: '출발', created_at: '2026-01-01T00:00:01.000Z', state_snapshot: emptyState() },
  { id: 'c2', parent_id: 'c1', stage: 'briefing', label: '항해 준비 1', created_at: '2026-01-01T00:00:02.000Z', state_snapshot: emptyState() },
];
const session: Partial<ProgressiveSession> = {
  id: 's1', checkpoints, active_checkpoint_id: 'c2',
  branches: [{ id: 'b-main', name: '본 항로', head_checkpoint_id: 'c2', forked_from_checkpoint_id: null, status: 'sailing', color: '#2d4a7c', created_at: 'x' }],
  active_branch_id: 'b-main',
};

vi.mock('@/stores/useProgressiveStore', () => ({
  useProgressiveStore: (selector: (s: unknown) => unknown) => selector({
    sessions: [session], currentSessionId: 's1', navigateToCheckpoint: () => {},
  }),
}));
vi.mock('@/hooks/useLocale', () => ({ useLocale: () => 'ko' }));

import { VoyageChart } from '@/components/workspace/progressive/VoyageChart';

describe('VoyageChart render', () => {
  it('renders the chart with seeded checkpoints without throwing', () => {
    const html = renderToStaticMarkup(createElement(VoyageChart));
    expect(html.length).toBeGreaterThan(100);
    expect(html).toContain('출발');     // origin stage label
    expect(html).toContain('항해 준비'); // briefing stage label
  });
});
