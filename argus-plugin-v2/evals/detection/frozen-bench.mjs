/**
 * 고정 벤치마크 + 래칫 — 자기-진화 루프의 "움직이지 않는 잣대".
 *
 * 왜: auto-detect-eval은 매 라운드 시나리오를 새로 생성한다. 그래서 라운드 간
 * 수치 비교는 개선과 배치 난이도 노이즈를 구분 못 하고, 루프가 GEN_SYSTEM을
 * 격상하면 숫자의 의미 자체가 바뀐다. 사람-라벨 31케이스 코퍼스를 고정 시나리오로
 * 변환해 매 라운드 같은 잣대로 양 모드(MCP/플러그인)를 실측한다.
 *
 * 래칫: frozen-bench-baseline.json(커밋됨)이 있으면 비교 —
 *   어느 모드든 fired_correct 하락 또는 over_fire 상승 = 회귀 → exit 2 (loud).
 *   루프는 이 빨간불을 보고 그 라운드의 변경을 revert한다.
 *   개선이면 루프가 베이스라인을 갱신 커밋한다.
 *
 *   ANTHROPIC_API_KEY=... node frozen-bench.mjs        # 실측 + 래칫
 *   node frozen-bench.mjs --convert-only               # 변환 확인(키 불요)
 *
 * Stage 2(2026-07-21, 창업자 지시)부터 숨은전제 추출 품질 판정기(judgeHidden)가
 * 여기서도 돈다 — 고정 벤치가 '발동했나(fired_correct)'와 '절제(over_fire)'에 더해
 * '옳게 짚었나(hidden_extraction.matched)'까지 잰다. 코퍼스의 gold(특정 하중 전제)를
 * 기준으로 대조하며, 이 매치의 하락을 래칫이 회귀로 잡는다(간판 기능 회귀 가드).
 * 판정기 신뢰 자체는 validate-judge.mjs가 별도로 검증한다(gold→매치, counter→기각).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CORPUS } from './corpus.mjs';
import {
  runDetector, scoreScenario, aggregate, makeAnthropicCaller, serverInstructions,
  PLUGIN_AUGMENT, runPool, judgeHidden,
} from './auto-detect-eval.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const BASELINE_PATH = path.join(HERE, 'frozen-bench-baseline.json');

/** 코퍼스 → 고정 시나리오 (순수 변환, 단위 검증 대상).
 *  Anthropic messages는 user로 시작해야 하므로 assistant-선행 케이스엔 중립
 *  user 턴을 앞에 붙인다 — 고정 벤치는 라운드 간 '동일성'이 자연스러움보다 중요. */
export function corpusToScenarios(corpus = CORPUS) {
  return corpus.map((c) => {
    const turns = [];
    if (c.assistant) {
      turns.push({ role: 'user', text: '이어서 봐줘.' });
      turns.push({ role: 'assistant', text: c.assistant });
    }
    turns.push({ role: 'user', text: c.user });
    const userIdx = turns.length - 1;
    return {
      id: c.id,
      turns,
      planted: c.labels.map((kind) => ({
        turn: userIdx,
        kind,
        // 숨은 전제는 gold(특정 하중 전제)를 기준 정답으로 — 판정기가 이걸로 대조.
        gist: kind === 'hidden_assumption' ? (c.gold || c.note || c.user.slice(0, 120)) : (c.note || c.user.slice(0, 120)),
      })),
      filler_user_turns: c.labels.length ? [] : [userIdx],
      open: c.open || [],
    };
  });
}

/** 래칫 비교 (순수). 실 API 감지는 run마다 요동하므로(같은 고정 코퍼스도
 *  20/0 → 21/1) 정확 임계 비교는 샘플링 노이즈에 오작동한다. 톨러런스 밴드(TOL)
 *  안의 변화는 노이즈로 허용하고, 그를 넘는 하락/상승만 회귀로 잡는다. TOL은
 *  n≈24 정발동·n=8 filler 규모의 1-2 이벤트 요동을 흡수하되 3+ 실회귀는 잡는 값.
 *  FROZEN_TOL 환경변수로 조정 가능(기본 2).
 *  추출 매치는 n=6(hidden 케이스)로 스케일이 작아 별도 톨러런스(hidTol, 기본 1)를
 *  쓴다 — TOL=2를 그대로 쓰면 matched=2 베이스라인이 0으로 붕괴해도 안 잡혀 게이트가
 *  무력해진다. hidTol=1은 판정기 ±1 노이즈만 허용하고 2칸 이상 하락은 회귀로 잡는다. */
export function compareFrozen(
  baseline, current,
  tol = Number(process.env.FROZEN_TOL || 2),
  hidTol = Number(process.env.FROZEN_HID_TOL || 1),
) {
  const reasons = [];
  for (const mode of ['mcp', 'plugin']) {
    const b = baseline?.byMode?.[mode];
    const c = current?.byMode?.[mode];
    if (!b || !c) continue;
    // 이 모드가 0 시나리오면 rate-limit/인프라 실패 — 회귀로 오판 금지(스킵).
    // scenarios===0만 검사(실 집계는 항상 이 필드를 채운다; 명시적 0만 빈 run).
    if (c.scenarios === 0) continue;
    if (c.fired_correct < b.fired_correct - tol) reasons.push(`${mode}: fired_correct ${b.fired_correct}→${c.fired_correct} (>${tol} 하락)`);
    if ((c.over_fire?.fired ?? 0) > (b.over_fire?.fired ?? 0) + tol) reasons.push(`${mode}: over_fire ${b.over_fire.fired}→${c.over_fire.fired} (>${tol} 상승)`);
    // Stage 2: 추출 품질 회귀 가드. 베이스라인과 현재 모두 judged>0인 '확립된 지표'일 때만
    // 비교한다 — 베이스라인이 judged:0(미측정)이면 새 지표라 회귀가 아니고(첫 도입 run은
    // 통과 후 베이스라인 갱신), 현재 judged:0이면 인프라 실패라 회귀 오판 금지.
    const bh = b.hidden_extraction, ch = c.hidden_extraction;
    if (bh?.judged > 0 && ch?.judged > 0 && ch.matched < bh.matched - hidTol) {
      reasons.push(`${mode}: hidden_extraction.matched ${bh.matched}→${ch.matched} (>${hidTol} 하락)`);
    }
  }
  return { ok: reasons.length === 0, reasons };
}

async function main() {
  if (process.argv.includes('--convert-only')) {
    const s = corpusToScenarios();
    console.log(JSON.stringify({ scenarios: s.length, planted: s.reduce((a, x) => a + x.planted.length, 0), filler: s.reduce((a, x) => a + x.filler_user_turns.length, 0) }));
    return;
  }
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) { console.log('키 없음 — 변환 확인만: node frozen-bench.mjs --convert-only'); process.exit(0); }
  const det = makeAnthropicCaller(key, process.env.AUTO_DETECT_MODEL || 'claude-opus-4-8');
  const jud = makeAnthropicCaller(key, process.env.AUTO_JUDGE_MODEL || 'claude-sonnet-5');
  const instructions = await serverInstructions();
  const scenarios = corpusToScenarios();
  const CONC = Number(process.env.FROZEN_CONCURRENCY || 1);

  const byMode = {};
  const hiddenDetail = {}; // R14: 케이스별 진단(무엇을 짚었고 왜 틀렸나) — 다음 수정을 감이 아니라 데이터로.
  for (const m of [{ key: 'mcp', augment: null }, { key: 'plugin', augment: PLUGIN_AUGMENT }]) {
    const per = (await runPool(scenarios, async (s) => {
      const sys = s.open.length
        ? `${instructions}\n\nAlready on record (open predictions you are tracking):\n${s.open.map((p) => `- "${p}"`).join('\n')}`
        : instructions;
      const detected = await runDetector(det, sys, s, { augment: m.augment });
      // Stage 2: 숨은 전제 추출 품질 — gold 기준으로 '옳게 짚었나' 판정(발동 여부가 아님).
      // 각 hidden 케이스마다 1건씩 기록(캡처 못 하면 match:false). judged는 안정적(=hidden 수).
      const hiddenJudged = [];
      for (const p of s.planted.filter((x) => x.kind === 'hidden_assumption')) {
        const cap = detected.captures[p.turn] || '';
        const verdict = cap ? await judgeHidden(jud, p.gist, cap) : { match: false, why: 'not captured' };
        hiddenJudged.push({ id: s.id, gold: String(p.gist).slice(0, 160), captured: cap.slice(0, 200), ...verdict });
      }
      return { scenario: s, score: scoreScenario(s, detected.fires), hiddenJudged };
    }, CONC)).filter((r) => r && r.score);
    byMode[m.key] = aggregate(per.map((r) => ({ scenario: r.scenario, score: r.score, hiddenJudged: r.hiddenJudged })));
    // 놓친 케이스만 진단으로 남긴다(전수 대신 실패에 집중 — 다음 레버 찾기용).
    hiddenDetail[m.key] = per.flatMap((r) => r.hiddenJudged).filter((h) => !h.match)
      .map((h) => ({ id: h.id, why: h.why, gold: h.gold, captured: h.captured }));
    const he = byMode[m.key].hidden_extraction;
    console.log(`  ${m.key}: 정발동 ${byMode[m.key].fired_correct}/${byMode[m.key].planted_total} · 과발동 ${byMode[m.key].over_fire.fired}/${byMode[m.key].over_fire.filler_total} · 추출매치 ${he.matched}/${he.judged}`);
    if (hiddenDetail[m.key].length) for (const d of hiddenDetail[m.key]) console.log(`    MISS[${m.key}] ${d.id}: ${d.why}`);
  }

  const current = { at: process.env.RUN_STAMP || null, byMode, hiddenDetail };
  fs.writeFileSync(path.join(HERE, 'frozen-bench-report.json'), JSON.stringify(current, null, 2));
  console.log('===FROZEN_BENCH_START===');
  console.log(JSON.stringify(current));
  console.log('===FROZEN_BENCH_END===');

  // 빈 run 가드: 양 모드 모두 0 시나리오면 감지 회귀가 아니라 rate-limit/인프라
  // 실패다. 래칫을 빨간불로 만들지 말고(회귀 오판), 인프라 실패로 알리고 통과.
  const totalScored = (byMode.mcp?.scenarios ?? 0) + (byMode.plugin?.scenarios ?? 0);
  if (totalScored === 0) {
    console.log('FROZEN_BENCH_EMPTY: 0 scored scenarios — rate limit/API 과부하로 추정. 래칫 스킵(회귀 아님). 다음 run에서 재측정.');
    return;
  }

  if (fs.existsSync(BASELINE_PATH)) {
    const verdict = compareFrozen(JSON.parse(fs.readFileSync(BASELINE_PATH, 'utf8')), current);
    if (!verdict.ok) {
      console.error(`FROZEN_RATCHET_FAIL: ${verdict.reasons.join(' · ')}`);
      process.exit(2); // loud — 루프는 이 빨간불에서 이번 라운드 변경을 revert
    }
    console.log('FROZEN_RATCHET_OK (베이스라인 이상 유지)');
  } else {
    console.log('베이스라인 없음 — 이번 결과가 첫 잣대. 루프가 frozen-bench-baseline.json으로 커밋할 것.');
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
