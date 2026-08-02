/**
 * F2 — consumption contract (the structural guard against "generate-but-drop").
 *
 * The foundational review's root finding: stage boundaries are untyped prose
 * projections, so a field added to AnalysisSnapshot is dead-on-arrival by default
 * (ai_scope, decision_line, next_three_days all shipped generated-but-unconsumed).
 * The type system can't catch it — a `string` comes out of a template literal.
 *
 * This guard is the persistence-contract pattern applied to CONSUMPTION: every
 * AnalysisSnapshot field must declare where it is consumed, and every field
 * declared `mix-context` must actually be read by formatSnapshot (the bottleneck
 * that feeds the mix prompt). Add a field to the type → this test fails until you
 * classify it; classify it `mix-context` → it fails until you wire it in.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { MIX_CONTEXT_FIELDS, compactSnapshots } from '@/lib/compact-context';
import type { AnalysisSnapshot } from '@/stores/types';
import { buildDeepeningJudgmentPrompt } from '@/lib/judgment-harness-v2';

const ROOT = join(__dirname, '..', '..');
const typesSrc = readFileSync(join(ROOT, 'stores', 'types.ts'), 'utf8');

/** Where each AnalysisSnapshot field is consumed. Adding a field to the type
 *  without adding it here fails the "no unclassified field" test below. */
// 'harness-feedback' is a real seventh destination, added 2026-08-02: a field
// the runtime writes and hands BACK to the model on the next turn. Filing it
// under 'mix-context' would have been the cheap move and a false one — that set
// is checked against compact-context's exhaustive projector, and a field that
// never reaches the synthesis would have had to be excused there instead.
type Site = 'mix-context' | 'workers' | 'routing' | 'seal-gate' | 'flinch' | 'ui'
  | 'harness-feedback' | 'meta';
const CONSUMPTION_CONTRACT: Record<string, Site> = {
  version: 'meta',                       // diff/version tracking
  pre_review_baseline: 'harness-feedback', // current-turn evidence carried into
                                           // later questions; never profile memory
  real_question: 'mix-context',
  hidden_assumptions: 'mix-context',
  premise_records: 'ui',                 // AnalysisCard: the user's own words +
                                         // "이게 아니라면 →" under each premise
  premise_verdicts: 'harness-feedback',  // buildDeepeningJudgmentPrompt: the
                                         // contract's own verdict on the last
                                         // proposals, handed back to the model
                                         // so a demotion teaches within the
                                         // session instead of repeating
  skeleton: 'mix-context',
  execution_plan: 'workers',             // initWorkers → the crew
  insight: 'mix-context',
  honesty_flags: 'ui',                   // loop-17: HonestyShaded "확인 필요" 음영
  lean_flags: 'ui',                      // first-frame verdict audit + neutral rewrite gate
  framing_confidence: 'routing',
  framing_locked: 'ui',
  framing_override_reason: 'ui',
  stakes: 'seal-gate',                   // shouldSealContract
  reversibility: 'seal-gate',
  convergence_score: 'routing',
  convergence_trend: 'routing',
  request_type: 'routing',               // terminal-route gate
  readiness: 'routing',
  frame_status: 'routing',               // over-fire mirror clause
  decision_density: 'routing',
  decision_density_reasoning: 'ui',
  crisis: 'ui',                          // non-blocking crisis banner
  decision_line: 'mix-context',          // F1: also → contract as user_lean
  weakest_assumption: 'flinch',          // Falsification/Overreach ladder
  next_three_days: 'mix-context',
};

/** Extract the TOP-LEVEL field names of the AnalysisSnapshot interface from source. */
function snapshotFields(): string[] {
  const start = typesSrc.indexOf('export interface AnalysisSnapshot {');
  expect(start, 'AnalysisSnapshot interface not found').toBeGreaterThan(-1);
  const body = typesSrc.slice(start);
  const end = body.indexOf('\n}');           // first column-0 close = interface end
  const block = body.slice(0, end);
  // 2-space indent + name + optional ? + colon = a top-level field (nested fields
  // are indented deeper, comments/blank lines don't match).
  return [...block.matchAll(/^ {2}(\w+)\??:/gm)].map(m => m[1]);
}

describe('AnalysisSnapshot consumption contract', () => {
  const fields = snapshotFields();

  it('extracted a sane field set', () => {
    expect(fields).toContain('decision_line');
    expect(fields).toContain('real_question');
    expect(fields.length).toBeGreaterThanOrEqual(20);
  });

  it('every field declares a consumption site (add a field → classify it here)', () => {
    const unclassified = fields.filter(f => !(f in CONSUMPTION_CONTRACT));
    expect(unclassified, `unclassified AnalysisSnapshot fields — declare where each is consumed: ${unclassified.join(', ')}`).toEqual([]);
  });

  it('every harness-feedback field actually reaches the next prompt', () => {
    // Same standard the mix fields are held to: not "mentioned in the source"
    // but present in the built prompt. A feedback field that never reaches the
    // model is the write-only failure this whole contract exists to catch.
    const feedback = fields.filter(f => CONSUMPTION_CONTRACT[f] === 'harness-feedback');
    const snap = {
      version: 1,
      real_question: 'q',
      hidden_assumptions: [],
      skeleton: [],
      pre_review_baseline: 'SENTINEL_pre_review_baseline',
      premise_verdicts: [{
        text: 'SENTINEL_premise_verdicts',
        declared: 'premise',
        recorded: 'fact',
        reason: 'restates_anchor_recorded_as_fact',
      }],
    } as unknown as AnalysisSnapshot;
    const { user } = buildDeepeningJudgmentPrompt('problem', snap, [], 1, 3, 'ko');
    const missing = feedback.filter(f => !user.includes(`SENTINEL_${f}`));
    expect(missing, `harness-feedback fields never reach the prompt: ${missing.join(', ')}`).toEqual([]);
  });

  it('the contract has no stale entries (removed from the type)', () => {
    const stale = Object.keys(CONSUMPTION_CONTRACT).filter(k => !fields.includes(k));
    expect(stale, `contract lists fields no longer on AnalysisSnapshot: ${stale.join(', ')}`).toEqual([]);
  });

  it('the contract\'s mix-context set matches the typed projector (no drift)', () => {
    // The old guard grepped compact-context source for `s.<field>` — foolable by
    // a comment. Now compact-context exports MIX_CONTEXT_FIELDS (keyof-typed) and
    // an exhaustive renderer Record, so a missing renderer fails to COMPILE. This
    // asserts the test's own map agrees with that single source of truth.
    const contractMix = fields.filter(f => CONSUMPTION_CONTRACT[f] === 'mix-context').sort();
    expect([...MIX_CONTEXT_FIELDS].sort()).toEqual(contractMix);
  });

  it('every mix-context field\'s VALUE actually reaches the mix output (not just mentioned)', () => {
    // Sentinel each mix field, run the real projection, assert each value appears.
    // Stronger than the old source-grep: proves the field is rendered, not merely
    // referenced in a comment or dead branch.
    const snap = {
      real_question: 'SENTINEL_real_question',
      hidden_assumptions: ['SENTINEL_hidden_assumptions'],
      skeleton: ['SENTINEL_skeleton'],
      insight: 'SENTINEL_insight',
      decision_line: 'SENTINEL_decision_line',
      next_three_days: ['SENTINEL_next_three_days'],
    } as unknown as AnalysisSnapshot;
    const out = compactSnapshots([snap], 'en');
    const missing = MIX_CONTEXT_FIELDS.filter(f => !out.includes(`SENTINEL_${f}`));
    expect(missing, `mix-context field value never reached the output (generate-but-drop): ${missing.join(', ')}`).toEqual([]);
  });
});
