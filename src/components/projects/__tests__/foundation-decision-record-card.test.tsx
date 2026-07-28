// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type { Project } from '@/stores/types';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mocks = vi.hoisted(() => ({
  updateDecisionContract: vi.fn(),
}));

vi.mock('@/hooks/useLocale', () => ({ useLocale: () => 'en' }));
vi.mock('@/lib/auth', () => ({ useAuth: () => ({ session: null }) }));
vi.mock('@/stores/useProjectStore', () => ({
  useProjectStore: (selector: (state: {
    updateDecisionContract: typeof mocks.updateDecisionContract;
  }) => unknown) => selector({ updateDecisionContract: mocks.updateDecisionContract }),
}));

import { FoundationDecisionRecordCard } from '@/components/projects/FoundationDecisionRecordCard';

let container: HTMLDivElement;
let root: Root;

const project: Project = {
  id: 'project-witness',
  name: 'Offer note',
  description: '',
  refs: [],
  created_at: '2026-07-01T00:00:00.000Z',
  updated_at: '2026-07-01T00:00:00.000Z',
  decision_contract: {
    id: 'contract-witness',
    project_id: 'project-witness',
    integrity_version: 2,
    integrity_baseline: { settlement_count: 0 },
    kind: 'witness',
    kind_evidence: {
      source: 'elicitation_answer',
      rule: 'record_only_path',
      answer: 'witness',
      recorded_at: '2026-07-01T00:00:00.000Z',
    },
    origin_utterance: 'Keep this offer note.',
    review_condition_status: 'not_asked',
    predicates: [{
      id: 'predicate-1',
      text: 'Keep this offer note.',
      source: 'user_lean',
      authored: 'user',
    }],
    created_at: '2026-07-01T00:00:00.000Z',
  },
};

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-07-27T00:00:00.000Z'));
  mocks.updateDecisionContract.mockReset();
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

function button(label: string): HTMLButtonElement {
  const match = Array.from(document.body.querySelectorAll('button'))
    .find((candidate) => candidate.textContent?.includes(label)) as HTMLButtonElement | undefined;
  if (!match) throw new Error(`Missing button: ${label}`);
  return match;
}

function setValue(element: HTMLInputElement | HTMLTextAreaElement, value: string) {
  const prototype = element instanceof HTMLTextAreaElement
    ? HTMLTextAreaElement.prototype
    : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(prototype, 'value')?.set?.call(element, value);
  element.dispatchEvent(new Event('input', { bubbles: true }));
}

describe('FoundationDecisionRecordCard corrections', () => {
  it('requires a reality-answerable question when a witness becomes a returnable record', async () => {
    await act(async () => {
      root.render(createElement(FoundationDecisionRecordCard, { project }));
    });

    await act(async () => button('Revise').click());
    await act(async () => button('Something reality can answer').click());

    const save = button('Append revision');
    expect(save.disabled).toBe(true);
    expect(document.body.textContent).toContain('one question reality can answer');

    const question = Array.from(document.body.querySelectorAll('textarea'))[1] as HTMLTextAreaElement;
    const date = document.body.querySelector('input[type="date"]') as HTMLInputElement;
    await act(async () => {
      setValue(question, 'Was product authority written into the offer?');
      setValue(date, '2026-08-20');
    });
    expect(save.disabled).toBe(false);

    await act(async () => save.click());
    const updater = mocks.updateDecisionContract.mock.calls[0]?.[1] as
      | ((contract: Project['decision_contract']) => Project['decision_contract'])
      | undefined;
    const written = updater?.(project.decision_contract);

    expect(written).toMatchObject({
      kind: 'prediction',
      origin_utterance: 'Keep this offer note.',
      review_condition_status: 'answered',
      review_condition: 'Was product authority written into the offer?',
      kind_corrections: [
        expect.objectContaining({ from_kind: 'witness', to_kind: 'prediction' }),
      ],
    });
    expect(written?.check_in_at).toBeTruthy();
  });
});
