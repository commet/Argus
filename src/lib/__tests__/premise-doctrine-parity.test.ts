/**
 * What a premise IS has to mean the same thing on all three surfaces.
 *
 * There was no guard on this, and the drift it allowed was total. The webapp
 * rebuilt the whole premise doctrine (harness v2, 2026-07 → 2026-08): no
 * minimum count, never attribute a belief to the user, and a premise must say
 * what their words make possible rather than repeat the words. The plugin was
 * still running the sentence it shipped with:
 *
 *   "hidden_assumptions: 3-5 assumptions the user is making without stating."
 *
 * Every clause of that is now a violation. It demands a minimum, which is what
 * produced lists of the user's own sentences with the word "assumption" over
 * them; and "assumptions the user is making" is precisely the attribution the
 * webapp measured as its single most common failure.
 *
 * 4,500 tests were green the whole time, because every parity guard in the repo
 * watched the crisis taxonomy, the state machine, the schema — and nobody had
 * written one for the thing the product is about.
 *
 * These are not string-equality checks: the three surfaces are a TS template, a
 * markdown skill, and a Zod description, and they legitimately word things
 * differently. Each rule is checked by what would make it FALSE.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8');

const SURFACES: Array<{ name: string; src: string }> = [
  { name: 'webapp harness', src: read('src/lib/judgment-harness-v2.ts') },
  { name: 'plugin clarify', src: read('argus-plugin-v2/skills/review/clarify.md') },
];

describe('no surface may demand a minimum number of premises', () => {
  it.each(SURFACES)('$name asks for no floor', ({ src }) => {
    // "3-5 assumptions", "at least two premises", "3~5개" — any floor turns an
    // honest empty list into a failure the model pads with the user's own
    // sentences. Measured: this exact instruction produced 6 restated facts
    // out of 11 collected items.
    expect(src).not.toMatch(/\b[2-9]\s*[-~]\s*[2-9]\s*(hidden_)?assumptions?\b/i);
    expect(src).not.toMatch(/at least (one|two|three|\d+) (hidden )?(assumptions?|premises?)/i);
    expect(src).not.toMatch(/(가정|전제)\s*[2-9]\s*[-~]\s*[2-9]\s*개/);
  });

  it.each(SURFACES)('$name says out loud that empty is valid', ({ src }) => {
    expect(src).toMatch(/no minimum|\[\] is (often right|valid|a correct)|`\[\]` is a correct/i);
  });
});

describe('no surface may attribute a belief to the user', () => {
  it.each(SURFACES)('$name bans it explicitly', ({ src }) => {
    expect(src).toMatch(/attribute a belief|belief you attribute|seem to think|assumes? X/i);
  });

  it('the plugin no longer defines an assumption as one the user is "making"', () => {
    const plugin = read('argus-plugin-v2/skills/review/clarify.md');
    // The original sentence, and the shape of any rewrite of it. A premise is a
    // proposition about the world, not a claim about someone's head.
    expect(plugin).not.toMatch(/assumptions? the user is making/i);
  });
});

describe('a premise must go past the fact it rests on', () => {
  it.each(SURFACES)('$name shows the transformation, not just the rule', ({ src }) => {
    // Both carry the same worked pair, because a rule stated abstractly did not
    // move the measurement and a worked example on real material did.
    expect(src).toContain('런웨이가 18개월이다');
    expect(src).toContain('18개월 안에 다음 라운드나 흑자 전환이 온다');
  });

  it.each(SURFACES)('$name blesses recording the plain fact instead', ({ src }) => {
    // Without this, "stop restating" is heard as "invent something", which is
    // the more expensive failure.
    expect(src).toMatch(/kind":"fact"|"kind": *"fact"|leave it out|is the right outcome/i);
  });
});

describe('the terminal asks for the user\'s own words too', () => {
  it('argus_capture still requires an anchor and says why', () => {
    const tools = read('argus-mcp/src/tools/premises.ts');
    expect(tools).toContain('anchor_quote');
    // And it is checked, not merely collected — the state this surface was in
    // until 2026-08-02.
    expect(tools).toContain('statesAClaim');
  });

  it('the claim band is one file, not two implementations', () => {
    const drift = read('src/lib/__tests__/premises-core-drift.test.ts');
    expect(drift).toContain('premise-claim.ts');
    expect(drift).toContain('decisive-premises.ts');
  });
});
