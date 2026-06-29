#!/usr/bin/env node
/**
 * Argus Stop hook — Layer-1 COMPLETION signal → wake (1차 정산) nudge.
 *
 * Design: docs/DESIGN-decision-capture-anchor-as-switch-2026-06-29.md (§12.5, §13-2/3).
 *
 * Runs every turn (Stop fires per response). To keep background token cost at ~0:
 *   GATE 1 — only sessions that were nudged to anchor (argus-anchored/<id> marker).
 *            A session with no anchor is OFF → exit immediately, zero work.
 *   GATE 2 — only once per session (argus-waked/<id> marker).
 *   NO LLM CALL. A cheap deterministic COMPLETION-signal grep over the LAST user
 *   message only (transcript tail, not the whole file). When a decision looks
 *   CLOSED, it hands the MAIN Claude agent context to draw the wake — Claude already
 *   holds the conversation, so there is NO extra API call and NO extra input tokens.
 *   (This is the "Layer 2" of §12.5, implemented as main-agent delegation, not a
 *   separate model call — the token-optimal form.)
 *
 * SPINE (do not regress):
 *  - SILENCE IS THE DEFAULT. Off session / no completion signal → print nothing.
 *  - The wake states the two points the user wrote; NO AI verdict on the move
 *    (mirror only). The nudge text enforces this.
 *  - Never asks a meta-question, never writes a ledger row itself.
 *  - Never throws, never exits non-zero — a broken hook must not tax the session.
 */

const fs = require("fs");
const path = require("path");
const os = require("os");

function configDir() {
  return process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), ".claude");
}
const anchoredMarker = (id) => path.join(configDir(), "argus-anchored", String(id));
const wakedMarker = (id) => path.join(configDir(), "argus-waked", String(id));

// ── Layer-1 COMPLETION signal — the user just CLOSED a weigh-up. Conservative. ──
const DONE_PATTERNS = [
  // Korean — landing on a choice
  /(그걸로|이걸로|그쪽으로|이쪽으로|저쪽으로)\s*(하자|가자|할게|할래|하기로|진행|간다|갈게)/,
  /(그렇게|이렇게)\s*하자/,
  /(정했|결정했|결정함|하기로\s*했|가는\s*걸로|진행하자)/,
  /(으로|로)\s*(가자|하자|결정|확정)/,
  // English — landing on a choice
  /\blet'?s\s+(go\s+with|do)\b/i,
  /\b(going|i'?ll\s+go)\s+with\b/i,
  /\bdecided\s+(to|on)\b/i,
  /\b(settle|settled)\s+on\b/i,
  /\bgo\s+with\s+(it|that|this|the)\b/i,
];

function hasDoneSignal(text) {
  if (typeof text !== "string" || text.length < 6) return false;
  return DONE_PATTERNS.some((re) => re.test(text));
}

// Read only the tail of the transcript (decisions close at the end; reading the
// whole JSONL of a long session would be wasteful). 64 KiB covers many turns.
function readTail(p, maxBytes) {
  let fd;
  try {
    fd = fs.openSync(p, "r");
    const { size } = fs.fstatSync(fd);
    const start = Math.max(0, size - maxBytes);
    const len = size - start;
    const buf = Buffer.alloc(len);
    fs.readSync(fd, buf, 0, len, start);
    return { text: buf.toString("utf8"), partial: start > 0 };
  } catch {
    return { text: "", partial: false };
  } finally {
    if (fd !== undefined) try { fs.closeSync(fd); } catch {}
  }
}

// The most recent REAL user utterance (skip tool_results, meta, slash-commands).
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
    if (!txt) continue; // tool_result / empty → not an utterance
    if (/^<(command|local-command|user-prompt|system)/i.test(txt)) continue; // slash/meta
    return txt;
  }
  return "";
}

const NUDGE = [
  "[Argus] The user seems to have just closed a decision. If they set an ANCHOR (a",
  "pre-answer lean) earlier this session, mirror it against where they landed now —",
  "naturally, in their language, e.g. \"아까 A 쪽이라 하셨는데 지금 B로 가시네요\". This is the",
  "WAKE (1차 정산): state the two points ONLY, with NO verdict on the move (no",
  "'good'/'wiser'/'AI was right' — mirror, not judge). No anchor was set → skip the wake.",
  "If this is a decision reality will settle later, you MAY then offer to seal it (a",
  "one-line prediction + a check-by date) via /argus — optional, skip loses nothing. Once.",
].join(" ");

function main() {
  let input = "";
  try { input = fs.readFileSync(0, "utf8"); } catch { return; }
  let data;
  try { data = JSON.parse(input); } catch { return; }

  const sessionId = data && data.session_id;
  const transcriptPath = data && data.transcript_path;
  if (!sessionId || !transcriptPath) return;

  // GATE 1: off session (no anchor nudge this session) → zero work, silence.
  try { if (!fs.existsSync(anchoredMarker(sessionId))) return; } catch { return; }
  // GATE 2: already waked this session → silence (once per session).
  try { if (fs.existsSync(wakedMarker(sessionId))) return; } catch { return; }

  const { text, partial } = readTail(transcriptPath, 64 * 1024);
  if (!text) return;
  const utter = lastUserText(text, partial);
  if (!hasDoneSignal(utter)) return; // no COMPLETION signal → silence (default)

  // Claim the once-per-session slot BEFORE printing (write-fail → silence).
  const marker = wakedMarker(sessionId);
  try {
    fs.mkdirSync(path.dirname(marker), { recursive: true });
    fs.writeFileSync(marker, "");
  } catch {
    return;
  }

  process.stdout.write(NUDGE + "\n");
}

// No process.exit(): let the runtime drain stdout and exit 0 naturally — a forced
// exit can truncate the piped nudge before it flushes.
try { main(); } catch {}
