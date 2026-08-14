/**
 * 행동 효과 감사 — 페르소나 축이 실제 행동을 바꿨는지 결정론으로 센다.
 *
 *   node evals/axis-effects.mjs <runDir> [<runDir>...]
 *   (runDir = first-user-journey --out 산출물: summary.json + TRANSCRIPT.txt + 원장 사본)
 *
 * 문제정의 (2026-08-14, 창업자 승인 착수):
 *
 *   1. **조작 점검(manipulation check).** "페르소나 10명을 돌렸다"는 커버리지
 *      주장이 아니다. 커버리지 주장은 **축이 피검 시스템의 행동을 바꿈을
 *      확인했을 때만** 성립한다 — 라벨 커버리지 ≠ 행동 커버리지. 문헌 실측:
 *      주관 주석·시험 과제에서는 페르소나 효과가 미미하거나 무작위였고
 *      (Hu & Collier ACL 2024 <10% 분산; Zheng EMNLP-F 2024 "largely random"),
 *      그래서 분야에 이 계측기가 없다. 그러나 여정 과제의 실측(T08 계열,
 *      6차 리시트)은 축이 정산 도달을 바꿨다 — 과제 종류가 결론을 바꾼다.
 *      이 도구는 그 구분을 상설 측정으로 만든다.
 *
 *   2. **individuation(개별화) 점검.** 페르소나 필드가 생산됐는데 발화가
 *      바뀌지 않으면 죽은 배선이다 — LLM-glue 불변식("생산된 필드는 소비되거나
 *      명시적으로 포기된다")의 페르소나판. v1은 페르소나 **간** 발화 특징의
 *      기술적(descriptive) 분리만 보고한다. 무페르소나 기준선과의 대조는
 *      기준선 실행이 존재하지 않아 v2다 — 여기 적어 공백을 이름 붙인다.
 *
 * 이 도구가 절대 하지 않는 것 (오라클 금지 원칙):
 *   - LLM을 부르지 않는다. 판정도 요약도 전부 결정론이다.
 *   - 절대율을 결론으로 내지 않는다. 표는 실행 묶음 안의 대조용이다.
 *   - 축 귀속을 표본이 허락하는 것보다 강하게 주장하지 않는다 — 페르소나 수가
 *     축 수준 수보다 적으면 축들은 서로 교락(confound)되며, 이 도구는 그
 *     사실을 계산해서 **직접 경고한다**. 경고 없는 귀속 표가 나오는 순간이
 *     이 도구가 거짓말을 시작하는 순간이다.
 *
 * 입력 신뢰 경계: summary.json의 persona id로 traits를 복원한다 (같은 시드
 * 결정론 샘플러). TRANSCRIPT의 사용자 발화는 페르소나 모델의 출력이므로
 * 특징 추출만 하고 지시로 취급하지 않는다.
 */
import fs from 'node:fs';
import path from 'node:path';
import { AXES, samplePersonas } from './persona-sampling.mjs';

const personasById = new Map(samplePersonas().map((p) => [p.id, p]));

/** 원장 사본에서 이벤트를 센다. 파싱 불가 줄은 세지 않고 개수만 보고한다. */
function ledgerCounts(dir) {
  const file = fs.readdirSync(dir).find((f) => f.startsWith('ledger_') && f.endsWith('.jsonl'));
  const out = { seal: 0, settle: 0, unparsable: 0 };
  if (!file) return out;
  for (const line of fs.readFileSync(path.join(dir, file), 'utf8').split('\n')) {
    if (!line.trim()) continue;
    try {
      const ev = JSON.parse(line);
      if (ev.event === 'seal') out.seal++;
      if (ev.event === 'settle' || ev.event === 'resolve') out.settle++;
    } catch { out.unparsable++; }
  }
  return out;
}

/** 트랜스크립트에서 사용자 발화 블록을 추출한다 (👤 표식부터 다음 표식 전까지). */
function userTurns(transcript) {
  const turns = [];
  let cur = null;
  for (const line of transcript.split('\n')) {
    const m = line.match(/^ {2}👤 사용자: (.*)$/);
    if (m) { if (cur !== null) turns.push(cur); cur = m[1]; continue; }
    if (cur !== null) {
      // 다음 화자/구획 표식이면 블록 종료. 아니면 이어붙인다 (발화는 여러 줄).
      if (/^ {2}(?:🤖|📦|⚠|┌|└|\()/.test(line) || /^─{10,}/.test(line)) { turns.push(cur); cur = null; }
      else if (line.startsWith('     ')) cur += `\n${line.trim()}`;
    }
  }
  if (cur !== null) turns.push(cur);
  return turns;
}

/** 발화 특징 — 전부 결정론. 의미 판정이 아니라 형태 계측이다. */
function turnFeatures(turns) {
  if (!turns.length) return { turns: 0, meanChars: 0, questionRate: 0, hangulRatio: 0 };
  const chars = turns.map((t) => t.length);
  const hangul = turns.map((t) => (t.match(/[가-힣]/g) ?? []).length / Math.max(1, t.length));
  const q = turns.filter((t) => /[?？]/.test(t)).length;
  const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
  return {
    turns: turns.length,
    meanChars: Math.round(mean(chars)),
    questionRate: +(q / turns.length).toFixed(2),
    hangulRatio: +mean(hangul).toFixed(2),
  };
}

function readRun(dir) {
  const summary = JSON.parse(fs.readFileSync(path.join(dir, 'summary.json'), 'utf8'));
  const personaId = typeof summary.persona === 'string' ? summary.persona : summary.persona?.id;
  // 기록된 traits가 정본이다 — 대조쌍 변이(P08~…)는 샘플러에 존재하지 않으므로
  // 역참조가 애초에 불가능하고, 역참조는 traits 미기록 구세대 실행의 fallback이다.
  const persona = summary.traits
    ? { id: personaId, language: summary.language ?? '?', traits: summary.traits }
    : personasById.get(personaId);
  if (!persona) throw new Error(`${dir}: summary.json의 persona("${personaId}")를 샘플러에서 복원할 수 없다 (traits 기록도 없음)`);
  const rejections = (summary.rejections ?? []).map((r) => (String(r.error).match(/"error_code":\s*"([A-Z_]+)"/) ?? [])[1] ?? 'UNKNOWN');
  const ledger = ledgerCounts(dir);
  const transcript = fs.readFileSync(path.join(dir, 'TRANSCRIPT.txt'), 'utf8');
  return {
    dir: path.basename(dir), persona,
    metrics: {
      seals: ledger.seal,
      settles: ledger.settle,
      // 여정은 항상 9단계(정산)를 몰므로, 봉인이 있는데 정산이 0이면 "놓침"이다.
      settleSkipped: ledger.seal > 0 && ledger.settle === 0 ? 1 : 0,
      rejections: rejections.length,
      rejectionCodes: rejections,
      toolCalls: (summary.toolCalls ?? []).length,
      gatesPassed: Array.isArray(summary.gates) ? summary.gates.filter((g) => g[1] === true || g.ok === true).length : null,
      unparsableLedgerLines: ledger.unparsable,
    },
    voice: turnFeatures(userTurns(transcript)),
  };
}

// ── 실행 ─────────────────────────────────────────────────────────────────────
const dirs = process.argv.slice(2);
if (!dirs.length) {
  console.error('사용법: node evals/axis-effects.mjs <runDir> [<runDir>...]');
  process.exit(2);
}
const runs = dirs.map(readRun);

// 1) 실행별 표
console.log('■ 실행별 행동 지표 (전부 결정론 추출)');
for (const r of runs) {
  const m = r.metrics;
  console.log(`  ${r.dir.padEnd(6)} ${r.persona.id} [${r.persona.language.slice(0, 2)}]  봉인 ${m.seals} · 정산 ${m.settles}${m.settleSkipped ? ' (놓침)' : ''} · 거부 ${m.rejections}${m.rejections ? ` [${m.rejectionCodes.join(',')}]` : ''} · 호출 ${m.toolCalls} · 발화 ${r.voice.turns}회 · 평균 ${r.voice.meanChars}자 · 질문율 ${r.voice.questionRate}`);
}

// 2) 페르소나별 집계
const byPersona = new Map();
for (const r of runs) {
  const key = r.persona.id;
  if (!byPersona.has(key)) byPersona.set(key, []);
  byPersona.get(key).push(r);
}
console.log('\n■ 페르소나별 집계');
for (const [id, rs] of byPersona) {
  const skip = rs.reduce((s, r) => s + r.metrics.settleSkipped, 0);
  const rej = rs.reduce((s, r) => s + r.metrics.rejections, 0);
  const meanChars = Math.round(rs.reduce((s, r) => s + r.voice.meanChars, 0) / rs.length);
  const p = rs[0].persona;
  const traits = AXES.map((a) => p.traits[a.id]).join('/');
  console.log(`  ${id} (n=${rs.length})  정산 놓침 ${skip}/${rs.length} · 거부 합계 ${rej} · 발화 평균 ${meanChars}자   [${traits}]`);
}

// 3) 축 귀속 — 표본이 허락할 때만. 교락 검사가 먼저 돈다.
console.log('\n■ 축 → 행동 귀속');
// 실행에 실린 persona 객체를 그대로 쓴다. id로 샘플러를 재조회하면 대조쌍
// 변이(P08~…)가 undefined로 터진다 — readRun이 이미 "기록이 정본" 규칙으로
// 복원해 놓은 것을 버리고 fallback을 다시 부르는 셈이었다.
const personasInData = [...byPersona.values()].map((rs) => rs[0].persona);
let attributable = 0;
for (const axis of AXES) {
  const levels = new Map();
  for (const p of personasInData) {
    const level = p.traits[axis.id];
    if (!levels.has(level)) levels.set(level, []);
    levels.get(level).push(p.id);
  }
  // 이 축의 수준별로 "다른 축이 전부 같은" 페르소나 쌍이 있어야만 이 축을
  // 단독 귀속할 수 있다. 페르소나 수 << 축 수준 수인 표본에서는 거의 항상
  // 불가능하고, 그 사실을 숨기는 표가 바로 이 도구가 막으려는 거짓이다.
  const pairsDifferingOnlyHere = [];
  for (let i = 0; i < personasInData.length; i++) for (let j = i + 1; j < personasInData.length; j++) {
    const a = personasInData[i], b = personasInData[j];
    const diff = AXES.filter((ax) => a.traits[ax.id] !== b.traits[ax.id]).map((ax) => ax.id);
    if (diff.length === 1 && diff[0] === axis.id) pairsDifferingOnlyHere.push(`${a.id}↔${b.id}`);
  }
  const covered = levels.size;
  if (pairsDifferingOnlyHere.length) {
    attributable++;
    console.log(`  ${axis.label.padEnd(18)} 수준 ${covered}/5 등장 · 단독 대조쌍 ${pairsDifferingOnlyHere.join(', ')} → 귀속 가능`);
  } else {
    console.log(`  ${axis.label.padEnd(18)} 수준 ${covered}/5 등장 · 단독 대조쌍 없음 → 이 표본으로는 다른 축과 교락 — 귀속 불가`);
  }
}
if (!attributable) {
  console.log('\n  ⚠ 현 표본에서 단독 귀속 가능한 축이 0개다. 지금 말할 수 있는 것은');
  console.log('    "페르소나 간 행동 차이가 존재한다"까지이고, "어느 축 때문인가"는');
  console.log('    한 축만 다른 페르소나 쌍(예: covering array 재설계)을 돌린 뒤에만 말할 수 있다.');
}

// 4) individuation v1 — 페르소나 간 발화 분리 (기술적 보고, 판정 아님)
console.log('\n■ individuation v1 — 발화 특징이 페르소나를 구분하는가 (기술적 보고)');
for (const [id, rs] of byPersona) {
  const v = rs.map((r) => r.voice);
  const mean = (k) => +(v.reduce((s, x) => s + x[k], 0) / v.length).toFixed(2);
  console.log(`  ${id}: 평균 ${Math.round(mean('meanChars'))}자 · 질문율 ${mean('questionRate')} · 한글비 ${mean('hangulRatio')}`);
}
console.log('  (무페르소나 기준선 실행이 없어 "기본값과 구분되는가"는 v2 — 이 줄이 그 공백의 이름표다)');
