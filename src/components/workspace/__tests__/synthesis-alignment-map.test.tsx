// @vitest-environment jsdom

import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SynthesizeItem } from '@/stores/types';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
vi.mock('@/hooks/useLocale', () => ({ useLocale: () => 'ko' }));

import { SynthesisAlignmentMap } from '@/components/workspace/SynthesisAlignmentMap';

const item: SynthesizeItem = {
  id: 'synth-one', raw_input: '', final_synthesis: '', status: 'review', created_at: '', updated_at: '',
  sources: [
    { name: '재무안', content: '# 현황\n현재 유료 전환율은 8%다.' },
    { name: '제품안', content: '# 실험\n온보딩 화면을 두 단계 줄인다.' },
  ],
  analysis: {
    sources_summary: [
      { name: '재무안', core_claim: '현재 유료 전환율은 8%다.' },
      { name: '제품안', core_claim: '온보딩 화면을 두 단계 줄인다.' },
    ],
    agreements: ['작은 실험부터 시작한다.'],
    conflicts: [{
      id: 'scope', topic: '투자 범위',
      side_a: { source: '재무안', position: '현재 유료 전환율은 8%다.' },
      side_b: { source: '제품안', position: '온보딩 화면을 두 단계 줄인다.' },
      analysis: '',
    }],
    questions_for_user: [],
  },
};

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
  document.body.querySelector('[role="dialog"]')?.remove();
});

describe('SynthesisAlignmentMap', () => {
  it('opens a source at the matched line and routes a conflict to judgment', () => {
    const onSelectConflict = vi.fn();
    act(() => root.render(createElement(SynthesisAlignmentMap, { item, onSelectConflict })));

    const source = Array.from(container.querySelectorAll('button')).find((button) => button.textContent?.includes('현재 유료 전환율은 8%다.'))!;
    act(() => source.click());
    const dialog = document.body.querySelector('[role="dialog"]')!;
    expect(dialog.textContent).toContain('원문 직접 일치');
    expect(dialog.querySelector('[data-highlighted="true"]')?.textContent).toContain('현재 유료 전환율은 8%다.');

    act(() => (dialog.querySelector('button[aria-label="닫기"]') as HTMLButtonElement).click());
    const conflict = container.querySelector('button[aria-label="투자 범위 판단으로 이동"]') as HTMLButtonElement;
    act(() => conflict.click());
    expect(onSelectConflict).toHaveBeenCalledWith('scope');
  });
});
