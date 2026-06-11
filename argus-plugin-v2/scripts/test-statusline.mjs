#!/usr/bin/env node
/**
 * Fixture tests for statusline/index.js — every display state in the priority
 * cascade, exercised against temp repos. Run: node scripts/test-statusline.mjs
 */
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, utimesSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const SCRIPT = join(dirname(fileURLToPath(import.meta.url)), "..", "statusline", "index.js");
const DAY = 86400000;

/** Local-timezone ISO date, offset in days — must match statusline localToday(). */
function iso(offsetDays = 0) {
  const d = new Date(Date.now() + offsetDays * DAY);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

function run(cwd, env = {}) {
  const stdin = JSON.stringify({
    model: { display_name: "TestModel" },
    workspace: { current_dir: cwd },
    context_window: { used_percentage: 40 },
  });
  const r = spawnSync(process.execPath, [SCRIPT], {
    input: stdin, encoding: "utf8",
    env: { ...process.env, COLUMNS: "110", ...env },
  });
  if (r.status !== 0) throw new Error(`exit ${r.status}: ${r.stderr}`);
  return r.stdout;
}

const strip = s => s.replace(/\x1b\[[0-9;]*m/g, "");
const lines = s => strip(s).split("\n");

const repos = [];
function repo() {
  const d = mkdtempSync(join(tmpdir(), "argus-sl-"));
  repos.push(d);
  return d;
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

function bearing(root, overrides = {}, ageDays = 0) {
  mkdirSync(join(root, ".argus"), { recursive: true });
  writeFileSync(join(root, ".argus", "current-bearing.json"), JSON.stringify({
    label: "v0.1",
    current_course: { status: "proceed", summary: "4시간 마이그레이션 스파이크로 진행" },
    why_this_course: [{ point: "x" }],
    fog_or_reef: { issue: "DAU 근거 없음" },
    road_not_taken: [{ option: "a", why_not_now: "b" }],
    next_helm: "surface별 DAU 뽑기",
    contract_seed: null,
    blocked: false,
    detail_path: ".",
    generated_at: new Date(Date.now() - ageDays * DAY).toISOString(),
    ...overrides,
  }));
}

function liveSession(root, phase, extra = {}) {
  const dir = join(root, ".argus", "sessions", "s1");
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "session.json"), JSON.stringify({
    id: "s1", phase, round: 2, max_rounds: 3,
    drafts: [{ id: "d1", version_label: "v0.2" }], active_draft_id: "d1",
    ...extra,
  }));
}

let fails = 0;
function t(name, fn) {
  try { fn(); process.stdout.write(`ok   ${name}\n`); }
  catch (e) { fails++; process.stdout.write(`FAIL ${name}: ${e.message}\n`); }
}
function assert(cond, msg) { if (!cond) throw new Error(msg); }

// ─── States in the cascade ──────────────────────────────

t("empty repo → line 1 only", () => {
  const out = lines(run(repo()));
  assert(out.length === 1, `expected 1 line, got ${out.length}: ${out.join(" / ")}`);
  assert(out[0].includes("TestModel"), "missing model name");
});

t("overdue bet → OVERDUE line with /watch hint", () => {
  const r = repo();
  ledger(r, bet("aaaa0001", iso(-3), "플러그인 보존, 포지셔닝 피벗"));
  const out = lines(run(r));
  assert(out.length === 2, `expected 2 lines, got ${out.length}`);
  assert(out[1].includes("OVERDUE"), `no OVERDUE: ${out[1]}`);
  assert(out[1].includes("플러그인 보존"), `missing decision text: ${out[1]}`);
  assert(out[1].includes("/watch due"), `missing hint: ${out[1]}`);
});

t("two overdue bets → ×2, oldest date shown", () => {
  const r = repo();
  ledger(r, [...bet("aaaa0001", iso(-10), "old decision"), ...bet("aaaa0002", iso(-1), "newer decision")]);
  const l2 = lines(run(r))[1];
  assert(l2.includes("OVERDUE ×2"), `no ×2: ${l2}`);
  assert(l2.includes(iso(-10).slice(5)), `oldest date missing: ${l2}`);
});

t("settled bet → silent", () => {
  const r = repo();
  ledger(r, bet("aaaa0001", iso(-3), "settled one", [{ event: "settle", outcome: "happened" }]));
  assert(lines(run(r)).length === 1, "settled bet should not render");
});

t("dismissed candidate → silent", () => {
  const r = repo();
  ledger(r, [
    { event: "harvest", id: "bbbb0001", decision: "not my decision", quote: "q" },
    { event: "dismiss", id: "bbbb0001" },
  ]);
  assert(lines(run(r)).length === 1, "dismissed should not render");
});

t("unsealed candidate → silent", () => {
  const r = repo();
  ledger(r, [{ event: "harvest", id: "cccc0001", decision: "just a candidate", quote: "q" }]);
  assert(lines(run(r)).length === 1, "candidate should not render");
});

t("bet due today → 'due today', not OVERDUE", () => {
  const r = repo();
  ledger(r, bet("aaaa0001", iso(0), "오늘 정산할 결정"));
  const l2 = lines(run(r))[1];
  assert(l2.includes("due today"), `no due today: ${l2}`);
  assert(!l2.includes("OVERDUE"), `today is due, not overdue: ${l2}`);
  assert(l2.includes("/watch due"), `missing hint: ${l2}`);
});

t("overdue beats due today", () => {
  const r = repo();
  ledger(r, [...bet("aaaa0001", iso(-2), "지난 것"), ...bet("aaaa0002", iso(0), "오늘 것")]);
  const l2 = lines(run(r))[1];
  assert(l2.includes("OVERDUE") && !l2.includes("×2"), `strict overdue only: ${l2}`);
});

t("bet due in 3 days → dim due line", () => {
  const r = repo();
  ledger(r, bet("aaaa0001", iso(3), "사흘 뒤 확인할 결정"));
  const l2 = lines(run(r))[1];
  assert(l2.includes("due"), `no due: ${l2}`);
  assert(!l2.includes("OVERDUE"), `should not be OVERDUE: ${l2}`);
});

t("bet due in 20 days → silent", () => {
  const r = repo();
  ledger(r, bet("aaaa0001", iso(20), "먼 미래"));
  assert(lines(run(r)).length === 1, "outside 7-day horizon should be silent");
});

t("amend pushes check_by out of overdue", () => {
  const r = repo();
  ledger(r, bet("aaaa0001", iso(-5), "변침한 결정", [{ event: "amend", check_by: iso(30) }]));
  assert(lines(run(r)).length === 1, "amended date should not be overdue");
});

t("fresh bearing → status + summary + fog", () => {
  const r = repo();
  bearing(r, {}, 0.1);
  const l2 = lines(run(r))[1];
  assert(l2.includes("proceed"), `no status: ${l2}`);
  assert(l2.includes("마이그레이션"), `no summary: ${l2}`);
  assert(l2.includes("DAU 근거 없음"), `no fog: ${l2}`);
});

t("blocked bearing → ⛔", () => {
  const r = repo();
  bearing(r, { blocked: true, current_course: { status: "hold", summary: "멈춤" } }, 0.1);
  const l2 = lines(run(r))[1];
  assert(l2.includes("⛔") && l2.includes("hold"), `no blocked marker: ${l2}`);
});

t("9-day-old bearing → decayed glyph with age", () => {
  const r = repo();
  bearing(r, {}, 9);
  const l2 = lines(run(r))[1];
  assert(/9d ago/.test(l2), `no decay age: ${l2}`);
  assert(!l2.includes("마이그레이션"), `decayed bearing must drop summary: ${l2}`);
});

t("20-day-old bearing → silent", () => {
  const r = repo();
  bearing(r, {}, 20);
  assert(lines(run(r)).length === 1, "old bearing should disappear");
});

t("contract seed past check_by → OVERDUE seed (no ledger needed)", () => {
  const r = repo();
  bearing(r, { contract_seed: { predicate: "plugin DAU가 X 이상", check_by: iso(-1) } }, 0.1);
  const l2 = lines(run(r))[1];
  assert(l2.includes("OVERDUE"), `seed overdue not shown: ${l2}`);
  assert(l2.includes("seed:"), `seed not marked: ${l2}`);
});

t("non-ISO seed check_by → ignored, bearing renders", () => {
  const r = repo();
  bearing(r, { contract_seed: { predicate: "p", check_by: "런칭 30일 후" } }, 0.1);
  const l2 = lines(run(r))[1];
  assert(l2.includes("proceed"), `free-text date must not break render: ${l2}`);
  assert(!l2.includes("OVERDUE"), `free-text date must not be due: ${l2}`);
});

t("overdue beats fresh bearing", () => {
  const r = repo();
  bearing(r, {}, 0.1);
  ledger(r, bet("aaaa0001", iso(-1), "기한 지난 결정"));
  const out = lines(run(r));
  assert(out.length === 2, "still one Argus line max");
  assert(out[1].includes("OVERDUE"), `overdue must win: ${out[1]}`);
});

t("live session beats due-soon and bearing", () => {
  const r = repo();
  bearing(r, {}, 0.1);
  ledger(r, bet("aaaa0001", iso(3), "사흘 뒤"));
  liveSession(r, "team_working");
  const l2 = lines(run(r))[1];
  assert(l2.includes("team_working"), `live phase must win: ${l2}`);
});

t("stale session (>15 min) → not live", () => {
  const r = repo();
  liveSession(r, "team_working");
  const p = join(r, ".argus", "sessions", "s1", "session.json");
  const old = new Date(Date.now() - 60 * 60000);
  utimesSync(p, old, old);
  assert(lines(run(r)).length === 1, "stale session must not render as live");
});

t("completed session → not live", () => {
  const r = repo();
  liveSession(r, "complete");
  assert(lines(run(r)).length === 1, "complete phase must not render");
});

t("round shown only in question phases", () => {
  const r = repo();
  liveSession(r, "conversing");
  const l2 = lines(run(r))[1];
  assert(l2.includes("Q2/3"), `round missing in conversing: ${l2}`);
});

t("narrow terminal → Korean text clipped, line fits budget", () => {
  const r = repo();
  bearing(r, {
    current_course: { status: "proceed", summary: "아주 길고 긴 한국어 요약 문장이 여기에 들어가서 터미널 폭을 훨씬 초과하게 되는 경우를 시험한다" },
    fog_or_reef: { issue: "이것도 매우 긴 안개 설명으로 잘려야만 하는 문장이다 그렇지 않으면 줄이 넘친다" },
  }, 0.1);
  const l2 = lines(run(r, { COLUMNS: "80" }))[1];
  assert(l2.includes("…"), `expected clipping: ${l2}`);
  assert(l2.includes("🌫"), `fog must survive truncation: ${l2}`);
});

t("corrupt ledger lines → skipped, no crash", () => {
  const r = repo();
  mkdirSync(join(r, ".argus", "ledger"), { recursive: true });
  writeFileSync(join(r, ".argus", "ledger", "ledger.jsonl"),
    "not json\n" + bet("aaaa0001", iso(-1), "살아남은 결정").map(e => JSON.stringify(e)).join("\n") + "\n{broken",
  );
  const l2 = lines(run(r))[1];
  assert(l2 && l2.includes("OVERDUE"), `valid events must survive corrupt lines: ${l2}`);
});

t("corrupt bearing json → silent, no crash", () => {
  const r = repo();
  mkdirSync(join(r, ".argus"), { recursive: true });
  writeFileSync(join(r, ".argus", "current-bearing.json"), "{not valid");
  assert(lines(run(r)).length === 1, "corrupt bearing must degrade to line 1");
});

t("session opened in a subdirectory → .argus found at repo root", () => {
  const r = repo();
  ledger(r, bet("aaaa0001", iso(-1), "루트의 결정"));
  const sub = join(r, "src", "components");
  mkdirSync(sub, { recursive: true });
  const l2 = lines(run(sub))[1];
  assert(l2 && l2.includes("OVERDUE"), `walk-up failed from subdir: ${l2}`);
});

t("git branch read from .git/HEAD without spawning git", () => {
  const r = repo();
  mkdirSync(join(r, ".git"), { recursive: true });
  writeFileSync(join(r, ".git", "HEAD"), "ref: refs/heads/feat/test-branch\n");
  const l1 = lines(run(r))[0];
  assert(l1.includes("feat/test-branch"), `branch missing: ${l1}`);
});

t("detached HEAD → short hash", () => {
  const r = repo();
  mkdirSync(join(r, ".git"), { recursive: true });
  writeFileSync(join(r, ".git", "HEAD"), "0123456789abcdef0123456789abcdef01234567\n");
  const l1 = lines(run(r))[0];
  assert(l1.includes("01234567"), `short hash missing: ${l1}`);
});

t("no stdin → still prints something", () => {
  const r = spawnSync(process.execPath, [SCRIPT], { input: "", encoding: "utf8" });
  assert(r.status === 0 && r.stdout.length > 0, "must not crash on empty stdin");
});

// ─── Cleanup & verdict ──────────────────────────────────

for (const d of repos) { try { rmSync(d, { recursive: true, force: true }); } catch {} }

process.stdout.write(fails ? `\n${fails} FAILED\n` : "\nall tests passed\n");
process.exit(fails ? 1 : 0);
