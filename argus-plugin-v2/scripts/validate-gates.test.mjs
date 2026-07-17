// Unit test for the enforcement gates — fixture sessions, no API key.
// Proves the gate validator flags the must-not-skip violations and passes clean
// artifacts. Run: node argus-plugin-v2/scripts/validate-gates.test.mjs

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { checkVersion } from './validate-gates.mjs';

let pass = 0, fail = 0;
function check(name, cond) {
  if (cond) { pass++; console.log(`  ok   ${name}`); }
  else { fail++; console.error(`  FAIL ${name}`); }
}

// Build a throwaway version dir with the given artifacts and run checkVersion.
function run(files) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'argus-gate-'));
  for (const [name, obj] of Object.entries(files)) {
    fs.writeFileSync(path.join(dir, name), JSON.stringify(obj));
  }
  const out = checkVersion(dir);
  fs.rmSync(dir, { recursive: true, force: true });
  return out;
}

const cleanBearing = {
  label: 'v0.1',
  current_course: { status: 'proceed', summary: 'Keep the current stack — nothing argues for a change.' },
  why_this_course: [{ point: 'Works with no stated pain.' }],
  fog_or_reef: null, road_not_taken: [], next_helm: 'Keep going.',
  contract_seed: null, blocked: false, detail_path: '.argus/x', generated_at: '2026-06-23T00:00:00.000Z',
};

// 1. No bearing → nothing to enforce.
check('no bearing passes', run({}).length === 0);

// 2. Clean flat bearing with a flat analysis passes.
check('clean flat passes', run({ 'current_bearing.json': cleanBearing, 'analysis.json': { frame_status: 'flat', request_type: 'open_decision' } }).length === 0);

// 3. VERIFY: blocked verification + executable bearing FAILS.
check('blocked verification + executable bearing fails', run({
  'current_bearing.json': { ...cleanBearing, blocked: false },
  'verification-ledger.json': { overall_status: 'blocked', routing_decision: 'stop_for_human_check', challenged_claims: [], human_required_checks: [] },
}).some((m) => m.startsWith('VERIFY')));

// 4. VERIFY: blocked verification but bearing correctly blocked:true PASSES.
check('blocked verification + blocked bearing passes', run({
  'current_bearing.json': { ...cleanBearing, blocked: true, current_course: { status: 'hold', summary: 'Hold until counsel classifies the gap.' } },
  'verification-ledger.json': { overall_status: 'blocked', routing_decision: 'stop_for_human_check', challenged_claims: [], human_required_checks: [] },
}).length === 0);

// 5. VERIFY: critical challenged claim proceeding to boss with no user_choice FAILS.
check('critical claim → boss w/o user_choice fails', run({
  'current_bearing.json': cleanBearing,
  'verification-ledger.json': { overall_status: 'mixed', routing_decision: 'proceed_to_boss', challenged_claims: [{ claim: 'x', challenge: 'unsupported', severity: 'critical', suggested_fix: 'test it' }], human_required_checks: [], user_choice: null },
}).some((m) => m.startsWith('VERIFY')));

// 6. VERIFY: human-required check blocking execution + executable bearing FAILS.
check('exec-blocking human check + executable bearing fails', run({
  'current_bearing.json': { ...cleanBearing, blocked: false },
  'verification-ledger.json': { overall_status: 'mixed', routing_decision: 'ask_user', challenged_claims: [], human_required_checks: [{ check: 'legal sign-off', why_ai_cannot_verify: 'needs counsel', blocks: 'execution' }] },
}).some((m) => m.startsWith('VERIFY')));

// 7. ROUTE-CONTRACT: vent that produced a bearing FAILS.
check('vent + bearing fails', run({
  'current_bearing.json': cleanBearing,
  'analysis.json': { request_type: 'vent', frame_status: 'flat' },
}).some((m) => m.startsWith('ROUTE-CONTRACT')));

// 8. ROUTE-CONTRACT: validation request with a manufactured fork FAILS.
check('validation + fork fails', run({
  'current_bearing.json': { ...cleanBearing, current_course: { status: 'fork', summary: 'A vs B' }, road_not_taken: [{ option: 'B', why_not_now: 'later' }] },
  'analysis.json': { request_type: 'validation', frame_status: 'load_bearing' },
}).some((m) => m.startsWith('ROUTE-CONTRACT')));

// 9. FRAME-FLAT: flat analysis + manufactured fork FAILS.
check('flat + manufactured fork fails', run({
  'current_bearing.json': { ...cleanBearing, current_course: { status: 'fork', summary: 'A vs B' }, road_not_taken: [{ option: 'B', why_not_now: 'later' }] },
  'analysis.json': { frame_status: 'flat', request_type: 'open_decision' },
}).some((m) => m.startsWith('FRAME-FLAT')));

// 10. FRAME-FLAT: flat analysis + fabricated fog FAILS.
check('flat + fabricated fog fails', run({
  'current_bearing.json': { ...cleanBearing, fog_or_reef: { issue: 'naming convention unclear', why_it_matters: 'future confusion', required_check: 'survey team' } },
  'analysis.json': { frame_status: 'flat', request_type: 'open_decision' },
}).some((m) => m.startsWith('FRAME-FLAT')));

// 11. OUTPUT-INTEGRITY: a failed worker but overall_status=verified FAILS.
check('failed worker + verified status fails', run({
  'current_bearing.json': cleanBearing,
  'verification-ledger.json': { overall_status: 'verified', routing_decision: 'proceed_to_boss', challenged_claims: [], human_required_checks: [] },
  'worker_results.json': [{ id: 'w1', agent_id: 'sujin', status: 'done', verification_passed: true }, { id: 'w2', agent_id: 'minseo', status: 'verification_failed' }],
}).some((m) => m.startsWith('OUTPUT-INTEGRITY')));

// 12. OUTPUT-INTEGRITY: a weak worker (score<70) silently dropped (no fog, executable) FAILS.
check('weak worker silently dropped fails', run({
  'current_bearing.json': { ...cleanBearing, fog_or_reef: null, blocked: false },
  'worker_results.json': [{ id: 'w1', agent_id: 'sujin', status: 'done', verification_score: 42 }],
}).some((m) => m.startsWith('OUTPUT-INTEGRITY')));

// 13. OUTPUT-INTEGRITY: all workers clean → passes.
check('all workers clean passes', run({
  'current_bearing.json': cleanBearing,
  'verification-ledger.json': { overall_status: 'verified', routing_decision: 'proceed_to_boss', challenged_claims: [], human_required_checks: [] },
  'worker_results.json': [{ id: 'w1', agent_id: 'sujin', status: 'done', verification_passed: true, verification_score: 88 }],
  'analysis.json': { frame_status: 'load_bearing', request_type: 'open_decision' },
}).length === 0);

// ── SEED gate (port of argus-mcp validate-seal.ts)
const goodSeed = {
  predicate: 'If we compress the crew to 5, 30-day first-run completion stays at or above the 62% baseline.',
  check_by: '2026-07-23',
  pass_condition: '30-day first-run completion rate >= 62%.',
  fail_condition: '30-day first-run completion rate < 62%.',
};

// 14. SEED: a complete four-part seed with a future check_by passes.
check('four-part seed passes', run({
  'current_bearing.json': { ...cleanBearing, contract_seed: goodSeed },
}).length === 0);

// 15. SEED: empty/too-short predicate FAILS.
check('empty predicate fails', run({
  'current_bearing.json': { ...cleanBearing, contract_seed: { ...goodSeed, predicate: 'ok' } },
}).some((m) => m.startsWith('SEED')));

// 16. SEED: English vibe-predicate FAILS.
check('vibe predicate (en) fails', run({
  'current_bearing.json': { ...cleanBearing, contract_seed: { ...goodSeed, predicate: 'The launch will probably go well for the team.' } },
}).some((m) => m.startsWith('SEED')));

// 17. SEED: Korean vibe-predicate FAILS.
check('vibe predicate (ko) fails', run({
  'current_bearing.json': { ...cleanBearing, contract_seed: { ...goodSeed, predicate: '이번 출시는 잘 될 것 같다 아마도' } },
}).some((m) => m.startsWith('SEED')));

// 18. SEED: prose check_by ("event + offset") is legitimate per sail Step 7 — PASSES.
check('prose check_by passes', run({
  'current_bearing.json': { ...cleanBearing, contract_seed: { ...goodSeed, check_by: '30 days after release' } },
}).length === 0);

// 18b. SEED: MISSING check_by FAILS — the contract can never settle.
check('missing check_by fails', run({
  'current_bearing.json': { ...cleanBearing, contract_seed: { predicate: goodSeed.predicate, pass_condition: goodSeed.pass_condition, fail_condition: goodSeed.fail_condition } },
}).some((m) => m.startsWith('SEED')));

// 19. SEED: check_by not after the bearing's generated_at FAILS (born already due).
check('check_by <= generated_at fails', run({
  'current_bearing.json': { ...cleanBearing, contract_seed: { ...goodSeed, check_by: '2026-06-23' } },
}).some((m) => m.startsWith('SEED')));

// 20. SEED: missing fail_condition FAILS (four-part contract, sail Step 7).
check('missing fail_condition fails', run({
  'current_bearing.json': { ...cleanBearing, contract_seed: { predicate: goodSeed.predicate, check_by: goodSeed.check_by, pass_condition: goodSeed.pass_condition } },
}).some((m) => m.startsWith('SEED')));

// 21. SEED: check_by past TODAY but after generated_at still passes — an old
// session's due contract is due, not invalid (CI replays history).
check('old-but-valid seed passes in replay', run({
  'current_bearing.json': { ...cleanBearing, generated_at: '2025-01-01T00:00:00.000Z', contract_seed: { ...goodSeed, check_by: '2025-01-31' } },
}).length === 0);

// ── --hook mode (PostToolUse pre-render gate, §9.7 O1 방5) — spawn the real
// CLI with hook JSON on stdin, exactly as Claude Code invokes it.
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const SCRIPT = fileURLToPath(new URL('./validate-gates.mjs', import.meta.url));

function runHook(stdinText) {
  return spawnSync(process.execPath, [SCRIPT, '--hook'], { input: stdinText, encoding: 'utf8' });
}

function hookWrite(files, writtenName) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'argus-hook-'));
  for (const [name, obj] of Object.entries(files)) {
    fs.writeFileSync(path.join(dir, name), JSON.stringify(obj));
  }
  const res = runHook(JSON.stringify({ tool_name: 'Write', tool_input: { file_path: path.join(dir, writtenName) } }));
  fs.rmSync(dir, { recursive: true, force: true });
  return res;
}

// 22. hook: a just-written bearing with an unsettleable seed exits 2 and names SEED —
// the violation reaches the model BEFORE it renders the bearing.
{
  const res = hookWrite(
    { 'current_bearing.json': { ...cleanBearing, contract_seed: { ...goodSeed, predicate: 'ok' } } },
    'current_bearing.json',
  );
  check('hook: violating bearing write exits 2', res.status === 2);
  check('hook: violation names the SEED gate', /SEED/.test(res.stderr));
}

// 23. hook: a clean bearing write exits 0 silently.
{
  const res = hookWrite({ 'current_bearing.json': { ...cleanBearing, contract_seed: goodSeed } }, 'current_bearing.json');
  check('hook: clean bearing write exits 0', res.status === 0 && !res.stderr.trim());
}

// 24. hook: any non-bearing write is a silent fast no-op.
{
  const res = hookWrite({ 'notes.json': { hello: 1 } }, 'notes.json');
  check('hook: non-bearing write exits 0', res.status === 0 && !res.stderr.trim());
}

// 25. hook: garbage stdin never wedges the session (exit 0).
{
  const res = runHook('not json at all');
  check('hook: garbage stdin exits 0', res.status === 0);
}

console.log(`\nvalidate-gates.test: ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
