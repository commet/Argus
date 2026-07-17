#!/usr/bin/env node
/**
 * Fixture tests for scripts/check-contracts.js (the SessionStart hook).
 * The hook's contract: silence is the default; exactly one line when at least
 * one contract is past check-by; never a non-zero exit, never a stack trace.
 * Run: node scripts/test-check-contracts.mjs
 */
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const SCRIPT = join(dirname(fileURLToPath(import.meta.url)), "check-contracts.js");
const DAY = 86400000;

/** Local-timezone ISO date, offset in days — must match the hook's localToday(). */
function iso(offsetDays = 0) {
  const d = new Date(Date.now() + offsetDays * DAY);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

const repos = [];
function repo() {
  const d = mkdtempSync(join(tmpdir(), "argus-cc-"));
  repos.push(d);
  return d;
}

// The hook greets ONCE per machine, keyed on <CLAUDE_CONFIG_DIR>/argus-greeted.
// Default every test to an already-greeted config dir so the contract tests
// stay about contracts; greeting tests pass their own fresh dir.
const GREETED_CONFIG = repo();
writeFileSync(join(GREETED_CONFIG, "argus-greeted"), "test\n");

function run(cwd, env = {}) {
  const r = spawnSync(process.execPath, [SCRIPT], {
    cwd, encoding: "utf8",
    env: { ...process.env, CLAUDE_CONFIG_DIR: GREETED_CONFIG, ...env },
  });
  if (r.status !== 0) throw new Error(`exit ${r.status}: ${r.stderr}`);
  return r.stdout;
}

function ledger(root, events) {
  mkdirSync(join(root, ".argus", "ledger"), { recursive: true });
  writeFileSync(
    join(root, ".argus", "ledger", "ledger.jsonl"),
    events.map(e => JSON.stringify(e)).join("\n") + "\n",
  );
}

function bet(id, checkBy, decision, extraEvents = []) {
  return [
    { event: "harvest", id, decision, quote: decision },
    { event: "seal", id, predicate: `${decision} — predicate`, check_by: checkBy },
    ...extraEvents.map(e => ({ ...e, id })),
  ];
}

function seedBearing(root, sessionId, label, seed, name = "current_bearing.json") {
  const dir = join(root, ".argus", "sessions", sessionId, "versions", label);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, name), JSON.stringify({
    label,
    current_course: { status: "proceed", summary: "s" },
    contract_seed: seed,
    generated_at: new Date().toISOString(),
  }));
}

let fails = 0;
function t(name, fn) {
  try { fn(); process.stdout.write(`ok   ${name}\n`); }
  catch (e) { fails++; process.stdout.write(`FAIL ${name}: ${e.message}\n`); }
}
function assert(cond, msg) { if (!cond) throw new Error(msg); }

// ─── Silence is the default ─────────────────────────────

t("no .argus dir → total silence", () => {
  assert(run(repo()) === "", "must print nothing outside an Argus project");
});

t("empty .argus → silence", () => {
  const r = repo();
  mkdirSync(join(r, ".argus"), { recursive: true });
  assert(run(r) === "", "empty project must be silent");
});

t("sealed bet due in the future → silence", () => {
  const r = repo();
  ledger(r, bet("aaaa0001", iso(10), "미래의 결정"));
  assert(run(r) === "", "future check-by must be silent");
});

// ─── Ledger replay ──────────────────────────────────────

t("overdue sealed bet → one line with /argus:resolve", () => {
  const r = repo();
  ledger(r, bet("aaaa0001", iso(-3), "지난 결정"));
  const out = run(r);
  assert(out.includes("/argus:resolve"), `missing settle hint: ${out}`);
  assert(out.includes(iso(-3)), `missing date: ${out}`);
  assert(!out.includes("\n"), `must be exactly one line: ${out}`);
});

t("check-by today → fires (settle treats ≤ today as due)", () => {
  const r = repo();
  ledger(r, bet("aaaa0001", iso(0), "오늘 결정"));
  assert(run(r).includes("/argus:resolve"), "due-today must fire");
});

t("settled bet → silence", () => {
  const r = repo();
  ledger(r, bet("aaaa0001", iso(-3), "정산 끝", [{ event: "settle", outcome: "happened" }]));
  assert(run(r) === "", "settled must be silent");
});

t("amend pushes check_by → silence (the 'push the date' path)", () => {
  const r = repo();
  ledger(r, bet("aaaa0001", iso(-5), "미룬 결정", [{ event: "amend", check_by: iso(14) }]));
  assert(run(r) === "", "amended (pushed) contract must not nag with the stale date");
});

t("amend pulls check_by into the past → fires", () => {
  const r = repo();
  ledger(r, bet("aaaa0001", iso(10), "당긴 결정", [{ event: "amend", check_by: iso(-1) }]));
  assert(run(r).includes("/argus:resolve"), "amended-overdue must fire");
});

t("MCP defer (still_pending re-arm) → silence until the NEW date (O2 방1 finding ③)", () => {
  const r = repo();
  ledger(r, bet("aaaa0001", iso(-5), "아직 모르는 결정", [{ event: "defer", from: iso(-5), check_by: iso(14) }]));
  assert(run(r) === "", "deferred contract must not keep nagging on the stale date");
});

t("dismissed contract → silence", () => {
  const r = repo();
  ledger(r, bet("aaaa0001", iso(-3), "기각된 결정", [{ event: "dismiss" }]));
  assert(run(r) === "", "dismissed must be silent");
});

t("unsealed candidate → silence", () => {
  const r = repo();
  ledger(r, [{ event: "harvest", id: "cccc0001", decision: "후보일 뿐", quote: "q" }]);
  assert(run(r) === "", "candidate without seal must be silent");
});

t("two overdue → count in line, oldest date", () => {
  const r = repo();
  ledger(r, [...bet("aaaa0001", iso(-10), "old"), ...bet("aaaa0002", iso(-1), "new")]);
  const out = run(r);
  assert(/2 decision contracts|외 1건/.test(out), `missing count: ${out}`);
  assert(out.includes(iso(-10)), `oldest date must lead: ${out}`);
});

t("corrupt ledger lines → skipped, valid events survive", () => {
  const r = repo();
  mkdirSync(join(r, ".argus", "ledger"), { recursive: true });
  writeFileSync(join(r, ".argus", "ledger", "ledger.jsonl"),
    "not json\n" + bet("aaaa0001", iso(-1), "살아남은 결정").map(e => JSON.stringify(e)).join("\n") + "\n{broken",
  );
  assert(run(r).includes("/argus:resolve"), "valid events must survive corrupt lines");
});

// ─── Bearing seeds ──────────────────────────────────────

t("overdue bearing seed → fires", () => {
  const r = repo();
  seedBearing(r, "s1", "v0.1", { predicate: "시드 예측", check_by: iso(-2) });
  const out = run(r);
  assert(out.includes("시드 예측") && out.includes("/argus:resolve"), `seed must fire: ${out}`);
});

t("legacy hyphen spelling seed → fires", () => {
  const r = repo();
  seedBearing(r, "s1", "v0.1", { predicate: "하이픈 시드", check_by: iso(-2) }, "current-bearing.json");
  assert(run(r).includes("하이픈 시드"), "hyphen-spelled bearing must be read too");
});

t("prose check_by → silence (not mechanically comparable)", () => {
  const r = repo();
  seedBearing(r, "s1", "v0.1", { predicate: "p", check_by: "런칭 30일 후" });
  assert(run(r) === "", "prose dates must be skipped");
});

t("seed imported + settled in ledger → silence", () => {
  const r = repo();
  seedBearing(r, "s1", "v0.1", { predicate: "임포트된 예측", check_by: iso(-3) });
  ledger(r, [
    { event: "harvest", id: "bearing:s1:v0.1", decision: "d", quote: "임포트된 예측" },
    { event: "seal", id: "bearing:s1:v0.1", predicate: "임포트된 예측", check_by: iso(-3) },
    { event: "settle", id: "bearing:s1:v0.1", outcome: "happened" },
  ]);
  assert(run(r) === "", "settled imported seed must not re-trigger from the bearing file");
});

t("seed imported + pushed via amend → silence", () => {
  const r = repo();
  seedBearing(r, "s1", "v0.1", { predicate: "미룬 시드", check_by: iso(-3) });
  ledger(r, [
    { event: "harvest", id: "bearing:s1:v0.1", decision: "d", quote: "미룬 시드" },
    { event: "seal", id: "bearing:s1:v0.1", predicate: "미룬 시드", check_by: iso(-3) },
    { event: "amend", id: "bearing:s1:v0.1", check_by: iso(14) },
  ]);
  assert(run(r) === "", "pushed imported seed must not nag with the bearing's stale date");
});

t("seed imported but still open → fires ONCE (ledger owns it)", () => {
  const r = repo();
  seedBearing(r, "s1", "v0.1", { predicate: "열린 시드", check_by: iso(-3) });
  ledger(r, [
    { event: "harvest", id: "bearing:s1:v0.1", decision: "d", quote: "열린 시드" },
    { event: "seal", id: "bearing:s1:v0.1", predicate: "열린 시드", check_by: iso(-3) },
  ]);
  const out = run(r);
  assert(out.includes("/argus:resolve"), `open imported seed is still due: ${out}`);
  assert(!/2|외/.test(out.replace(iso(-3), "")), `must not double-count: ${out}`);
});

t("seed sealed under a foreign id (same predicate) → deduped", () => {
  const r = repo();
  seedBearing(r, "s1", "v0.1", { predicate: "수동 봉인 예측", check_by: iso(-3) });
  ledger(r, bet("dddd0001", iso(-3), "수동", [{ event: "settle", outcome: "partial" }])
    .map(e => (e.event === "seal" ? { ...e, predicate: "수동 봉인 예측" } : e)));
  assert(run(r) === "", "predicate-matched seed must defer to the ledger");
});

// ─── Locale ─────────────────────────────────────────────

t("locale ko in config.yaml → Korean line", () => {
  const r = repo();
  mkdirSync(join(r, ".argus"), { recursive: true });
  writeFileSync(join(r, ".argus", "config.yaml"), "locale: ko\n");
  ledger(r, bet("aaaa0001", iso(-1), "한국어 결정"));
  const out = run(r);
  assert(out.includes("정산할 때") && out.includes("/argus:resolve"), `expected ko line: ${out}`);
});

t("UTF-8 BOM bearing (PS 5.1 Out-File) → still fires", () => {
  const r = repo();
  const dir = join(r, ".argus", "sessions", "s1", "versions", "v0.1");
  mkdirSync(dir, { recursive: true });
  const json = JSON.stringify({ label: "v0.1", contract_seed: { predicate: "BOM 시드", check_by: iso(-2) } });
  writeFileSync(join(dir, "current_bearing.json"), "﻿" + json);
  const out = run(r);
  assert(out.includes("BOM 시드"), `BOM-prefixed bearing must still be read: ${out}`);
});

t("UTF-8 BOM ledger → still replayed", () => {
  const r = repo();
  mkdirSync(join(r, ".argus", "ledger"), { recursive: true });
  writeFileSync(join(r, ".argus", "ledger", "ledger.jsonl"),
    "﻿" + bet("aaaa0001", iso(-1), "BOM 원장").map(e => JSON.stringify(e)).join("\n") + "\n");
  assert(run(r).includes("/argus:resolve"), "BOM-prefixed ledger must still fire");
});

t("root-level bearing seed → fires (statusline coverage parity)", () => {
  const r = repo();
  mkdirSync(join(r, ".argus"), { recursive: true });
  writeFileSync(join(r, ".argus", "current-bearing.json"), JSON.stringify({
    label: "v0.1", contract_seed: { predicate: "루트 시드", check_by: iso(-1) },
  }));
  assert(run(r).includes("루트 시드"), "root-level seed must alert like the statusline does");
});

t("root-level seed sealed by predicate → silence", () => {
  const r = repo();
  mkdirSync(join(r, ".argus"), { recursive: true });
  writeFileSync(join(r, ".argus", "current-bearing.json"), JSON.stringify({
    label: "v0.1", contract_seed: { predicate: "루트 봉인 시드", check_by: iso(-1) },
  }));
  ledger(r, bet("eeee0001", iso(-1), "x", [{ event: "settle", outcome: "happened" }])
    .map(e => (e.event === "seal" ? { ...e, predicate: "루트 봉인 시드" } : e)));
  assert(run(r) === "", "root seed settled under any id must be silent");
});

// ─── First-session greeting (once per machine) ──────────

t("first session ever → one greeting line, then permanent silence", () => {
  const cfg = repo(); // fresh config dir: no marker yet
  const r = repo();
  const first = run(r, { CLAUDE_CONFIG_DIR: cfg, LANG: "en_US.UTF-8" });
  assert(first.includes("/argus:help"), `greeting must point at /argus:help: ${first}`);
  assert(!first.includes("\n"), `greeting must be one line: ${first}`);
  assert(run(r, { CLAUDE_CONFIG_DIR: cfg }) === "", "second session must be silent");
});

t("LANG=ko → Korean greeting", () => {
  const cfg = repo();
  const out = run(repo(), { CLAUDE_CONFIG_DIR: cfg, LANG: "ko_KR.UTF-8" });
  assert(out.includes("준비 완료") && out.includes("/argus:help"), `expected ko greeting: ${out}`);
});

t("overdue beats greeting — and still burns the marker", () => {
  const cfg = repo();
  const r = repo();
  ledger(r, bet("aaaa0001", iso(-1), "기존 사용자 결정"));
  const out = run(r, { CLAUDE_CONFIG_DIR: cfg });
  assert(out.includes("/argus:resolve") && !out.includes("/argus:help"), `overdue line must win: ${out}`);
  assert(run(repo(), { CLAUDE_CONFIG_DIR: cfg }) === "", "user with contracts never gets the intro later");
});

t("config dir not writable → silence, never a repeating greeting", () => {
  const r = repo();
  const blocker = join(r, "blocker");
  writeFileSync(blocker, "file, not a dir");
  const out = run(r, { CLAUDE_CONFIG_DIR: join(blocker, "sub") }); // mkdir under a file fails
  assert(out === "", `marker write failure must mean silence: ${out}`);
});

// ─── Robustness ─────────────────────────────────────────

t("corrupt bearing json → silence, exit 0", () => {
  const r = repo();
  const dir = join(r, ".argus", "sessions", "s1", "versions", "v0.1");
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "current_bearing.json"), "{not valid");
  assert(run(r) === "", "corrupt bearing must degrade to silence");
});

// ─── Living-premises re-check reminder (.argus/items.jsonl) ──────────────────

function items(root, events) {
  mkdirSync(join(root, ".argus"), { recursive: true });
  writeFileSync(join(root, ".argus", "items.jsonl"), events.map(e => JSON.stringify(e)).join("\n") + "\n");
}
function premise(id, extra = {}) {
  return { event: "extract", id, decision_id: "d", type: "premise", text: "금리 동결", external: true, load_bearing: true, ...extra };
}

t("due monitored premise → one line with /argus:premises check", () => {
  const r = repo();
  items(r, [premise("item_p1")]); // never re-checked → due
  const out = run(r);
  assert(out.includes("/argus:premises check"), `missing re-check hint: ${out}`);
  assert(!out.includes("\n"), `must be one line: ${out}`);
});

t("non-load-bearing premise (mode off) → silence", () => {
  const r = repo();
  items(r, [premise("item_p1", { load_bearing: false })]);
  assert(run(r) === "", "opt-out default: non-monitored premise stays silent");
});

t("non-external premise → silence", () => {
  const r = repo();
  items(r, [premise("item_p1", { external: false })]);
  assert(run(r) === "", "a non-external premise is not reality-checkable → silent");
});

t("premise re-checked recently (<7d) → silence", () => {
  const r = repo();
  items(r, [premise("item_p1"), { event: "recheck", id: "item_p1", last_value: "v", at: iso(-2) }]);
  assert(run(r) === "", "recently re-checked premise is not due");
});

t("premise re-checked 8+ days ago → fires", () => {
  const r = repo();
  items(r, [premise("item_p1"), { event: "recheck", id: "item_p1", last_value: "v", at: iso(-8) }]);
  assert(run(r).includes("/argus:premises check"), "a stale re-check is due again");
});

t("premise dismissed twice (back-off) → silence", () => {
  const r = repo();
  items(r, [premise("item_p1"), { event: "dismiss", id: "item_p1" }, { event: "dismiss", id: "item_p1" }]);
  assert(run(r) === "", "backed-off premise must go quiet");
});

t("alert turned off → silence", () => {
  const r = repo();
  items(r, [premise("item_p1"), { event: "alert", id: "item_p1", mode: "off" }]);
  assert(run(r) === "", "explicitly muted premise must be silent");
});

t("rejected premise → silence", () => {
  const r = repo();
  items(r, [premise("item_p1"), { event: "edit", id: "item_p1", action: "reject" }]);
  assert(run(r) === "", "retired premise must be silent");
});

t("overdue contract beats premise reminder — one line, settle only", () => {
  const r = repo();
  ledger(r, bet("aaaa0001", iso(-1), "지난 결정"));
  items(r, [premise("item_p1")]);
  const out = run(r);
  assert(out.includes("/argus:resolve") && !out.includes("/argus:premises check"), `settle must win: ${out}`);
  assert(!out.includes("\n"), `must be one line: ${out}`);
});

t("premise reminder respects ko locale", () => {
  const r = repo();
  items(r, [premise("item_p1")]);
  writeFileSync(join(r, ".argus", "config.yaml"), "locale: ko\n");
  const out = run(r);
  assert(out.includes("재확인할 전제") && out.includes("/argus:premises check"), `expected ko premise line: ${out}`);
});

// ─── Cleanup & verdict ──────────────────────────────────

for (const d of repos) { try { rmSync(d, { recursive: true, force: true }); } catch {} }

process.stdout.write(fails ? `\n${fails} FAILED\n` : "\nall tests passed\n");
process.exit(fails ? 1 : 0);
