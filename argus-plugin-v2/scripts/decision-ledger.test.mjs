// Functional test for the single-source ledger writers (plugin-core Option A).
// Run: node argus-plugin-v2/scripts/decision-ledger.test.mjs
//
// This is the "would a broken wire turn red?" guard for the ledger CLI: the
// clarify / preapprove / resolve skills no longer hand-write ledger JSON, they
// call `record` / `amend` / `settle`. If the CLI's emitted shape drifts from what
// the readers replay, THIS test fails loud instead of the LLM silently producing
// a plausible-but-unreplayable line.
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import { createHash } from 'node:crypto';

const CLI = join(dirname(fileURLToPath(import.meta.url)), 'decision-ledger.js');

let pass = 0, fail = 0;
const ok = (name, cond) => { if (cond) { pass++; console.log(`  ok   ${name}`); } else { fail++; console.error(`  FAIL ${name}`); } };

function freshProject() {
  const dir = mkdtempSync(join(tmpdir(), 'argus-ledger-'));
  mkdirSync(join(dir, '.argus'), { recursive: true });
  return dir;
}
function run(cwd, args) {
  return spawnSync(process.execPath, [CLI, ...args], { cwd, encoding: 'utf8' });
}
function ledgerLines(cwd) {
  const text = readFileSync(join(cwd, '.argus', 'ledger', 'ledger.jsonl'), 'utf8');
  return text.split('\n').filter(Boolean).map((l) => JSON.parse(l)); // throws loud on malformed
}
const stableId = (session, quote) => createHash('sha256').update(`${session}|${quote}`).digest('hex').slice(0, 8);
const isIso = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(s);

// --- record: explicit id + author (the clarify BIND lean) ------------------
{
  const p = freshProject();
  const r = run(p, ['record', '--id', 'lean:s1', '--session', 's1', '--type', 'open',
    '--author', 'user', '--predicate', 'we ship monday', '--check-by', '2027-01-01']);
  ok('record (lean) exits 0', r.status === 0);
  const ev = ledgerLines(p);
  ok('record writes exactly harvest+seal', ev.length === 2 && ev[0].event === 'harvest' && ev[1].event === 'seal');
  const [h, s] = ev;
  ok('harvest id/session/type preserved', h.id === 'lean:s1' && h.session === 's1' && h.type === 'open');
  ok('harvest quote+decision default to predicate', h.quote === 'we ship monday' && h.decision === 'we ship monday');
  ok('seal carries predicate/check_by/author + default falsified_if',
    s.id === 'lean:s1' && s.predicate === 'we ship monday' && s.check_by === '2027-01-01'
    && s.author === 'user' && s.falsified_if === 'opposite observed');
  ok('both lines stamp an ISO `at`', isIso(h.at) && isIso(s.at));
  ok('no undefined leaked into the JSON', !JSON.stringify(ev).includes('"undefined"'));
  // replays to a sealed contract the readers can see
  const list = run(p, ['list', '--status', 'sealed']);
  ok('sealed contract replays into `list`', list.stdout.includes('lean:s1') && list.stdout.includes('we ship monday'));
  rmSync(p, { recursive: true, force: true });
}

// --- record: derived id, no --check-by (the preapprove plan seal) -----------
{
  const p = freshProject();
  const r = run(p, ['record', '--session', 'helm/2026-07-16', '--quote', 'plan sentence',
    '--decision', 'ship the cutover', '--type', 'adopt', '--stakes', 'high',
    '--predicate', 'cutover under 5 min', '--falsified-if', 'rollback fired']);
  ok('record (derived id) exits 0', r.status === 0);
  const [h, s] = ledgerLines(p);
  ok('id derives as sha256(session|quote)', h.id === stableId('helm/2026-07-16', 'plan sentence') && s.id === h.id);
  ok('stakes passed through', h.stakes === 'high');
  ok('omitted --check-by → seal has no check_by field', !('check_by' in s));
  ok('omitted --author → seal has no author field (machine-surfaced)', !('author' in s));
  rmSync(p, { recursive: true, force: true });
}

// --- amend: push a pending contract's date (the resolve pending branch) -----
{
  const p = freshProject();
  run(p, ['record', '--id', 'c1', '--session', 's', '--predicate', 'x holds', '--check-by', '2027-01-01']);
  const r = run(p, ['amend', 'c1', '--check-by', '2027-02-01']);
  ok('amend exits 0', r.status === 0);
  const last = ledgerLines(p).at(-1);
  ok('amend line is append-only with new check_by', last.event === 'amend' && last.id === 'c1' && last.check_by === '2027-02-01' && isIso(last.at));
  rmSync(p, { recursive: true, force: true });
}

// --- wake: in-session lean settlement on the BIND rope (sail Step 7.5) -------
{
  const p = freshProject();
  // a user-authored lean rope, exactly like clarify's BIND seal
  run(p, ['record', '--id', 'lean:s9', '--session', 's9', '--type', 'open',
    '--author', 'user', '--predicate', 'we should ship B']);
  // held: no --changed, lean_before auto-fills from the sealed predicate
  const held = run(p, ['wake', 'lean:s9', '--lean-after', 'we should ship B']);
  ok('wake (held) exits 0', held.status === 0);
  const w = ledgerLines(p).at(-1);
  ok('wake line has the canonical shape', w.event === 'wake' && w.id === 'lean:s9' && w.changed === false && isIso(w.at));
  ok('lean_before auto-fills from the sealed predicate (single-source, no retype)', w.lean_before === 'we should ship B');
  ok('lean_after is the passed user words', w.lean_after === 'we should ship B');
  // a second wake on the same rope is refused (mechanical "already woken → skip")
  ok('second wake on same id is refused', run(p, ['wake', 'lean:s9', '--lean-after', 'x']).status !== 0);
  rmSync(p, { recursive: true, force: true });
}
{
  const p = freshProject();
  run(p, ['record', '--id', 'lean:s10', '--session', 's10', '--author', 'user', '--predicate', 'go with plan A']);
  const moved = run(p, ['wake', 'lean:s10', '--lean-after', 'actually plan C now', '--changed']);
  ok('wake (moved) exits 0', moved.status === 0);
  const w = ledgerLines(p).at(-1);
  ok('moved wake records changed:true + the new user line', w.changed === true && w.lean_after === 'actually plan C now' && w.lean_before === 'go with plan A');
  rmSync(p, { recursive: true, force: true });
}

// --- loud failures: a broken call must exit non-zero, never write junk ------
{
  const p = freshProject();
  ok('record without --predicate exits non-zero', run(p, ['record', '--id', 'x']).status !== 0);
  ok('record with non-ISO --check-by exits non-zero', run(p, ['record', '--id', 'x', '--predicate', 'y', '--check-by', 'soon']).status !== 0);
  ok('record without id or session exits non-zero', run(p, ['record', '--predicate', 'y']).status !== 0);
  ok('amend with no fields exits non-zero', run(p, ['amend', 'c1']).status !== 0);
  ok('amend with non-ISO --check-by exits non-zero', run(p, ['amend', 'c1', '--check-by', 'later']).status !== 0);
  ok('wake without --lean-after exits non-zero', run(p, ['wake', 'lean:z']).status !== 0);
  ok('wake on an id with no sealed lean (no --lean-before) exits non-zero', run(p, ['wake', 'lean:none', '--lean-after', 'x']).status !== 0);
  rmSync(p, { recursive: true, force: true });
}

console.log(`\ndecision-ledger.test: ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
