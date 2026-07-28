import { describe, expect, it } from 'vitest';
import { boundDeepExecutionPlan, recommendDeepJudgment } from '@/lib/judgment-depth';

describe('deep judgment policy', () => {
  it('does not recommend agent ceremony for a non-open request', () => {
    expect(recommendDeepJudgment({
      request_type: 'validation',
      stakes: 'critical',
      reversibility: 'irreversible',
      hidden_assumptions: ['a', 'b', 'c'],
    })).toEqual({ recommended: false, reasons: [] });
  });

  it('recommends deep judgment from decision facts without choosing a side', () => {
    expect(recommendDeepJudgment({
      request_type: 'open',
      stakes: 'critical',
      reversibility: 'irreversible',
      hidden_assumptions: ['a'],
    })).toEqual({
      recommended: true,
      reasons: ['critical_stakes', 'irreversible'],
    });
  });

  it('caps an important run at two AI specialists while retaining human work', () => {
    const steps = [
      { task: 'A', output: 'a', agent_type: 'ai', depends_on: [] },
      { task: 'B', output: 'b', agent_type: 'ai', depends_on: [0] },
      { task: 'C', output: 'c', agent_type: 'ai', depends_on: [1] },
      { task: 'Ask owner', output: 'answer', agent_type: 'human', depends_on: [2, 0] },
    ];

    expect(boundDeepExecutionPlan(steps, { stakes: 'important', reversibility: 'partial' })).toEqual([
      steps[0],
      steps[1],
      { ...steps[3], depends_on: [0] },
    ]);
  });

  it('allows a third AI worker only for a critical run', () => {
    const steps = Array.from({ length: 5 }, (_, index) => ({
      task: String(index),
      output: String(index),
      agent_type: 'ai',
    }));
    expect(boundDeepExecutionPlan(steps, { stakes: 'critical', reversibility: 'partial' })).toHaveLength(3);
  });
});
