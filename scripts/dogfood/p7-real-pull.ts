/**
 * P7 plugin lifecycle — REAL-SCRIPT end-to-end.
 *
 * The dogfood harness's PluginSurface.pull() is a verbatim port of
 * push-webapp.js pull(). This runner removes the port from the loop: it runs
 * the ACTUAL argus-plugin-v2/scripts/push-webapp.js as a child process, in a
 * disposable repo, against a local HTTP server that speaks the exact
 * /api/plugin/events wire shape ({ ok, events: [...] }, Bearer-token checked).
 *
 * Chain proved:
 *   v2 decision → REAL reforge/answer/close builders (semantic-plugin.ts)
 *   → outbox rows in usePluginStore's verbatim shape
 *   → REAL push-webapp.js pull (HTTP, envelope check, verbatim append, state)
 *   → .argus/ledger/semantic-v3.jsonl byte-compare with the outbox
 *   → pull #2 idempotent (0 written)
 *   → invalid batch served → visible error on stderr, ledger unpolluted
 *   → missing token → hard failure, no writes
 *
 * Evidence: scripts/dogfood/p5-experiment/../evidence — printed JSON summary;
 * run under `npx tsx scripts/dogfood/p7-real-pull.ts <workdir>`.
 */
import { execFile } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import {
  reforgePluginDecision,
  recordPluginAnswer,
  closePluginRecord,
} from '../../src/lib/semantic-plugin';
import type { PluginDecision } from '../../src/stores/types';

const SCRIPT = path.resolve('argus-plugin-v2/scripts/push-webapp.js');
const TOKEN = 'argus_pat_p7_local_e2e';

function v2Decision(): PluginDecision {
  return {
    id: 'e2e-4b1f0f7a-0000-4000-8000-p7realpull01',
    source: 'import',
    ledger_id: 'lg-p7-real',
    session: '2026-06-30-strategy',
    quote: '우리는 6월 컷오프를 지킨다',
    decision: 'Ship the June cutoff without the import wizard.',
    predicate: 'Did we ship by June 30 without the wizard?',
    check_by: '2026-08-15',
    sealed_at: '2026-06-30T09:00:00.000Z',
    status: 'sealed',
    created_at: '2026-06-30T09:00:00.000Z',
    updated_at: '2026-06-30T09:00:00.000Z',
  } as PluginDecision;
}

interface WireEvent {
  event_id: string;
  ledger_id: string;
  event: string;
  payload: { semantic_events: unknown[] };
  created_at: string;
}

/** Async spawn — execFileSync would block THIS process's event loop and
 * deadlock the child against the local HTTP server we host here. */
function run(cmd: string[], cwd: string, env: Record<string, string>): Promise<{ stdout: string; stderr: string; code: number }> {
  return new Promise((resolve) => {
    execFile(cmd[0]!, cmd.slice(1), { cwd, env: { ...process.env, ...env }, encoding: 'utf8', timeout: 30_000 }, (error, stdout, stderr) => {
      const code = error ? ((error as { code?: number }).code ?? 1) : 0;
      resolve({ stdout: stdout ?? '', stderr: stderr ?? '', code: typeof code === 'number' ? code : 1 });
    });
  });
}

async function main(): Promise<void> {
  const workdir = process.argv[2] ?? fs.mkdtempSync(path.join(process.env['TMPDIR'] ?? '/tmp', 'p7-real-'));
  const repo = path.join(workdir, 'disposable-repo');
  fs.rmSync(repo, { recursive: true, force: true });
  fs.mkdirSync(path.join(repo, '.argus', 'ledger'), { recursive: true });
  fs.mkdirSync(path.join(repo, '.git'), { recursive: true }); // findProjectRoot anchor

  // --- The chain, through the REAL builders -------------------------------
  const decision = v2Decision();
  const t0 = '2026-07-15T10:00:00.000Z';
  const t1 = '2026-07-15T10:01:00.000Z';
  const t2 = '2026-07-15T10:02:00.000Z';
  const record = reforgePluginDecision(decision, 'req-p7-reforge', t0);
  const answer = recordPluginAnswer(decision, record, 'req-p7-answer', 'happened', t1);
  const withAnswer = { ...record, events: [...record.events, ...answer] };
  const resolutionId = (answer.find((e) => (e as { event: string }).event === 'resolution_asserted') as { resolution_id: string }).resolution_id;
  const close = closePluginRecord(decision, withAnswer, 'req-p7-close', resolutionId, t2);

  const batches: unknown[][] = [record.events, answer, close];
  const wire: WireEvent[] = batches.map((events, i) => ({
    event_id: `web:plugin:v3:${decision.ledger_id}:pe-${i + 1}`,
    ledger_id: decision.ledger_id!,
    event: 'semantic_v3',
    payload: { semantic_events: events },
    created_at: `2026-07-15T10:0${i}:30.000Z`,
  }));
  const invalidWire: WireEvent = {
    event_id: `web:plugin:v3:${decision.ledger_id}:pe-invalid`,
    ledger_id: decision.ledger_id!,
    event: 'semantic_v3',
    payload: { semantic_events: [{ event: 'judgment_sealed', v: 2, note: 'wrong version, no event_id' }] },
    created_at: '2026-07-15T10:09:00.000Z',
  };

  // --- Local server speaking the exact route wire shape -------------------
  let serveInvalid = false;
  let sawAuthHeader = '';
  const server = http.createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    if (url.pathname !== '/api/plugin/events') { res.writeHead(404).end(); return; }
    sawAuthHeader = req.headers.authorization ?? '';
    if (sawAuthHeader !== `Bearer ${TOKEN}`) {
      res.writeHead(401, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: 'Unknown, revoked, or expired token' }));
      return;
    }
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ ok: true, events: serveInvalid ? [invalidWire] : wire }));
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = (server.address() as { port: number }).port;
  const env = { ARGUS_PUSH_TOKEN: TOKEN, ARGUS_PUSH_URL: `http://127.0.0.1:${port}` };

  const results: Record<string, unknown> = {};
  const ledgerFile = path.join(repo, '.argus', 'ledger', 'semantic-v3.jsonl');

  // 1) missing token → hard failure, no writes
  const noToken = await run(['node', SCRIPT, 'pull'], repo, { ARGUS_PUSH_URL: env.ARGUS_PUSH_URL, ARGUS_PUSH_TOKEN: '' });
  results['no_token_refused'] = noToken.code !== 0 && !fs.existsSync(ledgerFile);

  // 2) real pull #1
  const pull1 = await run(['node', SCRIPT, 'pull'], repo, env);
  const lines1 = fs.existsSync(ledgerFile) ? fs.readFileSync(ledgerFile, 'utf8').split('\n').filter(Boolean) : [];
  const expectedLines = batches.flat().map((e) => JSON.stringify(e));
  results['pull1'] = {
    exit: pull1.code,
    stdout: pull1.stdout.trim(),
    lines: lines1.length,
    byte_identical: lines1.length === expectedLines.length && lines1.every((line, i) => line === expectedLines[i]),
    bearer_seen: sawAuthHeader === `Bearer ${TOKEN}`,
  };

  // 3) pull #2 → idempotent
  const pull2 = await run(['node', SCRIPT, 'pull'], repo, env);
  const lines2 = fs.readFileSync(ledgerFile, 'utf8').split('\n').filter(Boolean);
  results['pull2_idempotent'] = { exit: pull2.code, stdout: pull2.stdout.trim(), grew: lines2.length !== lines1.length };

  // 4) invalid batch → visible error, ledger unpolluted
  serveInvalid = true;
  const pull3 = await run(['node', SCRIPT, 'pull'], repo, env);
  const lines3 = fs.readFileSync(ledgerFile, 'utf8').split('\n').filter(Boolean);
  results['invalid_batch'] = {
    exit: pull3.code,
    visible_error: /invalid v3 envelope/.test(pull3.stderr + pull3.stdout),
    ledger_polluted: lines3.length !== lines2.length,
  };

  server.close();
  const summary = {
    workdir: repo,
    checks: results,
    pass:
      results['no_token_refused'] === true &&
      (results['pull1'] as { byte_identical: boolean; bearer_seen: boolean }).byte_identical &&
      (results['pull1'] as { bearer_seen: boolean }).bearer_seen &&
      (results['pull2_idempotent'] as { grew: boolean }).grew === false &&
      (results['invalid_batch'] as { visible_error: boolean; ledger_polluted: boolean }).visible_error === true &&
      (results['invalid_batch'] as { ledger_polluted: boolean }).ledger_polluted === false,
  };
  console.log(JSON.stringify(summary, null, 2));
  process.exit(summary.pass ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
