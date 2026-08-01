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
import { stripWordChoiceReading } from '../progressive-guards';

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
