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

    expect(document.body.textContent).not.toContain('Date-only decision');
    expect(button('Show the original')).toBeUndefined();

    await act(async () => {
      button('I cannot tell from the evidence')!.click();
    });
    expect(document.body.textContent).not.toContain('Date-only decision');
    expect(mocks.updateDecisionContract).not.toHaveBeenCalled();
    await act(async () => {
      button('Answer one last question')!.click();
    });
    await act(async () => {
      button('I would use a different standard now')!.click();
    });

    expect(document.body.textContent).toContain('Date-only decision');
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

    // 도착지를 받지 않았으므로 기록을 약속하지 않는다 — 닫기라고 말하고 닫는다.
    expect(button('View record')).toBeUndefined();
    await act(async () => {
      button('Close')!.click();
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

  it('기준이 달라진 귀환만 다음 규칙을 묻고, 사용자가 쓴 그대로만 남긴다', async () => {
    // 감사 DLP-5 의 나머지 절반: 귀환은 관찰까지만 하고 끝났다. 정작 값어치는
    // 그 뒤에 남는 규칙인데, 어디에도 저장되지 않았다.
    await act(async () => {
      root.render(createElement(SettlementModal, { project, onClose: vi.fn() }));
    });
    await act(async () => button('I cannot tell from the evidence')!.click());
    await act(async () => button('Answer one last question')!.click());
    await act(async () => button('I would use a different standard now')!.click());

    const field = Array.from(document.body.querySelectorAll('textarea'))
      .find((t) => t.getAttribute('aria-label') === 'The rule to carry forward');
    expect(field, '기준이 달라졌는데 다음 규칙을 묻지 않습니다').toBeDefined();
    // 빈 채로는 아무것도 채택되지 않는다.
    expect((button('Keep this rule') as HTMLButtonElement).disabled).toBe(true);

    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!;
      setter.call(field!, '이런 상황에선 2주 더 보고 정한다');
      field!.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await act(async () => button('Keep this rule')!.click());

    // 규칙은 방금 그 귀환에 붙는다 — 새 정산을 만들지 않는다.
    const updater = mocks.updateDecisionContract.mock.calls.at(-1)?.[1] as
      (c: Project['decision_contract']) => Project['decision_contract'];
    const saved = mocks.updateDecisionContract.mock.calls[0][1](project.decision_contract);
    const written = updater(saved);
    expect(written!.settlements).toHaveLength(1);
    expect(written!.settlements![0].lesson).toEqual({
      text: '이런 상황에선 2주 더 보고 정한다',
      authored: 'user',
      recorded_at: '2026-01-09T00:00:00.000Z',
    });
    // 사슬이 화면에서 닫힌다: 실제 → 지금 기준 → 다음 규칙.
    expect(document.body.textContent).toContain('What this return left you');
    expect(document.body.textContent).toContain('이런 상황에선 2주 더 보고 정한다');
    expect(mocks.track).toHaveBeenCalledWith('foundation_return_lesson_saved', expect.anything());
  });

  it('기준이 그대로인 귀환에는 규칙을 만들어 내지 않는다', async () => {
    // 매번 물으면 아무것도 바뀌지 않은 귀환에까지 규칙을 제조하는 과발화가 된다.
    await act(async () => {
      root.render(createElement(SettlementModal, { project, onClose: vi.fn() }));
    });
    await act(async () => button('I cannot tell from the evidence')!.click());
    await act(async () => button('Answer one last question')!.click());
    const same = button('I would make the same call under the same conditions');
    expect(same, '기준이 그대로라는 선택지가 있어야 합니다').toBeDefined();
    await act(async () => same!.click());

    expect(document.body.textContent).not.toContain('One line to carry into the next decision?');
    expect(mocks.updateDecisionContract).toHaveBeenCalledTimes(1);
  });

  it('promises the record only when a caller declares where it is', async () => {
    // 감사 DLP-5: 정산을 끝낸 사람이 "기록 보기"를 눌렀는데 빈 화면으로
    // 돌아왔다. 방금 남긴 것이 사라진 것처럼 보이는 마무리다.
    const onClose = vi.fn();
    const onViewRecord = vi.fn();

    await act(async () => {
      root.render(createElement(SettlementModal, { project, onClose, onViewRecord }));
    });
    await act(async () => button('I cannot tell from the evidence')!.click());
    await act(async () => button('Answer one last question')!.click());
    await act(async () => button('I would use a different standard now')!.click());

    const cta = button('View record');
    expect(cta, '도착지를 받았는데도 기록을 약속하지 않습니다').toBeDefined();
    await act(async () => cta!.click());
    expect(onViewRecord).toHaveBeenCalledTimes(1);
    // 닫기로 새면 기록이 아니라 그 아래 화면에 도착한다 — 그것이 이 결함이었다.
    expect(onClose, '기록 보기가 그냥 닫기로 갔습니다').not.toHaveBeenCalled();
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
    await act(async () => button('Answer one last question')!.click());
    await act(async () => button('I would use a different standard now')!.click());

    const onramp = button('Now for real');
    expect(onramp).toBeDefined();
    await act(async () => onramp!.click());
    expect(onRealSeal).toHaveBeenCalledTimes(1);
  });
});
