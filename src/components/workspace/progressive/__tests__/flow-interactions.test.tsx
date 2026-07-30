// @vitest-environment jsdom
/**
 * Interaction tests for the pre-launch UX-polish behaviors — real clicks/keys in
 * jsdom (react-dom/client + act), proving the callbacks actually fire, not just
 * that text renders. Covers: QuestionCard skip/meta, VerificationGate ESC +
 * keep/skip/override, TeamDeployBanner track switch + replace, DMFeedback batch
 * apply/skip.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// ── Mocks (ProgressiveFlow's import graph) ──
vi.mock('@/lib/supabase', () => ({
  supabase: { from: vi.fn(), auth: { getSession: vi.fn(() => Promise.resolve({ data: { session: null } })) }, channel: vi.fn(() => ({ on: vi.fn().mockReturnThis(), subscribe: vi.fn() })), removeChannel: vi.fn() },
  getCurrentUserId: vi.fn(() => Promise.resolve(null)),
}));
vi.mock('@/hooks/useLocale', () => ({ useLocale: () => 'ko' }));
vi.mock('@/lib/agent-stats', () => ({ getAgentStats: () => null, getSessionDeltas: () => [] }));
vi.mock('@/components/workspace/progressive/WorkerAvatar', () => ({ WorkerAvatar: () => null, AvatarRow: () => null }));
// FinalCard deps: stub ShareBar to expose its getText() into the DOM, stub the
// voyage-log so the opt-in checkbox renders, and the store selector.
vi.mock('@/components/ui/ShareBar', () => ({ ShareBar: ({ getText }: { getText: () => string }) => createElement('div', { 'data-copy': getText() }) }));
vi.mock('@/lib/export', () => ({ voyageLogToMarkdown: () => 'LOGSTUB' }));
vi.mock('@/stores/useProgressiveStore', () => ({ useProgressiveStore: (sel: (s: unknown) => unknown) => sel({ sessions: [] }) }));

import { QuestionCard } from '@/components/workspace/progressive/shared/QuestionCard';
import { VerificationGate, TeamDeployBanner, DMFeedback, FinalCard, TerminalRouteCard } from '@/components/workspace/progressive/ProgressiveFlow';
import { CrewAtWork } from '@/components/workspace/progressive/CrewAtWork';
import { MixPreview } from '@/components/workspace/progressive/MixPreview';
import { BindCard } from '@/components/workspace/progressive/BindCard';
import { VersionHistoryDrawer } from '@/components/workspace/VersionHistoryDrawer';
import type { WorkerTask, WorkerPersona, DMFeedbackResult, MixResult } from '@/stores/types';

// ── jsdom harness ──
let container: HTMLDivElement;
let root: Root;
beforeEach(() => { container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container); });
afterEach(() => { act(() => root.unmount()); container.remove(); });

const render = (el: React.ReactElement) => act(() => { root.render(el); });
const click = (el: Element) => act(() => { el.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
const press = (key: string) => act(() => { document.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true })); });
const pressOn = (el: Element, key: string, isComposing = false) => act(() => {
  el.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, isComposing }));
});
// Find the most specific interactive element for `text`: prefer a visible-text
// match (shortest = deepest/most specific, never the dialog container), then
// fall back to aria-label/title for icon-only buttons.
const byText = (text: string): HTMLElement => {
  const els = Array.from(container.querySelectorAll('button, a, label')) as HTMLElement[];
  const textMatches = els
    .filter(e => (e.textContent || '').includes(text))
    .sort((a, b) => (a.textContent || '').length - (b.textContent || '').length);
  if (textMatches[0]) return textMatches[0];
  const attrMatch = els.find(e =>
    (e.getAttribute('aria-label') || '').includes(text) || (e.getAttribute('title') || '').includes(text));
  if (attrMatch) return attrMatch;
  throw new Error(`no element containing "${text}"`);
};

const persona = (id: string, name: string): WorkerPersona => ({
  id, name, role: '역할', expertise: '전문', tone: '톤', emoji: '🧪', color: '#000', keywords: [],
} as WorkerPersona);
const worker = (o: Partial<WorkerTask>): WorkerTask => ({
  id: 'w', step_index: 0, task: '작업', task_group_id: 'g', added_manually: false, original_task: '작업',
  who: 'ai', expected_output: '보고서', status: 'pending', persona: null, level: 'junior', stream_text: '',
  result: null, human_input: null, error: null, approved: null, completion_note: null, started_at: null,
  completed_at: null, agent_type: 'ai', ...o,
} as WorkerTask);
const mix: MixResult = {
  title: '시장 진입 초안',
  executive_summary: '작게 검증하고 확장합니다.',
  sections: [{ heading: '방향', content: '첫 시장에서 신호를 확인합니다.' }],
  key_assumptions: ['초기 고객 수요'],
  next_steps: ['고객 5명 인터뷰'],
};

describe('BindCard — authorship before commitment', () => {
  it('shows the user original before both the AI reframing and commitment prompt', () => {
    const onProceed = vi.fn();
    render(createElement(BindCard, {
      problem: '내가 직접 적은 원래 결정',
      recognition: 'AI가 새로 찾은 질문',
      onProceed,
    }));
    const text = container.textContent || '';
    expect(text).toContain('처음 적은 상황');
    expect(text.indexOf('내가 직접 적은 원래 결정')).toBeLessThan(text.indexOf('AI가 새로 찾은 질문'));
    expect(text.indexOf('내가 직접 적은 원래 결정')).toBeLessThan(text.indexOf('지금 생각을 한 줄로 남길까요?'));
    expect(container.querySelector('textarea')?.hasAttribute('autofocus')).toBe(false);
  });

  it('does not proceed during IME composition and resolves only once on repeated input', () => {
    const onProceed = vi.fn();
    render(createElement(BindCard, {
      problem: '내가 직접 적은 원래 결정',
      onProceed,
    }));
    const textarea = container.querySelector('textarea')!;
    pressOn(textarea, 'Enter', true);
    expect(onProceed).not.toHaveBeenCalled();
    click(byText('건너뛰고 계속'));
    click(byText('건너뛰고 계속'));
    expect(onProceed).toHaveBeenCalledWith(null);
    expect(onProceed).toHaveBeenCalledTimes(1);
  });

  it('lets long source text expand and exposes review-date controls accessibly', () => {
    const problem = '긴 원문 '.repeat(50);
    render(createElement(BindCard, { problem, onProceed: vi.fn() }));
    const quote = container.querySelector('blockquote')!;
    expect(quote.className).toContain('line-clamp-3');
    const expand = byText('전체 보기');
    expect(expand.getAttribute('aria-expanded')).toBe('false');
    click(expand);
    expect(quote.className).not.toContain('line-clamp-4');
    expect(byText('접기').getAttribute('aria-expanded')).toBe('true');

    const interval = byText('1일');
    expect(interval.getAttribute('aria-pressed')).toBe('false');
    const customDate = container.querySelector('input[type="date"]');
    expect(customDate?.getAttribute('aria-label')).toContain('직접 확인일');
  });
});

describe('QuestionCard — meta + skip', () => {
  it('connects the visible question and free-text field to accessible names', () => {
    render(createElement(QuestionCard, {
      question: { id: 'q', text: 'Which constraint matters most?', options: ['Time', 'Quality'] },
      onAnswer: vi.fn(), locale: 'en',
    }));
    const section = container.querySelector('section[aria-labelledby]');
    const input = container.querySelector('input[name="question-answer"]');
    const label = input ? container.querySelector(`label[for="${input.id}"]`) : null;
    expect(section).toBeTruthy();
    expect(input).toBeTruthy();
    expect(label?.textContent).toContain('Type your own answer');
  });

  it('renders the meta label and fires onSkip when skip is provided', () => {
    const onSkip = vi.fn();
    render(createElement(QuestionCard, {
      question: { id: 'q', text: '진짜 질문은?' },
      onAnswer: vi.fn(), locale: 'ko', meta: '2번째 질문 · 선택', onSkip, skipLabel: '건너뛰고 팀 투입',
    }));
    expect(container.textContent).toContain('2번째 질문 · 선택');
    click(byText('건너뛰고 팀 투입'));
    expect(onSkip).toHaveBeenCalledTimes(1);
  });

  it('renders NO skip affordance when onSkip is absent', () => {
    render(createElement(QuestionCard, { question: { id: 'q', text: 'x' }, onAnswer: vi.fn(), locale: 'ko' }));
    expect(container.textContent).not.toContain('건너뛰기');
    expect(container.textContent).not.toContain('건너뛰고');
  });

  it('does not submit Korean text while the IME is still composing', () => {
    const onAnswer = vi.fn();
    render(createElement(QuestionCard, { question: { id: 'q', text: '답은?' }, onAnswer, locale: 'ko', initialValue: '한글' }));
    const input = container.querySelector('input[name="question-answer"]')!;
    pressOn(input, 'Enter', true);
    expect(onAnswer).not.toHaveBeenCalled();
    pressOn(input, 'Enter', false);
    expect(onAnswer).toHaveBeenCalledWith('한글');
  });
});

describe('CrewAtWork — progress + report disclosure', () => {
  it('announces completion and connects both disclosure controls to their content', () => {
    const longResult = `핵심 발견 ${'상세 내용 '.repeat(35)}`;
    render(createElement(CrewAtWork, {
      workers: [
        worker({ id: 'done', step_index: 0, status: 'done', result: longResult, persona: persona('p1', '소피') }),
        worker({ id: 'running', step_index: 1, status: 'running', persona: persona('p2', '민준') }),
      ],
    }));

    const progress = container.querySelector('[role="progressbar"]');
    expect(progress?.getAttribute('aria-valuenow')).toBe('1');
    expect(progress?.getAttribute('aria-valuemax')).toBe('2');

    const crewToggle = container.querySelector('button[aria-expanded="false"][aria-controls]') as HTMLButtonElement;
    expect(crewToggle).toBeTruthy();
    const panelId = crewToggle.getAttribute('aria-controls')!;
    click(crewToggle);
    expect(document.getElementById(panelId)).toBeTruthy();

    const reportToggle = byText('열어보기');
    const reportId = reportToggle.getAttribute('aria-controls')!;
    click(reportToggle);
    expect(document.getElementById(reportId)?.textContent).toContain('상세 내용');
  });

  it('treats failed checks as settled but never claims they entered the draft', () => {
    render(createElement(CrewAtWork, {
      workers: [
        worker({ id: 'done', step_index: 0, status: 'done', result: '완료 결과', persona: persona('p1', '소피') }),
        worker({ id: 'failed', step_index: 1, status: 'validation_failed', persona: persona('p2', '민준') }),
      ],
    }));
    const progress = container.querySelector('[role="progressbar"]');
    expect(progress?.getAttribute('aria-valuenow')).toBe('2');
    expect(container.textContent).toContain('확인 필요 1');
    expect(container.textContent).not.toContain('전부 초안에 들어갑니다');
  });
});

describe('TerminalRouteCard — closure + forward action on a terminal route', () => {
  it('shows route-aware closure and wires both exits (draft + dig-in)', () => {
    const onDraft = vi.fn();
    const onContinue = vi.fn();
    render(createElement(TerminalRouteCard, { route: 'flat', busy: false, locale: 'ko', onDraft, onContinue }));
    // Names why the flow landed here (measurement language, not a verdict) and
    // gives closure — the session is no longer a silent dead-end.
    expect(container.textContent).toContain('여기서 마쳐도 돼요');
    expect(container.textContent).toContain('크게 다르지 않은');
    click(byText('이대로 문서로 정리하기'));
    expect(onDraft).toHaveBeenCalledTimes(1);
    click(byText('그래도 더 짚어볼래요'));
    expect(onContinue).toHaveBeenCalledTimes(1);
  });

  it('hides the dig-in exit while busy so the draft is not double-fired', () => {
    render(createElement(TerminalRouteCard, { route: 'vent', busy: true, locale: 'ko', onDraft: vi.fn(), onContinue: vi.fn() }));
    expect(container.textContent).not.toContain('그래도 더 짚어볼래요');
  });
});

describe('VerificationGate — ESC + keep/skip/override', () => {
  const unreviewed = [worker({ id: 'u1', status: 'done', result: '핵심 발견 텍스트', approved: null, persona: persona('s', '소피') })];

  it('ESC key closes the gate', () => {
    const onClose = vi.fn();
    render(createElement(VerificationGate, { workers: unreviewed, onApprove: vi.fn(), onReject: vi.fn(), onSail: vi.fn(), onOverride: vi.fn(), onClose }));
    press('Escape');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('반영 fires onApprove, 제외 fires onReject, override fires onOverride', () => {
    const onApprove = vi.fn(), onReject = vi.fn(), onOverride = vi.fn();
    render(createElement(VerificationGate, { workers: unreviewed, onApprove, onReject, onSail: vi.fn(), onOverride, onClose: vi.fn() }));
    click(byText('반영')); expect(onApprove).toHaveBeenCalledWith('u1');
    click(byText('제외')); expect(onReject).toHaveBeenCalledWith('u1');
    click(byText('확인 없이 모두 반영하고 정리하기')); expect(onOverride).toHaveBeenCalledTimes(1);
  });

  it('sail is disabled while results remain, enabled when none', () => {
    const onSail = vi.fn();
    render(createElement(VerificationGate, { workers: unreviewed, onApprove: vi.fn(), onReject: vi.fn(), onSail, onOverride: vi.fn(), onClose: vi.fn() }));
    const sail = byText('남음') as HTMLButtonElement; // "N개 남음"
    expect(sail.disabled).toBe(true);
    render(createElement(VerificationGate, { workers: [], onApprove: vi.fn(), onReject: vi.fn(), onSail, onOverride: vi.fn(), onClose: vi.fn() }));
    const sail2 = byText('정리하기') as HTMLButtonElement;
    expect(sail2.disabled).toBe(false);
    click(sail2); expect(onSail).toHaveBeenCalledTimes(1);
  });
});

describe('TeamDeployBanner — track switch + replace', () => {
  it('track buttons call onSetGroupTrack; 교체 calls onReplaceWorker', () => {
    const onSetGroupTrack = vi.fn(), onReplaceWorker = vi.fn();
    render(createElement(TeamDeployBanner, {
      workers: [worker({ id: 'a1', task_group_id: 'g1', agent_type: 'ai', persona: persona('s', '소피'), assignment_reason: '시장 분석에 가장 적합' })],
      onDeploy: vi.fn(), onSetGroupTrack, onReplaceWorker, onRemoveWorker: vi.fn(),
    }));
    // Hick's Law: customization is collapsed by default — open "팀 손보기" (Adjust team) first.
    click(byText('팀 손보기'));
    click(byText('내가 직접')); expect(onSetGroupTrack).toHaveBeenCalledWith('g1', 'self');
    click(byText('사람에게')); expect(onSetGroupTrack).toHaveBeenCalledWith('g1', 'human');
    click(byText('이 팀원 교체')); expect(onReplaceWorker).toHaveBeenCalledWith('a1');
  });
});

describe('DMFeedback — batch apply / skip', () => {
  const fb = (applied: boolean[]): DMFeedbackResult => ({
    persona_name: '김CFO', persona_role: 'CFO', first_reaction: '음.', good_parts: [],
    concerns: applied.map((a, i) => ({ text: `concern ${i}`, severity: 'important', fix_suggestion: 'fix', applied: a })),
    would_ask: [], approval_condition: '모두 반영',
  } as DMFeedbackResult);

  it('모두 반영 toggles only the un-applied concerns', () => {
    const onToggle = vi.fn();
    render(createElement(DMFeedback, { fb: fb([false, true, false]), onToggle, onFinalize: vi.fn(), busy: false }));
    click(byText('모두 반영'));
    expect(onToggle.mock.calls.map(c => c[0]).sort()).toEqual([0, 2]); // indexes 0 and 2 were un-applied
  });

  it('모두 해제 toggles only the applied concerns', () => {
    const onToggle = vi.fn();
    render(createElement(DMFeedback, { fb: fb([true, false, true]), onToggle, onFinalize: vi.fn(), busy: false }));
    click(byText('모두 해제'));
    expect(onToggle.mock.calls.map(c => c[0]).sort()).toEqual([0, 2]);
  });

  it('exposes each revision as a switch and names the final action with the selected count', () => {
    render(createElement(DMFeedback, { fb: fb([true, false, true]), onToggle: vi.fn(), onFinalize: vi.fn(), busy: false }));
    expect(container.textContent).toContain('AI가 맡은 검토 관점');
    expect(container.textContent).toContain('실제 당사자의 의견이 아니에요');
    expect(container.textContent).toContain('AI 예상 첫 반응');
    expect(container.querySelector('blockquote')).toBeNull();
    const switches = Array.from(container.querySelectorAll('[role="switch"]'));
    expect(switches).toHaveLength(3);
    expect(switches[0].getAttribute('aria-checked')).toBe('true');
    // The selected count is shown once, by the pill (the duplicate sentence was removed).
    expect(container.textContent).toContain('2/3');
    expect(byText('선택한 2건 반영하고 완성')).toBeTruthy();
  });
});

describe('MixPreview — draft disclosure + next action', () => {
  it('connects the full draft disclosure and keeps review/finalize choices explicit', () => {
    const onDM = vi.fn(), onSkip = vi.fn();
    render(createElement(MixPreview, { mix, dm: '김CFO', onDM, onSkip, busy: false }));
    const toggle = byText('전문 보기');
    const bodyId = toggle.getAttribute('aria-controls')!;
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    click(toggle);
    expect(document.getElementById(bodyId)?.getAttribute('role')).toBe('region');
    expect(container.textContent).toContain('다음 선택');
    click(byText('검토 받기')); expect(onDM).toHaveBeenCalledTimes(1);
    click(byText('검토 건너뛰고')); expect(onSkip).toHaveBeenCalledTimes(1);
  });
});

describe('FinalCard — copy defaults clean, log is opt-in', () => {
  const copyText = () => (container.querySelector('[data-copy]') as HTMLElement).getAttribute('data-copy') || '';
  it('default copy is the clean document (no decision log)', () => {
    render(createElement(FinalCard, { content: '문서본문', mix: null, sessionId: null }));
    expect(copyText()).toContain('문서본문');
    expect(copyText()).not.toContain('LOGSTUB');
  });
  it('checking the opt-in appends the decision log', () => {
    render(createElement(FinalCard, { content: '문서본문', mix: null, sessionId: null }));
    const checkbox = container.querySelector('input[type=checkbox]') as HTMLInputElement;
    expect(checkbox).toBeTruthy();
    click(checkbox);
    expect(copyText()).toContain('LOGSTUB');
  });
  it('connects the collapsed preview to the final document body', () => {
    render(createElement(FinalCard, { content: '문서본문', mix, sessionId: null, defaultCollapsed: true }));
    const toggle = byText('여기서 전체 읽기');
    const bodyId = toggle.getAttribute('aria-controls')!;
    click(toggle);
    expect(document.getElementById(bodyId)?.getAttribute('role')).toBe('document');
    expect(container.querySelector('article[aria-labelledby]')).toBeTruthy();
  });
  it('keeps older restored documents readable when next-step arrays are absent', () => {
    const legacyMix = { ...mix, next_steps: undefined, key_assumptions: undefined } as unknown as MixResult;
    render(createElement(FinalCard, { content: '문서본문', mix: legacyMix, sessionId: null, defaultCollapsed: true }));
    expect(container.textContent).toContain('1개 섹션');
    expect(byText('여기서 전체 읽기')).toBeTruthy();
  });
});

describe('VersionHistoryDrawer — layered navigation', () => {
  const nodes = [
    { id: 'v1', parent_id: null, label: 'v0.1', summary: '첫 번째 초안', created_at: new Date().toISOString() },
    { id: 'v2', parent_id: 'v1', label: 'v0.2', summary: '근거를 보강한 수정본', created_at: new Date().toISOString(), is_released: false },
  ];

  it('acts as a dialog, previews from a real button, branches, and closes with Escape', () => {
    const onClose = vi.fn(), onPreview = vi.fn(), onBranch = vi.fn();
    render(createElement(VersionHistoryDrawer, {
      nodes,
      activeLeafId: 'v2',
      activePathIds: new Set(['v1', 'v2']),
      previewNodeId: null,
      onClose,
      onPreview,
      onBranch,
      onPromote: vi.fn(),
    }));
    expect(container.querySelector('#version-history-drawer[role="dialog"]')).toBeTruthy();
    click(byText('첫 번째 초안')); expect(onPreview).toHaveBeenCalledWith('v1');
    click(byText('이 버전에서 수정')); expect(onBranch).toHaveBeenCalledWith('v1');
    press('Escape'); expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('leaves Escape to the version preview when it is layered above the drawer', () => {
    const onClose = vi.fn();
    render(createElement(VersionHistoryDrawer, {
      nodes,
      activeLeafId: 'v2',
      activePathIds: new Set(['v1', 'v2']),
      previewNodeId: 'v1',
      onClose,
      onPreview: vi.fn(),
      onBranch: vi.fn(),
      onPromote: vi.fn(),
    }));
    press('Escape');
    expect(onClose).not.toHaveBeenCalled();
  });
});
