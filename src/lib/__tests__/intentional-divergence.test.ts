import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Re-drift prevention (PARITY-MAP §B / §E.4) — INTENTIONAL one-sided features.
 *
 * Some kicks live on ONLY one surface on purpose. The danger is the opposite of
 * drift: a future "make the two surfaces match" sweep deletes a deliberate kick,
 * mistaking it for an accident. This guard pins the intentional divergences so
 * that deletion turns a test red and forces a conscious decision.
 *
 * The founder's specific worry (2026-06-18): "did the webapp success-inflation
 * (overreach/flinch) kick get synced away when we aligned the two surfaces?"
 * Answer: no — only buildInitialAnalysisPrompt was edited. This test makes that
 * answer permanent: the kick cannot vanish without someone noticing here.
 *
 * To intentionally retire one of these: remove the feature AND its line here in
 * the same change (and update docs/PARITY-MAP). The point is that it is never
 * silent.
 */

const ROOT = process.cwd();
const read = (rel: string) => readFileSync(join(ROOT, rel), 'utf8');

describe('intentional divergence — webapp-only kicks survive', () => {
  const progressivePrompts = read('src/lib/progressive-prompts.ts');

  it('Overreach/Flinch success-ladder kick still exists (buildOverreachPrompt)', () => {
    // Paints the plan succeeding at escalating scale; the user's flinch point
    // isolates the load-bearing belief. Spine-compatible (zero engine verdict).
    expect(progressivePrompts).toMatch(/export function buildOverreachPrompt\b/);
    expect(progressivePrompts).toMatch(/stress test/i);
  });

  it('the flinch-point reader still exists (buildHighestLoadPrompt)', () => {
    // Fires only when the user believed every rung — surfaces the assumption
    // they are standing too close to see.
    expect(progressivePrompts).toMatch(/export function buildHighestLoadPrompt\b/);
  });
});

describe('intentional divergence — plugin-only kicks survive', () => {
  it('Helm (pre-scan of irreversible ops in coding-agent plans) still exists', () => {
    expect(existsSync(join(ROOT, 'argus-plugin-v2/skills/preapprove/SKILL.md'))).toBe(true);
  });

  it('Chart (version-tree of child drafts) still exists', () => {
    expect(existsSync(join(ROOT, 'argus-plugin-v2/skills/versions/SKILL.md'))).toBe(true);
  });
});

describe('intentional divergence — no name-collision regression', () => {
  it('the success-ladder kick is webapp-only (plugin must not silently re-add a same-named different thing)', () => {
    // The map (§B) warned of a past name collision: the plugin once had an
    // "overreach defense" that was a DIFFERENT thing (an under-fire guard), not
    // this success-ladder kick. It has since been removed. If "overreach"
    // reappears in the plugin, that is a conscious decision (port the real kick,
    // or pick a non-colliding name) — this surfaces it instead of letting the
    // two meanings quietly diverge again.
    const clarify = read('argus-plugin-v2/skills/review/clarify.md');
    const sail = read('argus-plugin-v2/skills/review/pipeline.md');
    expect(/overreach/i.test(clarify)).toBe(false);
    expect(/overreach/i.test(sail)).toBe(false);
  });
});
