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
export function resolveCodex() {
  const configured = process.env.CODEX_CLI_PATH;
  if (configured && fs.existsSync(configured)) return { bin: configured, kind: 'configured', onPath: true };

  if (process.platform !== 'win32') {
    const found = spawnSync('which', ['codex'], { encoding: 'utf8' });
    const hit = String(found.stdout ?? '').trim().split(/\r?\n/)[0];
    if (hit && fs.existsSync(hit)) return { bin: hit, kind: 'posix', onPath: true };
    return { bin: null, kind: 'absent', onPath: false };
  }

  const found = spawnSync('where.exe', ['codex'], { encoding: 'utf8' });
  const lines = String(found.stdout ?? '').split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const onPath = lines.length > 0;

  const direct = lines.find((l) => /\.exe$/i.test(l) && fs.existsSync(l));
  if (direct) return { bin: direct, kind: 'exe', onPath };

  // Prefer the real executable the shim would launch — spawning it directly
  // avoids an extra cmd.exe in the process tree and its stdio buffering.
  for (const shim of lines) {
    const exe = vendoredExe(path.dirname(shim));
    if (exe) return { bin: exe, kind: 'vendored', onPath };
  }

  const shim = lines.find((l) => /\.(cmd|bat)$/i.test(l) && fs.existsSync(l));
  if (shim) return { bin: shim, kind: 'shim', onPath };

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
