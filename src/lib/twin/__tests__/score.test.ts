import { beforeEach, describe, expect, it, vi } from 'vitest';

// TWIN 성적표 — 두 숫자를 절대 섞지 않는다는 계약의 기계 검증.
//
// match rate  = 분신이 **나를** 아는가 (choice/deviation, 채택과 대조)
// outcome rate = 분신이 **현실을** 맞히는가 (outcome, 관찰과 대조)
//
// 이 둘을 하나로 합치면 시장의 클론들과 같은 물건이 된다 — 흉내 점수만 있고
// 현실 성적이 없는 것. 모수 규칙(indeterminate·late·오염 제외)도 여기서 지킨다.

type Row = { target: string; verdict: string; status: string; contaminated_by_lean: boolean };

let rows: Row[] = [];
let shouldError = false;

vi.mock('@/lib/share-guard', () => ({
  adminClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            in: (_col: string, verdicts: string[]) =>
              Promise.resolve(
                shouldError
                  ? { data: null, error: { message: 'boom' } }
                  : { data: rows.filter((r) => verdicts.includes(r.verdict)), error: null },
              ),
          }),
        }),
      }),
    }),
  }),
}));

import { twinScore } from '../store';

function row(over: Partial<Row> = {}): Row {
  return { target: 'outcome', verdict: 'supported', status: 'revealed', contaminated_by_lean: false, ...over };
}

beforeEach(() => {
  rows = [];
  shouldError = false;
});

describe('twinScore', () => {
  it('표본이 없으면 null 과 0 — 0% 라고 말하지 않는다', async () => {
    const s = await twinScore('user-1');
    expect(s).toEqual({ matchRate: null, matchSample: 0, outcomeRate: null, outcomeSample: 0 });
  });

  it('두 지표를 분리해서 센다', async () => {
    rows = [
      row({ target: 'outcome', verdict: 'supported' }),
      row({ target: 'outcome', verdict: 'contradicted' }),
      row({ target: 'choice', verdict: 'supported' }),
      row({ target: 'deviation', verdict: 'supported' }),
    ];
    const s = await twinScore('user-1');
    expect(s.outcomeSample).toBe(2);
    expect(s.outcomeRate).toBe(0.5);
    expect(s.matchSample).toBe(2);
    expect(s.matchRate).toBe(1);
  });

  it('오염된 choice 예측(lean 있었음)은 match 모수에서 빠진다', async () => {
    rows = [
      row({ target: 'choice', verdict: 'supported', contaminated_by_lean: true }),
      row({ target: 'choice', verdict: 'supported', contaminated_by_lean: false }),
    ];
    const s = await twinScore('user-1');
    expect(s.matchSample).toBe(1); // 자명한 예측은 성적을 부풀리지 않는다
  });

  it('오염됐어도 deviation 예측은 센다 — 그것이 비자명한 예측이다', async () => {
    rows = [row({ target: 'deviation', verdict: 'contradicted', contaminated_by_lean: true })];
    const s = await twinScore('user-1');
    expect(s.matchSample).toBe(1);
    expect(s.matchRate).toBe(0);
  });

  it('indeterminate 는 조회 단계에서 빠진다 — 판정 못 한 것을 세지 않는다', async () => {
    rows = [
      row({ target: 'outcome', verdict: 'supported' }),
      row({ target: 'outcome', verdict: 'indeterminate' }),
    ];
    const s = await twinScore('user-1');
    expect(s.outcomeSample).toBe(1);
    expect(s.outcomeRate).toBe(1);
  });

  it('조회 실패 시 던지지 않고 빈 성적 — 부가 지표가 본 작업을 막지 않는다', async () => {
    shouldError = true;
    const s = await twinScore('user-1');
    expect(s.outcomeSample).toBe(0);
  });
});
