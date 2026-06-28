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
  { id: 'c3', parent_id: 'c1', stage: 'briefing', label: '분기 항로', created_at: '2026-01-01T00:00:03.000Z', state_snapshot: emptyState() },
];
const session: Partial<ProgressiveSession> = {
  id: 's1', checkpoints, active_checkpoint_id: 'c2',
  branches: [
    { id: 'b-main', name: '본 항로', head_checkpoint_id: 'c2', forked_from_checkpoint_id: null, status: 'sailing', color: '#2d4a7c', created_at: 'x' },
    { id: 'b-fork', name: '챗봇 분기', head_checkpoint_id: 'c3', forked_from_checkpoint_id: 'c1', status: 'sailing', color: '#8b6914', created_at: 'y' },
  ],
  active_branch_id: 'b-main',
};

vi.mock('@/stores/useProgressiveStore', () => ({
  useProgressiveStore: (selector: (s: unknown) => unknown) => selector({
    sessions: [session], currentSessionId: 's1', navigateToCheckpoint: () => {},
    switchBranch: () => {}, anchorBranch: () => {}, deleteBranch: () => {}, renameBranch: () => {}, isBranchingLocked: () => false,
  }),
}));
vi.mock('@/hooks/useLocale', () => ({ useLocale: () => 'ko' }));

import { VoyageChart } from '@/components/workspace/progressive/VoyageChart';

describe('VoyageChart render', () => {
  it('renders the sea-chart (parchment + compass + course) without throwing', () => {
    const html = renderToStaticMarkup(createElement(VoyageChart));
    expect(html.length).toBeGreaterThan(100);
    expect(html).toContain('<circle');             // chart nodes + compass rose
    expect(html).toContain('결정 항해 해도');        // SeaChart aria-label
    expect(html).toContain('#2d4a7c');             // main branch color (course list dot)
    expect(html).toContain('#8b6914');             // fork branch color (course list dot)
  });

  it('shows the active-course summary when multiple branches exist', () => {
    const html = renderToStaticMarkup(createElement(VoyageChart));
    expect(html).toContain('본 항로');      // active branch name
    expect(html).toContain('항로 2개');     // course count
  });

  it('lists explored courses with only the "return to this path" control — no branch ceremony', () => {
    const html = renderToStaticMarkup(createElement(VoyageChart));
    expect(html).toContain('항로 목록');       // course list header
    expect(html).toContain('챗봇 분기');       // the non-active explored course
    expect(html).toContain('지금 이 길');       // current-course marker
    expect(html).toContain('이 길로');          // the one kept control: return to this path
    // Branch-management ceremony is gone (rename / compare / anchor / delete).
    expect(html).not.toContain('이름 변경');
    expect(html).not.toContain('활성 항로와 비교');
  });
});
