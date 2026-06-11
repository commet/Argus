#!/usr/bin/env node
/**
 * Argus SessionStart hook — overdue decision-contract check.
 *
 * Contract: SILENCE IS THE DEFAULT. Prints exactly one line when at least one
 * decision contract is past its check-by date; prints nothing otherwise.
 * Never throws, never exits non-zero — a broken hook must not tax the session.
 *
 * Sources scanned (project-scoped, relative to cwd):
 *   1. .argus/sessions/* /versions/* /current_bearing.json → contract_seed.check_by
 *   2. .argus/ledger/ledger.jsonl → seal events (argus-watch / helm format),
 *      minus settled ids (settle events; later seal for same id amends check_by).
 */

const fs = require("fs");
const path = require("path");

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

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return null;
  }
}

function bearingContracts(argusDir, today) {
  const out = [];
  const sessions = path.join(argusDir, "sessions");
  let ids = [];
  try { ids = fs.readdirSync(sessions); } catch { return out; }
  for (const id of ids) {
    const versions = path.join(sessions, id, "versions");
    let labels = [];
    try { labels = fs.readdirSync(versions); } catch { continue; }
    for (const label of labels) {
      const bearing = readJson(path.join(versions, label, "current_bearing.json"));
      const seed = bearing && bearing.contract_seed;
      const date = seed && asDate(seed.check_by);
      if (date && date <= today && typeof seed.predicate === "string") {
        out.push({ date, text: seed.predicate });
      }
    }
  }
  return out;
}

function ledgerContracts(argusDir, today) {
  const out = [];
  let raw;
  try {
    raw = fs.readFileSync(path.join(argusDir, "ledger", "ledger.jsonl"), "utf8");
  } catch {
    return out;
  }
  const open = new Map(); // id → {date, text}; replay: seal upserts, settle deletes
  for (const line of raw.split("\n")) {
    if (!line.trim()) continue;
    let ev;
    try { ev = JSON.parse(line); } catch { continue; }
    if (ev.event === "seal" && ev.id) {
      const date = asDate(ev.check_by);
      if (date) open.set(ev.id, { date, text: ev.predicate || "" });
    } else if (ev.event === "settle" && ev.id) {
      open.delete(ev.id);
    }
  }
  for (const item of open.values()) {
    if (item.date <= today) out.push(item);
  }
  return out;
}

function detectLocale(argusDir) {
  try {
    const cfg = fs.readFileSync(path.join(argusDir, "config.yaml"), "utf8");
    const m = cfg.match(/^locale:\s*(ko|en)\b/m);
    if (m) return m[1];
  } catch { /* no config = no signal */ }
  return "en";
}

function main() {
  const argusDir = path.join(process.cwd(), ".argus");
  if (!fs.existsSync(argusDir)) return; // not an Argus project — total silence

  const today = localToday();
  const overdue = bearingContracts(argusDir, today)
    .concat(ledgerContracts(argusDir, today))
    .sort((a, b) => (a.date < b.date ? -1 : 1));

  if (!overdue.length) return; // the default outcome

  const locale = detectLocale(argusDir);
  const first = clip(overdue[0].text, 80);
  if (locale === "ko") {
    process.stdout.write(
      `Argus: 확인일이 지난 결정 계약 ${overdue[0].date}${overdue.length > 1 ? ` 외 ${overdue.length - 1}건` : ""} — "${first}" 이 예측, 현실은 어땠는지 정산할 때가 됐어요 (/argus:settle).`
    );
  } else {
    process.stdout.write(
      `Argus: ${overdue.length} decision contract${overdue.length > 1 ? "s are" : " is"} past check-by (${overdue[0].date}) — "${first}" It's time to check this prediction against reality (/argus:settle).`
    );
  }
}

try { main(); } catch { /* silence over noise */ }
