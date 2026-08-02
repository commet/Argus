import { describe, expect, it } from 'vitest';
import { assertCompleteJudgeResult } from './judge.mjs';

const verdict = { verdict: 'PASS', severity: null, evidence: '', note: '' };
const keys = [
  'route_fit', 'ownership', 'fact_lineage', 'premise_quality',
  'question_value', 'update_fidelity', 'restraint', 'language',
  'baseline_use', 'update_legibility',
];

describe('simulation judge result contract', () => {
  it('rejects a repaired but incomplete JSON fragment', () => {
    expect(() => assertCompleteJudgeResult({
      criteria: { route_fit: verdict },
    })).toThrow(/judge_incomplete/);
  });

  it('accepts a verdict only when every experience axis is present', () => {
    const complete = {
      criteria: Object.fromEntries(keys.map((key) => [key, verdict])),
    };
    expect(assertCompleteJudgeResult(complete)).toBe(complete);
  });
});
