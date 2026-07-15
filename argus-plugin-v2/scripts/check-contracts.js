#!/usr/bin/env node
/**
 * Argus SessionStart hook — overdue decision-contract check + one-time greeting.
 *
 * Contract: SILENCE IS THE DEFAULT. Three exceptions, never combined (each path
 * returns), in priority order:
 *   1. At least one decision contract is past its check-by date → one line.
 *   2. No overdue contract, but a monitored premise is due to be re-checked
 *      (.argus/items.jsonl) → one line pointing at /argus:premises check.
 *   3. The very first session after install (no marker file yet) → one
 *      orientation line, once per machine, ever. Marketplace installs drop
 *      the user back at the prompt with zero guidance — this is the bridge
 *      to /argus:help. The marker (<config dir>/argus-greeted) is written
 *      BEFORE printing, so a write failure means silence, not a greeting
 *      that repeats forever. An overdue line (or a premise re-check line) also
 *      writes the marker: a user with things to check doesn't need an intro.
 * Never throws, never exits non-zero — a broken hook must not tax the session.
 *
 * Sources scanned (project-scoped, relative to cwd):
 *   1. .argus/ledger/ledger.jsonl — full event replay per
 *      tools/argus-watch/lib/ledger.mjs (the contract): harvest opens a
 *      candidate, seal makes it a bet, amend updates check_by/predicate
 *      (a pushed date must stop the reminder), dismiss/settle close it.
 *   2. .argus/sessions/* /versions/* /current_bearing.json (and the legacy
 *      hyphen spelling) → contract_seed.check_by — SKIPPED when the seed's
 *      synthesized id (bearing:<session-id>:<label>, per settle Step 3) or its
 *      verbatim predicate already appears in the ledger: once a seed is
 *      imported, the ledger is the single replayable source and the bearing
 *      file (which settle never mutates) must not re-trigger the reminder.
 */

const fs = require("fs");
const path = require("path");
const os = require("os");

const BEARING_NAMES = ["current_bearing.json", "current-bearing.json"];

// Claude Code's user config dir; CLAUDE_CONFIG_DIR overrides ~/.claude
// (also what the fixture tests use to isolate the greeting marker).
function configDir() {
  return process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), ".claude");
}
const GREET_MARKER = "argus-greeted";

function localToday() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// check_by may be a date ("2026-07-01") or prose ("30 days after release").
// Only dates are mechanically comparable; prose entries are skipped.
function asDate(value) {
  if (typeof value !== "string") return null;
  const m = value.match(/(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
}

function clip(text, max) {
  if (typeof text !== "string") return "";
  return text.length <= max ? text : text.slice(0, max - 1) + "…";
}

// Strip a UTF-8 BOM: PowerShell 5.1's `Out-File -Encoding utf8` writes one,
// Node's "utf8" read keeps it, and JSON.parse then throws — which on Windows
// silently disappears every bearing/ledger a user ever touched with PS
// tooling (no reminder, no statusline, and the greeting fires instead).
function deBom(s) {
  return s.charCodeAt(0) === 0xfeff ? s.slice(1) : s;
}

function readJson(file) {
  try {
    return JSON.parse(deBom(fs.readFileSync(file, "utf8")));
  } catch {
    return null;
  }
}

/**
 * Replay the ledger per ledger.mjs semantics. Returns:
 *   overdue          — sealed bets with check_by ≤ today
 *   ids              — every id ever seen (seed-import dedup)
 *   sealedPredicates — every predicate ever sealed (dedup for seeds sealed
 *                      under a foreign id, e.g. manually via argus-watch)
 */
function replayLedger(argusDir, today) {
  const ids = new Set();
  const sealedPredicates = new Set();
  const map = new Map();
  let raw;
  try {
    raw = deBom(fs.readFileSync(path.join(argusDir, "ledger", "ledger.jsonl"), "utf8"));
  } catch {
    return { overdue: [], ids, sealedPredicates };
  }
  for (const line of raw.split("\n")) {
    if (!line.trim()) continue;
    let ev;
    try { ev = JSON.parse(line); } catch { continue; }
    if (!ev.id) continue;
    ids.add(ev.id);
    const cur = map.get(ev.id);
    switch (ev.event) {
      case "harvest":
        if (!cur) map.set(ev.id, { status: "candidate", text: ev.decision || ev.quote || "" });
        break;
      case "seal":
        if (typeof ev.predicate === "string") sealedPredicates.add(ev.predicate);
        if (cur) {
          cur.status = "sealed";
          if (ev.predicate != null) cur.text = ev.predicate;
          cur.check_by = ev.check_by;
        }
        break;
      case "amend":
        if (cur) {
          if (ev.predicate != null) cur.text = ev.predicate;
          if (ev.check_by != null) cur.check_by = ev.check_by;
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
  const overdue = [];
  for (const item of map.values()) {
    if (item.status !== "sealed") continue;
    const date = asDate(item.check_by);
    if (date && date <= today) overdue.push({ date, text: item.text || "" });
  }
  return { overdue, ids, sealedPredicates };
}

function bearingContracts(argusDir, today, ledger) {
  const out = [];

  // One dir's seed, deduped against the ledger by import id and by verbatim
  // predicate (root/session-level bearings have no version label, so their
  // synthesized id may differ — the predicate is the universal key).
  function collectSeed(dir, importId) {
    if (importId && ledger.ids.has(importId)) return; // imported → ledger owns it
    for (const name of BEARING_NAMES) {
      const bearing = readJson(path.join(dir, name));
      const seed = bearing && bearing.contract_seed;
      if (!seed) continue;
      if (typeof seed.predicate === "string" && ledger.sealedPredicates.has(seed.predicate)) return;
      const date = asDate(seed.check_by);
      if (date && date <= today && typeof seed.predicate === "string") {
        out.push({ date, text: seed.predicate });
      }
      return; // first spelling WITH a seed wins; never count one dir twice
    }
  }

  // Root-level bearing (legacy/webapp emission) — same coverage as the
  // statusline, so a seed can never light one surface and not the other.
  collectSeed(argusDir, null);

  const sessions = path.join(argusDir, "sessions");
  let ids = [];
  try { ids = fs.readdirSync(sessions); } catch { return out; }
  for (const id of ids) {
    collectSeed(path.join(sessions, id), null); // session-level (legacy)
    const versions = path.join(sessions, id, "versions");
    let labels = [];
    try { labels = fs.readdirSync(versions); } catch { continue; }
    for (const label of labels) {
      collectSeed(path.join(versions, label), `bearing:${id}:${label}`);
    }
  }
  return out;
}

/**
 * Count monitored premises due for a re-check (the living-premises return-loop;
 * design: internal design notes). Replays `.argus/items.jsonl`
 * (append-only, same shape as /argus:premises). A premise is DUE when it is an active,
 * external, on_change premise that has NOT backed off (fewer than 2 dismisses) and
 * was either never re-checked or last re-checked 7+ days ago. Fast + defensive:
 * missing file or bad lines → 0, never throws.
 */
function duePremises(argusDir, today) {
  let raw;
  try { raw = deBom(fs.readFileSync(path.join(argusDir, "items.jsonl"), "utf8")); }
  catch { return 0; }
  const map = new Map();
  for (const line of raw.split("\n")) {
    if (!line.trim()) continue;
    let ev;
    try { ev = JSON.parse(line); } catch { continue; }
    if (!ev.id) continue;
    const cur = map.get(ev.id);
    switch (ev.event) {
      case "extract":
      case "add": {
        const external = ev.external === true;
        const load = ev.load_bearing === true;
        // Mirror decision-items.ts defaultAlertMode: only a load-bearing external
        // premise starts monitored; everything else off (opt-out).
        const mode = ev.type === "premise" && external && load ? "on_change" : "off";
        map.set(ev.id, { type: ev.type, external, mode, dismissals: 0, status: "active", last: null });
        break;
      }
      case "alert": if (cur && typeof ev.mode === "string") cur.mode = ev.mode; break;
      case "recheck": if (cur) cur.last = asDate(ev.at) || cur.last; break;
      case "dismiss": if (cur) cur.dismissals++; break;
      case "edit": if (cur && ev.action === "reject") cur.status = "retired"; break;
    }
  }
  const dueBefore = new Date(Date.parse(today) - 7 * 86400000).toISOString().slice(0, 10);
  let count = 0;
  for (const it of map.values()) {
    if (it.type !== "premise" || !it.external || it.mode !== "on_change") continue;
    if (it.status !== "active" || it.dismissals >= 2) continue;
    if (!it.last || it.last <= dueBefore) count++;
  }
  return count;
}

function detectLocale(argusDir) {
  try {
    const cfg = fs.readFileSync(path.join(argusDir, "config.yaml"), "utf8");
    const m = cfg.match(/^locale:\s*(ko|en)\b/m);
    if (m) return m[1];
  } catch { /* no config = no signal */ }
  // Pre-first-run there is no config — same ladder as sail Step 0:
  const env = process.env.LANG || process.env.LC_ALL || "";
  if (/^ko/i.test(env)) return "ko";
  try {
    if (/^ko/i.test(Intl.DateTimeFormat().resolvedOptions().locale)) return "ko";
  } catch { /* Intl unavailable → en */ }
  return "en";
}

/** Write the once-per-machine marker; silence on failure. Returns success. */
function markGreeted() {
  try {
    fs.mkdirSync(configDir(), { recursive: true });
    fs.writeFileSync(path.join(configDir(), GREET_MARKER), new Date().toISOString() + "\n");
    return true;
  } catch {
    return false;
  }
}

function greeted() {
  try { return fs.existsSync(path.join(configDir(), GREET_MARKER)); }
  catch { return true; } // can't know → assume greeted, stay silent
}

function main() {
  const argusDir = path.join(process.cwd(), ".argus");
  const today = localToday();
  const hasArgus = fs.existsSync(argusDir);
  const ledger = hasArgus ? replayLedger(argusDir, today) : null;
  const overdue = hasArgus
    ? ledger.overdue
        .concat(bearingContracts(argusDir, today, ledger))
        .sort((a, b) => (a.date < b.date ? -1 : 1))
    : [];

  if (overdue.length) {
    markGreeted(); // settling contracts ⇒ no introduction needed, ever
    const locale = detectLocale(argusDir);
    const first = clip(overdue[0].text, 80);
    if (locale === "ko") {
      process.stdout.write(
        `Argus: 확인일이 지난 결정 계약 ${overdue[0].date}${overdue.length > 1 ? ` 외 ${overdue.length - 1}건` : ""} — "${first}" 이 예측, 현실은 어땠는지 정산할 때가 됐어요 (/argus:resolve).`
      );
    } else {
      process.stdout.write(
        `Argus: ${overdue.length} decision contract${overdue.length > 1 ? "s are" : " is"} past check-by (${overdue[0].date}) — "${first}" It's time to check this prediction against reality (/argus:resolve).`
      );
    }
    return;
  }

  // Living-premises re-check reminder — a third, lower-priority exception, only
  // when no contract is overdue (the overdue block above returns first, so this
  // never combines with it — the one-line contract holds). Fires when a monitored
  // premise is due to be re-checked against reality.
  if (hasArgus) {
    const nPrem = duePremises(argusDir, today);
    if (nPrem > 0) {
      markGreeted(); // a user with premises to re-check doesn't need an intro
      const locale = detectLocale(argusDir);
      process.stdout.write(
        locale === "ko"
          ? `Argus: 재확인할 전제 ${nPrem}개 — 결정의 근거가 된 사실이 아직 맞는지 확인할 때가 됐어요 (/argus:premises check).`
          : `Argus: ${nPrem} premise${nPrem > 1 ? "s" : ""} to re-check — time to see if the facts your decision rests on still hold (/argus:premises check).`,
      );
      return;
    }
  }

  // First session after install: one orientation line, once per machine.
  if (greeted()) return; // the default outcome — silence
  if (!markGreeted()) return; // can't persist "shown once" → don't show at all
  const locale = detectLocale(argusDir);
  if (locale === "ko") {
    process.stdout.write(
      "Argus 준비 완료: 결정을 정리하고, 나중에 확인할 기준을 남기고, 시간이 지난 뒤 실제로 어땠는지 묻습니다. 시작은 /argus:sail, 전체 안내는 /argus:help."
    );
  } else {
    process.stdout.write(
      "Argus ready: make a decision, save the check for later, then come back to reality. Start with /argus:sail. Full map: /argus:help."
    );
  }
}

try { main(); } catch { /* silence over noise */ }
