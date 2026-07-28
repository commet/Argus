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
 *   C2 policy auto-reject: bare decline, no outer request, one bounded tool call
 *   C3 a policy decline never disables a later interactive picker
 *
 * A host-name blacklist fails C1. Timing-based intent inference fails C2/C3.
 * Both are release blockers.
 */
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist', 'index.js');
const WIRE_PROBE = path.join(ROOT, 'evals', 'codex-elicit-wire-probe.mjs');
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
  '-c', `mcp_servers.elicit_wire_probe.command=${JSON.stringify(process.execPath)}`,
  '-c', `mcp_servers.elicit_wire_probe.args=${JSON.stringify([WIRE_PROBE])}`,
  '-c', 'mcp_servers.elicit_wire_probe.startup_timeout_sec=30',
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
    send({
      id: message.id,
      result: { action: 'accept', content: {}, _meta: null },
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
    const wire = inventory?.data?.find((server) => server.name === 'elicit_wire_probe');
    if (argus?.tools?.argus_predict && wire?.tools?.probe_elicitation) break;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  const argus = inventory?.data?.find((server) => server.name === 'argus_probe');
  const wireProbe = inventory?.data?.find((server) => server.name === 'elicit_wire_probe');
  ok('C0 checkout MCP loaded inside Codex', Boolean(argus?.tools?.argus_predict), JSON.stringify(inventory).slice(0, 200));
  ok('C0 wire probe MCP loaded inside Codex',
    Boolean(wireProbe?.tools?.probe_elicitation),
    JSON.stringify(inventory).slice(0, 200));

  const callForThread = (targetThreadId, tool, args) => request('mcpServer/tool/call', {
    threadId: targetThreadId,
    server: 'argus_probe',
    tool,
    arguments: { argus_dir: argusDir, ...args },
  });
  const call = (tool, args) => callForThread(threadId, tool, args);

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

  const policyThread = await request('thread/start', {
    cwd: ROOT,
    ephemeral: true,
    approvalPolicy: {
      granular: {
        sandbox_approval: true,
        rules: true,
        skill_approval: true,
        request_permissions: true,
        mcp_elicitations: false,
      },
    },
    sandbox: 'read-only',
  });
  const policyThreadId = policyThread?.thread?.id;
  ok('C2 Codex created a policy-auto-reject thread',
    typeof policyThreadId === 'string',
    JSON.stringify(policyThread));
  const asksBeforePolicyReject = elicitationRequests.length;
  const rawPolicyResult = await request('mcpServer/tool/call', {
    threadId: policyThreadId,
    server: 'elicit_wire_probe',
    tool: 'probe_elicitation',
    arguments: {},
  });
  ok('C2 raw policy result is a bare decline',
    rawPolicyResult?.structuredContent?.action === 'decline'
      && rawPolicyResult?.structuredContent?._meta === undefined,
    JSON.stringify(rawPolicyResult?.structuredContent));
  ok('C2 raw policy decline never reached the outer form client',
    elicitationRequests.length === asksBeforePolicyReject,
    `before=${asksBeforePolicyReject} after=${elicitationRequests.length}`);
  const rejected = await callForThread(policyThreadId, 'argus_predict', {
    id: 'codex-auto-reject',
    predicate: 'the Codex outer policy will auto-reject this form',
    check_by: '2099-12-31',
    predicate_owner: 'ai_surfaced',
    confirm_draft: true,
  });
  ok('C2 Argus preserves the only protocol fact it received',
    rejected?.structuredContent?.data?.choice === 'declined'
      && rejected?.structuredContent?.data?.sealed === false,
    JSON.stringify(rejected?.structuredContent));
  ok('C2 policy auto-reject never reached the outer form client',
    elicitationRequests.length === asksBeforePolicyReject,
    `before=${asksBeforePolicyReject} after=${elicitationRequests.length}`);

  const asksBeforeSecondPolicyCall = elicitationRequests.length;
  const secondPolicyCall = await callForThread(policyThreadId, 'argus_predict', {
    id: 'codex-policy-bounded',
    predicate: 'a policy rejection ends this tool call without an internal loop',
    check_by: '2099-12-31',
    predicate_owner: 'ai_surfaced',
    confirm_draft: true,
  });
  ok('C2 each policy-blocked tool call terminates with one decline',
    secondPolicyCall?.structuredContent?.data?.choice === 'declined',
    JSON.stringify(secondPolicyCall?.structuredContent?.data));
  ok('C2 no policy-blocked call leaks an outer request',
    elicitationRequests.length === asksBeforeSecondPolicyCall,
    `before=${asksBeforeSecondPolicyCall} after=${elicitationRequests.length}`);

  const asksBeforeRecovery = elicitationRequests.length;
  const recovered = await call('argus_predict', {
    id: 'codex-after-policy',
    predicate: 'a later interactive Codex form still reaches the user',
    check_by: '2099-12-31',
    predicate_owner: 'ai_surfaced',
    confirm_draft: true,
  });
  ok('C3 a policy decline does not poison later picker surfaces',
    elicitationRequests.length === asksBeforeRecovery + 1,
    `before=${asksBeforeRecovery} after=${elicitationRequests.length}`);
  ok('C3 the later interactive Accept still records user ownership',
    recovered?.structuredContent?.data?.predicate_owner === 'user'
      && recovered?.structuredContent?.data?.status === 'sealed',
    JSON.stringify(recovered?.structuredContent?.data));
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
console.log(`✅ ${label} — protocol facts preserved; policy decline stays bounded.`);
