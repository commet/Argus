import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * R28 — validation-route firing form + refusal affect-ack (drift guards).
 *
 * R28's diverse-voyage value sweep (30 cases, skeptic-verified) surfaced three
 * SPEC defects, all in the early-exit routes that short-circuit before the
 * open_decision meta-gates can backstop them:
 *
 *  C1 (plugin-only) — clarify's validation route AUTHORIZED "an optional contract
 *      seed" while Forbidden patterns BANNED a contract_seed on validation. A live
 *      self-contradiction: a real model could resolve it toward appending a
 *      settlement seed on an already-made decision = ceremony-as-endorsement
 *      (mirror clause). Fix: delete the authorization; Forbidden patterns is the
 *      sole source of truth. The webapp validation branch never had the seed, so
 *      this guard is plugin-only.
 *
 *  C2 (both surfaces) — the validation route had NO firing-form constraint, so on
 *      a reassurance-seeking input ("am I insane / overthinking?") the model
 *      reliably emitted a normalizing premise ("you're not overthinking") BEFORE
 *      declining the verdict — structurally the disclaimed lean the spine bans
 *      ("you cannot launder a verdict by tagging it", Zero-Judgment rule 2). Fix:
 *      decline in BOTH directions first / go straight to the check; never preface
 *      with a normalizing premise.
 *
 *  C3 (both surfaces) — the refuse-to-own / hand-the-crux-back move had no
 *      affect-acknowledgment slot, so a cold refusal to a depleted delegator
 *      ("머리 아파 / 그냥 네가 정해줘") read as a scold of the abdication (a covert
 *      verdict). Fix: ONE bounded acknowledgment of the STATE before the refusal —
 *      bounded HARD (one clause, no hook, no multi-sentence warmth) so it does not
 *      recreate the vent over-warmth over-fire (the C3/C5 knife-edge).
 *
 * Guards read source as text (the same convention as step0-gates.test.ts) — the
 * gate text is static, not locale-interpolated, so the file is the faithful
 * source and importing would drag in the supabase/db chain.
 */

const webapp = readFileSync(
  join(process.cwd(), 'src/lib/progressive-prompts.ts'),
  'utf8',
);
const pluginClarify = readFileSync(
  join(process.cwd(), 'argus-plugin-v2/skills/clarify/SKILL.md'),
  'utf8',
);

describe('C1 — plugin validation route no longer authorizes a contract seed', () => {
  it('the authorizing clause "optional contract seed" is gone', () => {
    expect(pluginClarify).not.toMatch(/optional contract seed/i);
  });

  it('the validation route explicitly forbids a contract seed', () => {
    expect(pluginClarify).toMatch(/\*\*No contract seed\*\*/);
  });

  it('Forbidden patterns keeps the contract_seed ban on validation (sole source of truth)', () => {
    // line ~635: "never on vent / closed-log / crisis / flat / validation"
    expect(pluginClarify).toMatch(/never on vent \/ closed-log \/ crisis \/ flat \/ validation/);
  });
});

describe('C2 — validation firing form: no normalizing premise before the check (both surfaces)', () => {
  // markdown hard-wraps, so match the load-bearing phrases, not a contiguous span.
  it('webapp STEP 0 declines the verdict in both directions and bans a normalizing premise', () => {
    expect(webapp).toMatch(/in BOTH directions/);
    expect(webapp).toMatch(/normalizing\/reassuring premise/);
    expect(webapp).toMatch(/laundered verdict/);
  });

  it('plugin clarify validation route declines the verdict in both directions and bans a normalizing premise', () => {
    expect(pluginClarify).toMatch(/in BOTH directions/);
    expect(pluginClarify).toMatch(/normalizing\/reassuring premise/);
    expect(pluginClarify).toMatch(/laundered verdict/);
  });
});

describe('C3 — bounded affect-ack before a refuse-to-own (both surfaces)', () => {
  it('webapp registers fatigue before handing the crux back, bounded (no hook)', () => {
    expect(webapp).toMatch(/scolds the abdication/i);
    expect(webapp).toMatch(/ONE short acknowledgment/);
    // the knife-edge bound: no engagement hook, no multi-sentence warmth
    expect(webapp).toMatch(/no .*hook/i);
    expect(webapp).toMatch(/no multi-sentence warmth/i);
  });

  it('plugin has the M-affect gate, bounded against the vent over-warmth over-fire', () => {
    expect(pluginClarify).toMatch(/M-affect/);
    expect(pluginClarify).toMatch(/scold of the abdication/i);
    expect(pluginClarify).toMatch(/one bounded acknowledgment/i);
    expect(pluginClarify).toMatch(/NO availability\/engagement hook/);
    expect(pluginClarify).toMatch(/NO multi-sentence warmth/);
  });
});
