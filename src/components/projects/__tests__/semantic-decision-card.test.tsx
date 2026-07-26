// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type { Project } from '@/stores/types';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mocks = vi.hoisted(() => ({
  updateProject: vi.fn(),
  load: vi.fn(),
  submit: vi.fn(),
}));

vi.mock('@/hooks/useLocale', () => ({ useLocale: () => 'en' }));
vi.mock('@/stores/useProjectStore', () => ({
  useProjectStore: (selector: (state: { updateProject: typeof mocks.updateProject }) => unknown) =>
    selector({ updateProject: mocks.updateProject }),
}));
vi.mock('@/lib/semantic-web-client', () => ({
  SemanticLedgerClientError: class SemanticLedgerClientError extends Error {
    constructor(readonly code: string) { super(code); }
  },
  loadProjectSemanticEvents: mocks.load,
  submitProjectSemanticCommand: mocks.submit,
}));

import { SemanticDecisionCard } from '@/components/projects/SemanticDecisionCard';

let container: HTMLDivElement;
let root: Root;

const base = (eventId: string) => ({
  event_id: eventId,
  v: 3,
  space_id: 'account-project:p1',
  idempotency_key: eventId,
  time: {
    occurred_at: '2026-07-01T00:00:00.000Z',
    recorded_at: '2026-07-01T00:00:00.000Z',
    authorized_at: '2026-07-01T00:00:00.000Z',
    temporal_mode: 'contemporaneous',
  },
  authority: {
    originated_by: { kind: 'human', id: 'account-project:p1' },
    recorded_by: { kind: 'system', id: 'web' },
    authorized_by: { kind: 'human', id: 'account-project:p1' },
    authorization_mode: 'explicit_confirmation',
    authorization_ref: { kind: 'command_digest', ref: 'test' },
  },
});

const events = [
  {
    ...base('seal'),
    event: 'judgment_sealed',
    judgment_id: 'judgment-1',
    statement: 'I will accept only if product authority is explicit.',
    kind: 'prediction',
    kind_evidence: {
      source: 'elicitation_answer',
      rule: 'explicit_kind_choice',
      answer: 'prediction',
      recorded_at: '2026-07-01T00:00:00.000Z',
    },
    origin_utterance: 'Should I accept the offer?',
    review_condition_status: 'answered',
    review_condition: 'Is product authority explicit?',
  },
  {
    ...base('return'),
    event: 'return_promised',
    return_contract_id: 'return-1',
    judgment_id: 'judgment-1',
    review_at: '2026-07-20T00:00:00.000Z',
    review_question: 'Was product authority written into the role?',
  },
];

const project: Project = {
  id: 'p1',
  name: 'Accept the offer',
  description: '',
  refs: [],
  created_at: '2026-07-01T00:00:00.000Z',
  updated_at: '2026-07-01T00:00:00.000Z',
  decision_contract: {
    id: 'contract-1',
    project_id: 'p1',
    semantic_judgment_id: 'judgment-1',
    created_at: '2026-07-01T00:00:00.000Z',
    predicates: [],
  },
};

beforeEach(() => {
  mocks.updateProject.mockReset();
  mocks.load.mockReset().mockResolvedValue(events);
  mocks.submit.mockReset().mockResolvedValue(events);
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  document.body.innerHTML = '';
});

function button(label: string): HTMLButtonElement {
  const match = Array.from(document.body.querySelectorAll('button'))
    .find((candidate) => candidate.textContent?.includes(label)) as HTMLButtonElement | undefined;
  if (!match) throw new Error(`Missing button: ${label}`);
  return match;
}

describe('SemanticDecisionCard authorial flow', () => {
  it('records one kind-specific outcome and the exact present-standard answer atomically', async () => {
    await act(async () => {
      root.render(createElement(SemanticDecisionCard, { project }));
      await Promise.resolve();
    });

    expect(document.body.textContent).toContain('I will accept only if product authority is explicit.');
    expect(document.body.textContent).toContain('What actually happened?');

    await act(async () => button('Only part of it happened').click());
    expect(document.body.textContent)
      .toContain('Would you make the same call under the same conditions today?');
    await act(async () => button('I would use a different standard now').click());

    const command = mocks.submit.mock.calls.at(-1)?.[1];
    expect(command).toMatchObject({
      kind: 'observe_and_resolve',
      observation_source_kind: 'user_report',
      observation_text: 'Only part of it happened',
      resolution: {
        kind: 'answered',
        answer_summary: 'Only part of it happened',
        criterion_result: 'partial',
        commitment_result: 'revised',
        question_validity: 'valid',
        present_standard: {
          status: 'changed',
          response_text: 'I would use a different standard now',
        },
      },
    });
  });

  it('keeps an AI starting sentence linked to its proposal while the user chooses witness', async () => {
    const aiProject: Project = {
      ...project,
      decision_contract: {
        id: 'contract-ai',
        project_id: 'p1',
        created_at: '2026-07-01T00:00:00.000Z',
        predicates: [{
          id: 'proposal-predicate-1',
          text: 'Keep this sentence without reopening it.',
          source: 'governing_idea',
          authored: 'ai_surfaced',
        }],
      },
    };
    await act(async () => {
      root.render(createElement(SemanticDecisionCard, { project: aiProject }));
    });
    expect(document.body.textContent).toContain('This statement started from an Argus proposal.');

    await act(async () => button('Keep the original without a future return').click());
    await act(async () => button('Keep exactly as written').click());

    expect(mocks.submit).toHaveBeenCalledWith('p1', expect.objectContaining({
      kind: 'seal',
      decision_kind: 'witness',
      proposal_id: 'web-contract:proposal-predicate-1',
      proposal_text: 'Keep this sentence without reopening it.',
      adoption_mode: 'wording',
    }));
    const command = mocks.submit.mock.calls.at(-1)?.[1];
    expect(command).not.toHaveProperty('return_contract_id');
    expect(command).not.toHaveProperty('review_at');
    expect(command).not.toHaveProperty('origin_utterance');
  });

  it('keeps a directly authored setup line as the pre-compile origin utterance', async () => {
    const humanProject: Project = {
      ...project,
      decision_contract: {
        id: 'contract-human',
        project_id: 'p1',
        created_at: '2026-07-01T00:00:00.000Z',
        predicates: [{
          id: 'human-predicate-1',
          text: 'I choose real authority over title.',
          source: 'user_lean',
          authored: 'user',
        }],
      },
    };
    await act(async () => {
      root.render(createElement(SemanticDecisionCard, { project: humanProject }));
    });

    await act(async () => button('Keep the original without a future return').click());
    await act(async () => button('Keep exactly as written').click());

    expect(mocks.submit).toHaveBeenCalledWith('p1', expect.objectContaining({
      kind: 'seal',
      origin_utterance: 'I choose real authority over title.',
      decision_kind: 'witness',
    }));
  });
});
