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
});
