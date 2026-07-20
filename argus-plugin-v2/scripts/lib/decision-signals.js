/**
 * Shared Layer-1 decision-signal helpers for the anchor-as-switch hooks
 * (anchor-signal / wake-signal / recall-signal). Single source for the cheap,
 * deterministic grep patterns and transcript reading — NO LLM here (that is the
 * main-agent delegation, §12.5). Design: internal design notes
 *
 * Conservative on purpose: better to miss a weak signal (the user can still
 * invoke /argus) than to over-fire (mirror clause). Layer 2 (the main agent)
 * widens precision; these patterns only gate whether to delegate at all.
 */
const fs = require("fs");
const path = require("path");
const os = require("os");

// Claude Code's user config dir; CLAUDE_CONFIG_DIR overrides ~/.claude.
function configDir() {
  return process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), ".claude");
}

// START — the user is OPENING a weigh-up ("할까/말까", "A vs B"). → anchor.
const START_PATTERNS = [
  /할까\s*말까/,
  /(말까|할까)\s*(고민|고민이|싶|망설)/,
  /어느\s*쪽.{0,12}(나을까|좋을까|맞을까|할까|갈까|할지|골라|선택|나아)/,
  /둘\s*중.{0,12}(뭐|무엇|어느|하나|골라|선택|나아|나을까|좋을까)/,
  /(결정|선택)(을|해야|하기|이|할지)/,
  /(가는|하는)\s*게\s*(맞을까|나을까|좋을까)/,
  /(해야\s*할지|말지)/,
  /\bshould\s+i\b/i,
  /\bwhich\s+(one|option|way|approach)\b/i,
  /\bdecide\s+(between|whether)\b/i,
  /\b(\w[\w./-]*)\s+vs\.?\s+(\w)/i,
  /\btrade[\s-]?offs?\b/i,
  /\bweigh(ing)?\s+(up|the\s+options)\b/i,
];

// COMPLETION — the user just CLOSED on a choice ("그걸로 가자", "decided to"). → wake.
const DONE_PATTERNS = [
  /(그걸로|이걸로|그쪽으로|이쪽으로|저쪽으로)\s*(하자|가자|할게|할래|하기로|진행|간다|갈게)/,
  /(그렇게|이렇게)\s*하자/,
  /(정했|결정했|결정함|하기로\s*했|가는\s*걸로|진행하자)/,
  /(으로|로)\s*(가자|하자|결정|확정)/,
  /\blet'?s\s+go\s+with\b/i,
  /\b(going|i'?ll\s+go)\s+with\b/i,
  /\bdecided\s+(to|on)\b/i,
  /\b(settle|settled)\s+on\b/i,
  /\bgo\s+with\s+(it|that|this|the)\b/i,
];

function hasStartSignal(text) {
  if (typeof text !== "string" || text.length < 8) return false;
  return START_PATTERNS.some((re) => re.test(text));
}
function hasDoneSignal(text) {
  if (typeof text !== "string" || text.length < 6) return false;
  return DONE_PATTERNS.some((re) => re.test(text));
}

// Read only the TAIL of a transcript (decisions close at the end; reading the
// whole JSONL of a long session would be wasteful). Returns "" on any error.
function readTail(p, maxBytes) {
  let fd;
  try {
    fd = fs.openSync(p, "r");
    const { size } = fs.fstatSync(fd);
    const start = Math.max(0, size - maxBytes);
    const len = size - start;
    const buf = Buffer.alloc(len);
    // Use the actual byte count — a short read would otherwise leave NUL padding
    // that corrupts the trailing line.
    const n = fs.readSync(fd, buf, 0, len, start);
    return { text: buf.subarray(0, n).toString("utf8"), partial: start > 0 };
  } catch {
    return { text: "", partial: false };
  } finally {
    if (fd !== undefined) try { fs.closeSync(fd); } catch {}
  }
}

// The most recent REAL assistant utterance in a transcript tail (text blocks
// only — tool_use noise dropped). Returns "" if none found. This is what lets a
// hook's scan window cover BOTH sides of the conversation: assumptions and
// predictions surface in the assistant's answer as much as in the user's ask
// (2026-07-20 근원 분석 §3.3 — "진단 시점이 반쪽"의 수리).
function lastAssistantText(tail, partial) {
  const lines = tail.split("\n");
  if (partial && lines.length) lines.shift(); // drop the (likely broken) first line
  for (let i = lines.length - 1; i >= 0; i--) {
    const ln = lines[i].trim();
    if (!ln) continue;
    let o;
    try { o = JSON.parse(ln); } catch { continue; }
    const role = o.type || (o.message && o.message.role);
    if (role !== "assistant") continue;
    const c = o.message ? o.message.content : o.content;
    const txt = (typeof c === "string"
      ? c
      : Array.isArray(c) ? c.filter((x) => x && x.type === "text").map((x) => x.text).join(" ") : ""
    ).trim();
    if (txt) return txt;
  }
  return "";
}

// The most recent REAL user utterance in a transcript tail (skip tool_results,
// meta lines, slash-commands). Returns "" if none found.
function lastUserText(tail, partial) {
  const lines = tail.split("\n");
  if (partial && lines.length) lines.shift(); // drop the (likely broken) first line
  for (let i = lines.length - 1; i >= 0; i--) {
    const ln = lines[i].trim();
    if (!ln) continue;
    let o;
    try { o = JSON.parse(ln); } catch { continue; }
    const role = o.type || (o.message && o.message.role);
    if (role !== "user" || o.isMeta) continue;
    const c = o.message ? o.message.content : o.content;
    let txt = typeof c === "string"
      ? c
      : Array.isArray(c) ? c.filter((x) => x && x.type === "text").map((x) => x.text).join(" ") : "";
    txt = (txt || "").trim();
    if (!txt) continue;
    if (/^<(command|local-command|user-prompt|system)/i.test(txt)) continue;
    return txt;
  }
  return "";
}

// Self-improvement loop (§13 loop): replay the LOCAL ledger to a track record so a
// past settlement can feed the next decision. Counts only — sealed/settled/held/luck —
// NEVER a tier or verdict (spine: meaning-language is sample-size-scaled frequency, not
// a score). Returns null if no ledger / unreadable. cwd is the project dir holding .argus.
function trackRecord(cwd) {
  if (!cwd) return null;
  let raw;
  try { raw = fs.readFileSync(path.join(cwd, ".argus", "ledger", "ledger.jsonl"), "utf8"); }
  catch { return null; }
  const st = new Map();
  for (const line of raw.split("\n")) {
    if (!line.trim()) continue;
    let e;
    try { e = JSON.parse(line); } catch { continue; }
    if (!e.id) continue;
    if (e.event === "seal") { if (!st.has(e.id)) st.set(e.id, { settled: false, outcome: null, basis: null }); }
    else if (e.event === "settle") {
      const c = st.get(e.id) || { settled: false };
      c.settled = true; c.outcome = e.outcome; c.basis = e.basis; st.set(e.id, c);
    } else if (e.event === "dismiss") { st.delete(e.id); }
  }
  let sealed = 0, settled = 0, held = 0, luck = 0;
  for (const c of st.values()) {
    sealed++;
    if (c.settled) {
      settled++;
      // luck counts ONLY among held bets, so "held on luck" is a true statement
      // (an avoided/did-not-hold bet is not a hold, regardless of basis).
      if (c.outcome === "happened") { held++; if (c.basis === "luck") luck++; }
    }
  }
  return { sealed, settled, held, luck };
}

// Opportunistic cleanup so the per-session marker dirs don't grow forever. Called once
// from the SessionStart hook (recall). mtime-based; every failure is ignored (best-effort).
function pruneMarkers(maxAgeMs) {
  const base = configDir();
  const cutoff = Date.now() - maxAgeMs;
  for (const name of ["argus-anchored", "argus-seen", "argus-waked", "argus-recalled", "argus-sensed"]) {
    const dir = path.join(base, name);
    let entries;
    try { entries = fs.readdirSync(dir); } catch { continue; }
    for (const e of entries) {
      const p = path.join(dir, e);
      try { if (fs.statSync(p).mtimeMs < cutoff) fs.unlinkSync(p); } catch {}
    }
  }
}

// helm's keel scan as a deterministic pre-flight (keel-signal, PreToolUse): operations
// reality will later judge and that can't be cheaply undone. Conservative — clearly
// destructive only, so routine Bash (status/test/commit/push) stays silent.
const IRREVERSIBLE_PATTERNS = [
  /\bgit\s+push\b[^\n]*(--force\b|--force-with-lease\b|(?:^|\s)-f\b)/,
  /\bgit\s+push\b[^\n]*\s:\S/,                // push :branch (delete a remote branch)
  /\bgit\s+reset\s+--hard\b/,
  /\brm\s+-[rf]{1,2}\b/,
  /\b(drop|truncate)\s+(table|database|schema)\b/i,
  /\bdelete\s+from\b/i,
  /\bmigrat\w*\s+(up|deploy|run|dev)\b/i,
  /\b(vercel|netlify|wrangler|flyctl|fly)\s+deploy\b/i,
  /\bsupabase\s+(db\s+push|functions\s+deploy|migration\s+up)\b/i,
];
function isIrreversible(cmd) {
  if (typeof cmd !== "string") return false;
  return IRREVERSIBLE_PATTERNS.some((re) => re.test(cmd));
}
const DANGEROUS_TOOLS = ["apply_migration", "deploy_edge_function", "delete_branch", "pause_project", "restore_project"];
function isDangerousTool(name) {
  if (typeof name !== "string") return false;
  return DANGEROUS_TOOLS.some((t) => name === t || name.endsWith("_" + t) || name.endsWith("__" + t));
}

/* ─────────────────────────────────────────────────────────────────────────────
 * Layer-2 deterministic signal detection — the CJS mirror of
 * argus-mcp/src/lib/detect-signals.ts. Kept verbatim-identical in patterns; a
 * behavioral drift guard (argus-mcp detect-signals-drift.test) runs BOTH over a
 * shared corpus and fails CI if they diverge. Widens the anchor hooks from
 * "decision START only" to the three senses Argus lives on: a passing
 * prediction, a surfacing outcome, a load-bearing assumption. NO LLM — rules a
 * test can pin (the whole point: plausible cannot masquerade as correct).
 * Spine: HIGH-RECALL here; restraint is the firing gate's job (max detect, min fire).
 * ──────────────────────────────────────────────────────────────────────────── */
const FUTURE = [
  /\bwill\b/i, /\bwon'?t\b/i, /\bgoing to\b/i, /\bgonna\b/i, /\bshall\b/i,
  /\bexpect(s|ed|ing)?\b/i, /\bshould\b/i, /\blikely\b/i, /\bplan(ning)? to\b/i,
  /\bby (mon|tue|wed|thu|fri|sat|sun)\w*/i,
  /\bby (jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\w*/i,
  /\bby \d/i, /\bwithin \d+\s*(day|week|month|quarter)/i,
  /\bnext (week|month|quarter|year|sprint)\b/i,
  /(할|될|갈|낼|올|줄)\s*(것|거|게|걸)/, /하겠|되겠|시키겠/, /(ㄹ|를|을)\s*거(다|예요|야|임)/,
  /예상|전망|목표|계획|할 예정|될 예정/, /까지(는|\b|\s)/, /안에|이내(에)?/,
  /다음\s*(주|달|분기|해|스프린트)/, /(유지|달성|돌파|출시|완료)(할|될|하겠|되겠|한다|된다)/,
  /(거예요|거에요|거야|겁니다|거고|건데|건가|것으로|것입니다|것이다|것\s*같)/, /(ㄹ|을|를)\s*것\b/,
];
const MEASURABLE = [
  /\d/, /%|percent|퍼센트|프로/i, /\$|원\b|달러|억|만원|USD|KRW/i,
  /\b(faster|slower|lower|higher|cheaper|under|over|below|above|less than|more than|at least|no more than)\b/i,
  /이하|이상|미만|초과|아래|위(로)?|밑(으로)?|이내|보다\s*(빠|느|싸|비|많|적|높|낮)/,
  /\b(mon|tue|wed|thu|fri|sat|sun)\w*/i,
  /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\w*/i, /\d{4}-\d{2}-\d{2}/,
];
const COMPLETION = [
  /\b(ship|launch|release|deliver|deploy|close|hire|sign|land|finish|complete|onboard|migrate|cut over)\b/i,
  /출시|배포|출고|런칭|납품|마감|채용|계약|체결|완료|오픈|이전|전환|성사|입사|합류/,
];
const RESOLVED = [
  /\bturn(s|ed)? out\b/i, /\bended up\b/i, /\bcame in at\b/i, /\bended at\b/i,
  /\bwe (shipped|launched|missed|hit|closed|hired|signed|landed|deployed)\b/i,
  /\bit (went|held|worked|failed|slipped|held up)\b/i,
  /\bdidn'?t (happen|work|ship|hold|land)\b/i, /\b(hit|missed|beat|met) (the|our) (target|number|deadline|goal)\b/i,
  /됐(어|다|고|는데|네|음)|됐다|성사(됐|했)|끝났|출시했|배포했|이전했|전환했/,
  /안\s*(됐|나|됐어|됐다)|못\s*(했|했다|해서|이룬)|실패(했|함)|무산(됐|됨)/,
  /결국|실제로(는)?|막상|나왔(다|어|고)|나온|드러났|밝혀졌|판명/,
];
const CONDITIONAL = [
  /\bbecause\b/i, /\bsince\b/i, /\bassuming\b/i, /\bas long as\b/i, /\bdepends on\b/i,
  /\bonly if\b/i, /\bprovided that\b/i, /\bbanking on\b/i, /\bhinges? on\b/i,
  /\bcontingent on\b/i, /\bthe (key|whole thing) (is|hinges|rests|depends)\b/i,
  /니까|때문에|덕분에|탓에/, /(라|다)면\b|(으|)ㄴ다면|는다면/, /는\s*한(에서)?|한(에서만)?/,
  /(에|에게)\s*달렸|달려\s*있|전제로|가정하(면|고)|관건은|핵심은|믿고\s*있/,
];
const _any = (groups, s) => groups.some((re) => re.test(s));
const _which = (name, groups, s) => (groups.some((re) => re.test(s)) ? name : null);
function _clauses(text) {
  return text.split(/(?<=[.!?。！？])\s+|\n+/).map((c) => c.trim()).filter((c) => c.length >= 6 && c.length <= 400);
}
function _overlaps(a, b) {
  const tok = (s) => s.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").split(/\s+/).filter((t) => t.length >= 2);
  const A = tok(a), B = tok(b);
  if (A.length === 0 || B.length === 0) return false;
  let hit = 0;
  for (const x of A) { for (const y of B) { if (x === y || x.startsWith(y) || y.startsWith(x)) { hit++; break; } } }
  return hit >= 2;
}
/** Pure detector — mirror of detect-signals.ts detectSignals. */
function detectSignals(text, opts = {}) {
  if (typeof text !== "string" || text.trim().length < 6) return [];
  const openPredicates = (opts.openPredicates || []).filter((p) => typeof p === "string" && p.trim());
  const max = typeof opts.max === "number" && opts.max > 0 ? opts.max : 4;
  const out = [], seen = new Set();
  const push = (kind, span, cues) => { const k = kind + ":" + span; if (seen.has(k)) return; seen.add(k); out.push({ kind, span, cues }); };
  for (const c of _clauses(text)) {
    const future = _which("future", FUTURE, c);
    const measurable = _which("measurable", MEASURABLE, c);
    const completion = _which("completion", COMPLETION, c);
    if (future && (measurable || completion)) push("prediction", c, [future, measurable, completion].filter(Boolean));
    const conditional = _which("conditional", CONDITIONAL, c);
    if (conditional && (measurable || completion || future)) push("assumption", c, [conditional, measurable, completion, future].filter(Boolean));
    const resolved = _which("resolved", RESOLVED, c);
    if (resolved && openPredicates.some((p) => _overlaps(c, p))) push("outcome", c, [resolved, "matches-open-prediction"]);
  }
  return out.slice(0, max);
}
const CUE_GROUPS = { FUTURE, MEASURABLE, COMPLETION, RESOLVED, CONDITIONAL };

/* ─────────────────────────────────────────────────────────────────────────────
 * PREFILTER — 2026-07-20 설계 교정 §3.2의 시공. 규칙은 감지기가 될 수 없다
 * (숨은 전제는 정의상 표지가 없다). 그래서 규칙의 역할은 두 가지로 강등된다:
 *   1. 사전필터 — "이 턴에 AI 진단 지시를 주입할 가치가 있는가"만 정한다.
 *      감지가 아니라 비용 게이트다. 그래서 위 detectSignals(conjunction,
 *      정밀)와 달리 DISJUNCTION(단서 하나면 통과)으로 최대 리콜을 잡는다.
 *   2. 최저선 — detectSignals가 잡은 스팬은 AI 진단 지시에 "후보"로 동봉되어
 *      리콜의 못 흔들리는 바닥이 된다 (규칙이 잡은 걸 AI가 놓칠 수 없게).
 * 실제 감지(의미 판단·대명사 해석·숨은 전제 추출)는 주입된 지시를 받은 호스트
 * 모델이 한다 — 모델은 이미 대화 전체를 컨텍스트에 들고 있다. 훅이 주는 것은
 * 대화가 아니라 (a) 매 턴 결정론적 진단 명령, (b) 모델이 못 보는 원장 상태
 * (열린 예측 목록), (c) 규칙 후보다.
 *
 * evals/detection/의 코퍼스가 이 함수의 skip-safety를 CI에서 고정한다:
 * 라벨된 양성(예측/결과/전제/숨은 전제)을 스킵하면 CI가 빨간불이다.
 * 사전필터의 오탐(none인데 통과)은 토큰 비용일 뿐 사용자에게 안 닿는다 —
 * 발화 절제는 주입되는 지시문 자체가 (min fire 규칙으로) 진다.
 * ──────────────────────────────────────────────────────────────────────────── */

// 의도·제안 마커 — 결정이 형성되는 턴의 단서. 숨은 전제는 표지가 없지만 결정
// 자체는 대개 이런 형태로 발화된다. detectSignals의 그룹이 아니라 사전필터
// 전용이므로 TS 미러/드리프트 가드 대상이 아니다 (MCP 서버는 대화를 못 보므로
// 서버-측 사전필터는 dead wire — honest-structure 불변식대로 짓지 않는다).
const PROPOSAL = [
  /\blet'?s\b/i, /\bwe (should|could|need to|have to|might)\b/i,
  /\b(i|we)'?ll\b/i, /\bi'?m (going to|planning|thinking of)\b/i,
  /\bplan is\b/i, /\bswitch(ing)? to\b/i, /\bdrop(ping)? the\b/i, /\bpivot\b/i,
  /(하자|합시다|해야겠|해야지|해보자|해볼게|하기로|할게|할래|할까 하는데|하려고|하려 한다|할 생각)/,
  /(가자|가야겠|없애자|버리자|줄이자|늘리자|올리자|내리자|바꾸자|뽑자|미루자|접자|넣자|빼자)/,
  /(아마|어쩌면|아무래도)/, /\b(probably|might|maybe|perhaps)\b/i, /'ll\b/i,
];

/**
 * prefilterTurn — 이 턴(사용자 메시지 + 직전 어시스턴트 발화 창)에 AI 진단
 * 지시를 주입할지 정하는 고-리콜 disjunction 스캔. 순수·결정론.
 * 반환: { pass, cues } — cues는 어떤 그룹이 걸렸는지(발사 경로 선택에 쓰임).
 */
function prefilterTurn(text) {
  if (typeof text !== "string") return { pass: false, cues: [] };
  const t = text.trim();
  if (t.length < 12) return { pass: false, cues: [] }; // 초단문 — 명백한 비후보
  const groups = {
    future: FUTURE, measurable: MEASURABLE, completion: COMPLETION,
    resolved: RESOLVED, conditional: CONDITIONAL, proposal: PROPOSAL,
  };
  const cues = [];
  for (const [name, res] of Object.entries(groups)) {
    if (res.some((re) => re.test(t))) cues.push(name);
  }
  if (hasStartSignal(t)) cues.push("start");
  if (hasDoneSignal(t)) cues.push("done");
  return { pass: cues.length > 0, cues };
}

module.exports = {
  configDir,
  START_PATTERNS,
  DONE_PATTERNS,
  hasStartSignal,
  hasDoneSignal,
  readTail,
  lastUserText,
  lastAssistantText,
  prefilterTurn,
  trackRecord,
  pruneMarkers,
  isIrreversible,
  isDangerousTool,
  detectSignals,
  CUE_GROUPS,
};
