import { describe, expect, it } from 'vitest';
import {
  contractStatus,
  contractPhase,
  isUserOwnedPredicate,
  intervalFromExistingContract,
} from '../decision-contract';
import type { DecisionContract, Predicate } from '@/stores/types';

/**
 * 척추 파일의 뮤테이션 생존자들 (2026-07-29).
 *
 * `node scripts/mutation-probe.mjs src/lib/decision-contract.ts …` 의 kill rate가
 * **16%** 였다 — 45건 중 38건이 망가뜨려도 초록이었다. 측정한 파일 중 가장 낮고,
 * 하필 제품의 척추다. 살아남은 것들 중 사용자에게 직접 닿는 셋을 여기서 막는다.
 *
 * 1) `isUserOwnedPredicate` 의 authority 분기 — **누가 이 판단을 썼는가**.
 *    `user_asserted`/`user_adopted` 를 true→false 로 뒤집어도, `ai_suggested`/
 *    `unconfirmed` 를 false→true 로 뒤집어도 아무 테스트가 빨개지지 않았다.
 *    뒤집히면 AI가 초안한 문장이 "사용자가 소유한 판단"으로 계산되고, 그게 곧
 *    귀환 루프를 닫을 자격이 된다 (CLAUDE.md 규칙 1: 저작자를 속이지 않는다).
 *
 * 2) `contractStatus` 의 witness 분기 `allGraded: true` — 이 값이 `contractPhase`
 *    의 sealed/settled 판정을 가른다. false 로 뒤집혀도 초록이었다.
 *
 * 3) 확인일 산수 (`!checkInAt`, `diff <= 0`) — 부등호가 뒤집히면 확인일 문구가
 *    반대로 나온다. premises-core 에서 똑같은 부류를 이미 한 번 맞았다.
 */

const base = (over: Partial<DecisionContract> = {}): DecisionContract => ({
  id: 'c1',
  project_id: 'p1',
  created_at: '2026-07-01T00:00:00.000Z',
  predicates: [],
  ...over,
} as DecisionContract);

const pred = (over: Partial<Predicate> = {}): Predicate => ({
  id: 'x',
  text: '경쟁사가 먼저 낸다',
  source: 'risk',
  ...over,
} as Predicate);

describe('저작자 분기 — AI 초안이 사용자 판단으로 계산되지 않는다', () => {
  it('attribution.authority 가 사용자 쪽이면 사용자 소유다', () => {
    expect(isUserOwnedPredicate(pred({ attribution: { authority: 'user_asserted' } as never }))).toBe(true);
    expect(isUserOwnedPredicate(pred({ attribution: { authority: 'user_adopted' } as never }))).toBe(true);
  });

  it('attribution.authority 가 AI 쪽이면 사용자 소유가 아니다 — authored 가 뭐라 하든', () => {
    // authority 가 더 강한 신호다. authored:'user' 가 붙어 있어도 AI 권위를 덮지 못한다.
    expect(isUserOwnedPredicate(pred({ attribution: { authority: 'ai_suggested' } as never, authored: 'user' }))).toBe(false);
    expect(isUserOwnedPredicate(pred({ attribution: { authority: 'unconfirmed' } as never, authored: 'user' }))).toBe(false);
  });

  it('attribution 이 없으면 authored 로 떨어진다', () => {
    expect(isUserOwnedPredicate(pred({ authored: 'user' }))).toBe(true);
    expect(isUserOwnedPredicate(pred({ authored: 'ai_surfaced' }))).toBe(false);
  });

  it('둘 다 없는 legacy 는 user_lean 만 사용자 소유다', () => {
    expect(isUserOwnedPredicate(pred({ source: 'user_lean' }))).toBe(true);
    expect(isUserOwnedPredicate(pred({ source: 'risk' }))).toBe(false);
  });
});

describe('witness 계약 — 돌아올 것이 없다는 뜻이지, 미완이라는 뜻이 아니다', () => {
  const witness = base({ kind: 'witness', predicates: [pred({ source: 'user_lean' })] } as never);

  it('allGraded 는 true 다 (돌아올 항목이 애초에 없다)', () => {
    const s = contractStatus(witness, Date.parse('2026-07-29T00:00:00.000Z'));
    expect(s.allGraded).toBe(true);
    expect(s.total).toBe(0);
    expect(s.checkInDue).toBe(false);
    expect(s.daysUntilCheckIn).toBeNull();
  });

  it('그래서 phase 가 sealed 에 머무르지 않는다', () => {
    // allGraded 가 false 로 뒤집히면 witness 가 영원히 "아직 안 끝난 봉인"이 된다.
    expect(contractPhase(witness, Date.parse('2026-07-29T00:00:00.000Z'))).not.toBe('sealed');
  });
});

describe('확인일 → 간격 되읽기 — 경계 양쪽', () => {
  const inDays = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString();

  it('확인일이 없으면 간격을 지어내지 않는다', () => {
    expect(intervalFromExistingContract(undefined)).toBeNull();
    expect(intervalFromExistingContract(null)).toBeNull();
    expect(intervalFromExistingContract('')).toBeNull();
  });

  it('이미 지난 확인일은 null (지난 날짜를 미래 간격처럼 되읽지 않는다)', () => {
    expect(intervalFromExistingContract(inDays(-3))).toBeNull();
  });

  it('미래의 확인일은 가장 가까운 간격으로 되읽는다', () => {
    // 2026-07-08 실주행 회귀: 1일로 묶었는데 카드가 1주를 제안했다.
    expect(intervalFromExistingContract(inDays(1))).toBe('1d');
    expect(intervalFromExistingContract(inDays(7))).toBe('1w');
  });

  it('망가진 날짜 문자열은 조용히 null (간격을 지어내지 않는다)', () => {
    expect(intervalFromExistingContract('내일쯤')).toBeNull();
  });
});
