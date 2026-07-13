// @vitest-environment jsdom

import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FirstSettlementCard } from '@/components/projects/FirstSettlementCard';
import { JudgmentReceipt } from '@/components/projects/JudgmentReceipt';
import type { JudgmentReceipt as JudgmentReceiptType } from '@/stores/types';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('project record inputs', () => {
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

  it('does not save a settlement while Korean IME composition is active', () => {
    const onSave = vi.fn();
    const receipt = { what_happened: '' } as JudgmentReceiptType;
    act(() => {
      root.render(createElement(JudgmentReceipt, {
        mode: 'settle',
        receipt,
        sealedOn: '2026-07-01',
        whatHappened: '실제 결과',
        onWhatHappenedChange: vi.fn(),
        onSave,
        locale: 'ko',
      }));
    });

    const input = container.querySelector('[aria-label="실제로 일어난 일"]')!;
    act(() => input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, isComposing: true })));
    expect(onSave).not.toHaveBeenCalled();

    act(() => input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })));
    expect(onSave).toHaveBeenCalledWith('실제 결과');
  });

  it('gives the optional reflection note a stable accessible name', () => {
    act(() => {
      root.render(createElement(FirstSettlementCard, {
        anchor: '이 방향이 맞다',
        ko: true,
        onRecord: vi.fn(),
      }));
    });

    expect(container.querySelector('[aria-label="돌아보기 메모"]')).toBeTruthy();
  });
});
