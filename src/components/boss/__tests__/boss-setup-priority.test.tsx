// @vitest-environment jsdom

import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const bossState = {
  axes: { ei: 'E', sn: 'S', tf: 'T', jp: 'J' },
  gender: '남', birthYear: 0, birthMonth: 0, birthDay: 0, sajuLoading: false,
  userContextHint: '', demoSituation: null,
  setGender: vi.fn(), setBirth: vi.fn(), setUserContextHint: vi.fn(), setDemoSituation: vi.fn(),
  loadSaju: vi.fn(), startChat: vi.fn(), addUserMessage: vi.fn(),
};

vi.mock('@/stores/useBossStore', () => ({ useBossStore: () => bossState }));
vi.mock('@/contexts/LocaleProvider', () => ({ useT: () => (key: string) => key }));
vi.mock('@/hooks/useLocale', () => ({ useLocale: () => 'ko' }));
vi.mock('@/lib/analytics', () => ({ track: vi.fn() }));
vi.mock('@/lib/boss/personality-types', () => ({
  getLocalizedPersonalityType: () => ({
    name: '결론형 팀장', bossVibe: '핵심부터 듣는 편', emoji: 'B', speechPatterns: ['그래서 결론은?'],
    shortDesc: '빠른 판단', triggers: '근거 부족, 일정 지연',
  }),
}));
vi.mock('@/components/ui/AnimatedPlaceholder', () => ({ AnimatedPlaceholder: () => null }));
vi.mock('@/components/boss/BehavioralToggle', () => ({ BehavioralToggle: () => createElement('div', null, '행동 질문') }));
vi.mock('@/components/boss/TypeToggle', () => ({ TypeToggle: () => createElement('div', null, 'MBTI 선택') }));
vi.mock('@/components/boss/SajuPreview', () => ({ SajuPreview: () => null }));
vi.mock('@/components/boss/CollectionProgress', () => ({ CollectionProgress: () => createElement('div', null, '수집 현황') }));
vi.mock('@/components/boss/BossConfirmation', () => ({ BossConfirmation: () => null }));
vi.mock('@/components/workspace/progressive/CrisisConcernBanner', () => ({ CrisisConcernBanner: () => null }));

import { BossSetup } from '@/components/boss/BossSetup';

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

describe('BossSetup task priority', () => {
  it('shows the conversation first and keeps optional profiling collapsed', () => {
    act(() => root.render(createElement(BossSetup)));
    expect(container.querySelector('#bs-situation')).not.toBeNull();
    expect(container.textContent).toContain('어떤 대화를 앞두고 있나요?');
    expect(container.textContent).not.toContain('행동 질문');

    const customize = Array.from(container.querySelectorAll('button')).find((button) => button.textContent?.includes('팀장 반응 더 현실적으로 맞추기'))!;
    expect(customize.getAttribute('aria-expanded')).toBe('false');
    act(() => customize.click());
    expect(container.textContent).toContain('행동 질문');
    expect(customize.getAttribute('aria-expanded')).toBe('true');
  });
});
