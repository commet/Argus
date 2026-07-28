/**
 * REAL CODEX APP-SERVER BRIDGE.
 *
 * This is not a Codex-shaped MCP client. It starts the installed Codex
 * app-server, loads this checkout as a real stdio MCP server, calls Argus
 * through `mcpServer/tool/call`, and answers the server-initiated
 * `mcpServer/elicitation/request` on the wire.
 *
 * It proves two opposite realities with the same Codex identity:
 *   C1 forms allowed: request -> Accept -> user-owned seal
 *   C2 policy auto-reject: immediate decline -> no_answer -> session fallback
 *
 * A host-name blacklist fails C1. Blindly trusting capability-only decline
 * fails C2. Both are release blockers.
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
  const build = spawnSync('npm', ['run', 'build'], {
    cwd: ROOT,
    shell: process.platform === 'win32',
    stdio: 'inherit',
  });
  if (build.status !== 0) process.exit(build.status ?? 1);
}

const violations = [];
let checks = 0;
const ok = (label, condition, detail = '') => {
  checks++;
  if (!condition) violations.push(`${label}: ${String(detail).slice(0, 240)}`);
};

function resolveCodexCommand() {
  const configured = process.env.CODEX_CLI_PATH;
  if (configured && fs.existsSync(configured)) return configured;
  if (process.platform !== 'win32') return 'codex';

  const found = spawnSync('where.exe', ['codex'], { encoding: 'utf8' });
  const executable = String(found.stdout ?? '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => /\.exe$/i.test(line) && fs.existsSync(line));
  if (!executable) throw new Error('codex.exe not found on PATH');
  return executable;
}

const codexHome = fs.mkdtempSync(path.join(ROOT, '.codex-app-eval-'));
const argusDir = fs.mkdtempSync(path.join(os.tmpdir(), 'argus-codex-appserver-'));
const codex = resolveCodexCommand();
const codexArgs = [
  'app-server',
  '--listen', 'stdio://',
  '-c', 'features.plugins=false',
  '-c', `mcp_servers.argus_probe.command=${JSON.stringify(process.execPath)}`,
  '-c', `mcp_servers.argus_probe.args=${JSON.stringify([DIST])}`,
  '-c', `mcp_servers.argus_probe.env={ARGUS_DIR=${JSON.stringify(argusDir)}}`,
  '-c', 'mcp_servers.argus_probe.startup_timeout_sec=30',
];

const child = spawn(codex, codexArgs, {
  cwd: ROOT,
  env: { ...process.env, CODEX_HOME: codexHome },
  stdio: ['pipe', 'pipe', 'pipe'],
  windowsHide: true,
});
const lines = readline.createInterface({ input: child.stdout });
const pending = new Map();
const elicitationRequests = [];
let nextId = 1;
let stderr = '';
child.stderr.on('data', (chunk) => { stderr += String(chunk); });

function send(message) {
  child.stdin.write(`${JSON.stringify(message)}\n`);
}

function request(method, params, timeoutMs = 60_000) {
  const id = nextId++;
  send({ id, method, params });
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error(`Codex app-server timed out: ${method}`));
    }, timeoutMs);
    pending.set(id, {
      resolve(value) {
        clearTimeout(timer);
        resolve(value);
      },
      reject(error) {
        clearTimeout(timer);
        reject(error);
      },
    });
  });
}

lines.on('line', (line) => {
  let message;
  try {
    message = JSON.parse(line);
  } catch {
    return;
  }

  if (message.method === 'mcpServer/elicitation/request' && message.id !== undefined) {
    elicitationRequests.push(message.params);
    const autoReject = String(message.params?.message ?? '').includes('auto-reject');
    send({
      id: message.id,
      result: autoReject
        ? { action: 'decline', content: null }
        : { action: 'accept', content: {} },
    });
    return;
  }

  if (message.id !== undefined && pending.has(message.id)) {
    const waiter = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) waiter.reject(new Error(JSON.stringify(message.error)));
    else waiter.resolve(message.result);
  }
});

async function stop() {
  if (child.exitCode === null) {
    // EOF lets app-server shut its stdio MCP children down before it exits.
    // Killing only the parent left dist/index.js locked on Windows, so the
    // verifier could not remove its isolated mutation copy.
    child.stdin.end();
    await Promise.race([
      new Promise((resolve) => child.once('exit', resolve)),
      new Promise((resolve) => setTimeout(resolve, 5_000)),
    ]);
    if (child.exitCode === null) {
      child.kill();
      await Promise.race([
        new Promise((resolve) => child.once('exit', resolve)),
        new Promise((resolve) => setTimeout(resolve, 3_000)),
      ]);
    }
  }
  lines.close();

  const removeWithRetry = async (target) => {
    for (let attempt = 0; attempt < 8; attempt++) {
      try {
        fs.rmSync(target, { recursive: true, force: true });
        return true;
      } catch {
        await new Promise((resolve) => setTimeout(resolve, 300));
      }
    }
    return !fs.existsSync(target);
  };
  if (!await removeWithRetry(codexHome)) {
    violations.push(`C0 cleanup: Codex home remained locked: ${codexHome}`);
  }
  if (!await removeWithRetry(argusDir)) {
    violations.push(`C0 cleanup: Argus fixture remained locked: ${argusDir}`);
  }
}

try {
  await request('initialize', {
    clientInfo: {
      name: 'argus-codex-app-server-eval',
      title: 'Argus Codex app-server eval',
      version: '1',
    },
    capabilities: { experimentalApi: true },
  });
  send({ method: 'initialized' });

  const started = await request('thread/start', {
    cwd: ROOT,
    ephemeral: true,
    approvalPolicy: 'on-request',
    sandbox: 'read-only',
  });
  const threadId = started?.thread?.id;
  ok('C0 Codex created an ephemeral thread', typeof threadId === 'string', JSON.stringify(started));

  let inventory = null;
  for (let attempt = 0; attempt < 20; attempt++) {
    inventory = await request('mcpServerStatus/list', {
      threadId,
      detail: 'toolsAndAuthOnly',
      limit: 100,
    });
    const argus = inventory?.data?.find((server) => server.name === 'argus_probe');
    if (argus?.tools?.argus_predict) break;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  const argus = inventory?.data?.find((server) => server.name === 'argus_probe');
  ok('C0 checkout MCP loaded inside Codex', Boolean(argus?.tools?.argus_predict), JSON.stringify(inventory).slice(0, 200));

  const call = (tool, args) => request('mcpServer/tool/call', {
    threadId,
    server: 'argus_probe',
    tool,
    arguments: { argus_dir: argusDir, ...args },
  });

  const accepted = await call('argus_predict', {
    id: 'codex-accept',
    predicate: 'the real Codex form bridge accepts this prediction',
    check_by: '2099-12-31',
    predicate_owner: 'ai_surfaced',
    confirm_draft: true,
  });
  const firstAsk = elicitationRequests[0];
  ok('C1 Codex emitted a standard form request', firstAsk?.mode === 'form', JSON.stringify(firstAsk));
  ok('C1 one-tap confirmation has no focus-trapping fields',
    Object.keys(firstAsk?.requestedSchema?.properties ?? {}).length === 0,
    JSON.stringify(firstAsk?.requestedSchema));
  ok('C1 Accept returned through Codex as user ownership',
    accepted?.structuredContent?.data?.predicate_owner === 'user'
      && accepted?.structuredContent?.data?.status === 'sealed',
    JSON.stringify(accepted?.structuredContent?.data));

  const rejected = await call('argus_predict', {
    id: 'codex-auto-reject',
    predicate: 'the Codex outer policy will auto-reject this form',
    check_by: '2099-12-31',
    predicate_owner: 'ai_surfaced',
    confirm_draft: true,
  });
  ok('C2 synthetic decline is a non-answer, never a human no',
    rejected?.structuredContent?.data?.choice === 'no_answer'
      && rejected?.structuredContent?.data?.sealed === false,
    JSON.stringify(rejected?.structuredContent));
  ok('C2 the unconfirmed predicate is handed back intact',
    rejected?.structuredContent?.data?.predicate
      === 'the Codex outer policy will auto-reject this form',
    JSON.stringify(rejected?.structuredContent?.data));

  const checkIn = await call('argus_check_in', {});
  ok('C2 the session reports text fallback after the invisible decline',
    checkIn?.structuredContent?.data?.picker === 'text_fallback',
    JSON.stringify(checkIn?.structuredContent?.data));

  const asksBeforeCircuit = elicitationRequests.length;
  const circuit = await call('argus_predict', {
    id: 'codex-circuit-open',
    predicate: 'the open circuit must not launch another invisible form',
    check_by: '2099-12-31',
    predicate_owner: 'ai_surfaced',
    confirm_draft: true,
  });
  ok('C2 no second invisible request is launched',
    elicitationRequests.length === asksBeforeCircuit,
    `before=${asksBeforeCircuit} after=${elicitationRequests.length}`);
  ok('C2 fallback record keeps honest AI provenance',
    circuit?.structuredContent?.data?.predicate_owner === 'ai_surfaced',
    JSON.stringify(circuit?.structuredContent?.data));
} catch (error) {
  violations.push(`C0 app-server harness: ${error?.message ?? error}; stderr=${stderr.slice(-700)}`);
} finally {
  await stop();
}

const label = `${checks} checks · ${violations.length} violations · real Codex app-server`;
if (violations.length) {
  console.error(`\n❌ ${label}\n`);
  for (const violation of violations) console.error(`  ${violation}`);
  process.exit(1);
}
console.log(`✅ ${label} — allowed forms work; invisible decline fails over once.`);
