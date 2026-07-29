/**
 * REAL CODEX APP-SERVER — AND A REAL POLICY, NOT A SIMULATED ONE.
 *
 * This starts the installed `codex app-server`, loads this checkout as a real
 * stdio MCP server, and calls Argus through `mcpServer/tool/call`, answering the
 * server-initiated `mcpServer/elicitation/request` on the wire.
 *
 * The thing it does differently from its first draft: the blocked reality is
 * created BY CODEX, from its own approval policy, instead of by this file
 * noticing a keyword in the message and declining on Codex's behalf. A harness
 * that manufactures the failure it then detects proves only the harness. What a
 * real restrictive Codex does was measured on 2026-07-29:
 *
 *   approval_policy default                 → request FORWARDED to the client
 *   approval_policy = "never"               → NEVER forwarded · answered in ~330ms
 *   granular.mcp_elicitations = false       → NEVER forwarded · answered in ~330ms
 *
 * In the last two, nothing is shown to anyone and Codex answers `decline` itself.
 * Argus used to relay that as `{ sealed: false, choice: "declined" }` — a
 * decision attributed to a person who was never asked, with no way forward. That
 * was the entire Codex experience under a restrictive policy.
 *
 * Two processes, two policies, one build:
 *   P · allowed  — the form reaches the client; Accept seals as the user's; a
 *                  human-speed Decline is respected AND the next picker STILL
 *                  APPEARS (the guard against the session-wide breaker)
 *   B · blocked  — Codex answers for the user; Argus must not claim they
 *                  declined, must hand their material back, must leave the
 *                  ledger untouched, and must report the surface as text
 */
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist', 'index.js');
if (process.env.CODEX_APP_SERVER_SKIP_BUILD !== '1') {
  const build = spawnSync('npm', ['run', 'build'], { cwd: ROOT, shell: process.platform === 'win32', stdio: 'inherit' });
  if (build.status !== 0) process.exit(build.status ?? 1);
}

const violations = [];
let checks = 0;
const ok = (label, condition, detail = '') => {
  checks += 1;
  if (!condition) violations.push(`${label}: ${String(detail).slice(0, 300)}`);
};

/**
 * Find the Codex binary. The first draft ran `where.exe codex` and accepted only
 * a `.exe`, which finds nothing on a machine that installed Codex the normal way
 * — npm puts `codex.cmd` / `codex.ps1` on PATH and the real binary down inside
 * `@openai/codex-<platform>/vendor/`. That gate therefore threw "codex.exe not
 * found" on an ordinary install and never ran at all.
 */
function resolveCodex() {
  const configured = process.env.CODEX_CLI_PATH;
  if (configured && fs.existsSync(configured)) return configured;
  if (process.platform !== 'win32') return 'codex';

  const found = spawnSync('where.exe', ['codex'], { encoding: 'utf8' });
  const lines = String(found.stdout ?? '').split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const direct = lines.find((l) => /\.exe$/i.test(l) && fs.existsSync(l));
  if (direct) return direct;

  // npm shim on PATH → walk to the vendored binary it launches.
  for (const shim of lines) {
    const dir = path.dirname(shim);
    const vendor = path.join(dir, 'node_modules', '@openai');
    if (!fs.existsSync(vendor)) continue;
    for (const pkg of fs.readdirSync(vendor)) {
      const hit = path.join(vendor, pkg, 'vendor');
      if (!fs.existsSync(hit)) continue;
      for (const triple of fs.readdirSync(hit)) {
        const exe = path.join(hit, triple, 'bin', 'codex.exe');
        if (fs.existsSync(exe)) return exe;
      }
    }
  }
  // Some npm installations do not contain a platform-vendored executable.
  // The command shim is still a usable Codex entry point (handled at spawn).
  return lines.find((l) => /\.(cmd|bat)$/i.test(l) && fs.existsSync(l)) ?? null;
}

const CODEX = resolveCodex();
if (!CODEX) {
  // Skipping loudly beats a silent green: this gate's whole value is that it
  // touched a real host.
  console.log('⏭  real Codex app-server gate SKIPPED — codex not installed (set CODEX_CLI_PATH to run it)');
  process.exit(0);
}

const ALLOWED = null; // Codex's own default forwards the request (measured)
const BLOCKED = '{granular={mcp_elicitations=false,rules=true,sandbox_approval=true}}';

async function session(policy, answer) {
  const codexHome = fs.mkdtempSync(path.join(ROOT, '.codex-app-eval-'));
  const argusDir = fs.mkdtempSync(path.join(os.tmpdir(), 'argus-codex-appserver-'));
  const args = [
    'app-server', '--listen', 'stdio://',
    '-c', 'features.plugins=false',
    '-c', `mcp_servers.argus_probe.command=${JSON.stringify(process.execPath)}`,
    '-c', `mcp_servers.argus_probe.args=${JSON.stringify([DIST])}`,
    '-c', `mcp_servers.argus_probe.env={ARGUS_DIR=${JSON.stringify(argusDir)}}`,
    '-c', 'mcp_servers.argus_probe.startup_timeout_sec=30',
  ];
  if (policy) args.push('-c', `approval_policy=${policy}`);

  // Node cannot execute a Windows .cmd/.bat shim without cmd.exe. npm installs
  // Codex that way, so support an explicit CODEX_CLI_PATH to the normal shim
  // as well as the vendored .exe discovered above.
  const isWindowsShim = process.platform === 'win32' && /\.(cmd|bat)$/i.test(CODEX);
  const child = spawn(isWindowsShim ? process.env.ComSpec ?? 'cmd.exe' : CODEX,
    isWindowsShim ? ['/d', '/s', '/c', CODEX, ...args] : args, {
    cwd: ROOT, env: { ...process.env, CODEX_HOME: codexHome },
    stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true,
  });
  let stderr = '';
  child.stderr.on('data', (c) => { stderr += String(c); });
  const pending = new Map();
  const asks = [];
  let nextId = 1;
  const lines = readline.createInterface({ input: child.stdout });
  lines.on('line', (line) => {
    let m; try { m = JSON.parse(line); } catch { return; }
    if (m.method === 'mcpServer/elicitation/request' && m.id !== undefined) {
      asks.push(m.params);
      Promise.resolve(answer(m.params, asks.length)).then((reply) => {
        if (reply) child.stdin.write(JSON.stringify({ id: m.id, result: reply }) + '\n');
      });
      return;
    }
    if (m.id !== undefined && pending.has(m.id)) {
      const p = pending.get(m.id); pending.delete(m.id);
      m.error ? p.reject(new Error(JSON.stringify(m.error))) : p.resolve(m.result);
    }
  });
  const req = (method, params, ms = 60_000) => {
    const id = nextId++;
    child.stdin.write(JSON.stringify({ id, method, params }) + '\n');
    return new Promise((res, rej) => {
      const t = setTimeout(() => { pending.delete(id); rej(new Error(`Codex app-server timed out: ${method}`)); }, ms);
      pending.set(id, { resolve: (v) => { clearTimeout(t); res(v); }, reject: (e) => { clearTimeout(t); rej(e); } });
    });
  };

  async function stop() {
    if (child.exitCode === null) {
      // EOF, not kill: app-server shuts its stdio MCP children down on stdin
      // close. Killing only the parent leaves dist/index.js locked on Windows,
      // and the verifier then cannot delete its isolated mutation copy.
      child.stdin.end();
      await Promise.race([
        new Promise((r) => child.once('exit', r)),
        new Promise((r) => setTimeout(r, 5_000)),
      ]);
      if (child.exitCode === null) {
        child.kill();
        await Promise.race([
          new Promise((r) => child.once('exit', r)),
          new Promise((r) => setTimeout(r, 3_000)),
        ]);
      }
    }
    lines.close();
    const rm = async (target) => {
      for (let a = 0; a < 8; a += 1) {
        try { fs.rmSync(target, { recursive: true, force: true }); return true; }
        catch { await new Promise((r) => setTimeout(r, 300)); }
      }
      return !fs.existsSync(target);
    };
    if (!await rm(codexHome)) violations.push(`cleanup: Codex home stayed locked: ${codexHome}`);
    if (!await rm(argusDir)) violations.push(`cleanup: Argus fixture stayed locked: ${argusDir}`);
  }

  await req('initialize', {
    clientInfo: { name: 'argus-codex-app-server-eval', title: 'Argus Codex app-server eval', version: '1' },
    capabilities: { experimentalApi: true },
  });
  child.stdin.write(JSON.stringify({ method: 'initialized', params: {} }) + '\n');
  const started = await req('thread/start', { cwd: ROOT, ephemeral: true, sandbox: 'read-only' });
  const threadId = started?.threadId ?? started?.thread?.id ?? started?.id;

  const call = (tool, args2) => req('mcpServer/tool/call', {
    threadId, server: 'argus_probe', tool, arguments: { argus_dir: argusDir, ...args2 },
  });
  return { threadId, started, call, asks, stop, stderr: () => stderr, argusDir, req };
}

const HUMAN_PAUSE_MS = 900;

try {
  // ───────── P · a Codex that shows the form ─────────
  const p = await session(ALLOWED, async (_params, n) => {
    if (n === 1) return { action: 'accept', content: {} };                    // seal, kept
    if (n === 2) { await new Promise((r) => setTimeout(r, HUMAN_PAUSE_MS)); return { action: 'decline' }; }
    // 접근성 자동화·키보드 사용자의 "아주 빠른" 거절. 사람이라도 화면이 그려지고
    // 읽고 눌러야 하므로 0ms일 수 없다 — 0ms로 답하는 하네스는 빠른 사용자가
    // 아니라 기계다. 문턱(5ms)의 수십 배지만 사람으로선 극단적으로 빠른 값.
    if (n === 3) { await new Promise((r) => setTimeout(r, 150)); return { action: 'decline' }; }
    return { action: 'accept', content: { outcome: 'held', what_happened: 'shipped on the 3rd' } };
  });
  try {
    ok('P0 Codex started an ephemeral thread', typeof p.threadId === 'string', JSON.stringify(p.started).slice(0, 200));

    let inv = null;
    for (let a = 0; a < 20; a += 1) {
      inv = await p.req('mcpServerStatus/list', { threadId: p.threadId, detail: 'toolsAndAuthOnly', limit: 100 });
      if (inv?.data?.find((s) => s.name === 'argus_probe')?.tools?.argus_predict) break;
      await new Promise((r) => setTimeout(r, 250));
    }
    ok('P0 this checkout loaded as a real MCP server inside Codex',
      Boolean(inv?.data?.find((s) => s.name === 'argus_probe')?.tools?.argus_predict),
      JSON.stringify(inv).slice(0, 200));

    const sealed = await p.call('argus_predict', {
      id: 'codex-accept', predicate: 'the real Codex form bridge accepts this prediction',
      check_by: '2099-12-31', predicate_owner: 'ai_surfaced', confirm_draft: true,
    });
    ok('P1 Codex emitted a standard form request', p.asks[0]?.mode === 'form', JSON.stringify(p.asks[0]).slice(0, 200));
    ok('P1 the one-tap confirmation declares no fields to trap focus in',
      Object.keys(p.asks[0]?.requestedSchema?.properties ?? {}).length === 0,
      JSON.stringify(p.asks[0]?.requestedSchema));
    ok('P1 Accept came back through Codex as the user\'s own words',
      sealed?.structuredContent?.data?.predicate_owner === 'user'
        && sealed?.structuredContent?.data?.status === 'sealed',
      JSON.stringify(sealed?.structuredContent?.data).slice(0, 300));

    // A person reads the second form and says no. It is their answer: respect it.
    const declined = await p.call('argus_predict', {
      id: 'codex-human-no', predicate: 'a person reads this one and says no',
      check_by: '2099-12-31', predicate_owner: 'ai_surfaced', confirm_draft: true,
    });
    ok('P2 a decline someone took time over is honoured as a decline',
      declined?.structuredContent?.data?.choice === 'declined'
        && declined?.structuredContent?.data?.sealed === false,
      JSON.stringify(declined?.structuredContent?.data).slice(0, 300));

    // The case the threshold must NOT swallow: a keyboard user or accessibility
    // automation declining very fast. They are still ~30x above the measured
    // policy ceiling (0.3-1.1ms), because a form has to be drawn before anyone —
    // or any assistive tool reading it — can act on it. Their "no" stays theirs.
    const hammered = await p.call('argus_predict', {
      id: 'codex-escape', predicate: 'this one gets escaped before it is read',
      check_by: '2099-12-31', predicate_owner: 'ai_surfaced', confirm_draft: true,
    });
    ok('P3 a very fast HUMAN decline is still honoured as a decline',
      hammered?.structuredContent?.data?.choice === 'declined',
      JSON.stringify(hammered?.structuredContent?.data).slice(0, 300));

    // THE REGRESSION GUARD, and it must run RIGHT AFTER the instant decline
    // above — that is the only sequence that reproduces it. An earlier design
    // opened a SESSION-WIDE breaker the moment one decline came back fast, so a
    // single hurried "no" deleted the settle picker, the defer picker and every
    // later screen for the rest of the session. The user's next question then
    // silently degraded to text on a host that renders forms perfectly well.
    const asksBefore = p.asks.length;
    const settled = await p.call('argus_resolve', {
      id: 'codex-accept', outcome_source: 'user_stated',
    });
    ok('P4 the NEXT picker still reaches the user after a hurried decline',
      p.asks.length > asksBefore, `asks before=${asksBefore} after=${p.asks.length}`);
    ok('P4 and that picker\'s answer is recorded',
      settled?.structuredContent?.data?.outcome === 'held',
      JSON.stringify(settled?.structuredContent?.data).slice(0, 300));
  } finally { await p.stop(); }

  // ───────── B · a Codex whose policy answers for the user ─────────
  const b = await session(BLOCKED, () => ({ action: 'accept', content: {} }));
  try {
    const blocked = await b.call('argus_predict', {
      id: 'codex-policy', predicate: 'the Codex policy answers this one without showing it',
      check_by: '2099-12-31', predicate_owner: 'ai_surfaced', confirm_draft: true,
    });
    ok('B0 Codex really did intercept it — nothing reached the client',
      b.asks.length === 0, `client saw ${b.asks.length} request(s)`);
    // Measured, not argued: this policy answers in 0.3-1.1ms (evals/
    // decline-latency.mjs re-measures it here on every verify), and a human
    // decline needs a render, a read and a keypress. Reporting this as the
    // user's own decline tells them they refused a dialog Codex never drew —
    // B0 above proves nothing reached a client.
    ok('B1 a decline no form could have preceded is not attributed to the user',
      blocked?.structuredContent?.data?.choice === 'no_answer'
        && blocked?.structuredContent?.data?.sealed === false,
      JSON.stringify(blocked?.structuredContent?.data).slice(0, 300));

    // Nothing may have been written.
    const ledger = await b.call('argus_patterns', { view: 'all' });
    ok('B2 the ledger is untouched by an invisible decline',
      ((ledger?.structuredContent?.data?.contracts ?? []).length === 0),
      JSON.stringify(ledger?.structuredContent?.data?.contracts ?? []).slice(0, 200));

    // A second identical action still supplies no rendering receipt. Do not
    // infer a different capability from timing or repetition.
    await b.call('argus_predict', {
      id: 'codex-policy-2', predicate: 'and this one too',
      check_by: '2099-12-31', predicate_owner: 'ai_surfaced', confirm_draft: true,
    });
    const checkIn = await b.call('argus_check_in', {});
    ok('B3 negotiated elicitation remains reported without timing inference',
      checkIn?.structuredContent?.data?.picker === 'one_tap',
      JSON.stringify(checkIn?.structuredContent?.data).slice(0, 300));
  } finally { await b.stop(); }
} catch (error) {
  violations.push(`harness: ${error?.message ?? error}`);
}

const label = `${checks} checks · ${violations.length} violation(s) · real Codex app-server, real policy`;
if (violations.length) {
  console.error(`\n❌ ${label}\n`);
  for (const v of violations) console.error(`  ${v}`);
  process.exit(1);
}
console.log(`✅ ${label} — allowed forms work; wire actions are preserved without timing inference.`);
