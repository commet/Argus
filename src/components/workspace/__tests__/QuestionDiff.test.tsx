// @vitest-environment jsdom
/**
 * QuestionDiff — the before→after reframe contrast. Real jsdom render: proves the
 * struck-through original + emphasized reframe show when they differ, the no-op
 * cases render nothing, and the optional note is gated.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
vi.mock('@/hooks/useLocale', () => ({ useLocale: () => 'ko' }));

import { QuestionDiff } from '@/components/workspace/QuestionDiff';

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

function render(props: Parameters<typeof QuestionDiff>[0]) {
  act(() => root.render(createElement(QuestionDiff, props)));
}

describe('QuestionDiff', () => {
  it('renders the struck-through before and the emphasized after when they differ', () => {
    render({ before: '광고를 어떻게 만들까', after: '왜 지금 광고가 필요한가' });
    const struck = container.querySelector('.line-through');
    expect(struck?.textContent).toBe('광고를 어떻게 만들까');
    expect(container.textContent).toContain('왜 지금 광고가 필요한가');
    expect(container.textContent).toContain('당신의 질문이 바뀌었습니다');
  });

  it('renders nothing when before and after are identical', () => {
    render({ before: 'same question', after: 'same question' });
    expect(container.textContent).toBe('');
  });

  it('renders nothing when they differ only by whitespace/case', () => {
    render({ before: '  Hello   World ', after: 'hello world' });
    expect(container.textContent).toBe('');
  });

  it('renders nothing when after is empty', () => {
    render({ before: 'a real question', after: '' });
    expect(container.textContent).toBe('');
  });

  it('renders nothing when before is empty', () => {
    render({ before: '', after: 'a real question' });
    expect(container.textContent).toBe('');
  });

  it('renders the note only when provided', () => {
    render({ before: 'before q', after: 'after q', note: '숨은 가정 2건 불확실' });
    expect(container.textContent).toContain('숨은 가정 2건 불확실');
  });

  it('omits the note when not provided', () => {
    render({ before: 'before q', after: 'after q' });
    // Only the label + two question lines — no fourth paragraph.
    expect(container.querySelectorAll('p').length).toBe(3);
  });
});
