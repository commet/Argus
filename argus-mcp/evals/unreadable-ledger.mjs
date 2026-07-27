/**
 * "I could not look" must never be reported as "there is nothing there."
 *
 *   node evals/unreadable-ledger.mjs
 *
 * Adversarial audit, 2026-07-27. When the ledger file exists but cannot be
 * READ, the replay swallowed the error into an empty fold WITH
 * `integrity.dropped_lines: 0` — an affirmative claim that nothing was lost.
 * The auditor drove the real server and got:
 *
 *   - "No decisions on record yet." while a sealed prediction sat on disk
 *   - argus_resolve → NO_PRIOR_SEAL for that same prediction
 *   - and the killer: deriveState saw `absent`, so a SECOND seal on the same
 *     id was ACCEPTED and silently moved its check-by — the goalpost move the
 *     state machine exists to refuse, through the one door nobody guarded.
 *
 * This drives the real built server against a ledger that is present but
 * unreadable (a DIRECTORY at the ledger path reproduces EISDIR portably), and
 * asserts the three promises:
 *
 *   U1 a write REFUSES rather than acting on a fold it knows is blind
 *   U2 the refusal names the cause and what is safe (nothing lost)
 *   U3 no read surface claims "nothing on record" while blind
 */
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist', 'index.js');
let failures = 0;
const check = (name, cond, detail) => {
  if (cond) { console.log(`  ok   ${name}`); return; }
  failures++; console.log(`  FAIL ${name}${detail ? ` — ${detail}` : ''}`);
};

if (process.env.UNREADABLE_SKIP_BUILD !== '1') execSync('npm run build', { cwd: ROOT, stdio: 'ignore' });

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'argus-unread-'));
const env = {};
for (const [k, v] of Object.entries(process.env)) if (typeof v === 'string') env[k] = v;
env.ARGUS_DIR = dir; env.NODE_ENV = 'test';

async function session(fn) {
  const client = new Client({ name: 'unreadable-probe', version: '1' });
  await client.connect(new StdioClientTransport({ command: process.execPath, args: [DIST], env }));
  const call = async (n, args) => (await client.callTool({ name: n, arguments: { argus_dir: dir, ...args } })).structuredContent ?? {};
  try { await fn(call); } finally { await client.close(); }
}

console.log('원장을 읽을 수 없을 때 — 침묵 대신 정직\n');

// 1) a real sealed prediction on disk
await session(async (call) => {
  const r = await call('argus_predict', { id: 'q3', predicate: '컷오버 다운타임이 5분 미만이다', check_by: '2026-08-01', predicate_owner: 'user', today_override: '2026-07-20' });
  check('준비: 예측이 실제로 저장됐다', r?.ok !== false, JSON.stringify(r).slice(0, 140));
});

// 2) make the ledger unreadable while KEEPING it present (EISDIR is portable;
//    chmod/ACL games are not, and this reproduces the same class exactly).
const ledger = path.join(dir, 'ledger', 'ledger.jsonl');
const saved = fs.readFileSync(ledger, 'utf8');
fs.rmSync(ledger);
fs.mkdirSync(ledger);

await session(async (call) => {
  // U1 — the write path must refuse, NOT re-seal onto a record it cannot see
  const re = await call('argus_predict', { id: 'q3', predicate: '컷오버 다운타임이 5분 미만이다', check_by: '2026-09-01', predicate_owner: 'user', today_override: '2026-07-20' });
  check('U1 못 읽는 원장 위에 두 번째 봉인을 거부한다', re?.ok === false, JSON.stringify(re).slice(0, 200));
  check('U1 거부 코드가 원인을 지목한다', re?.error_code === 'LEDGER_UNREADABLE', `code=${re?.error_code}`);
  // U2 — the refusal must be actionable and must not frighten the user about data
  check('U2 무엇을 하면 되는지 말한다', typeof re?.recovery === 'string' && re.recovery.length > 20, String(re?.recovery).slice(0, 120));
  check('U2 아무것도 잃지 않았음을 말한다', /lost|잃|intact|그대로/i.test(String(re?.recovery ?? '') + String(re?.message ?? '')), String(re?.recovery).slice(0, 140));

  // settle must refuse too — never NO_PRIOR_SEAL for a prediction on disk
  const st = await call('argus_resolve', { id: 'q3', outcome: 'held', outcome_source: 'user_stated', what_happened: '3분 만에 끝', today_override: '2026-08-02' });
  check('U1 정산도 거부한다 (NO_PRIOR_SEAL로 오답하지 않는다)', st?.error_code === 'LEDGER_UNREADABLE', `code=${st?.error_code}`);

  // U3 — a READ may be empty, but it must not assert integrity it does not have
  const ci = await call('argus_check_in', { today_override: '2026-08-02' });
  const integ = ci?.data?.integrity ?? {};
  check('U3 읽기 표면이 못 읽었다는 사실을 싣는다', typeof integ.unreadable === 'string', JSON.stringify(integ));
});

// 3) restore and prove the record was never touched
fs.rmSync(ledger, { recursive: true, force: true });
fs.writeFileSync(ledger, saved, 'utf8');
await session(async (call) => {
  const rc = await call('argus_patterns', { view: 'all', today_override: '2026-08-02' });
  const rows = rc?.data?.contracts ?? [];
  const q3 = rows.find((c) => c.id === 'q3');
  check('복구 후 원래 예측이 그대로 하나만 있다', rows.filter((c) => c.id === 'q3').length === 1, JSON.stringify(rows).slice(0, 160));
  check('확인일이 조용히 밀리지 않았다', q3?.check_by === '2026-08-01', `check_by=${q3?.check_by}`);
  const seals = saved.split('\n').filter((l) => l.includes('"event":"seal"') && l.includes('"q3"')).length;
  check('원장에 seal 줄이 하나뿐이다 (이중 기록 없음)', seals === 1, `seal lines=${seals}`);
});

fs.rmSync(dir, { recursive: true, force: true });
console.log(failures === 0
  ? '\n✅ 못 읽는 원장 위에서 쓰기는 멈추고, 기록은 손대지 않은 채 남는다.'
  : `\n❌ ${failures}건 — 이 상태에서 사용자의 기록이 위험하다.`);
process.exit(failures === 0 ? 0 : 1);
