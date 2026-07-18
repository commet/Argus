/**
 * Logbook render verification — exercises the real component's render path with
 * seeded session data (no browser available), asserting the actual DOM output:
 * the ship's-log header, typed waypoints, branch chips, anchor verb, and the
 * road-not-taken fork affordance. This is the closest deterministic proxy to a
 * visual check.
 */

import { describe, it, expect, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import type {
  ProgressiveSession, VoyageBranch, VoyageCheckpoint, Waypoint, VoyageCheckpointState,
} from '@/stores/types';

// ── Build a realistic session: 2 checkpoints, 2 branches, departure +
//    course-change (last, so it's expanded by default and its alternatives show).
const emptyState = (): VoyageCheckpointState => ({
  phase: 'conversing', round: 0, questions: [], answers: [], snapshots: [],
  workers: [], worker_deploy_phase: 'none', mix: null, dm_feedback: null,
  final_deliverable: null, final_mix: null, user_notes: null, decision_maker: null, lead_synthesis: null,
});
const c2State = (): VoyageCheckpointState => ({
  ...emptyState(),
  snapshots: [{ version: 1, real_question: '이탈의 진짜 원인은?', hidden_assumptions: ['이탈은 가격 때문이다', '챗봇이 이탈을 막는다'], skeleton: [] }],
});
const checkpoints: VoyageCheckpoint[] = [
  { id: 'c1', parent_id: null, stage: 'origin', label: 'o', created_at: '2026-01-01T00:00:01.000Z', state_snapshot: emptyState() },
  { id: 'c2', parent_id: 'c1', stage: 'briefing', label: 'b', created_at: '2026-01-01T00:00:02.000Z', state_snapshot: c2State() },
];
const branches: VoyageBranch[] = [
  { id: 'b-main', name: '본 항로', head_checkpoint_id: 'c2', forked_from_checkpoint_id: null, color: '#2d4a7c', created_at: 'x' },
  { id: 'b-fork', name: '챗봇 분기', head_checkpoint_id: 'c1', forked_from_checkpoint_id: 'c1', color: '#8b6914', created_at: 'y' },
];
const waypoints: Waypoint[] = [
  { id: 'w1', checkpoint_id: 'c1', type: 'departure', headline: '경쟁사처럼 챗봇 만들기', created_at: 'x' },
  {
    id: 'w2', checkpoint_id: 'c2', type: 'course_change', headline: '이탈의 진짜 원인은?',
    trigger: '질문: 누가 결정? → CFO', created_at: 'y',
    alternatives: [
      { label: '챗봇 직접 제작', why_abandoned: '이탈 원인 미검증', why_abandoned_source: 'user', taken: false },
      { label: '이탈 원인 분석 선행', why_abandoned: '', taken: true },
    ],
  },
];
const session: ProgressiveSession = {
  id: 's1', project_id: 'p1', problem_text: '경쟁사처럼 챗봇 만들어',
  decision_maker: null, phase: 'conversing', round: 0, max_rounds: 5,
  questions: [], answers: [], snapshots: [], workers: [], worker_deploy_phase: 'none',
  mix: null, dm_feedback: null, final_deliverable: null,
  checkpoints, active_checkpoint_id: 'c2', branches, active_branch_id: 'b-main', waypoints,
  created_at: 'x', updated_at: 'y',
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

import { Logbook, LogbookDrawer } from '@/components/workspace/progressive/Logbook';

describe('Logbook render', () => {
  const html = renderToStaticMarkup(createElement(Logbook));

  it('renders the ship\'s-log header and the full-chart entry point', () => {
    expect(html).toContain('결정 기록');
    expect(html).toContain('전체 해도');
  });

  it('renders typed waypoints with their headlines', () => {
    expect(html).toContain('시작');
    expect(html).toContain('방향 변경');
    expect(html).toContain('경쟁사처럼 챗봇 만들기');
    expect(html).toContain('이탈의 진짜 원인은?');
  });

  it('is read-only narration of the active course — no branch chips / anchor (step 3a)', () => {
    // Managing named courses (switch / anchor / delete) moved out of the log: it
    // now only narrates the active course. Returning to an explored course lives
    // in the 해도; exploring a road-not-taken keeps its own "이 길 가보기" below.
    expect(html).not.toContain('챗봇 분기');      // non-active course chip gone
    expect(html).not.toContain('이 항로로 확정');   // anchor verb gone
  });

  it('renders the road-not-taken with a fork affordance on the open course-change', () => {
    expect(html).toContain('보류한 선택지');
    expect(html).toContain('챗봇 직접 제작');
    expect(html).toContain('이 길 가보기');
    // the "taken" alternative is not shown as a road not taken
    expect(html).not.toContain('이탈 원인 분석 선행');
  });

  it('renders the handed trigger on the open waypoint', () => {
    expect(html).toContain('계기');
    expect(html).toContain('CFO');
  });

  it('renders the drill-down assumptions for the checkpoint of the open waypoint', () => {
    expect(html).toContain('이 시점의 가정');
    expect(html).toContain('챗봇이 이탈을 막는다');
  });
});

describe('LogbookDrawer (mobile)', () => {
  it('renders a collapsed bar with the waypoint count', () => {
    const html = renderToStaticMarkup(createElement(LogbookDrawer, { offset: false }));
    expect(html).toContain('결정 기록');
    expect(html).toContain('>2<'); // waypoint count badge
  });
});
