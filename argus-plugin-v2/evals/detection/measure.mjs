/**
 * 감지 측정기 — 코퍼스를 사전필터(prefilterTurn)와 규칙 감지기(detectSignals)에
 * 통과시켜 수치를 낸다. 순수 계산 모듈: 단언은 measure.test.mjs가, 출력은 CLI가.
 *
 *   node argus-plugin-v2/evals/detection/measure.mjs   # 수치 리포트 출력
 *
 * 창(window)은 훅(sense-signal.js)과 동일하게 assistant + "\n" + user다.
 * "규칙 user-단독" 열은 창 확장이 왜 필요한지(§3.3 진단 시점 반쪽)를 수치로 남긴다.
 */
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CORPUS } from './corpus.mjs';

const require = createRequire(import.meta.url);
const { prefilterTurn, detectSignals } = require(
  join(dirname(fileURLToPath(import.meta.url)), '../../scripts/lib/decision-signals.js'),
);

// hidden_assumption은 규칙이 "그 절을 표시"할 수는 있어도(assumption 발화가 같이
// 있을 때) 숨은 전제 자체를 추출하지는 못한다 — 추출은 생성 작업이다. 여기서의
// 매핑은 절-표시(flag) 여부만 세며, 그 한계는 리포트 문구에 명시한다.
const RULE_KIND = {
  prediction: 'prediction',
  outcome: 'outcome',
  assumption: 'assumption',
  hidden_assumption: 'assumption',
};

export function windowOf(c) {
  return c.assistant ? `${c.assistant}\n${c.user}` : c.user;
}

export function measure(corpus = CORPUS) {
  const rows = corpus.map((c) => {
    const window = windowOf(c);
    const pre = prefilterTurn(window);
    const rulesWindow = detectSignals(window, { openPredicates: c.open ?? [] }).map((s) => s.kind);
    const rulesUserOnly = detectSignals(c.user, { openPredicates: c.open ?? [] }).map((s) => s.kind);
    return { ...c, window, pre, rulesWindow, rulesUserOnly };
  });

  const positives = rows.filter((r) => r.labels.length > 0);
  const negatives = rows.filter((r) => r.labels.length === 0);

  const prefilterMisses = positives.filter((r) => !r.pre.pass);
  const negativesSkipped = negatives.filter((r) => !r.pre.pass);
  const expectedSkipViolations = negatives.filter((r) => r.expectSkip && r.pre.pass);

  const perLabel = {};
  for (const label of ['prediction', 'outcome', 'assumption', 'hidden_assumption']) {
    const labeled = positives.filter((r) => r.labels.includes(label));
    const flaggedWindow = labeled.filter((r) => r.rulesWindow.includes(RULE_KIND[label]));
    const flaggedUser = labeled.filter((r) => r.rulesUserOnly.includes(RULE_KIND[label]));
    perLabel[label] = {
      n: labeled.length,
      rules_flag_window: flaggedWindow.length,
      rules_flag_user_only: flaggedUser.length,
      rules_missed_ids: labeled.filter((r) => !r.rulesWindow.includes(RULE_KIND[label])).map((r) => r.id),
    };
  }

  return {
    rows,
    n: rows.length,
    positives: positives.length,
    negatives: negatives.length,
    prefilter: {
      recall_on_positives: positives.length ? (positives.length - prefilterMisses.length) / positives.length : 1,
      missed_positive_ids: prefilterMisses.map((r) => r.id),
      negatives_skipped: negativesSkipped.length,
      expected_skip_violations: expectedSkipViolations.map((r) => r.id),
    },
    rules: perLabel,
  };
}

function pct(x) { return `${Math.round(x * 1000) / 10}%`; }

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const m = measure();
  console.log(`감지 측정 리포트 — 코퍼스 ${m.n}건 (양성 ${m.positives} / 음성 ${m.negatives})\n`);
  console.log(`사전필터 (주입 게이트 — 불변식: 양성 스킵 0건)`);
  console.log(`  양성 리콜: ${pct(m.prefilter.recall_on_positives)}${m.prefilter.missed_positive_ids.length ? `  ← 미스: ${m.prefilter.missed_positive_ids.join(', ')}` : ''}`);
  console.log(`  음성 스킵(비용 절약): ${m.prefilter.negatives_skipped}/${m.negatives}\n`);
  console.log(`규칙 감지기 (참고 — 왜 감지기가 아니라 최저선인가; flag=절 표시일 뿐 추출 아님)`);
  for (const [label, r] of Object.entries(m.rules)) {
    console.log(`  ${label.padEnd(18)} n=${r.n}  창-flag ${r.rules_flag_window}/${r.n}  user단독-flag ${r.rules_flag_user_only}/${r.n}${r.rules_missed_ids.length ? `  미스: ${r.rules_missed_ids.join(', ')}` : ''}`);
  }
  console.log('\nhidden_assumption의 flag는 동반한 표시 전제를 표시했다는 뜻일 뿐, 숨은 전제');
  console.log('추출이 아니다 — 추출은 생성 작업이라 규칙로는 원리적으로 불가 (그래서 감지는 AI).');
}
