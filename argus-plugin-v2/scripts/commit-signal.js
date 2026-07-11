#!/usr/bin/env node
/**
 * Argus PostToolUse hook — a git commit is a DECISION realized in code (action signal).
 *
 * Design: internal design notes (§12.5 structure
 * signals). wake-signal catches the COMPLETION *language* ("그걸로 가자"); this catches
 * the COMPLETION *action* (the user shipped it) — often more precise, since people
 * commit without narrating the decision. Shares wake's gate so the two never double-fire.
 *
 * Token-zero: a deterministic check of the tool name + command (NO LLM). Layer-2
 * (mirror the anchor, offer to seal) is delegated to the main agent via stdout.
 *
 * SPINE (do not regress):
 *  - Only ANCHORED sessions (this commit closes a weighed decision, not routine work).
 *    A commit in an off session is just work — silence (no over-fire on every commit).
 *  - Once per session, shared with wake (argus-waked marker): whichever closes first wins.
 *  - Mirror only, no verdict; never asks a meta-question; never writes a ledger row.
 *  - Never throws / non-zero; no process.exit() so stdout flushes.
 */
const fs = require("fs");
const path = require("path");
const { configDir } = require("./lib/decision-signals");

const anchoredMarker = (id) => path.join(configDir(), "argus-anchored", String(id));

const NUDGE = [
  "[Argus] The user just committed in an anchored decision session — the decision is now",
  "realized in code. At a natural moment, mirror the lean they set earlier this session",
  "against what they actually shipped, and — if reality will settle it later — offer to",
  "seal a one-line prediction + a check-by date via /argus. ONCE, in their language, with",
  "NO verdict (mirror, not judge), skip loses nothing. If this commit is routine and",
  "unrelated to the weighed decision, ignore this.",
].join(" ");

function main() {
  let input = "";
  try { input = fs.readFileSync(0, "utf8"); } catch { return; }
  let data;
  try { data = JSON.parse(input); } catch { return; }

  // Only a git commit via Bash counts as the action signal.
  if (!data || data.tool_name !== "Bash") return;
  const cmd = data.tool_input && data.tool_input.command;
  if (typeof cmd !== "string" || !/\bgit\s+commit\b/.test(cmd)) return;

  const sessionId = data.session_id;
  if (!sessionId) return;

  // Off session (not armed) → routine commit, silence. The armed marker is the gate AND
  // the once-per-decision guard: consumed on fire (re-arm next decision; dedupe with the
  // language wake — whichever closes the decision first consumes the slot).
  try { if (!fs.existsSync(anchoredMarker(sessionId))) return; } catch { return; }

  // Consume the armed slot BEFORE printing.
  try { fs.unlinkSync(anchoredMarker(sessionId)); } catch { return; }

  // PostToolUse is NOT in the plain-stdout-to-context exception list. It must return
  // JSON with hookSpecificOutput.additionalContext for the nudge to reach the main
  // agent — plain stdout would go to the debug log only (the hook would silently no-op).
  const out = { hookSpecificOutput: { hookEventName: "PostToolUse", additionalContext: NUDGE } };
  process.stdout.write(JSON.stringify(out) + "\n");
}

// No process.exit(): let the runtime drain stdout and exit 0 naturally.
try { main(); } catch {}
