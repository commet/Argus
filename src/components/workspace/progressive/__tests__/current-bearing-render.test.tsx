// @vitest-environment jsdom
/**
 * CurrentBearingCard — real jsdom render. Proves the compressed orientation
 * surfaces every populated field (course, why, fog, road, helm, seed), maps the
 * status to its chip, and renders nothing when there's no bearing.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
vi.mock('@/hooks/useLocale', () => ({ useLocale: () => 'en' }));

import { CurrentBearingCard } from '@/components/workspace/progressive/CurrentBearingCard';
import type { CurrentBearing } from '@/lib/current-bearing';

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

function mount(props: Parameters<typeof CurrentBearingCard>[0]) {
  act(() => root.render(createElement(CurrentBearingCard, props)));
}

const full: CurrentBearing = {
  current_course: { status: 'collect_evidence', summary: 'Run a 4-hour migration spike, not full consolidation.' },
  why_this_course: [
    { point: 'Clear cost ceiling', source: 'review' },
    { point: 'Reversible in a week', source: 'review' },
  ],
  fog_or_reef: { issue: 'plugin depth is unproven', required_check: 'pull DAU split by surface' },
  road_not_taken: [{ option: 'full consolidation now', why_not_now: 'spends migration cost before proving demand' }],
  next_helm: 'pull DAU split by surface, then run the spike',
  contract_seed: { predicate: 'plugin DAU stays above X after 30 days' },
  blocked: false,
};

describe('CurrentBearingCard', () => {
  it('renders nothing when there is no bearing', () => {
    mount({ bearing: null });
    expect(container.textContent).toBe('');
  });

  it('surfaces every populated bearing field', () => {
    mount({ bearing: full, label: 'v0.1' });
    const text = container.textContent ?? '';
    expect(text).toContain('Current Heading');
    expect(text).toContain('v0.1');
    expect(text).toContain('Run a 4-hour migration spike');
    expect(text).toContain('Clear cost ceiling');
    expect(text).toContain('plugin depth is unproven');
    expect(text).toContain('pull DAU split by surface'); // required check / next helm
    expect(text).toContain('full consolidation now');
    expect(text).toContain('spends migration cost before proving demand');
    expect(text).toContain('plugin DAU stays above X after 30 days');
  });

  it('maps the course status to its chip label', () => {
    mount({ bearing: full });
    expect(container.textContent).toContain('Collect evidence');

    mount({ bearing: { ...full, current_course: { status: 'proceed', summary: 'go' } } });
    expect(container.textContent).toContain('Proceed');
  });

  it('omits optional sections that are empty without crashing', () => {
    mount({
      bearing: {
        current_course: { status: 'proceed', summary: 'just the course' },
        why_this_course: [{ point: 'one reason' }],
        fog_or_reef: null,
        road_not_taken: [],
        next_helm: '',
        contract_seed: null,
        blocked: false,
      },
    });
    const text = container.textContent ?? '';
    expect(text).toContain('just the course');
    expect(text).toContain('one reason');
    expect(text).not.toContain('Fog & reef');
    expect(text).not.toContain('Road not taken');
    expect(text).not.toContain('Contract seed');
    expect(text).not.toContain('Next helm');
  });
});
