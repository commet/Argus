// Functional test for the single-source ledger writers (plugin-core Option A).
// Run: node argus-plugin-v2/scripts/decision-ledger.test.mjs
//
// This is the "would a broken wire turn red?" guard for the ledger CLI: the
// clarify / preapprove / resolve skills no longer hand-write ledger JSON, they
// call `record` / `amend` / `settle`. If the CLI's emitted shape drifts from what
// the readers replay, THIS test fails loud instead of the LLM silently producing
// a plausible-but-unreplayable line.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
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
const AUTH = ['--authorization-ref', 'test:explicit-user-action'];

// --- writer lock: contention must stop honestly, never write concurrently ----
{
  const p = freshProject();
  const ledgerDir = join(p, '.argus', 'ledger');
  mkdirSync(ledgerDir, { recursive: true });
  writeFileSync(
    join(ledgerDir, 'ledger.jsonl.lock'),
    JSON.stringify({ nonce: 'active-test-lock', pid: process.pid, started_at: new Date().toISOString() }),
    'utf8',
  );
  const r = run(p, [
    'record', '--id', 'locked', '--predicate', 'this must not race',
    '--kind', 'witness', ...AUTH,
  ]);
  ok('an active writer lock fails closed', r.status !== 0 && /ARGUS_LEDGER_BUSY/.test(r.stderr));
  ok('lock contention writes no ledger bytes', !existsSync(join(ledgerDir, 'ledger.jsonl')));
  rmSync(p, { recursive: true, force: true });
}

// --- record: explicit id + author (the clarify BIND lean) ------------------
{
  const p = freshProject();
  const r = run(p, ['record', '--id', 'lean:s1', '--session', 's1', '--type', 'open',
    '--author', 'user', '--predicate', 'we ship monday', '--check-by', '2027-01-01', ...AUTH]);
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
  ok('harvest+seal are one append batch with one timestamp', h.at === s.at && h.ts === s.ts);
  ok('seal carries the authority receipt', s.authorization_ref === 'test:explicit-user-action');
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
    '--predicate', 'cutover under 5 min', '--kind', 'witness', ...AUTH]);
  ok('record (derived id) exits 0', r.status === 0);
  const [h, s] = ledgerLines(p);
  ok('id derives as sha256(session|quote)', h.id === stableId('helm/2026-07-16', 'plan sentence') && s.id === h.id);
  ok('stakes passed through', h.stakes === 'high');
  ok('witness omits --check-by → seal has no check_by field', !('check_by' in s));
  // Provenance is declared, never defaulted: with no --author the field is
  // OMITTED (absence = unknown/AI-path); author:"user" is reserved for the
  // user's own line on an explicitly confirmed path.
  ok('record without --author omits the author field (absence = AI-path signal)', !('author' in s));
  rmSync(p, { recursive: true, force: true });
}

// --- amend: push a pending contract's date (the resolve pending branch) -----
{
  const p = freshProject();
  run(p, ['record', '--id', 'c1', '--session', 's', '--predicate', 'x holds', '--check-by', '2027-01-01', ...AUTH]);
  const r = run(p, ['amend', 'c1', '--check-by', '2027-02-01', ...AUTH]);
  ok('amend exits 0', r.status === 0);
  const last = ledgerLines(p).at(-1);
  ok('amend line is append-only with new check_by', last.event === 'amend' && last.id === 'c1' && last.check_by === '2027-02-01' && isIso(last.at));
  rmSync(p, { recursive: true, force: true });
}

// --- AI wording: confirmation is authority, lineage keeps the origin --------
{
  const p = freshProject();
  const missingLineage = run(p, [
    'record', '--id', 'ai-missing', '--predicate', 'AI draft', '--kind', 'witness',
    '--author', 'ai_surfaced', '--confirmed', ...AUTH,
  ]);
  ok('AI-authored direct record rejects a missing proposal reference', missingLineage.status !== 0);
  const invalidMode = run(p, [
    'record', '--id', 'ai-invalid', '--predicate', 'AI draft', '--kind', 'witness',
    '--author', 'ai_surfaced', '--confirmed', '--proposal-ref', 'proposal:1',
    '--adopted-as', 'magic', ...AUTH,
  ]);
  ok('AI adoption rejects an unknown adoption mode', invalidMode.status !== 0);
  const accepted = run(p, [
    'record', '--id', 'ai-valid', '--predicate', 'AI draft', '--kind', 'witness',
    '--author', 'ai_surfaced', '--confirmed', '--proposal-ref', 'proposal:1',
    '--adopted-as', 'wording', ...AUTH,
  ]);
  ok('confirmed AI wording records exact adoption lineage', accepted.status === 0);
  const sealed = ledgerLines(p).find((event) => event.id === 'ai-valid' && event.event === 'seal');
  ok('AI lineage preserves proposal id and adoption purpose',
    sealed?.adoption_lineage?.[0]?.source_proposal_ref === 'proposal:1'
    && sealed?.adoption_lineage?.[0]?.adopted_as === 'wording');
  ok('confirmed AI wording is tagged ai_surfaced, never relabeled user', sealed?.author === 'ai_surfaced');
  ok('an unknown --author value exits non-zero', run(p, [
    'record', '--id', 'ai-bad', '--predicate', 'AI draft', '--kind', 'witness',
    '--author', 'robot', ...AUTH,
  ]).status !== 0);
  rmSync(p, { recursive: true, force: true });
}

// --- wake: in-session lean settlement on the BIND rope (sail Step 7.5) -------
{
  const p = freshProject();
  // a user-authored lean rope, exactly like clarify's BIND seal
  run(p, ['record', '--id', 'lean:s9', '--session', 's9', '--type', 'open',
    '--author', 'user', '--predicate', 'we should ship B', '--check-by', '2027-01-01', ...AUTH]);
  // held: no --changed, lean_before auto-fills from the sealed predicate
  const held = run(p, ['wake', 'lean:s9', '--lean-after', 'we should ship B', ...AUTH]);
  ok('wake (held) exits 0', held.status === 0);
  const w = ledgerLines(p).at(-1);
  ok('wake line has the canonical shape', w.event === 'wake' && w.id === 'lean:s9' && w.changed === false && isIso(w.at));
  ok('lean_before auto-fills from the sealed predicate (single-source, no retype)', w.lean_before === 'we should ship B');
  ok('lean_after is the passed user words', w.lean_after === 'we should ship B');
  // a second wake on the same rope is refused (mechanical "already woken → skip")
  ok('second wake on same id is refused', run(p, ['wake', 'lean:s9', '--lean-after', 'x', ...AUTH]).status !== 0);
  rmSync(p, { recursive: true, force: true });
}
{
  const p = freshProject();
  run(p, ['record', '--id', 'lean:s10', '--session', 's10', '--author', 'user', '--predicate', 'go with plan A', '--check-by', '2027-01-01', ...AUTH]);
  const moved = run(p, ['wake', 'lean:s10', '--lean-after', 'actually plan C now', '--changed', ...AUTH]);
  ok('wake (moved) exits 0', moved.status === 0);
  const w = ledgerLines(p).at(-1);
  ok('moved wake records changed:true + the new user line', w.changed === true && w.lean_after === 'actually plan C now' && w.lean_before === 'go with plan A');
  rmSync(p, { recursive: true, force: true });
}

// --- premises: the items.jsonl store (a DIFFERENT file from the ledger) --------
const CHECK_CONTRACTS = join(dirname(fileURLToPath(import.meta.url)), 'check-contracts.js');
function itemsLines(cwd) {
  return readFileSync(join(cwd, '.argus', 'items.jsonl'), 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
}
{
  const p = freshProject();
  // extract a load-bearing external premise → the reducer starts it monitored (on_change)
  const ex = run(p, ['premises', 'extract', '--id', 'item_d_p1', '--decision', 'd', '--type', 'premise',
    '--text', 'rates stay flat this year', '--external', '--load-bearing']);
  ok('premises extract exits 0', ex.status === 0);
  const it = itemsLines(p).at(-1);
  ok('extract writes to items.jsonl (not the ledger) with the reducer-consumed shape',
    it.event === 'extract' && it.id === 'item_d_p1' && it.type === 'premise' && it.external === true && it.load_bearing === true && it.ai_original === 'rates stay flat this year');
  ok('extract defaults ai_original to text; no undefined leaks', !JSON.stringify(it).includes('"undefined"'));
  // items.jsonl is gitignored (personal), same privacy posture as the ledger
  ok('items.jsonl is added to .argus/.gitignore', readFileSync(join(p, '.argus', '.gitignore'), 'utf8').includes('items.jsonl'));

  // END-TO-END: the reducer (check-contracts.js) must actually SEE this as a due premise
  const reminder = spawnSync(process.execPath, [CHECK_CONTRACTS], { cwd: p, encoding: 'utf8' });
  ok('check-contracts surfaces the CLI-written premise as due', /premise|전제/i.test(reminder.stdout));

  // add (user) → source:user, no ai_original
  run(p, ['premises', 'add', '--id', 'item_d_q1', '--decision', 'd', '--type', 'open_question', '--text', 'do we need region 2?']);
  const added = itemsLines(p).at(-1);
  ok('add is user-sourced with no ai_original', added.event === 'add' && added.source === 'user' && !('ai_original' in added));

  // alert off → reducer drops it from "due"; dismiss/edit/recheck shapes
  run(p, ['premises', 'alert', '--id', 'item_d_p1', '--mode', 'off']);
  ok('alert writes {id,mode}', itemsLines(p).at(-1).mode === 'off');
  run(p, ['premises', 'edit', '--id', 'item_d_p1', '--action', 'refine', '--to', 'rates rise 0.5pt']);
  ok('edit writes {id,action,to}', (() => { const e = itemsLines(p).at(-1); return e.event === 'edit' && e.action === 'refine' && e.to === 'rates rise 0.5pt'; })());
  run(p, ['premises', 'recheck', '--id', 'item_d_p1', '--last-value', 'BOK held at 3.5%']);
  ok('recheck writes {id,last_value}', itemsLines(p).at(-1).last_value === 'BOK held at 3.5%');
  run(p, ['premises', 'dismiss', '--id', 'item_d_p1']);
  ok('dismiss writes {id}', itemsLines(p).at(-1).event === 'dismiss');
  rmSync(p, { recursive: true, force: true });
}

// --- loud failures: a broken call must exit non-zero, never write junk ------
{
  const p = freshProject();
  ok('record without --predicate exits non-zero', run(p, ['record', '--id', 'x']).status !== 0);
  ok('record with non-ISO --check-by exits non-zero', run(p, ['record', '--id', 'x', '--predicate', 'y', '--check-by', 'soon']).status !== 0);
  ok('record without id or session exits non-zero', run(p, ['record', '--predicate', 'y']).status !== 0);
  ok('record without authorization exits non-zero', run(p, ['record', '--id', 'x', '--predicate', 'a checkable line', '--kind', 'witness']).status !== 0);
  ok('amend with no fields exits non-zero', run(p, ['amend', 'c1']).status !== 0);
  ok('amend with non-ISO --check-by exits non-zero', run(p, ['amend', 'c1', '--check-by', 'later']).status !== 0);
  ok('wake without --lean-after exits non-zero', run(p, ['wake', 'lean:z']).status !== 0);
  ok('wake on an id with no sealed lean (no --lean-before) exits non-zero', run(p, ['wake', 'lean:none', '--lean-after', 'x', ...AUTH]).status !== 0);
  rmSync(p, { recursive: true, force: true });
}

// --- foundation return: independent axes, never a score ---------------------
{
  const p = freshProject();
  run(p, ['record', '--predicate', 'a checkable sentence about reality', '--id', 's1', '--check-by', '2099-01-01', ...AUTH]);
  const legacy = run(p, ['settle', 's1', '--outcome', 'happened', ...AUTH]);
  ok('new records reject the legacy outcome-only write', legacy.status !== 0);
  const returned = run(p, [
    'settle', 's1',
    '--option', 'condition_met',
    '--response', 'The condition was met',
    '--reality', 'met',
    '--question-validity', 'valid',
    '--present-standard', 'same',
    '--present-standard-response', 'It is the same',
    ...AUTH,
  ]);
  ok('foundation return exits 0', returned.status === 0);
  const settled = ledgerLines(p).find((e) => e.event === 'settle' && e.id === 's1');
  ok('return stores separate axes, not a legacy verdict',
    settled?.axes?.reality === 'met'
    && settled?.axes?.commitment === 'maintained'
    && settled?.axes?.question === 'valid'
    && !('outcome' in settled));
  ok('return stores the present standard answer verbatim',
    settled?.present_standard?.status === 'same'
    && settled?.present_standard?.response_text === 'It is the same');
  ok('return stores its authorization receipt', settled?.authorization_ref === 'test:explicit-user-action');
  ok('settle line carries the v stamp (MCP versioned-skip, not dropped)', settled?.v === 1);
  ok('settle line carries ts (MCP settled_on source) alongside at', typeof settled?.ts === 'string' && typeof settled?.at === 'string');

  run(p, ['record', '--predicate', 'I will send the migration plan', '--id', 'commitment-axis', '--kind', 'commitment', '--check-by', '2099-01-01', ...AUTH]);
  run(p, [
    'settle', 'commitment-axis',
    '--option', 'enacted',
    '--response', 'I acted on the commitment',
    '--commitment', 'enacted',
    '--question-validity', 'valid',
    '--present-standard', 'changed',
    '--present-standard-response', 'I would change the terms of the commitment',
    ...AUTH,
  ]);
  const commitmentReturn = ledgerLines(p).find((e) => e.event === 'settle' && e.id === 'commitment-axis');
  ok('answered present standard becomes the axis-two projection',
    commitmentReturn?.axes?.commitment === 'revised'
    && commitmentReturn?.response_text === 'I acted on the commitment');

  run(p, ['record', '--predicate', 'another checkable sentence here', '--id', 's2', '--check-by', '2099-01-01', ...AUTH]);
  ok('settle rejects an unknown outcome', run(p, [
    'settle', 's2', '--outcome', 'sorta',
    '--present-standard', 'same', '--present-standard-response', 'It is the same',
    ...AUTH,
  ]).status !== 0);
  ok('settle rejects an unknown observation source', run(p, [
    'settle', 's2',
    '--option', 'condition_met', '--response', 'The condition was met',
    '--reality', 'met', '--question-validity', 'valid',
    '--present-standard', 'same', '--present-standard-response', 'It is the same',
    '--observation-source-kind', 'oracle',
    ...AUTH,
  ]).status !== 0);
  ok('statement revision requires authorization', run(p, ['revise', '--id', 's2', '--statement', 'revised wording']).status !== 0);
  ok('statement revision appends with authorization', run(p, ['revise', '--id', 's2', '--statement', 'revised wording', '--authorization-ref', 'turn:5']).status === 0);
  ok('kind correction appends with authorization', run(p, ['correct-kind', '--id', 's2', '--kind', 'commitment', '--authorization-ref', 'turn:6']).status === 0);
  const journal = run(p, ['journal']);
  ok('journal shows the revised chronology', journal.status === 0 && journal.stdout.includes('revised wording'));
  ok('journal never emits outcome aggregates', !/track record|held|missed|accuracy|score|luck/i.test(journal.stdout));
  rmSync(p, { recursive: true, force: true });
}

// --- retired branding: user-relayed output says "Seeds", never "Sail" -------
// (tranche-4 audit item 11: the sail command is retired; CLI lines the model
// relays to users must not resurrect the old brand vocabulary.)
{
  const p = freshProject();
  const st = run(p, ['status']);
  ok('status exits 0', st.status === 0);
  ok('status counts seeds with neutral wording', /Seeds: \d+/.test(st.stdout));
  ok('no retired "Sail" branding in status output', !/sail/i.test(st.stdout));
  const bad = run(p, ['seal', 'no-such-id']);
  ok('unknown seal target error avoids retired branding', bad.status !== 0 && !/sail/i.test(bad.stderr));
  rmSync(p, { recursive: true, force: true });
}

// --- 2026-08-09 journey-audit guards: settlement is terminal ------------------
// settle was the ONLY writer without an existence/state guard (wake, revise,
// correct-kind all had one) — a typo'd id became a ghost settlement the reducer
// filters forever, a retry double-settled and silently overwrote outcome, and a
// record rerun RESURRECTED a settled decision (seal flips status back), which
// re-armed the SessionStart nag for something the user already answered.
{
  const p = freshProject();
  const SETTLE_ARGS = [
    '--option', 'condition_met', '--response', 'It held',
    '--reality', 'met', '--question-validity', 'valid',
    '--present-standard', 'same', '--present-standard-response', 'Same',
    ...AUTH,
  ];

  const ghost = run(p, ['settle', 'no-such-id', ...SETTLE_ARGS]);
  ok('settle refuses an unknown id (ghost settlement)', ghost.status !== 0);
  ok('ghost settle appends nothing', !existsSync(join(p, '.argus', 'ledger', 'ledger.jsonl')));

  run(p, ['record', '--predicate', 'terminal guard sentence', '--id', 'g1', '--check-by', '2099-01-01', ...AUTH]);
  ok('first settle succeeds', run(p, ['settle', 'g1', ...SETTLE_ARGS]).status === 0);
  const dbl = run(p, ['settle', 'g1', ...SETTLE_ARGS]);
  ok('second settle refused (double settlement overwrites outcome)', dbl.status !== 0);
  ok('double settle appends nothing new', ledgerLines(p).filter((e) => e.event === 'settle').length === 1);

  const reseal = run(p, ['record', '--predicate', 'terminal guard sentence', '--id', 'g1', '--check-by', '2099-01-01', ...AUTH]);
  ok('record refuses to re-seal a settled id (no resurrection)', reseal.status !== 0);

  // Read-side heal: a stray seal line that an OLD writer already appended after
  // settlement must not flip the record back to sealed on replay.
  const ledgerPath = join(p, '.argus', 'ledger', 'ledger.jsonl');
  writeFileSync(ledgerPath, readFileSync(ledgerPath, 'utf8')
    + JSON.stringify({ event: 'seal', id: 'g1', predicate: 'terminal guard sentence', check_by: '2099-01-01', at: new Date().toISOString() }) + '\n');
  const sealedList = run(p, ['list', '--status', 'sealed']);
  ok('stray seal after settle does not resurrect the record (read-side heal)', !sealedList.stdout.includes('g1'));
  rmSync(p, { recursive: true, force: true });
}

// --- defer: the honest date move for a DUE record (MCP rule parity) -----------
// Same ledger, same rules: MCP's state machine refuses `amend` on a due record
// (GOALPOST_MOVED) and routes it through a `defer` event that keeps the original
// date and count. The plugin CLI used amend for this — a bypass that also broke
// defer bookkeeping. Now: amend = pre-due typo fix only; defer = due-date move.
{
  const p = freshProject();
  run(p, ['record', '--predicate', 'a due record sentence', '--id', 'd1', '--check-by', '2020-01-01', ...AUTH]);

  const goalpost = run(p, ['amend', 'd1', '--check-by', '2099-01-01', ...AUTH]);
  ok('amend on a DUE record is refused (goalpost move)', goalpost.status !== 0 && /goalpost|defer/i.test(goalpost.stderr));

  const deferred = run(p, ['defer', 'd1', '--to', '2099-01-01', ...AUTH]);
  ok('defer moves the due date honestly', deferred.status === 0);
  const dEv = ledgerLines(p).find((e) => e.event === 'defer' && e.id === 'd1');
  ok('defer event keeps the original date (from) — MCP replay shape', dEv?.from === '2020-01-01' && dEv?.check_by === '2099-01-01');

  const j = run(p, ['list', '--status', 'sealed']);
  ok('deferred record stays sealed with the new date', j.stdout.includes('d1'));

  const ghostDefer = run(p, ['defer', 'no-such', '--to', '2099-01-01', ...AUTH]);
  ok('defer refuses an unknown id', ghostDefer.status !== 0);

  // amend before due still works (typo fix) — the guard is due-scoped.
  run(p, ['record', '--predicate', 'a future record sentence', '--id', 'd2', '--check-by', '2098-01-01', ...AUTH]);
  ok('amend on a pre-due record still works', run(p, ['amend', 'd2', '--check-by', '2099-06-01', ...AUTH]).status === 0);
  rmSync(p, { recursive: true, force: true });
}

// --- record rerun is exactly as safe as preapprove.md advertises --------------
{
  const p = freshProject();
  run(p, ['record', '--predicate', 'idempotent sentence', '--id', 'g2', '--check-by', '2099-01-01', ...AUTH]);
  const before = ledgerLines(p).length;
  const rerun = run(p, ['record', '--predicate', 'idempotent sentence', '--id', 'g2', '--check-by', '2099-01-01', ...AUTH]);
  ok('record rerun with the same wording is an idempotent success', rerun.status === 0);
  ok('idempotent rerun appends nothing', ledgerLines(p).length === before);
  const overwrite = run(p, ['record', '--predicate', 'a different sentence entirely', '--id', 'g2', '--check-by', '2099-01-01', ...AUTH]);
  ok('record refuses a silent overwrite with different wording', overwrite.status !== 0);
  rmSync(p, { recursive: true, force: true });
}

console.log(`\ndecision-ledger.test: ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
