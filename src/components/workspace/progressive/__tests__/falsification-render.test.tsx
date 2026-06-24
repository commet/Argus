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
  { id: 'c1', text: 'Plausible win', assumption: 'Users will try it', overreached: true },
  { id: 'c2', text: 'Bolder win', assumption: 'Users will refer friends', overreached: true },
  { id: 'c3', text: 'Grandiose win', assumption: 'Everyone refers everyone', overreached: true },
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
    // New instruction declares the ladder is deliberately inflated and gives
    // a plain (non-double-negative) click rule.
    expect(container.textContent).toContain('deliberately inflated');
    expect(container.textContent).toContain('no, not that far');
    expect(container.textContent).toContain('Plausible win');
    expect(container.textContent).toContain('Grandiose win');
  });

  it('flinch → surfaces the rung ASSUMPTION (not the claim text) and gates the CTA', () => {
    const onResolve = vi.fn();
    mount({ strength: 's', claims, onResolve, onRequestHighestLoad: vi.fn() });

    click(buttonByText('Bolder win')); // flinch at claim 2
    expect(container.textContent).toContain('You stopped here');
    // The surfaced belief is the rung's assumption, NOT its claim text.
    expect(container.textContent).toContain('Users will refer friends');

    const cta = buttonByText('Lock it in');
    expect((cta as HTMLButtonElement).disabled).toBe(true); // gated

    setTextarea('I am betting users will act');
    expect((buttonByText('Lock it in') as HTMLButtonElement).disabled).toBe(false);

    click(buttonByText('Lock it in'));
    expect(onResolve).toHaveBeenCalledTimes(1);
    expect(onResolve.mock.calls[0][0]).toMatchObject({
      flinched_id: 'c2',
      surfaced_constraint: 'Users will refer friends', // the assumption, not 'Bolder win'
      real_bet: 'I am betting users will act',
      real_bet_authored: 'user', // the user typed it — authored, not machine-surfaced
      no_flinch_fallback: false,
    });
  });

  it('falls back to the claim text when a rung has no assumption', () => {
    const onResolve = vi.fn();
    const noAssumption: LoadBearingClaim[] = [
      { id: 'a', text: 'Win A', overreached: true },
      { id: 'b', text: 'Win B', overreached: true },
      { id: 'c', text: 'Win C', overreached: true },
    ];
    mount({ strength: 's', claims: noAssumption, onResolve, onRequestHighestLoad: vi.fn() });
    click(buttonByText('Win B'));
    setTextarea('x');
    click(buttonByText('Lock it in'));
    expect(onResolve.mock.calls[0][0].surfaced_constraint).toBe('Win B');
  });

  it('"use this sentence" fills the bet from the surfaced assumption', () => {
    const onResolve = vi.fn();
    mount({ strength: 's', claims, onResolve, onRequestHighestLoad: vi.fn() });
    click(buttonByText('Plausible win'));
    click(buttonByText('Use this sentence as-is'));
    click(buttonByText('Lock it in'));
    expect(onResolve.mock.calls[0][0].real_bet).toBe('Users will try it'); // c1's assumption
  });

  it('the writing-skip exit resolves with the surfaced belief as the bet, TAGGED ai_surfaced (not silently the user\'s)', () => {
    const onResolve = vi.fn();
    mount({ strength: 's', claims, onResolve, onRequestHighestLoad: vi.fn() });
    click(buttonByText('Bolder win'));
    click(buttonByText('just give me the document'));
    expect(onResolve).toHaveBeenCalledTimes(1);
    expect(onResolve.mock.calls[0][0]).toMatchObject({
      flinched_id: 'c2',
      surfaced_constraint: 'Users will refer friends',
      real_bet: 'Users will refer friends',
      // CLAUDE.md A1: the skip stands the machine sentence in as the bet, but it
      // must be honestly tagged as ai_surfaced — never silently the user's own.
      real_bet_authored: 'ai_surfaced',
      no_flinch_fallback: false,
    });
  });

  it('"use this sentence as-is" then lock-in remains ai_surfaced (verbatim adoption, not re-authorship)', () => {
    const onResolve = vi.fn();
    mount({ strength: 's', claims, onResolve, onRequestHighestLoad: vi.fn() });
    click(buttonByText('Plausible win'));
    click(buttonByText('Use this sentence as-is'));
    click(buttonByText('Lock it in'));
    // The user consented to use the machine sentence, but did not re-author it.
    // Keep calibration conservative: only a genuinely changed re-statement is user-authored.
    expect(onResolve.mock.calls[0][0].real_bet_authored).toBe('ai_surfaced');
  });

  it('no-flinch → asks the engine for the highest-load pick and marks the fallback', async () => {
    const onResolve = vi.fn();
    const onRequestHighestLoad = vi.fn().mockResolvedValue({ id: 'h', text: 'Users keep using it after launch', overreached: false, highest_load: true });
    mount({ strength: 's', claims, onResolve, onRequestHighestLoad });

    await act(async () => {
      buttonByText('I believe all of it')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(onRequestHighestLoad).toHaveBeenCalledTimes(1);
    expect(container.textContent).toContain("You didn't stop anywhere");
    expect(container.textContent).toContain('Users keep using it after launch');

    // Spine (§2.4-2): the no-flinch path must NOT issue a ranked verdict about
    // which belief is "riskiest", nor a stakes-statement about what it decides.
    // The crux is a bare neutral question. (CLAUDE.md rounds 5–8.)
    expect(container.textContent).toContain('Is it actually true?');
    expect(container.textContent).not.toContain('riskiest');
    expect(container.textContent).not.toContain('succeeds or fails');

    setTextarea('My real bet');
    click(buttonByText('Lock it in'));
    expect(onResolve.mock.calls[0][0]).toMatchObject({
      flinched_id: null,
      surfaced_constraint: 'Users keep using it after launch',
      no_flinch_fallback: true,
      real_bet: 'My real bet',
    });
  });

  it('no-flinch degrades to the FIRST rung assumption when the engine returns null', async () => {
    const onResolve = vi.fn();
    const onRequestHighestLoad = vi.fn().mockResolvedValue(null);
    mount({ strength: 's', claims, onResolve, onRequestHighestLoad });
    await act(async () => {
      buttonByText('I believe all of it')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(container.textContent).toContain('Users will try it'); // c1's assumption (first rung)
    setTextarea('x');
    click(buttonByText('Lock it in'));
    expect(onResolve.mock.calls[0][0].surfaced_constraint).toBe('Users will try it');
  });

  it('no-flinch degrades when the engine returns a blank-text pick (never a blank constraint)', async () => {
    const onResolve = vi.fn();
    const onRequestHighestLoad = vi.fn().mockResolvedValue({ id: 'h', text: '   ', overreached: false, highest_load: true });
    mount({ strength: 's', claims, onResolve, onRequestHighestLoad });
    await act(async () => {
      buttonByText('I believe all of it')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(container.textContent).toContain('Users will try it'); // first-rung assumption fallback
    setTextarea('my bet');
    click(buttonByText('Lock it in'));
    expect(onResolve.mock.calls[0][0].surfaced_constraint).toBe('Users will try it');
  });
});
