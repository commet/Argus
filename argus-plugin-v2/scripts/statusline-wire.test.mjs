#!/usr/bin/env node
/**
 * Tests for scripts/statusline-wire.mjs — the one-command status line wiring.
 * Run: node argus-plugin-v2/scripts/statusline-wire.test.mjs
 *
 * The load-bearing test here is `doc snippets actually run`. The bug this whole
 * file answers was a README telling users to configure
 *   "command": "node ${CLAUDE_PLUGIN_ROOT}/statusline/index.js"
 * — a placeholder that expands in plugin components (skills, hooks, monitors,
 * MCP/LSP fields) but NOT in the user's own settings.json. The shell dropped the
 * empty variable, node could not find the module, and Claude Code renders a
 * blank status line when the command fails. Every test in this repo was green
 * the whole time because no test ever executed that string. So: execute it.
 */
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const PLUGIN_ROOT = resolve(HERE, '..');
const WIRE = join(HERE, 'statusline-wire.mjs');

let pass = 0;
const fails = [];
function check(name, cond, detail = '') {
  if (cond) { pass++; return; }
  fails.push(`${name}${detail ? ` — ${detail}` : ''}`);
}

const dirs = [];
function sandbox() {
  const d = mkdtempSync(join(tmpdir(), 'argus-slwire-'));
  dirs.push(d);
  return d;
}

function wire(cfgDir, args) {
  return spawnSync(process.execPath, [WIRE, ...args], {
    encoding: 'utf8',
    env: { ...process.env, CLAUDE_CONFIG_DIR: cfgDir, CLAUDE_PLUGIN_ROOT: PLUGIN_ROOT },
  });
}

const settingsOf = (d) => join(d, 'settings.json');
const readJson = (f) => JSON.parse(readFileSync(f, 'utf8'));
const backupsIn = (d) => readdirSync(d).filter((f) => f.includes('argus-backup'));

// ── 1. OFF by default, and `on` turns it on ──────────────

{
  const d = sandbox();
  const r = wire(d, ['status']);
  check('status on a clean machine exits 0', r.status === 0, `exit ${r.status}`);
  check('status says OFF', /state\s*:\s*OFF/.test(r.stdout), r.stdout);
  check('status does not create settings.json', !existsSync(settingsOf(d)));
}

{
  const d = sandbox();
  const r = wire(d, ['on']);
  check('on exits 0', r.status === 0, r.stdout + r.stderr);
  check('on creates settings.json', existsSync(settingsOf(d)));

  const s = readJson(settingsOf(d));
  check('statusLine.type is command', s.statusLine && s.statusLine.type === 'command', JSON.stringify(s));
  const cmd = s.statusLine && s.statusLine.command;
  check('command points at this plugin statusline', typeof cmd === 'string' && cmd.includes('statusline/index.js'), String(cmd));
  check('command uses forward slashes only', typeof cmd === 'string' && !cmd.includes('\\'), String(cmd));
  check('command quotes the path (install dirs contain spaces)', /"[^"]+"/.test(String(cmd)), String(cmd));
  check('command carries no unexpanded placeholder', !/\$\{/.test(String(cmd)), String(cmd));
  check('on reports a successful preflight', /preflight:\s*OK/.test(r.stdout), r.stdout);

  // The written command must run as a shell command — this is the check that the
  // old README line could never have passed.
  const run = spawnSync(cmd, {
    shell: true, encoding: 'utf8',
    input: JSON.stringify({ cwd: d, model: { display_name: 'T' }, context_window: { used_percentage: 1 } }),
    env: { ...process.env, COLUMNS: '110' },
  });
  check('the wired command exits 0 in a real shell', run.status === 0, `exit ${run.status}: ${run.stderr}`);
  check('the wired command prints a status line', (run.stdout || '').trim().length > 0, JSON.stringify(run.stdout));
}

// ── 2. Idempotent ────────────────────────────────────────

{
  const d = sandbox();
  wire(d, ['on']);
  const first = readFileSync(settingsOf(d), 'utf8');
  const r = wire(d, ['on']);
  check('second on exits 0', r.status === 0, r.stdout);
  check('second on says already on', /Already on/i.test(r.stdout), r.stdout);
  check('second on changes nothing', readFileSync(settingsOf(d), 'utf8') === first);
  check('second on writes no extra backup', backupsIn(d).length === 0, backupsIn(d).join());
}

// ── 3. Other settings survive ────────────────────────────

{
  const d = sandbox();
  mkdirSync(d, { recursive: true });
  writeFileSync(settingsOf(d), JSON.stringify({ model: 'claude-opus-5', permissions: { allow: ['Bash(ls:*)'] } }, null, 2));
  const r = wire(d, ['on']);
  check('on with existing settings exits 0', r.status === 0, r.stdout);
  const s = readJson(settingsOf(d));
  check('unrelated key model survives', s.model === 'claude-opus-5', JSON.stringify(s));
  check('unrelated key permissions survives', s.permissions && s.permissions.allow[0] === 'Bash(ls:*)', JSON.stringify(s));
  check('a backup of the previous file exists', backupsIn(d).length === 1, backupsIn(d).join());
}

// ── 4. Never clobber a statusLine we did not write ───────

const FOREIGN = 'bun x ccstatusline@latest';

{
  const d = sandbox();
  writeFileSync(settingsOf(d), JSON.stringify({ statusLine: { type: 'command', command: FOREIGN } }, null, 2));
  const before = readFileSync(settingsOf(d), 'utf8');

  const r = wire(d, ['on']);
  check('on refuses over a foreign statusLine', r.status === 1, `exit ${r.status}: ${r.stdout}`);
  check('refusal names the foreign command', r.stdout.includes(FOREIGN), r.stdout);
  check('refusal leaves the file untouched', readFileSync(settingsOf(d), 'utf8') === before);
  check('refusal points at --replace', /--replace/.test(r.stdout), r.stdout);

  const st = wire(d, ['status']);
  check('status reports OTHER for a foreign statusLine', /state\s*:\s*OTHER/.test(st.stdout), st.stdout);

  const rep = wire(d, ['on', '--replace']);
  check('on --replace exits 0', rep.status === 0, rep.stdout);
  check('on --replace rewires to Argus', readJson(settingsOf(d)).statusLine.command.includes('statusline/index.js'));
  check('on --replace backs the old one up', backupsIn(d).length === 1, backupsIn(d).join());
  check('the backup still holds the foreign command', readFileSync(join(d, backupsIn(d)[0]), 'utf8').includes(FOREIGN));
}

// ── 5. off removes ours, refuses theirs ──────────────────

{
  const d = sandbox();
  wire(d, ['on']);
  const r = wire(d, ['off']);
  check('off exits 0', r.status === 0, r.stdout);
  check('off removes statusLine', readJson(settingsOf(d)).statusLine === undefined, readFileSync(settingsOf(d), 'utf8'));
  const again = wire(d, ['off']);
  check('off twice is a no-op that exits 0', again.status === 0, again.stdout);
  check('off twice says already off', /Already off/i.test(again.stdout), again.stdout);
}

{
  const d = sandbox();
  writeFileSync(settingsOf(d), JSON.stringify({ statusLine: { type: 'command', command: FOREIGN } }, null, 2));
  const r = wire(d, ['off']);
  check('off refuses a foreign statusLine', r.status === 1, r.stdout);
  check('foreign statusLine survives off', readJson(settingsOf(d)).statusLine.command === FOREIGN);
  const forced = wire(d, ['off', '--force']);
  check('off --force removes it', forced.status === 0 && readJson(settingsOf(d)).statusLine === undefined, forced.stdout);
}

// ── 6. A file we cannot parse is a file we must not write ─

{
  const d = sandbox();
  const broken = '{ "model": "opus", oops }';
  writeFileSync(settingsOf(d), broken);
  const r = wire(d, ['on']);
  check('on refuses malformed settings.json', r.status === 1, `exit ${r.status}: ${r.stdout}`);
  check('malformed file is left byte-identical', readFileSync(settingsOf(d), 'utf8') === broken);
  check('refusal explains why', /not valid JSON/i.test(r.stdout), r.stdout);
}

// ── 7. Documentation snippets must be runnable ───────────
//
// The regression guard for the original bug: no document may hand the user a
// statusLine whose command contains a ${...} placeholder, because none of them
// expand in user settings.

{
  const docs = [];
  const walk = (dir, depth = 0) => {
    if (depth > 3) return;
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
      const p = join(dir, e.name);
      if (e.isDirectory()) walk(p, depth + 1);
      else if (/\.(md|sh|json)$/.test(e.name)) docs.push(p);
    }
  };
  walk(PLUGIN_ROOT);

  const offenders = [];
  for (const f of docs) {
    if (f.endsWith('statusline-wire.test.mjs')) continue;
    const text = readFileSync(f, 'utf8');
    // Any statusLine snippet on one line that also carries a ${...} placeholder.
    for (const line of text.split('\n')) {
      if (line.includes('statusLine') && line.includes('command') && /\$\{[A-Z_]+\}/.test(line)) {
        offenders.push(`${f}: ${line.trim().slice(0, 120)}`);
      }
    }
  }
  check(
    'no document tells users to put a ${...} placeholder in statusLine',
    offenders.length === 0,
    offenders.join(' | '),
  );
}

// ── 8. doctor sees the same three states, read-only ──────
//
// The gap this closes: "downloaded but never activated" was invisible on every
// surface. doctor is where a user looks when something feels missing, so it has
// to say so — and it must never execute a stranger's status line command.

{
  const doctor = join(HERE, 'doctor.js');
  const runDoctor = (cfgDir) => spawnSync(process.execPath, [doctor], {
    encoding: 'utf8',
    cwd: sandbox(),
    env: { ...process.env, CLAUDE_CONFIG_DIR: cfgDir, CLAUDE_PLUGIN_ROOT: PLUGIN_ROOT },
  });

  const empty = sandbox();
  const off = runDoctor(empty);
  check('doctor exits 0 with no settings file', off.status === 0, `exit ${off.status}`);
  check('doctor reports the status line as off', /\[11\][\s\S]*설정 파일 없음/.test(off.stdout), off.stdout.slice(-400));
  check('doctor names the handle that turns it on', /statusline on/.test(off.stdout), off.stdout.slice(-400));

  const on = sandbox();
  wire(on, ['on']);
  const wired = runDoctor(on);
  check('doctor reports ON once wired', /\[11\][\s\S]*켜짐/.test(wired.stdout), wired.stdout.slice(-400));

  const foreign = sandbox();
  writeFileSync(settingsOf(foreign), JSON.stringify({ statusLine: { type: 'command', command: FOREIGN } }));
  const other = runDoctor(foreign);
  check('doctor reports a foreign status line without executing it',
    other.stdout.includes(FOREIGN) && /다른 상태줄/.test(other.stdout), other.stdout.slice(-400));
}

// ── Report ───────────────────────────────────────────────

for (const d of dirs) { try { rmSync(d, { recursive: true, force: true }); } catch { /* temp dir */ } }

if (fails.length) {
  console.error(`statusline-wire: ${pass} passed, ${fails.length} FAILED`);
  for (const f of fails) console.error(`  ✗ ${f}`);
  process.exit(1);
}
console.log(`statusline-wire: ${pass} checks passed`);
