import { describe, it, expect } from 'vitest';
import { contractFromPredicates } from '../decision-contract';
import type { Predicate } from '@/stores/types';

/**
 * Dim8 capture-or-fail guard: every newly sealed contract MUST carry non-empty
 * provenance (app_version + prompt_version + sealed_at). Provenance is a capture
 * problem — you cannot retroactively stamp a past seal — so this regresses red if
 * a future change drops the stamp.
 */
const predicate: Predicate = {
  id: 'pred_test',
  source: 'governing_idea',
  text: 'Shipping in Q3 will not cause a churn spike.',
  verdict: 'pending',
} as Predicate;

describe('contract provenance (dim8)', () => {
  it('a freshly sealed contract carries non-empty provenance', () => {
    const c = contractFromPredicates('proj_1', [predicate], Date.parse('2026-06-23T00:00:00Z'));
    expect(c).not.toBeNull();
    expect(c!.provenance).toBeTruthy();
    expect(c!.provenance!.app_version).toBeTruthy();
    expect(c!.provenance!.prompt_version).toBeTruthy();
    expect(c!.provenance!.sealed_at).toBe('2026-06-23T00:00:00.000Z');
  });

  it('prompt_version identifies the engine instrument (non-empty tag)', () => {
    const c = contractFromPredicates('proj_1', [predicate], Date.now ? Date.parse('2026-06-23T00:00:00Z') : 0);
    expect(typeof c!.provenance!.prompt_version).toBe('string');
    expect(c!.provenance!.prompt_version.length).toBeGreaterThan(0);
  });
});
