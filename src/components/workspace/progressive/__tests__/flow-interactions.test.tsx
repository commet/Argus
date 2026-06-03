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
import { VerificationGate, TeamDeployBanner, DMFeedback, FinalCard } from '@/components/workspace/progressive/ProgressiveFlow';
import type { WorkerTask, WorkerPersona, DMFeedbackResult } from '@/stores/types';

// ── jsdom harness ──
let container: HTMLDivElement;
let root: Root;
beforeEach(() => { container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container); });
afterEach(() => { act(() => root.unmount()); container.remove(); });

const render = (el: React.ReactElement) => act(() => { root.render(el); });
const click = (el: Element) => act(() => { el.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
const press = (key: string) => act(() => { document.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true })); });
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

describe('QuestionCard — meta + skip', () => {
  it('renders the meta label and fires onSkip when skip is provided', () => {
    const onSkip = vi.fn();
    render(createElement(QuestionCard, {
      question: { id: 'q', text: '진짜 질문은?' },
      onAnswer: vi.fn(), locale: 'ko', meta: '2번째 질문 · 선택', onSkip, skipLabel: '건너뛰고 출항',
    }));
    expect(container.textContent).toContain('2번째 질문 · 선택');
    click(byText('건너뛰고 출항'));
    expect(onSkip).toHaveBeenCalledTimes(1);
  });

  it('renders NO skip affordance when onSkip is absent', () => {
    render(createElement(QuestionCard, { question: { id: 'q', text: 'x' }, onAnswer: vi.fn(), locale: 'ko' }));
    expect(container.textContent).not.toContain('건너뛰기');
    expect(container.textContent).not.toContain('건너뛰고');
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
    click(byText('확인 없이 모두 반영하고 출항')); expect(onOverride).toHaveBeenCalledTimes(1);
  });

  it('sail is disabled while results remain, enabled when none', () => {
    const onSail = vi.fn();
    render(createElement(VerificationGate, { workers: unreviewed, onApprove: vi.fn(), onReject: vi.fn(), onSail, onOverride: vi.fn(), onClose: vi.fn() }));
    const sail = byText('남음') as HTMLButtonElement; // "N개 남음"
    expect(sail.disabled).toBe(true);
    render(createElement(VerificationGate, { workers: [], onApprove: vi.fn(), onReject: vi.fn(), onSail, onOverride: vi.fn(), onClose: vi.fn() }));
    const sail2 = byText('출항') as HTMLButtonElement;
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
});
