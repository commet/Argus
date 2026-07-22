/**
 * Agentic 판정기 검증 (R24) — overload/technical 채점이 theater가 아님을 증명한다.
 * overload/technical은 judgeHidden을 재사용하는데, 그 판정기가 이 코퍼스의
 * distractor(곁가지 전제)와 counter(표면 이유)를 gold와 혼동하면 우선순위·기술
 * 지표가 무의미해진다. 그래서 gold→match(recall) / distractor·counter→reject
 * (specificity) 프로브로 판정기 자체를 검증하고 ≥0.85 게이트한다.
 *
 * scoreJudge는 validate-judge.mjs 정본을 재사용(중복 로직 금지). API 오류
 * 미채점은 분모에서 빠진다(R16 원칙).
 *
 *   ANTHROPIC_API_KEY=... node validate-agentic.mjs
 */
import { AGENTIC_CORPUS } from './corpus-agentic.mjs';
import { scoreJudge } from './validate-judge.mjs';
import { judgeHidden, makeAnthropicCaller } from './auto-detect-eval.mjs';

/** 프로브(순수): 각 overload는 gold(positive) + distractor마다 negative;
 *  각 technical hidden은 gold(positive) + counter(negative).
 *  negative의 captured=gold — "gold를 잡았을 때 판정기가 distractor/counter로
 *  오인하지 않는가"(specificity)를 검문한다. positive는 gold=gold 동일성 sanity
 *  (충실한 recall은 이미 validate-judge가 14케이스로 검증). */
export function agenticProbes() {
  const probes = [];
  for (const c of AGENTIC_CORPUS) {
    if (c.overload) {
      probes.push({ id: `${c.id}:ov`, kind: 'positive', planted: c.overload.gold, captured: c.overload.gold, expect: true });
      c.overload.distractors.forEach((d, i) =>
        probes.push({ id: `${c.id}:ov-d${i}`, kind: 'negative', planted: d, captured: c.overload.gold, expect: false }));
    }
    for (const p of c.planted.filter((x) => x.technical)) {
      probes.push({ id: `${c.id}:tech`, kind: 'positive', planted: p.gold, captured: p.gold, expect: true });
      probes.push({ id: `${c.id}:tech-c`, kind: 'negative', planted: p.counter, captured: p.gold, expect: false });
    }
  }
  return probes;
}

async function main() {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) { console.log('키 없음 — ANTHROPIC_API_KEY 필요. (프로브 구성 단위검증: validate-agentic.test.mjs)'); process.exit(0); }
  const jud = makeAnthropicCaller(key, process.env.AUTO_JUDGE_MODEL || 'claude-sonnet-5');
  const probes = agenticProbes();
  const results = [];
  for (const p of probes) {
    let verdict;
    try { verdict = await judgeHidden(jud, p.planted, p.captured); }
    catch (e) { results.push({ id: p.id, kind: p.kind, error: String(e && e.message) }); continue; }
    const match = !!verdict.match;
    const label = match === p.expect ? 'OK' : 'MISMATCH';
    console.log(`  ${p.id.padEnd(28)} [${p.kind}] expect ${p.expect} → judge ${match} ${label}`);
    results.push({ id: p.id, kind: p.kind, match });
  }
  const errored = results.filter((r) => r.error).length;
  if (errored > probes.length * 0.2) { console.log(`\nAGENTIC_JUDGE_SKIP — ${errored}/${probes.length} 미채점(API). 인프라, 회귀 아님.`); process.exit(0); }
  const s = scoreJudge(results);
  console.log('\n=== agentic 판정기 검증 ===');
  console.log(JSON.stringify(s, null, 2));
  if (!s.ok) { console.log(`AGENTIC_JUDGE_FAIL — recall ${s.recall} / specificity ${s.specificity} (임계 0.85)`); process.exit(1); }
  console.log(`AGENTIC_JUDGE_OK (recall ${s.recall} ≥ 0.85 · specificity ${s.specificity} ≥ 0.85)`);
}

if (import.meta.url === `file://${process.argv[1]}`) main();
