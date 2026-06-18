import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * STEP 0 classify-gate regressions (R27 deep-dive, 2 confirmed webapp failures).
 *
 * R27 found the webapp's STEP 0 classifier under-fired on two inputs because it
 * listed categories as FLAT PEERS with VALIDATION ahead of CRISIS:
 *
 *  1. (HIGH) coercion under-fire — a coercion-shaped "I decided to suppress
 *     myself, is this right?" matched VALIDATION near-verbatim while the abuse
 *     signal had to be inferred, so it routed to respect-and-close instead of
 *     CRISIS. Fix: crisis-FIRST precedence + an explicit VALIDATION tie-break
 *     (mirrors the plugin's Step 1.6-before-1.7 ordering — closes a real drift).
 *  2. (MED) cold-start Barnum — "tell me who I am as a decider" had no off-ramp,
 *     so the engine cold-read a rule-2 verdict from zero history. Fix: a
 *     SELF-PROFILING gate that declines the cold-read.
 *
 * These guard the STRUCTURE (ordering + tie-break + the new gate), which a
 * presence-only check would miss. A future prompt edit that flattens the gates
 * back into peers, or drops the tie-break, turns this red. Read from source (not
 * imported) to avoid the module's supabase/db chain — the gate text is static,
 * not locale-interpolated, so the file is the faithful source.
 */

const prompts = readFileSync(
  join(process.cwd(), 'src/lib/progressive-prompts.ts'),
  'utf8',
);

describe('STEP 0 — crisis-first precedence (R27 coercion under-fire)', () => {
  it('screens safety FIRST as an ordered gate, not a flat peer', () => {
    expect(prompts).toMatch(/GATE A/);
    expect(prompts).toMatch(/SAFETY FIRST/i);
    expect(prompts).toMatch(/first gate that fires WINS/i);
  });

  it('CRISIS outranks VALIDATION on a coercion-shaped already-decided input', () => {
    expect(prompts).toMatch(/CRISIS WINS over VALIDATION/);
    // the inferred (not stated) coercion signal must be in scope
    expect(prompts).toMatch(/coercion/i);
    expect(prompts).toMatch(/INFERRED/i);
  });

  it('CRISIS gate is defined before the VALIDATION fall-through branch', () => {
    expect(prompts.indexOf('GATE A')).toBeLessThan(prompts.indexOf('VALIDATION / CLOSED'));
  });
});

describe('STEP 0 — self-profiling gate (R27 cold-start Barnum)', () => {
  it('has a SELF-PROFILING off-ramp that declines a cold-read', () => {
    expect(prompts).toMatch(/SELF-PROFILING/);
    expect(prompts).toMatch(/cold-read/i);
    // encodes spine rule 2 + the sample-size redirect to logged history
    expect(prompts).toMatch(/who the user is|verdict about who/i);
    expect(prompts).toMatch(/logged|history|voyages/i);
  });
});
