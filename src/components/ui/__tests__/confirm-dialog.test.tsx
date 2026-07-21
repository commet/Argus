// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock('@/hooks/useLocale', () => ({ useLocale: () => 'en' }));

import { ConfirmDialog } from '@/components/ui/ConfirmDialog';

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  document.body.innerHTML = '';
});

describe('ConfirmDialog', () => {
  it('focuses the safe action and confirms only through the explicit danger button', async () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    act(() => root.render(
      <ConfirmDialog
        open
        title="Delete record?"
        description="This cannot be undone."
        confirmLabel="Delete record"
        cancelLabel="Cancel"
        onConfirm={onConfirm}
        onCancel={onCancel}
        dangerous
      />,
    ));
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 20)); });

    const cancel = document.querySelector('button:nth-last-of-type(2)') as HTMLButtonElement;
    expect(document.querySelector('[role="dialog"]')).toBeTruthy();
    expect(document.activeElement).toBe(cancel);

    const danger = Array.from(document.querySelectorAll('button')).find((button) => button.textContent === 'Delete record') as HTMLButtonElement;
    act(() => danger.click());
    expect(onConfirm).toHaveBeenCalledOnce();
    expect(onCancel).not.toHaveBeenCalled();
  });

  it('treats Escape as cancellation', () => {
    const onCancel = vi.fn();
    act(() => root.render(
      <ConfirmDialog open title="Confirm" description="Check" confirmLabel="Continue" cancelLabel="Cancel" onConfirm={vi.fn()} onCancel={onCancel} />,
    ));
    act(() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
    expect(onCancel).toHaveBeenCalledOnce();
  });
});
