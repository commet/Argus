import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * R36 — distill the crew's value into the single pass (do not ship the crew).
 *
 * R35 head-to-head (single strong pass A vs real mini-crew B): the crew WON the
 * bearing (+7) but crew_earns_keep survived the skeptic 0/2 — the lift is
 * generation BREADTH + symmetric skepticism, NOT the team→verify→boss machinery,
 * and it is fully portable to one pass via three sweeps. Per the product thesis
 * ("one compressed screen, not multi-agent"), bake the breadth into the single
 * pass; the crew stays internal-only (its removal is a founder-level call pending
 * the R37 A'-vs-B falsification — NOT done here).
 *
 * The three sweeps, scoped to high-stakes/irreversible/multi-domain OPEN decisions
 * (skipping them on a low-stakes reversible choice is the restraint default):
 *   (a) off-frame gate (compliance/security/finance/legal/people the frame omits)
 *   (b) symmetric scrutiny of the option the USER is leaning toward
 *   (c) one pivotal number + the threshold that flips the call
 *
 * Both surfaces must carry it (rules=data parity). File-read guard.
 */
const webapp = readFileSync(join(process.cwd(), 'src/lib/progressive-prompts.ts'), 'utf8');
const pluginClarify = readFileSync(join(process.cwd(), 'argus-plugin-v2/skills/clarify/SKILL.md'), 'utf8');

describe('R36 — BREADTH checklist present on both surfaces', () => {
  it('webapp OPEN branch carries all three sweeps', () => {
    expect(webapp).toMatch(/BREADTH/);
    expect(webapp).toMatch(/[Oo]ff-frame gate/);
    expect(webapp).toMatch(/[Ss]ymmetric scrutiny/);
    expect(webapp).toMatch(/pivotal number/i);
  });

  it('plugin clarify Step 2 carries all three sweeps', () => {
    expect(pluginClarify).toMatch(/BREADTH/);
    expect(pluginClarify).toMatch(/[Oo]ff-frame gate/);
    expect(pluginClarify).toMatch(/[Ss]ymmetric scrutiny/);
    expect(pluginClarify).toMatch(/pivotal/i);
  });
});

describe('R36 — the breadth sweep is SCOPED to heavy decisions (restraint, not always-on)', () => {
  it('webapp scopes it to high-stakes and skips low-stakes', () => {
    expect(webapp).toMatch(/high-stakes/i);
    expect(webapp).toMatch(/SKIP on a low-stakes|low-stakes reversible/i);
  });

  it('plugin scopes it to high-stakes load_bearing and skips low-stakes', () => {
    expect(pluginClarify).toMatch(/high-stakes/i);
    expect(pluginClarify).toMatch(/SKIP on low-stakes|low-stakes\/reversible/i);
  });
});
