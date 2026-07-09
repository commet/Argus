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
  for (const name of ["argus-anchored", "argus-seen", "argus-waked", "argus-recalled"]) {
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
};
