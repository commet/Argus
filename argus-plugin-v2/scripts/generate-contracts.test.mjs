// Drift guard for generated cross-surface artifacts (dim2). Fails if a generated
// file is stale vs its JSON source — the markdown<->data drift the webapp/plugin
// split is prone to. Run: node argus-plugin-v2/scripts/generate-contracts.test.mjs
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const r = spawnSync(process.execPath, [path.join(__dirname, 'generate-contracts.mjs'), '--check'], { encoding: 'utf8' });
process.stdout.write(r.stdout || '');
if (r.status !== 0) {
  console.error(r.stderr || '');
  console.error('generate-contracts.test: FAILED (generated artifact out of sync)');
  process.exit(1);
}
console.log('generate-contracts.test: passed (generated artifacts in sync with sources)');
