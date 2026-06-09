// @vitest-environment jsdom
/**
 * Falsification ("시험한다") — real jsdom interaction. Proves the flinch path, the
 * no-flinch fallback, the active real_bet gate, and the resolved shape handed to
 * onResolve (which the parent persists + feeds the Decision Contract).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
vi.mock('@/hooks/useLocale', () => ({ useLocale: () => 'en' }));

import { Falsification } from '@/components/workspace/progressive/Falsification';
import type { LoadBearingClaim } from '@/stores/types';

const claims: LoadBearingClaim[] = [
  { id: 'c1', text: 'Plausible win', overreached: true },
  { id: 'c2', text: 'Bolder win', overreached: true },
  { id: 'c3', text: 'Grandiose win', overreached: true },
];

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

function mount(props: Parameters<typeof Falsification>[0]) {
  act(() => root.render(createElement(Falsification, props)));
}
function click(el: Element | null | undefined) {
  act(() => el?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
}
function setTextarea(value: string) {
  const ta = container.querySelector('textarea') as HTMLTextAreaElement;
  const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!;
  setter.call(ta, value);
  act(() => ta.dispatchEvent(new Event('input', { bubbles: true })));
}
const buttonByText = (t: string) =>
  [...container.querySelectorAll('button')].find((b) => b.textContent?.includes(t));

describe('Falsification', () => {
  it('renders the strength, frame, and the full claim ladder', () => {
    mount({ strength: 'Real strength here', claims, onResolve: vi.fn(), onRequestHighestLoad: vi.fn() });
    expect(container.textContent).toContain('Real strength here');
    expect(container.textContent).toContain('stop me where you stop believing');
    expect(container.textContent).toContain('Plausible win');
    expect(container.textContent).toContain('Grandiose win');
  });

  it('flinch → surfaces the flinched claim and gates the CTA until a bet is written', () => {
    const onResolve = vi.fn();
    mount({ strength: 's', claims, onResolve, onRequestHighestLoad: vi.fn() });

    click(buttonByText('Bolder win')); // flinch at claim 2
    expect(container.textContent).toContain('This is where you stopped');
    expect(container.textContent).toContain('Bolder win');

    const cta = buttonByText('Seal this');
    expect((cta as HTMLButtonElement).disabled).toBe(true); // gated

    setTextarea('I am betting users will act');
    expect((buttonByText('Seal this') as HTMLButtonElement).disabled).toBe(false);

    click(buttonByText('Seal this'));
    expect(onResolve).toHaveBeenCalledTimes(1);
    expect(onResolve.mock.calls[0][0]).toMatchObject({
      flinched_id: 'c2',
      surfaced_constraint: 'Bolder win',
      real_bet: 'I am betting users will act',
      no_flinch_fallback: false,
    });
  });

  it('"use this wording" fills the bet from the surfaced constraint', () => {
    const onResolve = vi.fn();
    mount({ strength: 's', claims, onResolve, onRequestHighestLoad: vi.fn() });
    click(buttonByText('Plausible win'));
    click(buttonByText('Use this wording'));
    click(buttonByText('Seal this'));
    expect(onResolve.mock.calls[0][0].real_bet).toBe('Plausible win');
  });

  it('no-flinch → asks the engine for the highest-load pick and marks the fallback', async () => {
    const onResolve = vi.fn();
    const onRequestHighestLoad = vi.fn().mockResolvedValue({ id: 'h', text: 'The riskiest bet', overreached: false, highest_load: true });
    mount({ strength: 's', claims, onResolve, onRequestHighestLoad });

    await act(async () => {
      buttonByText('I believe all of it')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(onRequestHighestLoad).toHaveBeenCalledTimes(1);
    expect(container.textContent).toContain("You didn't flinch");
    expect(container.textContent).toContain('The riskiest bet');

    setTextarea('My real bet');
    click(buttonByText('Seal this'));
    expect(onResolve.mock.calls[0][0]).toMatchObject({
      flinched_id: null,
      surfaced_constraint: 'The riskiest bet',
      no_flinch_fallback: true,
      real_bet: 'My real bet',
    });
  });

  it('no-flinch degrades to the last claim when the engine returns nothing', async () => {
    const onRequestHighestLoad = vi.fn().mockResolvedValue(null);
    mount({ strength: 's', claims, onResolve: vi.fn(), onRequestHighestLoad });
    await act(async () => {
      buttonByText('I believe all of it')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(container.textContent).toContain('Grandiose win'); // last claim used as fallback
  });
});
