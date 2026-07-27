/**
 * The settle card, ACTUALLY EXECUTED.
 *
 *   node evals/widget-runtime.mjs
 *
 * 2026-07-27, found by an adversarial audit: the card's JavaScript lives inside
 * a template string in a .ts file. TypeScript does not look inside it. No test
 * ran it. The auditor injected a bare syntax error (`var broken = ;`), a typo'd
 * tool name (`argus_resolve_TYPO`), and a guaranteed runtime throw
 * (`window.__nope.x`) — and EVERY gate stayed green, including the 185-check
 * host matrix. We shipped a widget nobody had ever executed.
 *
 * So this file is a miniature host: it parses the card out of the source, runs
 * it in a DOM-less sandbox with a scripted postMessage peer, and drives the
 * real user gestures. Anything that would throw in a browser throws here.
 *
 * Checks:
 *   W1 the script parses at all (the class the audit injected)
 *   W2 it completes the ui/initialize handshake
 *   W3 it renders the picker from an awaiting_picker tool-result
 *   W4 clicking an outcome + typing + commit calls tools/call with the RIGHT
 *      tool name and faithful arguments (the typo class)
 *   W5 the done view renders from the response — no throw (the __nope class)
 *   W6 the skip link records nothing and never calls a tool
 *   W7 "아직"(still_pending) sends defer_to, never what_happened
 *   W8 a server error response degrades to an honest line, not a crash
 */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let failures = 0;
function check(name, cond, detail) {
  if (cond) { console.log(`  ok   ${name}`); return true; }
  failures++; console.log(`  FAIL ${name}${detail ? ` — ${detail}` : ''}`);
  return false;
}

// ── extract the card exactly as the server serves it ─────────────────────────
const { SETTLE_APP_HTML } = await import(path.join(ROOT, 'dist', 'lib', 'apps-ui-html.js').replace(/\\/g, '/').replace(/^([A-Za-z]):/, 'file:///$1:'));
const scriptMatch = SETTLE_APP_HTML.match(/<script>([\s\S]*?)<\/script>/);
if (!scriptMatch) { console.log('  FAIL 카드에서 <script>를 찾지 못했다'); process.exit(1); }
const src = scriptMatch[1];

// ── a tiny DOM + a scripted host on the other end of postMessage ─────────────
function makeSandbox() {
  const posted = [];
  const listeners = [];
  const mkEl = (tag) => {
    const el = {
      tagName: tag, children: [], style: {}, _text: '', className: '', _handlers: {},
      set textContent(v) { this._text = String(v); this.children = []; },
      get textContent() { return this._text + this.children.map((c) => c.textContent).join(''); },
      set innerHTML(v) { this._text = ''; this.children = []; },
      get innerHTML() { return this.textContent; },
      appendChild(c) { this.children.push(c); return c; },
      addEventListener(ev, fn) { (this._handlers[ev] ||= []).push(fn); },
      click() { (this._handlers.click || []).forEach((f) => f()); },
      focus() {}, setAttribute() {}, classList: {
        _s: new Set(),
        add(c) { this._s.add(c); }, remove(c) { this._s.delete(c); }, contains(c) { return this._s.has(c); },
      },
      value: '', placeholder: '', type: '', min: '', disabled: false,
    };
    return el;
  };
  const byId = {};
  for (const id of ['title', 'when', 'stage', 'foot', 'sig', 'loading']) byId[id] = mkEl('div');
  const sandbox = {
    console,
    Promise, JSON, Date, Math, Object, Array, String, Number, Boolean, RegExp, Error, setTimeout, clearTimeout,
    document: {
      createElement: mkEl,
      createTextNode: (t) => { const n = mkEl('#text'); n.textContent = String(t); return n; },
      getElementById: (id) => byId[id] ?? (byId[id] = mkEl('div')),
      documentElement: { setAttribute() {} },
      addEventListener() {},
    },
    window: {
      parent: { postMessage: (m) => posted.push(m) },
      addEventListener: (ev, fn) => { if (ev === 'message') listeners.push(fn); },
    },
  };
  sandbox.window.document = sandbox.document;
  sandbox.globalThis = sandbox;
  return { sandbox, posted, listeners, byId };
}

const { sandbox, posted, listeners, byId } = makeSandbox();

// W1 — does it even parse? (the injected `var broken = ;` class)
let ranClean = true;
try {
  vm.createContext(sandbox);
  new vm.Script(src, { filename: 'settle-card.js' }).runInContext(sandbox);
} catch (e) {
  ranClean = false;
  check('W1 카드 스크립트가 파싱·실행된다', false, String(e?.message ?? e).slice(0, 160));
}
if (ranClean) check('W1 카드 스크립트가 파싱·실행된다', true);
if (!ranClean) { console.log(`\n❌ ${failures}건 — 카드가 브라우저에서 즉시 죽는다.`); process.exit(1); }

const deliver = (msg) => listeners.forEach((fn) => fn({ data: msg }));
const lastRequest = (method) => [...posted].reverse().find((m) => m.method === method);

// W2 — the handshake
const init = lastRequest('ui/initialize');
check('W2 ui/initialize 핸드셰이크를 보낸다', Boolean(init), JSON.stringify(posted).slice(0, 160));
if (init) deliver({ jsonrpc: '2.0', id: init.id, result: { protocolVersion: '2026-01-26', hostContext: { theme: 'dark' } } });

// W3 — render the picker from the awaiting state the server actually returns
deliver({ jsonrpc: '2.0', method: 'ui/notifications/tool-input', params: { arguments: { argus_dir: 'C:/x/.argus', id: 'demo' } } });
deliver({ jsonrpc: '2.0', method: 'ui/notifications/tool-result', params: {
  structuredContent: { ok: true, data: { status: 'awaiting_picker', id: 'demo', predicate: '신규 온보딩 개편으로 D7 잔존이 25%를 넘는다', check_by: '2026-07-20', days_overdue: 7, locale: 'ko' } },
} });
const stageText = byId.stage.textContent;
check('W3 예측 문장이 카드에 보인다', stageText.includes('D7 잔존'), stageText.slice(0, 120));
check('W3 다섯 개 결과 버튼이 있다', ['예측대로', '걱정 피함', '일부만', '아직', '빗나감'].every((w) => stageText.includes(w)), stageText.slice(0, 200));

// find the rendered controls
const flat = (el, out = []) => { out.push(el); el.children.forEach((c) => flat(c, out)); return out; };
const btn = (label) => flat(byId.stage).find((n) => n.tagName === 'button' && n.textContent.startsWith(label));
const textarea = () => flat(byId.stage).find((n) => n.tagName === 'textarea');
const dateInput = () => flat(byId.stage).find((n) => n.type === 'date');
const commitBtn = () => nodes.filter((n) => n.tagName === 'button').find((n) => n.classList.contains('commit') || /기록하기|그날 다시/.test(n.textContent));

// W4 — pick an outcome, type, commit → the RIGHT tool with faithful args
const held = btn('예측대로');
check('W4 결과 버튼을 클릭할 수 있다', Boolean(held));
if (held) {
  held.click();
  const ta = textarea();
  check('W4 클릭 후 서술 칸이 열린다', Boolean(ta));
  if (ta) ta.value = 'D7 잔존 27%로 마감';
  const commit = flat(byId.stage).filter((n) => n.tagName === 'button').find((n) => /기록하기/.test(n.textContent));
  check('W4 기록 버튼이 있다', Boolean(commit));
  if (commit) {
    commit.click();
    const callMsg = lastRequest('tools/call');
    check('W4 tools/call을 보낸다', Boolean(callMsg), JSON.stringify(posted.slice(-2)).slice(0, 160));
    if (callMsg) {
      // the typo class the auditor injected — the tool name must be exact
      check('W4 도구 이름이 정확하다 (오타 시 사용자 클릭이 증발)', callMsg.params?.name === 'argus_resolve', `name=${callMsg.params?.name}`);
      const args = callMsg.params?.arguments ?? {};
      check('W4 사용자가 고른 결과를 그대로 보낸다', args.outcome === 'held', JSON.stringify(args).slice(0, 160));
      check('W4 사용자가 쓴 말을 그대로 보낸다', args.what_happened === 'D7 잔존 27%로 마감', JSON.stringify(args).slice(0, 160));
      check('W4 대상 id와 저장 경로를 잃지 않는다', args.id === 'demo' && args.argus_dir === 'C:/x/.argus', JSON.stringify(args).slice(0, 160));
      // W5 — the response path must not throw (the window.__nope class)
      let threw = null;
      try { deliver({ jsonrpc: '2.0', id: callMsg.id, result: { structuredContent: { ok: true, data: { outcome: 'held', what_happened_echo: 'D7 잔존 27%로 마감', locale: 'ko' } } } }); }
      catch (e) { threw = e; }
      // the promise resolution is async — give the microtask queue a turn
      await new Promise((r) => setTimeout(r, 10));
      check('W5 응답 처리에서 예외가 나지 않는다', threw === null, String(threw?.message ?? '').slice(0, 160));
      check('W5 기록 완료 화면이 사용자의 말을 되비춘다', byId.stage.textContent.includes('D7 잔존 27%로 마감'), byId.stage.textContent.slice(0, 160));
      check('W5 매듭이 지어진 뒤에만 서명이 보인다', byId.sig.textContent.includes('⚓'), byId.sig.textContent);
    }
  }
}

// W6/W7/W8 — fresh card instances for the remaining gestures
async function freshCard(scriptSrc) {
  const s = makeSandbox();
  vm.createContext(s.sandbox);
  new vm.Script(scriptSrc, { filename: 'settle-card.js' }).runInContext(s.sandbox);
  const d = (m) => s.listeners.forEach((fn) => fn({ data: m }));
  const initReq = [...s.posted].reverse().find((m) => m.method === 'ui/initialize');
  if (initReq) d({ jsonrpc: '2.0', id: initReq.id, result: { hostContext: { theme: 'dark' } } });
  d({ jsonrpc: '2.0', method: 'ui/notifications/tool-input', params: { arguments: { argus_dir: 'C:/x/.argus', id: 'demo' } } });
  d({ jsonrpc: '2.0', method: 'ui/notifications/tool-result', params: { structuredContent: { ok: true, data: { status: 'awaiting_picker', id: 'demo', predicate: '테스트 예측', check_by: '2026-07-20', days_overdue: 3, locale: 'ko' } } } });
  return { ...s, deliver: d, nodes: () => flat(s.byId.stage) };
}

{ // W6 — skip records nothing
  const c = await freshCard(src);
  const before = c.posted.filter((m) => m.method === 'tools/call').length;
  const skip = c.nodes().find((n) => n.tagName === 'a');
  check('W6 넘어가기 링크가 있다', Boolean(skip));
  if (skip) {
    skip.click();
    const after = c.posted.filter((m) => m.method === 'tools/call').length;
    check('W6 넘어가면 아무것도 기록하지 않는다', after === before, `calls ${before}→${after}`);
    check('W6 넘어갔다고 말해준다', /넘어갔|조르지/.test(c.byId.stage.textContent), c.byId.stage.textContent.slice(0, 100));
  }
}

{ // W7 — "아직" sends a date, never a what-happened
  const c = await freshCard(src);
  const later = c.nodes().find((n) => n.tagName === 'button' && n.textContent.startsWith('아직'));
  check('W7 아직 버튼이 있다', Boolean(later));
  if (later) {
    later.click();
    const commit = flat(c.byId.stage).filter((n) => n.tagName === 'button').find((n) => /그날 다시/.test(n.textContent));
    check('W7 연기 확인 버튼으로 바뀐다', Boolean(commit), flat(c.byId.stage).filter((n) => n.tagName === 'button').map((n) => n.textContent).join('|'));
    if (commit) {
      commit.click();
      const m = [...c.posted].reverse().find((x) => x.method === 'tools/call');
      const args = m?.params?.arguments ?? {};
      check('W7 still_pending으로 보낸다', args.outcome === 'still_pending', JSON.stringify(args).slice(0, 140));
      check('W7 미래 날짜를 함께 보낸다', typeof args.defer_to === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(args.defer_to), JSON.stringify(args).slice(0, 140));
      check('W7 연기에는 실제-결과 서술을 넣지 않는다', args.what_happened === undefined, JSON.stringify(args).slice(0, 140));
    }
  }
}

{ // W8 — a server refusal degrades honestly instead of crashing
  const c = await freshCard(src);
  const held2 = c.nodes().find((n) => n.tagName === 'button' && n.textContent.startsWith('예측대로'));
  if (held2) {
    held2.click();
    const ta = flat(c.byId.stage).find((n) => n.tagName === 'textarea');
    if (ta) ta.value = '뭔가 있었다';
    const commit = flat(c.byId.stage).filter((n) => n.tagName === 'button').find((n) => /기록하기/.test(n.textContent));
    if (commit) {
      commit.click();
      const m = [...c.posted].reverse().find((x) => x.method === 'tools/call');
      let threw = null;
      try { c.deliver({ jsonrpc: '2.0', id: m.id, result: { structuredContent: { ok: false, error_code: 'ALREADY_SETTLED', message: '이미 정산됨' } } }); }
      catch (e) { threw = e; }
      await new Promise((r) => setTimeout(r, 10));
      check('W8 서버 거절에도 카드가 죽지 않는다', threw === null, String(threw?.message ?? '').slice(0, 140));
      check('W8 거절을 사용자에게 정직하게 말한다', /기록하지 못했|대화로/.test(c.byId.stage.textContent), c.byId.stage.textContent.slice(0, 140));
    }
  }
}

console.log(failures === 0
  ? '\n✅ 정산 카드가 실제로 실행되고, 모든 사용자 제스처가 서버에 정확히 닿는다.'
  : `\n❌ ${failures}건 — 카드가 사용자 손에서 이렇게 깨진다.`);
process.exit(failures === 0 ? 0 : 1);
