// @vitest-environment jsdom
/**
 * HeroLoopDemo — the landing walkthrough must actually render (the harbor-card
 * lesson: a surface with zero render tests stays green while broken), and its
 * fixture data must keep the consumption contract the component depends on.
 *
 * Pinned here:
 *   - fixture contract: ko carries job/hire/home, en carries job/home (the
 *     English 'hire' problem is withheld while the harness answers it in
 *     Korean), every sample reply has its own refined snapshot, seal present;
 *   - the honest provenance label is ALWAYS visible, and the example replies
 *     are labeled as ours rather than presented as product-offered options;
 *   - beat flow: problem → analysis card (real question) + question card →
 *     sample-reply tap swaps in that reply's refined analysis → seal + return
 *     beats land on timers → CTA hands control back (onStartOwn).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React, { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { HERO_DEMO_EXAMPLES } from '@/lib/hero-demo-data';

vi.mock('@/lib/analytics', () => ({ track: vi.fn() }));
vi.mock('framer-motion', () => ({
  AnimatePresence: ({ children }: { children?: React.ReactNode }) => createElement(React.Fragment, null, children),
  useReducedMotion: () => true,
  motion: new Proxy({}, {
    get: (_t, tag: string) =>
      // eslint-disable-next-line react/display-name
      React.forwardRef((props: Record<string, unknown>, ref) => {
        const { children, initial, animate, exit, transition, layout, whileHover, whileTap, ...rest } = props;
        void initial; void animate; void exit; void transition; void layout; void whileHover; void whileTap;
        return createElement(tag, { ...rest, ref }, children as React.ReactNode);
      }),
  }),
}));

import { HeroLoopDemo } from '../HeroLoopDemo';

describe('hero demo fixtures — consumption contract', () => {
  const EXPECTED_IDS = { ko: ['hire', 'home', 'job'], en: ['home', 'job'] } as const;

  it('carries the expected examples per locale, with a refined snapshot behind every sample reply', () => {
    for (const locale of ['ko', 'en'] as const) {
      const examples = HERO_DEMO_EXAMPLES[locale];
      expect(examples.map((e) => e.id).sort()).toEqual([...EXPECTED_IDS[locale]]);
      for (const ex of examples) {
        expect(ex.problem.length).toBeGreaterThan(10);
        expect(ex.initial.real_question.length).toBeGreaterThan(5);
        expect(ex.initial.next_question.text.length).toBeGreaterThan(5);
        expect(ex.sampleAnswers.length).toBeGreaterThanOrEqual(2);
        expect(ex.sealExample.length).toBeGreaterThan(10);
        expect(ex.initial.skeleton.length).toBeLessThanOrEqual(5);
        for (const reply of ex.sampleAnswers) {
          const refined = ex.refined[reply];
          expect(refined, `${locale}/${ex.id} reply "${reply}" has no refined snapshot`).toBeTruthy();
          expect(refined.real_question.length).toBeGreaterThan(5);
          expect(refined.insight.length).toBeGreaterThan(5);
        }
      }
    }
  });

  it('keeps the English set free of the Korean locale leak that withheld en/hire', () => {
    const hangul = /[가-힣]/;
    for (const ex of HERO_DEMO_EXAMPLES.en) {
      const productText = [
        ex.initial.real_question,
        ex.initial.insight ?? '',
        ex.initial.next_question.text,
        ...ex.initial.hidden_assumptions,
        ...ex.initial.skeleton,
        ...Object.values(ex.refined).flatMap((r) => [r.real_question, r.insight, ...r.skeleton]),
      ].join(' ');
      expect(hangul.test(productText), `en/${ex.id} contains Korean product copy`).toBe(false);
    }
  });
});

describe('HeroLoopDemo render', () => {
  let root: Root;
  let host: HTMLDivElement;
  const onClose = vi.fn();
  const onStartOwn = vi.fn();

  beforeEach(() => {
    vi.useFakeTimers();
    Element.prototype.scrollIntoView = vi.fn();
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    onClose.mockClear();
    onStartOwn.mockClear();
  });

  afterEach(() => {
    act(() => root.unmount());
    host.remove();
    vi.useRealTimers();
  });

  function mount() {
    act(() => {
      root.render(
        createElement(HeroLoopDemo, { exampleId: 'job', locale: 'ko', onClose, onStartOwn }),
      );
    });
  }

  it('walks problem → analysis → refined → seal → return, honestly labeled throughout', () => {
    const ex = HERO_DEMO_EXAMPLES.ko.find((e) => e.id === 'job')!;
    mount();

    // Honest provenance label is there from the first paint.
    expect(host.textContent).toContain('미리 준비된 예시');
    expect(host.textContent).toContain(ex.problem);

    // problem → analysis (900ms)
    act(() => { vi.advanceTimersByTime(1000); });
    expect(host.textContent).toContain(ex.initial.real_question);
    expect(host.textContent).toContain(ex.initial.next_question.text);

    // The replies are framed as ours, not as choices the product offered.
    expect(host.textContent).toContain('예시 답변을 눌러보세요');

    // Tap the first sample reply → that reply's OWN refined snapshot renders.
    const reply = ex.sampleAnswers[0];
    const btn = Array.from(host.querySelectorAll('button')).find((b) => b.textContent?.includes(reply))!;
    expect(btn).toBeTruthy();
    act(() => { btn.click(); });
    // seal at +2600ms, return at +4600ms.
    act(() => { vi.advanceTimersByTime(5000); });
    expect(host.textContent).toContain(ex.refined[reply].real_question);
    expect(host.textContent).toContain(ex.sealExample);
    expect(host.textContent).toContain('그래서, 어떻게 됐어요?');

    // CTA hands the pen back.
    const cta = Array.from(host.querySelectorAll('button')).find((b) => b.textContent?.includes('내 고민으로 시작하기'))!;
    act(() => { cta.click(); });
    expect(onStartOwn).toHaveBeenCalledTimes(1);
  });
});
