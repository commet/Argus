#!/usr/bin/env node
/**
 * Argus driver — status line wiring (`--status` | `--on` | `--off`).
 *
 * Why this file exists. A plugin cannot ship the main `statusLine` key: Claude
 * Code only honours `agent` and `subagentStatusLine` from a plugin's own
 * settings.json (plugins reference → Standard plugin layout). So the statusline
 * this plugin ships is downloaded by every user and activated by none — unless
 * something writes the one key into THEIR `~/.claude/settings.json`. That is
 * this script's whole job, and `/argus:settings statusline` is its front door.
 *
 * Design rules it inherits from the rest of the plugin:
 *  - **Deterministic, not model-driven.** The script decides; the model relays.
 *  - **Never clobber what it did not write.** A foreign `statusLine` (ccstatusline,
 *    starship, the user's own script) is somebody's configuration. `--on` refuses
 *    and names it; only an explicit `--replace` overwrites, and it backs up first.
 *  - **Verify by running, not by reading.** `--status` executes the wired command
 *    exactly as Claude Code would (through a shell, with mock stdin) and reports
 *    the exit code. The predecessor of this file was a README line telling users
 *    to write `node ${CLAUDE_PLUGIN_ROOT}/statusline/index.js` — a placeholder
 *    that does NOT expand in user settings (it expands only in plugin components:
 *    skill/agent content, hook and monitor commands, MCP and LSP fields). The
 *    shell dropped the empty variable, node failed to find the module, and the
 *    status line silently went blank. Nothing executed that string, so nothing
 *    ever turned red. Executing it here is the loud failure that was missing.
 *  - **Honest gap over fabrication.** If settings.json is malformed, this script
 *    refuses and says so; it never rewrites a file it could not parse.
 *
 * Test seams (used by statusline-wire.test.mjs, never by users):
 *   CLAUDE_CONFIG_DIR   — directory holding settings.json (Claude Code's own env var)
 *   CLAUDE_PLUGIN_ROOT  — plugin install dir; same contract the doctor uses
 */
'use strict';

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));

/** Marker inside statusline/index.js — proves a wired path is an Argus statusline. */
const MARKER = 'Argus Status Line';

const out = [];
const say = (s) => out.push(s);

function flush(code) {
  process.stdout.write(out.join('\n') + '\n');
  process.exit(code);
}

// ── Paths ────────────────────────────────────────────────

function configDir() {
  const override = process.env.CLAUDE_CONFIG_DIR;
  return override && override.trim() ? override : path.join(os.homedir(), '.claude');
}

function settingsFile() {
  return path.join(configDir(), 'settings.json');
}

/**
 * The statusline this plugin ships. CLAUDE_PLUGIN_ROOT is where the HOST
 * installed the plugin and wins when present (same reasoning as doctor [10]:
 * the checkout next to this script is the same file only by coincidence).
 */
function pluginRoot() {
  const env = process.env.CLAUDE_PLUGIN_ROOT;
  return env && env.trim() ? env : path.resolve(HERE, '..');
}

function ourScript() {
  return path.resolve(pluginRoot(), 'statusline', 'index.js');
}

/** Forward slashes even on Windows: backslashes in the command get eaten as escapes. */
const fwd = (p) => p.replace(/\\/g, '/');

/** The exact command string Claude Code will run. Quoted — install paths have spaces. */
function commandFor(script) {
  return `node "${fwd(script)}"`;
}

// ── Reading the current state ────────────────────────────

/** Pull the script path out of a statusLine command string, if there is one. */
function scriptInCommand(cmd) {
  if (typeof cmd !== 'string') return null;
  const m = cmd.match(/"([^"]+\.(?:js|mjs|cjs))"|'([^']+\.(?:js|mjs|cjs))'|(\S+\.(?:js|mjs|cjs))/);
  if (!m) return null;
  return m[1] || m[2] || m[3];
}

/** An Argus statusline is one whose target file carries the marker. Path guessing lies; reading does not. */
function isArgusStatusline(cmd) {
  const script = scriptInCommand(cmd);
  if (!script) return false;
  try {
    return fs.readFileSync(script, 'utf8').slice(0, 4096).includes(MARKER);
  } catch {
    return false;
  }
}

/** { ok, settings, raw, missing } — never throws, never guesses past a parse error. */
function readSettings() {
  const file = settingsFile();
  let raw;
  try {
    raw = fs.readFileSync(file, 'utf8');
  } catch {
    return { ok: true, settings: {}, raw: null, missing: true };
  }
  const body = raw.charCodeAt(0) === 0xfeff ? raw.slice(1) : raw; // PS 5.1 writes a BOM
  try {
    const parsed = JSON.parse(body);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return { ok: false, reason: 'settings.json is not a JSON object' };
    }
    return { ok: true, settings: parsed, raw, missing: false };
  } catch (e) {
    return { ok: false, reason: `settings.json is not valid JSON (${e.message})` };
  }
}

function writeSettings(settings) {
  const file = settingsFile();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.argus-tmp`;
  fs.writeFileSync(tmp, JSON.stringify(settings, null, 2) + '\n', 'utf8');
  fs.renameSync(tmp, file); // atomic — a half-written settings.json locks the user out of their own config
}

function backup(raw) {
  if (raw == null) return null;
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\..+/, '');
  const file = `${settingsFile()}.argus-backup-${stamp}`;
  fs.writeFileSync(file, raw, 'utf8');
  return file;
}

// ── Does the wired command actually run? ─────────────────

/**
 * Run a statusLine command the way Claude Code does: through a shell, with the
 * session JSON on stdin. Returns { code, firstLine, stderr }.
 */
function tryCommand(cmd) {
  const stdin = JSON.stringify({
    model: { display_name: 'Argus preflight' },
    workspace: { current_dir: process.cwd() },
    cwd: process.cwd(),
    context_window: { used_percentage: 0 },
  });
  const r = spawnSync(cmd, {
    shell: true,
    input: stdin,
    encoding: 'utf8',
    env: { ...process.env, COLUMNS: process.env.COLUMNS || '110' },
    timeout: 10000,
  });
  const stdout = (r.stdout || '').replace(/\x1b\[[0-9;]*m/g, '').trim();
  return {
    code: r.status,
    firstLine: stdout.split('\n')[0] || '',
    stderr: (r.stderr || '').trim().split('\n')[0] || '',
  };
}

// ── Verbs ────────────────────────────────────────────────

function describeCurrent(settings) {
  const sl = settings.statusLine;
  if (!sl) return { state: 'absent' };
  const cmd = typeof sl === 'object' && sl ? sl.command : undefined;
  if (typeof cmd !== 'string') return { state: 'foreign', cmd: JSON.stringify(sl) };
  return { state: isArgusStatusline(cmd) ? 'argus' : 'foreign', cmd };
}

function cmdStatus() {
  const script = ourScript();
  const read = readSettings();
  say(`settings file : ${settingsFile()}${read.missing ? ' (does not exist yet)' : ''}`);
  say(`argus script  : ${script}${fs.existsSync(script) ? '' : '  ⚠ MISSING'}`);

  if (!read.ok) {
    say(`state         : UNKNOWN — ${read.reason}`);
    say('Fix the file by hand first; this tool will not rewrite a file it cannot parse.');
    flush(1);
  }

  const cur = describeCurrent(read.settings);
  if (cur.state === 'absent') {
    say('state         : OFF — no statusLine configured. Turn it on with: statusline on');
    flush(0);
  }
  if (cur.state === 'foreign') {
    say(`state         : OTHER — a non-Argus statusLine is configured: ${cur.cmd}`);
    say('Leave it, or replace it deliberately with: statusline on --replace');
    flush(0);
  }

  const same = path.resolve(scriptInCommand(cur.cmd) || '') === script;
  say(`state         : ON${same ? '' : ' — but pointing at another Argus copy'}`);
  say(`command       : ${cur.cmd}`);
  const run = tryCommand(cur.cmd);
  if (run.code === 0 && run.firstLine) {
    say(`preflight     : OK (exit 0) → ${run.firstLine}`);
  } else {
    say(`preflight     : ⚠ FAILS (exit ${run.code}) — Claude Code renders a blank status line when the command fails.`);
    if (run.stderr) say(`                ${run.stderr}`);
    say('                Repoint it with: statusline on --replace');
  }
  flush(0);
}

function cmdOn(replace) {
  const script = ourScript();
  if (!fs.existsSync(script)) {
    say(`Cannot enable: the statusline script is missing at ${script}`);
    flush(1);
  }

  const read = readSettings();
  if (!read.ok) {
    say(`Refusing to write: ${read.reason} (${settingsFile()})`);
    say('Fix or move that file first — overwriting it would destroy settings this tool did not write.');
    flush(1);
  }

  const cur = describeCurrent(read.settings);
  if (cur.state === 'foreign' && !replace) {
    say(`A statusLine is already configured and it is not Argus: ${cur.cmd}`);
    say('Left untouched. To take it over anyway (a backup is written first): statusline on --replace');
    flush(1);
  }

  const command = commandFor(script);
  if (cur.state === 'argus' && cur.cmd === command) {
    const run = tryCommand(command);
    say(`Already on — ${settingsFile()}`);
    say(`command: ${command}`);
    say(run.code === 0 ? `preflight: OK → ${run.firstLine}` : `preflight: ⚠ FAILS (exit ${run.code})`);
    flush(run.code === 0 ? 0 : 1);
  }

  // Preflight BEFORE writing: never wire a command that cannot run. This is the
  // gate the old README line would have failed.
  const pre = tryCommand(command);
  if (pre.code !== 0) {
    say(`Refusing to wire a command that fails here (exit ${pre.code}): ${command}`);
    if (pre.stderr) say(`  ${pre.stderr}`);
    say('Most likely cause: `node` is not on PATH. Install Node.js (>= 16), then run this again.');
    flush(1);
  }

  const backupFile = backup(read.raw);
  const next = { ...read.settings, statusLine: { type: 'command', command } };
  writeSettings(next);

  say(`Status line ON — ${settingsFile()}`);
  say(`command : ${command}`);
  say(`preflight: OK → ${pre.firstLine}`);
  if (cur.state === 'foreign') say(`replaced : ${cur.cmd}`);
  if (backupFile) say(`backup  : ${backupFile}`);
  say('It appears at the next interaction with Claude Code (no restart needed).');
  flush(0);
}

function cmdOff(force) {
  const read = readSettings();
  if (!read.ok) {
    say(`Refusing to write: ${read.reason} (${settingsFile()})`);
    flush(1);
  }
  const cur = describeCurrent(read.settings);
  if (cur.state === 'absent') {
    say('Already off — no statusLine is configured.');
    flush(0);
  }
  if (cur.state === 'foreign' && !force) {
    say(`The configured statusLine is not Argus: ${cur.cmd}`);
    say('Left untouched. Remove it anyway with: statusline off --force');
    flush(1);
  }
  const backupFile = backup(read.raw);
  const next = { ...read.settings };
  delete next.statusLine;
  writeSettings(next);
  say(`Status line OFF — removed from ${settingsFile()}`);
  if (backupFile) say(`backup: ${backupFile}`);
  say('Your decision records are untouched — this only removed the display.');
  flush(0);
}

// ── Entry ────────────────────────────────────────────────

const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);
const verb = argv.find((a) => !a.startsWith('-')) || (has('--on') ? 'on' : has('--off') ? 'off' : 'status');

try {
  if (verb === 'on') cmdOn(has('--replace'));
  else if (verb === 'off') cmdOff(has('--force'));
  else cmdStatus();
} catch (e) {
  say(`Unexpected failure: ${e && e.message ? e.message : e}`);
  say('Nothing was written unless a line above says otherwise.');
  flush(1);
}
