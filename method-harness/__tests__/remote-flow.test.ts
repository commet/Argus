// 원격 MCP 도구 순서의 통합 검증 — 하네스 층에서.
//
// 실제 서버 경로(Supabase)는 이 환경에서 돌릴 수 없지만, **원격에서 깨질 수
// 있는 것은 저장이 아니라 순서**다: 모델이 도구를 마음대로 부를 수 있기
// 때문이다. 채택 전에 계획을 부르면? 관찰 없이 기록을 열면? 기울기를 지어내면?
//
// 그 방어가 하네스에 있는지를 여기서 확인한다. handlers.ts는 이 하네스를 그대로
// 부르므로, 여기서 참이면 원격에서도 참이다.

import { describe, expect, it, beforeEach } from 'vitest';
import { SessionEngine } from '../surfaces/engine';
import { fireGate } from '../surfaces/mcp';
import { Ledger, resetEventIds } from '../ledger';
import { HarnessViolation, type ExecutionPlan } from '../types';

const T0 = '2026-08-05T09:00:00.000Z';
const T = (min: number) => new Date(new Date(T0).getTime() + min * 60_000).toISOString();
const days = (n: number) => T(n * 24 * 60);

const PLAN: ExecutionPlan = {
  horizonDays: 21,
  openQuestions: ['결제 실패율 데이터 미확인 — 확인 필요'],
  steps: [
    { what: '명단 20명 확정', kind: 'prepare', byOrWhen: '내일까지', dueDate: days(1) },
    { what: '제한 공개 시작', kind: 'execute', byOrWhen: '다음 주', dueDate: days(7) },
  ],
};

describe('원격 도구 순서 — 모델이 순서를 어길 때', () => {
  beforeEach(() => resetEventIds());

  it('평평한 상황에서는 결정을 열지 않는다 (argus_open의 fire-gate)', () => {
    const l = new Ledger();
    const flat = fireGate(l, { hostUtterance: '뉴스레터 요일 바꿀까 하는데 딱히 상관없어', userInvokedArgus: false });
    expect(flat.fire).toBe(false);
    expect(flat.reason).toBe('flat_context');
  });

  it('이미 끝난 결정도 열지 않는다', () => {
    const l = new Ledger();
    expect(fireGate(l, { hostUtterance: '어제 사인했어. 이미 끝난 일이야.', userInvokedArgus: false })).toEqual({
      fire: false,
      reason: 'closed_decision',
    });
  });

  it('채택 전에 계획을 부르면 크게 실패한다 — 결정이 아직 사용자 것이 아니다', () => {
    const e = new SessionEngine('r1');
    e.recordUtterance('온보딩 출시 고민이야', T(0));
    e.recordBaseline(undefined, T(1));
    expect(() => e.adoptPlan(PLAN, T(2))).toThrowError(HarnessViolation);
    expect(() => e.adoptPlan(PLAN, T(2))).toThrowError(/PLAN_WITHOUT_ADOPTED_CARD/);
  });

  it('관찰 없이 기록을 열면 크게 실패한다 (§7.3 — 기억 오염 방지)', () => {
    const e = fullyAdopted();
    expect(() => e.revealRecord(days(1))).toThrowError(HarnessViolation);
  });

  it('기록을 연 뒤의 기억은 받지 않는다 — 이미 오염됐기 때문', () => {
    const e = fullyAdopted();
    e.recordObservation('12명 완주, 3명 이탈', 'direct', days(1), days(1));
    e.revealRecord(days(1));
    expect(() => e.recordRecallProbeAnswer('빨리 보고 싶었어요', days(1))).toThrowError(/PROBE_AFTER_REVEAL/);
  });
});

// 3주차에서 발견된 결함의 회귀 그물. 로컬 파일럿에서는 무해했다 — 엔진을
// 버리면 그만이니까. 서버 원장은 append-only 라 지울 수 없으므로, 위반
// 이벤트가 한 번 들어가면 그 케이스의 이후 모든 읽기가 영구히 실패한다.
describe('append-only 안전 — 위반 이벤트는 원장에 들어가지 않는다', () => {
  beforeEach(() => resetEventIds());

  const opened = () => {
    const e = new SessionEngine('p1');
    e.recordUtterance('고민이야', T(0));
    e.recordBaseline(undefined, T(1));
    return e;
  };

  it('관찰 없는 공개는 던지고, 원장에 흔적을 남기지 않는다', () => {
    const e = opened();
    const before = e.ledger.forCase('p1').length;
    expect(() => e.revealRecord(T(2))).toThrowError(/REVEAL_BEFORE_OBSERVATION/);
    expect(e.ledger.forCase('p1')).toHaveLength(before); // 넣기 전에 막았다
    expect(() => e.state()).not.toThrow(); // 케이스가 살아 있다
  });

  it('공개 뒤의 기억도 원장에 들어가지 않는다', () => {
    const e = fullyAdopted();
    e.recordObservation('12명 완주', 'direct', days(1), days(1));
    e.revealRecord(days(1));
    const before = e.ledger.forCase('r2').length;
    expect(() => e.recordRecallProbeAnswer('나중 기억', days(1))).toThrowError(/PROBE_AFTER_REVEAL/);
    expect(e.ledger.forCase('r2')).toHaveLength(before);
    expect(() => e.state()).not.toThrow();
  });

  it('기준선 전의 AI 제안도 원장에 들어가지 않는다', () => {
    resetEventIds();
    const e = new SessionEngine('p2');
    e.recordUtterance('고민이야', T(0)); // 기준선 없음
    const before = e.ledger.forCase('p2').length;
    expect(() =>
      e.receiveTurn(
        { phase: 'improve', route: 'decision', caseFit: 'in_scope', primaryMove: { type: 'mirror', content: 'x', whyNow: 'y' }, claims: [] },
        T(1),
      ),
    ).toThrowError(/PROPOSAL_BEFORE_BASELINE/);
    expect(e.ledger.forCase('p2')).toHaveLength(before);
    expect(() => e.state()).not.toThrow();
  });
});

describe('원격에서도 계획이 귀환을 만든다 (크론이 읽을 것)', () => {
  beforeEach(() => resetEventIds());

  it('계획 채택이 곧 돌아보기 예약이다 — 사용자의 추가 승낙 없이', () => {
    const e = fullyAdopted();
    const state = e.state();
    expect(state.activeReturn).toBeTruthy();
    expect(state.plan?.steps).toHaveLength(2);
    // 첫 귀환은 행동 확인, 두 번째는 결과 확인
    expect(state.activeReturn?.contract.kind).toBe('commitment');
    expect(state.queuedReturns[0]?.kind).toBe('outcome');
  });

  it('계획이 모르는 것을 지어내지 않고 남긴다', () => {
    const e = fullyAdopted();
    expect(e.state().plan?.openQuestions[0]).toMatch(/확인 필요/);
  });
});

describe('원격 전 구간 완주 — 결정에서 정산까지', () => {
  it('열기 → 채택 → 계획 → 관찰 → 기억 → 대조 → 닫기', () => {
    const e = fullyAdopted();

    e.recordObservation('20명 중 12명 완주, 결제에서 3명 이탈', 'direct', days(1), days(1));
    e.recordRecallProbeAnswer('빨리 반응을 보고 싶어서 그냥 열었던 것 같아', days(1));
    const revealed = e.revealRecord(days(1));

    // 대조에 필요한 세 가지가 전부 살아 있다
    expect(revealed.card?.choiceOrPolicy).toBeTruthy();
    expect(revealed.recallProbeAnswer).toBeTruthy();
    expect(revealed.observations).toHaveLength(1);
    // 기울기가 그대로 보존됐다 — AI가 덮어쓰지 않았다
    expect(revealed.baseline).not.toBe('not_captured');

    e.closeReturn(days(1));
    expect(e.state().activeReturn?.contract.kind).toBe('outcome'); // 다음 약속으로 승격
  });
});

function fullyAdopted(): SessionEngine {
  resetEventIds();
  const e = new SessionEngine('r2');
  e.recordUtterance('온보딩을 20명에게 먼저 열지 고민이야. 빨리 반응을 보고 싶어.', T(0));
  e.recordBaseline({ lean: '빨리 열고 싶음', statedReasons: ['반응을 빨리 보고 싶다'], consideredAlternatives: [] }, T(1));
  e.adoptCard(
    {
      question: '온보딩을 20명에게 먼저 열까',
      stakes: { weight: 'significant', reversibility: 'costly' },
      adoptedState: 'test',
      choiceOrPolicy: '핵심 흐름만 20명에게 2주간 공개',
      rationale: { values: ['빠른 현실 신호'], materialBeliefs: [] },
    },
    { mode: 'accept' },
    T(2),
  );
  e.adoptPlan(PLAN, T(3));
  return e;
}
