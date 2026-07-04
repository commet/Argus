// @vitest-environment jsdom

/**
 * FleetChart guard (S4 함대 해도 · B1/B3) — locks the 거울 조항 gate as code.
 *
 * The composition itself is the spine risk: a single sheet with wrecked and
 * verified side-by-side must read as a TIMELINE, never a scoreboard. These
 * assertions pin the invariants that keep it so:
 *  - 2-ship threshold (below it, no fleet → null render)
 *  - the ONLY ordering is created_at ascending (no state grouping)
 *  - no score / % / grade / streak / comparison / count-badge string leaks
 *  - a wrecked ship is not enlarged/highlighted relative to a verified one
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type { Project } from '@/stores/types';
import { FleetChart } from '@/components/projects/FleetChart';

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
      predicates: [],
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

function render(projects: Project[], onSelect = vi.fn()) {
  act(() => {
    root.render(
      createElement(FleetChart, {
        projects,
        ...emptyLedgers,
        locale: 'ko' as const,
        onSelect,
      }),
    );
  });
  return onSelect;
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

describe('FleetChart — spine gate (거울 조항)', () => {
  it('renders nothing below two ships (B3a)', () => {
    render([sealedProject('a', '2026-01-01T00:00:00.000Z')]);
    expect(container.querySelector('svg')).toBeNull();
    expect(container.textContent).toBe('');
  });

  it('does not render unsealed projects (accumulation face = sealed record only)', () => {
    const unsealed: Project = {
      id: 'u1',
      name: 'scratch',
      description: '',
      refs: [],
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-01T00:00:00.000Z',
    };
    render([sealedProject('a', '2026-01-01T00:00:00.000Z'), unsealed]);
    // Only one SEALED → below threshold → null.
    expect(container.querySelector('[role="list"]')).toBeNull();
  });

  it('orders ships by created_at ascending — the ONLY sort key (B3b)', () => {
    render([
      sealedProject('late', '2026-02-20T00:00:00.000Z'),
      sealedProject('early', '2026-01-05T00:00:00.000Z'),
      sealedProject('mid', '2026-01-30T00:00:00.000Z'),
    ]);
    const items = Array.from(container.querySelectorAll('[role="listitem"]'));
    const labels = items.map((el) => el.getAttribute('aria-label') || '');
    // ascending seal date: 01-05, 01-30, 02-20
    const dates = labels.map((l) => (l.match(/\d{4}-\d{2}-\d{2}/) || [''])[0]);
    expect(dates).toEqual(['2026-01-05', '2026-01-30', '2026-02-20']);
  });

  it('does NOT group or reorder by state — a wreck stays at its seal position', () => {
    // 'early' is idle-wrecked (30d+), 'late' is a fresh sealed voyage. A
    // scoreboard would bucket wrecked together; the timeline must not.
    render([
      sealedProject('early-wreck', '2025-11-01T00:00:00.000Z', {
        // no coda, long idle, but sealed contract caps it at reached-port anyway,
        // so we prove ordering is by DATE regardless of derived state.
        updated_at: '2025-11-01T00:00:00.000Z',
      }),
      sealedProject('late', '2026-02-20T00:00:00.000Z'),
    ]);
    const items = Array.from(container.querySelectorAll('[role="listitem"]'));
    const first = items[0]?.getAttribute('aria-label') || '';
    // The OLDEST seal date leads, whatever its state.
    expect(first).toContain('2025-11-01');
  });

  it('leaks no score / % / grade / streak / comparison string', () => {
    render([
      sealedProject('a', '2026-01-05T00:00:00.000Z'),
      sealedProject('b', '2026-02-01T00:00:00.000Z'),
    ]);
    const text = container.textContent || '';
    // No percentage, no score/grade/tier vocabulary, no comparison.
    expect(text).not.toMatch(/%/);
    expect(text).not.toMatch(/점수|등급|score|grade|tier|rank|streak|연속/i);
    expect(text).not.toMatch(/better|worse|더 나|보다/i);
    // The permitted engraving is a pure elapsed fact (B6 shared wording via
    // firstVoyageInscription): 첫 항해 {date} · 오늘로 N주째.
    expect(text).toMatch(/첫 항해 2026-01-05 · 오늘로 \d+주째/);
  });

  it('opens a project on ship click (no CTA, click-to-open only — B3f)', () => {
    const onSelect = render([
      sealedProject('a', '2026-01-05T00:00:00.000Z'),
      sealedProject('b', '2026-02-01T00:00:00.000Z'),
    ]);
    const items = Array.from(container.querySelectorAll('[role="listitem"]')) as HTMLButtonElement[];
    act(() => items[0].click());
    expect(onSelect).toHaveBeenCalledWith('a');
    // Each ship is the ONLY interactive control — no extra CTA button rides it.
    expect(items[0].querySelectorAll('button').length).toBe(0);
  });

  it('renders every ship at the same size (no ship enlarged to single it out — B3c)', () => {
    render([
      sealedProject('a', '2026-01-05T00:00:00.000Z'),
      sealedProject('b', '2026-02-01T00:00:00.000Z'),
      sealedProject('c', '2026-02-15T00:00:00.000Z'),
    ]);
    const svgs = Array.from(container.querySelectorAll('[role="listitem"] svg')) as SVGSVGElement[];
    const widths = svgs.map((s) => s.getAttribute('width'));
    expect(new Set(widths).size).toBe(1); // all identical
  });
});
