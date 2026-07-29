import { describe, expect, it } from 'vitest';
import { buildEarlyContract, contractStatus, contractPhase, isBaselineOnlyContract } from '../decision-contract';
import type { DecisionContract } from '@/stores/types';

/**
 * 날짜 없는 기준점은 due 가 아니다 (2026-07-29 실주행에서 발견).
 *
 * ── 무엇이 깨져 있었나 ──────────────────────────────────────────────────
 * 본선 초입의 "검토 전 기준점" 단계에서 한 줄만 적고 **날짜를 안 고르면**
 * `check_in_at` 없는 계약이 생긴다. `contractStatus` 는 날짜가 없을 때
 * "미채점인 동안 계속 due" 로 처리했으므로, 그 계약은 태어나는 순간부터 due 였다.
 *
 * 결과 두 가지:
 *   1. 시작 5분 된 사람이 "확인일이 왔어요 · 돌아오셨네요"를 본다. 온 적도,
 *      돌아온 적도, 확인일도 없다.
 *   2. **봉인 종막이 렌더되지 않는다.** ProgressiveFlow 는
 *      `contractProject && !contractDue` 일 때만 닫는 봉인을 그린다. 그래서
 *      기준점을 남긴 사람은 검토를 끝까지 마쳐도 봉인 제안을 못 만나고,
 *      계약은 술어가 안 붙어 기준점 상태에 갇힌다 — 확인일도 알림도 정산도 없다.
 *
 * 봉인이 이 제품이다. 그래서 이 가드가 척추에 붙는다.
 *
 * ── 이 가드가 빨간불이 되는 조건 ────────────────────────────────────────
 * 날짜를 안 고른 기준점이 다시 due 로 계산되는 것. 그리고 그 반대 —
 * 날짜를 **고른** 기준점이 그날이 왔는데도 조용해지는 것. 양쪽을 다 본다.
 * 한쪽만 보면 "무조건 false" 로 바꿔도 절반은 통과한다.
 */

const NOW = new Date('2026-07-29T04:00:00.000Z').getTime();
const DAY = 24 * 60 * 60 * 1000;

function baseline(opts: Parameters<typeof buildEarlyContract>[1]): DecisionContract {
  const c = buildEarlyContract('p1', opts, NOW);
  if (!c) throw new Error('기준점 계약이 안 만들어졌다 — 이 테스트의 전제가 깨졌다');
  return c;
}

describe('검토 전 기준점 — 약속이 아니라 출발점', () => {
  it('날짜를 안 고른 기준점은 태어나자마자 due 가 아니다', () => {
    const c = baseline({ lean: '지금은 채용을 미루는 쪽으로 기운다.' });
    expect(c.check_in_at, '이 테스트의 전제: 날짜를 안 골랐다').toBeUndefined();
    expect(isBaselineOnlyContract(c)).toBe(true);
    expect(
      contractStatus(c, NOW).checkInDue,
      '날짜 없는 기준점이 due 면 (a) 처음 온 사람에게 "돌아오셨네요"라 하고 '
      + '(b) 봉인 종막이 안 뜬다 — 검토를 마쳐도 봉인할 방법이 없어진다.',
    ).toBe(false);
  });

  it('한 달이 지나도 여전히 due 가 아니다 (약속한 날이 없으므로)', () => {
    const c = baseline({ lean: '지금은 채용을 미루는 쪽으로 기운다.' });
    expect(contractStatus(c, NOW + 30 * DAY).checkInDue).toBe(false);
  });

  it('그래도 phase 는 baseline 이다 — 조용해질 뿐 사라지지 않는다', () => {
    // due 가 아니라는 것과 기록이 없다는 것은 다르다. 기준점은 그대로 남아
    // "검토 전 기준점이 남아 있어요"로 보여야 한다.
    const c = baseline({ lean: '지금은 채용을 미루는 쪽으로 기운다.' });
    expect(contractPhase(c, NOW + 30 * DAY)).toBe('baseline');
  });
});

describe('날짜를 고른 기준점은 진짜 약속이다', () => {
  it('고른 날이 오면 due 가 된다', () => {
    const c = baseline({
      lean: '지금은 채용을 미루는 쪽으로 기운다.',
      check_in_at: new Date(NOW + 7 * DAY).toISOString(),
    });
    expect(c.check_in_at, '이 테스트의 전제: 날짜를 골랐다').toBeTruthy();
    expect(contractStatus(c, NOW).checkInDue, '아직 그날이 아니다').toBe(false);
    expect(
      contractStatus(c, NOW + 7 * DAY).checkInDue,
      '고른 날이 왔는데 조용하면 그 사람은 자기가 한 약속을 영영 못 만난다.',
    ).toBe(true);
  });

  it('고른 날 이후에도 계속 due 다 (하루 지나면 사라지지 않는다)', () => {
    const c = baseline({
      lean: '지금은 채용을 미루는 쪽으로 기운다.',
      check_in_at: new Date(NOW + 7 * DAY).toISOString(),
    });
    expect(contractStatus(c, NOW + 20 * DAY).checkInDue).toBe(true);
  });
});

describe('기준점이 아닌 계약은 예전과 같다', () => {
  it('검토가 만든 술어가 붙은 계약은 날짜가 없어도 계속 떠오른다', () => {
    // "날짜를 안 약속했으면 미채점인 동안 다시 떠오른다"는 원래 의도는 그대로다.
    // 이번 수정은 **기준점만** 예외로 뺀 것이지, 그 규칙을 없앤 게 아니다.
    const c = baseline({ lean: '지금은 채용을 미루는 쪽으로 기운다.' });
    const sealed: DecisionContract = {
      ...c,
      predicates: [
        ...c.predicates,
        { id: 'r1', text: 'CFO가 비용에 반대한다', source: 'risk' },
      ],
    };
    expect(isBaselineOnlyContract(sealed), '술어가 붙으면 더 이상 기준점이 아니다').toBe(false);
    expect(contractStatus(sealed, NOW).checkInDue).toBe(true);
  });
});
