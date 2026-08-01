/**
 * premise-census.mjs — what the model proposes, and what the door does with it.
 *
 *   node scripts/sim/premise-census.mjs              # every sim result
 *   node scripts/sim/premise-census.mjs results-v2   # an older run
 *   node scripts/sim/premise-census.mjs --json       # machine-readable
 *
 * ZERO LLM calls. It replays the proposals already captured in
 * scripts/sim/results/*.json through the REAL admission contract, so it
 * measures both halves of the pipeline at once:
 *
 *   supply   did the model propose anything, and of what kind
 *   door     what was admitted, reclassified, or refused — and why
 *
 * Why this exists. On 2026-08-01 the premise pipeline was rebuilt end to end —
 * lineage, kinds, observables, the seal, the return — on top of a model that
 * had quietly stopped proposing. Eleven heavy sessions produced TWO premises,
 * with a 100% acceptance rate, and every green test in the repo agreed
 * everything was fine. Acceptance rate looks like health and is the one number
 * that cannot see an empty pipe: it is 100% when nothing arrives.
 *
 * So the census reports supply and door separately and never divides one by the
 * other. The number that matters is per-SESSION coverage — how many real
 * conversations ended with something recorded — because that is the promise the
 * product makes to the person in front of it.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const SIM = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(SIM, '..', '..');
const SRC = path.join(REPO, 'src');

const args = process.argv.slice(2);
const asJSON = args.includes('--json');
const dir = args.find((a) => !a.startsWith('--')) || 'results';

// ── bundle the real contract (no shim: it is pure, it calls nothing) ─────────

const alias = {
  name: 'argus-alias',
  setup(b) {
    b.onResolve({ filter: /^@\// }, (a) => {
      const base = path.join(SRC, a.path.slice(2));
      for (const c of [base, `${base}.ts`, `${base}.tsx`, path.join(base, 'index.ts')]) {
        try { if (fs.statSync(c).isFile()) return { path: c }; } catch { /* next */ }
      }
      return null;
    });
  },
};

const OUT = path.join(SIM, '.build', 'contract.mjs');
await build({
  entryPoints: [path.join(SRC, 'lib', 'judgment-state-contract.ts')],
  bundle: true, format: 'esm', platform: 'node', outfile: OUT,
  plugins: [alias], logLevel: 'silent',
});
const contract = await import(pathToFileURL(OUT).href);
const { coercePremiseCandidates, applyPremiseDeltas } = contract;

// ── replay ──────────────────────────────────────────────────────────────────

const RESULTS = path.join(SIM, dir);
const files = fs.existsSync(RESULTS)
  ? fs.readdirSync(RESULTS).filter((f) => f.endsWith('.json') && !f.startsWith('_'))
  : [];
if (files.length === 0) {
  console.error(`[census] no results in ${RESULTS} — run scripts/sim/run-sim.mjs first`);
  process.exit(1);
}

// A vent, a crisis or a how-to question SHOULD end with nothing recorded —
// restraint is the correct outcome there, and counting those sessions in the
// denominator would read as a coverage failure and push the next fix toward
// over-firing on exactly the routes where firing is the harm. So the headline
// number is over OPEN sessions only, and the rest are reported as a separate
// line that is supposed to read zero.
const OPEN_ROUTES = new Set(['open']);

const census = {
  dir,
  sessions: 0,
  openSessions: 0,
  sessionsWithRecord: 0,
  openWithRecord: 0,
  openWithClaim: 0,
  openWithSettleable: 0,
  nonOpenWithRecord: [],
  proposed: 0,
  admitted: 0,
  reclassified: 0,
  declared: {},
  recorded: {},
  rejected: {},
  withObservable: 0,
  withIfFalse: 0,
  /** The far edge of the claim band — nothing gates on it yet. A high-novelty
   *  item with near-zero anchor overlap is a real quote with an invented claim
   *  bolted on, which is the failure mode a guard would exist to catch. If this
   *  stays at zero the guard is not worth writing. */
  farEdge: [],
  perSession: [],
};

const bump = (o, k) => { o[k] = (o[k] || 0) + 1; };

for (const file of files.sort()) {
  const r = JSON.parse(fs.readFileSync(path.join(RESULTS, file), 'utf8'));
  if (!r.heavy?.initial) continue;

  census.sessions += 1;
  const route = r.heavy.initial.result?.request_type || r.heavy.initial.raw?.request_type || 'open';
  const isOpen = OPEN_ROUTES.has(route);
  if (isOpen) census.openSessions += 1;
  const opening = r.opening || '';
  const replies = r.replies || [];
  const row = { id: r.id, proposed: 0, records: [], rejected: [] };

  const take = ({ records, audit }) => {
    for (const entry of audit) {
      row.proposed += 1;
      census.proposed += 1;
      if (entry.declared_kind) bump(census.declared, entry.declared_kind);
      if (entry.accepted) {
        census.admitted += 1;
        if (entry.recorded_kind) bump(census.recorded, entry.recorded_kind);
        if (entry.declared_kind && entry.recorded_kind && entry.declared_kind !== entry.recorded_kind) {
          census.reclassified += 1;
        }
        if (entry.band && entry.band.anchor_overlap === 0 && entry.band.novelty > 0.9) {
          census.farEdge.push({ id: r.id, text: entry.text, band: entry.band });
        }
      } else {
        bump(census.rejected, entry.reason);
        row.rejected.push(entry.reason);
      }
    }
    for (const rec of records) {
      if (!row.records.some((x) => x.text === rec.text)) row.records.push(rec);
    }
  };

  take(coercePremiseCandidates(r.heavy.initial.raw?.premise_candidates, opening));

  let corpus = opening;
  (r.heavy.deepening || []).forEach((turn, i) => {
    const answer = replies[i] || '';
    corpus = `${corpus}\n${answer}`;
    take(applyPremiseDeltas(row.records, turn.premise_changes, corpus, answer));
  });

  for (const rec of row.records) {
    if (rec.observable) census.withObservable += 1;
    if (rec.if_false_changes) census.withIfFalse += 1;
  }
  const hasClaim = row.records.some((x) => x.kind === 'premise' || x.kind === 'prediction');
  // An honest open_question with an observable is ALSO something reality will
  // answer, and sometimes it is the more honest thing to leave the user with.
  // Reading coverage as claims-only pushes toward manufacturing a premise where
  // "nobody has checked this yet" was the truthful record.
  const hasSettleable = row.records.some(
    (x) => x.kind === 'premise' || x.kind === 'prediction' || x.kind === 'open_question',
  );
  if (row.records.length > 0) {
    census.sessionsWithRecord += 1;
    if (isOpen) census.openWithRecord += 1;
    else census.nonOpenWithRecord.push({ id: r.id, route, kept: row.records.length });
  }
  if (isOpen && hasClaim) census.openWithClaim += 1;
  if (isOpen && hasSettleable) census.openWithSettleable += 1;
  row.route = route;
  census.perSession.push(row);
}

// ── report ──────────────────────────────────────────────────────────────────

if (asJSON) {
  console.log(JSON.stringify(census, null, 2));
  process.exit(0);
}

const pct = (n, d) => (d === 0 ? '  n/a' : `${String(Math.round((n / d) * 100)).padStart(3)}%`);
const line = (k, v) => console.log(`  ${k.padEnd(26)} ${v}`);

console.log(`\nPREMISE CENSUS — ${dir}  (${census.sessions} sessions, 0 LLM calls)\n`);
console.log('SUPPLY — did the model look, where looking was the job?');
line('OPEN sessions', `${census.openSessions}/${census.sessions}`);
line('open: anything kept', `${census.openWithRecord}/${census.openSessions}  ${pct(census.openWithRecord, census.openSessions)}`);
line('open: SETTLEABLE kept', `${census.openWithSettleable}/${census.openSessions}  ${pct(census.openWithSettleable, census.openSessions)}  <- the promise`);
line('open: a CLAIM kept', `${census.openWithClaim}/${census.openSessions}  ${pct(census.openWithClaim, census.openSessions)}`);
line('non-open that recorded', `${census.nonOpenWithRecord.length}  ${census.nonOpenWithRecord.length === 0 ? '(correct: restraint held)' : JSON.stringify(census.nonOpenWithRecord)}`);
line('proposals', String(census.proposed));
line('declared kinds', JSON.stringify(census.declared));

console.log('\nDOOR — what happened to them');
line('admitted', `${census.admitted}/${census.proposed}`);
line('recorded kinds', JSON.stringify(census.recorded));
line('reclassified', `${census.reclassified}  (model said one thing, contract filed another)`);
line('refused', JSON.stringify(census.rejected));

console.log('\nQUALITY — is a record worth anything later');
line('carries an observable', `${census.withObservable}`);
line('carries a counterfactual', `${census.withIfFalse}`);
line('far-edge candidates', `${census.farEdge.length}  ${census.farEdge.length === 0 ? '(no guard warranted)' : '(quote with an unrelated claim)'}`);

console.log('\nPER SESSION');
for (const s of census.perSession) {
  const kinds = s.records.map((r) => r.kind).join(',') || '—';
  const refused = s.rejected.length ? `  refused: ${s.rejected.join(',')}` : '';
  console.log(`  ${s.id.padEnd(26)} ${String(s.route).padEnd(11)} ${String(s.records.length).padStart(2)} kept [${kinds}]${refused}`);
}
console.log();
