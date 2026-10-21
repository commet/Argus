import type { DecisionRecord } from './types.js';

/**
 * **그때 쓴 문장을 그때 쓴 대로 돌려준다** (기획 v5 §"정산", 빈티지 고정).
 *
 * 정산 화면의 규율은 *"그때 쓴 문장을 먼저 보여주고 나서 묻는다"* 다. 기억은
 * 다시 쓰인다 — 사람은 **지금의 자기 생각을 그때의 생각이라고 믿는다**(E-0 실측).
 * 원문을 눈앞에 놓지 않고 물으면, 자기가 쓰지 않은 판단을 자기 판단으로 확인한다.
 *
 * 그런데 접힌 기록의 `decision`·`because` 는 **개정이 덮어쓴 지금 값**이다.
 * 그래서 2026-09-10 까지 정산 화면은 규율을 주석으로만 지키고 있었다 — 개정된
 * 결정을 다시 물으면 **고쳐진 문장이 "그때 쓴 문장"으로 나왔다.** 실측으로
 * 확인했다: `무료 티어는 만들지 않는다` 로 서명하고 `무료 티어는 초대제로만
 * 만든다` 로 고친 뒤 물었더니, 화면에 뒤엣것만 있었다. 막으려던 바로 그 병이다.
 *
 * 원문은 지우지 않았으므로 되찾을 수 있다 — 개정마다 `{field, from, to}` 가
 * 쌓여 있고, **가장 이른 `from` 이 서명 당시의 값**이다.
 */

/** 개정으로 덮이기 전, 서명 당시의 값. 한 번도 안 고쳤으면 지금 값이 곧 그것이다. */
export function asSigned(
  record: DecisionRecord, field: 'decision' | 'because',
): string | undefined {
  for (const amendment of record.amendments) {
    const change = amendment.changed.find((c) => c.field === field);
    // 첫 개정의 `from` 이 서명 당시의 값이다. 그 뒤 것들은 개정끼리의 값이다.
    if (change) return change.from === '' ? undefined : change.from;
  }
  return record[field];
}

/** 서명 뒤에 이 칸이 고쳐졌나 — 고쳐졌으면 지금 값도 같이 보여줘야 한다. */
export function wasAmended(record: DecisionRecord, field: 'decision' | 'because'): boolean {
  return record.amendments.some((a) => a.changed.some((c) => c.field === field));
}
