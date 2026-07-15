import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * R41 — seal→settle integrity ("reality is the judge, not the model") is the
 * FOUNDATION of the n=1 moat: a record full of unfalsifiable seals or model-graded
 * outcomes is worthless. R41 measured it held 7/7 across haiku/sonnet/opus and all
 * 5 trap types — but the safety BUFFER thinned monotonically toward the weakest
 * tier (the one most plugin users run): a weak tier self-graded the verdict
 * ("결과: 실패" by mapping facts→criteria) instead of letting the user settle. It
 * landed correct only because the fixture's facts were unambiguous; a real
 * settlement fed by self-serving memory will not be.
 *
 * The two load-bearing rules pinned here (rules=data hardening — a markdown skill
 * can't run a post-filter, but a careless future edit must not silently strip the
 * moat's foundation):
 *  (a) SEAL-side: a predicate with no nameable fail_condition is NOT sealed (null) —
 *      else settlement is theater.
 *  (b) SETTLE-side: the recorded outcome IS the user's stated answer; the skill
 *      NEVER infers/self-grades it (hoisted to the point of action in R41).
 */
const sail = readFileSync(join(process.cwd(), 'argus-plugin-v2/skills/sail/SKILL.md'), 'utf8');
const settle = readFileSync(join(process.cwd(), 'argus-plugin-v2/skills/resolve/SKILL.md'), 'utf8');

describe('R41 — SEAL-side falsifiability (no fail_condition → not sealed)', () => {
  it('the contract seed requires pass AND fail conditions', () => {
    expect(sail).toMatch(/pass_condition/);
    expect(sail).toMatch(/fail_condition/);
  });

  it('an unfalsifiable seed is refused (null), not sealed as vibes', () => {
    expect(sail).toMatch(/not falsifiable.*write\s*`?null`?|cannot name (a )?(one|fail).*null/i);
    expect(sail).toMatch(/[Cc]ontract seed must be falsifiable/);
  });
});

describe('R41 — SETTLE-side no-self-grading (user states the outcome, at the point of action)', () => {
  it('the recorded outcome is the user\'s tapped option, never a model verdict (hoisted to Step 2)', () => {
    expect(settle).toMatch(/recorded outcome IS the user's tapped option/);
    expect(settle).toMatch(/makes the MODEL the judge/); // wrap-robust: the load-bearing phrase
  });

  it('the discrepancy case re-surfaces the sealed criteria instead of resolving it with a verdict', () => {
    expect(settle).toMatch(/Discrepancy case/i);
    expect(settle).toMatch(/re-surface the sealed pass\/fail/i);
  });

  it('the no-self-grading invariant still exists in the meta-gates (the rule was hoisted, not moved away)', () => {
    expect(settle).toMatch(/No self-grading/);
    expect(settle).toMatch(/the skill never infers/);
  });
});
