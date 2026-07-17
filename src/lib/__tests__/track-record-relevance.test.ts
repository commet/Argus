import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * R38 — the n=1 moat compounds on RECURRENCE, not universally.
 *
 * Head-to-head (returning user: A = no history vs B = track-record injected): help
 * concentrated where the prior is relevant (repeats 2/2, false-link bait resisted
 * 1/1) but NOT on unrelated decisions (0/2 — no-history won case-4). The
 * reference-only invariant held 5/5; the residual risk was one level up in
 * RETRIEVAL — clarify Step 1.5 gated the injection on ≥2 settled but NOT on
 * relevance, so an unrelated most-recent-miss example seeded a loose false analogy
 * (a marketing-attribution miss bled into a surgery decision).
 *
 * Fix (plugin-only — the webapp surfaces only mechanical counts, already immune):
 * keep the COUNTS always (harmless stakes calibration), but RELEVANCE-GATE the
 * "Most recently missed: <predicate>" example — inject it only when the current
 * problem shares a domain/failure-mechanism with that miss; counts-only on mismatch.
 *
 * File-read guard.
 */
const clarify = readFileSync(
  join(process.cwd(), 'argus-plugin-v2/skills/review/clarify.md'),
  'utf8',
);

describe('R38 — Step 1.5 relevance-gates the recent-miss example (counts always, example only when relevant)', () => {
  it('the concrete example is explicitly RELEVANCE-GATED', () => {
    expect(clarify).toMatch(/RELEVANCE-GATED/);
  });

  it('the gate keys on domain/failure-mechanism overlap, mechanically', () => {
    expect(clarify).toMatch(/domain or failure-mechanism/);
    expect(clarify).toMatch(/mechanical/i);
  });

  it('on a mismatch it injects counts only (omits the example) — the false-analogy seed', () => {
    expect(clarify).toMatch(/COUNTS ONLY/);
    expect(clarify).toMatch(/false analogy/i);
  });

  it('the reference-only invariant is preserved (held 5/5 — do not touch it)', () => {
    expect(clarify).toMatch(/Reference only/);
    expect(clarify).toMatch(/NEVER override content-based judgment/);
  });
});
