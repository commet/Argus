import { describe, expect, it } from 'vitest';
import type { DecisionContract } from '@/stores/types';
import { gradePredicate } from '../decision-contract';
import { applySettlementReceipt, settlementWhatHappenedLine } from '../settlement-receipt';

const contract: DecisionContract = {
  id: 'c1',
  project_id: 'p1',
  created_at: '2026-07-01T00:00:00.000Z',
  check_in_at: '2026-07-07T00:00:00.000Z',
  predicates: [{ id: 'pred_1', source: 'governing_idea', text: 'conversion stays above 4%' }],
  judgment_receipt: {
    real_question: '가격을 올릴까?',
    unverified_assumption: 'conversion이 유지된다',
    human_only: '브랜드 리스크를 감수할지',
    human_judgment: '이번 분기에 가격을 올린다',
    check_by: '2026-07-07',
  },
};

describe('settlement receipt contract', () => {
  it('fills WHAT HAPPENED on the same tap that records the verdict', () => {
    const now = Date.UTC(2026, 6, 7, 9);
    const graded = gradePredicate(contract, 'pred_1', 'missed', now);
    const settled = applySettlementReceipt(graded, 'missed', new Date(now).toISOString(), 'ko');

    expect(settled.predicates[0].verdict).toBe('missed');
    expect(settled.judgment_receipt?.what_happened).toBe('빗나갔다');
    expect(settled.judgment_receipt?.settled_at).toBe('2026-07-07T09:00:00.000Z');
    expect(settled.judgment_receipt).not.toHaveProperty('ai_verdict');
  });

  it('keeps a user narrative if they typed one before tapping', () => {
    const settled = applySettlementReceipt(contract, 'partial', '2026-07-07T09:00:00.000Z', 'ko', 'conversion landed at 3.2%');

    expect(settled.judgment_receipt?.what_happened).toBe('conversion landed at 3.2%');
  });

  it('does not engrave pending as a settlement', () => {
    expect(applySettlementReceipt(contract, 'pending', '2026-07-07T09:00:00.000Z').judgment_receipt?.what_happened)
      .toBeUndefined();
  });

  it('maps the four visible taps into neutral receipt lines', () => {
    expect(settlementWhatHappenedLine('happened', 'ko')).toBe('대체로 맞았다');
    expect(settlementWhatHappenedLine('missed', 'ko')).toBe('빗나갔다');
    expect(settlementWhatHappenedLine('partial', 'ko')).toBe('부분적으로 맞았다');
    expect(settlementWhatHappenedLine('unknown', 'ko')).toBe('아직 판단하기 어렵다');
  });
});
