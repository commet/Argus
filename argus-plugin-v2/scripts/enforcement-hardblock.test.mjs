// Proves the enforcement gate is a HARD BLOCK, not just advisory: the validate-gates
// CLI must exit non-zero (2) on a violating session, and 0 on a clean one. This is the
// difference between "prose says don't" and "the build fails if you do".
// Run: node argus-plugin-v2/scripts/enforcement-hardblock.test.mjs
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const cli = path.join(__dirname, 'validate-gates.mjs');

function makeSession(version) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'argus-hb-'));
  const dir = path.join(root, 'sessions', 's1', 'versions', 'v0.1');
  fs.mkdirSync(dir, { recursive: true });
  for (const [name, obj] of Object.entries(version)) fs.writeFileSync(path.join(dir, name), JSON.stringify(obj));
  return root;
}
// validate-gates resolves sessions under <root>/sessions; pass the argus dir directly.
function runOn(root) {
  return spawnSync(process.execPath, [cli, '--root', root], { encoding: 'utf8' });
}

let pass = 0, fail = 0;
const ok = (n, c) => { if (c) { pass++; console.log(`  ok   ${n}`); } else { fail++; console.error(`  FAIL ${n}`); } };

const bearing = {
  label: 'v0.1',
  current_course: { status: 'proceed', summary: 'go' },
  why_this_course: [{ point: 'x' }],
  fog_or_reef: null, road_not_taken: [], next_helm: 'go', contract_seed: null,
  blocked: false, detail_path: '.argus/x', generated_at: '2026-06-23T00:00:00.000Z',
};

// Violation: blocked verification but an executable bearing → must exit 2.
const bad = makeSession({
  'current_bearing.json': bearing,
  'verification-ledger.json': { overall_status: 'blocked', routing_decision: 'stop_for_human_check', challenged_claims: [], human_required_checks: [] },
});
const r1 = runOn(bad);
ok('violating session → CLI exits 2 (hard block)', r1.status === 2);
ok('violating session → reports the violation', /VERIFY/.test(r1.stderr || ''));

// Clean: flat bearing + flat analysis → must exit 0.
const good = makeSession({
  'current_bearing.json': bearing,
  'analysis.json': { frame_status: 'flat', request_type: 'open_decision' },
});
const r2 = runOn(good);
ok('clean session → CLI exits 0', r2.status === 0);

fs.rmSync(bad, { recursive: true, force: true });
fs.rmSync(good, { recursive: true, force: true });
console.log(`\nenforcement-hardblock.test: ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
