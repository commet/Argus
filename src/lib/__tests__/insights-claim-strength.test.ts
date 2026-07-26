import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * The former R33 test opened stronger pattern claims at larger sample sizes.
 * Fable5 freezes the pattern engine and forbids score-shaped projections at any
 * n. The journal is now a chronology, not an insights generator.
 */
const journal = readFileSync(
  join(process.cwd(), 'argus-plugin-v2/skills/journal/SKILL.md'),
  'utf8',
);
const ledger = readFileSync(
  join(process.cwd(), 'argus-plugin-v2/scripts/decision-ledger.js'),
  'utf8',
);

describe('foundation — journal never graduates into a pattern engine', () => {
  it('renders records in chronological, original-first order', () => {
    expect(journal).toMatch(/neutral chronology/i);
    expect(journal).toMatch(/original sentence/i);
    expect(journal).toMatch(/Later answers in chronological order/i);
  });

  it('keeps user, adopted AI, and unadopted AI wording distinct', () => {
    expect(journal).toMatch(/user's own words/i);
    expect(journal).toMatch(/suggestion the user adopted/i);
    expect(journal).toMatch(/remains only a draft/i);
  });

  it('forbids every performance proxy at every sample size', () => {
    expect(journal).toMatch(/Never show or infer a hit rate, win rate, accuracy, grade, tier, streak, skill/i);
    expect(journal).toMatch(/Never aggregate `held`, `missed`, `luck`/i);
    expect(journal).toMatch(/not evidence about the person/i);
  });

  it('contains no sample-size band or pattern-strength escape hatch', () => {
    expect(journal).not.toMatch(/pattern_strength|counts_only|3\s*[≤<=].*T|T\s*[≥>=]+\s*11/);
    expect(journal).not.toMatch(/quarantine-but-count/i);
  });

  it('keeps the journal out of the public command menu', () => {
    expect(journal).toMatch(/^user-invocable:\s*false$/m);
  });

  it('the CLI journal path does not print an aggregate score or rate', () => {
    const journalStart = ledger.indexOf('function cmdJournal');
    const journalBlock = ledger.slice(
      journalStart,
      ledger.indexOf('function ', journalStart + 'function cmdJournal'.length),
    );
    expect(journalStart).toBeGreaterThan(-1);
    expect(journalBlock).not.toMatch(/accuracy|hit.?rate|win.?rate|pattern_strength/i);
  });
});
