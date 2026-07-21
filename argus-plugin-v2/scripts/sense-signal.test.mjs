#!/usr/bin/env node
/**
 * sense-signal.js (매 턴 대화 진단 훅) 실호출 테스트 — spawnSync로 실제 stdin/
 * stdout 계약을 검증한다 (test-decision-signals.mjs와 같은 방식).
 *
 * 고정하는 계약:
 *  1. 잡담/슬래시/초단문 → 완전 침묵 (주입 없음)
 *  2. 단서 있는 턴 → 3감각 AI-진단 지시 주입 (규칙 후보는 있으면 동봉, 없어도 주입)
 *  3. 열린 예측이 있으면 목록이 지시문에 동봉된다 (대명사 대조는 AI의 일 —
 *     코드의 일은 목록을 눈앞에 놓아주기)
 *  4. 스캔 창은 직전 어시스턴트 발화를 포함한다 (사용자-단독으로는 침묵일 턴이
 *     어시스턴트 예측 때문에 주입된다)
 *  5. 진단 캡(3회/세션) 소진 후에도 종결 단서 + 열린 예측이면 정산-전용 재주입
 *  6. 구판 빈 마커 = 소진으로 읽는다 (소급 과발화 금지)
 *  7. 옵트아웃 존중, 깨진 stdin은 조용히 exit 0
 *
 * Run: node argus-plugin-v2/scripts/sense-signal.test.mjs
 */
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const DIR = dirname(fileURLToPath(import.meta.url));
const SENSE = join(DIR, 'sense-signal.js');

const tmps = [];
function tmp(prefix) { const d = mkdtempSync(join(tmpdir(), prefix)); tmps.push(d); return d; }

function runSense(input, { configDir, argusHome } = {}) {
  const cfg = configDir || tmp('argus-sense-cfg-');
  const r = spawnSync(process.execPath, [SENSE], {
    input: typeof input === 'string' ? input : JSON.stringify(input),
    encoding: 'utf8',
    env: { ...process.env, CLAUDE_CONFIG_DIR: cfg, ARGUS_HOME: argusHome || join(cfg, 'no-argus-home') },
  });
  assert.equal(r.status, 0, `hook must exit 0 (stderr: ${r.stderr})`);
  return { out: r.stdout, cfg };
}

function context(stdout) {
  if (!stdout.trim()) return null;
  const o = JSON.parse(stdout);
  return o.hookSpecificOutput && o.hookSpecificOutput.additionalContext;
}

function ledgerWith(events) {
  const cwd = tmp('argus-sense-cwd-');
  mkdirSync(join(cwd, '.argus', 'ledger'), { recursive: true });
  writeFileSync(join(cwd, '.argus', 'ledger', 'ledger.jsonl'), events.map((e) => JSON.stringify(e)).join('\n') + '\n');
  return cwd;
}

function transcriptWith(lines) {
  const dir = tmp('argus-sense-tr-');
  const p = join(dir, 't.jsonl');
  writeFileSync(p, lines.map((l) => JSON.stringify(l)).join('\n') + '\n');
  return p;
}
const assistantMsg = (text) => ({ type: 'assistant', message: { role: 'assistant', content: [{ type: 'text', text }] } });
const userMsg = (text) => ({ type: 'user', message: { role: 'user', content: text } });

let pass = 0, fail = 0;
function test(name, fn) {
  try { fn(); console.log('  ok   ' + name); pass++; }
  catch (e) { console.log('  FAIL ' + name + ' — ' + (e && e.message)); fail++; }
}

// ── 1. 침묵이 기본값 ─────────────────────────────────────────────────────────
test('잡담 → 침묵', () => {
  const { out } = runSense({ session_id: 's1', prompt: '이 함수가 뭐 하는 건지 설명해줘.' });
  assert.equal(out.trim(), '');
});
test('슬래시 명령 → 침묵', () => {
  const { out } = runSense({ session_id: 's1', prompt: '/argus 다음 분기 매출 20% 성장할 거야' });
  assert.equal(out.trim(), '');
});
test('초단문 → 침묵', () => {
  const { out } = runSense({ session_id: 's1', prompt: 'ㅇㅋ 좋아' });
  assert.equal(out.trim(), '');
});
test('깨진 stdin → 조용히 exit 0', () => {
  const { out } = runSense('not json at all');
  assert.equal(out.trim(), '');
});

// ── 2. 단서 있는 턴 → AI-진단 주입 ──────────────────────────────────────────
test('예측 단서 → 3감각 진단 지시 주입 (규칙 후보 동봉)', () => {
  const { out } = runSense({ session_id: 's2', prompt: '다음 분기까지 매출 20% 성장할 것으로 예상합니다.' });
  const ctx = context(out);
  assert.ok(ctx, 'diagnosis must be injected');
  assert.match(ctx, /PREDICTION/);
  assert.match(ctx, /LOAD-BEARING ASSUMPTION/);
  assert.match(ctx, /UNSTATED/); // 숨은 전제가 핵심 감각임을 지시
  assert.match(ctx, /Deterministic scan flagged/); // 규칙 후보 = 최저선
  assert.match(ctx, /매출 20% 성장/); // 후보는 사용자의 말 그대로
  assert.match(ctx, /ignore this entirely/); // MCP 부재 가드
});

test('규칙이 못 잡는 애매-지평 예측도 진단은 주입된다 (규칙은 감지기가 아니다)', () => {
  const { out } = runSense({ session_id: 's3', prompt: "We'll probably be fine on capacity when it goes live." });
  const ctx = context(out);
  assert.ok(ctx, 'diagnosis must be injected even with zero rule candidates');
  assert.match(ctx, /PREDICTION/);
  assert.ok(!/Deterministic scan flagged/.test(ctx), 'no rule candidate for this turn');
});

// ── 2b. 점화 축 (BLUEPRINT §9.9 V1b) — 신규 사용자 첫 결정에서 작동 ──────────
// 콜드스타트의 dead-wire 가드: 이력 0(원장 파일 없음)·세션 상태 0인 사용자의
// 첫 결정에서도 하중 전제(점화) 감각이 주입돼야 한다. 이력에 의존하면 신규
// 사용자는 아무것도 못 받고 이탈한다 — 제품의 첫인상 가치가 바로 이 축이다.
test('신규 사용자(빈 원장·무상태) 첫 결정 → 점화(하중 전제) 주입, 정산 감각은 skip', () => {
  const cwd = tmp('argus-sense-new-');
  mkdirSync(join(cwd, '.argus', 'ledger'), { recursive: true }); // 원장 파일 없음 = 이력 0
  const { out } = runSense({ session_id: 'new1', cwd, prompt: '다음 분기까지 매출 20% 성장할 것으로 예상합니다.' });
  const ctx = context(out);
  assert.ok(ctx, 'ignition must fire for a brand-new user with zero history');
  assert.match(ctx, /LOAD-BEARING ASSUMPTION/); // 점화 축이 이력 없이도 뜬다
  assert.match(ctx, /No predictions are open on record/); // 빈 원장 → 정산 감각은 정직하게 skip
});

test('신규 사용자 첫 턴이 flat → 침묵 (점화는 결정에만, 잡일엔 아님)', () => {
  const cwd = tmp('argus-sense-newflat-');
  mkdirSync(join(cwd, '.argus', 'ledger'), { recursive: true });
  const { out } = runSense({ session_id: 'new2', cwd, prompt: '이 로그 좀 같이 봐줄래? 어디가 문제인지 모르겠네.' });
  assert.equal(out.trim(), '', 'a flat first turn must stay silent — restraint, not manufactured urgency');
});

// ── 3. 열린 예측 목록 동봉 ──────────────────────────────────────────────────
test('열린 예측이 지시문에 동봉된다 (대명사 정산은 AI의 일)', () => {
  const cwd = ledgerWith([
    { id: 'd1', event: 'seal', predicate: '서버 이전 후에도 다운타임은 없다' },
    { id: 'd2', event: 'seal', predicate: '6월 안에 물류 계약 체결' },
    { id: 'd2', event: 'settle', outcome: 'happened' },
  ]);
  const { out } = runSense({ session_id: 's4', cwd, prompt: '아 그거 결국 잘 됐어요. 다음으로 넘어가죠.' });
  const ctx = context(out);
  assert.ok(ctx);
  assert.match(ctx, /서버 이전 후에도 다운타임은 없다/); // 열린 것은 동봉
  assert.ok(!/물류 계약/.test(ctx), 'settled predicate must NOT be listed');
  assert.match(ctx, /pronoun reference/);
});

// ── 4. 스캔 창 = 직전 어시스턴트 발화 포함 ──────────────────────────────────
test('어시스턴트 발화의 예측 단서만으로도 주입된다 (창 확장 — §3.3)', () => {
  const tr = transcriptWith([
    userMsg('인덱스 추가해줘'),
    assistantMsg('이 인덱스를 추가하면 p95 레이턴시가 절반 아래로 내려갈 겁니다.'),
  ]);
  const bland = '그래 좋아 그걸로 부탁해요.'; // 사용자-단독으로는 단서 없음
  const solo = runSense({ session_id: 's5a', prompt: bland });
  assert.equal(solo.out.trim(), '', 'user-only must stay silent');
  const { out } = runSense({ session_id: 's5b', prompt: bland, transcript_path: tr });
  assert.ok(context(out), 'assistant-turn cue must trigger the diagnosis');
});

// ── 5. 캡(슬라이딩 윈도)과 정산-전용 경로 ───────────────────────────────────
test('진단은 2시간 창에 3회 캡, 이후 종결 단서 + 열린 예측이면 정산-전용 재주입', () => {
  const cfg = tmp('argus-sense-cap-');
  const cwd = ledgerWith([{ id: 'd1', event: 'seal', predicate: '서버 이전 후에도 다운타임은 없다' }]);
  const predTurn = { session_id: 'cap', cwd, prompt: '다음 분기까지 매출 20% 성장할 것으로 예상합니다.' };
  for (let i = 0; i < 3; i++) {
    const { out } = runSense(predTurn, { configDir: cfg });
    assert.ok(context(out), `diagnosis ${i + 1}/3 must fire`);
  }
  // 같은 창 안의 4번째 예측 턴 → 침묵
  const fourth = runSense(predTurn, { configDir: cfg });
  assert.equal(fourth.out.trim(), '', 'in-window diagnosis cap must hold');
  // 종결 단서가 있는 턴: 정산-전용 재주입은 캡과 별도로 열려 있다
  const settle = runSense({ session_id: 'cap', cwd, prompt: '그거 결국 잘 됐어요, 무중단이었어요.' }, { configDir: cfg });
  const ctx = context(settle.out);
  assert.ok(ctx, 'outcome-only nudge must fire after diagnosis cap');
  assert.match(ctx, /settlement may have just surfaced/);
  assert.match(ctx, /서버 이전 후에도 다운타임은 없다/);
  assert.ok(!/LOAD-BEARING/.test(ctx), 'outcome-only nudge carries no full diagnosis');
});

test('창이 지나면 진단이 다시 열린다 (긴 세션이 굶지 않음)', () => {
  const cfg = tmp('argus-sense-win-');
  mkdirSync(join(cfg, 'argus-sensed'), { recursive: true });
  const threeHoursAgo = Date.now() - 3 * 60 * 60 * 1000;
  writeFileSync(join(cfg, 'argus-sensed', 'win'), JSON.stringify({ diagTimes: [threeHoursAgo, threeHoursAgo, threeHoursAgo], out: 0, total: 3 }));
  const { out } = runSense({ session_id: 'win', prompt: '다음 분기까지 매출 20% 성장할 것으로 예상합니다.' }, { configDir: cfg });
  assert.ok(context(out), 'stale window must refresh the diagnosis budget');
});

test('세션 누적 상한(12)은 창과 무관하게 최종', () => {
  const cfg = tmp('argus-sense-max-');
  mkdirSync(join(cfg, 'argus-sensed'), { recursive: true });
  const old = Date.now() - 3 * 60 * 60 * 1000;
  writeFileSync(join(cfg, 'argus-sensed', 'max'), JSON.stringify({ diagTimes: [old], out: 0, total: 12 }));
  const { out } = runSense({ session_id: 'max', prompt: '다음 분기까지 매출 20% 성장할 것으로 예상합니다.' }, { configDir: cfg });
  assert.equal(out.trim(), '', 'session ceiling must hold even with a fresh window');
});

test('정산-전용도 캡(8회)이 있다 · 구판 {diag:3} 상태 이주', () => {
  const cfg = tmp('argus-sense-ocap-');
  const cwd = ledgerWith([{ id: 'd1', event: 'seal', predicate: '서버 이전 후에도 다운타임은 없다' }]);
  mkdirSync(join(cfg, 'argus-sensed'), { recursive: true });
  // 구판 숫자 상태 → 이주되어 진단은 창 안 소진, 정산 경로만 열림
  writeFileSync(join(cfg, 'argus-sensed', 'ocap'), JSON.stringify({ diag: 3, out: 0 }));
  const turn = { session_id: 'ocap', cwd, prompt: '그거 결국 잘 됐어요, 무중단이었어요.' };
  for (let i = 0; i < 8; i++) {
    const { out } = runSense(turn, { configDir: cfg });
    assert.ok(context(out), `outcome nudge ${i + 1}/8 must fire`);
  }
  const ninth = runSense(turn, { configDir: cfg });
  assert.equal(ninth.out.trim(), '', 'outcome cap must hold');
});

// ── 6. 구판 마커 호환 ───────────────────────────────────────────────────────
test('구판 빈 마커 = 소진 (소급 과발화 금지)', () => {
  const cfg = tmp('argus-sense-legacy-');
  mkdirSync(join(cfg, 'argus-sensed'), { recursive: true });
  writeFileSync(join(cfg, 'argus-sensed', 'legacy'), '');
  const { out } = runSense({ session_id: 'legacy', prompt: '다음 분기까지 매출 20% 성장할 것으로 예상합니다.' }, { configDir: cfg });
  assert.equal(out.trim(), '');
});

// ── 7. 옵트아웃 ─────────────────────────────────────────────────────────────
test('ambient 옵트아웃이면 침묵 (스위치는 하나)', () => {
  const home = tmp('argus-sense-home-');
  writeFileSync(join(home, 'config.json'), JSON.stringify({ ambient: { opt_out: true } }));
  const { out } = runSense(
    { session_id: 'opt', prompt: '다음 분기까지 매출 20% 성장할 것으로 예상합니다.' },
    { argusHome: home },
  );
  assert.equal(out.trim(), '');
});

// ── 8. 상태 파일 형식 ───────────────────────────────────────────────────────
test('상태 파일은 {diagTimes[],out,total} JSON으로 기록된다', () => {
  const cfg = tmp('argus-sense-state-');
  runSense({ session_id: 'st', prompt: '다음 분기까지 매출 20% 성장할 것으로 예상합니다.' }, { configDir: cfg });
  const f = join(cfg, 'argus-sensed', 'st');
  assert.ok(existsSync(f));
  const s = JSON.parse(readFileSync(f, 'utf8'));
  assert.equal(s.diagTimes.length, 1);
  assert.equal(s.total, 1);
});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
