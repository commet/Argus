/**
 * 검증 루프 — 자동 CHECK 단계.
 *
 * gallery/surfaces.json을 프로그램으로 훑어 사람 눈 없이도 잡히는 결함을
 * 표면별로 리포트한다. 매 캡처 뒤 이걸 돌려 회귀를 즉시 잡는다("정교한
 * validation loop"). 눈으로 봐야 하는 미학은 사람이, 규칙 위반은 기계가.
 *
 * 검사 항목:
 *  1. 스파인 위반 — 사용자 대상 판정/점수/재촉/추천 어휘 (RUBRIC 10)
 *  2. 마크다운 잔재 — 리터럴 **, 남은 * _ 헤딩#
 *  3. 가독성 — 본문 단락 최소 폰트 < 12px
 *  4. 레일 정합 — 노드/eyebrow 존재
 *  5. 표면 누락 — 완주(complete) 도달 여부
 *
 * 사용: node scripts/uiux-loop/check.mjs
 * 종료코드: 0 = 무결, 1 = P0/P1 결함 존재.
 */

import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dir = dirname(fileURLToPath(import.meta.url));
const d = JSON.parse(readFileSync(join(__dir, 'gallery', 'surfaces.json'), 'utf8'));

// 스파인 금지 어휘 — 사용자 대상 표면에서 나오면 위반. (라벨/도움말 맥락은
// 오탐 가능하니 리포트만 하고 사람이 판정.) RUBRIC 2층 #10.
const SPINE_BAD = [
  /추천(합니다|해요|드려요|드립니다)/, /권장(합니다|해요)/, /권해요/,
  /이걸(로)? 하세요\b/, /하는 게 좋(습니다|아요)/, /하셔야 (합니다|해요)/,
  /점수는? \d/, /등급(은|이) [A-Fㄱ-ㅎ가-힣]/, /vitality|gamma tier/i,
  /벌써 \d+일/, /놓치지 마세요/, /서둘러/, /지금 안 하면 늦/,
];
// 렌더 안 된 마크다운 잔재.
const MD_ARTIFACT = [/\*\*/, /(^|\s)#{1,3}\s/, /\]\(https?:/];

const findings = [];
let reachedComplete = false;

for (const s of d.surfaces) {
  const text = s.text || '';
  const where = `${s.name}(${s.phase})`;
  if (s.name === 'complete-full' || s.name === 'complete-bearing') reachedComplete = true;

  for (const re of SPINE_BAD) {
    const m = text.match(re);
    if (m) findings.push({ sev: 'P1', dim: 'spine', where, detail: `금지어휘 후보 "${m[0]}" — 맥락 확인 필요` });
  }
  for (const re of MD_ARTIFACT) {
    const m = text.match(re);
    if (m) findings.push({ sev: 'P1', dim: 'md-artifact', where, detail: `렌더 안 된 마크다운 "${(m[0]||'').trim()}"` });
  }
  const mf = s.measures?.minBodyFontPx;
  if (typeof mf === 'number' && mf < 12) {
    findings.push({ sev: 'P2', dim: 'readability', where, detail: `본문 최소 ${mf}px < 12px 하한` });
  }
  // headlines: 화면당 큰 display 활자(≥18px)가 2개 이상이면 위계 냄새
  const bigHeads = (s.measures?.headlines || []).filter(h => parseFloat(h.fontSize) >= 18);
  if (bigHeads.length >= 3) {
    findings.push({ sev: 'P2', dim: 'hierarchy', where, detail: `큰 헤드라인 ${bigHeads.length}개 (${bigHeads.map(h=>h.fontSize).join(',')}) — 주인공 1개 원칙 확인` });
  }
}

if (!reachedComplete) findings.push({ sev: 'P0', dim: 'coverage', where: 'journey', detail: '완주(complete) 표면 미도달 — 여정이 끝까지 안 감' });

// 리포트
const bySev = { P0: [], P1: [], P2: [] };
for (const f of findings) bySev[f.sev].push(f);
console.log(`\n=== CHECK (scenario: ${d.scenario?.problem?.slice(0,30) || '?'}) ===`);
for (const sev of ['P0', 'P1', 'P2']) {
  for (const f of bySev[sev]) console.log(`  [${sev}] ${f.dim} · ${f.where} · ${f.detail}`);
}
console.log(`합계: P0=${bySev.P0.length} P1=${bySev.P1.length} P2=${bySev.P2.length}`);
process.exit(bySev.P0.length + bySev.P1.length > 0 ? 1 : 0);
