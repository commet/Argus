/**
 * Structural audit for the verification harness.
 *
 * A green gate is evidence only after we have proved it can turn red. This file
 * checks both directions:
 *   - every baseline eval is either mutation-proven or narrowly waived;
 *   - every eval file is run, mutation-proven, or explicitly classified.
 *
 * It also attacks its own parser with damaged verify-all fixtures. That avoids
 * the circular "gate-coverage waives gate-coverage" claim that an existence
 * check cannot justify.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const VERIFY_PATH = path.join(HERE, 'verify-all.mjs');
const VERIFY = fs.readFileSync(VERIFY_PATH, 'utf8');

const EXPECTED_BASELINE = new Set([
  'ambient-picker',
  'answer-time',
  'battery',
  'claude-code-form',
  'codex-app-server',
  'e2e-picker',
  'fuzz',
  'gate-coverage',
  'host-matrix',
  'keepsake-frames',
  'model-channel',
  'package-executable',
  'picker-surfaces',
  'slow-human',
  'surface-hazards',
  'unreadable-ledger',
  'version-lockstep',
  'widget-runtime',
]);

const WAIVED = new Map([
  [
    'fuzz',
    'randomized liveness/property check: no single product mutation represents its adversarial input space; fixed seeds and crash/malformed-envelope assertions make failures reproducible',
  ],
  [
    'package-executable',
    'platform artifact check: Windows intentionally skips POSIX mode while Linux CI directly checks the built file and npm pack metadata',
  ],
  [
    'gate-coverage',
    'structural meta-gate; this file damages in-memory verify-all fixtures below and requires both missing-run and missing-self-test failures',
  ],
  ['verify-all', 'orchestrator that schedules and restores gates; it asserts no standalone product contract'],
  ['verify-published', 'post-publish network/artifact check; cannot run before a release exists'],
  ['anthropic', 'shared client used by manual LLM reviews, not a gate'],
  ['architecture-review', 'manual, LLM-judged review; intentionally not merge-blocking'],
  ['copy-audit', 'manual, paid LLM prose review; intentionally not merge-blocking'],
  [
    'overfire-model',
    'model-in-the-loop restraint eval for the BLUEPRINT M1 exit: needs ANTHROPIC_API_KEY (run mode) or externally collected transcripts (score mode); scored receipts live in docs/receipts/2026-08-10-m1-overfire-eval/ and are intentionally not merge-blocking',
  ],
  [
    'persona-overfire',
    'persona-conditioned variant of overfire-model (phrasing-population robustness of the closed-decision repair): same API-key/run-mode constraints, deterministic scorer shared by import; not merge-blocking',
  ],
  [
    'first-user-journey',
    'installs the PUBLISHED tarball from npm and drives a persona through the whole install→seal→restart→return→settle journey: needs ANTHROPIC_API_KEY and network, and a first-user journey has no pass/fail contract a merge can block on — its value is the friction it surfaces, recorded in docs/receipts/2026-08-11-first-user-journey/',
  ],
  [
    'persona-sampling',
    'pure deterministic sampler over MIT-licensed MatrAIx schema axes, not a gate; its two load-bearing properties (level coverage, no axis confounding) are vitest-guarded by persona-sampling-guard.test.ts',
  ],
  ['codex-elicit-wire-probe', 'wire investigation tool that reports observations and asserts no product contract'],
  ['discover', 'raw host-payload investigation tool, superseded as a gate by host-matrix and picker-surfaces'],
  ['live-roundtrip', 'real-network investigation kept outside deterministic pre-merge verification'],
]);

function evalsRun(source) {
  const found = new Set();
  for (const match of source.matchAll(/\brun\(([\s\S]*?)\n?\);/g)) {
    const hit = /evals\/([a-z0-9-]+)\.mjs/.exec(match[1]);
    if (hit) found.add(hit[1]);
  }
  return found;
}

function evalsMutationProven(source) {
  const found = new Set();
  for (const block of source.split(/\bselfTest\(/).slice(1)) {
    const hit = /evals\/([a-z0-9-]+)\.mjs/.exec(block.slice(0, 1600));
    if (hit) found.add(hit[1]);
  }
  return found;
}

function sameSet(left, right) {
  return left.size === right.size && [...left].every((item) => right.has(item));
}

function audit(source, onDisk) {
  const run = evalsRun(source);
  const proven = evalsMutationProven(source);
  const violations = [];

  if (!sameSet(run, EXPECTED_BASELINE)) {
    const missing = [...EXPECTED_BASELINE].filter((gate) => !run.has(gate));
    const unexpected = [...run].filter((gate) => !EXPECTED_BASELINE.has(gate));
    violations.push(`baseline manifest mismatch; missing=${missing.join(',') || '-'} unexpected=${unexpected.join(',') || '-'}`);
  }

  for (const gate of run) {
    if (!proven.has(gate) && !WAIVED.has(gate)) {
      violations.push(`${gate}: baseline gate has never been mutation-proven and is not waived`);
    }
  }

  for (const file of onDisk) {
    if (!run.has(file) && !proven.has(file) && !WAIVED.has(file)) {
      violations.push(`${file}: eval file is neither run, mutation-proven, nor classified`);
    }
  }

  for (const [gate, reason] of WAIVED) {
    if (!onDisk.has(gate)) violations.push(`${gate}: stale waiver for a missing file`);
    if (reason.trim().length < 40) violations.push(`${gate}: waiver reason is not specific enough`);
  }

  return { run, proven, violations };
}

const onDisk = new Set(
  fs.readdirSync(HERE)
    .filter((file) => file.endsWith('.mjs') && !file.startsWith('_'))
    .map((file) => file.replace(/\.mjs$/, '')),
);

const result = audit(VERIFY, onDisk);

// Self-attack 1: if a known baseline invocation disappears, the exact manifest
// must make this gate red even when the parser still finds "enough" other runs.
const withoutBattery = VERIFY.replace(
  /^run\('내용 배터리[^\n]*\n/m,
  '',
);
if (!audit(withoutBattery, onDisk).violations.some((v) => v.includes('baseline manifest mismatch'))) {
  result.violations.push('self-attack failed: removing a baseline run was not detected');
}

// Self-attack 2: remove every battery self-test command while keeping the
// baseline. Battery is not waived, so the proof gap must be detected.
const proofBoundary = VERIFY.indexOf('\ntry {\n');
const withoutBatteryProof = VERIFY.slice(0, proofBoundary)
  + VERIFY.slice(proofBoundary).replaceAll('node evals/battery.mjs', 'node evals/removed-battery-proof.mjs');
const proofAudit = audit(withoutBatteryProof, onDisk);
if (!proofAudit.violations.some((v) => v.includes('battery: baseline gate has never been mutation-proven'))) {
  result.violations.push('self-attack failed: removing a mutation proof was not detected');
}

const label = `${result.run.size} baseline gates · ${result.proven.size} mutation-proven · ${WAIVED.size} explicit classifications`;
if (result.violations.length) {
  console.error(`\n❌ gate coverage: ${result.violations.length} violation(s) · ${label}\n`);
  for (const violation of result.violations) console.error(`  - ${violation}`);
  process.exit(1);
}

console.log(`✅ gate coverage · ${label} · both self-attacks detected`);
