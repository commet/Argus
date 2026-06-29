#!/usr/bin/env node
/**
 * Tests for the anchor-as-switch decision-capture hooks.
 *   - unit: lib/decision-signals.js (START/DONE grep, lastUserText)
 *   - integration: anchor-signal / wake-signal / recall-signal via spawnSync
 * Temp dirs are made by node (OS-absolute paths), so hooks read them directly —
 * no shell path-mapping involved. Run: node scripts/test-decision-signals.mjs
 */
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import assert from "node:assert/strict";

const DIR = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const sig = require("./lib/decision-signals.js");

const ANCHOR = join(DIR, "anchor-signal.js");
const WAKE = join(DIR, "wake-signal.js");
const RECALL = join(DIR, "recall-signal.js");

const tmps = [];
function tmp(prefix) { const d = mkdtempSync(join(tmpdir(), prefix)); tmps.push(d); return d; }
function userMsg(text) { return { type: "user", message: { role: "user", content: text }, isMeta: false }; }
function transcript(dir, name, msgs) {
  const file = join(dir, name);
  writeFileSync(file, msgs.map((m) => JSON.stringify(m)).join("\n") + "\n");
  return file;
}
function runHook(script, input, configDir) {
  const r = spawnSync(process.execPath, [script], {
    input: JSON.stringify(input),
    encoding: "utf8",
    env: { ...process.env, CLAUDE_CONFIG_DIR: configDir || tmp("argus-ds-cfg-") },
  });
  if (r.status !== 0) throw new Error(`exit ${r.status}: ${r.stderr}`);
  return r.stdout;
}
function anchorOn(configDir, sessionId) {
  mkdirSync(join(configDir, "argus-anchored"), { recursive: true });
  writeFileSync(join(configDir, "argus-anchored", sessionId), "");
}

let pass = 0, fail = 0;
function test(name, fn) {
  try { fn(); console.log("  ok   " + name); pass++; }
  catch (e) { console.log("  FAIL " + name + " — " + (e && e.message)); fail++; }
}

// ── unit: hasStartSignal ────────────────────────────────────────────────────
for (const s of [
  "Redis 쓸까 말까 고민이야", "should I use Redis here", "Redis vs Postgres 골라줘",
  "어느 쪽이 나을까", "둘 중에 뭐가 나아", "trade-offs 좀 분석해줘",
  "which option is better", "이거 결정해야 하는데",
]) test("start+ " + s, () => assert.ok(sig.hasStartSignal(s)));
for (const s of [
  "이 버그 고쳐줘", "hello world", "이 파일 읽어줘", "explain this function", "리팩토링 해줘",
]) test("start- " + s, () => assert.ok(!sig.hasStartSignal(s)));

// ── unit: hasDoneSignal ─────────────────────────────────────────────────────
for (const s of [
  "좋아 Redis로 가자 결정했어", "그걸로 하자", "이걸로 진행하자",
  "let's go with Postgres", "decided to use Redis", "i'll go with that",
]) test("done+ " + s, () => assert.ok(sig.hasDoneSignal(s)));
for (const s of [
  "이 함수 설명해줘", "hello", "아직 고민중이야", "explain please",
]) test("done- " + s, () => assert.ok(!sig.hasDoneSignal(s)));

// ── unit: lastUserText ──────────────────────────────────────────────────────
test("lastUserText: string content", () =>
  assert.equal(sig.lastUserText(JSON.stringify(userMsg("hello")) + "\n", false), "hello"));
test("lastUserText: array content", () => {
  const m = { type: "user", message: { role: "user", content: [{ type: "text", text: "hi there" }] } };
  assert.equal(sig.lastUserText(JSON.stringify(m) + "\n", false), "hi there");
});
test("lastUserText: skips isMeta", () => {
  const meta = { type: "user", message: { role: "user", content: "/foo" }, isMeta: true };
  const t = [JSON.stringify(userMsg("real one")), JSON.stringify(meta)].join("\n") + "\n";
  assert.equal(sig.lastUserText(t, false), "real one");
});
test("lastUserText: skips tool_result (no text item)", () => {
  const tr = { type: "user", message: { role: "user", content: [{ type: "tool_result", content: "x" }] } };
  const t = [JSON.stringify(userMsg("the ask")), JSON.stringify(tr)].join("\n") + "\n";
  assert.equal(sig.lastUserText(t, false), "the ask");
});
test("lastUserText: skips slash-command line", () => {
  const cmd = { type: "user", message: { role: "user", content: "<command-name>/x</command-name>" } };
  const t = [JSON.stringify(userMsg("normal")), JSON.stringify(cmd)].join("\n") + "\n";
  assert.equal(sig.lastUserText(t, false), "normal");
});
test("lastUserText: none → empty", () =>
  assert.equal(sig.lastUserText('{"type":"assistant","message":{"role":"assistant","content":"x"}}\n', false), ""));

// ── integration: anchor-signal ──────────────────────────────────────────────
test("anchor: START signal → nudge", () =>
  assert.match(runHook(ANCHOR, { session_id: "a1", user_message: "Redis 쓸까 말까 고민" }), /\[Argus\]/));
test("anchor: no signal → silent", () =>
  assert.equal(runHook(ANCHOR, { session_id: "a2", user_message: "이 함수 설명해줘" }).trim(), ""));
test("anchor: once per session", () => {
  const cfg = tmp("argus-ds-cfg-");
  runHook(ANCHOR, { session_id: "a3", user_message: "할까 말까 고민" }, cfg);
  assert.equal(runHook(ANCHOR, { session_id: "a3", user_message: "또 둘 중에 뭐가" }, cfg).trim(), "");
});

// ── integration: wake-signal ────────────────────────────────────────────────
test("wake: off session (no anchor) → silent", () => {
  const td = tmp("argus-ds-t-");
  const tp = transcript(td, "s.jsonl", [userMsg("좋아 Redis로 가자 결정했어")]);
  assert.equal(runHook(WAKE, { session_id: "w1", transcript_path: tp }).trim(), "");
});
test("wake: anchored + DONE signal → nudge", () => {
  const cfg = tmp("argus-ds-cfg-"); const td = tmp("argus-ds-t-");
  anchorOn(cfg, "w2");
  const tp = transcript(td, "s.jsonl", [userMsg("Redis 쓸까 말까"), userMsg("좋아 Redis로 가자 결정했어")]);
  assert.match(runHook(WAKE, { session_id: "w2", transcript_path: tp }, cfg), /\[Argus\]/);
});
test("wake: anchored + no DONE → silent", () => {
  const cfg = tmp("argus-ds-cfg-"); const td = tmp("argus-ds-t-");
  anchorOn(cfg, "w3");
  const tp = transcript(td, "s.jsonl", [userMsg("이 함수 설명해줘")]);
  assert.equal(runHook(WAKE, { session_id: "w3", transcript_path: tp }, cfg).trim(), "");
});
test("wake: once per session", () => {
  const cfg = tmp("argus-ds-cfg-"); const td = tmp("argus-ds-t-");
  anchorOn(cfg, "w4");
  const tp = transcript(td, "s.jsonl", [userMsg("그걸로 가자 결정했어")]);
  runHook(WAKE, { session_id: "w4", transcript_path: tp }, cfg);
  assert.equal(runHook(WAKE, { session_id: "w4", transcript_path: tp }, cfg).trim(), "");
});

// ── integration: recall-signal ──────────────────────────────────────────────
test("recall: prev OFF + DONE → nudge", () => {
  const td = tmp("argus-ds-t-");
  transcript(td, "prev.jsonl", [userMsg("좋아 Redis로 가자 결정했어")]);
  const cur = transcript(td, "cur.jsonl", [userMsg("hi")]);
  assert.match(runHook(RECALL, { session_id: "cur", transcript_path: cur }), /\[Argus\]/);
});
test("recall: prev ON (anchored) → silent", () => {
  const cfg = tmp("argus-ds-cfg-"); const td = tmp("argus-ds-t-");
  transcript(td, "prev.jsonl", [userMsg("Redis로 가자 결정했어")]);
  const cur = transcript(td, "cur.jsonl", [userMsg("hi")]);
  anchorOn(cfg, "prev");
  assert.equal(runHook(RECALL, { session_id: "cur", transcript_path: cur }, cfg).trim(), "");
});
test("recall: prev has no DONE → silent", () => {
  const td = tmp("argus-ds-t-");
  transcript(td, "prev.jsonl", [userMsg("이 함수 설명해줘")]);
  const cur = transcript(td, "cur.jsonl", [userMsg("hi")]);
  assert.equal(runHook(RECALL, { session_id: "cur", transcript_path: cur }).trim(), "");
});
test("recall: no previous session → silent", () => {
  const td = tmp("argus-ds-t-");
  const cur = transcript(td, "only.jsonl", [userMsg("hi")]);
  assert.equal(runHook(RECALL, { session_id: "only", transcript_path: cur }).trim(), "");
});
test("recall: once per previous session", () => {
  const cfg = tmp("argus-ds-cfg-"); const td = tmp("argus-ds-t-");
  transcript(td, "prev.jsonl", [userMsg("그걸로 가자 결정했어")]);
  const cur = transcript(td, "cur.jsonl", [userMsg("hi")]);
  runHook(RECALL, { session_id: "cur", transcript_path: cur }, cfg);
  assert.equal(runHook(RECALL, { session_id: "cur", transcript_path: cur }, cfg).trim(), "");
});

// ── integration: robustness ─────────────────────────────────────────────────
test("all hooks: broken stdin → silent, exit 0", () => {
  for (const s of [ANCHOR, WAKE, RECALL]) {
    const r = spawnSync(process.execPath, [s], { input: "not json", encoding: "utf8" });
    assert.equal(r.status, 0);
    assert.equal(r.stdout.trim(), "");
  }
});

for (const d of tmps) try { rmSync(d, { recursive: true, force: true }); } catch {}
console.log(`\ntest-decision-signals: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
