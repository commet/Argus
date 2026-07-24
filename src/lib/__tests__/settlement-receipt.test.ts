import { describe, expect, it } from 'vitest';
import type { DecisionContract } from '@/stores/types';
import { gradePredicate } from '../decision-contract';
import { applySettlementReceipt } from '../settlement-receipt';

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
  it('records settlement time without inventing a description of reality', () => {
    const now = Date.UTC(2026, 6, 7, 9);
    const graded = gradePredicate(contract, 'pred_1', 'missed', now);
    const settled = applySettlementReceipt(graded, 'missed', new Date(now).toISOString());

    expect(settled.predicates[0].verdict).toBe('missed');
    expect(settled.judgment_receipt?.what_happened).toBeUndefined();
    expect(settled.judgment_receipt?.settled_at).toBe('2026-07-07T09:00:00.000Z');
    expect(settled.judgment_receipt).not.toHaveProperty('ai_verdict');
  });

  it('keeps a user narrative if they typed one before tapping', () => {
    const settled = applySettlementReceipt(contract, 'partial', '2026-07-07T09:00:00.000Z', 'conversion landed at 3.2%');

    expect(settled.judgment_receipt?.what_happened).toBe('conversion landed at 3.2%');
  });

  it('does not engrave pending as a settlement', () => {
    expect(applySettlementReceipt(contract, 'pending', '2026-07-07T09:00:00.000Z').judgment_receipt?.what_happened)
      .toBeUndefined();
  });

  it('preserves an earlier user narrative when the structured verdict changes', () => {
    const withNarrative: DecisionContract = {
      ...contract,
      judgment_receipt: {
        ...contract.judgment_receipt!,
        what_happened: 'conversion landed at 3.2%',
      },
    };
    const settled = applySettlementReceipt(withNarrative, 'missed', '2026-07-08T09:00:00.000Z');

    expect(settled.judgment_receipt?.what_happened).toBe('conversion landed at 3.2%');
    expect(settled.judgment_receipt?.settled_at).toBe('2026-07-08T09:00:00.000Z');
  });
});
