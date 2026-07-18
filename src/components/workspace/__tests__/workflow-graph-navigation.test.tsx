// @vitest-environment jsdom

import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { RecastStep } from '@/stores/types';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
vi.mock('@/hooks/useLocale', () => ({ useLocale: () => 'ko' }));

import { WorkflowGraph } from '@/components/workspace/WorkflowGraph';

const steps: RecastStep[] = [
  { task: '자료 정리', actor: 'ai', actor_reasoning: '반복 작업', expected_output: '초안', checkpoint: false, checkpoint_reason: '' },
  { task: '출시 판단', actor: 'human', actor_reasoning: '책임자가 선택해야 함', expected_output: '결정', checkpoint: true, checkpoint_reason: '최종 승인' },
];

let container: HTMLDivElement;
let root: Root;
const scrollIntoView = vi.fn();

beforeEach(() => {
  vi.useFakeTimers();
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: scrollIntoView });
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.useRealTimers();
  scrollIntoView.mockClear();
});

describe('WorkflowGraph navigation', () => {
  it('jumps from a role legend to the exact expanded step', () => {
    act(() => root.render(createElement(WorkflowGraph, { steps, analysis: null, editable: true })));
    const human = container.querySelector('button[aria-label="사람 단계 1개 중 첫 단계로 이동"]') as HTMLButtonElement;
    act(() => {
      human.click();
      vi.runAllTimers();
    });
    expect(container.querySelector('#recast-step-1')?.textContent).toContain('책임자가 선택해야 함');
    expect(scrollIntoView).toHaveBeenCalled();
  });

  it('jumps from the checkpoint summary to the first checkpoint', () => {
    act(() => root.render(createElement(WorkflowGraph, { steps, analysis: null })));
    const checkpoint = Array.from(container.querySelectorAll('button')).find((button) => button.textContent?.includes('체크포인트 1'))!;
    act(() => {
      checkpoint.click();
      vi.runAllTimers();
    });
    expect(scrollIntoView).toHaveBeenCalled();
  });
});
