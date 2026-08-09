// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type { Project } from '@/stores/types';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mocks = vi.hoisted(() => ({
  projects: [] as Project[],
  updateProject: vi.fn(),
  updateDecisionContract: vi.fn(),
  recordSignal: vi.fn(),
  track: vi.fn(),
}));

vi.mock('@/hooks/useLocale', () => ({ useLocale: () => 'en' }));
vi.mock('@/lib/auth', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }));
vi.mock('@/lib/signal-recorder', () => ({ recordSignal: mocks.recordSignal }));
vi.mock('@/lib/analytics', () => ({ track: mocks.track }));
vi.mock('@/stores/useProjectStore', () => ({
  useProjectStore: (selector: (state: {
    projects: Project[];
    updateProject: typeof mocks.updateProject;
    updateDecisionContract: typeof mocks.updateDecisionContract;
  }) => unknown) =>
    selector({
      projects: mocks.projects,
      updateProject: mocks.updateProject,
      updateDecisionContract: mocks.updateDecisionContract,
    }),
}));
vi.mock('@/lib/settle-align', () => ({ alignOutcome: vi.fn() }));
vi.mock('@/components/projects/DecisionContractCard', () => ({
  basisOptions: [],
  isCreditClaimingOutcome: () => false,
  predicateQuestion: (predicate: { text: string }) => predicate.text,
  verdictButtons: () => [],
}));

import { SettlementModal } from '@/components/projects/SettlementModal';

let container: HTMLDivElement;
let root: Root;

const project: Project = {
  id: 'p1',
  name: 'Date-only decision',
  description: '',
  refs: [],
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
  decision_contract: {
    id: 'c1',
    project_id: 'p1',
    created_at: '2026-01-01T00:00:00.000Z',
    check_in_at: '2026-01-08T00:00:00.000Z',
    predicates: [],
  },
};

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-01-09T00:00:00.000Z'));
  mocks.projects = [project];
  mocks.updateProject.mockReset();
  mocks.updateDecisionContract.mockReset();
  mocks.recordSignal.mockReset();
  mocks.track.mockReset();
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

function button(label: string): HTMLButtonElement | undefined {
  return Array.from(document.body.querySelectorAll('button'))
    .find((candidate) => candidate.textContent?.includes(label)) as HTMLButtonElement | undefined;
}

describe('SettlementModal foundation return', () => {
  it('appends an indeterminate reality answer and present-standard answer without a score-shaped verdict', async () => {
    const onClose = vi.fn();

    await act(async () => {
      root.render(createElement(SettlementModal, { project, onClose }));
    });

    expect(document.body.textContent).toContain('Date-only decision');
    expect(button('Show the original')).toBeUndefined();

    await act(async () => {
      button('I cannot tell from the evidence')!.click();
    });
    await act(async () => {
      button('I would use a different standard now')!.click();
    });

    expect(mocks.updateDecisionContract).toHaveBeenCalledWith('p1', expect.any(Function));
    const updater = mocks.updateDecisionContract.mock.calls[0]?.[1] as
      | ((contract: Project['decision_contract']) => Project['decision_contract'])
      | undefined;
    const written = updater?.(project.decision_contract);
    expect(written).toEqual(expect.objectContaining({
      settlements: [
        expect.objectContaining({
          option_id: 'not_observable',
          response_text: 'I cannot tell from the evidence',
          axes: {
            reality: 'not_observable',
            commitment: 'revised',
            question: 'indeterminate',
          },
          observation_source_kind: 'user_report',
          authorization: expect.objectContaining({
            authorized_by: 'human',
            authorization_mode: 'explicit_confirmation',
            surface: 'web',
            authorization_ref: expect.stringMatching(/^web:return:p1:/),
            authorized_at: '2026-01-09T00:00:00.000Z',
          }),
          present_standard: expect.objectContaining({
            status: 'changed',
            response_text: 'I would use a different standard now',
          }),
        }),
      ],
    }));
    expect(written).not.toHaveProperty('outcome_note');
    expect(written).not.toHaveProperty('score');

    await act(async () => {
      button('View record')!.click();
    });
    expect(onClose).toHaveBeenCalledTimes(1);

    await act(async () => {
      root.unmount();
    });
    expect(mocks.track).toHaveBeenCalledWith('foundation_return_saved', expect.objectContaining({
      option_id: 'not_observable',
      present_standard: 'changed',
    }));
    expect(mocks.track).not.toHaveBeenCalledWith('settle_abandoned', expect.anything());
  });

  it('offers memory-before-reveal only from the second return onward', async () => {
    const returningProject: Project = {
      ...project,
      decision_contract: {
        ...project.decision_contract!,
        settlements: [{
          option_id: 'condition_met',
          response_text: 'The condition was met',
          recorded_at: '2026-01-08T00:00:00.000Z',
          axes: { reality: 'met', question: 'valid' },
        }],
      },
    };
    await act(async () => {
      root.render(createElement(SettlementModal, { project: returningProject, onClose: vi.fn() }));
    });
    expect(button('Show the original')).toBeDefined();
    expect(button('Write what I remember first')).toBeDefined();
    expect(button('I cannot tell from the evidence')).toBeUndefined();
  });

  it('keeps the retro reading non-binding and offers the real-decision onramp after saving', async () => {
    const onRealSeal = vi.fn();
    const retroProject: Project = {
      ...project,
      decision_contract: {
        ...project.decision_contract!,
        origin: 'retro',
        predicates: [{
          id: 'retro-predicate',
          text: 'The team can hold the date without hiring',
          source: 'user_lean',
          authored: 'user',
        }],
      },
    };

    await act(async () => {
      root.render(createElement(SettlementModal, {
        project: retroProject,
        onClose: vi.fn(),
        onRealSeal,
        draftVerdicts: { 'retro-predicate': 'avoided' },
      }));
    });

    expect(document.body.textContent).toContain('AI draft · choose for yourself');
    expect(button('It did not happen')).toBeDefined();
    await act(async () => button('It did not happen')!.click());
    await act(async () => button('I would use a different standard now')!.click());

    const onramp = button('Now for real');
    expect(onramp).toBeDefined();
    await act(async () => onramp!.click());
    expect(onRealSeal).toHaveBeenCalledTimes(1);
  });
});
