// method-pilot 복원 가드 — 새로고침이 데이터를 오염시키지 않는다.
//
// 이 페이지는 localStorage-first 라 어느 화면에서 새로고침해도 멀쩡해 **보인다**
// (Persistence 원칙이 경고하는 바로 그 형태). 복원 지점이 틀리면 사용자가 같은
// 입력을 다시 하게 되고, 그 재입력은 append-only 원장에 중복으로 영구히 남는다.
// 2026-08-09 라운드 4 감사에서 발견: 관찰 기록 후 새로고침이 acting 으로
// 복원돼 관찰을 다시 받았다.

import { describe, expect, it } from 'vitest';
import { SessionEngine } from '../../../../method-harness/surfaces/engine';
import { Ledger } from '../../../../method-harness/ledger';
import type { DecisionCardDraft } from '../../../../method-harness/types';
import { FIRST_CASE_ID, activeCaseId, deriveStep } from '../derive';

const T = (i: number) => new Date(Date.UTC(2026, 7, 9, 10, i)).toISOString();

const CARD: DecisionCardDraft = {
  question: '가격을 올릴까?',
  stakes: { weight: 'significant', reversibility: 'costly' },
  adoptedState: 'test',
  choiceOrPolicy: '10% 인상 후 2주 관찰',
  rationale: { values: ['학습 속도'], materialBeliefs: [] },
};

function engineWith(caseId = FIRST_CASE_ID): SessionEngine {
  const e = new SessionEngine(caseId, new Ledger());
  e.recordUtterance('가격을 올릴지 고민이야', T(0));
  e.recordBaseline({ lean: '올리는 쪽', statedReasons: [], consideredAlternatives: [] }, T(1));
  return e;
}

const eventsOf = (e: SessionEngine) => e.ledger.forCase(e.caseId);

describe('deriveStep — 새로고침 복원 지점', () => {
  it('관찰이 이미 원장에 있으면 회상 단계로 복원한다 (관찰 재입력 = 원장 중복)', () => {
    const e = engineWith();
    e.adoptCard(CARD, { mode: 'accept' }, T(2));
    e.recordObservation('첫 주 이탈 문의 0건', 'direct', T(3), T(3));
    expect(deriveStep(e.state(), eventsOf(e))).toBe('return_probe');
  });

  it('관찰 전에는 acting 으로 복원한다', () => {
    const e = engineWith();
    e.adoptCard(CARD, { mode: 'accept' }, T(2));
    expect(deriveStep(e.state(), eventsOf(e))).toBe('acting');
  });

  it('연쇄 2사이클: 기록 공개 뒤의 관찰만 이번 사이클로 센다', () => {
    const e = engineWith();
    e.adoptCard(
      {
        ...CARD,
        returnContract: {
          kind: 'commitment',
          trigger: { type: 'date', date: T(5) },
          nextInChain: { kind: 'outcome', trigger: { type: 'date', date: T(30) } },
        },
      },
      { mode: 'accept' },
      T(2),
    );
    e.recordObservation('행동 시작함', 'direct', T(3), T(3));
    e.recordRecallProbeAnswer('그때는 이렇게 기억', T(4));
    e.revealRecord(T(5));
    e.closeReturn(T(6));
    // 다음 사이클 관찰 전 — 지난 사이클 관찰이 있어도 acting 이어야 한다.
    expect(deriveStep(e.state(), eventsOf(e))).toBe('acting');
    e.recordObservation('2주 결과 나옴', 'direct', T(7), T(7));
    expect(deriveStep(e.state(), eventsOf(e))).toBe('return_probe');
  });

  it('귀환 계약 없이 정산한 케이스는 대조 화면으로 복원한다 (죽지 않는다)', () => {
    const e = engineWith();
    e.adoptCard(CARD, { mode: 'accept' }, T(2)); // returnContract 없음
    e.recordObservation('결과가 나왔다', 'direct', T(3), T(3));
    e.recordRecallProbeAnswer('이렇게 기억한다', T(4));
    e.revealRecord(T(5));
    expect(deriveStep(e.state(), eventsOf(e))).toBe('return_reveal');
  });
});

describe('activeCaseId — 완주 뒤 다음 결정', () => {
  it('빈 원장이면 첫 케이스, 새 케이스 이벤트가 쌓이면 그 케이스가 활성이다', () => {
    expect(activeCaseId([])).toBe(FIRST_CASE_ID);
    const first = engineWith();
    const all = [...first.ledger.all()];
    expect(activeCaseId(all)).toBe(FIRST_CASE_ID);

    const second = new SessionEngine('pilot_case_2', new Ledger());
    second.recordUtterance('다음 결정', T(10));
    expect(activeCaseId([...all, ...second.ledger.all()])).toBe('pilot_case_2');
  });

  it('두 번째 케이스의 복원은 첫 케이스의 이력에 오염되지 않는다', () => {
    // 첫 케이스 완주 원장 위에 새 케이스를 얹었을 때, 활성 케이스의 이벤트만
    // 넘기면 listen/baseline 부터 다시 시작한다.
    const second = new SessionEngine('pilot_case_2', new Ledger());
    second.recordUtterance('다음 결정', T(10));
    expect(deriveStep(second.state(), eventsOf(second))).toBe('baseline');
  });
});
