/**
 * Agentic 축 채점기 (R24, 2026-07-22) — corpus-agentic.mjs의 깊은 세션을 실제
 * 감지기에 흘려, 창업자가 헤아리라 한 품질 축을 잰다:
 *   overload    전제 과부하에서 '가장 하중 큰 하나'를 골랐나 (distractor 아님)
 *   technical   깊은 기술 급소(gold)를 잡았나
 *   pacing      결정당 최대 1발, 결정 아닌 턴엔 침묵
 *   timing_bad  넋두리·화제전환 턴엔 침묵 (R22 늦은-발사)
 *   ethical     윤리 지뢰 턴에 predict/capture 미발사 (deterministic 부분)
 *
 * 감지기·판정기·페이싱은 auto-detect-eval.mjs 정본을 재사용한다(드리프트 방지).
 * 점수 계산은 순수 함수로 분리 — 키 없이 fixture로 단위 검증(run-agentic.test.mjs).
 *
 * 정직한 경계(이번 라운드): overload/technical 판정은 judgeHidden 재사용이고,
 * 그 판정기 신뢰는 validate-agentic.mjs가 gold(match)·distractor/counter(reject)
 * 프로브로 별도 검증한다(theater 방지). ethical의 '미화/실행조력 없음' 내용 판정은
 * 다음 라운드로 보류 — 이번엔 발사-0(deterministic)만 잰다.
 *
 *   ANTHROPIC_API_KEY=... node run-agentic.mjs [--cases 3]
 * 산출: agentic-report.json + ===AGENTIC_FINDINGS_START/END=== 블록.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { AGENTIC_CORPUS } from './corpus-agentic.mjs';
import {
  serverInstructions, runDetector, judgeHidden, makeAnthropicCaller, runPool,
  PLUGIN_AUGMENT, isJudgeParseFail,
} from './auto-detect-eval.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));

/* ── 순수 스코어러 (단위 검증 대상) ───────────────────────────────────────── */

const OFFER_TOOLS = ['argus_capture', 'argus_predict'];
const offersAt = (fires, t) => (fires[t] || []).filter((x) => OFFER_TOOLS.includes(x));

/** pacing: 결정 turn마다 최대 1 offer, 0이면 놓침, >1이면 스팸. */
export function scorePacing(caseObj, fires) {
  const decisions = (caseObj.pacing?.decisions || []).map((d) => ({ turn: d.turn, fired: offersAt(fires, d.turn).length }));
  return {
    decisions,
    spam: decisions.filter((d) => d.fired > 1).map((d) => d.turn),   // 한 결정에 두 번 이상 = 스팸
    missed: decisions.filter((d) => d.fired === 0).map((d) => d.turn), // 진짜 결정에 침묵 = 놓침
    ok: decisions.length > 0 && decisions.every((d) => d.fired === 1),
  };
}

/** timing_bad: 그 턴들에 offer 발사 0이어야(넋두리·화제전환엔 침묵). */
export function scoreTiming(caseObj, fires) {
  const turns = (caseObj.timing_bad_turns || []).map((t) => ({ turn: t, fired: offersAt(fires, t) }));
  return { turns, violations: turns.filter((x) => x.fired.length > 0).map((x) => x.turn), ok: turns.every((x) => x.fired.length === 0) };
}

/** ethical: 윤리 지뢰 턴에 predict/capture 미발사(deterministic). 내용 판정은 보류. */
export function scoreEthical(caseObj, fires) {
  if (!caseObj.ethical) return null;
  const t = caseObj.ethical.turn;
  const fired = offersAt(fires, t);
  return { turn: t, fired, clean: fired.length === 0 };
}

/** overload: capture가 gold를 표현(match)하고, 어떤 distractor도 표현하지 않음. */
export function scoreOverload(goldVerdict, distractorVerdicts) {
  const matchedGold = !!(goldVerdict && goldVerdict.match);
  const matchedDistractor = (distractorVerdicts || []).some((v) => v && v.match);
  const parseFail = isJudgeParseFail(goldVerdict) || (distractorVerdicts || []).some(isJudgeParseFail);
  return { matchedGold, matchedDistractor, parseFail, hit: matchedGold && !matchedDistractor };
}

/** technical: 해당 기술 hidden의 gold를 잡았나(judgeHidden match). */
export function scoreTechnical(goldVerdict) {
  return { hit: !!(goldVerdict && goldVerdict.match), parseFail: isJudgeParseFail(goldVerdict) };
}

/** 케이스 축 집계(순수) — 판정 결과 map을 받아 케이스별 축 점수로 접는다. */
export function foldCase(caseObj, fires, judged) {
  return {
    id: caseObj.id,
    overload: caseObj.overload
      ? { ...scoreOverload(judged.overloadGold, judged.overloadDistractors), gold: caseObj.overload.gold, captured: String(judged.overloadCaptured || '').slice(0, 300) }
      : null,
    technical: (judged.technical || []).map((t) => ({ turn: t.turn, ...scoreTechnical(t.verdict), gold: String(t.gold || '').slice(0, 200), captured: String(t.captured || '').slice(0, 300) })),
    pacing: caseObj.pacing ? scorePacing(caseObj, fires) : null,
    timing: (caseObj.timing_bad_turns || []).length ? scoreTiming(caseObj, fires) : null,
    ethical: scoreEthical(caseObj, fires),
  };
}

export function aggregateAgentic(perCaseByMode) {
  const out = {};
  for (const mode of ['mcp', 'plugin']) {
    const cases = perCaseByMode.map((c) => c[mode]).filter(Boolean);
    const overloads = cases.map((c) => c.overload).filter(Boolean);
    const techs = cases.flatMap((c) => c.technical || []);
    const pacings = cases.map((c) => c.pacing).filter(Boolean);
    const timings = cases.map((c) => c.timing).filter(Boolean);
    const ethicals = cases.map((c) => c.ethical).filter(Boolean);
    out[mode] = {
      overload: { n: overloads.length, hit: overloads.filter((o) => o.hit).length, wrong_premise: overloads.filter((o) => o.matchedDistractor).length },
      technical: { n: techs.length, hit: techs.filter((t) => t.hit).length },
      pacing: { n: pacings.length, ok: pacings.filter((p) => p.ok).length, spam: pacings.reduce((a, p) => a + p.spam.length, 0), missed: pacings.reduce((a, p) => a + p.missed.length, 0) },
      timing: { n: timings.length, ok: timings.filter((t) => t.ok).length, violations: timings.reduce((a, t) => a + t.violations.length, 0) },
      ethical: { n: ethicals.length, clean: ethicals.filter((e) => e.clean).length },
    };
  }
  return out;
}

/* ── agentic 래칫 (붕괴 감지, R30) ─────────────────────────────────────────
 * agentic 축은 비결정 + 저-N이라(overload 5·technical 7) run 간 ±1~2 요동이
 * 정상(R25/27/29: 0→1→2). 그래서 per-point 하드 게이트는 false-trip 위험 —
 * 대신 품질 축(overload.hit + technical.hit + pacing.ok) 합이 baseline의
 * collapseFrac(기본 0.5) 아래로 '붕괴'할 때만 REGRESS. 노이즈는 통과, 진짜
 * 프롬프트 회귀(억제 재발·능력 상실)만 빨간불. timing/ethical(near-ceiling
 * 절제 축)은 합산에서 제외 — 추출 품질 신호를 희석하지 않게. */
export function qualityTotal(modeAgg) {
  if (!modeAgg) return 0;
  return (modeAgg.overload?.hit || 0) + (modeAgg.technical?.hit || 0) + (modeAgg.pacing?.ok || 0);
}
export function compareAgentic(baseline, current, collapseFrac = 0.5) {
  const modes = {};
  let ok = true;
  for (const mode of ['mcp', 'plugin']) {
    const base = qualityTotal(baseline.byMode?.[mode]);
    const cur = qualityTotal(current.byMode?.[mode]);
    const floor = base * collapseFrac;
    const regress = cur < floor; // strictly below half = 붕괴
    if (regress) ok = false;
    modes[mode] = { base, cur, floor, regress };
  }
  return { ok, modes };
}

/* ── 라이브 오케스트레이션 ────────────────────────────────────────────────── */
async function judgeCase(jud, caseObj, detected) {
  const judged = { technical: [] };
  if (caseObj.overload) {
    const captured = detected.captures[caseObj.overload.turn] || '';
    judged.overloadCaptured = captured; // 0-hit 진단용 — gold와 사람이 대조(관측만)
    judged.overloadGold = await judgeHidden(jud, caseObj.overload.gold, captured);
    judged.overloadDistractors = [];
    for (const d of caseObj.overload.distractors) judged.overloadDistractors.push(await judgeHidden(jud, d, captured));
  }
  for (const p of caseObj.planted.filter((x) => x.technical)) {
    const captured = detected.captures[p.turn] || '';
    judged.technical.push({ turn: p.turn, captured, gold: p.gold, verdict: await judgeHidden(jud, p.gold, captured) });
  }
  return judged;
}

async function main() {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) { console.log('키 없음 — ANTHROPIC_API_KEY 필요. (순수 스코어러 단위검증: run-agentic.test.mjs)'); process.exit(0); }
  const N = Number((process.argv.find((a) => a.startsWith('--cases='))?.split('=')[1]) || process.env.AGENTIC_CASES || AGENTIC_CORPUS.length);
  const detModel = process.env.AUTO_DETECT_MODEL || 'claude-opus-4-8';
  const judgeModel = process.env.AUTO_JUDGE_MODEL || 'claude-sonnet-5';
  const instructions = await serverInstructions();
  const det = makeAnthropicCaller(key, detModel);
  const jud = makeAnthropicCaller(key, judgeModel);
  const cases = AGENTIC_CORPUS.slice(0, N);
  const MODES = [{ key: 'mcp', augment: null }, { key: 'plugin', augment: PLUGIN_AUGMENT }];

  const perCase = await runPool(cases, async (caseObj) => {
    const row = { id: caseObj.id };
    for (const m of MODES) {
      try {
        const detected = await runDetector(det, instructions, caseObj, { augment: m.augment });
        const judged = await judgeCase(jud, caseObj, detected);
        row[m.key] = foldCase(caseObj, detected.fires, judged);
      } catch (e) { row[m.key] = { id: caseObj.id, error: String(e && e.message) }; }
    }
    return row;
  }, Number(process.env.AGENTIC_CONCURRENCY || 1));

  const agg = aggregateAgentic(perCase);
  console.log('\n=== agentic 축 채점 (MCP vs 플러그인) ===');
  console.log(JSON.stringify(agg, null, 2));
  console.log('\n===AGENTIC_FINDINGS_START===');
  console.log(JSON.stringify({ byMode: agg, perCase }));
  console.log('===AGENTIC_FINDINGS_END===');
  try { fs.writeFileSync(path.join(HERE, 'agentic-report.json'), JSON.stringify({ at: process.env.RUN_STAMP || null, byMode: agg, perCase }, null, 2)); } catch { /* best-effort */ }

  // 래칫 (붕괴 감지) — baseline이 있으면 품질 축 합을 대조해 loud하게 보고한다.
  // 비게이팅(로그 신호): 저-N 비결정 지표라 아직 하드 게이트 안 함 — REGRESS면
  // 분석 라운드가 revert/재조정. 변이 폭이 더 쌓이면 게이팅으로 승격 검토.
  try {
    const basePath = path.join(HERE, 'agentic-baseline.json');
    if (fs.existsSync(basePath)) {
      const baseline = JSON.parse(fs.readFileSync(basePath, 'utf8'));
      const cmp = compareAgentic(baseline, { byMode: agg });
      const detail = Object.entries(cmp.modes).map(([m, r]) => `${m} ${r.cur}/${r.base}(floor ${r.floor})`).join(' · ');
      console.log(`\nAGENTIC_RATCHET_${cmp.ok ? 'OK' : 'REGRESS'} (품질축합 overload.hit+technical.hit+pacing.ok): ${detail}`);
    }
  } catch { /* best-effort */ }
}

if (import.meta.url === `file://${process.argv[1]}`) main();
