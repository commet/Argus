/**
 * validate-judge.mjs — 판정기를 판정한다 (Stage 2, 2026-07-21).
 *
 * honest-structure 불변식의 가장 깊은 지점: hidden_extraction 지표를 신뢰하려면
 * 그 채점자(judgeHidden)가 믿을 만해야 한다. LLM 판정기는 그럴듯하게 틀릴 수 있다:
 *   - 너무 관대 → 일반적/빗나간 캡처를 match로 통과시켜 지표를 부풀린다(진짜 약점 은폐).
 *   - 너무 엄격 → 충실한 캡처를 miss로 깎아 지표를 과소평가한다.
 * 둘 다 지표를 theater로 만든다. 그래서 코퍼스의 라벨된 프로브로 판정기를 실측한다:
 *   POSITIVE = gold_para (gold의 충실한 패러프레이즈) → match:true 여야 한다(recall).
 *   NEGATIVE = counter  (같은 주제·다른 하중 전제의 그럴듯한 오답) → match:false 여야
 *              한다(specificity). counter를 기각 못 하는 판정기는 무가치하다.
 *
 * 게이트: recall < REC_MIN 또는 specificity < SPEC_MIN 이면 exit 2(loud). 판정기가
 * 신뢰 임계 아래면 hidden_extraction 래칫을 믿을 수 없으므로 루프를 멈춘다.
 *
 *   ANTHROPIC_API_KEY=... node validate-judge.mjs
 *   node validate-judge.mjs --probes-only   # 프로브 목록만(키 불요)
 *
 * scoreJudge는 순수 — fixture로 단위 검증(validate-judge.test.mjs).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CORPUS } from './corpus.mjs';
import { makeAnthropicCaller, judgeHidden } from './auto-detect-eval.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const REC_MIN = Number(process.env.JUDGE_REC_MIN || 0.85);
export const SPEC_MIN = Number(process.env.JUDGE_SPEC_MIN || 0.85);

/** 코퍼스 → 판정기 프로브. hidden + gold가 있는 케이스만. */
export function judgeProbes(corpus = CORPUS) {
  const probes = [];
  for (const c of corpus) {
    if (!c.labels?.includes('hidden_assumption') || !c.gold) continue;
    if (c.gold_para) probes.push({ id: c.id, kind: 'positive', gold: c.gold, captured: c.gold_para, expect: true });
    if (c.counter) probes.push({ id: c.id, kind: 'negative', gold: c.gold, captured: c.counter, expect: false });
  }
  return probes;
}

/** 순수 스코어러 — 프로브 결과(match 판정)에서 recall/specificity 계산 + 게이트.
 *  API 오류로 미채점된 프로브(r.error)는 분모에서 제외한다 — 인프라 실패가 판정기
 *  품질 점수를 끌어내리면 안 된다(R16: 529 overloaded로 프로브가 throw했던 사례). */
export function scoreJudge(results, recMin = REC_MIN, specMin = SPEC_MIN) {
  const scored = results.filter((r) => !r.error);
  const pos = scored.filter((r) => r.kind === 'positive');
  const neg = scored.filter((r) => r.kind === 'negative');
  const matchedPos = pos.filter((r) => r.match === true).length;
  const rejectedNeg = neg.filter((r) => r.match === false).length;
  const recall = pos.length ? matchedPos / pos.length : 1;
  const specificity = neg.length ? rejectedNeg / neg.length : 1;
  // 오분류 사례(사람 리뷰용): 놓친 positive, 통과시킨 negative.
  const falseNeg = pos.filter((r) => r.match !== true).map((r) => r.id);
  const falsePos = neg.filter((r) => r.match !== false).map((r) => r.id);
  const ok = recall >= recMin && specificity >= specMin;
  return {
    positives: pos.length, negatives: neg.length,
    recall: Math.round(recall * 1000) / 1000, specificity: Math.round(specificity * 1000) / 1000,
    matched_positive: matchedPos, rejected_negative: rejectedNeg,
    false_negative_ids: falseNeg, false_positive_ids: falsePos,
    ok, recMin, specMin,
  };
}

async function main() {
  const probes = judgeProbes();
  if (process.argv.includes('--probes-only')) {
    console.log(JSON.stringify({ probes: probes.length, positive: probes.filter((p) => p.kind === 'positive').length, negative: probes.filter((p) => p.kind === 'negative').length }));
    return;
  }
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) { console.log('키 없음 — 프로브 확인만: node validate-judge.mjs --probes-only'); process.exit(0); }
  const jud = makeAnthropicCaller(key, process.env.AUTO_JUDGE_MODEL || 'claude-sonnet-5');

  const results = [];
  let errored = 0;
  for (const p of probes) {
    let v;
    try {
      v = await judgeHidden(jud, p.gold, p.captured);
    } catch (e) {
      // API 오류(예: 529 overloaded)로 재시도까지 소진 → 이 프로브는 미채점.
      // crash(exit 1)로 run 전체를 죽이지 않는다 — 인프라 실패는 품질 판정과 별개.
      errored++;
      const msg = String(e && e.message).slice(0, 60);
      results.push({ ...p, match: null, error: msg });
      console.log(`  ${p.id.padEnd(18)} [${p.kind}] → API 오류(${msg}) — 미채점(인프라)`);
      continue;
    }
    results.push({ ...p, match: v.match, why: v.why });
    console.log(`  ${p.id.padEnd(18)} [${p.kind}] expect ${p.expect} → judge ${v.match} ${v.match === p.expect ? 'OK' : '✗ MISCLASSIFIED'}`);
  }
  // 인프라 가드: API 오류로 20%↑ 프로브가 미채점이면 판정기 품질을 신뢰성 있게 잴 수
  // 없다 → 게이트를 빨간불로 만들지 말고(품질 회귀 아님) 스킵하고 통과. 다음 run 재측정.
  // (frozen-bench의 '빈 run ≠ 회귀'와 같은 원칙. R16: 529로 gate가 crash했던 수리.)
  if (probes.length && errored / probes.length > 0.2) {
    console.log(`JUDGE_VALIDATION_SKIPPED: ${errored}/${probes.length} 프로브가 API 오류로 미채점(인프라 실패 추정, 예: 529 overloaded). 게이트 스킵 — 품질 회귀 아님. 다음 run에서 재측정.`);
    fs.writeFileSync(path.join(HERE, 'validate-judge-report.json'), JSON.stringify({ at: process.env.RUN_STAMP || null, skipped: true, errored, probes: probes.length, results }, null, 2));
    return;
  }
  const score = scoreJudge(results);
  console.log('\n=== 판정기 검증 (judgeHidden) ===');
  console.log(JSON.stringify(score, null, 2));
  fs.writeFileSync(path.join(HERE, 'validate-judge-report.json'), JSON.stringify({ at: process.env.RUN_STAMP || null, score, results }, null, 2));

  if (!score.ok) {
    console.error(`JUDGE_VALIDATION_FAIL: recall ${score.recall} (min ${REC_MIN}) · specificity ${score.specificity} (min ${SPEC_MIN}). 판정기 신뢰 불가 — hidden_extraction 지표를 믿지 말 것. 판정기 프롬프트(JUDGE_SYSTEM) 수리 필요.`);
    process.exit(2);
  }
  console.log(`JUDGE_VALIDATION_OK (recall ${score.recall} ≥ ${REC_MIN} · specificity ${score.specificity} ≥ ${SPEC_MIN})`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
