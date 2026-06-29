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
const { configDir, hasStartSignal, trackRecord } = require("./lib/decision-signals");

// argus-anchored = the CURRENT armed decision (set here, CONSUMED by wake/commit when the
// decision closes, so a later strong START re-arms — once per DECISION, not once per
// session: serves the founder ②③ "many decisions per session" path). argus-seen =
// permanent "this session was nudged", so recall can tell an ON session from an OFF one.
function anchoredMarker(sessionId) {
  return path.join(configDir(), "argus-anchored", String(sessionId));
}
function seenMarker(sessionId) {
  return path.join(configDir(), "argus-seen", String(sessionId));
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

  // Already armed (a decision is being tracked this session)? → silence. wake/commit
  // consume the armed marker when the decision closes, so a later strong START re-arms.
  const anchored = anchoredMarker(sessionId);
  try {
    if (fs.existsSync(anchored)) return;
  } catch {
    return;
  }

  if (!hasStartSignal(prompt)) return; // no START signal → silence (default)

  // Arm the slot AND record that this session was nudged (seen, permanent — recall reads
  // it). Write before printing so a write failure means silence, not a repeating nudge.
  try {
    fs.mkdirSync(path.dirname(anchored), { recursive: true });
    fs.writeFileSync(anchored, "");
    const seen = seenMarker(sessionId);
    fs.mkdirSync(path.dirname(seen), { recursive: true });
    fs.writeFileSync(seen, "");
  } catch {
    return; // could not claim the slot → stay silent
  }

  // Self-improvement loop: feed a past track record into this decision's entry, but
  // ONLY as a sample-size-scaled frequency fact (>=2 settled), never a verdict/tier.
  let out = NUDGE;
  const tr = trackRecord(data.cwd || process.cwd());
  if (tr && tr.settled >= 2) {
    out += " [Prior track record — you MAY state it as a bare frequency fact, but NEVER use"
      + " it to shape or lead the lean question, and never a verdict/tier: "
      + tr.sealed + " sealed, " + tr.settled + " settled, " + tr.held + " held"
      + (tr.luck ? ", " + tr.luck + " held on luck" : "") + ".]";
  }
  process.stdout.write(out + "\n");
}

// No process.exit(): let the runtime drain stdout and exit 0 naturally — a forced
// exit can truncate the piped nudge before it flushes.
try {
  main();
} catch {
  // A broken hook must never tax the session.
}
