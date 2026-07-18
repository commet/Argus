// @vitest-environment jsdom

import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import type { ProgressiveSession } from '@/stores/types';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const session = {
  id: 's1',
  problem_text: '신규 요금제를 이번 분기에 출시할까?',
  questions: [{ id: 'q1', text: '가장 중요한 성공 기준은?', type: 'short', engine_phase: 'reframe' }],
  answers: [{ question_id: 'q1', value: '기존 고객 이탈 없이 전환율 12%' }],
  snapshots: [{
    version: 1,
    real_question: '전환율을 검증할 작은 출시 범위는 무엇인가?',
    hidden_assumptions: ['기존 고객은 가격 변화에 민감하지 않다'],
    skeleton: [],
    honesty_flags: [{
      text: '경쟁사도 비슷한 가격을 받고 있다',
      kind: 'world_fact',
      stake: '틀리면 가격 포지션을 다시 잡아야 한다',
      where: '경쟁사 가격표 · 현재 월 요금',
    }],
  }],
  workers: [{
    id: 'w1',
    step_index: 0,
    task: '가격 민감도 분석',
    who: 'ai',
    expected_output: '분석',
    status: 'done',
    persona: { id: 'p1', name: '분석가', nameEn: 'Analyst', role: '리서치', roleEn: 'Research' },
    level: 'senior',
    stream_text: '',
    result: '**핵심 발견**\n현재 자료만으로 기존 고객의 가격 민감도를 단정할 수 없다.',
    human_input: null,
    error: null,
    approved: true,
    completion_note: null,
    started_at: null,
    completed_at: null,
  }],
  mix: {
    title: '요금제 출시안',
    executive_summary: '전체 출시 전에 기존 고객군으로 작은 가격 실험을 한다.',
    sections: [{ heading: '실험', content: '작게 검증한다.', contributor_worker_ids: ['w1'] }],
    key_assumptions: ['기존 고객은 가격 변화에 민감하지 않다'],
    next_steps: [],
  },
} as unknown as ProgressiveSession;

vi.mock('@/hooks/useLocale', () => ({ useLocale: () => 'ko' }));
vi.mock('@/stores/useProgressiveStore', () => ({
  useProgressiveStore: (selector: (state: unknown) => unknown) => selector({ sessions: [session], currentSessionId: 's1' }),
}));

import { DecisionEvidenceMap } from '@/components/workspace/progressive/DecisionEvidenceMap';

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe('DecisionEvidenceMap', () => {
  it('traces the current claim to user input, team analysis, and open checks', () => {
    act(() => root.render(createElement(DecisionEvidenceMap)));
    const text = () => container.textContent || '';

    expect(text()).toContain('전체 출시 전에 기존 고객군으로 작은 가격 실험을 한다.');
    expect(text()).toContain('신규 요금제를 이번 분기에 출시할까?');
    expect(text()).toContain('기존 고객 이탈 없이 전환율 12%');

    const buttons = Array.from(container.querySelectorAll('button'));
    const team = buttons.find((button) => button.textContent?.includes('팀 분석'))!;
    act(() => team.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    expect(text()).toContain('분석가');
    expect(text()).toContain('현재 자료만으로 기존 고객의 가격 민감도를 단정할 수 없다.');

    const checks = Array.from(container.querySelectorAll('button')).find((button) => button.textContent?.includes('아직 확인할 것'))!;
    act(() => checks.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    expect(text()).toContain('경쟁사도 비슷한 가격을 받고 있다');
    expect(text()).toContain('경쟁사 가격표 · 현재 월 요금');
    expect(text()).toContain('문서 전체가 기대는 가정');
  });

  it('emits a canonical locator when a source is opened', () => {
    const listener = vi.fn();
    window.addEventListener('argus:trace-navigate', listener);
    act(() => root.render(createElement(DecisionEvidenceMap)));
    const source = Array.from(container.querySelectorAll('button'))
      .find((button) => button.getAttribute('aria-label') === '처음 적은 상황 원문 보기')!;
    act(() => source.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    expect(listener).toHaveBeenCalledOnce();
    expect((listener.mock.calls[0][0] as CustomEvent).detail).toEqual({ locator: 'argus://workspace/s1/input' });
    window.removeEventListener('argus:trace-navigate', listener);
  });
});
