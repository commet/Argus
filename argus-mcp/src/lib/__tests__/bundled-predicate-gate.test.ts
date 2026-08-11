/**
 * The bundle gate — one predicate holds one claim.
 *
 * WHY THIS EXISTS. The first-user journey simulation died at the seal five
 * times out of five (docs/receipts/2026-08-11-first-user-journey/). A
 * practitioner's real sentence bundles several checkable claims, and the two
 * observed outcomes were both fatal: the assistant read the contract, saw
 * nowhere to put the other claims, and never called; or it crammed the bundle
 * into 400 characters, producing a record settle can only ever grade `partial`.
 *
 * The rule is NOT new. argus-plugin-v2/scripts/sense-signal.js has carried it
 * as prose since the plugin shipped, and argus-mcp carried it nowhere at all,
 * so which rule a user got depended on which surface they arrived through.
 * This gate is the code that fires regardless of what the caller read, and the
 * mirror test below is what stops the two zones drifting again.
 *
 * The cases are split deliberately. FIRES holds sentences that were actually
 * observed or are the same shape; PASSES holds the false positives that would
 * make this gate manufacture friction, which is its own spine violation
 * (CLAUDE.md, 거울 조항). A gate that fires on everything is not a gate.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { detectBundledClaims, validateSeal } from '../validate-seal.js';

const TODAY = '2026-08-11';
const FUTURE = '2026-09-01';

// Bundles. The first two are verbatim from the recorded runs.
const FIRES: Array<[string, string]> = [
  ['Migration mostly smooth, but 1-2 breakages surface in the first week. Total time ~3 working days',
    'RUN5가 실제로 봉인한 문장 (정산 불가 기록이 됐다)'],
  ['migration goes mostly smoothly; 1-2 edge cases break; done by Friday',
    'RUN3 어시스턴트가 스스로 묶음이라고 지적한 문장'],
  ['이번 분기 매출 1억 넘고, 이탈률은 5% 아래로 유지된다', '한국어 등위 접속 + 양쪽에 크기'],
  ['P95 latency stays under 200ms; error rate stays under 1%', '세미콜론 열거'],
  ['배포는 금요일에 끝난다\n다운타임은 5분 미만이다', '줄바꿈 열거'],
  // RUN7이 실제로 봉인해 통과시킨 문장. 절 셋에 숫자는 하나뿐이라 2-크기
  // 규칙을 빠져나갔고, 정산은 이것도 "절반만 맞음"으로만 매길 수 있다.
  ['Clean cutover with no data loss, roughly 15-30 min of downtime during the switch, and query latency improving or staying flat once indexes rebuild.',
    'RUN7이 통과시킨 3절 열거 (숫자 하나)'],
];

// Single claims. Each of these refusing would be manufactured friction.
const PASSES: Array<[string, string]> = [
  ['cutover downtime < 5 min', '정본 예시'],
  ['cutover downtime < 5 min and no data loss', '"and"지만 뒤쪽에 자기 크기가 없다'],
  ['by 2026-09-01, cutover downtime < 5 min', '확인일을 문장 안에 다시 쓴 것 (오탐 1순위)'],
  ['2026-09-01까지 다운타임 5분 미만', '한국어 날짜 + 단일 주장'],
  ['we ship the app by Friday', '숫자 없는 단일 주장'],
  ['revenue grows more than 20% quarter over quarter', '한 절 안에 숫자 둘'],
  ['downtime and latency stay under 5 min', '"and"가 명사구를 잇는다'],
  ['P95 latency stays under 200ms.', '마침표로 끝나도 한 문장'],
  ['response time stays under 5.5 seconds', '소수점이 문장을 쪼개지 않는다'],
  ['팀이 2명 늘어도 배포 주기는 그대로다', '뒤 절에 크기가 없다'],
  // 이 문장은 플러그인 SEED 픽스처의 정본이고, 게이트를 그쪽에 미러하자마자
  // 오탐으로 잡혔다. 조건절은 채점 조건이지 두 번째 주장이 아니다.
  ['If we compress the crew to 5, 30-day first-run completion stays at or above the 62% baseline.',
    '조건문 — 양쪽에 숫자가 있어도 주장은 하나 (플러그인 픽스처가 잡아낸 오탐)'],
  ['수수료를 3% 올리면 이탈률은 5% 아래로 유지된다', '한국어 조건문 (…면)'],
];

describe('묶음 예측 게이트 (BUNDLED_PREDICATE)', () => {
  it.each(FIRES)('묶음을 잡는다: %s', (predicate) => {
    const claims = detectBundledClaims(predicate);
    expect(claims, '이 문장은 묶음으로 잡혀야 한다').not.toBeNull();
    expect(claims!.length).toBeGreaterThan(1);
  });

  it.each(PASSES)('단일 주장은 통과시킨다: %s', (predicate) => {
    expect(detectBundledClaims(predicate), '이 문장을 막으면 마찰 제조다').toBeNull();
  });

  it('validateSeal이 묶음을 거절하고 절을 함께 돌려준다', () => {
    const err = validateSeal(FIRES[0][0], FUTURE, TODAY);
    expect(err?.code).toBe('BUNDLED_PREDICATE');
    // 모델이 방금 건네받은 분해를 다시 유도하지 않도록 절이 실려야 한다.
    expect(err?.claims?.length).toBeGreaterThan(1);
    // 약한 휴리스틱이다 — VIBE와 같은 등급으로 표시해 하드 게이트로 승격되지 않게.
    expect(err?.weak).toBe(true);
  });

  it('숫자로 가득한 묶음도 HARD_ANCHOR 우회로 빠져나가지 못한다', () => {
    // 이 순서가 뒤집히면 게이트가 존재 의미를 잃는다: 묶음은 본래 숫자로
    // 이루어져 있어서, HARD_ANCHOR 조기 반환이 먼저 돌면 전부 통과한다.
    const err = validateSeal('매출 1억 넘는다; 이탈률 5% 아래', FUTURE, TODAY);
    expect(err?.code).toBe('BUNDLED_PREDICATE');
  });

  it('구조적 거절(빈 문장·과거 날짜)이 묶음 판정보다 먼저 온다', () => {
    expect(validateSeal('짧다', FUTURE, TODAY)?.code).toBe('EMPTY_PREDICATE');
    expect(validateSeal(FIRES[0][0], '2020-01-01', TODAY)?.code).toBe('BAD_CHECK_BY');
  });
});

describe('두 존이 같은 규칙을 말한다 (드리프트 차단)', () => {
  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const PLUGIN = path.resolve(HERE, '../../../../argus-plugin-v2/scripts/sense-signal.js');

  it('플러그인 프롬프트가 "한 예측에 주장 하나" 규칙을 여전히 담고 있다', () => {
    // 이 규칙이 플러그인에만 있고 MCP에는 없던 것이 원인이었다. 한쪽에서
    // 사라지면 다시 갈라지므로, 사라짐 자체를 빨간불로 만든다.
    if (!fs.existsSync(PLUGIN)) {
      // MIT 존이 따로 배포될 수 있으므로 부재는 실패가 아니라 건너뜀 —
      // 다만 조용히 초록이 되지 않도록 존재할 때만 검사한다는 사실을 남긴다.
      expect(fs.existsSync(PLUGIN)).toBe(false);
      return;
    }
    const source = fs.readFileSync(PLUGIN, 'utf8');
    expect(source).toMatch(/exactly ONE falsifiable claim per predicate/);
    expect(source).toMatch(/never conjoin them/);
  });

  it('MCP 도구 표면도 같은 규칙을 말한다', async () => {
    const { seal } = await import('../../tools/seal.js');
    const shape = seal.inputSchema as unknown as { shape: Record<string, { description?: string }> };
    const predicate = shape.shape['predicate'];
    // 게이트가 강제하더라도, 호출문을 쓰는 자리에서 미리 알려주지 않으면
    // 모델은 거절을 맞고 나서야 안다 (M1 위치 수리의 교훈).
    expect(predicate?.description ?? '').toMatch(/ONE prediction/);
  });
});
