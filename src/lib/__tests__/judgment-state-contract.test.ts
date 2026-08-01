import { describe, expect, it } from 'vitest';
import {
  applyPremiseDeltas,
  clampSynthesisToLivingState,
  coercePremiseCandidates,
} from '../judgment-state-contract';

describe('judgment premise state contract', () => {
  it('does not let synthesis invent premises, actions, or unsupported verification sections', () => {
    const result = clampSynthesisToLivingState({
      sections: [
        { heading: '지금까지 확인된 것', content: '사용자가 말한 사실' },
        { heading: '아직 확인되지 않은 것', content: '추가 펀딩 가능성' },
        { heading: '다음 단계', content: '투자자에게 연락하기' },
      ],
      key_assumptions: ['추가 펀딩을 받을 수 있다'],
      next_steps: ['투자자에게 연락하기'],
    }, {
      hidden_assumptions: [],
      skeleton: [],
    });

    expect(result.sections).toEqual([
      { heading: '지금까지 확인된 것', content: '사용자가 말한 사실' },
    ]);
    expect(result.key_assumptions).toEqual([]);
    expect(result.next_steps).toEqual([]);
  });

  it('uses accepted living state instead of the synthesis model lists', () => {
    const result = clampSynthesisToLivingState({
      sections: [{ heading: '전제', content: '내용' }],
      key_assumptions: ['모델이 새로 만든 전제'],
      next_steps: ['모델이 새로 만든 행동', '두 번째로 지어낸 행동'],
    }, {
      hidden_assumptions: ['사용자가 확인한 전제'],
      // One premise carries a counterfactual, so exactly one check may be kept.
      premise_records: [{ text: '사용자가 확인한 전제', if_false_changes: '판단이 달라진다' }],
    });

    expect(result.key_assumptions).toEqual(['사용자가 확인한 전제']);
    expect(result.next_steps).toEqual(['모델이 새로 만든 행동']);
    expect(result.sections).toHaveLength(1);
  });

  it('allows no checks at all when no premise carries a counterfactual', () => {
    const result = clampSynthesisToLivingState({
      sections: [
        { heading: '확인된 것', content: '내용' },
        { heading: '현실에서 확인할 것', content: '지어낸 확인' },
      ],
      key_assumptions: [],
      next_steps: ['지어낸 확인'],
    }, { hidden_assumptions: [], premise_records: [] });

    expect(result.next_steps).toEqual([]);
    expect(result.sections.map((s) => s.heading)).toEqual(['확인된 것']);
  });

  it('accepts only a premise anchored to the user words', () => {
    const result = coercePremiseCandidates([
      {
        text: '8월 15일 전에 배포해야 약속을 지킬 수 있다는 전제',
        anchor_quote: '8월 15일 홍보 약속 때문에 그 전에 배포해야 해요',
        support_kind: 'explicit_reason',
        if_false_changes: '배포 시점과 개선 범위를 다시 비교해야 한다',
      },
      {
        text: '법무팀의 사전 승인이 필요하다는 전제',
        anchor_quote: '법무팀',
        support_kind: 'explicit_condition',
        if_false_changes: '승인 일정을 확인해야 한다',
      },
    ], '8월 15일 홍보 약속 때문에 그 전에 배포해야 해요. 자꾸 개선하면 시간이 지연되네요.');

    expect(result.premises).toEqual(['8월 15일 전에 배포해야 약속을 지킬 수 있다는 전제']);
    expect(result.audit[1]).toMatchObject({ accepted: false, reason: 'anchor_not_in_user_words' });
  });

  it('keeps the current state when the model omits premise changes', () => {
    const result = applyPremiseDeltas(
      ['제안 조건이 아직 확정되지 않았다는 전제'],
      [],
      '제안 조건은 아직 구두로만 들었어요.',
      '아직 구두로만 들었어요.',
    );

    expect(result.premises).toEqual(['제안 조건이 아직 확정되지 않았다는 전제']);
  });

  it('rejects an ungrounded removal and accepts one tied to the latest answer', () => {
    const current = ['제안 조건이 아직 확정되지 않았다는 전제'];
    const rejected = applyPremiseDeltas(current, [{
      action: 'remove',
      previous_text: current[0],
      anchor_quote: '문서로 받았어요',
      reason_from_latest_answer: '이제 확정되었다고 답함',
    }], '제안 조건은 아직 구두로만 들었어요.', '아직 구두예요.');
    const accepted = applyPremiseDeltas(current, [{
      action: 'remove',
      previous_text: current[0],
      anchor_quote: '문서로 받았어요',
      reason_from_latest_answer: '제안 조건을 문서로 받았다고 답함',
    }], '제안 조건은 아직 구두였지만 이제 문서로 받았어요.', '네, 문서로 받았어요.');

    expect(rejected.premises).toEqual(current);
    expect(rejected.audit[0].accepted).toBe(false);
    expect(accepted.premises).toEqual([]);
    expect(accepted.audit[0].accepted).toBe(true);
  });

  it('does not replenish beyond two grounded premises', () => {
    const result = applyPremiseDeltas(
      ['첫 전제', '둘째 전제'],
      [{
        action: 'add',
        text: '셋째 전제',
        anchor_quote: '예산이 정해졌기 때문에 이 안을 골라야 해요',
        support_kind: 'explicit_reason',
        if_false_changes: '예산 비교가 달라진다',
      }],
      '예산이 정해졌기 때문에 이 안을 골라야 해요.',
      '예산이 정해졌기 때문에 이 안을 골라야 해요.',
    );

    expect(result.premises).toEqual(['첫 전제', '둘째 전제']);
    expect(result.audit[0]).toMatchObject({ accepted: false, reason: 'premise_limit' });
  });

  it('does not turn a mentioned fact into a premise', () => {
    const result = coercePremiseCandidates([{
      text: '스타트업 런웨이가 18개월이라는 전제',
      anchor_quote: '런웨이는 18개월 정도래요',
      support_kind: 'explicit_expectation',
      if_false_changes: '고용 안정성 판단이 달라진다',
    }], '오퍼 준 회사는 시리즈B고, 물어보니 런웨이는 18개월 정도래요.');

    expect(result.premises).toEqual([]);
    expect(result.audit[0]).toMatchObject({
      accepted: false,
      reason: 'explicit_support_not_in_anchor',
    });
  });

  /**
   * The live v3 run rejected 100% of proposed premises: both anchors were facts
   * the user volunteered in ANSWER to "지금 가장 마음에 걸리는 건 뭐예요?", and
   * neither sentence happened to contain a connective. Answering a
   * decision-shaping question with X is itself the explicit link — the word test
   * belongs to older narration, where any sentence could be lifted at random.
   */
  describe('where the anchor came from decides what has to prove it', () => {
    const delta = [{
      action: 'add',
      text: '오퍼 회사의 런웨이 18개월이 판단에 걸리는 조건이다',
      anchor_quote: '런웨이는 18개월 정도래요',
      reason_from_latest_answer: '가장 걸리는 게 뭐냐는 질문에 이 숫자를 꺼냈다',
      support_kind: 'explicit_condition',
      if_false_changes: '재정 안정성 판단이 달라진다',
    }];
    const corpus = '이직 오퍼를 받았어요.\n오퍼 준 회사는 시리즈B고, 물어보니 런웨이는 18개월 정도래요.';

    it('accepts an anchor quoted from the answer the user just gave', () => {
      const result = applyPremiseDeltas([], delta, corpus, '오퍼 준 회사는 시리즈B고, 물어보니 런웨이는 18개월 정도래요.');
      expect(result.premises).toEqual(['오퍼 회사의 런웨이 18개월이 판단에 걸리는 조건이다']);
      expect(result.audit[0]).toMatchObject({ accepted: true });
    });

    it('still refuses a bare fact lifted from the earlier narration', () => {
      // Same delta, but the latest answer is about something else entirely —
      // so the anchor is old narration and must carry the connective itself.
      const result = applyPremiseDeltas([], delta, corpus, '승진 얘기는 아직 문서가 없어요');
      expect(result.premises).toEqual([]);
      expect(result.audit[0]).toMatchObject({ reason: 'explicit_support_not_in_anchor' });
    });

    it('refuses an anchor that appears in neither, however plausible', () => {
      const result = applyPremiseDeltas([], [{
        ...delta[0],
        anchor_quote: '가족들도 반대하고 있어요',
      }], corpus, '오퍼 준 회사는 시리즈B고, 물어보니 런웨이는 18개월 정도래요.');
      expect(result.premises).toEqual([]);
      expect(result.audit[0]).toMatchObject({ reason: 'anchor_not_in_user_words' });
    });
  });

  it('does not infer a user belief from a mentioned option attribute', () => {
    const result = coercePremiseCandidates([{
      text: '리드 승진 가능성을 높게 보고 있다는 전제',
      anchor_quote: '내년 초 리드 승진 얘기가 나오는 중이고요',
      support_kind: 'explicit_expectation',
      if_false_changes: '현 회사 선택지의 무게가 달라진다',
    }], '지금 회사에서는 내년 초 리드 승진 얘기가 나오는 중이고요.');

    expect(result.premises).toEqual([]);
  });
});
