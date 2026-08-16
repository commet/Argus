#!/usr/bin/env node
/**
 * E-0 측정 장치 — census.json(고정 스냅샷)에서 M6/M1/M4를 결정론으로 집계한다.
 *
 * 원칙 (Honest Structure): 의미 판정(반증 조건의 종류, 회고 단위의 발원)은
 * 전부 census.json에 *데이터로 고정*되어 있고, 이 스크립트는 그 필드를
 * 셈만 한다 — 실행할 때마다 같은 입력이면 같은 숫자. LLM 개입 0.
 *
 * 재현: node docs/receipts/2026-08-16-e0-baseline/measure.mjs
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const census = JSON.parse(readFileSync(join(here, 'census.json'), 'utf8'));

const STRICT_FALSIFIER = new Set(['explicit', 'operationalized', 'threshold_in_predicate']);
const units = census.seal_units;
const pct = (a, b) => (b === 0 ? 'n/a' : `${a}/${b} (${((a / b) * 100).toFixed(1)}%)`);
const lines = [];
const out = (s = '') => lines.push(s);

out(`E-0 기준선 실측 결과 — ${census.captured_at}`);
out('='.repeat(64));

// ---------------- M6: 반증가능 비율 ----------------
const strict = units.filter(
  (u) => u.predicate_present && u.check_trigger !== 'none' && STRICT_FALSIFIER.has(u.falsifier_kind)
);
const loose = units.filter((u) => u.predicate_present && u.check_trigger !== 'none');
const noTrigger = units.filter((u) => u.check_trigger === 'none');
const attempted = units.filter((u) => u.settle_attempted);
const determinate = attempted.filter((u) => u.determinate === true);
const indet = attempted.filter((u) => u.determinate === false);
const overdue = units.filter((u) => !u.settled && u.check_by && u.check_by <= census.captured_at && u.check_trigger === 'date');
const pendingInWindow = units.filter((u) => !u.settled && u.check_by && u.check_by > census.captured_at);
const webOnly = census.sealed_count_only.web_decision_sealed_events;
const visible = units.length;

out('');
out('[M6] 반증가능 비율 — 내용 가시 봉인 단위 기준');
out(`  판정 모집단(내용 가시): ${visible} 단위`);
out(`  strict 반증가능 (명제+반증조건{명시·연산화·임계내장}+확인 트리거): ${pct(strict.length, visible)}`);
out(`  loose 반증가능 (명제+확인 트리거): ${pct(loose.length, visible)}`);
out(`  확인 트리거 없는 봉인: ${noTrigger.map((u) => u.id).join(', ') || '0'} → ${pct(noTrigger.length, visible)}`);
out('');
out('[M6-실전] 정산 시도 대비 판정 성립률');
out(`  정산 시도: ${attempted.length} · 판정 성립: ${pct(determinate.length, attempted.length)} · 판정 불능: ${pct(indet.length, attempted.length)}`);
out(`  판정 불능 단위: ${indet.map((u) => `${u.id}(${u.falsifier_kind})`).join(', ')}`);
out(`  연체(확인일 경과·정산 없음): ${overdue.map((u) => `${u.id} (check_by ${u.check_by})`).join(', ') || '0'}`);
out(`  기한 내 대기: ${pendingInWindow.map((u) => u.id).join(', ') || '0'}`);
{
  const opStrict = attempted.filter((u) => STRICT_FALSIFIER.has(u.falsifier_kind));
  const opStrictDet = opStrict.filter((u) => u.determinate === true);
  const opWeak = attempted.filter((u) => !STRICT_FALSIFIER.has(u.falsifier_kind));
  const opWeakDet = opWeak.filter((u) => u.determinate === true);
  out(`  교차: strict 단위의 판정 성립 ${pct(opStrictDet.length, opStrict.length)} vs 비-strict 단위 ${pct(opWeakDet.length, opWeak.length)}`);
}
out('');
out('[M6-커버리지] 서버에서 내용 판정이 가능한 봉인의 비율');
out(`  내용 가시 ${visible} vs 계수-온리(웹 localStorage-first) ${webOnly}`);
out(`  → 판정 가능 비율: ${pct(visible, visible + webOnly)} — ${census.sealed_count_only.note}`);
{
  const nonFounder = units.filter((u) => !/창업자|세션|분신/.test(u.owner_attribution));
  out(`  내용 가시 단위 중 창업자·세션·분신 외 사용자 것: ${nonFounder.length}건`);
}

// ---------------- M1: 기억 다시쓰기율 ----------------
out('');
out('[M1] 기억 다시쓰기 — 정산 회고(recall) vs 빈티지(baseline) 대조');
const pairs = census.m1_pairs;
out(`  대조쌍: ${pairs.length} (전건 라이브 여정 — 표본이 비율 주장을 허용하지 않음, 단위 판정만 기록)`);
let dirKept = 0, importedUnits = 0, totalUnits = 0;
for (const p of pairs) {
  if (p.direction_preserved) dirKept += 1;
  for (const u of p.recall_units) {
    totalUnits += 1;
    if (!u.in_vintage_reasons) importedUnits += 1;
  }
  out(`  - ${p.case}`);
  out(`      빈티지 근거: ${JSON.stringify(p.vintage_stated_reasons)}`);
  out(`      회고: "${p.recall_text}"`);
  out(`      판정: ${p.verdict}`);
}
out(`  방향(기울기) 보존: ${pct(dirKept, pairs.length)}`);
out(`  회고 근거 단위 중 빈티지에 없던 세션-채택 프레임: ${pct(importedUnits, totalUnits)} (발원: 외부 문서 1, AI 제안 1)`);
out(`  대조군: ${census.m1_control.what} — 다시쓰기 ${census.m1_control.rewrite_count}건. ${census.m1_control.mechanism}`);

// ---------------- M4: 저자성 혼입률 ----------------
out('');
out('[M4] 저자성 혼입 — 사용자 소유 필드의 AI 발원 추적');
const m4 = census.m4;
out(`  전제(decision_items): AI 저자 ${pct(m4.decision_items.authored_ai, m4.decision_items.total)} · 편집 이력 있는 행 ${m4.decision_items.rows_with_nonempty_edits}/${m4.decision_items.total}`);
out(`    → ${m4.decision_items.note}`);
out(`  채택 카드 rationale: 사용자 기입 ${m4.cards.rationale_user_filled}/${m4.cards.total} · 빈 rationale 무편집 채택 ${m4.cards.accept_verbatim_empty_rationale}/${m4.cards.total}`);
out(`  분신 예측 기울기 오염: ${pct(m4.shadow_predictions.contaminated_by_lean, m4.shadow_predictions.total)} — ${m4.shadow_predictions.note}`);
out(`  프로필 항목 provenance: ai_extracted ${m4.profile_items.provenance_ai_extracted}/${m4.profile_items.total}, user ${m4.profile_items.provenance_user}/${m4.profile_items.total}`);
out(`  predicate_owner 도장: 구세대(plugin) null ${m4.predicate_owner_stamp.plugin_null}건 vs 신세대(sim-ledger) user ${m4.predicate_owner_stamp.sim_ledger_user}건`);
out(`  구세대 대비: actor_override ${m4.judgment_records_old_gen.actor_override}건 중 사용자 변경 ${m4.judgment_records_old_gen.actor_override_user_changed}건 (100%) — ${m4.judgment_records_old_gen.note}`);

out('');
out('-'.repeat(64));
out('입력: census.json (판정 근거 고정) · 장치: measure.mjs (집계만) · LLM 개입 0');

const text = lines.join('\n');
console.log(text);
