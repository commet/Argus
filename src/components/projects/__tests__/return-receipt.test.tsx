// @vitest-environment jsdom

import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { JudgmentReceipt } from '@/components/projects/JudgmentReceipt';
import type { JudgmentReceipt as JudgmentReceiptType } from '@/stores/types';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const receipt: JudgmentReceiptType = {
  real_question: 'Can we learn safely by launching now?',
  unverified_assumption: 'Early retention will justify expansion',
  human_only: 'Whether incomplete evidence is acceptable',
  human_judgment: 'Launch a limited pilot, then expand only at 30% retention.',
};

describe('return receipt progressive disclosure', () => {
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

  it('puts the user-authored judgment first and keeps supporting context collapsed', () => {
    act(() => {
      root.render(createElement(JudgmentReceipt, {
        mode: 'settle',
        section: 'anchor',
        receipt,
        sealedOn: 'July 20',
        whatHappened: '',
        onWhatHappenedChange: vi.fn(),
        locale: 'en',
      }));
    });

    expect(container.textContent).toContain(receipt.human_judgment);
    expect(container.querySelector('details')).toBeTruthy();
    expect(container.querySelector('details')?.open).toBe(false);
    expect(container.querySelector('input')).toBeNull();
  });

  it('keeps the reality note optional and separate from the structured outcome', () => {
    act(() => {
      root.render(createElement(JudgmentReceipt, {
        mode: 'settle',
        section: 'outcome',
        outcomeRecorded: true,
        receipt,
        sealedOn: 'July 20',
        whatHappened: '',
        onWhatHappenedChange: vi.fn(),
        onSave: vi.fn(),
        locale: 'en',
      }));
    });

    const input = container.querySelector<HTMLInputElement>('[aria-label="What actually happened"]');
    expect(input).toBeTruthy();
    expect(input?.maxLength).toBe(280);
    expect(container.textContent).toContain('Your outcome choice is already saved');
    expect(container.textContent).toContain('AI VERDICT -- NONE');
    expect(container.textContent).not.toContain(receipt.human_judgment);
  });

  it('lets the author remove a previously saved reality note', () => {
    const onClear = vi.fn();
    const saved = { ...receipt, what_happened: 'Week-two retention was 24%.' };
    act(() => {
      root.render(createElement(JudgmentReceipt, {
        mode: 'settle',
        section: 'outcome',
        outcomeRecorded: true,
        receipt: saved,
        sealedOn: 'July 20',
        whatHappened: saved.what_happened,
        onWhatHappenedChange: vi.fn(),
        onSave: vi.fn(),
        onClear,
        locale: 'en',
      }));
    });

    const remove = Array.from(container.querySelectorAll('button'))
      .find((button) => button.textContent?.includes('Remove this note'));
    expect(remove).toBeTruthy();
    act(() => remove?.click());
    expect(onClear).toHaveBeenCalledTimes(1);
  });
});
