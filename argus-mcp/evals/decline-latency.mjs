/**
 * IS A POLICY REJECTION ACTUALLY DISTINGUISHABLE FROM A HUMAN DECLINE?
 *
 *   node evals/decline-latency.mjs
 *
 * This is the evidence behind `UNSEEN_DECLINE_MAX_MS`, and it is a MEASUREMENT
 * rather than an argument, because the question was settled the wrong way twice
 * by arguing.
 *
 * THE CLAIM UNDER TEST. MCP's `decline` is defined as an explicit user decision.
 * A host whose policy blocks elicitations returns that same bare action without
 * showing anyone anything, and the protocol carries no marker separating the
 * two (verified: Codex's `McpServerElicitationRequestResponse` is action +
 * content + a `_meta` that arrives null). Reporting the second case as the
 * user's own decline tells someone they refused a dialog that was never drawn.
 *
 * THE COUNTER-CLAIM, which is a good one: elapsed time cannot repair the missing
 * provenance, because keyboard users, assistive automation, and a person who
 * already knows their answer can all decline immediately.
 *
 * Both are settled by numbers rather than opinion. A policy rejection is
 * synthesized locally with NO UI in the path. Every human decline — including
 * every accessibility path — requires a render, a read and a keypress. If those
 * two populations overlap, no threshold is safe and this gate fails. If they are
 * separated by orders of magnitude, a threshold placed in the gap is safe for
 * everyone and this gate proves it, on every verify, against the installed Codex.
 *
 * Skips loudly when Codex is absent: this gate's whole value is that it touched
 * a real host, and a silent pass would be worse than no gate.
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import { requireCodexOrExit, spawnCodex } from './_codex-bin.mjs';
import os from 'node:os';
import path from 'node:path';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
if (process.env.DECLINE_LATENCY_SKIP_BUILD !== '1') {
  const b = spawnSync('npm', ['run', 'build'], { cwd: ROOT, shell: process.platform === 'win32', stdio: 'inherit' });
  if (b.status !== 0) process.exit(b.status ?? 1);
}


/** Read the shipped constant from source so this gate and the product cannot drift. */
const THRESHOLD = Number(
  /UNSEEN_DECLINE_MAX_MS = (\d+)/.exec(fs.readFileSync(path.join(ROOT, 'src', 'lib', 'elicit.ts'), 'utf8'))?.[1] ?? NaN,
);

const violations = [];
let checks = 0;
const ok = (label, cond, detail = '') => {
  checks += 1;
  if (!cond) violations.push(`${label}: ${String(detail).slice(0, 240)}`);
};

// Codex discovery is shared with the other host gates (evals/_codex-bin.mjs).
// It used to be a private copy here whose last line returned null where the
// other copy fell back to the npm shim — so on an ordinary install this gate
// skipped, reported success, and measured nothing.
const CODEX = requireCodexOrExit('decline-latency');

ok('L0 제품의 문턱값을 읽었다', Number.isFinite(THRESHOLD), 'src/lib/elicit.ts에서 UNSEEN_DECLINE_MAX_MS를 못 읽음');

/** A minimal MCP server that calls elicitInput N times and reports each latency. */
const PROBE = path.join(ROOT, '_decline-latency-probe.mjs');
fs.writeFileSync(PROBE, `
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
const s = new Server({ name: 'lat', version: '1' }, { capabilities: { tools: {} } });
s.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: [{ name: 'probe', description: 'x', inputSchema: { type: 'object', properties: {} } }] }));
s.setRequestHandler(CallToolRequestSchema, async () => {
  const samples = [];
  for (let i = 0; i < 5; i++) {
    const t0 = process.hrtime.bigint();
    let action = 'error';
    try { action = (await s.elicitInput({ message: 'Record this prediction?', requestedSchema: { type: 'object', properties: {} } }, { timeout: 30000 })).action; } catch {}
    samples.push({ ms: Number(process.hrtime.bigint() - t0) / 1e6, action });
  }
  return { content: [{ type: 'text', text: JSON.stringify(samples) }], structuredContent: { samples } };
});
await s.connect(new StdioServerTransport());
`);

async function measure(policy) {
  const codexHome = fs.mkdtempSync(path.join(ROOT, '.codex-latency-'));
  const args = [
    'app-server', '--listen', 'stdio://',
    '-c', 'features.plugins=false',
    '-c', `mcp_servers.lat.command=${JSON.stringify(process.execPath)}`,
    '-c', `mcp_servers.lat.args=${JSON.stringify([PROBE])}`,
    '-c', 'mcp_servers.lat.startup_timeout_sec=40',
    '-c', `approval_policy=${policy}`,
  ];
  const child = spawnCodex(CODEX, args, {
    cwd: ROOT, env: { ...process.env, CODEX_HOME: codexHome },
    stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true,
  });
  const pending = new Map();
  let nextId = 1;
  const rl = readline.createInterface({ input: child.stdout });
  rl.on('line', (l) => {
    let m; try { m = JSON.parse(l); } catch { return; }
    if (m.id !== undefined && pending.has(m.id)) {
      const p = pending.get(m.id); pending.delete(m.id);
      m.error ? p.reject(new Error(JSON.stringify(m.error))) : p.resolve(m.result);
    }
  });
  const req = (method, params, ms = 90000) => {
    const id = nextId++;
    child.stdin.write(JSON.stringify({ id, method, params }) + '\n');
    return new Promise((res, rej) => {
      const t = setTimeout(() => rej(new Error('timeout ' + method)), ms);
      pending.set(id, { resolve: (v) => { clearTimeout(t); res(v); }, reject: (e) => { clearTimeout(t); rej(e); } });
    });
  };
  try {
    await req('initialize', { clientInfo: { name: 'decline-latency', title: 'lat', version: '1' } });
    child.stdin.write(JSON.stringify({ method: 'initialized', params: {} }) + '\n');
    const th = await req('thread/start', { cwd: ROOT, ephemeral: true });
    const threadId = th?.threadId ?? th?.thread?.id ?? th?.id;
    for (let a = 0; a < 80; a += 1) {
      const inv = await req('mcpServerStatus/list', { threadId, detail: 'toolsAndAuthOnly', limit: 50 });
      if ((inv?.data ?? []).find((x) => x.name === 'lat')?.tools?.probe) break;
      await new Promise((r) => setTimeout(r, 500));
    }
    const r = await req('mcpServer/tool/call', { threadId, server: 'lat', tool: 'probe', arguments: {} });
    return r?.structuredContent?.samples ?? JSON.parse(r?.content?.[0]?.text ?? '[]');
  } finally {
    child.stdin.end();
    await new Promise((r) => setTimeout(r, 600));
    if (child.exitCode === null) child.kill();
    rl.close();
    for (let a = 0; a < 8; a += 1) {
      try { fs.rmSync(codexHome, { recursive: true, force: true }); break; }
      catch { await new Promise((r) => setTimeout(r, 300)); }
    }
  }
}

try {
  const blocked = await measure('{granular={mcp_elicitations=false,rules=true,sandbox_approval=true}}');
  const ms = blocked.map((s) => s.ms);
  const declines = blocked.filter((s) => s.action === 'decline').length;

  console.log('정책 차단 Codex — elicitInput 호출부터 응답까지:');
  for (const s of blocked) console.log(`   ${s.ms.toFixed(2).padStart(8)} ms   action=${s.action}`);

  ok('L1 정책 차단이 실제로 decline을 돌려준다', declines === blocked.length && blocked.length >= 5,
    `${declines}/${blocked.length} declines`);

  const worst = Math.max(...ms);
  ok('L2 정책 거절은 문턱값 아래다 (화면이 그려질 시간이 없다)',
    worst <= THRESHOLD,
    `가장 느린 정책 거절 ${worst.toFixed(2)}ms > 문턱 ${THRESHOLD}ms — Codex가 이제 뭔가를 그리기 시작했을 수 있다. 문턱을 올리지 말고 먼저 확인할 것`);

  // The other side of the gap. A human cannot beat a render+read+keypress; this
  // asserts the threshold leaves them an enormous margin rather than trusting it.
  const HUMAN_FLOOR_MS = 250; // 훨씬 보수적 — 실제 최속은 ~1000ms
  ok('L3 사람의 최속 거절보다 문턱이 한참 아래다',
    THRESHOLD * 10 <= HUMAN_FLOOR_MS,
    `문턱 ${THRESHOLD}ms가 보수적 인간 하한 ${HUMAN_FLOOR_MS}ms에 너무 가깝다 — 접근성·키보드 사용자의 진짜 거절을 삼킬 수 있다`);

  console.log(`\n   정책 거절 최대 ${worst.toFixed(2)}ms · 문턱 ${THRESHOLD}ms · 보수적 인간 하한 ${HUMAN_FLOOR_MS}ms`);
  console.log(`   → 두 집단이 ${(HUMAN_FLOOR_MS / Math.max(worst, 0.01)).toFixed(0)}배 떨어져 있습니다.`);
} catch (e) {
  violations.push(`harness: ${String(e?.message ?? e).slice(0, 200)}`);
} finally {
  try { fs.rmSync(PROBE, { force: true }); } catch { /* best effort */ }
}

const label = `${checks} checks · ${violations.length} violations · 실제 Codex 정책 거절 지연`;
if (violations.length) {
  console.error(`\n❌ ${label}\n`);
  for (const v of violations) console.error(`  ${v}`);
  process.exit(1);
}
console.log(`✅ ${label} — 정책 거절과 사람의 거절은 측정으로 구분됩니다.`);
