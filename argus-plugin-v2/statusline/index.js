#!/usr/bin/env node
/**
 * Argus Status Line — the line earns its space; it does not rent it.
 *
 * Line 1 (always): model, context bar, session duration, git branch.
 * Line 2 (at most ONE, absent by default), by priority:
 *   1. OVERDUE contract checks — sealed bets strictly past check_by (+ bearing seeds)
 *   2. checks due TODAY        — same urgency, honest label
 *   3. live session progress   — session.json touched < 15 min ago, phase != complete
 *   4. checks due within 7 days
 *   5. fresh Current Bearing   — generated < 48 h ago: status + summary + fog
 *   6. decaying bearing        — 2–14 days old: glyph + age only
 *   7. nothing
 *
 * Why this hierarchy: of everything Argus produces, only a contract check date
 * stays true and behavior-changing weeks after it was written. A bearing is
 * orientation the day it is generated and noise two weeks later — so it decays
 * and disappears. Machinery (agent counts, claim counts, boss persona) never
 * appears here; that is the webapp voyage view's job.
 *
 * Data sources (all optional; absence = silence, never an error):
 *   .argus/ledger/ledger.jsonl                       — argus-watch append-only event log
 *   .argus/current-bearing.json                      — bearing emitted at repo root
 *   .argus/sessions/<id>/current-bearing.json        — per-session bearing
 *   .argus/sessions/<id>/versions/<v>/current-bearing.json
 *   .argus/sessions/<id>/session.json                — live phase, only while fresh
 *
 * Zero dependencies — pure Node.js (CommonJS). Must never throw: a statusline
 * error must degrade to line 1, not to a stack trace under the input box.
 */

const fs = require("fs");
const { join, resolve, isAbsolute } = require("path");

// ─── ANSI ────────────────────────────────────────────────

const E = "\x1b[";
const R = `${E}0m`;
const BOLD = `${E}1m`;
const DIM = `${E}2m`;
const C = {
  g: `${E}32m`, y: `${E}33m`, r: `${E}31m`,
  c: `${E}36m`, m: `${E}35m`, w: `${E}37m`, d: `${E}90m`,
};

const SEP = ` ${C.d}·${R} `;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const DAY = 86400000;

// ─── Stdin ───────────────────────────────────────────────

function readStdin() {
  try {
    const chunks = [];
    const buf = Buffer.alloc(4096);
    while (true) {
      try {
        const n = fs.readSync(process.stdin.fd, buf, 0, 4096);
        if (n === 0) break;
        chunks.push(Buffer.from(buf.slice(0, n)));
      } catch { break; }
    }
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch { return null; }
}

// ─── Display width (Hangul/CJK/emoji are double-width) ──

function charCells(cp) {
  if (cp >= 0x1100 && cp <= 0x115f) return 2;   // Hangul Jamo
  if (cp >= 0x2e80 && cp <= 0xa4cf) return 2;   // CJK radicals … Yi
  if (cp >= 0xac00 && cp <= 0xd7a3) return 2;   // Hangul syllables
  if (cp >= 0xf900 && cp <= 0xfaff) return 2;   // CJK compatibility
  if (cp >= 0xfe30 && cp <= 0xfe4f) return 2;
  if (cp >= 0xff00 && cp <= 0xff60) return 2;   // fullwidth forms
  if (cp >= 0x1f300 && cp <= 0x1faff) return 2; // emoji
  if (cp === 0x2693 || cp === 0x26d4) return 2; // ⚓ ⛔
  return 1;
}

function cells(s) {
  let n = 0;
  for (const ch of s) n += charCells(ch.codePointAt(0));
  return n;
}

function clip(s, max) {
  if (cells(s) <= max) return s;
  let out = "";
  let n = 0;
  for (const ch of s) {
    const w = charCells(ch.codePointAt(0));
    if (n + w > max - 1) break;
    out += ch;
    n += w;
  }
  return out + "…";
}

// ─── Dates ───────────────────────────────────────────────

/** Today as a LOCAL-timezone ISO date (matches argus-watch ledger.mjs). */
function localToday(offsetDays = 0) {
  const d = new Date(Date.now() + offsetDays * DAY);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

function mmdd(iso) { return iso.slice(5); }

// ─── Filesystem walk-up ──────────────────────────────────

/** Walk from start toward the filesystem root, return the first non-null find(dir). */
function walkUp(start, find) {
  let dir = start;
  for (let i = 0; i < 16; i++) {
    const hit = find(dir);
    if (hit) return hit;
    const parent = resolve(dir, "..");
    if (parent === dir) return null;
    dir = parent;
  }
  return null;
}

/** Sessions often run in a subdirectory; .argus lives at the repo root. */
function findArgusRoot(cwd) {
  return walkUp(cwd, d => {
    try { return fs.statSync(join(d, ".argus")).isDirectory() ? d : null; }
    catch { return null; }
  }) || cwd;
}

// ─── Ledger: sealed bets with a check date ───────────────
// Minimal replay of tools/argus-watch/lib/ledger.mjs semantics. Reimplemented
// because the statusline ships standalone with the plugin; if the two drift,
// the ledger event log is the contract — follow ledger.mjs.

function loadSealedBets(root) {
  let raw;
  try { raw = fs.readFileSync(join(root, ".argus", "ledger", "ledger.jsonl"), "utf8"); }
  catch { return []; }

  const map = new Map();
  for (const line of raw.split("\n")) {
    if (!line.trim()) continue;
    let e;
    try { e = JSON.parse(line); } catch { continue; }
    const cur = map.get(e.id);
    switch (e.event) {
      case "harvest":
        if (!cur) map.set(e.id, { status: "candidate", decision: e.decision, quote: e.quote });
        break;
      case "seal":
        if (cur) Object.assign(cur, { status: "sealed", predicate: e.predicate, check_by: e.check_by });
        break;
      case "amend":
        if (cur) {
          if (e.predicate != null) cur.predicate = e.predicate;
          if (e.check_by != null) cur.check_by = e.check_by;
        }
        break;
      case "dismiss":
        if (cur) cur.status = "dismissed";
        break;
      case "settle":
        if (cur) cur.status = "settled";
        break;
    }
  }
  return [...map.values()].filter(d => d.status === "sealed" && d.check_by && ISO_DATE.test(d.check_by));
}

// ─── Current Bearing ─────────────────────────────────────

function bearingCandidates(root) {
  // Both spellings: the v2 skills write current_bearing.json (underscore,
  // per sail Step 7 / session-layout.md); the hyphen form is the legacy/webapp
  // emission. Missing files cost one failed stat each — cheap.
  const names = ["current_bearing.json", "current-bearing.json"];
  const out = names.map(n => join(root, ".argus", n));
  const sessions = join(root, ".argus", "sessions");
  let ids = [];
  try { ids = fs.readdirSync(sessions); } catch { return out; }
  for (const id of ids) {
    for (const n of names) out.push(join(sessions, id, n));
    const versions = join(sessions, id, "versions");
    let vs = [];
    try { vs = fs.readdirSync(versions); } catch { continue; }
    for (const v of vs) for (const n of names) out.push(join(versions, v, n));
  }
  return out;
}

function loadBearing(root) {
  let best = null;
  for (const p of bearingCandidates(root)) {
    let st;
    try { st = fs.statSync(p); } catch { continue; }
    let b;
    try { b = JSON.parse(fs.readFileSync(p, "utf8")); } catch { continue; }
    const t = Date.parse(b.generated_at) || st.mtimeMs;
    if (!best || t > best.t) best = { b, t };
  }
  if (!best) return null;
  best.b._ageMs = Date.now() - best.t;
  return best.b;
}

// ─── Live session ────────────────────────────────────────

const LIVE_WINDOW_MS = 15 * 60000;

function loadLiveSession(root) {
  const sessions = join(root, ".argus", "sessions");
  let ids = [];
  try { ids = fs.readdirSync(sessions); } catch { return null; }

  let latest = null;
  for (const id of ids) {
    const p = join(sessions, id, "session.json");
    let st;
    try { st = fs.statSync(p); } catch { continue; }
    if (!latest || st.mtimeMs > latest.mtimeMs) latest = { p, mtimeMs: st.mtimeMs };
  }
  if (!latest || Date.now() - latest.mtimeMs > LIVE_WINDOW_MS) return null;

  let s;
  try { s = JSON.parse(fs.readFileSync(latest.p, "utf8")); } catch { return null; }
  if (!s.phase || s.phase === "complete") return null;

  const drafts = s.drafts || [];
  const active = drafts.find(d => d.id === s.active_draft_id) || drafts[drafts.length - 1];
  return {
    phase: s.phase,
    round: s.round,
    maxRounds: s.max_rounds,
    label: (active && active.version_label) || null,
  };
}

// ─── Contract checks (ledger bets + bearing seed) ────────

function collectChecks(root, bearing, today) {
  const items = loadSealedBets(root).map(d => ({
    date: d.check_by,
    text: d.decision || d.predicate || "",
    kind: "bet",
  }));

  const seed = bearing && bearing.contract_seed;
  if (seed && seed.check_by && ISO_DATE.test(seed.check_by)) {
    items.push({ date: seed.check_by, text: seed.predicate || "", kind: "seed" });
  }

  const horizon = localToday(7);
  const byDate = (a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0);
  return {
    overdue: items.filter(i => i.date < today).sort(byDate),
    dueToday: items.filter(i => i.date === today),
    dueSoon: items.filter(i => i.date > today && i.date <= horizon).sort(byDate),
  };
}

// ─── Colors ──────────────────────────────────────────────

function phaseColor(phase) {
  if (phase === "verifying") return C.y;
  if (phase === "dm_feedback" || phase === "refining") return C.m;
  // team_working/mixing/input are pre-v2.2 phases kept ONLY for sessions
  // written by older versions — no current skill emits them.
  if (phase === "team_deploying" || phase === "team_working" || phase === "mixing") return C.c;
  if (phase === "analyzing" || phase === "conversing" || phase === "input") return C.w;
  return C.y;
}

function courseColor(status, blocked) {
  if (blocked) return C.r;
  if (status === "proceed" || status === "anchor") return C.g;
  if (status === "fork") return C.m;
  return C.y; // hold, revise, collect_evidence, unknown
}

// ─── Line 2: the one Argus line ──────────────────────────

function argusLine(root, budget) {
  const today = localToday();
  const bearing = loadBearing(root);
  const { overdue, dueToday, dueSoon } = collectChecks(root, bearing, today);

  // 1. Overdue: never decays, beats everything.
  if (overdue.length) {
    const o = overdue[0];
    const head = overdue.length > 1 ? `OVERDUE ×${overdue.length}` : "OVERDUE";
    const text = clip((o.kind === "seed" ? "seed: " : "") + o.text, Math.max(16, budget - cells(head) - 26));
    return `📜 ${C.r}${BOLD}${head}${R} ${C.r}${mmdd(o.date)}${R}${SEP}${text}${SEP}${C.d}→ /argus:settle${R}`;
  }

  // 2. Due today: same urgency as overdue, but the honest label —
  //    check_by <= today means "settle now", not "you are late".
  if (dueToday.length) {
    const d0 = dueToday[0];
    const more = dueToday.length > 1 ? ` ${C.d}+${dueToday.length - 1}${R}` : "";
    const text = clip((d0.kind === "seed" ? "seed: " : "") + d0.text, Math.max(16, budget - 36));
    return `📜 ${C.r}${BOLD}due today${R}${SEP}${text}${more}${SEP}${C.d}→ /argus:settle${R}`;
  }

  // 3. A run in progress: transient, footer-appropriate.
  const live = loadLiveSession(root);
  if (live) {
    const parts = [`⚓ ${phaseColor(live.phase)}${live.phase}${R}`];
    if (live.label) parts.push(`${C.c}${live.label}${R}`);
    if (live.round && live.maxRounds && (live.phase === "analyzing" || live.phase === "conversing")) {
      parts.push(`${C.d}Q${live.round}/${live.maxRounds}${R}`);
    }
    return parts.join(SEP);
  }

  // 4. Due within 7 days.
  if (dueSoon.length) {
    const d0 = dueSoon[0];
    const more = dueSoon.length > 1 ? ` ${C.d}+${dueSoon.length - 1}${R}` : "";
    const text = clip((d0.kind === "seed" ? "seed: " : "") + d0.text, Math.max(16, budget - 18));
    return `📜 ${C.y}due ${mmdd(d0.date)}${R}${SEP}${DIM}${text}${R}${more}`;
  }

  // 5–6. Bearing: full while fresh, then decays, then disappears.
  if (!bearing) return null;
  const days = bearing._ageMs / DAY;
  if (days > 14) return null;

  const status = (bearing.current_course && bearing.current_course.status) || "?";
  const sc = courseColor(status, bearing.blocked);

  if (days > 2) {
    return `${DIM}⚓ ${status} · ${Math.round(days)}d ago${R}`;
  }

  const segs = [`⚓ ${sc}${bearing.blocked ? "⛔ " : ""}${BOLD}${status}${R}`];
  const summary = bearing.current_course && bearing.current_course.summary;
  const fog = bearing.fog_or_reef && bearing.fog_or_reef.issue;

  // Fixed overhead: glyphs, separators, age tag. Fog keeps a reserved share —
  // it is the highest-value token and must survive truncation.
  const fixed = 16 + cells(status);
  const fogMax = fog ? Math.max(24, Math.floor((budget - fixed) * 0.45)) : 0;
  const sumMax = Math.max(16, budget - fixed - fogMax);
  if (summary) segs.push(clip(summary, sumMax));
  if (fog) segs.push(`🌫 ${C.y}${clip(fog, fogMax)}${R}`);
  if (bearing._ageMs > DAY) segs.push(`${C.d}${Math.round(bearing._ageMs / 3600000)}h${R}`);
  return segs.join(SEP);
}

// ─── Line 1: harness ─────────────────────────────────────

function bar(pct, w) {
  w = w || 8;
  if (pct == null || isNaN(pct)) pct = 0;
  pct = Math.round(pct);
  const f = Math.min(Math.floor((pct / 100) * w), w);
  const color = pct < 70 ? C.g : pct < 85 ? C.y : C.r;
  return `${color}${"█".repeat(f)}${DIM}${"░".repeat(w - f)}${R} ${color}${pct}%${R}`;
}

function formatDuration(ms) {
  if (!ms) return null;
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  return `${Math.floor(m / 60)}h${m % 60}m`;
}

// Reads .git/HEAD directly instead of spawning git — the statusline runs on
// every render and a subprocess is the single most expensive thing it can do.
function getGitBranch(cwd) {
  return walkUp(cwd, dir => {
    const g = join(dir, ".git");
    let st;
    try { st = fs.statSync(g); } catch { return null; }
    try {
      let gitdir = g;
      if (st.isFile()) { // worktree / submodule: .git is a pointer file
        const m = /^gitdir:\s*(.+?)\s*$/m.exec(fs.readFileSync(g, "utf8"));
        if (!m) return null;
        gitdir = isAbsolute(m[1]) ? m[1] : resolve(dir, m[1]);
      }
      const head = fs.readFileSync(join(gitdir, "HEAD"), "utf8").trim();
      const ref = /^ref: refs\/heads\/(.+)$/.exec(head);
      return ref ? ref[1] : head.slice(0, 8); // detached HEAD → short hash
    } catch { return null; }
  });
}

// ─── Main ────────────────────────────────────────────────

function main() {
  const stdin = readStdin() || {};
  const cwd = stdin.cwd || (stdin.workspace && stdin.workspace.current_dir) || process.cwd();
  const model = (stdin.model && stdin.model.display_name) || "Claude";
  const cols = Number(process.env.COLUMNS) || 110;
  const budget = Math.max(60, cols - 4);

  const out = [];

  let l1 = `${C.c}${model}${R} ${bar((stdin.context_window && stdin.context_window.used_percentage) || 0)}`;
  const meta = [];
  const dur = formatDuration(stdin.cost && stdin.cost.total_duration_ms);
  if (dur) meta.push(`${C.d}${dur}${R}`);
  const branch = getGitBranch(cwd);
  if (branch) meta.push(`${C.m}${branch}${R}`);
  if (meta.length) l1 += ` ${C.d}│${R} ${meta.join(" ")}`;
  out.push(l1);

  try {
    const l2 = argusLine(findArgusRoot(cwd), budget);
    if (l2) out.push(l2);
  } catch { /* an error earns silence, not a broken footer */ }

  process.stdout.write(out.join("\n"));
}

try { main(); } catch { process.stdout.write("Argus"); }
