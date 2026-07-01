// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type { Project } from '@/stores/types';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mocks = vi.hoisted(() => ({
  projects: [] as Project[],
  updateProject: vi.fn(),
  recordSignal: vi.fn(),
  track: vi.fn(),
}));

vi.mock('@/hooks/useLocale', () => ({ useLocale: () => 'en' }));
vi.mock('@/lib/auth', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }));
vi.mock('@/lib/signal-recorder', () => ({ recordSignal: mocks.recordSignal }));
vi.mock('@/lib/analytics', () => ({ track: mocks.track }));
vi.mock('@/stores/useProjectStore', () => ({
  useProjectStore: (selector: (state: { projects: Project[]; updateProject: typeof mocks.updateProject }) => unknown) =>
    selector({ projects: mocks.projects, updateProject: mocks.updateProject }),
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

function inputValue(el: HTMLTextAreaElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set;
  setter?.call(el, value);
  el.dispatchEvent(new Event('input', { bubbles: true }));
}

describe('SettlementModal date-only close', () => {
  it('stores the freeform outcome note and does not mark a closed loop abandoned', async () => {
    const onClose = vi.fn();

    await act(async () => {
      root.render(createElement(SettlementModal, { project, onClose }));
    });

    const textarea = document.body.querySelector('textarea') as HTMLTextAreaElement | null;
    expect(textarea).toBeTruthy();
    await act(async () => {
      inputValue(textarea!, 'It stayed useful, but the evidence was mixed.');
    });

    const closeButton = Array.from(document.body.querySelectorAll('button'))
      .find((button) => button.textContent?.includes('Looked back'));
    expect(closeButton).toBeTruthy();

    await act(async () => {
      closeButton!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(mocks.updateProject).toHaveBeenCalledWith('p1', {
      decision_contract: expect.objectContaining({
        outcome_note: 'It stayed useful, but the evidence was mixed.',
        graded_at: '2026-01-09T00:00:00.000Z',
        check_in_at: undefined,
        check_in_interval: undefined,
      }),
    });

    await act(async () => {
      root.unmount();
    });
    expect(mocks.track).not.toHaveBeenCalledWith('settle_abandoned', expect.anything());
  });
});
