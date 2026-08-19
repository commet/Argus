/**
 * 귀환이 남기는 규칙 — 붙이는 자리의 거절 조건.
 *
 * 감사(DLP-5)가 지적한 것은 "귀환이 관찰에서 끝난다"였다. 규칙을 저장할 자리를
 * 만들면 곧바로 반대 위험이 생긴다 — 그 자리를 사용자가 아닌 것이 채우는 것.
 * 그래서 `attachSettlementLesson` 은 두 경우에 **아무것도 쓰지 않고** 계약을
 * 그대로 돌려준다. 호출자가 거절을 성공으로 오인할 수 없게 하기 위해서다.
 *
 *   1. 빈 텍스트 — 규칙 없는 귀환은 정직한 공백이지, 채워야 할 칸이 아니다.
 *   2. 이미 규칙이 있는 귀환 — 두 번째 쓰기는 사용자가 채택한 문장을 조용히
 *      갈아치운다.
 */

import { describe, expect, it } from 'vitest';
import type { ContractSettlement, DecisionContract } from '@/stores/types';
import { attachSettlementLesson } from '../decision-contract';

const REF = 'web:return:p1:abc';

const settlement = (patch: Partial<ContractSettlement> = {}): ContractSettlement => ({
  option_id: 'condition_met',
  response_text: '조건이 충족됐어요',
  recorded_at: '2026-08-01T00:00:00.000Z',
  axes: { reality: 'met', question: 'valid' },
  authorization: {
    authorized_by: 'human',
    authorization_mode: 'explicit_confirmation',
    surface: 'web',
    authorization_ref: REF,
    authorized_at: '2026-08-01T00:00:00.000Z',
  },
  ...patch,
});

const contract = (settlements: ContractSettlement[]): DecisionContract => ({
  id: 'c1',
  project_id: 'p1',
  created_at: '2026-07-01T00:00:00.000Z',
  predicates: [],
  settlements,
});

const NOW = new Date('2026-08-02T09:00:00.000Z').getTime();

describe('attachSettlementLesson', () => {
  it('사용자가 쓴 규칙을 그 귀환에 붙인다 — 새 정산을 만들지 않는다', () => {
    const before = contract([settlement()]);
    const after = attachSettlementLesson(before, REF, '  이런 상황에선 2주 더 본다  ', NOW);

    expect(after.settlements).toHaveLength(1);
    expect(after.settlements![0].lesson).toEqual({
      text: '이런 상황에선 2주 더 본다',
      authored: 'user',
      recorded_at: '2026-08-02T09:00:00.000Z',
    });
    // 나머지는 손대지 않는다 — 귀환 기록은 덧붙는 것이지 고쳐지는 것이 아니다.
    expect(after.settlements![0].response_text).toBe('조건이 충족됐어요');
    expect(before.settlements![0].lesson, '원본을 제자리에서 바꿨습니다').toBeUndefined();
  });

  it('빈 텍스트로는 아무것도 쓰지 않는다', () => {
    const before = contract([settlement()]);
    for (const empty of ['', '   ', '\n']) {
      expect(attachSettlementLesson(before, REF, empty, NOW)).toBe(before);
    }
  });

  it('이미 규칙이 있는 귀환은 닫혀 있다 — 조용한 교체가 없다', () => {
    const before = contract([settlement({
      lesson: { text: '먼저 쓴 규칙', authored: 'user', recorded_at: '2026-08-01T00:00:00.000Z' },
    })]);
    const after = attachSettlementLesson(before, REF, '나중에 온 규칙', NOW);
    expect(after).toBe(before);
    expect(after.settlements![0].lesson!.text).toBe('먼저 쓴 규칙');
  });

  it('가리키는 귀환이 없으면 아무 데도 붙이지 않는다', () => {
    const before = contract([settlement()]);
    // 참조가 없거나(레거시 정산) 다른 귀환을 가리키면 조용히 아무 데나 붙이는
    // 대신 그대로 둔다 — 엉뚱한 귀환에 남의 규칙이 붙는 것이 더 나쁘다.
    expect(attachSettlementLesson(before, undefined, '규칙', NOW)).toBe(before);
    expect(attachSettlementLesson(before, 'web:return:p1:other', '규칙', NOW)).toBe(before);
    expect(attachSettlementLesson(contract([]), REF, '규칙', NOW).settlements).toEqual([]);
  });
});
