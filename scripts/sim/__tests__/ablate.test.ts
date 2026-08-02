/**
 * The ablation instrument, verified before it is trusted.
 *
 * ablate() removes one named block from a real prompt so the sim can measure
 * what that block buys. If it removed too much, every ablation would look
 * load-bearing; if it removed nothing, every rule would look like dead weight
 * and the honest recommendation would be to delete the harness. Both failures
 * are silent, and both produce a confident table — which is the shape of every
 * gate-that-measures-nothing this repo has met.
 */
import { describe, expect, it } from 'vitest';
import { ablate } from '../sim-entry';
import { buildInitialJudgmentPrompt, buildDeepeningJudgmentPrompt } from '@/lib/judgment-harness-v2';
import type { AnalysisSnapshot } from '@/stores/types';

function withEnv<T>(spec: string, fn: () => T): T {
  const prev = process.env.ARGUS_SIM_ABLATE;
  process.env.ARGUS_SIM_ABLATE = spec;
  try {
    return fn();
  } finally {
    if (prev === undefined) delete process.env.ARGUS_SIM_ABLATE;
    else process.env.ARGUS_SIM_ABLATE = prev;
  }
}

const initial = () => buildInitialJudgmentPrompt('결정 하나 있어요.', 'ko').system;
const deepening = () => buildDeepeningJudgmentPrompt(
  '결정 하나 있어요.',
  { real_question: 'q', hidden_assumptions: [], skeleton: [] } as unknown as AnalysisSnapshot,
  [], 1, 3, 'ko',
).system;

describe('it does nothing when asked for nothing', () => {
  it('returns the prompt byte-identical', () => {
    const p = initial();
    expect(withEnv('', () => ablate(p))).toBe(p);
    expect(withEnv('   ', () => ablate(p))).toBe(p);
  });
});

describe('it removes the block, and only the block', () => {
  const MARKER = '- MENTIONING IS NOT MATTERING.';

  it('takes the marker line and its continuation lines', () => {
    const before = initial();
    const after = withEnv(MARKER, () => ablate(before));
    expect(before).toContain(MARKER);
    expect(after).not.toContain(MARKER);
    expect(after).not.toContain('the inference feels');
  });

  it('leaves the neighbouring rules standing', () => {
    const after = withEnv(MARKER, () => ablate(initial()));
    expect(after).toContain('- SILENCE IS NOT DATA.');
    expect(after).toContain('11. ASK, DO NOT ASSERT.');
    expect(after).toContain('Return JSON only:');
  });

  it('shortens the prompt by a real amount, not a line', () => {
    const before = initial();
    const after = withEnv(MARKER, () => ablate(before));
    const removed = before.length - after.length;
    expect(removed).toBeGreaterThan(100);
    expect(removed).toBeLessThan(before.length / 4);
  });
});

describe('it can take several at once', () => {
  it('removes each named block', () => {
    const after = withEnv(
      '- SILENCE IS NOT DATA.,- HOW THEY SAID IT IS NOT DATA EITHER.',
      () => ablate(initial()),
    );
    expect(after).not.toContain('- SILENCE IS NOT DATA.');
    expect(after).not.toContain('- HOW THEY SAID IT IS NOT DATA EITHER.');
    expect(after).toContain('- MENTIONING IS NOT MATTERING.');
  });
});

describe('a marker that matches nothing changes nothing', () => {
  it('leaves the prompt alone rather than corrupting it', () => {
    // ablate.mjs refuses to run on a dead marker; here the safe behaviour is
    // simply not to damage the prompt.
    const p = initial();
    expect(withEnv('- THIS RULE DOES NOT EXIST.', () => ablate(p))).toBe(p);
  });
});

describe('it works on the deepening prompt too', () => {
  it('removes a deepening-only block', () => {
    const before = deepening();
    const after = withEnv('   ONE CLAIM PER PREMISE.', () => ablate(before));
    expect(before).toContain('ONE CLAIM PER PREMISE.');
    expect(after).not.toContain('ONE CLAIM PER PREMISE.');
    expect(after).toContain('Return JSON only:');
  });
});
