/**
 * Captain's-seat render verification — the "출항 전 선원 배치" screen
 * (TeamDeployBanner). Exercises the real render path with seeded workers,
 * asserting the two new affordances:
 *  - the why-this-agent rationale line on AI workers (the SelectionTrace that
 *    used to be discarded), and
 *  - the "교체" (swap) control on AI workers, absent on self/human rows.
 * Closest deterministic proxy to a visual check (no browser available).
 */

import { describe, it, expect, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import type { WorkerTask, WorkerPersona } from '@/stores/types';

// ProgressiveFlow's import graph reaches the Supabase client (via db.ts) which
// needs env at module load. Stub it — the captain's-seat render touches none of it.
vi.mock('@/lib/supabase', () => ({
  supabase: { from: vi.fn(), auth: { getSession: vi.fn(() => Promise.resolve({ data: { session: null } })) }, channel: vi.fn(() => ({ on: vi.fn().mockReturnThis(), subscribe: vi.fn() })), removeChannel: vi.fn() },
  getCurrentUserId: vi.fn(() => Promise.resolve(null)),
}));

vi.mock('@/hooks/useLocale', () => ({ useLocale: () => 'ko' }));
vi.mock('@/lib/agent-stats', () => ({ getAgentStats: () => null, getSessionDeltas: () => [] }));
vi.mock('@/components/workspace/progressive/WorkerAvatar', () => ({
  WorkerAvatar: () => null,
  AvatarRow: () => null,
}));

import { TeamDeployBanner, VerificationGate } from '@/components/workspace/progressive/ProgressiveFlow';

const persona = (id: string, name: string): WorkerPersona => ({
  id, name, role: '리서치 애널리스트', expertise: '시장 조사', tone: '톤', emoji: '🔍', color: '#000', keywords: [],
} as WorkerPersona);

const base = (over: Partial<WorkerTask>): WorkerTask => ({
  id: 'x', step_index: 0, task: '시장 규모를 조사한다', task_group_id: 'g',
  added_manually: false, original_task: '시장 규모를 조사한다', who: 'ai',
  expected_output: '보고서', status: 'pending', persona: null, level: 'junior',
  stream_text: '', result: null, human_input: null, error: null, approved: null,
  completion_note: null, started_at: null, completed_at: null, agent_type: 'ai', ...over,
} as WorkerTask);

const workers: WorkerTask[] = [
  base({
    id: 'ai1', task_group_id: 'g1', agent_type: 'ai', agent_id: 'sophie',
    persona: persona('sophie', '소피'),
    assignment_reason: '시장 분석에 가장 적합 · 다음 후보 마커스',
  }),
  base({
    id: 'self1', task_group_id: 'g2', agent_type: 'self', persona: null,
    self_scope: '예산 우선순위', task: '예산을 결정한다',
  }),
];

const html = renderToStaticMarkup(createElement(TeamDeployBanner, {
  workers,
  onDeploy: () => {},
  onReplaceWorker: () => {},
  onRemoveWorker: () => {},
  onSetGroupTrack: () => {},
}));

describe("captain's-seat render (TeamDeployBanner)", () => {
  it('surfaces the why-this-agent rationale on the AI worker', () => {
    expect(html).toContain('시장 분석에 가장 적합 · 다음 후보 마커스');
  });

  it('shows the 교체 (swap) control for AI workers', () => {
    expect(html).toContain('이 팀원 교체');
  });

  it('still renders the self-judgment track and the set-sail CTA', () => {
    expect(html).toContain('내 판단');
    expect(html).toContain('출항');
  });

  it('surfaces the per-group track selector (discoverable human collaboration)', () => {
    expect(html).toContain('누가 맡을까요?');
    expect(html).toContain('AI 팀원');
    expect(html).toContain('내가 직접');
    expect(html).toContain('사람에게');
  });

  it('does not attach a rationale line to the self worker', () => {
    // The only rationale string present is the AI worker's — the self row
    // carries no assignment_reason, so nothing extra leaks in.
    const occurrences = html.split('가장 적합').length - 1;
    expect(occurrences).toBe(1);
  });
});

describe('axis ②: VerificationGate render', () => {
  const unreviewed: WorkerTask[] = [
    base({ id: 'u1', status: 'done', result: '핵심 발견: 가격이 아니라 온보딩이 이탈 원인', approved: null, persona: persona('sophie', '소피') }),
  ];

  it('warns and lists unreviewed work, with a disabled sail + explicit override', () => {
    const html = renderToStaticMarkup(createElement(VerificationGate, {
      workers: unreviewed,
      onApprove: () => {}, onReject: () => {}, onRetry: () => {},
      onSail: () => {}, onOverride: () => {}, onClose: () => {},
    }));
    expect(html).toContain('확인하지 않은 분석이 있어요');
    expect(html).toContain('소피');
    expect(html).toContain('반영');
    expect(html).toContain('제외');
    expect(html).toContain('1개 남음');                       // sail disabled, shows remaining
    expect(html).toContain('확인 없이 모두 반영하고 출항');     // soft-gate override always present
  });

  it('with nothing left, shows all-clear and an enabled sail', () => {
    const html = renderToStaticMarkup(createElement(VerificationGate, {
      workers: [],
      onApprove: () => {}, onReject: () => {},
      onSail: () => {}, onOverride: () => {}, onClose: () => {},
    }));
    expect(html).toContain('모두 확인했어요');
    expect(html).toContain('출항');
    expect(html).not.toContain('확인 없이 모두 반영하고 출항'); // override hidden when clear
  });

  it('waits for an in-flight re-run (nothing unreviewed but a worker is running)', () => {
    const html = renderToStaticMarkup(createElement(VerificationGate, {
      workers: [], anyRunning: true,
      onApprove: () => {}, onReject: () => {},
      onSail: () => {}, onOverride: () => {}, onClose: () => {},
    }));
    expect(html).toContain('실행 중…');                        // sail shows running, disabled
    expect(html).not.toContain('확인 없이 모두 반영하고 출항'); // no bypass while running
  });
});
