// Unit test for the static gate — runs WITHOUT an API key (the always-on CI layer).
// Proves the gate flags the gross spine violations and passes clean bearings.
// Run: node argus-plugin-v2/evals/static-gate.test.mjs

import { staticGate } from './static-gate.mjs';

let pass = 0, fail = 0;
function check(name, cond) {
  if (cond) { pass++; console.log(`  ok   ${name}`); }
  else { fail++; console.error(`  FAIL ${name}`); }
}

const cleanFlat = {
  label: 'v0.1',
  current_course: { status: 'proceed', summary: 'Either name is fine — a reversible rename with no downstream signal; pick one and move on.' },
  why_this_course: [{ point: 'The folder is local scratch; renaming later costs nothing, so no axis separates the names.' }],
  fog_or_reef: null,
  road_not_taken: [],
  next_helm: 'Name it and keep going.',
  contract_seed: null,
  blocked: false,
  detail_path: '.argus/sessions/x/versions/v0.1/',
  generated_at: '2026-06-23T00:00:00.000Z',
};

const cleanFork = {
  label: 'v0.1',
  current_course: { status: 'fork', summary: 'Hold EU launch until counsel classifies the GDPR gap as blocking or not.' },
  why_this_course: [{ point: 'Revenue upside is real but does not override unclassified legal exposure.' }],
  fog_or_reef: { issue: 'GDPR gap not legally classified.', why_it_matters: 'A % can hide one blocking gap.', required_check: 'Ask counsel to classify.' },
  road_not_taken: [{ option: 'Ship now with a kill switch', why_not_now: 'A kill switch does not undo legal exposure already created by launch.' }],
  next_helm: 'Send the gap list to EU counsel.',
  contract_seed: null,
  blocked: true,
  detail_path: '.argus/sessions/x/versions/v0.1/',
  generated_at: '2026-06-23T00:00:00.000Z',
};

// 1. Clean flat passes.
check('clean flat passes', staticGate(cleanFlat, { id: 't', kind: 'flat' }).passed);

// 2. Flat with a manufactured fork FAILS (over-fire).
const flatWithFork = { ...cleanFlat, current_course: { status: 'fork', summary: 'tmp vs scratch' }, road_not_taken: [{ option: 'scratch', why_not_now: 'tmp reads as temp' }] };
check('flat + manufactured fork fails', !staticGate(flatWithFork, { id: 't', kind: 'flat' }).passed);

// 3. Flat with fabricated fog FAILS.
const flatWithFog = { ...cleanFlat, fog_or_reef: { issue: 'unclear naming convention', why_it_matters: 'future confusion', required_check: 'survey the team' } };
check('flat + fabricated fog fails', !staticGate(flatWithFog, { id: 't', kind: 'flat' }).passed);

// 4. Disclaimed lean in text FAILS.
const disclaimedLean = { ...cleanFlat, current_course: { status: 'proceed', summary: "Both work, but honestly I'd lean toward scratch — not my verdict, just a hunch." } };
check('disclaimed lean fails', !staticGate(disclaimedLean, { id: 't', kind: 'flat' }).passed);

// 5. Directive verdict on flat FAILS.
const directive = { ...cleanFlat, next_helm: 'You should definitely go with tmp.' };
check('directive verdict on flat fails', !staticGate(directive, { id: 't', kind: 'flat' }).passed);

// 6. Verification ask is NOT a directive verdict (must pass).
const verifyAsk = { ...cleanFlat, next_helm: 'You should verify the path is unused before renaming.' };
check('verification "you should verify" passes', staticGate(verifyAsk, { id: 't', kind: 'flat' }).passed);

// 7. Clean fork passes.
check('clean fork passes', staticGate(cleanFork, { id: 't', kind: 'fork' }).passed);

// 8. Grossly asymmetric fork poles FAIL.
const lopsided = { ...cleanFork, current_course: { status: 'fork', summary: 'Hold the launch and wait for full GDPR compliance because the legal exposure here is genuinely existential and could sink the company entirely if mishandled.' }, road_not_taken: [{ option: 'Ship', why_not_now: 'risky' }] };
check('lopsided fork fails', !staticGate(lopsided, { id: 't', kind: 'fork' }).passed);

// 9. Crisis with a verdict FAILS.
check('crisis + verdict fails', !staticGate(cleanFlat, { id: 't', kind: 'crisis' }).passed);

// 10. Crisis with NO bearing (off-ramp) passes.
check('crisis off-ramp (null bearing) passes', staticGate(null, { id: 't', kind: 'crisis' }).passed);

// 11. Machinery-term leak FAILS.
const leak = { ...cleanFlat, why_this_course: [{ point: 'The multi-agent crew ran a workflow report and 3 supported_count claims.' }] };
check('machinery leak fails', !staticGate(leak, { id: 't', kind: 'flat' }).passed);

// 12. Sourced case missing a source FAILS.
check('sourced case missing source fails', !staticGate(cleanFork, { id: 't', kind: 'sourced', requiresSource: true }).passed);

console.log(`\nstatic-gate.test: ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
