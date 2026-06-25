// @vitest-environment jsdom

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
vi.mock('@/hooks/useLocale', () => ({ useLocale: () => 'en' }));

import { DecisionReplayTimeline } from '@/components/workspace/progressive/DecisionReplayTimeline';
import type { AnalysisSnapshot, DecisionContract, FlowAnswer, FlowQuestion } from '@/stores/types';
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

function mount(props: Parameters<typeof DecisionReplayTimeline>[0]) {
  act(() => root.render(createElement(DecisionReplayTimeline, props)));
}

const snapshot: AnalysisSnapshot = {
  version: 1,
  real_question: 'Should we run a spike before consolidating surfaces?',
  hidden_assumptions: ['Plugin demand survives after the novelty week'],
  skeleton: [],
  frame_status: 'load_bearing',
};

const questions: FlowQuestion[] = [{
  id: 'q1',
  text: 'What would make this expensive?',
  type: 'short',
  engine_phase: 'reframe',
}];

const answers: FlowAnswer[] = [{ question_id: 'q1', value: 'Migration cost and user confusion.' }];

const bearing: CurrentBearing = {
  current_course: { status: 'collect_evidence', summary: 'Run a 4-hour migration spike first.' },
  why_this_course: [{ point: 'Cost ceiling is clear', source: 'review' }],
  fog_or_reef: { issue: 'Plugin depth is unproven', required_check: 'Pull DAU split by surface' },
  road_not_taken: [{ option: 'Full consolidation now', why_not_now: 'Too much migration cost before demand proof' }],
  next_helm: 'Pull DAU split by surface',
  contract_seed: { predicate: 'Plugin DAU stays above baseline after 30 days' },
  blocked: false,
};

const contract: DecisionContract = {
  id: 'c1',
  project_id: 'p1',
  created_at: '2026-06-25T00:00:00.000Z',
  check_in_at: '2026-07-09T00:00:00.000Z',
  predicates: [
    {
      id: 'pred_1',
      text: 'Spike can be scheduled this week',
      source: 'governing_idea',
      verdict: 'happened',
      graded_at: '2026-06-26T00:00:00.000Z',
    },
    {
      id: 'pred_2',
      text: 'Plugin DAU stays above baseline after 30 days',
      source: 'risk',
    },
  ],
};

describe('DecisionReplayTimeline', () => {
  it('renders a compact decision path from existing session material', () => {
    mount({
      problemText: 'Should we consolidate plugin and web?',
      snapshots: [snapshot],
      questions,
      answers,
      bearing,
      contract,
      outcome: { verdict: 'mixed', note: 'Spike worked, full consolidation still too early.', recorded_at: '2026-07-10T00:00:00.000Z' },
    });

    const text = container.textContent ?? '';
    expect(text).toContain('Decision replay');
    expect(text).toContain('Original ask');
    expect(text).toContain('Reframed question');
    expect(text).toContain('Assumptions surfaced');
    expect(text).toContain('Road not taken');
    expect(text).toContain('Current bearing');
    expect(text).toContain('Check later');
    expect(text).toContain('Reality answered');
    expect(text).toContain('Run a 4-hour migration spike first');
    expect(text).toContain('Plugin DAU stays above baseline after 30 days');
  });

  it('renders nothing when there is no replay material', () => {
    mount({
      problemText: '',
      snapshots: [],
      questions: [],
      answers: [],
      bearing: null,
      contract: null,
    });
    expect(container.textContent).toBe('');
  });
});
