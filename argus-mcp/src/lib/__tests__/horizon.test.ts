/**
 * 지평선 입력 (+7d / +2w / +3m).
 *
 * WHY. 여정 21회에서 **거절의 44%가 날짜였다** (54건 중 24건) — 2위의 두 배가
 * 넘는 압도적 1위다. 원인은 부주의가 아니라 구조다: 절대 확인일은 "지금"에서만
 * 계산할 수 있는데 호출자에게는 시계가 없고, **자신이 모른다는 것을 모른다.**
 * 그래서 학습 시점의 연도(2026년 오늘에 대고 2025-06-13)를 확신 있게 보내고,
 * 거절 하나를 태우고, 관측된 두 실행에서는 날짜를 고치면서 예측문까지 다시 써
 * 봉인 자체를 잃었다.
 *
 * 사용자도 절대 날짜를 말한 적이 없다. "2주쯤 뒤"라고 말했다. 시계 없는 쪽에
 * 그 변환을 시키는 것이 결함이고, 이 형식은 그것을 시계 쥔 쪽으로 옮긴다.
 */
import { describe, expect, it } from 'vitest';
import { isHorizon, resolveHorizon } from '../resolve-today.js';
import { validateSeal } from '../validate-seal.js';

const TODAY = '2026-08-11';

describe('지평선 해석', () => {
  it.each([
    ['+7d', '2026-08-18'],
    ['+1d', '2026-08-12'],
    ['+2w', '2026-08-25'],
    ['+3m', '2026-11-11'],
    ['+90d', '2026-11-09'],
  ])('%s → %s', (input, expected) => {
    expect(resolveHorizon(input, TODAY)).toBe(expected);
  });

  it('대소문자와 앞뒤 공백을 견딘다', () => {
    expect(resolveHorizon(' +2W ', TODAY)).toBe('2026-08-25');
  });

  it('월 경계와 연 경계를 넘긴다', () => {
    expect(resolveHorizon('+1m', '2026-12-15')).toBe('2027-01-15');
    expect(resolveHorizon('+30d', '2026-12-20')).toBe('2027-01-19');
  });

  it('월말에서 한 달 뒤는 다음 달을 건너뛰지 않는다 (롤오버 금지)', () => {
    // setUTCMonth는 날을 다음 달로 넘겨버린다: 1월 31일 + 1개월 = 3월 3일.
    // 두 달 뒤로 튀는 것은 지평선이 막으려는 바로 그 놀라움이다.
    expect(resolveHorizon('+1m', '2026-01-31')).toBe('2026-02-28');
    expect(resolveHorizon('+1m', '2028-01-31')).toBe('2028-02-29'); // 윤년
    expect(resolveHorizon('+1m', '2026-03-31')).toBe('2026-04-30');
    expect(resolveHorizon('+1m', '2026-01-30')).toBe('2026-02-28');
  });

  it('존재하지 않는 날짜를 기준으로 삼지 않는다', () => {
    // Date는 2026-02-30을 거절하지 않고 2026-03-02로 **정규화**한다.
    // 그대로 받으면 아무도 요청하지 않은 날짜를 돌려주게 된다.
    expect(resolveHorizon('+7d', '2026-02-30')).toBeNull();
    expect(resolveHorizon('+7d', '2026-13-01')).toBeNull();
    expect(resolveHorizon('+7d', 'not-a-date')).toBeNull();
  });

  it('윤년 2월을 넘겨도 날짜를 잃지 않는다', () => {
    expect(resolveHorizon('+1d', '2028-02-28')).toBe('2028-02-29');
  });

  it.each([['2026-09-01'], ['+0'], ['7d'], ['-7d'], ['+7y'], ['soon'], [''], [null], [undefined]])(
    '지평선이 아닌 것은 null: %s', (v) => {
      expect(resolveHorizon(v as unknown, TODAY)).toBeNull();
      if (typeof v === 'string' && v !== '2026-09-01') expect(isHorizon(v)).toBe(false);
    });

  it('절대 날짜는 건드리지 않는다 (두 번째 형식이지 대체가 아니다)', () => {
    expect(resolveHorizon('2026-09-01', TODAY)).toBeNull();
    expect(isHorizon('2026-09-01')).toBe(false);
  });

  it('해석 결과는 언제나 오늘 이후라서 봉인 검증을 통과한다', () => {
    // +1d가 과거로 굴러가면(DST 등) 게이트가 그날부터 모든 봉인을 막는다.
    for (const h of ['+1d', '+7d', '+2w', '+3m']) {
      const resolved = resolveHorizon(h, TODAY)!;
      expect(validateSeal('cutover downtime < 5 min', resolved, TODAY)).toBeNull();
    }
  });

  it('DST 전환일에도 날짜가 뒤로 밀리지 않는다', () => {
    // 정오 UTC 기준으로 계산하는 이유. 자정 기준이면 이 날짜들에서 하루가 샌다.
    expect(resolveHorizon('+1d', '2026-03-08')).toBe('2026-03-09');
    expect(resolveHorizon('+1d', '2026-11-01')).toBe('2026-11-02');
  });
});
