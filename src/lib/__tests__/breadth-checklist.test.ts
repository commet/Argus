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

/**
 * R37 — the sweep over-fired once on an already-CLOSED low-stakes logging request
 * (a classification mis-fire routed it into the OPEN sweep). Reinforce the
 * fire-or-not invariant at the sweep site on both surfaces: never reopen a closed
 * decision to "add breadth" (mirror clause; the gate runs before the form).
 */
describe('R37 — fire-or-not gate at the breadth sweep (never on a closed decision)', () => {
  it('webapp gates the sweep to OPEN-only, never on VALIDATION/CLOSED', () => {
    expect(webapp).toMatch(/FIRE-OR-NOT/);
    expect(webapp).toMatch(/NEVER on a VALIDATION\/CLOSED/);
    expect(webapp).toMatch(/already-logged/);
  });

  it('plugin gates the sweep to OPEN-only, never on VALIDATION/CLOSED', () => {
    expect(pluginClarify).toMatch(/FIRE-OR-NOT/);
    expect(pluginClarify).toMatch(/NEVER on a VALIDATION\/CLOSED/);
    expect(pluginClarify).toMatch(/already-logged/);
  });
});

/**
 * R39 — sharpening the single pass to absorb the crew's residual off-frame edge
 * (crew survival 3/3 -> 1/4) introduced two harms it must ship WITH: a confabulated
 * current-state next-action ("Stripe DPA" on a repo with no payment layer) and a
 * spine-form slip (a directional headline "항로: 진행" on the heaviest case). The
 * external-approval sub-sweep ships ONLY bundled with the honesty guard + the
 * bare-crux firing form, on both surfaces.
 */
describe('R39 — external-approval sub-sweep + honesty guard + heavy bare-crux (both surfaces)', () => {
  it('webapp carries the external-approval gate, the honesty guard, and the heavy firing-form', () => {
    expect(webapp).toMatch(/External-approval/i);
    expect(webapp).toMatch(/HONESTY GUARD/);
    expect(webapp).toMatch(/verify-first/);
    expect(webapp).toMatch(/NEVER assert that a specific vendor\/integration EXISTS/);
    expect(webapp).toMatch(/do NOT license a verdict/);
    expect(webapp).toMatch(/directional headline/);
  });

  it('plugin carries the external-approval gate, the honesty guard, and the heavy firing-form', () => {
    expect(pluginClarify).toMatch(/External-approval/i);
    expect(pluginClarify).toMatch(/HONESTY GUARD/);
    expect(pluginClarify).toMatch(/verify-first/);
    expect(pluginClarify).toMatch(/NEVER assert a specific vendor\/integration EXISTS/);
    expect(pluginClarify).toMatch(/do NOT license a verdict/);
    expect(pluginClarify).toMatch(/directional headline/);
  });
});

/**
 * R40 — verify-first absorbed the crew's last edge (ground-truth), with ONE residual
 * class: asserting UNVERIFIABLE EXTERNAL state (runtime/dashboard/live-provider/
 * third-party-config) as settled fact (rgt-2 confabulated a Supabase dashboard
 * provider-switch). The honesty guard generalizes from "invented current state in
 * the repo" (R39 Stripe-DPA) to "asserted external state not knowable from a static
 * read" — tag it as inference, never assert it. Pinned on both surfaces.
 */
describe('R40 — unverifiable-external state must be tagged, never asserted (both surfaces)', () => {
  it('webapp generalizes the honesty guard to runtime/dashboard/external state', () => {
    expect(webapp).toMatch(/unverifiable-external/);
    expect(webapp).toMatch(/runtime \/ dashboard \/ third-party-config|runtime\/dashboard/i);
    expect(webapp).toMatch(/NEVER assert it as settled fact/);
  });

  it('plugin carries verify-first (read the repo) + tag-don\'t-assert external state', () => {
    expect(pluginClarify).toMatch(/unverifiable-external/);
    expect(pluginClarify).toMatch(/VERIFY it by reading before asserting/);
    expect(pluginClarify).toMatch(/NEVER assert it as settled fact/);
  });
});
