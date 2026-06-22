// @vitest-environment jsdom
/**
 * CrisisConcernBanner render + conscious-continue (decision 3).
 *
 * The banner is the visible surface of the deterministic crisis backstop. It
 * must: show the concern + resource from formatConcernMessage; offer ONE
 * conscious-continue affordance while blocking (never a hard block); keep the
 * resource pinned after continue; and render nothing when there is no crisis.
 * Real clicks in jsdom — proves the callback fires, not just that text renders.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { CrisisConcernBanner } from '@/components/workspace/progressive/CrisisConcernBanner';
import { formatConcernMessage, type CrisisSignal } from '@/lib/crisis-gate';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;
beforeEach(() => { container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container); });
afterEach(() => { act(() => root.unmount()); container.remove(); });
const render = (el: React.ReactElement) => act(() => { root.render(el); });
const click = (el: Element) => act(() => { el.dispatchEvent(new MouseEvent('click', { bubbles: true })); });

const SELF_HARM: CrisisSignal = { isCrisis: true, category: 'self_harm' };

describe('CrisisConcernBanner', () => {
  it('renders the concern + resource (from formatConcernMessage) while blocking', () => {
    render(createElement(CrisisConcernBanner, { crisis: SELF_HARM, locale: 'ko', blocking: true, onContinue: vi.fn() }));
    // exact concern text comes from the single-source CONCERN map
    expect(container.textContent).toContain(formatConcernMessage('self_harm', 'ko'));
    // the ko self_harm resource line includes the hotline number
    expect(container.textContent).toContain('109');
  });

  it('offers the conscious-continue affordance and fires onContinue', () => {
    const onContinue = vi.fn();
    render(createElement(CrisisConcernBanner, { crisis: SELF_HARM, locale: 'ko', blocking: true, onContinue }));
    const btn = Array.from(container.querySelectorAll('button')).find((b) => (b.textContent || '').includes('계속'));
    expect(btn).toBeTruthy();
    click(btn!);
    expect(onContinue).toHaveBeenCalledTimes(1);
  });

  it('keeps the resource pinned but DROPS the continue button once not blocking', () => {
    render(createElement(CrisisConcernBanner, { crisis: SELF_HARM, locale: 'ko', blocking: false, onContinue: vi.fn() }));
    expect(container.textContent).toContain(formatConcernMessage('self_harm', 'ko')); // resource still there
    const btn = Array.from(container.querySelectorAll('button')).find((b) => (b.textContent || '').includes('계속'));
    expect(btn).toBeUndefined(); // no continue affordance after override
  });

  it('renders in English from the same single source', () => {
    render(createElement(CrisisConcernBanner, { crisis: SELF_HARM, locale: 'en', blocking: true, onContinue: vi.fn() }));
    expect(container.textContent).toContain(formatConcernMessage('self_harm', 'en'));
    expect(container.textContent).toContain('988');
  });

  it('renders nothing when there is no crisis', () => {
    render(createElement(CrisisConcernBanner, { crisis: { isCrisis: false }, locale: 'ko', blocking: true, onContinue: vi.fn() }));
    expect(container.textContent).toBe('');
  });
});
