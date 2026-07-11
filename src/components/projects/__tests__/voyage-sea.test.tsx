// @vitest-environment jsdom

/**
 * VoyageSea guard — locks the REWRITTEN 거울 조항 gate as code.
 *
 * The founder re-decided the sheet's composition on 2026-07-10: position now
 * encodes state (the sea is a map, not a timeline), superseding FleetChart's
 * "no state grouping" invariant. What must still hold — and what this file
 * pins — is the zero-judgment core underneath the new form:
 *
 *  - Emphasis is by ATTENTION only: the beacon (enlarged, gold, notice card)
 *    exists ONLY for a due check-in the user themselves promised. No due →
 *    no beacon, no notice, no urgency copy.
 *  - A wrecked/adrift ship is never enlarged to single it out, and no
 *    verdict vocabulary (실패/망함) ever renders for it.
 *  - No score / % / grade / streak / comparison string leaks anywhere.
 *  - The beacon quotes the user's own sealed predicate VERBATIM (honest
 *    provenance) and says so plainly when none exists (honest gap).
 *  - Retro (practice) voyages never sail here; < 2 ships → no sea at all.
 *  - Ships are click-to-open only (onSelect / onReview for due ships).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type { Project } from '@/stores/types';
import { VoyageSea } from '@/components/projects/VoyageSea';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function sealedProject(id: string, createdAt: string, extra?: Partial<Project>): Project {
  return {
    id,
    name: `voyage-${id}`,
    description: '',
    refs: [],
    created_at: createdAt,
    updated_at: createdAt,
    decision_contract: {
      id: `c-${id}`,
      project_id: id,
      created_at: createdAt,
      check_in_at: '2099-01-01T00:00:00.000Z',
      predicates: [
        {
          id: `p-${id}`,
          text: `${id}의 봉인한 내기 문장`,
          source: 'user_lean',
          authored: 'user',
        },
      ],
    },
    ...extra,
  };
}

let container: HTMLDivElement;
let root: Root;

const emptyLedgers = {
  reframeItems: [],
  recastItems: [],
  synthesizeItems: [],
  feedbackHistory: [],
  progressiveSessions: [],
} as const;

function render(
  projects: Project[],
  opts?: { dueProjectIds?: string[]; onSelect?: ReturnType<typeof vi.fn>; onReview?: ReturnType<typeof vi.fn> },
) {
  const onSelect = opts?.onSelect ?? vi.fn();
  const onReview = opts?.onReview ?? vi.fn();
  act(() => {
    root.render(
      createElement(VoyageSea, {
        projects,
        ...emptyLedgers,
        dueProjectIds: opts?.dueProjectIds ?? [],
        locale: 'ko' as const,
        onSelect,
        onReview,
      }),
    );
  });
  return { onSelect, onReview };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-03-01T00:00:00.000Z'));
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  document.body.innerHTML = '';
  vi.useRealTimers();
});

describe('VoyageSea — spine gate (거울 조항, 항해 지도판)', () => {
  it('renders nothing below two ships', () => {
    render([sealedProject('a', '2026-01-01T00:00:00.000Z')]);
    expect(container.textContent).toBe('');
  });

  it('retro (practice) voyages never sail on the map', () => {
    const retro = sealedProject('r1', '2026-01-02T00:00:00.000Z');
    retro.decision_contract = { ...retro.decision_contract!, origin: 'retro' };
    render([sealedProject('a', '2026-01-01T00:00:00.000Z'), retro]);
    // Only one real ship → below threshold → null.
    expect(container.querySelector('[role="list"]')).toBeNull();
  });

  it('no beacon and no notice when nothing is due — restraint is the default', () => {
    render([
      sealedProject('a', '2026-01-05T00:00:00.000Z'),
      sealedProject('b', '2026-02-01T00:00:00.000Z'),
    ]);
    expect(container.textContent).not.toContain('그래서, 어떻게 됐어요?');
    expect(container.textContent).not.toContain('다시 볼 때');
    // Calm caption, not urgency.
    expect(container.textContent).toContain('부를 배가 없어요');
  });

  it('the beacon exists only for a due check-in, and quotes the sealed bet verbatim', () => {
    const due = sealedProject('due1', '2026-01-10T00:00:00.000Z', {
      decision_contract: {
        id: 'c-due1',
        project_id: 'due1',
        created_at: '2026-01-10T00:00:00.000Z',
        check_in_at: '2026-02-28T00:00:00.000Z', // past → due
        predicates: [
          { id: 'p1', text: '2주 안에 시연하면 계약이 이어진다', source: 'user_lean', authored: 'user' },
        ],
      },
    });
    render([due, sealedProject('b', '2026-02-01T00:00:00.000Z')], { dueProjectIds: ['due1'] });
    expect(container.textContent).toContain('그래서, 어떻게 됐어요?');
    // Honest provenance: the user's own words, verbatim, marked as theirs.
    expect(container.textContent).toContain('2주 안에 시연하면 계약이 이어진다');
    expect(container.textContent).toContain('봉인한 내기');
  });

  it('a due contract with no sealed words says so honestly instead of inventing a quote', () => {
    const due = sealedProject('due2', '2026-01-10T00:00:00.000Z', {
      decision_contract: {
        id: 'c-due2',
        project_id: 'due2',
        created_at: '2026-01-10T00:00:00.000Z',
        check_in_at: '2026-02-28T00:00:00.000Z',
        predicates: [], // date-only early rope
      },
    });
    render([due, sealedProject('b', '2026-02-01T00:00:00.000Z')], { dueProjectIds: ['due2'] });
    expect(container.textContent).toContain('약속한 확인일이 왔어요');
    expect(container.textContent).not.toContain('봉인한 내기 —');
  });

  it('a wrecked ship is dimmed, never enlarged, and carries no verdict vocabulary', () => {
    // Unsealed + started + 40d idle → wrecked (the living-map departure from
    // FleetChart: in-progress voyages sail here too).
    const wreck: Project = {
      id: 'w1',
      name: 'wreck-voyage',
      description: '',
      refs: [],
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-15T00:00:00.000Z',
    };
    render(
      [wreck, sealedProject('a', '2026-01-05T00:00:00.000Z'), sealedProject('b', '2026-02-01T00:00:00.000Z')],
      {},
    );
    // wreck-voyage renders as docked (never started) — force a started signal
    // via a progressive session instead:
    act(() => {
      root.render(
        createElement(VoyageSea, {
          projects: [wreck, sealedProject('a', '2026-01-05T00:00:00.000Z'), sealedProject('b', '2026-02-01T00:00:00.000Z')],
          reframeItems: [],
          recastItems: [],
          synthesizeItems: [],
          feedbackHistory: [],
          progressiveSessions: [
            { id: 's1', project_id: 'w1', phase: 'exploring', created_at: '2026-01-15T00:00:00.000Z', updated_at: '2026-01-15T00:00:00.000Z' } as never,
          ],
          dueProjectIds: [],
          locale: 'ko' as const,
          onSelect: vi.fn(),
          onReview: vi.fn(),
        }),
      );
    });
    const text = container.textContent || '';
    expect(text).toContain('난파');
    expect(text).not.toMatch(/실패|망했|망함/);
    // The wrecked ship's button is not the enlarged one (only a due beacon is).
    const wreckedBtn = Array.from(container.querySelectorAll('[role="listitem"]')).find((el) =>
      (el.getAttribute('aria-label') || '').includes('wreck-voyage'),
    );
    expect(wreckedBtn).toBeTruthy();
    const mark = wreckedBtn!.querySelector('span[aria-hidden]') as HTMLElement | null;
    expect(mark?.style.width).toBe('24px'); // base size, not the 42px beacon scale
  });

  it('leaks no score / % / grade / streak / comparison string', () => {
    render([
      sealedProject('a', '2026-01-05T00:00:00.000Z'),
      sealedProject('b', '2026-02-01T00:00:00.000Z'),
      sealedProject('c', '2026-02-15T00:00:00.000Z'),
    ]);
    // USER-VISIBLE text only: the component's scoped <style> keyframes contain
    // literal `%` units, which no reader ever sees.
    const clone = container.cloneNode(true) as HTMLElement;
    clone.querySelectorAll('style').forEach((el) => el.remove());
    const text = clone.textContent || '';
    expect(text).not.toMatch(/%/);
    expect(text).not.toMatch(/점수|등급|score|grade|tier|rank|streak|연속/i);
    expect(text).not.toMatch(/better|worse|더 나|보다/i);
  });

  it('opens a project on ship click; due ships route to review instead', () => {
    const due = sealedProject('due1', '2026-01-10T00:00:00.000Z', {
      decision_contract: {
        id: 'c-due1',
        project_id: 'due1',
        created_at: '2026-01-10T00:00:00.000Z',
        check_in_at: '2026-02-28T00:00:00.000Z',
        predicates: [{ id: 'p1', text: '내기', source: 'user_lean', authored: 'user' }],
      },
    });
    const { onSelect, onReview } = render(
      [due, sealedProject('b', '2026-02-01T00:00:00.000Z')],
      { dueProjectIds: ['due1'] },
    );
    const items = Array.from(container.querySelectorAll('[role="listitem"]')) as HTMLButtonElement[];
    const dueBtn = items.find((el) => (el.getAttribute('aria-label') || '').includes('voyage-due1'))!;
    const plainBtn = items.find((el) => (el.getAttribute('aria-label') || '').includes('voyage-b'))!;
    act(() => dueBtn.click());
    expect(onReview).toHaveBeenCalledWith('due1');
    act(() => plainBtn.click());
    expect(onSelect).toHaveBeenCalledWith('b');
  });
});
