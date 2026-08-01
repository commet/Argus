/**
 * compare.mjs — v1→v2→v3 convergence table (zero LLM calls).
 * Per criterion per scenario: FAIL severity by MAJORITY across judge re-runs
 * (H only when H in >= half the runs; single-run scenarios count their run).
 * Usage: node scripts/sim/compare.mjs [dir1 dir2 dir3 ...]  (default v1 v2 current)
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SIM = path.dirname(fileURLToPath(import.meta.url));
const dirs = process.argv.slice(2).length
  ? process.argv.slice(2)
  : ['results-v1', 'results-v2', 'results'];

function counts(dir, id) {
  try {
    const r = JSON.parse(fs.readFileSync(path.join(SIM, dir, id + '.json'), 'utf8'));
    if (!r.judge) return null;
    const crit = {};
    for (const run of r.judge.runs) {
      for (const [k, v] of Object.entries(run.criteria || {})) {
        crit[k] = crit[k] || [];
        crit[k].push(v?.verdict === 'FAIL' ? (v.severity || 'M') : 'P');
      }
    }
    let H = 0, M = 0;
    const det = [];
    for (const [k, arr] of Object.entries(crit)) {
      const h = arr.filter((x) => x === 'H').length;
      const fails = arr.filter((x) => x !== 'P').length;
      const n = arr.length;
      if (!fails) continue;
      if (h * 2 >= n && h > 0) { H++; det.push(k + ':H'); }
      else if (fails * 2 >= n) { M++; det.push(k + ':M'); }
    }
    return { H, M, det: det.join(' ') };
  } catch { return null; }
}

const ids = fs.readdirSync(path.join(SIM, dirs[0]))
  .filter((x) => x.endsWith('.json') && !x.startsWith('_'))
  .map((x) => x.replace('.json', ''));

const totals = dirs.map(() => ({ H: 0, M: 0 }));
console.log('scenario'.padEnd(28), dirs.map((d) => d.replace('results', 'v').replace('-', '')).join('  '));
for (const id of ids) {
  const cells = [];
  dirs.forEach((d, i) => {
    const c = counts(d, id);
    if (c) { totals[i].H += c.H; totals[i].M += c.M; }
    cells.push(c ? `${c.H}/${c.M}` : '-');
  });
  console.log(id.padEnd(28), cells.map((c) => c.padEnd(6)).join(' '));
}
console.log('TOTAL(H/M)'.padEnd(28), totals.map((t) => `${t.H}/${t.M}`.padEnd(6)).join(' '));

// detail dump for the LAST dir (current)
console.log('\n--- current-run FAIL detail (majority) ---');
for (const id of ids) {
  const c = counts(dirs[dirs.length - 1], id);
  if (c && c.det) console.log(id.padEnd(28), c.det);
}
