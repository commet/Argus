// @vitest-environment jsdom
/**
 * LightFlow interactions — the light path's screen grammar, end to end in jsdom.
 *
 * Pinned here:
 *   - answer → next screen (mirror + next question), record accumulates below;
 *   - NO generated option buttons EVER render (anti-술 invariant at the DOM level);
 *   - offer accept records through the EXISTING project store (decision_contract
 *     with closed_at + check_in_at + honest provenance) and shows the verbatim
 *     close line; editing the sentence flips authorship to user;
 *   - decline closes in one line and never re-asks;
 *   - escalation card: verbatim headline; accept hands off to heavy with the
 *     light Q&A carried in the text; decline closes lightly;
 *   - the deterministic crisis pre-empt routes out of the light flow;
 *   - the quiet "더 깊이 보기" link hands off to heavy.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React, { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';

vi.mock('@/hooks/useLocale', () => ({ useLocale: () => 'ko' }));
vi.mock('@/lib/analytics', () => ({ track: vi.fn() }));
vi.mock('@/lib/db', () => ({
  upsertToSupabase: vi.fn(),
  softDeleteFromSupabase: vi.fn(),
  loadAndMerge: vi.fn(async () => []),
}));
vi.mock('@/lib/supabase', () => ({
  ensureUserId: vi.fn(async () => 'user-1'),
}));
// framer-motion: render plain elements so screen swaps are synchronous in jsdom.
vi.mock('framer-motion', () => ({
  AnimatePresence: ({ children }: { children?: React.ReactNode }) => createElement(React.Fragment, null, children),
  useReducedMotion: () => true,
  motion: new Proxy({}, {
    get: (_t, tag: string) =>
      // eslint-disable-next-line react/display-name
      React.forwardRef((props: Record<string, unknown>, ref) => {
        const { children, initial, animate, exit, transition, layout, whileHover, whileTap, ...rest } = props;
        void initial; void animate; void exit; void transition; void layout; void whileHover; void whileTap;
        return createElement(tag, { ...rest, ref }, children as React.ReactNode);
      }),
  }),
}));
// The mascot renders next/image internally — swap for a marker span in jsdom.
vi.mock('@/components/brand/ArgusMascot', () => ({
  ArgusMascot: () => createElement('span', { 'data-testid': 'argus-mascot' }),
}));
vi.mock('@/lib/light-path/light-engine', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/light-path/light-engine')>();
  return { ...actual, runLightNext: vi.fn() };
});

import { LightFlow, type LightDeepenContext } from '@/components/workspace/light/LightFlow';
import { runLightNext, type LightTurn } from '@/lib/light-path/light-engine';
import { useProjectStore } from '@/stores/useProjectStore';
import { track } from '@/lib/analytics';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mockNext = vi.mocked(runLightNext);
const mockTrack = vi.mocked(track);

let container: HTMLDivElement;
let root: Root;
beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  useProjectStore.setState({ projects: [], currentProjectId: null });
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

const OPENING = { mirror: '더 있고 싶은데 집에 가야 하나 싶으신 거네요.', question: '어느 쪽 이유가 더 커요?' };
const PROBLEM = '친구 생일 파티인데 지금 나올까 말까';

function renderFlow(overrides?: { onDeepen?: (ctx: LightDeepenContext) => void; onClose?: () => void }) {
  const onDeepen = overrides?.onDeepen ?? vi.fn();
  const onClose = overrides?.onClose ?? vi.fn();
  act(() => {
    root.render(
      createElement(LightFlow, { problemText: PROBLEM, opening: OPENING, onDeepen, onClose }),
    );
  });
  return { onDeepen, onClose };
}

const click = async (el: Element) =>
  act(async () => {
    el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await Promise.resolve();
  });

function setTextarea(el: HTMLTextAreaElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')!.set!;
  act(() => {
    setter.call(el, value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

function buttonByText(text: string): HTMLButtonElement | undefined {
  return Array.from(container.querySelectorAll('button')).find((b) => (b.textContent || '').includes(text));
}

async function answerOnce(answer: string, turn: LightTurn) {
  mockNext.mockResolvedValueOnce(turn);
  const ta = container.querySelector<HTMLTextAreaElement>('textarea[placeholder="한 줄이면 돼요"]');
  expect(ta, 'free-text answer input must exist').toBeTruthy();
  setTextarea(ta!, answer);
  await click(buttonByText('보내기')!);
}

/** Every button on a light screen must be one of the FIXED action affordances —
 *  a generated option would show up as an unexpected button label. */
const FIXED_BUTTONS = ['보내기', '더 깊이 보기', '물어봐 주세요', '괜찮아요, 그냥 갈게요', '고쳐도 돼요', '저장', '지금 조금 더 볼래요', '다음에 볼래요', '처음으로', '지금까지 나눈 이야기'];
function assertNoGeneratedOptionButtons() {
  for (const b of Array.from(container.querySelectorAll('button'))) {
    const label = (b.textContent || '').trim();
    expect(
      FIXED_BUTTONS.some((f) => label.includes(f)),
      `unexpected button rendered (generated option?): "${label}"`,
    ).toBe(true);
  }
}

describe('opening screen', () => {
  it('renders mirror + question + free-text input, and NO option buttons', () => {
    renderFlow();
    expect(container.textContent).toContain(OPENING.mirror);
    expect(container.textContent).toContain(OPENING.question);
    expect(container.querySelector('textarea[placeholder="한 줄이면 돼요"]')).toBeTruthy();
    assertNoGeneratedOptionButtons();
  });

  it('the question owns the screen: one serif display headline (h2), mirror as secondary text', () => {
    renderFlow();
    const headlines = Array.from(container.querySelectorAll('h2'));
    expect(headlines).toHaveLength(1);
    expect(headlines[0].textContent).toContain(OPENING.question);
    expect(headlines[0].style.fontFamily).toContain('--font-display');
    // the mirror is NOT the headline
    expect(headlines[0].textContent).not.toContain(OPENING.mirror);
  });
});

describe('answer → next screen', () => {
  it('shows the next mirror+question and stacks the prior Q&A below', async () => {
    renderFlow();
    await answerOnce('내일 출근이 걱정돼서요', { mirror: '피곤이 관건이네요.', action: 'ask', question: '내일 몇 시에 일어나야 해요?' });
    expect(mockNext).toHaveBeenCalledTimes(1);
    expect(mockNext.mock.calls[0][1]).toEqual([{ question: OPENING.question, answer: '내일 출근이 걱정돼서요' }]);
    expect(container.textContent).toContain('피곤이 관건이네요.');
    expect(container.textContent).toContain('내일 몇 시에 일어나야 해요?');
    // the accumulating record below
    expect(container.textContent).toContain('지금까지 나눈 이야기 1개');
    expect(container.textContent).toContain(OPENING.question);
    expect(container.textContent).toContain('내일 출근이 걱정돼서요');
    expect(mockTrack).toHaveBeenCalledWith('light_question_answered', { round: 1 });
    assertNoGeneratedOptionButtons();
  });

  it('a turn carrying stray options still renders ZERO option buttons', async () => {
    renderFlow();
    await answerOnce('그냥요', {
      mirror: 'm', action: 'ask', question: '다음 질문?',
      ...( { options: ['남는다', '간다'] } as object),
    } as LightTurn);
    expect(container.textContent).not.toContain('남는다');
    assertNoGeneratedOptionButtons();
  });
});

describe('offer (남기기) — permission to return, not sentence-approval', () => {
  const ASK = '그럼 케이크만 자르고 나오는 걸로 하고, 내일 아침에 안 피곤했는지 제가 한 번만 물어볼까요?';
  const OFFER_TURN: LightTurn = {
    mirror: '내일 피곤만 아니면 되는 거네요.',
    action: 'offer',
    offer: { sentence: '케이크 자르고 나오면 내일 안 피곤하다', when: 'tomorrow_morning', ask: ASK },
  };

  it('the ask is one flowing sentence — the falsifiable line is NOT shown before accept', async () => {
    renderFlow();
    await answerOnce('내일 피곤할까 봐요', OFFER_TURN);
    expect(mockTrack).toHaveBeenCalledWith('light_seal_offered');
    expect(container.textContent).toContain(ASK);
    // the sentence stays an internal record until the user says yes
    expect(container.textContent).not.toContain('케이크 자르고 나오면 내일 안 피곤하다');
    expect(container.textContent).not.toContain('「');
    // nothing to approve: no editable input on the ask screen
    expect(container.querySelectorAll('textarea')).toHaveLength(0);
    // permission buttons carry the check slot in plain words
    expect(buttonByText('내일 아침에 물어봐 주세요')).toBeTruthy();
    expect(buttonByText('괜찮아요, 그냥 갈게요')).toBeTruthy();
    assertNoGeneratedOptionButtons();
  });

  it('a missing ask falls back to a mechanical when-label question (never invented content)', async () => {
    renderFlow();
    await answerOnce('내일 피곤할까 봐요', {
      ...OFFER_TURN,
      offer: { sentence: '케이크 자르고 나오면 내일 안 피곤하다', when: 'tomorrow_morning' },
    });
    expect(container.textContent).toContain('내일 아침에 제가 한 번만 물어볼까요?');
  });

  it('accepting records via the project store with honest ai-wording provenance and shows the receipt', async () => {
    renderFlow();
    await answerOnce('내일 피곤할까 봐요', OFFER_TURN);
    await click(buttonByText('내일 아침에 물어봐 주세요')!);

    const { projects, currentProjectId } = useProjectStore.getState();
    expect(projects).toHaveLength(1);
    const contract = projects[0].decision_contract!;
    expect(contract.closed_at).toBeTruthy();
    expect(contract.check_in_at).toBeTruthy();
    expect(contract.sealed_statement).toBe('케이크 자르고 나오면 내일 안 피곤하다');
    expect(contract.predicates[0].authored).toBe('ai_surfaced');
    // the flow stays on its own close screen — no project takeover
    expect(currentProjectId).toBeNull();
    expect(mockTrack).toHaveBeenCalledWith('light_seal_accepted', { edited: false });
    // verbatim close line + the receipt that finally shows the remembered line
    expect(container.textContent).toContain('기억해 뒀어요. 내일 아침에 한 번만 물어볼게요.');
    expect(container.textContent).toContain('이렇게 기억해 둘게요');
    expect(container.textContent).toContain('케이크 자르고 나오면 내일 안 피곤하다');
    expect(buttonByText('고쳐도 돼요')).toBeTruthy();
    // the keepsake: the mascot's quiet mark + the exact check date in numerals
    expect(container.querySelector('[data-testid="argus-mascot"]')).toBeTruthy();
    expect(container.textContent).toContain('확인 ·');
  });

  it('고쳐도 돼요 after accept updates the stored contract and flips authorship to the user', async () => {
    renderFlow();
    await answerOnce('내일 피곤할까 봐요', OFFER_TURN);
    await click(buttonByText('내일 아침에 물어봐 주세요')!);
    const before = useProjectStore.getState().projects[0].decision_contract!;

    await click(buttonByText('고쳐도 돼요')!);
    const editable = Array.from(container.querySelectorAll('textarea')).find(
      (t) => t.value === '케이크 자르고 나오면 내일 안 피곤하다',
    );
    expect(editable, 'the receipt line must open into an editable input').toBeTruthy();
    setTextarea(editable!, '지금 나가도 후회 안 한다');
    await click(buttonByText('저장')!);

    const after = useProjectStore.getState().projects[0].decision_contract!;
    expect(after.sealed_statement).toBe('지금 나가도 후회 안 한다');
    expect(after.predicates[0].authored).toBe('user');
    expect(after.predicates[0].attribution?.wording_source).toBe('user_reworded');
    expect(after.judgment_receipt?.human_judgment).toBe('지금 나가도 후회 안 한다');
    // machine wording no longer kept → no adoption lineage survives
    expect(after.adoption_lineage).toBeUndefined();
    // identity, seal stamp, and promised schedule are preserved
    expect(after.id).toBe(before.id);
    expect(after.created_at).toBe(before.created_at);
    expect(after.closed_at).toBe(before.closed_at);
    expect(after.check_in_at).toBe(before.check_in_at);
    // the receipt now shows the user's own line
    expect(container.textContent).toContain('지금 나가도 후회 안 한다');
  });

  it('declining closes in one line, records nothing, and never re-asks', async () => {
    renderFlow();
    await answerOnce('내일 피곤할까 봐요', OFFER_TURN);
    await click(buttonByText('괜찮아요, 그냥 갈게요')!);
    expect(container.textContent).toContain('네, 여기까지도 충분해요. 필요하면 언제든요.');
    expect(useProjectStore.getState().projects).toHaveLength(0);
    expect(mockTrack).toHaveBeenCalledWith('light_seal_declined');
    expect(container.textContent).not.toContain('이렇게 기억해 둘게요');
    // no re-ask: the engine ran exactly once and no question input remains
    expect(mockNext).toHaveBeenCalledTimes(1);
    expect(container.querySelector('textarea[placeholder="한 줄이면 돼요"]')).toBeNull();
  });
});

describe('첫 생각 (first-thought anchor)', () => {
  const OFFER_TURN: LightTurn = {
    mirror: '내일 피곤만 아니면 되는 거네요.',
    action: 'offer',
    offer: { sentence: '케이크 자르고 나오면 내일 안 피곤하다', when: 'tomorrow_morning' },
  };

  it('the opening screen shows NO 처음 생각 line and the answer input is never pre-filled', () => {
    renderFlow();
    expect(container.textContent).not.toContain('처음 생각');
    const ta = container.querySelector<HTMLTextAreaElement>('textarea[placeholder="한 줄이면 돼요"]');
    expect(ta!.value).toBe('');
  });

  it('the next answer input is also empty after a turn (never pre-filled)', async () => {
    renderFlow();
    await answerOnce('남고 싶은데 내일이 걱정돼요', { mirror: 'm2', action: 'ask', question: '내일 몇 시에 일어나요?' });
    const ta = container.querySelector<HTMLTextAreaElement>('textarea[placeholder="한 줄이면 돼요"]');
    expect(ta!.value).toBe('');
  });

  it('the permission ask stays flowing — no 처음 생각 line before accept', async () => {
    renderFlow();
    await answerOnce('남고 싶은데 내일이 걱정돼요', OFFER_TURN);
    expect(container.textContent).not.toContain('처음 생각');
    assertNoGeneratedOptionButtons();
  });

  it('accepting keeps the first thought in the record AND shows it on the receipt', async () => {
    renderFlow();
    await answerOnce('남고 싶은데 내일이 걱정돼요', OFFER_TURN);
    await click(buttonByText('내일 아침에 물어봐 주세요')!);
    const contract = useProjectStore.getState().projects[0].decision_contract!;
    // EXISTING slot, no new field: the pre-review baseline that is never scored
    expect(contract.judgment_receipt?.baseline_judgment).toBe('남고 싶은데 내일이 걱정돼요');
    expect(contract.judgment_receipt?.human_judgment).toBe('케이크 자르고 나오면 내일 안 피곤하다');
    expect(contract.predicates).toHaveLength(1);
    // the receipt keeps the comparison readable: 처음 생각 → 남긴 판단
    expect(container.textContent).toContain('처음 생각 · 남고 싶은데 내일이 걱정돼요');
    expect(container.textContent).toContain('기억해 뒀어요. 내일 아침에 한 번만 물어볼게요.');
  });

  it('editing the receipt keeps the first thought intact in the stored record', async () => {
    renderFlow();
    await answerOnce('남고 싶은데 내일이 걱정돼요', OFFER_TURN);
    await click(buttonByText('내일 아침에 물어봐 주세요')!);
    await click(buttonByText('고쳐도 돼요')!);
    const editable = Array.from(container.querySelectorAll('textarea'))
      .find((t) => t.value === '케이크 자르고 나오면 내일 안 피곤하다')!;
    setTextarea(editable, '지금 나가도 후회 안 한다');
    await click(buttonByText('저장')!);
    const contract = useProjectStore.getState().projects[0].decision_contract!;
    expect(contract.judgment_receipt?.baseline_judgment).toBe('남고 싶은데 내일이 걱정돼요');
    expect(container.textContent).toContain('처음 생각 · 남고 싶은데 내일이 걱정돼요');
  });

  it('declining shows no 처음 생각 line (it belongs to the kept record only)', async () => {
    renderFlow();
    await answerOnce('남고 싶은데 내일이 걱정돼요', OFFER_TURN);
    await click(buttonByText('괜찮아요, 그냥 갈게요')!);
    expect(container.textContent).not.toContain('처음 생각');
  });
});

describe('escalation', () => {
  const ESCALATE_TURN: LightTurn = {
    mirror: '이건 오늘만의 얘기가 아니네요.',
    action: 'escalate',
    escalate: { bigger_question: '이 모임이 나에게 아직 즐거운가?' },
  };

  it('shows the verbatim headline + bigger question; accept hands off to heavy WITH the Q&A', async () => {
    const { onDeepen } = renderFlow();
    await answerOnce('사실 요즘 매번 이래요', ESCALATE_TURN);
    expect(mockTrack).toHaveBeenCalledWith('light_escalation_offered');
    expect(container.textContent).toContain('오늘 것 하나가 아니라, 더 큰 얘기네요.');
    expect(container.textContent).toContain('이 모임이 나에게 아직 즐거운가?');

    await click(buttonByText('지금 조금 더 볼래요')!);
    expect(mockTrack).toHaveBeenCalledWith('light_escalation_accepted');
    expect(onDeepen).toHaveBeenCalledTimes(1);
    const ctx = (onDeepen as ReturnType<typeof vi.fn>).mock.calls[0][0] as LightDeepenContext;
    expect(ctx.reason).toBe('escalate');
    expect(ctx.text).toContain(PROBLEM);
    expect(ctx.text).toContain('사실 요즘 매번 이래요');
  });

  it('"다음에 볼래요" closes lightly without a handoff and without nagging', async () => {
    const { onDeepen } = renderFlow();
    await answerOnce('사실 요즘 매번 이래요', ESCALATE_TURN);
    await click(buttonByText('다음에 볼래요')!);
    expect(onDeepen).not.toHaveBeenCalled();
    expect(container.textContent).toContain('네, 여기까지도 충분해요. 필요하면 언제든요.');
    assertNoGeneratedOptionButtons();
  });
});

describe('crisis pre-empt', () => {
  it('a crisis-marked turn stops the light flow and routes to the existing crisis surface', async () => {
    const { onDeepen } = renderFlow();
    await answerOnce('요즘 다 무의미하게 느껴져요', {
      mirror: '', action: 'close', crisis: { isCrisis: true, category: 'self_harm' },
    });
    expect(onDeepen).toHaveBeenCalledTimes(1);
    const ctx = (onDeepen as ReturnType<typeof vi.fn>).mock.calls[0][0] as LightDeepenContext;
    expect(ctx.reason).toBe('crisis');
    expect(ctx.text).toContain('요즘 다 무의미하게 느껴져요');
  });
});

describe('deepen link (user correction affordance)', () => {
  it('"더 깊이 보기" hands off to the heavy flow', async () => {
    const { onDeepen } = renderFlow();
    await click(buttonByText('더 깊이 보기')!);
    expect(mockTrack).toHaveBeenCalledWith('light_deepen_clicked');
    expect(onDeepen).toHaveBeenCalledTimes(1);
    expect((onDeepen as ReturnType<typeof vi.fn>).mock.calls[0][0].reason).toBe('deepen_link');
  });
});

describe('clean close', () => {
  it('"처음으로" on the close screen calls onClose', async () => {
    const { onClose } = renderFlow();
    await answerOnce('네', {
      mirror: 'm', action: 'offer',
      offer: { sentence: '한 줄', when: 'tonight' },
    });
    await click(buttonByText('괜찮아요, 그냥 갈게요')!);
    await click(buttonByText('처음으로')!);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
