import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Re-drift prevention (R-parity) — DECISION-STATE COVERAGE, not literal equality.
 *
 * Both surfaces classify an incoming request into the SAME 7 decision-states
 * before running (or not running) the engine. But they organize them differently
 * and that difference is INTENTIONAL, not drift:
 *
 *   - webapp (progressive-prompts.ts STEP 0): one flat 7-way enum — the model
 *     picks ONE of VENT / VALIDATION / INFO / CRISIS / FLAT / RESISTANCE / OPEN.
 *   - plugin  (clarify SKILL.md): orthogonal axes — Axis-0 crisis screen
 *     (Step 1.6), Axis-1 request_type {open_decision, validation, vent, info},
 *     Axis-2 readiness {ready, resistance}, and frame_status {flat, load_bearing}.
 *
 * The plugin's axis model is the more correct one (crisis / request-type /
 * flatness are genuinely independent). So this guard does NOT assert the two
 * structures are identical — that would force a false equivalence. It asserts
 * the weaker, true invariant: BOTH surfaces still ADDRESS all 7 states. If a
 * future prompt edit silently drops "resistance" or "flat" handling on one side,
 * this goes red. (crisis is already guarded structurally by
 * crisis-taxonomy-parity.test.ts; it is included here for completeness.)
 *
 * To remove/rename a decision-state: change DECISION_STATES here AND both source
 * prompts in the same change, or this guard fails.
 */

interface DecisionState {
  key: string;
  /** Matches the webapp STEP 0 flat-enum branch. */
  webapp: RegExp;
  /** Matches the plugin clarify axis that carries this state. */
  plugin: RegExp;
}

const DECISION_STATES: DecisionState[] = [
  { key: 'crisis',     webapp: /CRISIS/,                  plugin: /crisis/i },
  { key: 'vent',       webapp: /\bVENT\b/,                plugin: /`?vent`?/ },
  { key: 'validation', webapp: /VALIDATION/,              plugin: /`?validation`?/ },
  { key: 'info',       webapp: /\bINFO\b/,                plugin: /`?info`?/ },
  { key: 'open',       webapp: /\bOPEN\b/,                plugin: /open_decision/ },
  { key: 'resistance', webapp: /RESISTANCE/,              plugin: /`?resistance`?/ },
  { key: 'flat',       webapp: /\bFLAT\b/,                plugin: /frame_status|`?flat`?/ },
];

const webappPrompt = readFileSync(
  join(process.cwd(), 'src/lib/progressive-prompts.ts'),
  'utf8',
);
const pluginClarify = readFileSync(
  join(process.cwd(), 'argus-plugin-v2/skills/clarify/SKILL.md'),
  'utf8',
);

describe('decision-state coverage — webapp STEP 0 (drift guard)', () => {
  it.each(DECISION_STATES)('webapp STEP 0 still handles "$key"', ({ webapp }) => {
    expect(webapp.test(webappPrompt)).toBe(true);
  });
});

describe('decision-state coverage — plugin clarify (drift guard)', () => {
  it.each(DECISION_STATES)('plugin clarify still handles "$key"', ({ plugin }) => {
    expect(plugin.test(pluginClarify)).toBe(true);
  });
});

describe('decision-state set is complete (no silent shrink)', () => {
  it('covers exactly the 7 known states', () => {
    expect(DECISION_STATES.map((s) => s.key).sort()).toEqual(
      ['crisis', 'flat', 'info', 'open', 'resistance', 'validation', 'vent'].sort(),
    );
  });
});
