/**
 * WOULD CLAUDE CODE'S FORM ACTUALLY SUBMIT THIS? — its own rules, not ours.
 *
 *   node evals/claude-code-form.mjs
 *
 * WHY (2026-07-28). "Accept does not work" was reported three times. Twice it
 * was fixed as a schema problem (`required`, then `format`) by reasoning about
 * what a strict host "would" do. Reasoning is how we got it wrong twice, so
 * this file does not reason: it reimplements the actual submit gate read out of
 * the shipped Claude Code binary (v2.1.220), and runs every ask we send through
 * it.
 *
 * The gate, verbatim from the bundle:
 *
 *     if (key === "return" && selected === "accept") {
 *       if (he() && Object.keys(errors).length === 0) respond("accept", values)
 *       else { for (const k of schema.required ?? []) if (values[k] === undefined)
 *                setError(k, "This field is required")
 *              jump to the first offending field }
 *     }
 *     function he() {                       // every required field must be filled
 *       for (const k of schema.required ?? []) {
 *         const v = values[k]
 *         if (v === undefined || v === null || v === "") return false
 *         if (Array.isArray(v) && v.length === 0) return false
 *       }
 *       return true
 *     }
 *
 * and two facts about the initial state that decide whether Accept is even
 * reachable:
 *
 *     const hasFields = Object.keys(schema.properties).length > 0
 *     const [selected] = useState(hasFields ? null : "accept")   // NOT preselected
 *     const [errors] = useState(() => {                          // seeded from defaults
 *       for (const [k, spec] of Object.entries(schema.properties))
 *         if (isTextual(spec) && spec.default !== undefined) {
 *           const r = validate(String(spec.default), spec)
 *           if (!r.isValid) errors[k] = r.error
 *         }
 *     })
 *
 * So an ask is unsubmittable-as-written when it declares `required`, or when a
 * `default` it ships fails that field's own schema. Both are invisible to a
 * server-side test that answers instantly — which is exactly how they shipped.
 *
 * F1 no ask declares `required` (nothing is unanswerable)
 * F2 no `default` fails its own field's validation (no pre-seeded error)
 * F3 Accept-as-written submits: he() is true and the error map is empty
 * F4 every field is reachable — a type the form cannot render is a dead row
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
const DIST = process.env.CC_FORM_TARGET ?? path.join(ROOT, 'dist', 'index.js');
if (process.env.CC_FORM_SKIP_BUILD !== '1' && !process.env.CC_FORM_TARGET) {
  execSync('npm run build', { cwd: ROOT, stdio: 'ignore' });
}

/** Fields whose VALUE is the answer — an Accept alone cannot supply them. */
const COLLECT_FIELDS = ['outcome', 'what_happened', 'when', 'decision'];

/** schema -> the message shown with it, so F5 can read the instructions. */
const messages = new Map();

const violations = [];
let checks = 0;
const ok = (id, cond, detail) => {
  checks++;
  if (!cond) violations.push(`${id}: ${String(detail ?? '').slice(0, 190)}`);
  return cond;
};

// ── Claude Code's own form logic, transcribed ────────────────────────────────

/** `DMe` in the bundle: a string with enum/oneOf renders as a select. */
const isSelect = (s) => s?.type === 'string' && ('enum' in s || 'oneOf' in s);
/** `kDr`: the textual kinds the form edits with a text input. */
const isTextual = (s) => !isSelect(s) && (s?.type === 'string' || s?.type === 'number' || s?.type === 'integer' || s?.type === undefined);
const isBoolean = (s) => s?.type === 'boolean';
const isMulti = (s) => s?.type === 'array';

/** `yRn`: validate a raw string against the field schema. The bundle builds a
 *  zod schema from the JSON Schema; the constraints that can actually fail a
 *  well-formed default are these. */
function validateValue(raw, spec) {
  const s = String(raw);
  if (spec?.type === 'number' || spec?.type === 'integer') {
    if (!/^-?\d+(\.\d+)?$/.test(s.trim())) return { isValid: false, error: 'Expected number' };
    const n = Number(s);
    if (spec.type === 'integer' && !Number.isInteger(n)) return { isValid: false, error: 'Expected integer' };
    if (spec.minimum !== undefined && n < spec.minimum) return { isValid: false, error: `>= ${spec.minimum}` };
    if (spec.maximum !== undefined && n > spec.maximum) return { isValid: false, error: `<= ${spec.maximum}` };
    return { isValid: true, value: n };
  }
  if (spec?.minLength !== undefined && s.length < spec.minLength) return { isValid: false, error: `min length ${spec.minLength}` };
  if (spec?.maxLength !== undefined && s.length > spec.maxLength) return { isValid: false, error: `max length ${spec.maxLength}` };
  if (spec?.pattern !== undefined) {
    let re;
    try { re = new RegExp(spec.pattern); } catch { return { isValid: false, error: 'bad pattern' }; }
    if (!re.test(s)) return { isValid: false, error: `pattern ${spec.pattern}` };
  }
  if (spec?.format === 'date' && !/^\d{4}-\d{2}-\d{2}$/.test(s)) return { isValid: false, error: 'Expected date' };
  return { isValid: true, value: s };
}

/**
 * Reproduce the KEY SEQUENCE, not just the schema.
 *
 * The decisive fact, also from the bundle:
 *
 *     const [selected] = useState(hasFields ? null : "accept")
 *     const editing = current !== undefined && isTextual(current.schema)
 *                     && !isSelect(current.schema) && !selected
 *     if (editing && key !== up/down/return/backspace) return
 *     handleTextInputSubmit = () => move("down")        // Return in a text box MOVES
 *
 * So when an ask declares any field, Accept is NOT preselected: the cursor sits
 * in the first input, and Return there advances instead of submitting. The user
 * must arrow past every field to reach Accept. Press Return in the box and
 * nothing is sent — the dialog just sits until the request times out, which is
 * exactly the founder log (a "cancel" arriving at 60.018s that nobody pressed).
 *
 * pressesToSubmit() counts how many Returns it takes from mount. 1 means the
 * obvious gesture works; more means the user has to discover the navigation.
 */
function pressesToSubmit(schema) {
  const props = schema?.properties ?? {};
  const n = Object.keys(props).length;
  // rows: every field, then Accept, then Decline
  if (n === 0) return 1;            // selected === "accept" at mount
  return n + 1;                     // one Return per field to move, then one on Accept
}

/** Reproduce mount state, then press Accept without touching anything. */
function wouldSubmit(schema) {
  const props = schema?.properties ?? {};
  const required = schema?.required ?? [];

  // initial values: only `default`s are pre-filled
  const values = {};
  for (const [k, spec] of Object.entries(props)) {
    if (spec && typeof spec === 'object' && spec.default !== undefined) values[k] = spec.default;
  }
  // initial errors: seeded from defaults that fail their own field
  const errors = {};
  for (const [k, spec] of Object.entries(props)) {
    if (isTextual(spec) && spec?.default !== undefined) {
      const r = validateValue(String(spec.default), spec);
      if (!r.isValid) errors[k] = r.error;
    }
  }
  // he()
  let heOk = true;
  for (const k of required) {
    const v = values[k];
    if (v === undefined || v === null || v === '') { heOk = false; break; }
    if (Array.isArray(v) && v.length === 0) { heOk = false; break; }
  }
  return { submits: heOk && Object.keys(errors).length === 0, heOk, errors, required, values };
}

// ── drive the real server and capture every ask ──────────────────────────────

const SHAPES = {
  plain: '광고 ROAS가 7월 안에 300%를 회복한다',
  long: '다음 분기까지 운영원이 매일 손으로 그리던 표를 자동 생성본으로 대체하고, 그 결과로 하루 두 시간 이상 걸리던 반복 노동이 십 분 안쪽으로 줄어들며, 운영원이 엑셀을 열지 않고도 확인창만으로 하루를 시작하게 된다고 본다',
};

async function collect(locale, predicate) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ccform-'));
  const env = { ...process.env, ARGUS_DIR: dir, NODE_ENV: 'test', ARGUS_AMBIENT_DELAY_MS: '40', ARGUS_AMBIENT_ASK_TIMEOUT_MS: '4000' };
  delete env.ARGUS_TOKEN;
  const seen = [];
  const client = new Client({ name: 'ccform', version: '1' }, { capabilities: { elicitation: {} } });
  client.setRequestHandler(ElicitRequestSchema, async (req) => {
    seen.push(req.params.requestedSchema);
    messages.set(req.params.requestedSchema, req.params.message);
    return { action: 'decline' };
  });
  await client.connect(new StdioClientTransport({ command: process.execPath, args: [DIST], env }));
  const call = async (n, a) => {
    try { return (await client.callTool({ name: n, arguments: { argus_dir: dir, ...a } }, undefined, { timeout: 30_000 })).structuredContent ?? {}; }
    catch { return {}; }
  };
  await call('argus_settings', { action: 'update', locale });
  await call('argus_predict', { id: 'a', predicate, check_by: '2026-08-20', predicate_owner: 'ai_surfaced', confirm_draft: true, today_override: '2026-07-02' });
  await call('argus_predict', { id: 'b', predicate: '4분기 마진 20%를 지킨다는 예측이다', check_by: '2026-12-31', predicate_owner: 'user', today_override: '2026-07-02' });
  await call('argus_capture', { id: 'b', action: 'add_context', today_override: '2026-07-02', premises: [{ text: predicate.slice(0, 380), kind: 'premise', external: true, load_bearing: true, source: 'ai_surfaced', ai_original: predicate.slice(0, 380) }] });
  await call('argus_predict', { id: 'c', predicate, check_by: '2026-07-10', predicate_owner: 'user', today_override: '2026-07-02' });
  await call('argus_resolve', { id: 'c', outcome_source: 'user_stated', today_override: '2026-07-15' });
  await call('argus_predict', { id: 'd', predicate, check_by: '2026-07-10', predicate_owner: 'user', today_override: '2026-07-02' });
  await call('argus_resolve', { id: 'd', outcome: 'still_pending', outcome_source: 'user_stated', today_override: '2026-07-15' });
  // the open-question ask, reachable again since 2.0.4
  await call('argus_predict', { id: 'e', predicate, check_by: '2026-12-31', predicate_owner: 'user', today_override: '2026-07-02' });
  await call('argus_capture', { id: 'e', action: 'add_context', today_override: '2026-07-02', premises: [{ text: '엔터프라이즈 플랜을 분리할지 말지', kind: 'open_question', source: 'user_stated' }] });
  await call('argus_capture', { id: 'e', action: 'answer_question', ref: 'P1', today_override: '2026-07-20' });
  await call('argus_patterns', { view: 'all', today_override: '2026-07-20' });
  await new Promise((r) => setTimeout(r, 1200));
  await client.close();
  fs.rmSync(dir, { recursive: true, force: true });
  return seen;
}

let total = 0;
for (const locale of ['ko', 'en']) {
  for (const [shape, predicate] of Object.entries(SHAPES)) {
    const schemas = await collect(locale, predicate);
    ok(`[${locale}/${shape}] 픽커가 떴다`, schemas.length > 0, `${schemas.length}개`);
    for (const schema of schemas) {
      total++;
      const props = schema?.properties ?? {};
      const keys = Object.keys(props);
      const w = `[${locale}/${shape}/${keys.join('+') || 'empty'}]`;
      const r = wouldSubmit(schema);

      ok(`${w} F1 required 없음`, (schema?.required ?? []).length === 0, JSON.stringify(schema?.required));
      ok(`${w} F2 default가 자기 검증을 통과한다`, Object.keys(r.errors).length === 0, JSON.stringify(r.errors));
      ok(`${w} F3 그대로 Accept가 제출된다`, r.submits,
        `he=${r.heOk} errors=${JSON.stringify(r.errors)} required=${JSON.stringify(r.required)}`);
      // F5 — the gesture, not the schema. The one all three previous "Accept
      // does not work" fixes missed.
      //
      // Two kinds of ask, and only one of them can be at fault:
      //
      //   A CONFIRMATION ("is this your sentence?") answers itself with
      //   Accept/Decline. Any field it declares is optional convenience, and
      //   declaring one costs the user a keypress nobody told them about while
      //   making a bare Return do nothing at all. Those must ship with no
      //   properties — one Return records it.
      //
      //   A COLLECTION ("what did reality do?", "what is your call?") IS the
      //   field; the answer cannot come from Accept alone. The extra keystrokes
      //   are inherent, so the requirement is that the ask SAYS so. A user who
      //   knows to press Enter twice is fine; one who does not is stuck at a
      //   dialog that silently ignores the obvious gesture.
      const presses = pressesToSubmit(schema);
      const isCollection = COLLECT_FIELDS.some((k) => keys.includes(k));
      if (!isCollection) {
        ok(`${w} F5 확인 픽커는 Return 한 번으로 제출된다`, presses === 1,
          `Return ${presses}번 필요 (입력칸 ${keys.length}개: ${keys.join(',')}) — 확인만 받는 픽커는 입력칸을 두지 않습니다`);
      } else {
        // Match the INSTRUCTION, not one phrasing of it — twice learned now.
        // The first version looked for the literal "Enter twice", so improving
        // the Korean copy turned the gate red while the screen got BETTER. The
        // second version accepted only Claude Code's keyboard choreography
        // ("아래 화살표로 수락 줄까지"), which is the OPPOSITE failure: it held
        // the copy to one host's controls, and a Codex user reading a rendered
        // form was told to press keys that do not exist there.
        //
        // What must be true on every host is the fact underneath: choosing is
        // not yet saving, and the answer lands at Accept. So require a phrase
        // that points onward to Accept — not the bare word, which every ask
        // contains, but a continuation to it.
        const msg = String(messages.get(schema) ?? '');
        const tells = /Accept까지|continue to Accept|수락 줄|화살표로|arrow (down|to)|Enter를 두 번|Enter twice/.test(msg);
        ok(`${w} F5 수집 픽커는 제출 방법을 알려준다`, tells,
          `Return ${presses}번 필요한데 안내가 없습니다: ${msg.replace(/\s+/g, ' ').slice(0, 110)}`);
      }
      for (const [k, spec] of Object.entries(props)) {
        ok(`${w}.${k} F4 폼이 그릴 수 있는 타입`,
          isTextual(spec) || isSelect(spec) || isBoolean(spec) || isMulti(spec), JSON.stringify(spec).slice(0, 90));
      }
    }
  }
}

const label = `${checks} checks · ${violations.length} violations · 픽커 ${total}개`;
if (violations.length) {
  console.error(`\n❌ ${label}\n`);
  for (const v of violations.slice(0, 30)) console.error('  ' + v);
  console.error('\nClaude Code의 실제 제출 게이트(v2.1.220)로 판정했습니다. 위 항목은 사용자가 Accept를 눌러도 폼이 제출하지 않습니다.');
  process.exit(1);
}
console.log(`✅ ${label} — Claude Code 폼 규칙으로 전부 그대로 Accept 제출됩니다.`);
