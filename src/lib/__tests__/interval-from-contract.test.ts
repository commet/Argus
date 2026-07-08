/**
 * 묶기 확인일 → 완료 봉인 카드 승계 (실주행 재실사 2026-07-08에서 발견).
 *
 * BindCard에서 '1일'로 묶은 사용자의 완료 화면이 조용히 '1주' 디폴트를
 * 제안했다 — 사용자의 선택을 기계 디폴트가 덮어쓰는 배선 절단. 이 테스트는
 * 기존 계약의 check_in_at이 가장 가까운 interval 칩으로 승계되는 것을 고정한다.
 */

import { describe, expect, it } from 'vitest';
import { intervalFromExistingContract } from '../decision-contract';

const DAY = 86_400_000;

describe('intervalFromExistingContract — 묶기 확인일 승계', () => {
  it('내일로 묶었으면 1d에서 시작한다 (1주 디폴트로 되돌리지 않는다)', () => {
    expect(intervalFromExistingContract(new Date(Date.now() + 1 * DAY).toISOString())).toBe('1d');
  });

  it('사흘 뒤는 3d, 열흘 뒤는 1w보다 2w에 가까우면 2w', () => {
    expect(intervalFromExistingContract(new Date(Date.now() + 3 * DAY).toISOString())).toBe('3d');
    expect(intervalFromExistingContract(new Date(Date.now() + 12 * DAY).toISOString())).toBe('2w');
  });

  it('계약이 없거나 이미 지난 날짜면 null (호출부 디폴트)', () => {
    expect(intervalFromExistingContract(undefined)).toBeNull();
    expect(intervalFromExistingContract(new Date(Date.now() - DAY).toISOString())).toBeNull();
    expect(intervalFromExistingContract('not-a-date')).toBeNull();
  });
});
