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
 *  - Tapping a ship opens an in-place action card (열기 → onSelect/onSelectReceipt;
 *    due → 정산 → onReview) — the board is worked, not just read.
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

  it('scales — every ship renders at high count (no slot cap / overflow drop)', () => {
    // 07-12 regression guard: the old fixed-slot layout silently dropped ships
    // past a cap; the coordinate system must place ALL of them.
    const many = Array.from({ length: 30 }, (_, i) =>
      sealedProject(`m${i}`, `2026-0${(i % 9) + 1}-0${(i % 9) + 1}T00:00:00.000Z`),
    );
    render(many);
    expect(container.querySelectorAll('[role="listitem"]').length).toBe(30);
  });

  it('the state filter isolates a slice — matches stay lit, the rest recede', () => {
    const due = sealedProject('due1', '2026-01-10T00:00:00.000Z', {
      decision_contract: {
        id: 'c-due1', project_id: 'due1', created_at: '2026-01-10T00:00:00.000Z',
        check_in_at: '2026-02-28T00:00:00.000Z',
        predicates: [{ id: 'p1', text: '내기', source: 'user_lean', authored: 'user' }],
      },
    });
    render([due, sealedProject('b', '2026-02-01T00:00:00.000Z'), sealedProject('c', '2026-02-15T00:00:00.000Z')], {
      dueProjectIds: ['due1'],
    });
    const chip = Array.from(container.querySelectorAll('button')).find((b) =>
      (b.textContent || '').includes('다시 볼 것'),
    )!;
    expect(chip).toBeTruthy();
    act(() => chip.click());
    const items = Array.from(container.querySelectorAll('[role="listitem"]')) as HTMLElement[];
    const dueItem = items.find((el) => (el.getAttribute('aria-label') || '').includes('voyage-due1'))!;
    const other = items.find((el) => (el.getAttribute('aria-label') || '').includes('voyage-b'))!;
    expect(dueItem.style.opacity).toBe('1'); // the match stays
    expect(other.style.opacity).toBe('0.1'); // the rest recede
    // and the chip reports its true count
    expect(chip.textContent).toContain('1');
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

  it('taps a ship to an action card; open vs settle route correctly', () => {
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
    // Tapping a ship no longer navigates — it opens an action card in place.
    act(() => dueBtn.click());
    const reviewBtn = container.querySelector('[data-testid="ship-action-review"]') as HTMLButtonElement;
    expect(reviewBtn).toBeTruthy(); // a due ship offers 정산·다시 보기
    act(() => reviewBtn.click());
    expect(onReview).toHaveBeenCalledWith('due1');

    act(() => plainBtn.click());
    const openBtn = container.querySelector('[data-testid="ship-action-open"]') as HTMLButtonElement;
    act(() => openBtn.click());
    expect(onSelect).toHaveBeenCalledWith('b');
  });

  // ── shared-ground leverage: two decisions on the SAME sealed premise are
  //    linked (a fact, exact-match); a third with a different premise is not.
  it('leverage links decisions on the same sealed premise, and only those', () => {
    const withPremise = (id: string, text: string): Partial<Project> => ({
      decision_contract: {
        id: `c-${id}`,
        project_id: id,
        created_at: '2026-01-01T00:00:00.000Z',
        check_in_at: '2099-01-01T00:00:00.000Z',
        predicates: [{ id: `p-${id}`, text, source: 'governing_idea', authored: 'user' }],
      },
    });
    render([
      sealedProject('a', '2026-01-01T00:00:00.000Z', withPremise('a', '금리가 3.5% 근처에 머문다')),
      sealedProject('b', '2026-01-02T00:00:00.000Z', withPremise('b', '금리가 3.5% 근처에 머문다')),
      sealedProject('c', '2026-01-03T00:00:00.000Z', withPremise('c', '전혀 다른 전제')),
    ]);
    const items = Array.from(container.querySelectorAll('[role="listitem"]')) as HTMLButtonElement[];
    const shipA = items.find((el) => (el.getAttribute('aria-label') || '').includes('voyage-a'))!;
    act(() => shipA.click());
    const card = container.querySelector('[role="menu"]')!;
    expect(card.textContent).toContain('같은 전제 위 2척'); // a + b stand together
    expect(card.textContent).toContain('voyage-b'); // the sibling is named
    expect(card.textContent).not.toContain('voyage-c'); // different premise → no invented link

    // A decision whose premise nobody shares shows NO leverage callout (restraint).
    act(() => (items.find((el) => (el.getAttribute('aria-label') || '').includes('voyage-c'))!).click());
    expect(container.querySelector('[role="menu"]')!.textContent).not.toContain('같은 전제 위');
  });
});

/** ── One sea: receipt vessels + undersea currents (judgment graph) ────────
 *  Ported from the receipts branch's fleet-chart one-sea suite (handoff §5/§7):
 *  sealed review/MCP receipts join the same sea, and a shared premise between
 *  charted vessels is drawn as a current — amber only when its last re-check
 *  drifted (a fact), never as a verdict. No shared ground → nothing invented. */
import type { JudgmentReceipt } from '@/lib/review';
import type { PremiseState } from '@/lib/premises-core';

let rseq = 0;
function rPremise(text: string, over: Partial<PremiseState> = {}): PremiseState {
  rseq += 1;
  return {
    premise_id: `tp_${rseq}`, ordinal: rseq, kind: 'premise', text,
    external: true, load_bearing: true, source: 'user_stated',
    status: 'active', amend_history: [], recheck_count: 0, ...over,
  };
}
function sealedReceipt(id: string, title: string, sealedAt: string, premises: PremiseState[]): JudgmentReceipt {
  return {
    receipt_id: id, root_mode: 'review', state: 'sealed',
    artifact_id: `a_${id}`, source_kind: 'pasted_text', source_title: title,
    source_fingerprint: `fp_${id}`, core_question: 'q',
    judgment_obligations: [], claim_ledger: [], hidden_assumptions: [],
    forks: [], findings: [], current_heading: '',
    falsifiable_followups: [{
      followup_id: `f_${id}`, predicate: `${title} bet`, predicate_owner: 'user',
      pass_condition: 'a', fail_condition: 'b', check_by: '2099-06-01', sealed_at: sealedAt,
    }],
    companion_thread: [], tracked_premises: premises,
    provenance: { model: 't', lens_version: 'v', prompt_fingerprint: 'pf', reviewed_at: sealedAt },
    created_at: sealedAt, updated_at: sealedAt,
  } as JudgmentReceipt;
}

describe('one sea — receipt vessels and undersea currents', () => {
  const GROUND = '금리가 3.5% 근처에 머문다';

  function renderWithReceipts(receipts: JudgmentReceipt[], onSelectReceipt = vi.fn()) {
    act(() => {
      root.render(
        createElement(VoyageSea, {
          projects: [sealedProject('p1', '2026-01-05T00:00:00.000Z')],
          ...emptyLedgers,
          dueProjectIds: [],
          locale: 'ko' as const,
          onSelect: vi.fn(),
          onReview: vi.fn(),
          receipts,
          onSelectReceipt,
        }),
      );
    });
    return onSelectReceipt;
  }

  it('sealed receipts join the same sea and route their own click', () => {
    const onSelectReceipt = renderWithReceipts([
      sealedReceipt('r1', '검수 결정', '2026-02-10T00:00:00.000Z', []),
    ]);
    const items = Array.from(container.querySelectorAll('[role="listitem"]')) as HTMLButtonElement[];
    expect(items.length).toBe(2); // 1 project + 1 receipt = a sea worth charting
    const receiptShip = items.find((b) => (b.getAttribute('aria-label') || '').includes('검수 결정'))!;
    expect(receiptShip).toBeTruthy();
    act(() => receiptShip.click());
    const openBtn = container.querySelector('[data-testid="ship-action-open"]') as HTMLButtonElement;
    act(() => openBtn.click());
    expect(onSelectReceipt).toHaveBeenCalledWith('r1');
  });

  it('a shared premise between charted receipts renders ONE current; drifted → data-drifted=1', () => {
    const drifted = rPremise(GROUND, {
      last_recheck: {
        finding: '4.0%', numeric_value: 4, baseline_finding: '3.5%', baseline_numeric_value: 3.5,
        drifted: true, baseline_only: false, source: 'url', ts: '2026-02-20T00:00:00Z',
      },
    });
    renderWithReceipts([
      sealedReceipt('r1', '조달', '2026-02-01T00:00:00.000Z', [drifted]),
      sealedReceipt('r2', '가격', '2026-02-15T00:00:00.000Z', [rPremise(GROUND)]),
    ]);
    const currents = Array.from(container.querySelectorAll('[data-testid="fleet-current"]'));
    expect(currents.length).toBe(1);
    expect(currents[0].getAttribute('data-drifted')).toBe('1');
  });

  it('drift × leverage: decisions on a MOVED premise warn amber and the chip counts them', () => {
    const onGround = (id: string, createdAt: string): Partial<Project> => ({
      decision_contract: {
        id: `c-${id}`, project_id: id, created_at: createdAt, check_in_at: '2099-01-01T00:00:00.000Z',
        predicates: [{ id: `p-${id}`, text: GROUND, source: 'governing_idea', authored: 'user' }],
      },
    });
    const drifted = rPremise(GROUND, {
      last_recheck: {
        finding: '4.0%', numeric_value: 4, baseline_finding: '3.5%', baseline_numeric_value: 3.5,
        drifted: true, baseline_only: false, source: 'url', ts: '2026-02-20T00:00:00Z',
      },
    });
    act(() => {
      root.render(
        createElement(VoyageSea, {
          projects: [
            sealedProject('pg1', '2026-01-05T00:00:00.000Z', onGround('pg1', '2026-01-05T00:00:00.000Z')),
            sealedProject('pg2', '2026-01-06T00:00:00.000Z', onGround('pg2', '2026-01-06T00:00:00.000Z')),
          ],
          ...emptyLedgers,
          dueProjectIds: [],
          locale: 'ko' as const,
          onSelect: vi.fn(),
          onReview: vi.fn(),
          receipts: [
            sealedReceipt('r1', '조달', '2026-02-01T00:00:00.000Z', [drifted]),
            sealedReceipt('r2', '가격', '2026-02-15T00:00:00.000Z', [rPremise(GROUND)]),
          ],
          onSelectReceipt: vi.fn(),
        }),
      );
    });
    // the drift chip quantifies the blast radius — 2 charted decisions on GROUND
    expect(container.textContent).toContain('그 위 2척');
    // tapping one exposes the group AND flags the moved ground (a fact, amber)
    const shipG = Array.from(container.querySelectorAll('[role="listitem"]')).find((el) =>
      (el.getAttribute('aria-label') || '').includes('voyage-pg1'),
    ) as HTMLButtonElement;
    act(() => shipG.click());
    const card = container.querySelector('[role="menu"]')!;
    expect(card.textContent).toContain('같은 전제 위 2척');
    expect(card.textContent).toContain('이 전제가 최근 흔들렸어요'); // drift → warning
  });

  it('no shared ground → no current elements at all (nothing invented)', () => {
    renderWithReceipts([
      sealedReceipt('r1', '조달', '2026-02-01T00:00:00.000Z', [rPremise('전제 A')]),
      sealedReceipt('r2', '가격', '2026-02-15T00:00:00.000Z', [rPremise('전제 B')]),
    ]);
    expect(container.querySelectorAll('[data-testid="fleet-current"]').length).toBe(0);
  });

  it('the drift notice fires only on the spotlight event, quotes the ground, and routes to review', () => {
    const drifted = rPremise(GROUND, {
      last_recheck: {
        finding: '4.0%', numeric_value: 4, baseline_finding: '3.5%', baseline_numeric_value: 3.5,
        drifted: true, baseline_only: false, source: 'url', ts: '2026-02-20T00:00:00Z',
      },
    });
    const onSelectReceipt = renderWithReceipts([
      sealedReceipt('r1', '조달', '2026-02-01T00:00:00.000Z', [drifted]),
      sealedReceipt('r2', '가격', '2026-02-15T00:00:00.000Z', [rPremise(GROUND)]),
    ]);
    const text = container.textContent || '';
    expect(text).toContain('전제 이동');
    // the user's own sentence, verbatim (chip truncates the display but the
    // full ground is in the accessible label)
    const chip = Array.from(container.querySelectorAll('button')).find((b) =>
      (b.getAttribute('aria-label') || '').includes('전제 이동'),
    )!;
    expect(chip).toBeTruthy();
    expect(chip.getAttribute('aria-label')).toContain(GROUND);
    act(() => chip.click());
    expect(onSelectReceipt).toHaveBeenCalledWith('r1');
  });

  it('shared ground WITHOUT drift stays silent — no notice, quiet current only (restraint)', () => {
    renderWithReceipts([
      sealedReceipt('r1', '조달', '2026-02-01T00:00:00.000Z', [rPremise(GROUND)]),
      sealedReceipt('r2', '가격', '2026-02-15T00:00:00.000Z', [rPremise(GROUND)]),
    ]);
    expect(container.textContent).not.toContain('전제 이동');
    const currents = Array.from(container.querySelectorAll('[data-testid="fleet-current"]'));
    expect(currents.length).toBe(1);
    expect(currents[0].getAttribute('data-drifted')).toBe('0');
  });
});
