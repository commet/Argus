/**
 * ONE way to find and launch the installed Codex. Imported by every gate that
 * needs a real host.
 *
 * WHY THIS FILE EXISTS (2026-07-29). Two gates each carried their own copy of
 * `resolveCodex()`. The copies were identical except for the last line: one fell
 * back to the `codex.cmd` shim, the other returned null. On an ordinary npm
 * install — which puts only `codex` and `codex.cmd` on PATH — that one-line
 * difference meant the app-server gate ran against a real Codex while the
 * decline-latency gate SKIPPED and reported success. It had measured nothing,
 * and the only reason anyone noticed is that its own self-test refused to go red
 * when a regression was planted under it.
 *
 * Both copies also missed the real binary. npm nests it one level deeper than
 * either walk looked:
 *
 *     %APPDATA%\npm\node_modules\@openai\codex
 *         \node_modules\@openai\codex-win32-x64\vendor\<triple>\bin\codex.exe
 *
 * so `@openai/<pkg>/vendor` never matched and the shim fallback was carrying the
 * entire gate. The walk below checks both depths.
 *
 * ABSENT IS NOT THE SAME AS UNRESOLVABLE. A machine with no Codex may honestly
 * skip a host gate. A machine where `codex` IS on PATH but no runnable entry
 * point could be derived is a BROKEN HARNESS, and skipping there is the silent
 * green this file was written to end — so the two cases are reported separately
 * and callers must fail loudly on the second.
 */
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

/** Every `@openai/*` vendor dir under `dir`, at both nesting depths npm uses. */
function vendoredExe(dir) {
  const scopes = [path.join(dir, 'node_modules', '@openai')];
  for (const scope of scopes) {
    if (!fs.existsSync(scope)) continue;
    for (const pkg of fs.readdirSync(scope)) {
      const pkgDir = path.join(scope, pkg);
      // Depth 2: the package nests its own platform package (the npm layout).
      const nested = path.join(pkgDir, 'node_modules', '@openai');
      if (fs.existsSync(nested)) scopes.push(path.join(pkgDir, 'node_modules', '@openai'));
      const vendor = path.join(pkgDir, 'vendor');
      if (!fs.existsSync(vendor)) continue;
      for (const triple of fs.readdirSync(vendor)) {
        const exe = path.join(vendor, triple, 'bin', process.platform === 'win32' ? 'codex.exe' : 'codex');
        if (fs.existsSync(exe)) return exe;
      }
    }
  }
  return null;
}

/**
 * @returns {{bin: string|null, kind: string, onPath: boolean}}
 *   `bin`     — a path spawnCodex() can launch, or null.
 *   `onPath`  — a `codex` entry was visible on PATH. With `bin === null` this
 *               means the harness failed to resolve an installed Codex, which is
 *               a failure, NOT a skip.
 */
/** Every `codex` entry visible on PATH, most-preferred first. */
function onPathEntries() {
  const win = process.platform === 'win32';
  // `which -a` is not universal. Falling back matters more than tidiness here:
  // an empty listing reads as "codex is not installed", which downgrades a
  // broken lookup into an honest-looking skip — the exact failure this file
  // exists to end.
  const probes = win ? [['where.exe', ['codex']]] : [['which', ['-a', 'codex']], ['which', ['codex']]];
  for (const [cmd, args] of probes) {
    const hits = String(spawnSync(cmd, args, { encoding: 'utf8' }).stdout ?? '')
      .split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
      .filter((l) => fs.existsSync(l));
    if (hits.length) return hits;
  }
  return [];
}

/** The first PATH entry that can actually be launched, or null. */
function firstRunnable(lines) {
  if (process.platform !== 'win32') {
    const hit = lines[0];
    return hit ? { path: hit, kind: 'posix' } : null;
  }
  const direct = lines.find((l) => /\.exe$/i.test(l));
  if (direct) return { path: direct, kind: 'exe' };
  // Prefer the real executable the shim would launch — spawning it directly
  // avoids an extra cmd.exe in the process tree and its stdio buffering.
  for (const shim of lines) {
    const exe = vendoredExe(path.dirname(shim));
    if (exe) return { path: exe, kind: 'vendored' };
  }
  const shim = lines.find((l) => /\.(cmd|bat)$/i.test(l));
  return shim ? { path: shim, kind: 'shim' } : null;
}

export function resolveCodex() {
  const configured = process.env.CODEX_CLI_PATH;
  if (configured && fs.existsSync(configured)) return { bin: configured, kind: 'configured', onPath: true };

  // Listing and selection are separate, and BOTH PLATFORMS PASS THROUGH THESE
  // TWO LINES. That is deliberate: self-test 29 plants its regression on the
  // selection step, and the first draft of this file put the Windows logic in an
  // early-return branch that Linux never reached — so the plant was inert on CI
  // and the self-test reported "planted but still green" (2026-07-29). A gate's
  // mutation seam has to be reachable everywhere the gate runs.
  const lines = onPathEntries();
  const onPath = lines.length > 0;
  const hit = firstRunnable(lines);
  if (hit) return { bin: hit.path, kind: hit.kind, onPath };
  return { bin: null, kind: onPath ? 'unresolvable' : 'absent', onPath };
}

/**
 * Resolve, or end the process with the right verdict for the reason.
 *
 * @param {string} gateName shown in both messages
 * @returns {string} a launchable path
 */
export function requireCodexOrExit(gateName) {
  const r = resolveCodex();
  if (r.bin) return r.bin;
  if (r.onPath) {
    // Installed, but this harness could not derive a runnable entry point. That
    // is this file's bug, and it must not be spelled "skipped".
    console.error(`\n❌ ${gateName}: codex is on PATH but no runnable entry point resolved.`);
    console.error('   이 게이트는 아무것도 재지 못했습니다. 건너뛰기가 아니라 하네스 결함입니다.');
    console.error('   evals/_codex-bin.mjs의 resolveCodex()를 고치거나 CODEX_CLI_PATH를 지정하세요.');
    process.exit(1);
  }
  console.log(`⏭  ${gateName} SKIPPED — codex not installed (set CODEX_CLI_PATH to run it)`);
  process.exit(0);
}

/** Launch Codex. Node cannot exec a Windows .cmd/.bat without cmd.exe. */
export function spawnCodex(bin, args, opts) {
  const isWindowsShim = process.platform === 'win32' && /\.(cmd|bat)$/i.test(bin);
  return spawn(
    isWindowsShim ? process.env.ComSpec ?? 'cmd.exe' : bin,
    isWindowsShim ? ['/d', '/s', '/c', bin, ...args] : args,
    opts,
  );
}
