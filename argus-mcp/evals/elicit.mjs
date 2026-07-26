/**
 * Elicitation harness — verifies the ONE interactive surface an MCP host can
 * render: the structured question a tool asks the END USER (seal's draft
 * confirmation, settle's outcome, a defer date). This is the "질문 건네는 UI"
 * and it has two contracts that both matter for a shippable product:
 *
 *   1. On a host that SUPPORTS elicitation, the question fires at exactly the
 *      right moment (and only then), and the user's answer is applied faithfully
 *      — keep saves as theirs, reword/skip/decline saves NOTHING (no fabricated
 *      authorship), the picked settle outcome is recorded verbatim.
 *   2. On a host that does NOT support elicitation, the tool NEVER calls
 *      elicitInput (which throws), and falls back to a text path — no crash, no
 *      dead end, no silently dropped seal.
 *
 *   npm run elicit
 *
 * A real MCP client that declares the elicitation capability and answers the
 * server's elicitation/create requests with scripted responses.
 */
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { ElicitRequestSchema } from '@modelcontextprotocol/sdk/types.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist', 'index.js');

let failures = 0;
const results = [];
function check(name, cond, detail) {
  results.push({ name, ok: !!cond, detail });
  if (!cond) failures++;
  console.log(`  ${cond ? '✓' : '✗ FAIL'} ${name}${cond ? '' : `  — ${detail ?? ''}`}`);
}

function newDir() { return fs.mkdtempSync(path.join(os.tmpdir(), 'argus-elicit-')); }
function env(dir) { return { ...process.env, NODE_ENV: 'test', ARGUS_DIR: dir, ARGUS_DKK_V6_PILOT: '1' }; }
const parse = (res) => { try { return JSON.parse(res.content[0].text); } catch { return {}; } };

/**
 * Connect a client that declares elicitation and answers each server question
 * with `responder(request)` → an ElicitResult. Records every question seen.
 */
async function connectElicitingClient(dir, responder) {
  const seen = [];
  const client = new Client({ name: 'argus-elicit-test', version: '1' }, { capabilities: { elicitation: {} } });
  client.setRequestHandler(ElicitRequestSchema, async (req) => {
    seen.push(req.params);
    return responder(req.params);
  });
  await client.connect(new StdioClientTransport({ command: process.execPath, args: [DIST], env: env(dir) }));
  return { client, seen };
}

async function connectPlainClient(dir) {
  const client = new Client({ name: 'argus-plain', version: '1' }); // NO elicitation capability
  await client.connect(new StdioClientTransport({ command: process.execPath, args: [DIST], env: env(dir) }));
  return client;
}

async function main() {
  if (!fs.existsSync(DIST)) { console.error('Build first: npm run build'); process.exit(2); }
  console.log('Elicitation harness — the interactive question surface\n');

  // ── SUPPORTED HOST ────────────────────────────────────────────────────────
  console.log('Host WITH elicitation:');

  // E1 — seal confirm_draft=true, user picks "keep" → saved as theirs.
  {
    const dir = newDir();
    const { client, seen } = await connectElicitingClient(dir, () => ({ action: 'accept', content: { choice: 'keep' } }));
    const r = parse(await client.callTool({ name: 'argus_predict', arguments: {
      argus_dir: dir, id: 'e1', predicate: 'AI가 초안한 예측', check_by: '2026-09-01', predicate_owner: 'ai_surfaced', confirm_draft: true, today_override: '2026-07-02' } }));
    check('E1 seal/confirm_draft asks exactly one question', seen.length === 1, `saw ${seen.length}`);
    check('E1 keep → sealed=true', r.data?.sealed === true || /저장|기록했/.test(r.surface ?? ''), JSON.stringify(r.data));
    await client.close(); fs.rmSync(dir, { recursive: true, force: true });
  }

  // E2 — seal confirm_draft=true, user REWORDS in the picker's text field →
  // saved with THEIR wording, owned by them. (The pre-R34 picker had a
  // choice=keep/reword enum where reword meant "abort and retype in chat";
  // the current picker takes the rewording inline — one keystroke less. This
  // eval was still speaking the old contract and the stale answer silently
  // fell through to keep-as-is, which looked like a pass until 2026-07-27.)
  {
    const dir = newDir();
    const { client, seen } = await connectElicitingClient(dir, () => ({ action: 'accept', content: { reword: '9월까지 유료 전환 10건을 내가 직접 닫는다' } }));
    const r = parse(await client.callTool({ name: 'argus_predict', arguments: {
      argus_dir: dir, id: 'e2', predicate: 'AI가 초안한 예측 문장', check_by: '2026-09-01', predicate_owner: 'ai_surfaced', confirm_draft: true, today_override: '2026-07-02' } }));
    check('E2 reword asks exactly one question', seen.length === 1, `saw ${seen.length}`);
    check('E2 reword → sealed with the USER\'s wording', r.data?.predicate === '9월까지 유료 전환 10건을 내가 직접 닫는다', JSON.stringify(r.data).slice(0, 200));
    check('E2 reword → owner is user (their words now)', r.data?.predicate_owner === 'user', JSON.stringify(r.data?.predicate_owner));
    await client.close(); fs.rmSync(dir, { recursive: true, force: true });
  }

  // E2b — reworded check_by is in the PAST → honest refusal, nothing recorded.
  {
    const dir = newDir();
    const { client } = await connectElicitingClient(dir, () => ({ action: 'accept', content: { check_by: '2020-01-01' } }));
    const r = parse(await client.callTool({ name: 'argus_predict', arguments: {
      argus_dir: dir, id: 'e2b', predicate: 'AI가 초안한 예측 문장', check_by: '2026-09-01', predicate_owner: 'ai_surfaced', confirm_draft: true, today_override: '2026-07-02' } }));
    check('E2b past check_by edit → refused honestly (not saved)', r.ok === false && !!r.error_code, JSON.stringify(r).slice(0, 200));
    await client.close(); fs.rmSync(dir, { recursive: true, force: true });
  }

  // E3 — seal confirm_draft=true, user DECLINES the picker → nothing saved, no crash.
  {
    const dir = newDir();
    const { client } = await connectElicitingClient(dir, () => ({ action: 'decline' }));
    const r = parse(await client.callTool({ name: 'argus_predict', arguments: {
      argus_dir: dir, id: 'e3', predicate: 'AI가 초안한 예측 문장', check_by: '2026-09-01', predicate_owner: 'ai_surfaced', confirm_draft: true, today_override: '2026-07-02' } }));
    check('E3 decline → sealed=false, honest (no fabricated save)', r.data?.sealed === false, JSON.stringify(r.data));
    await client.close(); fs.rmSync(dir, { recursive: true, force: true });
  }

  // E4 — settle with NO outcome → asks; user picks "held" → recorded.
  {
    const dir = newDir();
    const { client, seen } = await connectElicitingClient(dir, (p) =>
      /어떻게 답|reality/i.test(p.message) ? ({ action: 'accept', content: { outcome: 'held' } }) : ({ action: 'accept', content: {} }));
    await client.callTool({ name: 'argus_predict', arguments: { argus_dir: dir, id: 'e4', predicate: '전환율이 3.2% 위로 유지된다', check_by: '2026-09-01', predicate_owner: 'user', today_override: '2026-07-02' } });
    // Realistic: the model carries what_happened (the user's own description);
    // outcome is the structured pick left to the elicitation picker.
    const r = parse(await client.callTool({ name: 'argus_resolve', arguments: { argus_dir: dir, id: 'e4', outcome_source: 'user_stated', what_happened: '두 주 연속 3.4%로 유지됨', today_override: '2026-09-02' } }));
    check('E4 settle w/o outcome asks the outcome question', seen.some((s) => /어떻게 답|reality/i.test(s.message)), JSON.stringify(seen.map((s) => s.message)));
    check('E4 picked outcome recorded (not an error)', r.ok === true && r.error_code === undefined, JSON.stringify(r).slice(0, 160));
    await client.close(); fs.rmSync(dir, { recursive: true, force: true });
  }

  // E5 — timing: seal WITHOUT confirm_draft must NOT ask anything.
  {
    const dir = newDir();
    const { client, seen } = await connectElicitingClient(dir, () => ({ action: 'accept', content: { choice: 'keep' } }));
    await client.callTool({ name: 'argus_predict', arguments: { argus_dir: dir, id: 'e5', predicate: '사용자 자기 예측', check_by: '2026-09-01', predicate_owner: 'user', today_override: '2026-07-02' } });
    check('E5 no confirm_draft → zero questions (no spurious prompt)', seen.length === 0, `saw ${seen.length}`);
    await client.close(); fs.rmSync(dir, { recursive: true, force: true });
  }

  // ── UNSUPPORTED HOST ──────────────────────────────────────────────────────
  console.log('\nHost WITHOUT elicitation (must fall back to text, never crash):');

  // E6 — seal confirm_draft=true, plain client → no elicit, seal still proceeds.
  {
    const dir = newDir();
    const client = await connectPlainClient(dir);
    const res = await client.callTool({ name: 'argus_predict', arguments: {
      argus_dir: dir, id: 'e6', predicate: 'AI 초안이지만 picker 없음', check_by: '2026-09-01', predicate_owner: 'ai_surfaced', confirm_draft: true, today_override: '2026-07-02' } });
    const r = parse(res);
    check('E6 no-picker host: not an error', res.isError !== true, JSON.stringify(r).slice(0, 160));
    check('E6 no-picker host: seal proceeds in text (not silently dropped)', r.data?.sealed === true || /저장|기록/.test(r.surface ?? ''), JSON.stringify(r.data));
    await client.close(); fs.rmSync(dir, { recursive: true, force: true });
  }

  // E7 — settle no outcome, plain client → text fallback, no crash/dead-end.
  {
    const dir = newDir();
    const client = await connectPlainClient(dir);
    await client.callTool({ name: 'argus_predict', arguments: { argus_dir: dir, id: 'e7', predicate: '전환율이 3.2% 위로 유지된다', check_by: '2026-09-01', predicate_owner: 'user', today_override: '2026-07-02' } });
    const res = await client.callTool({ name: 'argus_resolve', arguments: { argus_dir: dir, id: 'e7', outcome_source: 'user_stated', today_override: '2026-09-02' } });
    const r = parse(res);
    // The honest fallback: no picker + no outcome supplied → a NAMED, recoverable
    // ask for the outcome (not a crash, not a silent settle). error_code +
    // Korean message + recovery is exactly that graceful text path.
    const asks = r.error_code === 'OUTCOME_REQUIRED' && typeof r.message === 'string' && typeof r.recovery === 'string';
    check('E7 no-picker settle: no crash, honest named ask for the outcome', asks, JSON.stringify(r).slice(0, 160));
    await client.close(); fs.rmSync(dir, { recursive: true, force: true });
  }

  console.log(`\n${failures === 0 ? '✅ all elicitation contracts hold' : `❌ ${failures} elicitation contract(s) broken`}`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(2); });
