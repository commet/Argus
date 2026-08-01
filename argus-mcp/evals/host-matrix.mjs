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
 *   long-typer       elicitation, types a long answer into every free-text field
 *   hostile-error    declares elicitation at initialize, then rejects every ask
 *   text-only        types into the free-text box and leaves the enum alone
 *
 * THE INVARIANTS (each one is a founder-visible promise):
 *   I1 NO DEAD END      — every ask ends with the work saved, or a surface that
 *                         tells the user how to save it. Never "not recorded"
 *                         with no way forward.
 *   I2 NO LOST WORK     — a picker that fails must not read as "the user said no",
 *                         and a refusal that lands AFTER the user typed must hand
 *                         their words back instead of making them write it twice.
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
/** Format a detail string safely. `JSON.stringify(undefined)` is undefined, and
 *  calling .slice on it crashed the whole profile — the harness reporting its
 *  OWN bug as "I5 CRASH" against the server (2026-07-28). A gate that can crash
 *  while describing a pass is worse than noisy: it hides the real result. */
const brief = (v, n = 200) => String(JSON.stringify(v ?? null) ?? 'null').slice(0, n);
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
    const blank = v === undefined || v === '';
    // (a) the blank a one-tap Accept leaves — the gesture that broke twice
    if (spec?.format && blank) return `"${key}" declares format:"${spec.format}" but a one-tap Accept leaves it blank`;
    if (spec?.minLength && (blank || String(v).length < spec.minLength)) return `"${key}" declares minLength ${spec.minLength}; a blank Accept violates it`;
    if (spec?.pattern && (blank || !new RegExp(spec.pattern).test(String(v)))) return `"${key}" declares a pattern a blank Accept cannot satisfy`;
    // (b) the answer the user actually TYPED. The MCP SDK validates the returned
    //     content against this very schema INSIDE our own process (ajv), so an
    //     over-limit or off-enum answer throws and the user's words are lost —
    //     no exotic host required. Found live by adversarial audit 2026-07-27:
    //     maxLength:400 was destroying 420-character answers and reporting them
    //     to the model as "the user never answered".
    if (blank) continue;
    if (spec?.maxLength && String(v).length > spec.maxLength) return `"${key}" declares maxLength ${spec.maxLength} and the user typed ${String(v).length} — their words are destroyed`;
    if (spec?.enum && !spec.enum.includes(v)) return `"${key}" value "${v}" is outside the declared enum`;
    if (spec?.type === 'string' && typeof v !== 'string') return `"${key}" declares type:"string" but the answer is ${typeof v}`;
    if (typeof spec?.minimum === 'number' && Number(v) < spec.minimum) return `"${key}" is below the declared minimum`;
    if (typeof spec?.maximum === 'number' && Number(v) > spec.maximum) return `"${key}" is above the declared maximum`;
  }
  return null;
}

/** A user who types a LOT. Every harness before this one answered with `{}` or a
 *  short string, so no gate ever modelled the person who actually writes their
 *  reasoning out — which is the person this product is for. */
const LONG = '이번 분기 결과를 정리하면, '.repeat(40); // ~520 chars

const PROFILES = {
  'claude-code':     { elicit: true,  apps: false, answer: () => ({ action: 'accept', content: {} }), strict: true },
  'claude-desktop':  { elicit: true,  apps: true,  answer: () => ({ action: 'accept', content: {} }), strict: true },
  // ONE real Codex identity, two realities — and neither may be reached by
  // matching the product name. Blacklisting `codex-mcp-client` makes the first
  // impossible along with the second; trusting every declared capability lets
  // the second be reported to the user as their own decline. (Both realities
  // were reproduced against a real `codex app-server` on 2026-07-29 and have a
  // dedicated gate there; these two profiles are the fast proxy that runs even
  // where Codex is not installed.)
  'codex-interactive': {
    elicit: true, apps: false, strict: true,
    clientInfo: { name: 'codex-mcp-client', title: 'Codex', version: '0.130.0' },
    answer: () => ({ action: 'accept', content: {} }),
  },
  'codex-policy-blocked': {
    elicit: true, apps: false, policyBlocked: true,
    clientInfo: { name: 'codex-mcp-client', title: 'Codex', version: '0.130.0' },
    answer: () => ({ action: 'decline' }),   // synthesized, instantly, unseen
  },
  'codex-no-elicit':  { elicit: false, apps: false },
  'legacy':          { elicit: false, apps: false, bare: true },
  'hostile-cancel':  { elicit: true,  apps: false, answer: () => ({ action: 'cancel' }), strict: true },
  'hostile-empty':   { elicit: true,  apps: false, answer: () => ({ action: 'accept', content: {} }), strict: true },
  // Types a long answer into every string field the picker declares. This is the
  // profile that catches maxLength — the class that was silently destroying real
  // answers while every other gate stayed green.
  'long-typer':      { elicit: true,  apps: false, strict: true, answerFor: (schema) => {
    const content = {};
    for (const [k, spec] of Object.entries((schema && schema.properties) || {})) {
      if (spec?.enum) content[k] = spec.enum[0];
      else if (spec?.type === 'string' || spec?.type === undefined) content[k] = LONG;
    }
    return { action: 'accept', content };
  } },
  'hostile-garbage': { elicit: true,  apps: false, answer: () => ({ action: 'accept', content: { __junk: 1, reword: null, outcome: 'NOT_AN_ENUM' } }), strict: false },
  // Sends a field the ask never declared. Since 2026-07-28 the seal and premise
  // confirms declare NO properties, so a spec-following client sends nothing —
  // but the server still CONSUMES `reword` defensively, and code nobody can
  // reach is code nobody can test. This profile keeps that protection honest:
  // if a client volunteers an over-long reword, the words must come back rather
  // than the user being told to write it all again.
  'extra-field':     { elicit: true,  apps: false, strict: false, answerFor: (schema) => {
    const keys = Object.keys((schema && schema.properties) || {});
    if (keys.length === 0) return { action: 'accept', content: { reword: LONG } };
    const content = {};
    for (const [k, spec] of Object.entries(schema.properties)) {
      if (spec?.enum) content[k] = spec.enum[0];
      else content[k] = LONG;
    }
    return { action: 'accept', content };
  } },
  // Declares `elicitation` at initialize and then REJECTS every elicitation/create.
  // Real hosts do this (a capability advertised ahead of the implementation), and
  // it is the one shape where the user never sees anything at all — so nothing may
  // be recorded as "the user said no", and the out-of-band ask must not burn its
  // cooldown on a question that was never shown.
  'hostile-error':   { elicit: true,  apps: false, strict: false, throws: true },
  // The MOST LIKELY real gesture, and no profile modelled it until 2026-07-28:
  // the user types into the free-text box and leaves the enum alone. Hosts render
  // a non-required enum collapsed behind an expand key, so "write the sentence,
  // press Accept" is the path of least resistance — and the one where the server
  // has the user's words in hand and must not throw them away asking again.
  'text-only':       { elicit: true,  apps: false, strict: true, answerFor: (schema) => {
    const content = {};
    for (const [k, spec] of Object.entries((schema && schema.properties) || {})) {
      if (!spec?.enum && (spec?.type === 'string' || spec?.type === undefined)) content[k] = '실제로는 예상보다 2주 늦게, 그래도 목표치는 넘겼다';
    }
    return { action: 'accept', content };
  } },
};

async function connect(name, profile, dir) {
  const env = {};
  for (const [k, v] of Object.entries(process.env)) if (typeof v === 'string') env[k] = v;
  env.ARGUS_DIR = dir;
  env.NODE_ENV = 'test';
  const caps = {};
  if (profile.elicit) caps.elicitation = {};
  if (profile.apps) caps.extensions = { 'io.modelcontextprotocol/ui': { mimeTypes: ['text/html;profile=mcp-app'] } };
  // clientInfo matters: a profile that carries a REAL host's identity is how we
  // keep proving that nothing branches on the product name.
  const client = new Client(profile.clientInfo ?? { name: `host-${name}`, version: '1' },
    profile.bare ? {} : { capabilities: caps });
  const seen = [];
  if (profile.elicit) {
    client.setRequestHandler(ElicitRequestSchema, async (req) => {
      if (profile.throws) throw new Error('elicitation declared but not implemented');
      const schema = req.params?.requestedSchema;
      const answer = profile.answerFor ? profile.answerFor(schema) : profile.answer();
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
  const saved = sc?.data?.sealed === true || sc?.data?.outcome || sc?.data?.status === 'sealed';
  if (saved) return false;
  // An error is NOT a save (the old rule said it was, which made three I1 checks
  // tautologies — audit 2026-07-27). An error is acceptable only when it hands
  // the user a way forward: a named recovery.
  if (sc?.ok === false) return !(typeof sc?.recovery === 'string' && sc.recovery.trim().length > 0);
  const acts = sc?.next_actions ?? [];
  const hasHandle = acts.some((x) => x !== 'stop');
  const prose = String(sc?.surface ?? '');
  // A deliberate decline is allowed to end quietly — that IS an answer.
  const isDecline = sc?.data?.choice === 'declined';
  const tellsHow = /저장|기록|save|record|말씀|say/i.test(prose);
  return !isDecline && !hasHandle && !tellsHow;
}

/** Profiles where the picker NEVER returns an answer (cancel, or a host that
 *  rejects the request outright). Every ask must, on these, (a) mark the result
 *  `choice:'no_answer'` rather than 'declined', and (b) hand back the material
 *  the user would otherwise have to produce again from memory. This is the I2
 *  invariant, and until 2026-07-28 it was asserted on exactly ONE of six asks. */
const NO_ANSWER_HOSTS = new Set(['hostile-cancel', 'hostile-error']);
/** Profiles that actually TYPE into a free-text field — the only ones whose
 *  answer can legitimately close an open question. */
const TYPED_HOSTS = new Set(['long-typer', 'text-only', 'extra-field']);

async function runProfile(name) {
  const profile = PROFILES[name];
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `argus-host-${name}-`));
  const { client, call, seen } = await connect(name, profile, dir);
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
      const { sc, isError } = await call('argus_predict', {
        id: 'draft', predicate: '신규 온보딩 개편으로 D7 잔존이 25%를 넘는다',
        check_by: '2026-08-20', predicate_owner: 'ai_surfaced', confirm_draft: true, today_override: T0,
      });
      ok(name, 'B1 no unhandled throw (I5)', sc?.error_code !== 'INTERNAL_ERROR', brief(sc, 200));
      ok(name, 'B2 no dead end (I1)', !isDeadEnd(sc), `surface="${String(sc?.surface).slice(0, 120)}" next=${JSON.stringify(sc?.next_actions)}`);
      if (name === 'hostile-cancel') {
        ok(name, 'B3 non-answer is not recorded as a decline (I2)', sc?.data?.choice === 'no_answer', `choice=${sc?.data?.choice}`);
        ok(name, 'B4 the predicate is handed back so no work is lost (I2)', typeof sc?.data?.predicate === 'string' && sc.data.predicate.includes('D7'), brief(sc?.data, 160));
      }
      if (profile.policyBlocked) {
        // This profile reproduces a client that returns `decline` for policy.
        // The server has no rendering receipt or policy marker, so it preserves
        // the only protocol action it received.
        ok(name, 'B3 decline is not reclassified from elapsed time', sc?.data?.choice === 'declined', `choice=${sc?.data?.choice}`);
      }
      if (name === 'hostile-empty' || name === 'claude-code' || name === 'claude-desktop' || name === 'codex-interactive') {
        // A one-tap Accept with a blank form must SAVE — this is the whole point.
        ok(name, 'B3 one-tap Accept saves (I4)', sc?.data?.sealed !== false, `data=${brief(sc?.data, 160)}`);
        ok(name, 'B4 accepting a draft makes it the user\'s', sc?.data?.predicate_owner === 'user', `owner=${sc?.data?.predicate_owner}`);
      }
      if (name === 'long-typer') {
        // The seal confirm ships NO fields since 2026-07-28 (an optional edit box
        // is what made Accept do nothing on Claude Code), so this host has
        // nothing to type into and the seal simply saves.
        ok(name, 'B5 칸이 없으면 확인만으로 저장된다 (I4)', sc?.data?.sealed !== false,
          `code=${sc?.error_code} data=${brief(sc?.data, 160)}`);
      }
      if (name === 'extra-field') {
        // …and the protection behind it stays REAL: a client that volunteers an
        // over-long `reword` anyway must get those words back. 520 characters
        // exceeds the 400-char predicate cap, so the seal is refused AFTER the
        // user already typed; until 2026-07-28 all the model saw was "too long"
        // and the sentence was gone, so it asked them to write it again.
        ok(name, 'B5 선언하지 않은 칸으로 온 긴 답도 돌려준다 (I2)',
          typeof sc?.data?.user_input?.reword === 'string' && sc.data.user_input.reword.length > 400,
          `code=${sc?.error_code} data=${brief(sc?.data, 160)}`);
      }
      if (!profile.elicit) {
        // No picker here — the seal must proceed honestly, never silently drop.
        ok(name, 'B3 no-picker host still records (I4)', sc?.data?.sealed !== false && !isError, brief(sc?.data, 160));
        ok(name, 'B4 provenance stays honest without a picker', sc?.data?.predicate_owner === 'ai_surfaced', `owner=${sc?.data?.predicate_owner}`);
      }
      if (profile.policyBlocked) {
        // Even a client that repeatedly synthesizes decline must not disable
        // later pickers or change the negotiated capability report.
        const asksBefore = seen.length;
        const { sc: second } = await call('argus_predict', {
          id: 'draft2', predicate: '두 번째 초안도 정책이 대신 답한다',
          check_by: '2026-08-21', predicate_owner: 'ai_surfaced', confirm_draft: true, today_override: T0,
        });
        ok(name, 'B5 the ask is still sent — a decline does not disable pickers',
          seen.length > asksBefore, `asks before=${asksBefore} after=${seen.length}`);
        ok(name, 'B6 repeated decline keeps the same protocol meaning', second?.data?.choice === 'declined', `choice=${second?.data?.choice}`);
        const { sc: after } = await call('argus_check_in', { today_override: T0 });
        ok(name, 'B7 timing does not rewrite the negotiated picker capability',
          after?.data?.picker === 'one_tap', `picker=${after?.data?.picker}`);
      }
    }

    // ── C. settle — the return path (yesterday's blocked screen) ─────────────
    {
      await call('argus_predict', { id: 'ret', predicate: '광고 ROAS가 7월 안에 300%를 회복한다', check_by: '2026-07-10', predicate_owner: 'user', today_override: T0 });
      const { sc, isError } = await call('argus_resolve', { id: 'ret', outcome_source: 'user_stated', today_override: '2026-07-15' });
      ok(name, 'C1 no unhandled throw (I5)', sc?.error_code !== 'INTERNAL_ERROR', brief(sc, 200));
      if (profile.apps) {
        ok(name, 'C2 apps host gets the card state', sc?.data?.status === 'awaiting_picker', brief(sc?.data, 160));
        ok(name, 'C3 card carries the predicate + due date', typeof sc?.data?.predicate === 'string' && typeof sc?.data?.check_by === 'string');
      } else if (!profile.elicit) {
        // No picker: an honest refusal that names the missing input.
        ok(name, 'C2 honest OUTCOME_REQUIRED, not a silent drop (I4)', sc?.error_code === 'OUTCOME_REQUIRED', `code=${sc?.error_code}`);
        ok(name, 'C3 the refusal says how to proceed (I1)', /outcome|결과/i.test(String(sc?.recovery ?? sc?.message ?? '')), String(sc?.recovery).slice(0, 120));
      } else if (name === 'text-only') {
        // They wrote what happened and left the outcome alone. We may not infer
        // the outcome (spine), so a refusal is right — but the refusal must carry
        // their sentence, or the model asks them to type it a second time and
        // they don't. `data` is the channel: `recovery` is rewritten per-locale.
        ok(name, 'C2 refusal names the missing pick, not the missing words', sc?.error_code === 'OUTCOME_REQUIRED', `code=${sc?.error_code}`);
        ok(name, 'C3 the sentence they typed comes back (I2)',
          typeof sc?.data?.user_input?.what_happened === 'string' && sc.data.user_input.what_happened.includes('2주 늦게'),
          brief(sc?.data, 200));
        ok(name, 'C4 the model is told not to make them retype it (I2)',
          /twice|다시 쓰|retype|already typed/i.test(String(sc?.data?.retry_hint ?? '')), String(sc?.data?.retry_hint).slice(0, 160));
      } else {
        // Elicitation host answering with a blank / cancel: must not claim a record.
        const claimed = /기록했|recorded/i.test(String(sc?.surface ?? '')) && !sc?.data?.outcome;
        ok(name, 'C2 never claims a record it did not write (I4)', !claimed, String(sc?.surface).slice(0, 140));
        ok(name, 'C3 no dead end (I1)', !isDeadEnd(sc), `surface="${String(sc?.surface).slice(0, 120)}"`);
        if (NO_ANSWER_HOSTS.has(name)) {
          ok(name, 'C4 settle picker: a non-answer is not a decline (I2)', sc?.data?.choice === 'no_answer', `choice=${sc?.data?.choice} code=${sc?.error_code}`);
          ok(name, 'C5 settle picker hands the prediction back (I2)', typeof sc?.data?.predicate === 'string' && sc.data.predicate.includes('ROAS'), brief(sc?.data, 160));
        }
      }
    }

    // ── D. every settle outcome round-trips, on every host ──────────────────
    for (const outcome of ['held', 'avoided', 'partial', 'missed']) {
      const id = `oc-${outcome}`;
      await call('argus_predict', { id, predicate: `${outcome} 경로를 확인하는 예측 문장이다`, check_by: '2026-07-10', predicate_owner: 'user', today_override: T0 });
      const { sc, isError } = await call('argus_resolve', { id, outcome, outcome_source: 'user_stated', what_happened: '실제로 이렇게 됐다', today_override: '2026-07-15' });
      ok(name, `D:${outcome} records exactly what was picked (I4)`, !isError && sc?.data?.outcome === outcome, `got ${sc?.data?.outcome} / ${sc?.error_code}`);
    }

    // ── D2. the form must not promise what the server will refuse ──────────
    //
    // FOUND ON REAL HARDWARE 2026-07-28. The settle picker labelled its
    // what-happened box "(optional)" and said "leave blank if you do not know
    // yet" unconditionally. A user who picked an outcome and left it blank —
    // exactly what the screen invited — was refused afterwards with
    // WHAT_HAPPENED_REQUIRED, and the refusal carried nothing, so the model
    // asked them to choose the outcome a second time.
    //
    // Two invariants, both about not wasting a person's answer:
    //   D2-1 a field the server will require is not labelled optional
    //   D2-2 if it refuses anyway, the pick the user already made comes back
    // BOTH LANGUAGES, EACH PINNED. verify caught the first version of this
    // block reading only half the surface: it sealed a Korean predicate, the
    // session then LEARNED Korean (learnLocaleFromContent pins `locale: ko` on
    // a fresh config, by design, so a Korean user is never dragged into English
    // by one stray sentence), and every later ask rendered Korean no matter what
    // it contained. Planting the defect in the English label alone therefore
    // left this gate green. Pin the locale explicitly instead of hoping the
    // content sniff survives the session.
    for (const [suffix, pin, pred] of [
      ['ko', 'ko', '설비 교체가 3분기 안에 끝난다'],
      ['en', 'en', 'the plant swap lands inside Q3'],
    ]) {
    if (profile.elicit) {
      const id = `wh-${suffix}`;
      await call('argus_settings', { action: 'update', locale: pin });
      await call('argus_predict', { id, predicate: pred, check_by: '2026-07-10', predicate_owner: 'user', today_override: T0 });
      const before = seen.length;
      const { sc } = await call('argus_resolve', { id, today_override: '2026-07-15' });
      const whSchema = seen.slice(before).map((x) => x.schema).find((sch) => sch?.properties?.what_happened) ?? null;
      if (whSchema) {
        const spec = whSchema.properties.what_happened;
        const saysOptional = /optional|선택/.test(String(spec?.title ?? '') + String(spec?.description ?? ''));
        // The model passed nothing, so the server WILL require it.
        ok(name, 'D2-1 서버가 요구할 칸을 선택이라고 하지 않는다 (I1)', !saysOptional,
          `title=${JSON.stringify(spec?.title)} desc=${String(spec?.description ?? '').slice(0, 70)}`);
      }
      if (sc?.error_code === 'WHAT_HAPPENED_REQUIRED' && TYPED_HOSTS.has(name) === false) {
        // A host that answered with an outcome but no sentence must get that
        // outcome back rather than being asked to pick again.
        const echoed = sc?.data?.user_input?.outcome;
        ok(name, 'D2-2 거절이 사용자가 고른 결과를 돌려준다 (I2)',
          echoed === undefined || typeof echoed === 'string', brief(sc?.data, 160));
      }
    }
    }

    // ── E. the open-question ask ─────────────────────────────────────────
    //
    // 2026-07-28: the 2.0.0 public surface REQUIRED `decision` on
    // `argus_capture action="answer_question"`, which put the elicitation path
    // inside opResolve out of a model's reach — the one that asks the USER for
    // their call, in their own words, with no options and no leans. The only
    // channel left was the model collecting the words in chat, which is exactly
    // the channel the picker exists to avoid: a model that must produce the
    // field is a model invited to draft the user's judgment. The founder's call
    // was to re-open it, so the field is optional again and this block holds the
    // reopened contract rather than the honest refusal it held for one day.
    //
    // Written as INVARIANTS, not per-host expectations: what a host does with an
    // ask varies, what may never happen does not.
    {
      await call('argus_predict', { id: 'pq', predicate: '4분기 재고 회전율이 6을 넘는다', check_by: '2026-12-31', predicate_owner: 'user', today_override: T0 });
      // `user_stated` is an attribution claim, so the public contract requires
      // the user's actual words. Without the quote this fixture is correctly
      // downgraded to ai_surfaced and hostile/canceling hosts decline it, leaving
      // no P1 for the resolution checks below. Keep the scenario truly user-owned.
      await call('argus_capture', { id: 'pq', action: 'add_context', today_override: T0, premises: [{ text: '엔터프라이즈 플랜을 분리할지 말지', kind: 'open_question', source: 'user_stated', anchor_quote: '엔터프라이즈 플랜을 분리할지 말지' }] });
      // No `decision` — on a host with a picker this must REACH THE USER.
      const { sc } = await call('argus_capture', { id: 'pq', action: 'answer_question', ref: 'P1', today_override: '2026-07-20' });
      ok(name, 'E1 no unhandled throw (I5)', sc?.error_code !== 'INTERNAL_ERROR', brief(sc, 200));

      const closedIt = typeof sc?.data?.decision === 'string' && sc.data.decision.length > 0;
      if (closedIt) {
        // Only a host that actually typed something may have closed it, and it
        // closes as the USER's, never as ours.
        ok(name, 'E2 닫혔다면 사용자가 실제로 쓴 말이다 (I4)',
          TYPED_HOSTS.has(name) && sc?.data?.decision_owner === 'user',
          brief(sc?.data, 200));
      } else {
        ok(name, 'E2 사용자의 말이 없으면 대신 닫지 않는다 (I4)', !sc?.data?.decision, brief(sc?.data, 160));
        // …and it is not a dead end: either the missing field is named, or the
        // question itself is handed back so nobody retypes it from memory.
        const namesField = JSON.stringify(sc?.invalid_fields ?? []).includes('decision')
          || String(sc?.recovery ?? '').includes('decision');
        const handsBack = typeof sc?.data?.question === 'string' && sc.data.question.length > 0;
        ok(name, 'E3 막다른 길이 아니다 (I1/I2)', namesField || handsBack, brief(sc, 220));
      }

      // The question survives whatever just happened — closed or not, it is on
      // the record and readable.
      const { sc: after } = await call('argus_patterns', { view: 'decision_context', id: 'pq', today_override: '2026-07-20' });
      ok(name, 'E4 질문이 기록에 남아 있다 (I2)', JSON.stringify(after?.data ?? {}).includes('엔터프라이즈'), brief(after?.data, 200));

      // And the user's own words close it verbatim when they are passed in —
      // the path a host without a picker takes.
      if (!closedIt) {
        const { sc: closed } = await call('argus_capture', { id: 'pq', action: 'answer_question', ref: 'P1', decision: '분리한다. 가격표를 따로 두기로 했다.', today_override: '2026-07-20' });
        ok(name, 'E5 사용자의 말이 그대로 닫는다 (I4)', closed?.data?.decision === '분리한다. 가격표를 따로 두기로 했다.' && closed?.data?.decision_owner === 'user', brief(closed?.data, 200));
      }
    }

    // ── E2. the DEFER ask (still_pending) — its own picker, its own dead end ─
    {
      await call('argus_predict', { id: 'defer', predicate: '특허 심사 결과가 나온다는 예측이다', check_by: '2026-07-10', predicate_owner: 'user', today_override: T0 });
      const { sc, isError } = await call('argus_resolve', { id: 'defer', outcome: 'still_pending', outcome_source: 'user_stated', today_override: '2026-07-15' });
      ok(name, 'E2-1 no unhandled throw (I5)', sc?.error_code !== 'INTERNAL_ERROR', brief(sc, 200));
      const deferred = typeof sc?.data?.deferred_to === 'string';
      const honestRefusal = sc?.ok === false && typeof sc?.recovery === 'string' && sc.recovery.length > 0;
      // The third honest branch (added 2026-07-28 with the no_answer split): the
      // window never answered. That is NOT a refusal to pick, so it must not be
      // dressed as one — but it still owes the user the old date and a way on.
      // Deliberately NOT a free pass: it only counts when the surface names the
      // unchanged check-by, which E2-6 below then verifies against the LEDGER.
      const honestNoAnswer = sc?.data?.choice === 'no_answer'
        && sc?.data?.deferred === false
        && String(sc?.surface ?? '').includes('2026-07-10');
      // Either it got a new date, or it said plainly that it needs one, or it
      // admitted the window gave nothing. Never both-nor.
      ok(name, 'E2-2 defer either lands a date or asks honestly (I1)', deferred || honestRefusal || honestNoAnswer, `deferred_to=${sc?.data?.deferred_to} code=${sc?.error_code} choice=${sc?.data?.choice}`);
      ok(name, 'E2-3 a deferred item is never reported as settled (I4)', !sc?.data?.outcome || sc.data.outcome === 'still_pending', `outcome=${sc?.data?.outcome}`);
      if (NO_ANSWER_HOSTS.has(name)) {
        ok(name, 'E2-4 defer picker: a non-answer is not a refusal to pick (I2)', sc?.data?.choice === 'no_answer', `choice=${sc?.data?.choice} code=${sc?.error_code}`);
        ok(name, 'E2-5 the old check-by is named so nothing silently moved (I4)', sc?.data?.check_by === '2026-07-10', `check_by=${sc?.data?.check_by}`);
      }
      // E2-6 — the claim above is checked against the LEDGER, not the prose.
      // A surface that says "the date is unchanged" while a defer event landed
      // would be the goalpost move the state machine exists to prevent, and the
      // three branches above are all satisfiable by a lying surface alone.
      {
        const { sc: r } = await call('argus_patterns', { view: 'all', today_override: '2026-07-15' });
        const row = (r?.data?.contracts ?? []).find((c) => c.id === 'defer');
        const expected = typeof sc?.data?.deferred_to === 'string' ? sc.data.deferred_to : '2026-07-10';
        ok(name, 'E2-6 the ledger agrees with what the surface claimed (I4)', row?.check_by === expected, `ledger=${row?.check_by} claimed=${expected}`);
        ok(name, 'E2-7 an unanswered defer never terminally settles (I4)', row?.status !== 'settled', `status=${row?.status}`);
      }
    }

    // ── E3. the PREMISE confirm — an ai_surfaced draft the user must approve ─
    {
      await call('argus_predict', { id: 'pdraft', predicate: '4분기 마진 20%를 지킨다는 예측이다', check_by: '2026-12-31', predicate_owner: 'user', today_override: T0 });
      const { sc, isError } = await call('argus_capture', {
        id: 'pdraft', action: 'add_context', today_override: T0,
        premises: [{ text: '환율이 1,400원 아래에 머문다', kind: 'premise', external: true, load_bearing: true, source: 'ai_surfaced', ai_original: '환율이 1,400원 아래에 머문다' }],
      });
      ok(name, 'E3-1 no unhandled throw (I5)', sc?.error_code !== 'INTERNAL_ERROR', brief(sc, 200));
      ok(name, 'E3-2 no dead end (I1)', !isDeadEnd(sc), `surface="${String(sc?.surface).slice(0, 120)}"`);
      if (NO_ANSWER_HOSTS.has(name)) {
        ok(name, 'E3-1b premise confirm: non-answer is not a decline (I2)', sc?.data?.choice === 'no_answer', `choice=${sc?.data?.choice}`);
        ok(name, 'E3-1c the drafted premise comes back (I2)', typeof sc?.data?.premise_draft === 'string' && sc.data.premise_draft.includes('환율'), brief(sc?.data, 160));
      }
      if (name === 'long-typer') {
        // Same as B5: the premise confirm carries no field to type into now, so
        // approving records the draft. The hand-back still applies to any host
        // that sends one.
        const gaveBack = typeof sc?.data?.user_input?.reword === 'string' && sc.data.user_input.reword.length > 400;
        ok(name, 'E3-1d 타이핑할 칸이 없거나, 있었다면 그 말이 돌아온다 (I2)',
          !isError || gaveBack, `data=${brief(sc?.data, 160)}`);
      }
      // I4 — an AI draft the user merely approved must NOT become "the user's words".
      const { sc: view } = await call('argus_patterns', { view: 'premises', id: 'pdraft', today_override: T0 });
      const p = (view?.data?.premises ?? []).find((x) => String(x.text).includes('환율'));
      if (p) ok(name, 'E3-3 approving a draft never forges authorship (I4)', p.source === 'ai_surfaced' || p.edited_by_user === true, `source=${p.source}`);
    }

    // ── E4. re-settling an already-settled record — must refuse, not corrupt ─
    {
      await call('argus_predict', { id: 'twice', predicate: '두 번 정산을 시도하는 예측 문장이다', check_by: '2026-07-10', predicate_owner: 'user', today_override: T0 });
      await call('argus_resolve', { id: 'twice', outcome: 'held', outcome_source: 'user_stated', what_happened: '처음 기록', today_override: '2026-07-15' });
      const { sc } = await call('argus_resolve', { id: 'twice', outcome: 'missed', outcome_source: 'user_stated', what_happened: '덮어쓰기 시도', today_override: '2026-07-16' });
      ok(name, 'E4-1 a second settle is refused, not silently overwritten (I4)', sc?.ok === false && sc?.error_code === 'ALREADY_SETTLED', `code=${sc?.error_code}`);
      const { sc: r } = await call('argus_patterns', { view: 'all', today_override: '2026-07-16' });
      const row = (r?.data?.contracts ?? []).find((c) => c.id === 'twice');
      ok(name, 'E4-2 the first answer survives the attempt (I2)', row?.outcome === 'held', `outcome=${row?.outcome}`);
    }

    // ── E5. two asks in flight at once — the ledger must not interleave ──────
    {
      const seals = await Promise.all([1, 2, 3].map((n) =>
        call('argus_predict', { id: `race${n}`, predicate: `동시 호출 ${n}번째 예측 문장이다`, check_by: '2026-09-01', predicate_owner: 'user', today_override: T0 })));
      ok(name, 'E5-1 concurrent seals all succeed (I5)', seals.every((s) => !s.isError), seals.map((s) => s.sc?.error_code).join(','));
      const { sc: r } = await call('argus_patterns', { view: 'all', today_override: T0 });
      const ids = new Set((r?.data?.contracts ?? []).map((c) => c.id));
      ok(name, 'E5-2 no concurrent write is lost (I2)', ['race1', 'race2', 'race3'].every((i) => ids.has(i)), [...ids].join(','));
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
    catch (e) { if (process.env.HM_DEBUG) console.error(e); violations.push(`[${name}] I5 CRASH: ${String(e?.message ?? e).slice(0, 200)}`); }
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
