import { describe, it, expect } from 'vitest';
import { validateQuestion, OverFireError, type ValidateInput } from '../question-validator';

/**
 * Phase 1 fixture set (DESIGN-clarify-question-system-v2 §9, §11): 10 bad / 10
 * good questions → deterministic reject/pass regression, plus the R5 throw.
 */

const BAD: Array<{ name: string; input: ValidateInput; rule: string }> = [
  { name: 'admin: final decision-maker (ko)', rule: 'admin_only',
    input: { text: '이 프로젝트의 최종 결정권자는 누구인가요?', locale: 'ko' } },
  { name: 'admin: deadline (ko)', rule: 'admin_only',
    input: { text: '마감일은 언제인가요?', locale: 'ko' } },
  { name: 'admin: what format (ko)', rule: 'admin_only',
    input: { text: '어떤 형식으로 만들까요?', locale: 'ko' } },
  { name: 'admin: what tone (en)', rule: 'admin_only',
    input: { text: 'What tone should this take?', locale: 'en' } },
  { name: 'admin: how many pages (ko)', rule: 'admin_only',
    input: { text: '몇 페이지로 작성할까요?', locale: 'ko' } },
  { name: 'internal structure: skeleton (ko)', rule: 'internal_structure',
    input: { text: '스켈레톤을 먼저 어떻게 채울까요?', locale: 'ko' } },
  { name: 'confirmation bias (ko)', rule: 'confirmation_bias',
    input: { text: '이제 이 방향이 맞나요?', locale: 'ko' } },
  { name: 'confirmation bias (en)', rule: 'confirmation_bias',
    input: { text: 'Does this look right?', locale: 'en' } },
  { name: 'category options (ko)', rule: 'category_options',
    input: { text: '무엇이 가장 중요할까요?', options: ['전략', '실행', '커뮤니케이션'], locale: 'ko' } },
  { name: 're-ask a known theme (ko)', rule: 'reask_known',
    input: {
      text: '새 기능을 지금 출시할지 나중으로 미룰지 다시 여쭤볼게요',
      locale: 'ko',
      previousQA: [{ q: '새 기능을 지금 출시할지 나중으로 미룰지 고민이에요', a: '지금요' }],
    } },
];

const GOOD: Array<{ name: string; input: ValidateInput }> = [
  { name: 'crux: first signal (ko)',
    input: { text: '이 판단이 틀렸다고 드러난다면 가장 먼저 어디에서 신호가 나타날까요?', locale: 'ko' } },
  { name: 'crux: what is more uncertain (ko)',
    input: { text: '지금 더 불확실한 건 상대의 반응인가요, 우리의 실행 속도인가요?', locale: 'ko' } },
  { name: 'real fork options (ko)',
    input: { text: '어느 쪽으로 먼저 움직이시겠어요?', options: ['좁은 범위로 먼저 검증하고 확대한다', '전면 출시로 한 번에 반응을 본다'], locale: 'ko' } },
  { name: 'crux: launch stalls (en)',
    input: { text: 'If the launch stalls, where would you see the first sign?', locale: 'en' } },
  { name: 'weakest assumption (ko)',
    input: { text: '가장 불안한 가정 하나를 고른다면 무엇인가요?', locale: 'ko' } },
  { name: 'constraint that moves the outcome (en)',
    input: { text: 'What single constraint could change this outcome the most?', locale: 'en' } },
  { name: 'three real forks (ko)',
    input: { text: '진짜 결정은 무엇인가요?', options: ['할지 말지부터 정한다', '하기로 했고 범위를 정한다', '범위는 정했고 순서를 정한다'], locale: 'ko' } },
  { name: 'follows user words (ko)',
    input: { text: '"먹힌다"는 게 구체적으로 어떤 반응이 나오는 걸 말하나요?', locale: 'ko' } },
  { name: 'reaction crux (en)',
    input: { text: 'Whose reaction would tell you the most, and what would they flag first?', locale: 'en' } },
  { name: 'open crux with requestType open (ko)',
    input: { text: '이 결정에서 가장 되돌리기 어려운 부분은 무엇인가요?', locale: 'ko', requestType: 'open' } },
];

describe('validateQuestion — bad questions reject with the right rule', () => {
  for (const c of BAD) {
    it(c.name, () => {
      const r = validateQuestion(c.input);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.rule).toBe(c.rule);
    });
  }
});

describe('validateQuestion — good questions pass', () => {
  for (const c of GOOD) {
    it(c.name, () => {
      expect(validateQuestion(c.input)).toEqual({ ok: true });
    });
  }
});

describe('R5 — over-fire throws (fail loud)', () => {
  it('a non-open request that reached the validator throws OverFireError', () => {
    expect(() => validateQuestion({ text: '무엇이든', locale: 'ko', requestType: 'flat' })).toThrow(OverFireError);
    expect(() => validateQuestion({ text: 'anything', locale: 'en', requestType: 'vent' })).toThrow(OverFireError);
  });
  it("request_type 'open' or undefined does not throw", () => {
    expect(() => validateQuestion({ text: '이 결정에서 무엇이 가장 불확실한가요?', locale: 'ko', requestType: 'open' })).not.toThrow();
    expect(() => validateQuestion({ text: '이 결정에서 무엇이 가장 불확실한가요?', locale: 'ko' })).not.toThrow();
  });
});

describe('R6 — forced checkpoint', () => {
  it('checkpoint_seed with no linked premise rejects', () => {
    const r = validateQuestion({ text: '나중에 무엇을 보면 이 판단이 선명해질까요?', tag: 'checkpoint_seed', hasLinkedPremise: false, locale: 'ko' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.rule).toBe('forced_checkpoint');
  });
  it('checkpoint_seed WITH a linked premise passes', () => {
    expect(validateQuestion({ text: '나중에 무엇을 보면 이 판단이 선명해질까요?', tag: 'checkpoint_seed', hasLinkedPremise: true, locale: 'ko' })).toEqual({ ok: true });
  });
});
