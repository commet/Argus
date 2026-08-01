/**
 * A person's choice of ending is not a confession.
 *
 * The worst line the sim has ever produced, 2026-08-02. Someone wrote six
 * words — "퇴사하고 여행이나 갈까" — and Argus answered:
 *
 *   "'이나'가 붙은 거, 그냥 탈출하고 싶다는 말처럼 들려요."
 *
 * It analysed their PARTICLE and returned a psychological state they had never
 * named. The independent judge scored three separate H failures on that single
 * sentence — route_fit, ownership, fact_lineage — H being "제품 정체성을 직접
 * 훼손", the highest severity the rubric has.
 *
 * SILENCE IS NOT DATA already covers what the user did not say. This is its
 * twin and the sharper of the two: HOW they said it carries no meaning either.
 */
import { describe, expect, it } from 'vitest';
import { stripFrameSeizure, stripWordChoiceReading } from '../progressive-guards';

describe('the measured line', () => {
  it('does not survive', () => {
    expect(stripWordChoiceReading("'이나'가 붙은 거, 그냥 탈출하고 싶다는 말처럼 들려요.")).toBe('');
  });

  it('is removed from the middle of an otherwise usable insight', () => {
    const insight = '퇴사랑 여행이 같이 나왔네요. "여행이나"라고 쓰신 걸 보면 도피하고 싶으신 것 같아요. 반년이면 짧지 않은 시간이고요.';
    const out = stripWordChoiceReading(insight);
    expect(out).toContain('퇴사랑 여행이 같이 나왔네요.');
    expect(out).toContain('반년이면 짧지 않은 시간이고요.');
    expect(out).not.toContain('도피');
  });
});

describe('every shape of pointing at their wording', () => {
  it.each([
    ["'이나'가 붙은 거", "'이나'가 붙은 거, 뭔가 마음이 떠 있다는 뜻으로 들려요."],
    ['quoted + 쓰신', '"그냥"이라고 쓰신 게 마음에 남아요.'],
    ['표현을 보면', '쓰신 표현을 보면 이미 마음이 기운 것 같아요.'],
    ['말투를 보면', '말투를 보면 지쳐 있으신 것 같아요.'],
    ['단어를 고르신', '그 단어를 고르신 데는 이유가 있을 거예요.'],
    ['quoted + 라고 하신 걸', '"어렵다"라고 하신 걸 보면 부담이 크신 거죠.'],
    ['english phrasing', 'The way you put it suggests you already decided.'],
    ['english word choice', 'Your word choice tells me this matters more than you said.'],
  ])('%s', (_label, sentence) => {
    expect(stripWordChoiceReading(sentence)).toBe('');
  });
});

describe('what it must NOT touch', () => {
  it.each([
    '퇴사랑 여행이 같이 나왔네요. 둘 중 뭐가 먼저 떠오른 거예요?',
    '반년 정도 생각 중이라고 하셨어요.',
    '모아둔 돈으로 1년은 버틸 수 있다는 거네요.',
    '지금 회사에서 성장이 멈춘 느낌이라고 적으셨어요.',
    'You said the runway is 18 months.',
  ])('keeps a plain reflection: %s', (sentence) => {
    expect(stripWordChoiceReading(sentence)).toBe(sentence);
  });

  it('does NOT reach for an inference from what they said, only from HOW', () => {
    // "돈이 있다고 하신 걸 보면 시간은 확보되는 거네요" is an ordinary factual
    // inference and belongs to a different rule (MENTIONING IS NOT MATTERING),
    // which is semantic and lives in the prompt. Widening this guard to catch
    // it would strip legitimate reasoning, and nothing measured has asked for
    // it. The guard stays exactly as wide as the failure that produced it.
    const factual = '모아둔 돈이 1년치 있다고 하신 걸 보면 시간은 확보되는 거네요.';
    expect(stripWordChoiceReading(factual)).toBe(factual);
  });

  it('quoting the user is fine — it is READING THEIR GRAMMAR that is not', () => {
    // The difference is the whole rule. Repeating their sentence is a mirror;
    // explaining what their sentence reveals about them is a verdict.
    const quote = '"모아둔 돈은 1년 정도는 버틸 만큼 있어"라고 하셨죠.';
    expect(stripWordChoiceReading(quote)).toBe(quote);
  });
});

describe('an emptied insight is honest, not silent', () => {
  it('returns empty rather than handing the violation back', () => {
    // stripUnearnedRanking deliberately falls back to the original when every
    // sentence is stripped — a ranked sentence is still mostly about the
    // decision. Here the sentence IS entirely the violation, so returning it
    // would defeat the guard. The engine substitutes the user's own frame.
    expect(stripWordChoiceReading("'이나'가 붙은 거, 탈출하고 싶다는 거죠.")).toBe('');
  });

  it('the engine falls back to their own frame on a non-open route', async () => {
    const { readFileSync } = await import('node:fs');
    const src = readFileSync('src/lib/progressive-engine.ts', 'utf8');
    expect(src).toContain('stripWordChoiceReading(result.insight)');
    expect(src).toContain(': (result.real_question || routedInsight))');
  });

  it('runs before the route-specific guards, so it applies on crisis too', async () => {
    const { readFileSync } = await import('node:fs');
    const src = readFileSync('src/lib/progressive-engine.ts', 'utf8');
    const start = src.indexOf('const literalInsight');
    const chain = src.slice(start, src.indexOf('const snapshot: AnalysisSnapshot', start));
    expect(chain).toContain('ensureCrisisResource(literalInsight');
    expect(chain).toContain('stripConditionalReassurance(literalInsight)');
    expect(chain).toContain('stripUnearnedRanking(literalInsight)');
  });
});

/**
 * The frame taken — the only unanimous H the sim has ever produced (three
 * independent judge runs, 2026-08-02).
 *
 * A team lead wrote "내보내야 하나 고민입니다". After one answer Argus said:
 *
 *   "'내보낼지'를 고민하는 게 아니라, 다음 주 기한 결과를 보고 어떻게 할지
 *    판단하는 순서가 이미 설계되어 있는 거예요."
 *
 * Rule 8 forbids replacing their question with a grander one and rule 9 bans
 * "진짜 질문" outright — but rule 9 was enforced only on the receipt, and this
 * was an insight on round 2, where nothing looked.
 */
describe('nobody may tell a person their question is not their question', () => {
  it('drops the measured sentence', () => {
    expect(stripFrameSeizure(
      "'내보낼지'를 고민하는 게 아니라, 다음 주 기한 결과를 보고 어떻게 할지 판단하는 순서가 이미 설계되어 있는 거예요.",
    )).toBe('');
  });

  it.each([
    ['negates their deliberation', '지금 고민하는 게 아니라 시점을 정하는 문제예요.'],
    ['negates their question', '질문이 그게 아니라 다른 데 있어요.'],
    ['names the frame it is taking', '진짜 질문은 언제 정리하느냐예요.'],
    ['핵심 문제는', '핵심 문제는 성과가 아니라 신뢰예요.'],
    ['english', "The real question is whether you can afford to wait."],
    ['english soft', "It's not really about the deadline."],
  ])('%s', (_l, sentence) => {
    expect(stripFrameSeizure(sentence)).toBe('');
  });

  it.each([
    // "A가 아니라 B" is ordinary Korean and usually about the WORLD, not about
    // what the user is deciding. Catching it would gut normal reflection.
    '호가가 아니라 실제 거래가를 보셔야 해요.',
    '기한은 다음 주가 아니라 그다음 주예요.',
    '문서로 남긴 건 계획이지 약속이 아니라고 하셨어요.',
    '두 번째 기한이 다음 주에 끝나요.',
  ])('leaves ordinary contrast alone: %s', (sentence) => {
    expect(stripFrameSeizure(sentence)).toBe(sentence);
  });

  it('runs on the deepening turn, which is where the frame gets taken', async () => {
    const { readFileSync } = await import('node:fs');
    const src = readFileSync('src/lib/progressive-engine.ts', 'utf8');
    expect(src).toContain('stripFrameSeizure(stripWordChoiceReading(result.insight))');
    // And the deepening path falls back to the user's own frame, not to silence
    // and not to the sentence it just refused.
    expect(src).toContain('return result.real_question || currentSnapshot.real_question;');
  });
});
