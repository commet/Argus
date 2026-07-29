#!/usr/bin/env node
/**
 * Argus SessionStart hook — overdue decision-contract check + one-time greeting.
 *
 * Contract: SILENCE IS THE DEFAULT. Three exceptions, never combined (each path
 * returns), in priority order:
 *   1. At least one decision contract is past its check-by date → one line.
 *   2. No overdue contract, but a monitored premise is due to be re-checked
 *      (.argus/items.jsonl) → one line pointing at /argus:check premises.
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

/** v2 바인딩(.argus/project.json)이 있으면 내구 원장 파일들을 돌려준다 —
 *  statusline durableLedgerFiles와 같은 규약 (ARGUS_HOME 재지정 포함). */
function durableLedgerFiles(argusDir) {
  try {
    const pj = JSON.parse(deBom(fs.readFileSync(path.join(argusDir, "project.json"), "utf8")));
    if (!pj || typeof pj.repository_id !== "string" || !pj.repository_id) return null;
    const home = process.env.ARGUS_HOME && process.env.ARGUS_HOME.trim()
      ? process.env.ARGUS_HOME
      : path.join(os.homedir(), ".argus");
    const dir = path.join(home, "projects", pj.repository_id);
    return [path.join(dir, "ledger.v1.jsonl"), path.join(dir, "ledger.jsonl")];
  } catch { return null; }
}

/** v2 이벤트(v:2) 한 줄을 v1과 같은 bet 모형으로 접는다 — statusline
 *  applyV2Line과 동형 (내구 원장을 접을 때만 만난다). provenanced 필드는
 *  .value만 취한다. v2엔 defer가 설계상 없다: mirror가 v1 defer →
 *  v2 amend(check_by)로 매핑하므로 amend가 재무장을 커버한다 (죽은 어휘
 *  분기 금지 — O2 방0 ② 정정과 같은 NOTE). */
function applyV2Line(e, map, ids, sealedPredicates) {
  const id = e.decision_id;
  if (!id) return;
  ids.add(id);
  const cur = map.get(id);
  const val = (f) => (e[f] && typeof e[f].value === "string" ? e[f].value : undefined);
  switch (e.event) {
    case "harvest":
      if (!cur) map.set(id, { status: "candidate", text: val("text") || "" });
      break;
    case "seal": {
      const rec = cur || {};
      rec.status = "sealed";
      if (val("predicate")) { rec.text = val("predicate"); sealedPredicates.add(rec.text); }
      if (val("check_by")) rec.check_by = val("check_by");
      map.set(id, rec);
      break;
    }
    case "amend":
      if (cur) {
        if (val("predicate")) cur.text = val("predicate");
        if (val("check_by")) cur.check_by = val("check_by");
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

/**
 * Replay the ledger per ledger.mjs semantics. Returns:
 *   overdue          — sealed bets with check_by ≤ today
 *   ids              — every id ever seen (seed-import dedup)
 *   sealedPredicates — every predicate ever sealed (dedup for seeds sealed
 *                      under a foreign id, e.g. manually via argus-watch)
 *
 * due 발화의 단일 소유자(O3 방2)로서 두 저장 평면을 전부 접는다: 바인딩된
 * repo면 내구 원장(v1 스냅샷 + v2) UNION 프로젝트 v1 — statusline loadLedger와
 * 같은 규약(O2 방4 정본 2겹: v2 소비자는 프로젝트 v1과 union으로 접는다).
 * 같은 논리 이벤트의 중복 fold는 상태 설정이라 멱등. session-start 훅은 이제
 * due 건수를 발화하지 않는다(LOGBOOK 신선도·첫 안내·수확 큐만) — 발화 두뇌가
 * 둘이면 같은 due가 두 줄로 도착한다.
 */
function replayLedger(argusDir, today) {
  const ids = new Set();
  const sealedPredicates = new Set();
  const map = new Map();
  const projectV1 = path.join(argusDir, "ledger", "ledger.jsonl");
  const durable = durableLedgerFiles(argusDir);
  const files = durable ? [...durable, projectV1] : [projectV1];
  for (const file of files) {
    let raw;
    try { raw = deBom(fs.readFileSync(file, "utf8")); }
    catch { continue; } // 없는 파일(예: v1 스냅샷 미존재)은 조용히 — 침묵이 계약
    foldV1Raw(raw, map, ids, sealedPredicates);
  }
  const overdue = [];
  for (const item of map.values()) {
    if (item.status !== "sealed") continue;
    const date = asDate(item.check_by);
    if (date && date <= today) overdue.push({ date, text: item.text || "" });
  }
  return { overdue, ids, sealedPredicates };
}

function foldV1Raw(raw, map, ids, sealedPredicates) {
  for (const line of raw.split("\n")) {
    if (!line.trim()) continue;
    let ev;
    try { ev = JSON.parse(line); } catch { continue; }
    if (ev.v === 2) { applyV2Line(ev, map, ids, sealedPredicates); continue; }
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
        } else {
          // Self-create on a bare seal (O2 방1 backlog ⑥): the MCP replay and
          // the statusline both open an entry when seal arrives without a
          // prior harvest — this reader silently skipped it, so such a bet
          // could never fire the reminder while lighting other surfaces.
          map.set(ev.id, { status: "sealed", text: ev.predicate || "", check_by: ev.check_by });
        }
        break;
      case "amend":
        if (cur) {
          if (ev.predicate != null) cur.text = ev.predicate;
          if (ev.check_by != null) cur.check_by = ev.check_by;
        }
        break;
      case "defer":
        // MCP-side still_pending re-arm — check_by moves forward, bet stays
        // sealed. Without this case the reminder kept firing on the OLD date
        // after the user already answered "not yet" (O2 방1 finding ③).
        if (cur && ev.check_by != null) cur.check_by = ev.check_by;
        break;
      case "dismiss":
        if (cur) cur.status = "dismissed";
        break;
      case "settle":
        if (cur) cur.status = "settled";
        break;
    }
  }
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
 * (append-only, same shape as /argus:check premises). A premise is DUE when it is an active,
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
        `Argus: 확인일이 지난 결정 계약 ${overdue[0].date}${overdue.length > 1 ? ` 외 ${overdue.length - 1}건` : ""} — "${first}" 이 예측, 현실은 어땠는지 정산할 때가 됐어요 (/argus:check).`
      );
    } else {
      process.stdout.write(
        `Argus: ${overdue.length} decision contract${overdue.length > 1 ? "s are" : " is"} past check-by (${overdue[0].date}) — "${first}" It's time to check this prediction against reality (/argus:check).`
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
          ? `Argus: 재확인할 전제 ${nPrem}개 — 결정의 근거가 된 사실이 아직 맞는지 확인할 때가 됐어요 (/argus:check premises).`
          : `Argus: ${nPrem} premise${nPrem > 1 ? "s" : ""} to re-check — time to see if the facts your decision rests on still hold (/argus:check premises).`,
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
      "Argus 준비 완료: 결정을 그냥 말하면 정리하고, 나중에 확인할 기준을 남기고, 시간이 지나면 실제로 어땠는지 묻습니다. 깊은 검토는 /argus:review, 전체 안내는 /argus:help."
    );
  } else {
    process.stdout.write(
      "Argus ready: just talk about a decision — save the check for later, then come back to reality. Deep review: /argus:review. Full map: /argus:help."
    );
  }
}

try { main(); } catch { /* silence over noise */ }
