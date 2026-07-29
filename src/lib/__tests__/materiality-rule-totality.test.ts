import { describe, expect, it } from 'vitest';
import { evaluateMateriality, type MaterialityRule } from '../numeric-drift';

/**
 * `materiality_rule` is UNVALIDATED jsonb. Postgres accepts any object, the MCP
 * host writes it, older clients wrote earlier shapes, and humans edit it — so the
 * shape that reaches this engine is not the shape the TypeScript type promises.
 *
 * The 2026-07-28 live watcher run hit exactly that: `{type:'delta'}` with no
 * `params` threw a TypeError out of `evaluateMateriality`. The nightly cron now
 * catches it per premise, but a try/catch around ONE caller is not the fix —
 * `useReviewStore.recheckPremise` calls this function in the BROWSER with no catch
 * anywhere above it, and the watcher would still burn a Brave + LLM call and then
 * lose that premise every single night, forever, in silence.
 *
 * What makes this file red: any rule shape reaching this engine that can throw.
 * The blast-radius test cannot see this — it MOCKS the researcher and stipulates
 * the throw, so it passes whether or not the root is fixed. This one calls the
 * real function.
 */

/** Rule types that decide nothing without a parameter (mirrors numeric-drift.ts). */
const NEEDS_PARAMS = ['threshold', 'step', 'delta', 'relative', 'band', 'map'];

// Deliberately mistyped: this is the point — these are the shapes the DB allows.
const malformed: Array<{ label: string; rule: unknown }> = [
  { label: 'delta with no params (the shape found live)', rule: { type: 'delta' } },
  { label: 'threshold with no params', rule: { type: 'threshold' } },
  { label: 'step with no params', rule: { type: 'step' } },
  { label: 'relative with no params', rule: { type: 'relative' } },
  { label: 'band with no params', rule: { type: 'band' } },
  { label: 'map with no params', rule: { type: 'map' } },
  { label: 'stateful with no params', rule: { type: 'stateful' } },
  { label: 'params explicitly null', rule: { type: 'delta', params: null } },
  { label: 'params is a number', rule: { type: 'delta', params: 7 } },
  { label: 'params is a string', rule: { type: 'threshold', params: 'line=3' } },
  { label: 'params is an array', rule: { type: 'band', params: [1, 2] } },
  { label: 'modifiers is a string', rule: { type: 'delta', params: { D: 1 }, modifiers: 'harmful_only' } },
  { label: 'unknown rule type', rule: { type: 'wat', params: {} } },
  { label: 'no type at all', rule: { params: { D: 1 } } },
  { label: 'rule is a bare string', rule: 'delta' },
  { label: 'rule is an array', rule: [] },
  { label: 'rule is an empty object', rule: {} },
];

describe('evaluateMateriality is total over unvalidated jsonb rules', () => {
  for (const { label, rule } of malformed) {
    it(`does not throw on numeric values — ${label}`, () => {
      expect(() => evaluateMateriality(2.5, 2.75, rule as MaterialityRule)).not.toThrow();
    });

    it(`does not throw on label values — ${label}`, () => {
      expect(() => evaluateMateriality({ label: '보류' }, { label: '승인' }, rule as MaterialityRule)).not.toThrow();
    });
  }

  it('never fabricates a `material` verdict from a rule it could not read', () => {
    // The dangerous failure is not the throw — it is falling through to the
    // heuristic and firing an alert off a threshold the user never wrote. Only the
    // rules whose PARAMS are unreadable belong here; `modifiers` being garbage just
    // means the modifiers are absent, and a valid `params` must still decide.
    const unreadableParams = malformed.filter(({ rule }) => {
      const r = rule as { type?: string; params?: unknown };
      if (!NEEDS_PARAMS.includes(r?.type ?? '')) return false;
      return !r.params || typeof r.params !== 'object' || Array.isArray(r.params);
    });
    expect(unreadableParams.length, 'the fixture must actually contain such rules').toBeGreaterThan(5);

    for (const { label, rule } of unreadableParams) {
      const r = evaluateMateriality(1, 1000, rule as MaterialityRule); // a 1000× move
      expect(r.status, `${label} should not fire`).toBe('uncertain');
      expect(r.low_confidence, `${label} should be flagged low-confidence`).toBe(true);
    }
  });

  it('garbage `modifiers` degrade to "no modifiers", not to a wrong verdict', () => {
    const rule = { type: 'delta', params: { D: 1 }, modifiers: 'harmful_only' } as unknown as MaterialityRule;
    expect(evaluateMateriality(1, 1000, rule).status).toBe('material');
  });

  it('names the problem instead of staying blank', () => {
    const r = evaluateMateriality(2.5, 2.75, { type: 'delta' } as unknown as MaterialityRule);
    expect(r.reason).toContain('params');
    expect(r.reason.length).toBeGreaterThan(10);
  });

  it('still applies a well-formed rule exactly as before (no regression)', () => {
    const rule: MaterialityRule = { type: 'delta', params: { D: 0.2 } };
    expect(evaluateMateriality(2.5, 2.75, rule).status).toBe('material');
    expect(evaluateMateriality(2.5, 2.6, rule).status).toBe('unchanged');
  });

  it('a rule with a PRESENT but out-of-range param still falls to the heuristic', () => {
    // Distinct from "missing": D<=0 is a declared-but-inapplicable rule, and the
    // existing contract is to fall through to the under-fire default. Keep it.
    const rule: MaterialityRule = { type: 'delta', params: { D: 0 } };
    expect(evaluateMateriality(1, 1000, rule).status).toBe('material'); // heuristic: 999× move
  });

  it('a rule whose required parameter is MISSING does not fall to the heuristic', () => {
    // The partial version of the same defect: params exists but the one number the
    // rule needs is absent. Falling through fired `material` off a band/threshold
    // the user never finished declaring.
    for (const rule of [
      { type: 'threshold', params: { direction: 'above' } },
      { type: 'band', params: { lo: 1 } },
      { type: 'delta', params: { note: 'TODO' } },
      { type: 'step', params: { N: 2 } },
    ] as unknown as MaterialityRule[]) {
      const r = evaluateMateriality(1, 1000, rule);
      expect(r.status, `${rule.type} with a missing param`).toBe('uncertain');
      expect(r.low_confidence).toBe(true);
    }
  });
});
