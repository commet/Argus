#!/usr/bin/env node
/**
 * Argus PreToolUse hook — non-blocking warning before an IRREVERSIBLE operation
 * (helm's keel scan as a pre-flight: the moment helm's plan-time scan can't see).
 *
 * Design: internal design notes (§12.5 structure
 * signals; helm SKILL.md keel scan). Token-zero: deterministic detection of
 * irreversibility (no LLM); the judgment ("is the load-bearing reason supported?") is
 * delegated to the main agent via additionalContext.
 *
 * SPINE (do not regress):
 *  - WARN, NEVER BLOCK. permissionDecision is always "allow"; never "deny" / exit 2.
 *    Argus does not decide whether the user may run their tool — it surfaces a question.
 *  - SILENCE IS THE DEFAULT. Not irreversible → no output (⇒ default allow), zero work.
 *  - Once per session (helm: never warn twice in one session) — no nagging.
 *  - Mirror only: name at most ONE assumption, offer a check-by; no verdict, no score.
 *  - PreToolUse plain stdout is NOT shown to the model — MUST use JSON additionalContext.
 *  - Never throws / non-zero; no process.exit() so stdout flushes.
 */
const fs = require("fs");
const path = require("path");
const { configDir, isIrreversible, isDangerousTool } = require("./lib/decision-signals");
const { tryClaimAsk, sessionHadCrisis } = require("./lib/ask-budget");

const keeledMarker = (id) => path.join(configDir(), "argus-keeled", String(id));
function clip(t, n) { t = String(t || ""); return t.length <= n ? t : t.slice(0, n - 1) + "…"; }

function main() {
  let input = "";
  try { input = fs.readFileSync(0, "utf8"); } catch { return; }
  let data;
  try { data = JSON.parse(input); } catch { return; }

  const toolName = data && data.tool_name;
  const cmd = data && data.tool_input && data.tool_input.command;
  const irreversible = (toolName === "Bash" && isIrreversible(cmd)) || isDangerousTool(toolName);
  if (!irreversible) return; // not irreversible → silence (no output ⇒ default allow)

  const sessionId = data.session_id;
  if (!sessionId) return;

  // Crisis screen (session-scope): this hook never sees user text, so it reads
  // the marker the prompt-side hooks leave. A seal offer on a ruin-shaped
  // session reads as endorsement — stay silent.
  if (sessionHadCrisis(sessionId)) return;

  // Once per session — helm never warns twice in one session.
  const marker = keeledMarker(sessionId);
  try { if (fs.existsSync(marker)) return; } catch { return; }

  // Global ambient ask budget (keyless claim — the prompt is not visible here;
  // recency stands in for "same turn"). Claim BEFORE the once-per-session
  // marker so a denied ask leaves the keel free to warn later in the session.
  if (!tryClaimAsk(sessionId, null)) return;

  try {
    fs.mkdirSync(path.dirname(marker), { recursive: true });
    fs.writeFileSync(marker, "");
  } catch {
    return;
  }

  const what = toolName === "Bash" ? clip(cmd, 60) : toolName;
  const NUDGE = "[Argus] About to run an irreversible operation: \"" + what + "\". This does"
    + " NOT block — it will run. Briefly: is the load-bearing reason for it stated and"
    + " supported? If it rests on an unverified assumption, name that ONE assumption. If"
    + " reality will judge this later, you MAY offer to seal a one-line prediction + a"
    + " check-by date. Mirror only — no verdict, no nagging; if it's clearly routine and"
    + " safe, ignore this.";

  // permissionDecision "allow" = inform WITHOUT blocking. additionalContext is the
  // documented way a PreToolUse hook reaches the model (plain stdout does not).
  const out = {
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "allow",
      additionalContext: NUDGE,
    },
  };
  process.stdout.write(JSON.stringify(out) + "\n");
}

// No process.exit(): let the runtime drain stdout and exit 0 naturally.
try { main(); } catch {}
