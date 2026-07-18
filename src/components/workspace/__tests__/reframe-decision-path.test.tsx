// @vitest-environment jsdom

import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
vi.mock('@/hooks/useLocale', () => ({ useLocale: () => 'ko' }));

import { ReframeDecisionPath } from '@/components/workspace/ReframeDecisionPath';

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

describe('ReframeDecisionPath', () => {
  it('keeps unavailable stages inert and routes available stages to exact sections', () => {
    const onJump = vi.fn();
    act(() => root.render(createElement(ReframeDecisionPath, {
      assumptionCount: 3,
      reviewedCount: 2,
      hasQuestion: false,
      hasDirection: false,
      onJump,
    })));

    const buttons = Array.from(container.querySelectorAll('button'));
    expect(buttons.find((button) => button.textContent?.includes('질문 제안'))?.disabled).toBe(true);
    act(() => buttons.find((button) => button.textContent?.includes('가정 점검'))!.click());
    expect(onJump).toHaveBeenCalledWith('assumptions');
  });

  it('distinguishes the AI proposal from the user-selected direction', () => {
    act(() => root.render(createElement(ReframeDecisionPath, {
      assumptionCount: 2,
      reviewedCount: 2,
      hasQuestion: true,
      hasDirection: true,
      onJump: vi.fn(),
    })));
    expect(container.textContent).toContain('AI가 재구성');
    expect(container.textContent).toContain('사용자 선택 완료');
  });
});
