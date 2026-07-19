// @vitest-environment jsdom

import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ProjectAttentionItem } from '@/lib/project-attention';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
vi.mock('@/hooks/useLocale', () => ({ useLocale: () => 'ko' }));

import { ProjectAttentionList } from '@/components/projects/ProjectAttentionList';

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

describe('ProjectAttentionList', () => {
  it('keeps a long list quiet until expanded and emits the exact source locator', () => {
    const items: ProjectAttentionItem[] = Array.from({ length: 7 }, (_, index) => ({
      id: `row-${index}`,
      kind: 'premise_recheck',
      title: `전제 ${index}`,
      context: `프로젝트 ${index}`,
      locator: `argus://project/p${index}/item/i${index}`,
      projectId: `p${index}`,
      ageDays: 30 + index,
      affected: [{ id: `p${index}`, label: `프로젝트 ${index}`, scope: 'project' }],
    }));
    const listener = vi.fn();
    window.addEventListener('argus:trace-navigate', listener);

    act(() => root.render(createElement(ProjectAttentionList, { items })));
    expect(container.textContent).toContain('전제 4');
    expect(container.textContent).not.toContain('전제 5');

    const more = Array.from(container.querySelectorAll('button')).find((button) => button.textContent?.includes('2건 더 보기'))!;
    act(() => more.click());
    expect(container.textContent).toContain('전제 6');

    const source = Array.from(container.querySelectorAll('button')).find((button) => button.textContent?.includes('전제 6'))!;
    act(() => source.click());
    expect((listener.mock.calls[0][0] as CustomEvent).detail).toEqual({ locator: 'argus://project/p6/item/i6' });
    window.removeEventListener('argus:trace-navigate', listener);
  });

  it('locates a decision on the chart while keeping exact-source navigation separate', () => {
    const item: ProjectAttentionItem = {
      id: 'row-focus',
      kind: 'premise_recheck',
      title: '온보딩 이탈률 전제',
      context: '리텐션 결정',
      locator: 'argus://project/p-focus/item/i-focus',
      projectId: 'p-focus',
      affected: [{ id: 'p-focus', label: '리텐션 결정', scope: 'project' }],
    };
    const onFocusItem = vi.fn();
    const listener = vi.fn();
    window.addEventListener('argus:trace-navigate', listener);

    act(() => root.render(createElement(ProjectAttentionList, {
      items: [item],
      focusedDecisionId: 'p-focus',
      focusedAttentionId: 'row-focus',
      onFocusItem,
    })));

    const locate = container.querySelector('[aria-label="전제 재확인 해도에서 찾기"]') as HTMLButtonElement;
    expect(locate.getAttribute('aria-pressed')).toBe('true');
    act(() => locate.click());
    expect(onFocusItem).toHaveBeenCalledWith(item, 'p-focus');

    const source = container.querySelector('[aria-label="전제 재확인 정확한 근거 위치 열기"]') as HTMLButtonElement;
    act(() => source.click());
    expect((listener.mock.calls[0][0] as CustomEvent).detail).toEqual({ locator: item.locator });
    window.removeEventListener('argus:trace-navigate', listener);
  });
});
