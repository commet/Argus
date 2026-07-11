#!/usr/bin/env node
/**
 * Argus Stop hook — Layer-1 COMPLETION signal → wake (1차 정산) nudge.
 *
 * Design: internal design notes (§12.5, §13-2/3).
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
const { configDir, hasDoneSignal, readTail, lastUserText } = require("./lib/decision-signals");

const anchoredMarker = (id) => path.join(configDir(), "argus-anchored", String(id));

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

  // Off session (not armed) → zero work, silence. The armed marker is BOTH the gate and
  // the once-per-decision guard: consumed on fire so a later strong START re-arms, and so
  // wake & commit can't both fire for one decision (whichever closes first consumes it).
  try { if (!fs.existsSync(anchoredMarker(sessionId))) return; } catch { return; }

  const { text, partial } = readTail(transcriptPath, 64 * 1024);
  if (!text) return;
  const utter = lastUserText(text, partial);
  if (!hasDoneSignal(utter)) return; // no COMPLETION signal → silence (default)

  // Consume the armed slot BEFORE printing (re-arm next decision; dedupe wake/commit).
  try { fs.unlinkSync(anchoredMarker(sessionId)); } catch { return; }

  // Stop is NOT in the plain-stdout-to-context exception list (only UserPromptSubmit /
  // SessionStart are). A Stop hook must return JSON with hookSpecificOutput.additionalContext
  // for the nudge to reach the main agent — plain stdout would go to the debug log only.
  const out = { hookSpecificOutput: { hookEventName: "Stop", additionalContext: NUDGE } };
  process.stdout.write(JSON.stringify(out) + "\n");
}

// No process.exit(): let the runtime drain stdout and exit 0 naturally — a forced
// exit can truncate the piped nudge before it flushes.
try { main(); } catch {}
