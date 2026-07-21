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

/** 순수 스코어러 — 프로브 결과(match 판정)에서 recall/specificity 계산 + 게이트. */
export function scoreJudge(results, recMin = REC_MIN, specMin = SPEC_MIN) {
  const pos = results.filter((r) => r.kind === 'positive');
  const neg = results.filter((r) => r.kind === 'negative');
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
  for (const p of probes) {
    const v = await judgeHidden(jud, p.gold, p.captured);
    results.push({ ...p, match: v.match, why: v.why });
    console.log(`  ${p.id.padEnd(18)} [${p.kind}] expect ${p.expect} → judge ${v.match} ${v.match === p.expect ? 'OK' : '✗ MISCLASSIFIED'}`);
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
