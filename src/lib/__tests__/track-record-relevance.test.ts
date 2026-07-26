import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Fable5 foundation supersedes the old R38 relevance gate. A performance
 * history does not become safe merely because it looks relevant: counts and a
 * recent miss still steer the next decision. The injection path must be absent.
 */
const clarify = readFileSync(
  join(process.cwd(), 'argus-plugin-v2/skills/review/clarify.md'),
  'utf8',
);
const signals = readFileSync(
  join(process.cwd(), 'argus-plugin-v2/scripts/lib/decision-signals.js'),
  'utf8',
);
const anchor = readFileSync(
  join(process.cwd(), 'argus-plugin-v2/scripts/anchor-signal.js'),
  'utf8',
);

describe('foundation — no past-performance injection into a new decision', () => {
  it('the signal parser no longer computes a track-record aggregate', () => {
    expect(signals).not.toMatch(/\btrackRecord\b/);
    expect(signals).not.toMatch(/mostRecentlyMissed|recentMiss/i);
  });

  it('the anchor hook does not inject held/missed counts or a past example', () => {
    expect(anchor).not.toMatch(/\btrackRecord\b/);
    expect(anchor).not.toMatch(/most recently missed|held\s+\d+|missed\s+\d+/i);
  });

  it('clarify does not use a performance-history relevance gate', () => {
    expect(clarify).not.toMatch(/RELEVANCE-GATED|COUNTS ONLY|false analogy seed/);
    expect(clarify).not.toMatch(/Most recently missed|held\s+5\/5/i);
  });

  it('clarify still forbids a model from turning a closed log into a new ceremony', () => {
    expect(clarify).toMatch(/\(closed-log\)/);
    expect(clarify).toMatch(/acknowledge and stop/i);
  });
});
