/**
 * HOST CONFORMANCE MATRIX — every real host × every ask, driven for real.
 *
 *   node evals/host-matrix.mjs
 *
 * WHY THIS EXISTS (2026-07-27, two founder-blocking failures in two days):
 * both bugs lived in the gap between "our harness accepts it" and "the user's
 * client accepts it". The old E2E declared elicitation and returned whatever
 * the script said, so a schema constraint that a REAL host enforces
 * (`required`, then `format`) shipped green twice and blocked the founder's
 * Accept twice. A harness more permissive than the client it stands in for is
 * not a test — it is a rubber stamp.
 *
 * So this file stops pretending there is one client. It spawns the real server
 * once per HOST PROFILE, each profile modelling what that client actually
 * does, and drives every ask that can reach a user:
 *
 *   claude-code      elicitation, strict schema validation (terminal form)
 *   claude-desktop   elicitation + MCP Apps extension (renders the settle card)
 *   codex            NO elicitation declared (the model asks in chat)
 *   legacy           declares nothing at all
 *   hostile-cancel   elicitation, then cancels every ask (timeout / ESC / quirk)
 *   hostile-empty    elicitation, accepts with {} every time (one-tap yes)
 *   hostile-garbage  elicitation, accepts with junk fields the schema never asked for
 *
 * THE INVARIANTS (each one is a founder-visible promise):
 *   I1 NO DEAD END      — every ask ends with the work saved, or a surface that
 *                         tells the user how to save it. Never "not recorded"
 *                         with no way forward.
 *   I2 NO LOST WORK     — a picker that fails must not read as "the user said no".
 *   I3 NO FORM BLOCKING — no elicit schema may carry a constraint a validating
 *                         host enforces (required / format / enum-on-free-text),
 *                         because the blank a one-tap Accept leaves must pass.
 *   I4 HONEST SURFACE   — never claim a record exists when it does not, and the
 *                         reverse: when it does, say so.
 *   I5 NO CRASH         — no host shape may produce an unhandled error.
 *
 * Exit non-zero on any violation. This is a CI gate.
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
const T0 = '2026-07-02';

let violations = [];
let checks = 0;
function ok(host, id, cond, detail) {
  checks++;
  if (cond) return true;
  violations.push(`[${host}] ${id}: ${detail ?? ''}`.trim());
  return false;
}

/** What a VALIDATING host does to the answer before it lets Accept through.
 *  Returns a reason string when the host would refuse to submit. */
function hostRefuses(schema, content) {
  const props = (schema && schema.properties) || {};
  for (const key of (schema?.required ?? [])) {
    const v = content?.[key];
    if (v === undefined || v === '') return `required "${key}" is blank`;
  }
  for (const [key, spec] of Object.entries(props)) {
    const v = (content ?? {})[key];
    // The blank a one-tap Accept leaves — the exact gesture that broke twice.
    if (spec?.format && (v === undefined || v === '')) return `"${key}" declares format:"${spec.format}" but a one-tap Accept leaves it blank`;
    if (spec?.minLength && (v === undefined || String(v).length < spec.minLength)) return `"${key}" declares minLength ${spec.minLength}; a blank Accept violates it`;
    if (spec?.pattern && (v === undefined || !new RegExp(spec.pattern).test(String(v)))) return `"${key}" declares a pattern a blank Accept cannot satisfy`;
  }
  return null;
}

const PROFILES = {
  'claude-code':     { elicit: true,  apps: false, answer: () => ({ action: 'accept', content: {} }), strict: true },
  'claude-desktop':  { elicit: true,  apps: true,  answer: () => ({ action: 'accept', content: {} }), strict: true },
  'codex':           { elicit: false, apps: false },
  'legacy':          { elicit: false, apps: false, bare: true },
  'hostile-cancel':  { elicit: true,  apps: false, answer: () => ({ action: 'cancel' }), strict: true },
  'hostile-empty':   { elicit: true,  apps: false, answer: () => ({ action: 'accept', content: {} }), strict: true },
  'hostile-garbage': { elicit: true,  apps: false, answer: () => ({ action: 'accept', content: { __junk: 1, reword: null, outcome: 'NOT_AN_ENUM' } }), strict: false },
};

async function connect(name, profile, dir) {
  const env = {};
  for (const [k, v] of Object.entries(process.env)) if (typeof v === 'string') env[k] = v;
  env.ARGUS_DIR = dir;
  env.NODE_ENV = 'test';
  const caps = {};
  if (profile.elicit) caps.elicitation = {};
  if (profile.apps) caps.extensions = { 'io.modelcontextprotocol/ui': { mimeTypes: ['text/html;profile=mcp-app'] } };
  const client = new Client({ name: `host-${name}`, version: '1' }, profile.bare ? {} : { capabilities: caps });
  const seen = [];
  if (profile.elicit) {
    client.setRequestHandler(ElicitRequestSchema, async (req) => {
      const schema = req.params?.requestedSchema;
      const answer = profile.answer();
      seen.push({ message: String(req.params?.message ?? ''), schema, answer });
      if (profile.strict && answer.action === 'accept') {
        const why = hostRefuses(schema, answer.content);
        // I3 — the server must never send a form this host would refuse.
        if (why) violations.push(`[${name}] I3 FORM BLOCKING: ${why} · schema=${JSON.stringify(schema).slice(0, 160)}`);
      }
      return answer;
    });
  }
  await client.connect(new StdioClientTransport({ command: process.execPath, args: [DIST], env }));
  return { client, seen, call: async (n, args) => {
    const r = await client.callTool({ name: n, arguments: { argus_dir: dir, ...args } });
    return { sc: r.structuredContent ?? {}, isError: r.isError === true };
  } };
}

/** I1 — a surface is a dead end when nothing was saved AND it hands the user
 *  no way forward (no next action beyond stop, no instruction in the prose). */
function isDeadEnd(sc) {
  const saved = sc?.data?.sealed === true || sc?.data?.outcome || sc?.data?.status === 'sealed' || sc?.ok === false;
  if (saved) return false;
  const acts = sc?.next_actions ?? [];
  const hasHandle = acts.some((x) => x !== 'stop');
  const prose = String(sc?.surface ?? '');
  // A deliberate decline is allowed to end quietly — that IS an answer.
  const isDecline = sc?.data?.choice === 'declined';
  const tellsHow = /저장|기록|save|record|말씀|say/i.test(prose);
  return !isDecline && !hasHandle && !tellsHow;
}

async function runProfile(name) {
  const profile = PROFILES[name];
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `argus-host-${name}-`));
  const { client, call } = await connect(name, profile, dir);
  console.log(`\n■ ${name}`);

  try {
    // ── A. check_in reports the surface this host actually gives ────────────
    {
      const { sc } = await call('argus_check_in', { today_override: T0 });
      const picker = sc?.data?.picker;
      const expect = profile.apps ? 'card' : profile.elicit ? 'one_tap' : 'text_fallback';
      ok(name, 'A1 picker reported truthfully', picker === expect, `expected ${expect}, got ${picker}`);
      ok(name, 'A2 server_version present', typeof sc?.data?.server_version === 'string');
    }

    // ── B. AI-drafted prediction — the confirm path (both blocked failures) ──
    {
      const { sc, isError } = await call('argus_seal', {
        id: 'draft', predicate: '신규 온보딩 개편으로 D7 잔존이 25%를 넘는다',
        check_by: '2026-08-20', predicate_owner: 'ai_surfaced', confirm_draft: true, today_override: T0,
      });
      ok(name, 'B1 no crash', !isError || typeof sc?.error_code === 'string', JSON.stringify(sc).slice(0, 160));
      ok(name, 'B2 no dead end (I1)', !isDeadEnd(sc), `surface="${String(sc?.surface).slice(0, 120)}" next=${JSON.stringify(sc?.next_actions)}`);
      if (name === 'hostile-cancel') {
        // I2 — a cancel must NOT be reported as the user declining.
        ok(name, 'B3 cancel is not recorded as a decline (I2)', sc?.data?.choice === 'no_answer', `choice=${sc?.data?.choice}`);
        ok(name, 'B4 the predicate is handed back so no work is lost (I2)', typeof sc?.data?.predicate === 'string' && sc.data.predicate.includes('D7'), JSON.stringify(sc?.data).slice(0, 160));
      }
      if (name === 'hostile-empty' || name === 'claude-code' || name === 'claude-desktop') {
        // A one-tap Accept with a blank form must SAVE — this is the whole point.
        ok(name, 'B3 one-tap Accept saves (I4)', sc?.data?.sealed !== false, `data=${JSON.stringify(sc?.data).slice(0, 160)}`);
        ok(name, 'B4 accepting a draft makes it the user\'s', sc?.data?.predicate_owner === 'user', `owner=${sc?.data?.predicate_owner}`);
      }
      if (!profile.elicit) {
        // No picker here — the seal must proceed honestly, never silently drop.
        ok(name, 'B3 no-picker host still records (I4)', sc?.data?.sealed !== false && !isError, JSON.stringify(sc?.data).slice(0, 160));
        ok(name, 'B4 provenance stays honest without a picker', sc?.data?.predicate_owner === 'ai_surfaced', `owner=${sc?.data?.predicate_owner}`);
      }
    }

    // ── C. settle — the return path (yesterday's blocked screen) ─────────────
    {
      await call('argus_seal', { id: 'ret', predicate: '광고 ROAS가 7월 안에 300%를 회복한다', check_by: '2026-07-10', predicate_owner: 'user', today_override: T0 });
      const { sc, isError } = await call('argus_settle', { id: 'ret', outcome_source: 'user_stated', today_override: '2026-07-15' });
      ok(name, 'C1 no crash', !isError || typeof sc?.error_code === 'string', JSON.stringify(sc).slice(0, 160));
      if (profile.apps) {
        ok(name, 'C2 apps host gets the card state', sc?.data?.status === 'awaiting_picker', JSON.stringify(sc?.data).slice(0, 160));
        ok(name, 'C3 card carries the predicate + due date', typeof sc?.data?.predicate === 'string' && typeof sc?.data?.check_by === 'string');
      } else if (!profile.elicit) {
        // No picker: an honest refusal that names the missing input.
        ok(name, 'C2 honest OUTCOME_REQUIRED, not a silent drop (I4)', sc?.error_code === 'OUTCOME_REQUIRED', `code=${sc?.error_code}`);
        ok(name, 'C3 the refusal says how to proceed (I1)', /outcome|결과/i.test(String(sc?.recovery ?? sc?.message ?? '')), String(sc?.recovery).slice(0, 120));
      } else {
        // Elicitation host answering with a blank / cancel: must not claim a record.
        const claimed = /기록했|recorded/i.test(String(sc?.surface ?? '')) && !sc?.data?.outcome;
        ok(name, 'C2 never claims a record it did not write (I4)', !claimed, String(sc?.surface).slice(0, 140));
        ok(name, 'C3 no dead end (I1)', !isDeadEnd(sc) || sc?.ok === false, `surface="${String(sc?.surface).slice(0, 120)}"`);
      }
    }

    // ── D. every settle outcome round-trips, on every host ──────────────────
    for (const outcome of ['held', 'avoided', 'partial', 'missed']) {
      const id = `oc-${outcome}`;
      await call('argus_seal', { id, predicate: `${outcome} 경로를 확인하는 예측 문장이다`, check_by: '2026-07-10', predicate_owner: 'user', today_override: T0 });
      const { sc, isError } = await call('argus_settle', { id, outcome, outcome_source: 'user_stated', what_happened: '실제로 이렇게 됐다', today_override: '2026-07-15' });
      ok(name, `D:${outcome} records exactly what was picked (I4)`, !isError && sc?.data?.outcome === outcome, `got ${sc?.data?.outcome} / ${sc?.error_code}`);
    }

    // ── E. premises: the open-question resolve ask ──────────────────────────
    {
      await call('argus_seal', { id: 'pq', predicate: '4분기 재고 회전율이 6을 넘는다', check_by: '2026-12-31', predicate_owner: 'user', today_override: T0 });
      await call('argus_premises', { id: 'pq', op: 'add', today_override: T0, premises: [{ text: '엔터프라이즈 플랜을 분리할지 말지', kind: 'open_question', source: 'user' }] });
      const { sc, isError } = await call('argus_premises', { id: 'pq', op: 'resolve', ref: 'P1', today_override: '2026-07-20' });
      ok(name, 'E1 no crash', !isError || typeof sc?.error_code === 'string', JSON.stringify(sc).slice(0, 160));
      ok(name, 'E2 no dead end (I1)', !isDeadEnd(sc) || sc?.ok === false, `surface="${String(sc?.surface).slice(0, 120)}"`);
    }

    // ── F. the tool list matches what the host declared ─────────────────────
    {
      const tools = await client.listTools();
      const resolveTool = tools.tools.find((t) => t.name === 'argus_resolve');
      const hasUi = Boolean(resolveTool?._meta?.ui?.resourceUri);
      ok(name, 'F1 _meta.ui exactly on apps hosts', hasUi === Boolean(profile.apps), `hasUi=${hasUi} apps=${Boolean(profile.apps)}`);
      const res = await client.listResources();
      ok(name, 'F2 the settle card resource is readable everywhere', res.resources.some((r) => r.uri === 'ui://argus/settle-picker'));
    }
  } finally {
    await client.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

async function main() {
  if (process.env.HOST_MATRIX_SKIP_BUILD !== '1') execSync('npm run build', { cwd: ROOT, stdio: 'ignore' });
  console.log(`Argus host conformance matrix — ${Object.keys(PROFILES).length} host profiles × every user-facing ask`);
  for (const name of Object.keys(PROFILES)) {
    try { await runProfile(name); }
    catch (e) { violations.push(`[${name}] I5 CRASH: ${String(e?.message ?? e).slice(0, 200)}`); }
  }
  console.log(`\n── ${checks} checks · ${violations.length} violation(s) ──`);
  if (violations.length) {
    for (const v of violations) console.log('  ✗ ' + v);
    console.log('\n각 위반은 사용자가 실제로 막히는 자리입니다.');
    process.exit(1);
  }
  console.log('모든 호스트에서 막다름 0 · 유실 0 · 폼 차단 0.');
}

main().catch((e) => { console.error(e); process.exit(1); });
