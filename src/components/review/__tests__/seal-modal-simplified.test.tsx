// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
vi.mock('@/hooks/useLocale', () => ({ useLocale: () => 'ko' }));
vi.mock('framer-motion', () => ({ useReducedMotion: () => true }));

import { SealModal } from '@/components/review/SealModal';
import type { FalsifiableFollowup } from '@/lib/review';

const FOLLOWUPS: FalsifiableFollowup[] = [
  {
    followup_id: 'f1',
    predicate: '주간 리텐션율이 35% 이상인가?',
    predicate_owner: 'ai_surfaced',
    pass_condition: '최근 4주 평균이 35% 이상',
    fail_condition: '35% 미만이거나 하락 추세',
    check_by: '2099-08-15',
  },
  {
    followup_id: 'f2',
    predicate: '통제 실험이 완료되었는가?',
    predicate_owner: 'ai_surfaced',
    pass_condition: '실험 결과가 문서화됨',
    fail_condition: '실험이 시작되지 않음',
    check_by: '2099-09-01',
  },
];

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

describe('SealModal simplified judgment recording', () => {
  it('shows only the check question and date as primary fields', () => {
    act(() => {
      root.render(createElement(SealModal, {
        obligation: { statement: '35% 미달 시 롤아웃 중단 여부를 결정한다.' },
        followups: FOLLOWUPS,
        onSeal: vi.fn(),
        onClose: vi.fn(),
      }));
    });

    expect(container.textContent).toContain('내 판단으로 기록하기');
    expect(container.textContent).toContain('나중에 무엇을 확인할까요?');
    expect(container.textContent).toContain('언제 다시 확인할까요?');
    expect(container.textContent).not.toContain('소유');
    expect(container.textContent).not.toContain(FOLLOWUPS[0].pass_condition);
    expect(container.querySelector('[role="dialog"]')).not.toBeNull();
  });

  it('reveals judgment criteria only when requested', () => {
    act(() => {
      root.render(createElement(SealModal, {
        obligation: { statement: '35% 미달 시 롤아웃 중단 여부를 결정한다.' },
        followups: FOLLOWUPS,
        onSeal: vi.fn(),
        onClose: vi.fn(),
      }));
    });

    const toggle = [...container.querySelectorAll('button')]
      .find((button) => button.textContent?.includes('판단 기준 더하기'));
    expect(toggle).toBeTruthy();
    act(() => toggle?.dispatchEvent(new MouseEvent('click', { bubbles: true })));

    expect((container.querySelector('#record-pass') as HTMLInputElement | null)?.value).toBe(FOLLOWUPS[0].pass_condition);
    expect((container.querySelector('#record-fail') as HTMLInputElement | null)?.value).toBe(FOLLOWUPS[0].fail_condition);
  });
});
