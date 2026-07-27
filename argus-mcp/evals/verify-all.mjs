import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repo = path.resolve(root, '..');
const npm = 'npm';

const gates = [
  ['build', npm, ['run', 'build'], root],
  ['typecheck', npm, ['run', 'typecheck'], root],
  ['unit and protocol tests', npm, ['test', '--', '--reporter=dot'], root],
  ['adversarial fuzz', npm, ['run', 'fuzz'], root],
  ['picker E2E', 'node', ['evals/e2e-picker.mjs', process.execPath, 'dist/index.js'], root],
  ['unreadable-ledger safety', 'node', ['evals/unreadable-ledger.mjs'], root],
  ['package contents', npm, ['pack', '--dry-run'], root],
  ['plugin validation', 'node', ['argus-plugin-v2/scripts/validate-plugin.js'], repo],
  ['plugin install smoke', 'node', ['argus-plugin-v2/scripts/install-smoke.mjs'], repo],
  ['plugin simulations', 'node', ['argus-plugin-v2/scripts/simulate-plugin.js'], repo],
];

let failed = 0;
console.log('Argus final-surface verification\n');
for (const [label, command, args, cwd] of gates) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: 'utf8',
    stdio: 'pipe',
    shell: process.platform === 'win32' && command === npm,
  });
  const ok = result.status === 0;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}`);
  if (!ok) {
    failed++;
    process.stdout.write(result.stdout ?? '');
    process.stderr.write(result.stderr ?? '');
  }
}

if (failed) {
  console.error(`\n${failed} final-surface gate(s) failed.`);
  process.exit(1);
}
console.log('\nAll final-surface gates passed.');
