// Validator tests — every row of v1.0 §10.7's failure table that belongs to
// the validator gets a red case FIRST (harness blueprint §5 litmus).
//
// Zero-tolerance mapping (v1.0 §15.4 → §10.6):
//   AI 문장의 사용자 원문 표시            → illegal_claim_pair (check 6)
//   말하지 않은 가치의 사용자 소유 저장     → valueClaimRefs lineage (check 5)
//   출처 없는 내용의 사실 승격             → illegal_claim_pair (check 6)
//   사용자가 답하지 않았는데 대신 승인       → reducer CANONICAL_WRITE_WITHOUT_ADOPTION
//   과거 record의 조용한 overwrite         → reducer OVERWRITE_FORBIDDEN
//   최신 결과의 과거 혼입                  → reducer REVEAL/observed ordering
//   여러 AI 합의의 독립 증거 표시           → HUMAN AUDIT (not mechanically checkable — declared, not hidden)
//   한쪽 설명으로 타인 동기 판정            → HUMAN AUDIT (R1 evaluator handbook)

import { describe, expect, it } from 'vitest';
import { Ledger, resetEventIds } from '../ledger';
import { validateTurn, type ValidationContext } from '../validator';
import { type ArgusTurn } from '../types';

function baseTurn(overrides: Partial<ArgusTurn> = {}): ArgusTurn {
  return {
    phase: 'improve',
    route: 'decision',
    caseFit: 'in_scope',
    primaryMove: { type: 'alternative_generation', content: '제3의 경로 제안', whyNow: '대안이 두 개뿐' },
    claims: [],
    ...overrides,
  };
}

function ctxWith(utterances: string[], stakes?: ValidationContext['stakes']): ValidationContext {
  resetEventIds();
  const ledger = new Ledger();
  utterances.forEach((text, i) =>
    ledger.append({ id: `u${i}`, caseId: 'case1', at: `2026-08-04T00:0${i}:00.000Z`, type: 'user_utterance', text }),
  );
  return { ledger, caseId: 'case1', stakes };
}

describe('check 1 — move type enum', () => {
  it('rejects a move type outside the §4.3 library', () => {
    const turn = baseTurn();
    (turn.primaryMove as { type: string }).type = 'vibe_check';
    const r = validateTurn(turn, ctxWith(['고민이야']));
    expect(r.ok).toBe(false);
    expect(r.rejections[0].code).toBe('unknown_move_type');
  });
});

describe('check 2 — reframe needs a falsifier (§4.6)', () => {
  it('demotes a falsifier-less reframe to a question, loudly', () => {
    const turn = baseTurn({ primaryMove: { type: 'reframe', content: '진짜 결정은 X입니다', whyNow: 'frame 병목' } });
    const r = validateTurn(turn, ctxWith(['출시를 미룰까 고민이야']));
    expect(r.ok).toBe(true);
    expect(r.downgrades.map((d) => d.code)).toContain('reframe_without_falsifier_to_question');
    expect(r.turn.primaryMove.type).not.toBe('reframe');
    expect(r.turn.question).toBeDefined();
  });

  it('passes a reframe that states what would make it wrong', () => {
    const turn = baseTurn({
      primaryMove: { type: 'reframe', content: '진짜 결정은 검증 목표 선택입니다', whyNow: 'frame 병목', falsifier: '이번 공개가 매출 목적이라면 이 재구성은 틀렸다' },
    });
    const r = validateTurn(turn, ctxWith(['출시를 미룰까 고민이야']));
    expect(r.ok).toBe(true);
    expect(r.downgrades).toHaveLength(0);
    expect(r.turn.primaryMove.type).toBe('reframe');
  });
});

describe('check 3 — decision-shaping questions need two real branches (§4.2)', () => {
  it('rejects a question whose answers all lead to the same next move', () => {
    const turn = baseTurn({
      question: {
        text: '이번 출시에서 무엇을 배우고 싶으세요?',
        materialEffect: '범위 결정',
        branches: [
          { responseShape: '활성화', expectedNextMove: 'experiment_design' },
          { responseShape: '재방문', expectedNextMove: 'experiment_design' },
        ],
      },
    });
    const r = validateTurn(turn, ctxWith(['고민이야']));
    expect(r.ok).toBe(false);
    expect(r.rejections[0].code).toBe('question_without_branches');
  });

  it('passes a question with genuinely branching answers', () => {
    const turn = baseTurn({
      question: {
        text: '활성화 완료인가요, 다음 날 재방문인가요?',
        materialEffect: '릴리즈 범위가 달라진다',
        branches: [
          { responseShape: '활성화', expectedNextMove: '핵심 활성화 흐름만 공개' },
          { responseShape: '재방문', expectedNextMove: '재방문 유발 흐름 중심 공개' },
        ],
      },
    });
    expect(validateTurn(turn, ctxWith(['고민이야'])).ok).toBe(true);
  });
});

describe('check 6 (turn side) — claim (source, authority) pairs', () => {
  it('rejects ai_proposed text dressed as user_said — the canonical laundering pair', () => {
    const turn = baseTurn({ claims: [{ text: '나는 속도가 제일 중요해', source: 'ai', authority: 'said' }] });
    const r = validateTurn(turn, ctxWith(['고민이야']));
    expect(r.ok).toBe(false);
    expect(r.rejections[0].code).toBe('illegal_claim_pair');
  });

  it('rejects ai inference promoted to external observation', () => {
    const turn = baseTurn({ claims: [{ text: '시장은 B2B를 원한다', source: 'ai', authority: 'observed' }] });
    expect(validateTurn(turn, ctxWith(['고민이야'])).ok).toBe(false);
  });
});

describe('check 5 — directional recommendation grounding (§4.4)', () => {
  const recommendation = (refs: string[]): NonNullable<ArgusTurn['recommendation']> => ({
    readiness: 'ready',
    kind: 'directional',
    initiative: 'pulled',
    proposal: '제한 베타를 권합니다',
    rationale: '빨리 반응을 보고 싶다는 기준 아래',
    valueClaimRefs: refs,
    changeCondition: '대상이 핵심 segment가 아니면 바뀜',
  });

  it('demotes a directional rec whose value refs do not exist in the ledger', () => {
    const ctx = ctxWith(['추천해줘. 빨리 반응을 보고 싶어'], { weight: 'significant', reversibility: 'costly' });
    const turn = baseTurn({ recommendation: recommendation(['ghost_ref']) });
    const r = validateTurn(turn, ctx);
    expect(r.turn.recommendation?.kind).toBe('process');
    expect(r.downgrades.map((d) => d.code)).toContain('directional_ungrounded_to_process');
  });

  it('demotes when the quoted value is not in what the user actually said (lineage, not entailment)', () => {
    const ctx = ctxWith(['추천해줘'], { weight: 'significant', reversibility: 'costly' });
    const turn = baseTurn({
      claims: [{ text: '완성도가 제일 중요하다', source: 'user', authority: 'said', citation: 'u0' }],
      recommendation: recommendation(['u0']),
    });
    const r = validateTurn(turn, ctx);
    expect(r.turn.recommendation?.kind).toBe('process');
  });

  it('passes when the value claim traces to a real user utterance', () => {
    const ctx = ctxWith(['추천해줘. 나는 빨리 반응을 보고 싶어'], { weight: 'significant', reversibility: 'costly' });
    const turn = baseTurn({
      claims: [{ text: '빨리 반응을 보고 싶어', source: 'user', authority: 'said', citation: 'u0' }],
      recommendation: recommendation(['u0']),
    });
    const r = validateTurn(turn, ctx);
    expect(r.ok).toBe(true);
    expect(r.turn.recommendation?.kind).toBe('directional');
  });
});

describe('check 10 — stakes × initiative hierarchy (§4.4)', () => {
  it('demotes a PUSHED directional recommendation at major/one-way stakes', () => {
    const ctx = ctxWith(['B2B 피벗을 고민 중이야. 나는 B2C가 만들고 싶던 거야'], { weight: 'major', reversibility: 'one_way' });
    const turn = baseTurn({
      claims: [{ text: 'B2C가 만들고 싶던 거야', source: 'user', authority: 'said', citation: 'u0' }],
      recommendation: {
        readiness: 'ready',
        kind: 'directional',
        initiative: 'pushed',
        proposal: 'B2C를 유지하세요',
        rationale: '창업 동기 보존',
        valueClaimRefs: ['u0'],
        changeCondition: '런웨이 6개월 미만이면 바뀜',
      },
    });
    const r = validateTurn(turn, ctx);
    expect(r.turn.recommendation?.kind).toBe('contingent');
    expect(r.downgrades.map((d) => d.code)).toContain('directional_pushed_at_major_one_way');
  });

  it('allows a PULLED directional at major/one-way (bounded critic is the remaining gate)', () => {
    const ctx = ctxWith(['어느 쪽을 추천해? 나는 B2C가 만들고 싶던 거야'], { weight: 'major', reversibility: 'one_way' });
    const turn = baseTurn({
      claims: [{ text: 'B2C가 만들고 싶던 거야', source: 'user', authority: 'said', citation: 'u0' }],
      recommendation: {
        readiness: 'ready',
        kind: 'directional',
        initiative: 'pulled',
        proposal: 'B2C 유지 후 수익 실험',
        rationale: '창업 동기 보존',
        valueClaimRefs: ['u0'],
        changeCondition: '런웨이 6개월 미만이면 바뀜',
      },
    });
    const r = validateTurn(turn, ctx);
    expect(r.turn.recommendation?.kind).toBe('directional');
  });

  it('fails CLOSED when stakes are unknown: pushed directional is demoted', () => {
    const ctx = ctxWith(['고민이야. 속도가 중요해']); // no stakes provided
    const turn = baseTurn({
      claims: [{ text: '속도가 중요해', source: 'user', authority: 'said', citation: 'u0' }],
      recommendation: {
        readiness: 'ready',
        kind: 'directional',
        initiative: 'pushed',
        proposal: 'A로 가세요',
        rationale: '속도 우선',
        valueClaimRefs: ['u0'],
        changeCondition: 'X면 바뀜',
      },
    });
    expect(validateTurn(turn, ctx).turn.recommendation?.kind).not.toBe('directional');
  });

  it('catches a model lying about initiative — the ledger is the authority', () => {
    const ctx = ctxWith(['B2B 피벗 고민이야'], { weight: 'major', reversibility: 'one_way' }); // no pull utterance
    const turn = baseTurn({
      recommendation: {
        readiness: 'ready',
        kind: 'directional',
        initiative: 'pulled', // lie
        proposal: 'B2B로 가세요',
        rationale: '시장',
        valueClaimRefs: [],
        changeCondition: 'X',
      },
    });
    const r = validateTurn(turn, ctx);
    expect(r.ok).toBe(false);
    expect(r.rejections.map((x) => x.code)).toContain('initiative_mismatch_with_ledger');
  });
});

describe('check 11 — no recommendations on the safety route', () => {
  it('rejects any recommendation when caseFit is safety_route', () => {
    const ctx = ctxWith(['추천해줘'], { weight: 'minor', reversibility: 'reversible' });
    const turn = baseTurn({
      caseFit: 'safety_route',
      recommendation: {
        readiness: 'ready',
        kind: 'process',
        initiative: 'pulled',
        proposal: '전문가와 이야기하세요',
        rationale: '…',
        valueClaimRefs: [],
        changeCondition: '…',
      },
    });
    const r = validateTurn(turn, ctx);
    expect(r.rejections.map((x) => x.code)).toContain('recommendation_on_safety_route');
  });
});

describe('check 12 — event/signal triggers need a date backstop (§7.1)', () => {
  it('rejects a signal-trigger return contract without a backstop', () => {
    const turn = baseTurn({
      returnContractCandidate: {
        kind: 'outcome',
        trigger: { type: 'signal', expectedSignal: '재방문 수', dateBackstop: '' },
      },
    });
    const r = validateTurn(turn, ctxWith(['고민이야']));
    expect(r.rejections.map((x) => x.code)).toContain('trigger_missing_date_backstop');
  });
});
