/**
 * THE RECORD MUST SAY WHEN THEY ANSWERED, NOT WHEN WE ASKED.
 *
 *   node evals/answer-time.mjs
 *
 * WHY (2026-07-28, found on real hardware). Driving the live server, the host
 * log and the ledger disagreed about a resolve I had just typed:
 *
 *     12:56:11  ledger: premise_resolve "split it, and price the tiers…"
 *     12:57:14  host:   Elicitation response {"decision":"split it, and …"}
 *
 * The record was dated 63 seconds BEFORE the answer it recorded. Nothing was
 * lost and nothing was forged — the handler computed its timestamp on entry and
 * then the picker sat waiting for a human, which is the whole point of a picker.
 * But a judgment record whose timestamps run backwards against the host's own
 * log cannot be used to reconstruct what happened, which is the one job it has.
 *
 * The reviewing session, seeing only the payload, concluded the server had
 * synthesised a decision and stamped it `user`. It had not. That is the cost of
 * the defect: it makes an honest record look like a forged one.
 *
 * `settle.ts` already stamped after its picker; `seal` and `premises` did not.
 *
 * A1 a seal answered slowly is dated at the answer, not at the call
 * A2 an open question resolved slowly is dated at the answer
 * A3 the date part still matches the day they were asked about
 *
 * Exit non-zero on any violation. CI gate. Costs ~15s (two deliberate waits).
 */
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { ElicitRequestSchema } from '@modelcontextprotocol/sdk/types.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist', 'index.js');
if (process.env.ANSWER_TIME_SKIP_BUILD !== '1') execSync('npm run build', { cwd: ROOT, stdio: 'ignore' });

/** How long the "user" takes to answer. Long enough that a stamp taken at
 *  handler entry is unmistakably wrong, short enough for CI. */
const THINK_MS = Number(process.env['ANSWER_TIME_THINK_MS'] ?? 6000);
/** The stamp may lag the answer by a moment of real work (ledger write, mirror);
 *  it may not PRECEDE it, and it may not sit back at the call. */
const SLACK_MS = 3000;

const violations = [];
let checks = 0;
const ok = (id, cond, detail) => {
  checks++;
  if (!cond) violations.push(`${id}: ${String(detail ?? '').slice(0, 200)}`);
  return cond;
};

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'answertime-'));
// Pin the logical timezone so crossing local midnight cannot turn a time-order
// gate into a timezone test. Timezone/date semantics have separate coverage.
const env = {
  ...process.env,
  ARGUS_DIR: dir,
  ARGUS_TZ: 'UTC',
  NODE_ENV: 'test',
};
delete env.ARGUS_TOKEN;

const answeredAt = new Map(); // field name -> ms when we replied
const client = new Client({ name: 'answer-time', version: '1' }, { capabilities: { elicitation: {} } });
client.setRequestHandler(ElicitRequestSchema, async (req) => {
  const keys = Object.keys(req.params.requestedSchema?.properties ?? {});
  await new Promise((r) => setTimeout(r, THINK_MS));   // a person, thinking
  // Adding the later open question also asks an empty-schema premise-confirm
  // question. Only the FIRST empty-schema response belongs to the seal under
  // test; do not let that later confirmation overwrite its timestamp.
  const kind = keys.includes('decision') ? 'decision' : keys.length === 0 ? 'confirm' : 'ambient';
  if (kind !== 'ambient' && !answeredAt.has(kind)) answeredAt.set(kind, Date.now());
  return kind === 'decision'
    ? { action: 'accept', content: { decision: 'my own call, typed slowly' } }
    : { action: 'accept', content: {} };
});

await client.connect(new StdioClientTransport({ command: process.execPath, args: [DIST], env }));
const call = (n, a) => client.callTool({ name: n, arguments: { argus_dir: dir, ...a } }, undefined, { timeout: 120_000 });

// ── A1: a seal the user confirmed slowly ────────────────────────────────────
await call('argus_predict', {
  id: 'slow-seal', predicate: 'the record is dated when the person answered',
  check_by: '2026-12-31', predicate_owner: 'ai_surfaced', confirm_draft: true,
});

// ── A2: an open question resolved slowly ────────────────────────────────────
await call('argus_predict', {
  id: 'slow-q', predicate: 'the open question closes at the moment it is answered',
  check_by: '2026-12-31', predicate_owner: 'user',
});
await call('argus_capture', {
  id: 'slow-q', action: 'add_context',
  premises: [{ text: 'whether to split the plan', kind: 'open_question', source: 'user_stated' }],
});
await call('argus_capture', { id: 'slow-q', action: 'answer_question', ref: 'P1' });

await client.close();

// ── read the ledger back ────────────────────────────────────────────────────
const lines = fs.readdirSync(path.join(dir, 'ledger'))
  .filter((f) => f.endsWith('.jsonl'))
  .flatMap((f) => fs.readFileSync(path.join(dir, 'ledger', f), 'utf8').split('\n'))
  .filter(Boolean)
  .map((l) => { try { return JSON.parse(l); } catch { return null; } })
  .filter(Boolean);

const seal = lines.find((e) => e.id === 'slow-seal' && e.event === 'seal');
const resolve = lines.find((e) => e.event === 'premise_resolve');

for (const [id, ev, kind, label] of [
  ['A1', seal, 'confirm', '봉인'],
  ['A2', resolve, 'decision', '미결질문'],
]) {
  if (!ok(`${id} ${label} 이벤트가 기록됐다`, Boolean(ev), JSON.stringify(lines.map((e) => e.event)))) continue;
  const stamped = Date.parse(ev.ts);
  const replied = answeredAt.get(kind);
  if (!ok(`${id} ${label} 픽커가 실제로 떴다`, Boolean(replied), 'no elicitation seen')) continue;
  const lag = stamped - replied;
  ok(`${id} ${label} 기록 시각이 답한 시각보다 앞서지 않는다`,
    lag >= -SLACK_MS,
    `기록 ${ev.ts} 가 답변보다 ${Math.round(-lag / 1000)}초 빠릅니다 — 호출 시점에 찍고 사람을 기다린 것입니다`);
  ok(`${id} ${label} 기록 시각이 호출 시점에 머물지 않는다`,
    lag > -(THINK_MS - SLACK_MS),
    `대기 ${THINK_MS}ms 인데 기록이 답변보다 ${Math.round(-lag)}ms 앞섭니다`);
  // A3 — only the intra-day time was wrong. ARGUS_TZ is pinned above so the
  // expected logical date is deterministic across the host's local midnight.
  // This is stronger than comparing with the machine's local day: CI and the
  // spawned MCP process share an explicit UTC contract instead of accepting
  // both today and yesterday around a timezone boundary.
  ok(`A3 ${label} 날짜는 물었던 그날 그대로다`,
    ev.ts.slice(0, 10) === new Date(replied).toISOString().slice(0, 10),
    `${ev.ts.slice(0, 10)} vs ${new Date(replied).toISOString().slice(0, 10)}`);
}

fs.rmSync(dir, { recursive: true, force: true });

const label = `${checks} checks · ${violations.length} violations · ${THINK_MS}ms 생각한 사람`;
if (violations.length) {
  console.error(`\n❌ ${label}\n`);
  for (const v of violations) console.error('  ' + v);
  console.error('\n픽커가 사람을 기다린 만큼, 기록도 그 시각으로 찍혀야 합니다 (settle.ts가 하는 방식).');
  process.exit(1);
}
console.log(`✅ ${label} — 기록이 사용자가 답한 시각으로 남습니다.`);
