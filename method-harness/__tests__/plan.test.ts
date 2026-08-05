// 실행 계획 — 결정과 현실 사이의 다리.
//
// 여기서 지켜야 할 것은 하나로 요약된다: **계획은 사용자의 결정을 옮기는
// 구조이지, 결정을 대신하는 것이 아니다.** 그 경계가 깨지는 모든 경로를
// 빨간 케이스로 먼저 세운다.

import { describe, expect, it, beforeEach } from 'vitest';
import { SessionEngine } from '../surfaces/engine';
import { resetEventIds } from '../ledger';
import {
  MAX_RETURNS_PER_PLAN,
  planReturnSummary,
  returnsFromPlan,
  validatePlan,
} from '../plan';
import { HarnessViolation, type DecisionCardDraft, type ExecutionPlan } from '../types';

const T0 = '2026-08-05T09:00:00.000Z';
const T = (min: number) => new Date(new Date(T0).getTime() + min * 60_000).toISOString();
const days = (n: number) => T(n * 24 * 60);

const CARD: DecisionCardDraft = {
  question: '온보딩을 20명에게 제한 공개할까',
  stakes: { weight: 'significant', reversibility: 'costly' },
  adoptedState: 'test',
  choiceOrPolicy: '핵심 흐름만 20명에게 2주간 공개',
  rationale: { values: ['빠른 현실 신호'], materialBeliefs: [{ belief: '20명이 대표한다', confidence: 'uncertain' }] },
};

const plan = (over: Partial<ExecutionPlan> = {}): ExecutionPlan => ({
  horizonDays: 21,
  openQuestions: [],
  steps: [
    { what: '대상 20명 명단 확정', kind: 'prepare', byOrWhen: '내일까지', dueDate: days(1) },
    { what: '결제 단계 이탈 원인 조사', kind: 'investigate', byOrWhen: '이번 주 안에', dueDate: days(5) },
    { what: '제한 공개 시작', kind: 'execute', byOrWhen: '다음 주 월요일', dueDate: days(7) },
  ],
  ...over,
});

function engineWithCard(): SessionEngine {
  resetEventIds();
  const e = new SessionEngine('c1');
  e.recordUtterance('온보딩 출시 고민이야', T(0));
  e.recordBaseline({ lean: '빨리 열고 싶음', statedReasons: [], consideredAlternatives: [] }, T(1));
  e.adoptCard(CARD, { mode: 'accept' }, T(2));
  return e;
}

describe('계획의 경계 — 결정을 대신하지 않는다', () => {
  beforeEach(() => resetEventIds());

  it('채택된 결정이 없으면 계획을 붙일 수 없다 (process 추천은 결정 이후의 것)', () => {
    resetEventIds();
    const e = new SessionEngine('c9');
    e.recordUtterance('뭘 할지 고민이야', T(0));
    e.recordBaseline(undefined, T(1));
    expect(() => e.adoptPlan(plan(), T(2))).toThrowError(/PLAN_WITHOUT_ADOPTED_CARD/);
  });

  it('멈추기로 한 결정에는 계획을 붙이지 않는다', () => {
    resetEventIds();
    const e = new SessionEngine('c_stop');
    e.recordUtterance('이 건은 접기로 했어', T(0));
    e.recordBaseline(undefined, T(1));
    e.adoptCard({ ...CARD, adoptedState: 'stop', returnContract: undefined }, { mode: 'accept' }, T(2));
    expect(e.state().state).toBe('STOPPED');
    expect(() => e.adoptPlan(plan(), T(3))).toThrowError(/PLAN_ON_STOPPED_CASE/);
  });

  it('제안만으로는 계획이 정본이 되지 않는다 — 채택이 사용자 행위다', () => {
    const e = engineWithCard();
    e.proposePlan(plan(), T(3));
    expect(e.state().plan).toBeUndefined();
    e.adoptPlan(plan(), T(4));
    expect(e.state().plan?.steps).toHaveLength(3);
  });

  it('형태를 갖추지 못한 계획은 조용히 저장되지 않고 크게 실패한다', () => {
    const e = engineWithCard();
    expect(() => e.adoptPlan(plan({ steps: [] }), T(3))).toThrowError(HarnessViolation);
    expect(() =>
      e.adoptPlan(plan({ steps: [{ what: '', kind: 'execute', byOrWhen: '내일' }] }), T(3)),
    ).toThrowError(/PLAN_INVALID/);
  });
});

describe('마일스톤 → 귀환 계약 (이 기능의 존재 이유)', () => {
  beforeEach(() => resetEventIds());

  it('계획을 채택하면 사용자가 따로 승낙하지 않아도 돌아보기가 예약된다', () => {
    const e = engineWithCard();
    expect(e.state().activeReturn).toBeUndefined();

    const r = e.adoptPlan(plan(), T(3));

    expect(r.returnsArmed).toBe(3);
    expect(e.state().activeReturn).toBeTruthy();
    expect(e.state().state).toBe('AWAITING_SIGNAL');
    expect(e.state().queuedReturns).toHaveLength(2); // 나머지는 연쇄 대기
  });

  it('첫 귀환은 행동 확인(commitment), 나머지는 결과 확인(outcome)', () => {
    const rs = returnsFromPlan(plan());
    expect(rs[0].contract.kind).toBe('commitment');
    expect(rs.slice(1).every((r) => r.contract.kind === 'outcome')).toBe(true);
  });

  it('가장 이른 기한부터 잡는다 — 곧 닥칠 약속이 정산 가치가 높다', () => {
    const unordered = plan({
      steps: [
        { what: '나중 것', kind: 'execute', byOrWhen: '한 달 뒤', dueDate: days(30) },
        { what: '먼저 것', kind: 'prepare', byOrWhen: '내일', dueDate: days(1) },
      ],
    });
    expect(returnsFromPlan(unordered)[0].fromStep).toBe('먼저 것');
  });

  it('기한 없는 단계는 귀환이 되지 않는다 — 모든 단계에 날짜를 강제하면 관료제다', () => {
    const noDates = plan({
      steps: [{ what: '틈날 때 정리', kind: 'prepare', byOrWhen: '언젠가' }],
    });
    expect(returnsFromPlan(noDates)).toHaveLength(0);
    expect(planReturnSummary(noDates)).toMatch(/예약되지 않았습니다/);
  });

  it('상한을 넘으면 잘라내되, 잘랐다는 사실을 말한다 (no-silent-caps)', () => {
    const many = plan({
      steps: Array.from({ length: 8 }, (_, i) => ({
        what: `단계 ${i}`,
        kind: 'execute' as const,
        byOrWhen: `${i}일`,
        dueDate: days(i + 1),
      })),
    });
    expect(returnsFromPlan(many)).toHaveLength(MAX_RETURNS_PER_PLAN);
    const summary = planReturnSummary(many);
    expect(summary).toMatch(/8개/); // 몇 개가 있었는지
    expect(summary).toMatch(new RegExp(`${MAX_RETURNS_PER_PLAN}개만`)); // 몇 개만 잡았는지
  });

  it('예약된 귀환이 전역 예산(3건)을 혼자 다 먹지 않는다', () => {
    expect(MAX_RETURNS_PER_PLAN).toBeLessThanOrEqual(3);
  });
});

describe('정직한 공백 — 모르는 것은 지어내지 않는다', () => {
  it('계획이 답할 수 없는 것을 openQuestions로 남길 수 있다', () => {
    const p = plan({ openQuestions: ['결제 실패율 데이터를 아직 못 봄 — 확인 필요'] });
    expect(validatePlan(p).ok).toBe(true);
    expect(p.openQuestions[0]).toMatch(/확인 필요/);
  });

  it('단계가 하나도 없으면 "계획 없음"으로 조용히 넘어가지 않고 문제로 보고된다', () => {
    const v = validatePlan(plan({ steps: [] }));
    expect(v.ok).toBe(false);
    expect(v.problems[0]).toMatch(/openQuestions/);
  });
});

describe('계획 이후에도 귀환 절차는 그대로다 (§7.3)', () => {
  it('관찰 → 기억 → 기록 공개 순서가 계획 경로에서도 유지된다', () => {
    const e = engineWithCard();
    e.adoptPlan(plan(), T(3));

    // 첫 귀환(행동 확인)
    e.recordObservation('명단 20명 확정함', 'direct', days(1), days(1));
    e.recordRecallProbeAnswer('빨리 반응을 보고 싶어서였어요', days(1));
    const revealed = e.revealRecord(days(1));
    expect(revealed.recallProbeAnswer).toBeTruthy();
    expect(revealed.plan?.steps[0].what).toBe('대상 20명 명단 확정');

    e.closeReturn(days(1));
    expect(e.state().activeReturn?.contract.kind).toBe('outcome'); // 다음 귀환 승격
  });
});
