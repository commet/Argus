import { describe, it, expect } from 'vitest';
import { buildNavigatorReviewPrompt } from '../progressive-prompts';

const wr = [
  { agentName: '다은', agentRole: '리서치', task: '시장 조사', result: '시장은 성장 중...' },
  { agentName: '규민', agentRole: '수치', task: '비용 추정', result: 'ROI 약 1.4배...' },
];

describe('navigator review — verify depth scaling', () => {
  it('light: a single neutral crux, and the spine guard (no manufactured fork)', () => {
    const { system } = buildNavigatorReviewPrompt('p', wr, 'ko', 'light');
    expect(system).toContain('LIGHT CHECK');
    expect(system).toContain('single most load-bearing');
    expect(system).toMatch(/do NOT manufacture concerns/i);
    expect(system).toMatch(/Never assert a verdict/i);
  });

  it('deep: exhaustive pushback', () => {
    const { system } = buildNavigatorReviewPrompt('p', wr, 'ko', 'deep');
    expect(system).toContain('DEEP CHECK');
    expect(system).toContain('exhaustive');
  });

  it('standard (default): neither extra block — preserves prior behavior', () => {
    const { system } = buildNavigatorReviewPrompt('p', wr, 'ko');
    expect(system).not.toContain('LIGHT CHECK');
    expect(system).not.toContain('DEEP CHECK');
  });
});
