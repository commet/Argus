#!/usr/bin/env node
/**
 * Argus SessionStart hook — recall the PREVIOUS off-session's closed decision.
 *
 * Design: docs/DESIGN-decision-capture-anchor-as-switch-2026-06-29.md (§7, §13-4).
 *
 * "마지막 확인" can't ride SessionEnd (unreliable — terminal close / crash skip it).
 * So the last look at a session that CLOSED a decision WITHOUT an anchor happens at
 * the NEXT session start (SessionStart is stable). Cheap & token-zero: readdir to find
 * the previous session file + ONE tail grep for a completion signal — NO LLM. When the
 * previous OFF session closed a decision, it hands the MAIN agent context to gently ask
 * "how did that turn out?" early in this session.
 *
 * SPINE (do not regress):
 *  - SILENCE IS THE DEFAULT. No previous session / no closed decision → print nothing.
 *  - Only OFF sessions (no anchor marker) — an ON session's wake was already handled
 *    in-session, recalling it again would be a duplicate (over-fire).
 *  - Once per previous session (marker). Mirror only, no verdict, skip lossless.
 *  - Never throws, never exits non-zero; no process.exit() so stdout flushes.
 */
const fs = require("fs");
const path = require("path");
const { configDir, hasDoneSignal, readTail, lastUserText } = require("./lib/decision-signals");

const anchoredMarker = (id) => path.join(configDir(), "argus-anchored", String(id));
const recalledMarker = (id) => path.join(configDir(), "argus-recalled", String(id));

function clip(t, n) {
  t = String(t || "");
  return t.length <= n ? t : t.slice(0, n - 1) + "…";
}

// The most-recently-modified .jsonl in the same project dir, excluding the current
// session. Top-level only (subagent/workflow transcripts live in subdirs, skipped
// by isFile()). This is a near-enough "previous session".
function prevSession(transcriptPath) {
  const dir = path.dirname(transcriptPath);
  const curBase = path.basename(transcriptPath);
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return null; }
  let latest = null, latestM = 0;
  for (const e of entries) {
    if (!e.isFile() || !e.name.endsWith(".jsonl") || e.name === curBase) continue;
    let m;
    try { m = fs.statSync(path.join(dir, e.name)).mtimeMs; } catch { continue; }
    if (m > latestM) { latestM = m; latest = e.name; }
  }
  return latest ? { id: latest.replace(/\.jsonl$/, ""), file: path.join(dir, latest) } : null;
}

function main() {
  let input = "";
  try { input = fs.readFileSync(0, "utf8"); } catch { return; }
  let data;
  try { data = JSON.parse(input); } catch { return; }

  const transcriptPath = data && data.transcript_path;
  if (!transcriptPath) return;

  const prev = prevSession(transcriptPath);
  if (!prev) return;
  // Prev was an ON (anchored) session → its wake was handled in-session. Skip.
  try { if (fs.existsSync(anchoredMarker(prev.id))) return; } catch { return; }
  // Already recalled this previous session → silence (once).
  try { if (fs.existsSync(recalledMarker(prev.id))) return; } catch { return; }

  const { text, partial } = readTail(prev.file, 64 * 1024);
  if (!text) return;
  const utter = lastUserText(text, partial);
  if (!hasDoneSignal(utter)) return; // prev session closed no decision → silence

  // Claim the once-per-prev-session slot BEFORE printing (write-fail → silence).
  const marker = recalledMarker(prev.id);
  try {
    fs.mkdirSync(path.dirname(marker), { recursive: true });
    fs.writeFileSync(marker, "");
  } catch {
    return;
  }

  const NUDGE = [
    "[Argus] The user's previous session seems to have closed a decision without",
    "recording it: \"" + clip(utter, 140) + "\".",
    "At a natural moment early in THIS session, gently ask how it turned out — or whether",
    "it's still the plan — ONCE, in their language, with NO verdict (mirror, not judge),",
    "skip loses nothing. If it looks unrelated to what they're doing now, ignore this.",
  ].join(" ");
  process.stdout.write(NUDGE + "\n");
}

// No process.exit(): let the runtime drain stdout and exit 0 naturally.
try { main(); } catch {}
