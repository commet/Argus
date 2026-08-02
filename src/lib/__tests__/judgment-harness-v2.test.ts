import { describe, expect, it } from 'vitest';
import {
  buildDeepeningJudgmentPrompt,
  buildInitialJudgmentPrompt,
  buildJudgmentSynthesisPrompt,
  buildRefinementJudgmentPrompt,
} from '../judgment-harness-v2';

describe('Argus judgment harness v2', () => {
  it('treats empty assumptions and no initial plan as successful output', () => {
    const prompt = buildInitialJudgmentPrompt('이직 제안을 받을지 고민 중이에요.', 'ko');

    expect(prompt.system).toContain('There is NO minimum');
    expect(prompt.system).toContain('skeleton MUST remain []');
    expect(prompt.system).toContain('"premise_candidates": []');
    expect(prompt.system).toContain('exact anchor_quote copied from the user');
    expect(prompt.system).not.toContain('5 lines');
    expect(prompt.system).not.toContain('Offer 3-4');
  });

  it('treats the pre-review baseline as user evidence across the first and later turns', () => {
    const initial = buildInitialJudgmentPrompt(
      '이번 주에 공개할지 고민이에요.',
      'ko',
      '이번 주에 공개하되 치명적인 오류만 먼저 확인하고 싶어요.',
    );
    expect(initial.user).toContain('<pre-review-baseline>');
    expect(initial.user).toContain('치명적인 오류만 먼저 확인');
    expect(initial.system).toContain('Do not ask them to restate');
    expect(initial.system).toContain('A pre-review lean is NOT proof');
    expect(initial.system).toContain("I want to / I'm leaning toward");

    const later = buildDeepeningJudgmentPrompt(
      '이번 주에 공개할지 고민이에요.',
      {
        version: 0,
        real_question: '공개 시점을 정해야 해요.',
        pre_review_baseline: '이번 주에 공개하되 치명적인 오류만 먼저 확인하고 싶어요.',
        hidden_assumptions: [],
        skeleton: [],
        request_type: 'open',
      },
      [],
      0,
      3,
      'ko',
    );
    expect(later.user).toContain("user's pre-review baseline");
    expect(later.user).toContain('치명적인 오류만 먼저 확인');
    expect(later.system).toContain('Do not re-ask');
  });

  it('forbids importing an adjacent expert domain just to fill the frame', () => {
    const prompt = buildInitialJudgmentPrompt('노트북을 바꿀까 고민이에요.', 'ko');

    expect(prompt.system).toContain('Do not introduce a new legal, market, organizational');
    expect(prompt.system).toContain('branches already appear in the user');
  });

  it('updates only what the latest answer changed and does not replenish premises', () => {
    const prompt = buildDeepeningJudgmentPrompt(
      '이직 제안을 받을지 고민 중이에요.',
      {
        version: 1,
        real_question: '이직 제안을 받을까?',
        hidden_assumptions: ['새 회사의 제안 조건이 지금 들은 그대로 확정된다는 전제'],
        skeleton: [],
        request_type: 'open',
        stakes: 'important',
        reversibility: 'partial',
      },
      [{
        question: {
          id: 'q1',
          text: '제안 조건은 문서로 받았나요?',
          type: 'short',
          engine_phase: 'reframe',
        },
        answer: { value: '아직 구두로만 들었어요.' },
      }],
      0,
      3,
      'ko',
    );

    expect(prompt.system).toContain('Never replenish the list');
    expect(prompt.system).toContain('"premise_changes": []');
    expect(prompt.system).toContain('latest answer and reason_from_latest_answer');
    expect(prompt.system).toContain('skeleton MUST remain []');
    expect(prompt.system).toContain('Do not repeat or paraphrase a question');
    expect(prompt.system).toContain('answer off-axis with new information');
    expect(prompt.user).toContain('아직 구두로만 들었어요.');
  });

  it('treats a rejected framing as user evidence, not a request for a fuller rewrite', () => {
    const prompt = buildRefinementJudgmentPrompt(
      '이직 제안을 받을지 고민 중이에요.',
      '연봉과 성장 중 무엇이 더 중요한가요?',
      '그게 아니라 가족과 떨어져 지내야 하는지가 고민이에요.',
      'ko',
    );

    expect(prompt.system).toContain('correction is new evidence');
    expect(prompt.system).toContain('never the rejected AI question');
    expect(prompt.system).toContain('skeleton remains []');
    expect(prompt.user).toContain('가족과 떨어져 지내야 하는지');
  });

  it('makes synthesis a receipt and forbids a new criterion or action', () => {
    const prompt = buildJudgmentSynthesisPrompt(
      '이직 제안을 받을지 고민 중이에요.',
      [{
        version: 1,
        real_question: '이직 제안을 받을까?',
        hidden_assumptions: [],
        skeleton: [],
        request_type: 'open',
      }],
      [],
      'ko',
    );

    expect(prompt.system).toContain('judgment receipt, not a report');
    expect(prompt.system).toContain('Add no new fact, premise, risk');
    expect(prompt.system).toContain('next_steps may ONLY restate, one-for-one');
    expect(prompt.system).toContain('"key_assumptions": []');
    expect(prompt.system).not.toContain('3-5 sections');
  });
});
