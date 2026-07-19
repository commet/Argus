// @vitest-environment jsdom

import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FeedbackRecord, Persona } from '@/stores/types';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
vi.mock('@/hooks/useLocale', () => ({ useLocale: () => 'ko' }));

import { StakeholderClaimMatrix } from '@/components/tools/StakeholderClaimMatrix';

const persona: Persona = {
  id: 'cfo', name: '재무 책임자', role: 'CFO', organization: 'Argus', priorities: '',
  communication_style: '', known_concerns: '', relationship_notes: '', influence: 'high',
  extracted_traits: [], feedback_logs: [], created_at: '', updated_at: '',
};

const record: FeedbackRecord = {
  id: 'feedback-one',
  document_title: '성장 계획',
  document_text: '# 목표\n\n이번 분기 유료 전환율을 12%로 높인다.\n\n# 실행\n\n온보딩 화면을 단순화하고 2주간 실험한다.',
  persona_ids: ['cfo'], feedback_perspective: '', feedback_intensity: '', synthesis: '', created_at: '',
  results: [{
    persona_id: 'cfo', overall_reaction: '', failure_scenario: '', untested_assumptions: [],
    classified_risks: [{ text: '유료 전환율 12%의 산출 근거가 부족하다.', category: 'critical' }],
    first_questions: ['법무 검토 일정은 언제인가?'], praise: [], concerns: [], wants_more: [], approval_conditions: [],
  }],
};

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  vi.useRealTimers();
  act(() => root.unmount());
  container.remove();
  document.body.querySelector('[role="dialog"]')?.remove();
});

describe('StakeholderClaimMatrix', () => {
  it('reveals the linked statement and opens the exact source line', () => {
    act(() => root.render(createElement(StakeholderClaimMatrix, { record, personas: [persona], onOpenPersona: vi.fn() })));

    const linkedCell = container.querySelector('button[aria-label="재무 책임자: 반론·위험 1"]') as HTMLButtonElement;
    act(() => linkedCell.click());
    expect(container.textContent).toContain('유료 전환율 12%의 산출 근거가 부족하다.');

    const source = Array.from(container.querySelectorAll('button')).find((button) => button.textContent?.includes('원문 L3 보기'))!;
    act(() => source.click());
    const dialog = document.body.querySelector('[role="dialog"]')!;
    expect(dialog.textContent).toContain('성장 계획');
    expect(dialog.querySelector('[data-highlighted="true"]')?.textContent).toContain('이번 분기 유료 전환율을 12%로 높인다.');
  });

  it('keeps unmapped feedback visible and opens the persona detail path', () => {
    const onOpenPersona = vi.fn();
    act(() => root.render(createElement(StakeholderClaimMatrix, { record, personas: [persona], onOpenPersona })));

    const unmapped = container.querySelector('button[aria-label="재무 책임자: 원문에 직접 연결되지 않은 반응 1건"]') as HTMLButtonElement;
    act(() => unmapped.click());
    expect(container.textContent).toContain('법무 검토 일정은 언제인가?');

    const detail = Array.from(container.querySelectorAll('button')).find((button) => button.textContent?.includes('전체 피드백'))!;
    act(() => detail.click());
    expect(onOpenPersona).toHaveBeenCalledWith('cfo');
  });

  it('promotes a simulated statement into a persisted reality check and records the real outcome', () => {
    const onUpdateRealityChecks = vi.fn();
    const render = (nextRecord: FeedbackRecord) => act(() => root.render(createElement(StakeholderClaimMatrix, {
      record: nextRecord,
      personas: [persona],
      onOpenPersona: vi.fn(),
      onUpdateRealityChecks,
    })));

    render(record);
    act(() => (container.querySelector('button[aria-label="재무 책임자: 반론·위험 1"]') as HTMLButtonElement).click());
    const add = Array.from(container.querySelectorAll('button')).find((button) => button.textContent?.includes('실제 확인에 추가'))!;
    act(() => add.click());

    const added = onUpdateRealityChecks.mock.calls[0][1];
    expect(added).toHaveLength(1);
    expect(added[0]).toMatchObject({
      statement_id: 'cfo:risk:0',
      statement: '유료 전환율 12%의 산출 근거가 부족하다.',
      status: 'pending',
    });
    expect(added[0].claim_id).toContain('claim:feedback-one:3');

    const persistedRecord: FeedbackRecord = {
      ...record,
      results: [{ ...record.results[0], reality_checks: added }],
    };
    onUpdateRealityChecks.mockClear();
    render(persistedRecord);
    expect(container.textContent).toContain('실제 확인 0/1');

    const disputed = Array.from(container.querySelectorAll('button')).find((button) => button.textContent?.includes('달랐음'))!;
    act(() => disputed.click());
    const disputedChecks = onUpdateRealityChecks.mock.calls[0][1];
    expect(disputedChecks[0].status).toBe('contradicted');
    expect(disputedChecks[0].checked_at).toBeTruthy();

    onUpdateRealityChecks.mockClear();
    render({ ...persistedRecord, results: [{ ...persistedRecord.results[0], reality_checks: disputedChecks }] });
    const note = container.querySelector('input[placeholder="실제 답변이나 확인 경로 메모"]') as HTMLInputElement;
    act(() => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
      setter?.call(note, ' 실제 CFO 인터뷰에서 반대 확인 ');
      note.dispatchEvent(new Event('input', { bubbles: true }));
      note.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
    });
    expect(onUpdateRealityChecks.mock.calls.at(-1)?.[1][0].note).toBe('실제 CFO 인터뷰에서 반대 확인');
  });

  it('focuses the exact persisted reality check requested by a project deep link', () => {
    vi.useFakeTimers();
    const scrollIntoView = vi.fn();
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: scrollIntoView });
    const linkedRecord: FeedbackRecord = {
      ...record,
      results: [{
        ...record.results[0],
        reality_checks: [
          { id: 'check-one', statement_id: 's1', statement: '첫 번째 확인', question: '첫 번째인가?', status: 'pending', created_at: '' },
          { id: 'check-two', statement_id: 's2', statement: '재무팀이 실제로 승인했는가', question: '승인했는가?', status: 'pending', created_at: '' },
        ],
      }],
    };

    act(() => root.render(createElement(StakeholderClaimMatrix, {
      record: linkedRecord,
      personas: [persona],
      onOpenPersona: vi.fn(),
      focusRealityCheckId: 'check-two',
    })));
    act(() => vi.advanceTimersByTime(60));

    const target = container.querySelector('#stakeholder-reality-check-check-two') as HTMLElement;
    expect(document.activeElement).toBe(target);
    expect(target.textContent).toContain('재무팀이 실제로 승인했는가');
    expect(scrollIntoView).toHaveBeenCalledTimes(1);
  });
});
