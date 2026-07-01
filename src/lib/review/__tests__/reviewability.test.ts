import { describe, it, expect } from 'vitest';
import { scoreReviewability } from '../reviewability';
import { reviewabilityBand } from '../schema';
import { ingest } from '../ingest';

describe('reviewabilityBand thresholds', () => {
  it('bands by score', () => {
    expect(reviewabilityBand(90)).toBe('normal');
    expect(reviewabilityBand(70)).toBe('caveated');
    expect(reviewabilityBand(50)).toBe('limited');
    expect(reviewabilityBand(20)).toBe('insufficient');
  });
});

describe('scoreReviewability', () => {
  it('scores unsupported artifacts as insufficient', () => {
    const a = ingest({ source_kind: 'pdf', title: 'scan.pdf' });
    const s = scoreReviewability(a);
    expect(s.extraction).toBe(0);
    expect(reviewabilityBand(s.score)).toBe('insufficient');
    expect(s.reasons.join(' ')).toContain('빠졌는지');
  });

  it('scores a well-structured markdown memo highly', () => {
    const a = ingest({
      source_kind: 'markdown',
      text: '# 전략\n\n## 근거\n\n- a\n- b\n\n## 리스크\n\n본문',
    });
    const s = scoreReviewability(a);
    expect(s.extraction).toBe(100);
    expect(s.anchor_coverage).toBe(100);
    expect(s.score).toBeGreaterThanOrEqual(60);
  });
});
