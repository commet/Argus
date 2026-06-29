#!/usr/bin/env node
/**
 * Argus UserPromptSubmit hook — Layer-1 START signal → anchor nudge.
 *
 * Design: docs/DESIGN-decision-capture-anchor-as-switch-2026-06-29.md (§12.5, §13-1).
 *
 * The anchor (a one-line pre-AI lean) is the SWITCH that turns a session into a
 * tracked one. This hook is the cheapest, most conservative entry point: a purely
 * DETERMINISTIC keyword scan of the user's prompt (NO LLM — that is Layer 2, later).
 * When a START signal appears (the user is weighing a "걸 만한" decision), it nudges
 * the MAIN Claude agent — via stdout/additionalContext — to weave a natural "where do
 * you lean right now?" into its reply BEFORE answering. That one line becomes the
 * before-point the later wake (1차 정산) compares against.
 *
 * SPINE (do not regress):
 *  - SILENCE IS THE DEFAULT. No signal → print nothing, exit 0.
 *  - Once per session, then never again (marker) — no fatigue (helm's rule).
 *  - This hook NEVER asks the user a meta-question and NEVER writes a ledger row.
 *    It only hands Claude context; Claude decides how to weave it, the user owns the
 *    line. The nudge text below explicitly forbids a meta-prompt and any borrowed rope.
 *  - Never throws, never exits non-zero — a broken hook must not tax the session.
 *  - Conservative recall on purpose: better to miss a weak signal (the user can still
 *    invoke /argus) than to over-fire (mirror clause). Layer 2 widens later.
 */

const fs = require("fs");
const path = require("path");
const os = require("os");

function configDir() {
  return process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), ".claude");
}

// Per-(Claude)session marker dir, so the nudge fires at most once per session.
function markerPath(sessionId) {
  return path.join(configDir(), "argus-anchored", String(sessionId));
}

// ── Layer-1 START signal — deterministic, conservative. ─────────────────────
// A START signal = the user is OPENING a weigh-up ("할까/말까", "A vs B", "어느
// 쪽"). Kept tight on purpose: bare "or"/"or so" is too noisy and is NOT included.
// Word-boundary / spacing guards avoid matching inside unrelated words.
const START_PATTERNS = [
  // Korean — weighing / choosing / deciding
  /할까\s*말까/,
  /(말까|할까)\s*(고민|고민이|싶|망설)/,
  /어느\s*쪽/,
  /둘\s*중(에|에서)?/,
  /(결정|선택)(을|해야|하기|이|할지)/,
  /(가는|하는)\s*게\s*(맞을까|나을까|좋을까)/,
  /(해야\s*할지|말지)/,
  // English — weighing / choosing / deciding
  /\bshould\s+i\b/i,
  /\bwhich\s+(one|option|way|approach)\b/i,
  /\bdecide\s+(between|whether)\b/i,
  /\b(\w[\w./-]*)\s+vs\.?\s+(\w)/i,        // "X vs Y"
  /\btrade[\s-]?offs?\b/i,
  /\bweigh(ing)?\s+(up|the\s+options)\b/i,
];

function hasStartSignal(text) {
  if (typeof text !== "string" || text.length < 8) return false;
  return START_PATTERNS.some((re) => re.test(text));
}

// The context handed to the main Claude agent. NOT shown verbatim to the user —
// it instructs Claude HOW to weave the anchor naturally (UX §9: no meta-question).
const NUDGE = [
  "[Argus] The user seems to be weighing a decision that reality will only answer later.",
  "BEFORE you give your answer, weave ONE natural line into your reply asking where they",
  "currently lean — e.g. \"먼저 — 지금은 어느 쪽으로 더 기울어요? 한 줄이면 돼요\" (use the",
  "user's language). This is their ANCHOR: the pre-answer read the later \"wake\" compares",
  "against. Rules: (1) it is a natural part of your reply, NOT a separate meta-prompt or a",
  "[yes/no] gate; (2) NEVER suggest a lean or pre-fill it — they word it themselves (no",
  "borrowed rope); (3) it is optional — if they skip, lose nothing and never re-ask; (4) do",
  "this at most once. If they give a line, you may offer to record it with /argus (their",
  "choice). If this prompt is not actually a 걸-만한(consequential, reality-settled) decision,",
  "ignore this entirely.",
].join(" ");

function main() {
  let input = "";
  try {
    input = fs.readFileSync(0, "utf8");
  } catch {
    return; // no stdin → silence
  }

  let data;
  try {
    data = JSON.parse(input);
  } catch {
    return; // unparsable → silence
  }

  const sessionId = data && data.session_id;
  // user_message is the field Claude Code passes on UserPromptSubmit.
  const prompt = (data && (data.user_message || data.prompt)) || "";
  if (!sessionId) return;

  // Already nudged this session? → silence (once-per-session, no fatigue).
  const marker = markerPath(sessionId);
  try {
    if (fs.existsSync(marker)) return;
  } catch {
    return;
  }

  if (!hasStartSignal(prompt)) return; // no START signal → silence (default)

  // Write the marker BEFORE printing, so a write failure means silence (not a
  // nudge that repeats every turn). Mirror of check-contracts' greet-marker order.
  try {
    fs.mkdirSync(path.dirname(marker), { recursive: true });
    fs.writeFileSync(marker, "");
  } catch {
    return; // could not claim the once-per-session slot → stay silent
  }

  process.stdout.write(NUDGE + "\n");
}

// No process.exit(): let the runtime drain stdout and exit 0 naturally — a forced
// exit can truncate the piped nudge before it flushes.
try {
  main();
} catch {
  // A broken hook must never tax the session.
}
