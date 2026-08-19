/**
 * 인지 프레임 엔진의 시뮬레이션 체크 — 콘솔 판독용.
 *
 * 가드는 `src/lib/cognition/__tests__/simulation.test.ts` 가 CI에서 돌리고,
 * 이 스크립트는 **사람이 읽는 판독**을 낸다 (어떤 경로를 몇 번 밟았는지,
 * 거절 사유의 분포가 어떤지 — 숫자가 0인 사유는 검증되지 않은 경로다).
 *
 *   npx tsx scripts/cognition-simulate.ts [에피소드수] [시드]
 *
 * 시각을 인자로 받지 않고 고정 기준시로 두는 이유: 같은 명령이 언제 돌아도
 * 같은 출력을 내야 한다. E-0 로그 측정기가 살아있는 파일을 읽어 재현 불가였던
 * 실수를 반복하지 않는다.
 */
import { runSimulation } from '../src/lib/cognition/simulate';
import { AXES } from '../src/lib/cognition/axes';
import { runSystemSimulation } from '../src/lib/cognition/simulate-system';

const episodes = Number(process.argv[2] ?? 200);
const seed = Number(process.argv[3] ?? 20260817);
const BASE_TIME = Date.parse('2026-08-17T00:00:00Z');

const r = runSimulation({ seed, episodes, baseTime: BASE_TIME });

const out: string[] = [];
out.push('인지 프레임 엔진 — 시뮬레이션 체크');
out.push('='.repeat(64));
out.push(`시드 ${r.seed} · 에피소드 ${r.episodes} · 기준시 2026-08-17T00:00:00Z (고정)`);
out.push('');

out.push('축 레지스트리 (문헌 등급):');
for (const a of AXES) {
  const req = a.optionalForSeal ? '선택' : '필수';
  const lb = a.loadBearing ? '하중' : '   ';
  out.push(`  ${a.id.padEnd(13)} ${a.authority.padEnd(20)} ${req} ${lb}  ${a.label}`);
}
out.push('');

out.push('시나리오 커버리지 (0이면 검증되지 않은 경로):');
for (const [k, v] of Object.entries(r.scenario_counts).sort()) out.push(`  ${k.padEnd(18)} ${v}`);
out.push('');

out.push(`봉인 결과: 통과 ${r.sealed} · 거부 ${r.blocked}`);
out.push('거부 사유 분포:');
const kinds = Object.entries(r.block_kinds).sort((a, b) => b[1] - a[1]);
if (kinds.length === 0) out.push('  (없음 — 전부 통과했다면 게이트가 작동하지 않는 것이다)');
for (const [k, v] of kinds) out.push(`  ${k.padEnd(28)} ${v}`);
out.push('');

out.push('전 프레임 거울:');
for (const s of r.corpus_sentences) out.push(`  · ${s}`);
out.push('');

out.push('-'.repeat(64));
if (r.violations.length === 0) {
  out.push(`불변식 위반 0 — 열 개의 불변식이 ${r.episodes} 에피소드에서 양방향으로 서 있다.`);
  out.push('  I1 이해 게이트 · I1b 탈출구 · I2 권한 등급 · I3 봉인 일관성');
  out.push('  I4 시끄러운 실패 · I5 두 세계 · I6 미판독 보존 · I7 무판정');
  out.push('  I8 정산 접촉 · I9 빈티지 보존');
} else {
  out.push(`불변식 위반 ${r.violations.length}건 — 집이 서 있지 않다:`);
  for (const v of r.violations.slice(0, 20)) {
    out.push(`  [${v.invariant}] ${v.scenario}/${v.frame_id}: ${v.detail}`);
  }
}

// ── 2층: 시스템 루프 ─────────────────────────────────────────────────
const sys = runSystemSimulation(BASE_TIME);
out.push('');
out.push('='.repeat(64));
out.push('시스템 루프 — 전제가 흔들리면 판단이 깨어나는가');
out.push('');
out.push('  시나리오'.padEnd(24) + '전제 처지'.padEnd(14) + '깨어난 판단');
for (const s of sys.scenarios) {
  out.push(`  ${s.padEnd(22)} ${String(sys.stances[s]).padEnd(13)} ${sys.woken[s]}`);
}
out.push('');
out.push('지표 판독 (E-0에서 "측정조차 못 함"이던 것):');
for (const s of sys.scenarios) {
  out.push(`  [${s}]`);
  out.push(`    M2 ${sys.m2[s]}`);
  out.push(`    M3 ${sys.m3[s]}`);
  out.push(`    M5 ${sys.m5[s]}`);
}
out.push('');
out.push('-'.repeat(64));
if (sys.violations.length === 0) {
  out.push('시스템 불변식 위반 0 — 열 개의 불변식이 양방향으로 서 있다.');
  out.push('  S1 전제 처지 · S2 미판독 보존 · S3 귀환 트리거 · S4 과발화 금지');
  out.push('  S5 M2 · S6 M3 · S7 M5 · S8 넘나듦 · S9 무판정 · S10 임계 공시');
} else {
  out.push(`시스템 불변식 위반 ${sys.violations.length}건:`);
  for (const v of sys.violations) out.push(`  [${v.invariant}] ${v.scenario}: ${v.detail}`);
}

console.log(out.join('\n'));
process.exitCode = r.violations.length === 0 && sys.violations.length === 0 ? 0 : 1;
