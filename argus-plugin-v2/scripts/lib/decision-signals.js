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

module.exports = {
  configDir,
  START_PATTERNS,
  DONE_PATTERNS,
  hasStartSignal,
  hasDoneSignal,
  readTail,
  lastUserText,
  trackRecord,
  pruneMarkers,
  isIrreversible,
  isDangerousTool,
  detectSignals,
  CUE_GROUPS,
};
