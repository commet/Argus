import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * R33 — settlement-loop value guard (plugin log --insights).
 *
 * R33 measured the n=1 moat: the differentiated value is REAL and robust (6/6
 * beats-generic, 6/6 grounded, 6/6 Barnum-free, survives even haiku) — but every
 * headline claim was broken by the skeptic (value_survived_skeptic = 0/6). The
 * failure is the claim-CALIBRATION layer: a small-n (~4-7) correlation stated one
 * notch too strong as a rule/mechanism/"the only variable", and weak tiers
 * MANUFACTURE a pattern on a no-pattern (noise) history — the manufactured-meaning
 * spine violation, live on the cheapest tier the plugin may run on.
 *
 * Fix: bind claim STRENGTH to the settled count (mechanical pattern_strength gate
 * in Step 1, before the LLM), quarantine-but-count (never drop a luck/counterexample
 * entry to make a clean rule), inject ledger tags verbatim (no relabel), and make
 * no-pattern honesty mechanical not discretionary.
 *
 * This is PLUGIN-ONLY: the webapp surfaces only mechanical contract counts (no
 * LLM cross-voyage insight), so it is structurally immune to this over-claim class.
 * If the webapp ever adds an LLM insights feature, it must inherit these tiers.
 *
 * File-read guard (the gate text is static; importing would drag the plugin's
 * runtime, which does not exist as TS).
 */
const log = readFileSync(
  join(process.cwd(), 'argus-plugin-v2/skills/journal/SKILL.md'),
  'utf8',
);

describe('R33 — pattern_strength is computed mechanically in Step 1 (gate before form)', () => {
  it('Step 1 sets pattern_strength bound to the settled count', () => {
    expect(log).toMatch(/pattern_strength/);
    expect(log).toMatch(/counts_only/);
    expect(log).toMatch(/tendency/);
    expect(log).toMatch(/\brule\b/);
    expect(log).toMatch(/none/);
  });

  it('the bands are bound to settled count T (3-5 / 6-10 / 11+) and downgrade on scatter', () => {
    expect(log).toMatch(/3\s*[≤<=].*T.*[≤<=]\s*5/);
    expect(log).toMatch(/6\s*[≤<=].*T.*[≤<=]\s*10/);
    expect(log).toMatch(/T\s*[≥>=]+\s*11/);
    expect(log).toMatch(/scatter|scattered/i);
  });
});

describe('R33 — Step 3 binds claim strength + forbids small-n over-claim', () => {
  it('counts_only forbids causal/rule/mechanism/"only variable" claims', () => {
    // the over-claim vocabulary the skeptic broke must be explicitly banned at counts_only
    expect(log).toMatch(/유일한 변수/);
    expect(log).toMatch(/mechanism/i);
    expect(log).toMatch(/NO causal/i);
  });

  it('quarantine-but-count: never drop a luck/counterexample entry to make a clean claim', () => {
    expect(log).toMatch(/[Qq]uarantine-but-count/);
    expect(log).toMatch(/lucky win is NOT a skill win|운으로 표시|luck.*not.*skill/i);
  });

  it('ledger tags (basis luck/skill, fog/reef) are injected VERBATIM, no relabel', () => {
    expect(log).toMatch(/VERBATIM/);
    expect(log).toMatch(/relabel/i);
  });

  it('no-pattern honesty is mechanical (gated on pattern_strength none / scatter), not discretionary', () => {
    expect(log).toMatch(/No-pattern honesty is mechanical/i);
    expect(log).toMatch(/manufactured-meaning/i);
  });
});
