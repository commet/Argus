import { checkSubject, type CheckResult, type CheckSubject, type Match } from '../check/match.js';
import type { DecisionRecord } from '../types.js';

/**
 * 막을 것인가 (단계 9, L3).
 *
 * 단계 7 의 알림과 **같은 기계**를 쓴다 (`checkSubject`). 다른 것은 하나뿐 —
 * 여기는 **금지형(`ban`)만** 막는다. 나머지 종류는 걸려도 안 막는다.
 *
 * 왜 금지형만인가: 고정(`pin`)은 *"이렇게 하기로 했다"* 이고, 그 반대가 늘
 * 사고인 것은 아니다. 열림(`open`)은 아직 안 정한 것이고, 예측(`pred`)은
 * 막을 대상이 아니라 채점할 대상이다. **금지만이 "이건 하지 마라"** 다.
 *
 * **못 여는 문에는 열쇠 설명서를 안 붙인다** (기획서 §4.3). 이 저장소의 실물
 * L3 원형이 그 실수를 한다 — 훅 본문이 우회 대안을 친절히 안내한다. 자동
 * 컴파일과 결합하면 잠긴 문마다 열쇠를 대량 생산한다. `say.ts` 가 그 규율을
 * 문장 수준에서 지키고, 테스트가 강제한다.
 *
 * **엔진이 못 읽으면 안 막는다.** 기획서 §4.1 의 fail-closed 는
 * *"서명 기록을 남길 수 없으면 그 규칙의 영향력은 0"* 이라는 뜻이다 —
 * 판정을 못 하면 영향력 0, 즉 통과다. 반대로 하면 원장 한 줄이 깨졌을 때
 * 사람의 하루가 통째로 멈춘다.
 */

export interface BlockDecision {
  block: boolean;
  /** 막은 것들 (금지형만). */
  blocking: Match[];
  /** 걸리긴 했으나 금지형이 아니라 안 막은 것 — 세어서 알린다. */
  matched_not_ban: number;
  check: CheckResult;
}

export function decideBlock(
  records: readonly DecisionRecord[], subject: CheckSubject,
): BlockDecision {
  const check = checkSubject(records, subject);
  const banIds = new Set(records.filter((r) => r.type === 'ban').map((r) => r.id));
  const blocking = check.matches.filter((m) => banIds.has(m.id));
  return {
    block: blocking.length > 0,
    blocking,
    matched_not_ban: check.matches.length - blocking.length,
    check,
  };
}
