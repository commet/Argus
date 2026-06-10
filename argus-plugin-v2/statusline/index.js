#!/usr/bin/env node
/**
 * Argus v2 Status Line for Claude Code
 *
 * Design principle (unchanged from v0.5): show what changes behavior, not what decorates the screen.
 * Every line must contain information the user CANNOT see in the conversation.
 *
 * Line 1: Model + Context forecast + Duration + branch
 * Line 2: Active session — phase, active draft label, agents deployed, verification, open concerns
 * Line 3: Decision tree summary — total drafts, released version, branches
 *
 * Zero dependencies — pure Node.js (CommonJS).
 *
 * Divergence from v0.5: no 4R references (reframe/recast/rehearse/refine), no journal.md parsing.
 * Reads session.json files under .argus/sessions/ instead.
 */

const { readFileSync, existsSync, statSync, readdirSync, openSync, readSync, closeSync } = require("fs");
const { execSync } = require("child_process");
const { basename, join } = require("path");

// ─── ANSI ────────────────────────────────────────────────

const E = "\x1b[";
const R = `${E}0m`;
const BOLD = `${E}1m`;
const DIM = `${E}2m`;
const C = {
  g: `${E}32m`, y: `${E}33m`, r: `${E}31m`,
  c: `${E}36m`, m: `${E}35m`, b: `${E}34m`,
  w: `${E}37m`, d: `${E}90m`,
};

// ─── Stdin ───────────────────────────────────────────────

function readStdin() {
  try {
    const chunks = [];
    const buf = Buffer.alloc(4096);
    while (true) {
      try {
        const n = readSync(process.stdin.fd, buf, 0, 4096);
        if (n === 0) break;
        chunks.push(Buffer.from(buf.slice(0, n)));
      } catch { break; }
    }
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch { return null; }
}

// ─── Session state parser ────────────────────────────────

let sessionCache = { mtime: 0, data: null };

// Read a write-once artifact from the active draft's version dir. Returns null on
// any miss/parse error — the statusline must never throw on partial session state.
function readVersionArtifact(sessionDir, label, name) {
  if (!sessionDir || !label) return null;
  try {
    const p = join(sessionDir, "versions", label, name);
    if (!existsSync(p)) return null;
    return JSON.parse(readFileSync(p, "utf8"));
  } catch { return null; }
}

function parseActiveSession(cwd) {
  const sessionsDir = join(cwd, ".argus", "sessions");
  if (!existsSync(sessionsDir)) return null;

  try {
    // Find most recently modified session
    const entries = readdirSync(sessionsDir);
    let latest = null;
    let latestDir = null;
    let latestMtime = 0;

    for (const entry of entries) {
      const sessionJson = join(sessionsDir, entry, "session.json");
      if (!existsSync(sessionJson)) continue;
      const stat = statSync(sessionJson);
      if (stat.mtimeMs > latestMtime) {
        latestMtime = stat.mtimeMs;
        latest = sessionJson;
        latestDir = join(sessionsDir, entry);
      }
    }

    if (!latest) return null;

    if (sessionCache.mtime === latestMtime && sessionCache.data) {
      return sessionCache.data;
    }

    const raw = readFileSync(latest, "utf8");
    const session = JSON.parse(raw);

    const drafts = session.drafts || [];
    const activeDraft = drafts.find(d => d.id === session.active_draft_id) || drafts[drafts.length - 1];
    const releasedDraft = drafts.find(d => d.id === session.released_draft_id);

    // Count branches (drafts with a period in their label beyond the first)
    const branches = drafts.filter(d => {
      const parts = d.version_label.split(".");
      return parts.length >= 3;  // v0.1.1, v0.2.3 etc.
    }).length;

    // The thin session.json no longer embeds boss feedback or the verification
    // ledger — they live write-once in versions/{label}/. Read the active draft's
    // version-dir artifacts directly (defensive: any missing/corrupt file -> null).
    const activeLabel = activeDraft?.version_label || null;
    const bossFeedback = readVersionArtifact(latestDir, activeLabel, "boss_feedback.json");
    const verification = readVersionArtifact(latestDir, activeLabel, "verification.json");

    // Critical concerns count (from the active draft's boss feedback if present)
    let criticalConcerns = 0;
    if (bossFeedback?.concerns) {
      criticalConcerns = bossFeedback.concerns.filter(c => c.severity === "critical").length;
    }

    const data = {
      id: session.id,
      phase: session.phase,
      round: session.round,
      maxRounds: session.max_rounds,
      problemSnippet: (session.problem_text || "").slice(0, 40),
      agentsDeployed: (session.workers || []).length,
      mbtiBoss: session.boss_agent?.mbti_code || null,
      draftCount: drafts.length,
      activeLabel: activeDraft?.version_label || null,
      releasedLabel: releasedDraft?.version_label || null,
      branchCount: branches,
      criticalConcerns,
      stakes: session.classification?.stakes || null,
      verificationStatus: verification?.overall_status || null,
      challengedCount: verification?.challenged_claims?.length ?? verification?.challenged_count ?? null,
      humanCheckCount: verification?.human_required_checks?.length ?? verification?.human_check_count ?? null,
    };

    sessionCache = { mtime: latestMtime, data };
    return data;
  } catch { return null; }
}

// ─── Git ─────────────────────────────────────────────────

function getGitBranch(cwd) {
  try {
    return execSync("git rev-parse --abbrev-ref HEAD", {
      cwd, encoding: "utf8", timeout: 2000,
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();
  } catch { return null; }
}

// ─── Render helpers ──────────────────────────────────────

function bar(pct, w) {
  w = w || 10;
  if (pct == null || isNaN(pct)) pct = 0;
  pct = Math.round(pct);
  const f = Math.min(Math.floor((pct / 100) * w), w);
  const e = w - f;
  const color = pct < 70 ? C.g : pct < 85 ? C.y : C.r;
  return `${color}${"█".repeat(f)}${DIM}${"░".repeat(e)}${R} ${color}${pct}%${R}`;
}

function formatDuration(ms) {
  if (!ms) return null;
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  return `${h}h${m % 60}m`;
}

function phaseColor(phase) {
  if (!phase) return C.d;
  if (phase === "complete") return C.g;
  if (phase === "verifying") return C.y;
  if (phase === "dm_feedback" || phase === "refining") return C.m;
  if (phase === "team_working" || phase === "mixing") return C.c;
  if (phase === "analyzing" || phase === "conversing") return C.b;
  return C.y;
}

// ─── Main ────────────────────────────────────────────────

function main() {
  const stdin = readStdin();
  if (!stdin) { process.stdout.write("Argus"); return; }

  const out = [];
  const cwd = stdin.cwd || stdin.workspace?.current_dir || ".";
  const model = stdin.model?.display_name || "Claude";
  const branch = getGitBranch(cwd);

  // ═══ LINE 1: Model │ Context │ Duration │ Branch ═══

  const ctxPct = stdin.context_window?.used_percentage ?? 0;
  const duration = formatDuration(stdin.cost?.total_duration_ms);

  let l1 = `${C.c}${model}${R} ${bar(ctxPct, 8)}`;
  const meta = [];
  if (duration) meta.push(`${C.d}${duration}${R}`);
  if (branch) meta.push(`${C.m}${branch}${R}`);
  if (meta.length) l1 += ` ${C.d}│${R} ${meta.join(" ")}`;
  out.push(l1);

  // ═══ LINE 2: Active session ═══

  const session = parseActiveSession(cwd);
  if (session) {
    const parts = [];

    // Session marker
    parts.push(`${C.m}♫${R} ${C.w}${BOLD}${session.id.slice(0, 30)}${R}`);

    // Phase + active version
    const pc = phaseColor(session.phase);
    parts.push(`${pc}${session.phase}${R}${session.activeLabel ? `${C.d}·${R}${C.c}${session.activeLabel}${R}` : ""}`);

    // Stakes badge
    if (session.stakes) {
      const stakesColor = session.stakes === "critical" ? C.r : session.stakes === "important" ? C.y : C.d;
      parts.push(`${stakesColor}${session.stakes}${R}`);
    }

    // Round (if in conversing/analyzing)
    if (session.phase === "conversing" || session.phase === "analyzing") {
      parts.push(`${C.d}Q${session.round}/${session.maxRounds}${R}`);
    }

    // Agents deployed
    if (session.agentsDeployed > 0) {
      parts.push(`${C.d}agents${R} ${C.c}${session.agentsDeployed}${R}`);
    }

    // Verification
    if (session.verificationStatus) {
      const vc = session.verificationStatus === "verified" ? C.g
        : session.verificationStatus === "blocked" || session.verificationStatus === "needs_revision" ? C.r
          : C.y;
      const details = [];
      if (session.challengedCount != null) details.push(`${session.challengedCount} challenged`);
      if (session.humanCheckCount != null && session.humanCheckCount > 0) details.push(`${session.humanCheckCount} human`);
      parts.push(`${C.d}verify${R} ${vc}${session.verificationStatus}${R}${details.length ? `${C.d}(${details.join(", ")})${R}` : ""}`);
    }

    // Boss
    if (session.mbtiBoss) {
      parts.push(`${C.d}boss${R} ${C.y}${session.mbtiBoss}${R}`);
    }

    // Critical concerns
    if (session.criticalConcerns > 0) {
      parts.push(`${C.r}⚠ ${session.criticalConcerns} critical${R}`);
    }

    out.push(parts.join(` ${C.d}│${R} `));
  }

  // ═══ LINE 3: Draft tree summary ═══

  if (session && session.draftCount > 0) {
    const parts = [];

    parts.push(`${C.d}drafts${R} ${C.c}${session.draftCount}${R}`);

    if (session.branchCount > 0) {
      parts.push(`${C.y}${session.branchCount} branch${session.branchCount > 1 ? "es" : ""}${R}`);
    }

    if (session.releasedLabel) {
      parts.push(`${C.g}🏷 ${session.releasedLabel}${R}`);
    }

    if (parts.length > 1) {  // Only show if there's something beyond just count
      out.push(parts.join(` ${C.d}│${R} `));
    }
  }

  process.stdout.write(out.join("\n"));
}

main();
