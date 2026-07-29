import { describe, expect, it } from 'vitest';
import {
  isMonitored,
  isDueForRecheck,
  isDueForReconsider,
  addDays,
  DEFAULT_RECHECK_CADENCE_DAYS,
  DEFAULT_REPONDER_CADENCE_DAYS,
  type PremiseState,
} from '../premises-core';

/**
 * 확인일 산수 — 뮤테이션 프로브가 지목한 구멍 (2026-07-29).
 *
 * `node scripts/mutation-probe.mjs src/lib/premises-core.ts …` 를 돌리니 kill rate가
 * 47%였고, 살아남은 것 중 가장 무거운 게 이 두 줄이었다:
 *
 *     daysBetween(last, today)   >= recheckCadenceDays(p)     ← >= 를 < 로 뒤집어도 초록
 *     daysBetween(anchor, today) >= reponderCadenceDays(p)    ← 같음
 *
 * 이 비교가 뒤집히면 **확인일이 온 전제는 조용해지고 아직 안 온 전제가 매일 울린다.**
 * 제품의 척추(봉인 → 현실 → 정산)가 통째로 반대로 도는데 3,893개 테스트가 전부
 * 초록이었다. 그게 "초록을 못 믿겠다"의 정확한 근거다.
 *
 * 여기 있는 케이스는 전부 경계 양쪽을 함께 본다 — 한쪽만 보면 부등호를 뒤집어도
 * 절반은 그대로 통과한다.
 */

const TODAY = '2026-07-29';

function premise(over: Partial<PremiseState> = {}): PremiseState {
  return {
    premise_id: 'p1',
    ordinal: 1,
    kind: 'premise',
    text: '기준금리가 3.5%를 넘지 않는다',
    external: true,
    load_bearing: true,
    source: 'user_stated',
    status: 'active',
    amend_history: [],
    recheck_count: 0,
    ...over,
  } as PremiseState;
}

function checkedDaysAgo(days: number): PremiseState {
  return premise({ last_recheck: { finding: 'x', drifted: false, baseline_only: true, source: 'url', ts: `${addDays(TODAY, -days)}T00:00:00.000Z` } });
}

describe('전제 재확인 due — 부등호가 뒤집히면 빨간불', () => {
  const cadence = DEFAULT_RECHECK_CADENCE_DAYS;

  it('마지막 확인이 주기보다 오래됐으면 due다', () => {
    expect(isDueForRecheck(checkedDaysAgo(cadence + 5), TODAY)).toBe(true);
  });

  it('주기가 아직 안 찼으면 due가 아니다 (경계 아래)', () => {
    expect(isDueForRecheck(checkedDaysAgo(cadence - 1), TODAY)).toBe(false);
  });

  it('정확히 주기가 찬 날은 due다 (>= 의 = 쪽)', () => {
    expect(isDueForRecheck(checkedDaysAgo(cadence), TODAY)).toBe(true);
  });

  it('어제 확인했으면 오늘은 절대 due가 아니다', () => {
    expect(isDueForRecheck(checkedDaysAgo(1), TODAY)).toBe(false);
  });

  it('한 번도 확인 안 했고 추가된 지 얼마 안 됐으면 아직 조르지 않는다', () => {
    // "봉인 다음 날 재확인하라"는 조기 발화를 막은 창업자 결정(2026-07-10)이 이 줄에 산다.
    expect(isDueForRecheck(premise({ added_ts: `${addDays(TODAY, -2)}T00:00:00.000Z` }), TODAY)).toBe(false);
  });

  it('추가된 지 주기를 넘겼는데 한 번도 확인 안 했으면 due다', () => {
    expect(isDueForRecheck(premise({ added_ts: `${addDays(TODAY, -(cadence + 1))}T00:00:00.000Z` }), TODAY)).toBe(true);
  });

  it('추가일도 확인 기록도 없으면 due로 본다 (모르면 물어본다)', () => {
    expect(isDueForRecheck(premise(), TODAY)).toBe(true);
  });
});

describe('미결질문 reconsider due — 같은 부등호, 같은 경계', () => {
  const cadence = DEFAULT_REPONDER_CADENCE_DAYS;
  const question = (over: Partial<PremiseState> = {}) =>
    premise({ kind: 'open_question', load_bearing: false, ...over });

  it('마지막 보류가 주기보다 오래됐으면 due다', () => {
    expect(isDueForReconsider(question({ last_reconsidered: `${addDays(TODAY, -(cadence + 3))}T00:00:00.000Z` }), TODAY)).toBe(true);
  });

  it('주기가 아직 안 찼으면 due가 아니다', () => {
    expect(isDueForReconsider(question({ last_reconsidered: `${addDays(TODAY, -(cadence - 2))}T00:00:00.000Z` }), TODAY)).toBe(false);
  });

  it('정확히 주기가 찬 날은 due다', () => {
    expect(isDueForReconsider(question({ last_reconsidered: `${addDays(TODAY, -cadence)}T00:00:00.000Z` }), TODAY)).toBe(true);
  });

  it('앵커가 아예 없으면 due로 본다', () => {
    expect(isDueForReconsider(question(), TODAY)).toBe(true);
  });
});

describe('감시 스위치 — 끄면 정말 멈춘다 (양쪽 종류 모두)', () => {
  it('전제: monitoring_enabled=false면 감시 대상이 아니다', () => {
    expect(isMonitored(premise({ monitoring_enabled: false }))).toBe(false);
    expect(isDueForRecheck(premise({ ...checkedDaysAgo(90), monitoring_enabled: false }), TODAY)).toBe(false);
  });

  it('전제: 스위치를 안 건드렸으면 historical default(켜짐)를 지킨다', () => {
    expect(isMonitored(premise())).toBe(true);
    expect(isMonitored(premise({ monitoring_enabled: true }))).toBe(true);
  });

  it('미결질문: monitoring_enabled=false면 reconsider도 멈춘다', () => {
    const muted = premise({ kind: 'open_question', load_bearing: false, monitoring_enabled: false });
    expect(isDueForReconsider(muted, TODAY)).toBe(false);
  });

  it('은퇴/해결된 항목은 종류와 무관하게 조용하다', () => {
    expect(isMonitored(premise({ status: 'retired' }))).toBe(false);
    expect(isDueForReconsider(premise({ kind: 'open_question', status: 'resolved' }), TODAY)).toBe(false);
  });
});
