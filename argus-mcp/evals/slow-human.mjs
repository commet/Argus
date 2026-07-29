/**
 * A PERSON WHO TAKES LONGER THAN A MINUTE.
 *
 *   node evals/slow-human.mjs
 *
 * WHY (2026-07-28). "Accept does not work" was reported twice and fixed twice —
 * once for a `required` field a strict host enforced, once for `format`. Both
 * were real. Neither was what happened in the founder's own host log:
 *
 *     07:22:16  argus_predict called, the ask goes out
 *     07:23:16  tool completed in 1m 0s        ← the SDK's default timeout, exactly
 *     07:23:27  {"action":"accept"}            ← their Accept, eleven seconds late
 *
 * The picker rendered. They read it. They pressed Accept. The MCP SDK had
 * already timed the request out at its 60-second default, because nobody passed
 * `RequestOptions` to `elicitInput`, so the answer was dropped on the floor and
 * the tool told them nothing was recorded.
 *
 * Every gate we had asked whether the ask goes out and whether a host would
 * accept its schema. None of them asked how long a human is allowed to think.
 * The harness always answered instantly — which is precisely the one behaviour
 * a person never has.
 *
 * So this one is slow on purpose: it answers after NINETY-FIVE seconds and
 * requires that the record still lands. It costs ~100s of wall clock, which is
 * the price of testing the single most important interaction in the product
 * against the way people actually use it.
 *
 *   S1 an Accept that arrives after the SDK's 60s default is still honored
 *   S2 the prediction is on record afterwards (not merely "ok")
 *
 * Exit non-zero on any violation. CI gate.
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
if (process.env.SLOW_HUMAN_SKIP_BUILD !== '1') execSync('npm run build', { cwd: ROOT, stdio: 'ignore' });

// Past the SDK's 60s default, close enough to keep CI honest about the cost.
const THINK_MS = Number(process.env['SLOW_HUMAN_THINK_MS'] ?? 95_000);

const violations = [];
let checks = 0;
const ok = (id, cond, detail) => {
  checks++;
  if (!cond) violations.push(`${id}: ${String(detail ?? '').slice(0, 200)}`);
  return cond;
};

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'slow-'));
const env = { ...process.env, ARGUS_DIR: dir, NODE_ENV: 'test' };
delete env.ARGUS_TOKEN;

const client = new Client({ name: 'slow-human', version: '1' }, { capabilities: { elicitation: {} } });
let asked = false;
client.setRequestHandler(ElicitRequestSchema, async () => {
  asked = true;
  // The whole point: a human reading their own prediction and deciding.
  await new Promise((r) => setTimeout(r, THINK_MS));
  return { action: 'accept', content: {} }; // "yes, as written" — the common case
});

// The CLIENT must not be the thing that gives up either: its own request
// timeout for the tool call has to outlast the person answering the ask.
const transport = new StdioClientTransport({ command: process.execPath, args: [DIST], env });
await client.connect(transport);

const t0 = Date.now();
const res = await client.callTool(
  {
    name: 'argus_predict',
    arguments: {
      argus_dir: dir,
      id: 'slow-1',
      predicate: 'the person answering this picker is allowed to think for longer than a minute',
      check_by: '2026-09-30',
      predicate_owner: 'ai_surfaced',
      confirm_draft: true,
    },
  },
  undefined,
  { timeout: THINK_MS + 120_000 },
);
const elapsed = Date.now() - t0;
const sc = res.structuredContent ?? {};

ok('S0 픽커가 실제로 떴다', asked, JSON.stringify(sc).slice(0, 160));
// Assert on the FACT, not on a field name: a dropped answer takes the
// no_answer / declined path, and both say so in `data`.
const dropped = sc?.data?.choice === 'no_answer' || sc?.data?.choice === 'declined' || sc?.data?.sealed === false;
ok('S1 60초 넘겨 도착한 Accept가 살아남는다', sc?.ok === true && !dropped,
  `${Math.round(elapsed / 1000)}초 걸림 · choice=${JSON.stringify(sc?.data?.choice)} sealed=${JSON.stringify(sc?.data?.sealed)} · surface=${String(sc?.surface).slice(0, 90)}`);

// "ok" is not the same fact as "it is on record" — read it back.
const back = await client.callTool({ name: 'argus_patterns', arguments: { argus_dir: dir, view: 'all' } });
const seen = JSON.stringify(back.structuredContent ?? {});
ok('S2 되읽으면 기록이 거기 있다', seen.includes('slow-1'), seen.slice(0, 200));

await client.close();
fs.rmSync(dir, { recursive: true, force: true });

const label = `${checks} checks · ${violations.length} violations · ${Math.round(elapsed / 1000)}초 기다린 사람`;
if (violations.length) {
  console.error(`\n❌ ${label}\n`);
  for (const v of violations) console.error('  ' + v);
  console.error('\n사람이 1분 넘게 생각하면 답이 버려집니다. elicitInput에 timeout을 넘기세요 (elicit.ts DECISION_ASK_TIMEOUT_MS).');
  process.exit(1);
}
console.log(`✅ ${label} — 오래 생각한 사람의 Accept가 기록에 남았습니다.`);
