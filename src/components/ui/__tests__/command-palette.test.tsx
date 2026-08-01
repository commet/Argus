// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { Search } from 'lucide-react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));

import { CommandPalette, type CommandPaletteItem } from '@/components/ui/CommandPalette';
import { Field } from '@/components/ui/Field';

let container: HTMLDivElement;
let root: Root;
const items: CommandPaletteItem[] = [
  { href: '/workspace', label: '워크스페이스', description: '결정 시작', group: '핵심', icon: Search },
];

beforeEach(() => {
  push.mockReset();
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

const renderPalette = () => act(() => {
  root.render(<CommandPalette open onClose={vi.fn()} locale="ko" items={items} />);
});

const key = (element: Element, value: string, isComposing = false) => act(() => {
  element.dispatchEvent(new KeyboardEvent('keydown', { key: value, bubbles: true, isComposing }));
});

describe('CommandPalette — search-first keyboard flow', () => {
  it('matches the modal padding at mobile and desktop widths', () => {
    renderPalette();
    const panel = document.querySelector('.-m-4.sm\\:-m-6');
    expect(panel).toBeTruthy();
  });

  it('focuses the search field and gives it an accessible name', async () => {
    renderPalette();
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 20)); });
    const input = document.querySelector('[role="combobox"]') as HTMLInputElement;
    expect(input.getAttribute('aria-label')).toBe('페이지와 기능 검색');
    expect(document.activeElement).toBe(input);
    expect(document.querySelector('button[aria-label="빠른 이동 닫기"]')).toBeTruthy();
  });

  it('does not navigate when Enter only confirms an IME composition', () => {
    renderPalette();
    const input = document.querySelector('[role="combobox"]')!;
    key(input, 'Enter', true);
    expect(push).not.toHaveBeenCalled();
    key(input, 'Enter', false);
    expect(push).toHaveBeenCalledWith('/ko/workspace');
  });

  it('keeps arrow navigation safe when a query has no results', () => {
    renderPalette();
    const input = document.querySelector('[role="combobox"]') as HTMLInputElement;
    const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
    act(() => {
      valueSetter.call(input, '없는 페이지');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    key(input, 'ArrowDown');
    expect(input.hasAttribute('aria-activedescendant')).toBe(false);
    expect(document.querySelector('[role="status"]')?.textContent).toContain('일치하는 항목이 없어요');
  });
});

describe('Field — help and error association', () => {
  it('preserves caller descriptions while attaching its own error message', () => {
    act(() => { root.render(<><p id="external-help">외부 도움말</p><Field aria-describedby="external-help" label="상황" error="필수 입력" /></>); });
    const field = container.querySelector('textarea')!;
    const describedBy = field.getAttribute('aria-describedby') || '';
    expect(describedBy).toContain('external-help');
    expect(describedBy.split(' ')).toHaveLength(2);
    expect(field.getAttribute('aria-invalid')).toBe('true');
    expect(container.querySelector('[role="alert"]')?.textContent).toBe('필수 입력');
  });
});
