import { describe, expect, it } from 'vitest';
import { DEFAULT_BUDGET, selectReviewBudget } from '../schema';

describe('selectReviewBudget', () => {
  it('keeps a small multi-page document on the single-call quick path', () => {
    expect(selectReviewBudget(10_000, 60)).toBe(DEFAULT_BUDGET.quick);
  });

  it('uses the standard path for a longer document', () => {
    expect(selectReviewBudget(12_001, 60)).toBe(DEFAULT_BUDGET.standard);
  });

  it('uses the standard path when a document has too many extracted units', () => {
    expect(selectReviewBudget(10_000, 81)).toBe(DEFAULT_BUDGET.standard);
  });
});
