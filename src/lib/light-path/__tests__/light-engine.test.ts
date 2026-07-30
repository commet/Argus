/**
 * Light path engine — the structural guarantees the prompt alone cannot give.
 *
 * What must stay red-provable here:
 *   - the deterministic crisis gate runs BEFORE any LLM call (opening AND answers);
 *   - the 2-question budget is a HARD code clamp, not a prompt hope;
 *   - days is clamped 1–14;
 *   - defensive parsing: a missing/garbled field degrades honestly (plain close),
 *     never a fabricated beat;
 *   - when → check_by date math is exactly the founder-specified mapping;
 *   - the seal lands as a normal DecisionContract that reads 'sealed' and enters
 *     the SAME due loop (contractStatus.checkInDue) every return surface reads.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/llm', () => ({
  callLLMJson: vi.fn(),
}));

import { callLLMJson } from '@/lib/llm';
import {
  runLightGate,
  runLightNext,
  coerceLightGate,
  coerceLightTurn,
  clampLightDays,
  lightCheckBy,
  lightWhenLabel,
  buildLightSealContract,
  composeDeepenText,
  LIGHT_MAX_QUESTIONS,
  LIGHT_PATH_ENABLED,
} from '@/lib/light-path/light-engine';
import { contractPhase, contractStatus } from '@/lib/decision-contract';

const mockJson = vi.mocked(callLLMJson);
const DAY = 86_400_000;

beforeEach(() => {
  mockJson.mockReset();
});

describe('runLightGate — routing', () => {
  it('crisis input short-circuits to heavy with ZERO LLM calls (existing crisis handling owns it)', async () => {
    const res = await runLightGate('요즘 자꾸 죽고 싶다는 생각이 들어', 'ko');
    expect(res).toEqual({ need: 'heavy' });
    expect(mockJson).not.toHaveBeenCalled();
  });

  it('empty input is heavy without an LLM call', async () => {
    expect(await runLightGate('   ', 'ko')).toEqual({ need: 'heavy' });
    expect(mockJson).not.toHaveBeenCalled();
  });

  it('light verdict carries the first mirror+question from the SAME call', async () => {
    mockJson.mockResolvedValueOnce({ need: 'light', mirror: ' 집에 갈까 고민이시네요 ', question: ' 어느 쪽이 더 커요? ' });
    const res = await runLightGate('파티에서 지금 나올까 말까', 'ko');
    expect(res).toEqual({ need: 'light', mirror: '집에 갈까 고민이시네요', question: '어느 쪽이 더 커요?' });
  });

  it('uses the fast model tier', async () => {
    mockJson.mockResolvedValueOnce({ need: 'heavy' });
    await runLightGate('내일 회의 자료를 어떻게 만들지', 'ko');
    expect(mockJson).toHaveBeenCalledTimes(1);
    const opts = mockJson.mock.calls[0][1] as { model?: string };
    expect(opts.model).toBe('fast');
  });

  it('light WITHOUT a renderable mirror/question falls to heavy (never fabricates the beat)', async () => {
    mockJson.mockResolvedValueOnce({ need: 'light', mirror: '거울만 있음' });
    expect(await runLightGate('오늘 뭐 먹지', 'ko')).toEqual({ need: 'heavy' });
  });

  it('an LLM failure fails open to heavy (the existing flow owns error surfacing)', async () => {
    mockJson.mockRejectedValueOnce(new Error('429'));
    expect(await runLightGate('오늘 뭐 먹지', 'ko')).toEqual({ need: 'heavy' });
  });

  it('the kill switch exists and is a boolean', () => {
    expect(typeof LIGHT_PATH_ENABLED).toBe('boolean');
  });
});

describe('coerceLightGate — defensive parsing', () => {
  it('non-object / garbled need → heavy', () => {
    expect(coerceLightGate(null)).toEqual({ need: 'heavy' });
    expect(coerceLightGate('light')).toEqual({ need: 'heavy' });
    expect(coerceLightGate({ need: 42 })).toEqual({ need: 'heavy' });
  });

  it('heavy drops any stray mirror/question', () => {
    expect(coerceLightGate({ need: 'heavy', mirror: 'x', question: 'y' })).toEqual({ need: 'heavy' });
  });
});

describe('runLightNext — crisis pre-empt on EVERY answer', () => {
  it('a crisis signal in an answer stops the light flow before the LLM', async () => {
    const res = await runLightNext(
      '집에 갈까 말까',
      [{ question: '어느 쪽이 커요?', answer: '사실 요즘 자살 생각을 해요' }],
      'ko',
    );
    expect(res.crisis?.isCrisis).toBe(true);
    expect(res.crisis?.category).toBe('self_harm');
    expect(res.action).toBe('close');
    expect(mockJson).not.toHaveBeenCalled();
  });

  it('a navigable answer goes to the LLM and returns the coerced turn', async () => {
    mockJson.mockResolvedValueOnce({ mirror: '피곤이 관건이네요', action: 'ask', question: '내일 몇 시에 일어나요?' });
    const res = await runLightNext('집에 갈까 말까', [{ question: 'q1', answer: '내일 출근이 걱정' }], 'ko');
    expect(res).toEqual({ mirror: '피곤이 관건이네요', action: 'ask', question: '내일 몇 시에 일어나요?' });
  });
});

describe('coerceLightTurn — the 2-question HARD clamp', () => {
  it(`after ${LIGHT_MAX_QUESTIONS} answered questions, an 'ask' with an offer is forced to 'offer'`, () => {
    const turn = coerceLightTurn(
      { mirror: 'm', action: 'ask', question: '세 번째 질문?', offer: { sentence: '내일 안 피곤하다', when: 'tomorrow_morning' } },
      LIGHT_MAX_QUESTIONS,
    );
    expect(turn.action).toBe('offer');
    expect(turn.question).toBeUndefined();
    expect(turn.offer?.sentence).toBe('내일 안 피곤하다');
  });

  it(`after ${LIGHT_MAX_QUESTIONS} answered questions, an 'ask' WITHOUT an offer becomes a plain close (never a fabricated offer)`, () => {
    const turn = coerceLightTurn({ mirror: 'm', action: 'ask', question: '세 번째 질문?' }, LIGHT_MAX_QUESTIONS);
    expect(turn.action).toBe('close');
    expect(turn.question).toBeUndefined();
    expect(turn.offer).toBeUndefined();
  });

  it('under budget, ask passes through', () => {
    const turn = coerceLightTurn({ mirror: 'm', action: 'ask', question: '두 번째?' }, 1);
    expect(turn.action).toBe('ask');
    expect(turn.question).toBe('두 번째?');
  });
});

describe('coerceLightTurn — defensive parsing (honest gap, never fabrication)', () => {
  it('missing action is inferred from what was actually produced', () => {
    expect(coerceLightTurn({ mirror: 'm', question: 'q' }, 0).action).toBe('ask');
    expect(coerceLightTurn({ mirror: 'm', offer: { sentence: 's', when: 'tonight' } }, 0).action).toBe('offer');
    expect(coerceLightTurn({ mirror: 'm', escalate: { bigger_question: 'bq' } }, 0).action).toBe('escalate');
    expect(coerceLightTurn({ mirror: 'm' }, 0).action).toBe('close');
  });

  it("action 'offer' without a sentence degrades to close", () => {
    const turn = coerceLightTurn({ mirror: 'm', action: 'offer', offer: { when: 'tonight' } }, 1);
    expect(turn.action).toBe('close');
    expect(turn.offer).toBeUndefined();
  });

  it("action 'escalate' without a bigger_question degrades (offer if present, else close)", () => {
    expect(coerceLightTurn({ mirror: 'm', action: 'escalate' }, 1).action).toBe('close');
    expect(
      coerceLightTurn({ mirror: 'm', action: 'escalate', offer: { sentence: 's', when: 'tonight' } }, 1).action,
    ).toBe('offer');
  });

  it('a completely garbled payload is a plain close with an empty mirror', () => {
    expect(coerceLightTurn(undefined, 0)).toEqual({ mirror: '', action: 'close' });
    expect(coerceLightTurn('text', 0)).toEqual({ mirror: '', action: 'close' });
  });

  it('an unknown when value defaults to tomorrow_morning (rule-7 default)', () => {
    const turn = coerceLightTurn({ mirror: 'm', action: 'offer', offer: { sentence: 's', when: 'next_year' } }, 1);
    expect(turn.offer?.when).toBe('tomorrow_morning');
  });

  it('in_days without a usable days number falls back to tomorrow_morning', () => {
    const turn = coerceLightTurn({ mirror: 'm', action: 'offer', offer: { sentence: 's', when: 'in_days' } }, 1);
    expect(turn.offer?.when).toBe('tomorrow_morning');
    expect(turn.offer?.days).toBeUndefined();
  });
});

describe('days clamp (1–14)', () => {
  it('clamps out-of-range and coerces numeric strings', () => {
    expect(clampLightDays(99)).toBe(14);
    expect(clampLightDays(0)).toBe(1);
    expect(clampLightDays(-3)).toBe(1);
    expect(clampLightDays('7')).toBe(7);
    expect(clampLightDays(3.6)).toBe(4);
    expect(clampLightDays('abc')).toBeUndefined();
    expect(clampLightDays(undefined)).toBeUndefined();
  });

  it('applies through turn coercion', () => {
    const turn = coerceLightTurn(
      { mirror: 'm', action: 'offer', offer: { sentence: 's', when: 'in_days', days: 99 } },
      1,
    );
    expect(turn.offer).toEqual({ sentence: 's', when: 'in_days', days: 14 });
  });
});

describe('lightCheckBy — when → check_by date math', () => {
  // Local-time reference: 10:00 on an arbitrary day.
  const base = new Date(2026, 6, 28, 10, 0, 0, 0);
  const now = base.getTime();

  it('tonight = today 21:00 (local)', () => {
    const d = lightCheckBy('tonight', undefined, now);
    expect(d.getFullYear()).toBe(base.getFullYear());
    expect(d.getMonth()).toBe(base.getMonth());
    expect(d.getDate()).toBe(base.getDate());
    expect(d.getHours()).toBe(21);
    expect(d.getTime()).toBeGreaterThan(now);
  });

  it('tonight past 21:00 rolls forward a day (a seal is never born due)', () => {
    const late = new Date(2026, 6, 28, 22, 30, 0, 0).getTime();
    const d = lightCheckBy('tonight', undefined, late);
    expect(d.getDate()).toBe(29);
    expect(d.getHours()).toBe(21);
    expect(d.getTime()).toBeGreaterThan(late);
  });

  it('tomorrow_morning = next day 09:00', () => {
    const d = lightCheckBy('tomorrow_morning', undefined, now);
    expect(d.getTime() - now).toBeLessThan(DAY);
    expect(d.getDate()).toBe(base.getDate() + 1);
    expect(d.getHours()).toBe(9);
  });

  it('this_weekend = next Sunday 10:00', () => {
    const d = lightCheckBy('this_weekend', undefined, now);
    expect(d.getDay()).toBe(0);
    expect(d.getHours()).toBe(10);
    expect(d.getTime()).toBeGreaterThan(now);
    expect(d.getTime() - now).toBeLessThanOrEqual(7 * DAY);
  });

  it('on a Sunday past 10:00, this_weekend means NEXT Sunday', () => {
    const sunday = new Date(2026, 6, 1, 11, 0, 0, 0);
    while (sunday.getDay() !== 0) sunday.setDate(sunday.getDate() + 1);
    const d = lightCheckBy('this_weekend', undefined, sunday.getTime());
    expect(d.getDay()).toBe(0);
    expect(d.getHours()).toBe(10);
    expect(d.getTime() - sunday.getTime()).toBeGreaterThan(6 * DAY);
  });

  it('in_days = now + clamped days', () => {
    expect(lightCheckBy('in_days', 3, now).getTime()).toBe(now + 3 * DAY);
    expect(lightCheckBy('in_days', 99, now).getTime()).toBe(now + 14 * DAY);
    expect(lightCheckBy('in_days', 0, now).getTime()).toBe(now + 1 * DAY);
    expect(lightCheckBy('in_days', undefined, now).getTime()).toBe(now + 1 * DAY);
  });

  it('labels match the slots', () => {
    expect(lightWhenLabel('tonight', undefined, 'ko')).toBe('오늘 밤 9시');
    expect(lightWhenLabel('tomorrow_morning', undefined, 'ko')).toBe('내일 아침');
    expect(lightWhenLabel('this_weekend', undefined, 'ko')).toBe('이번 주 일요일');
    expect(lightWhenLabel('in_days', 5, 'ko')).toBe('5일 뒤');
    expect(lightWhenLabel('in_days', 1, 'en')).toBe('in 1 day');
  });
});

describe('buildLightSealContract — the seal reuses the EXISTING contract machinery', () => {
  const now = new Date(2026, 6, 28, 10, 0, 0, 0).getTime();

  it('accepted as-is: ai_surfaced provenance + adoption lineage, sealed phase, on the due loop', () => {
    const c = buildLightSealContract(
      'p1',
      { sentence: '케이크 자르고 나오면 내일 안 피곤하다', edited: false, when: 'tomorrow_morning', problemText: '파티에서 지금 나올까' },
      now,
    );
    expect(c).not.toBeNull();
    const contract = c!;
    // one user_lean predicate, honestly attributed to the machine's wording
    expect(contract.predicates).toHaveLength(1);
    const p = contract.predicates[0];
    expect(p.source).toBe('user_lean');
    expect(p.authored).toBe('ai_surfaced');
    expect(p.attribution?.wording_source).toBe('ai_surfaced');
    expect(p.attribution?.authority).toBe('ai_suggested');
    expect(p.attribution?.source_ref).toBe('workspace:light_path_seal');
    // adoption receipt for the kept machine wording
    expect(contract.adoption_lineage).toEqual([{ source_proposal_ref: p.id, adopted_as: 'wording' }]);
    // closing seal — not a pre-review baseline awaiting a review that never comes
    expect(contract.closed_at).toBeTruthy();
    expect(contract.sealed_statement).toBe('케이크 자르고 나오면 내일 안 피곤하다');
    expect(contract.origin_utterance).toBe('파티에서 지금 나올까');
    expect(contractPhase(contract, now)).toBe('sealed');
    // check_by = the exact founder mapping
    expect(contract.check_in_at).toBe(lightCheckBy('tomorrow_morning', undefined, now).toISOString());
    // the SAME return loop every due surface reads
    expect(contractStatus(contract, now).checkInDue).toBe(false);
    expect(contractStatus(contract, now + 2 * DAY).checkInDue).toBe(true);
  });

  it('edited: the sentence is the user\'s own (user_reworded), no adoption lineage', () => {
    const c = buildLightSealContract(
      'p1',
      { sentence: '내가 다시 쓴 문장', edited: true, when: 'tonight', problemText: '파티에서 지금 나올까' },
      now,
    )!;
    const p = c.predicates[0];
    expect(p.authored).toBe('user');
    expect(p.attribution?.wording_source).toBe('user_reworded');
    expect(p.attribution?.authority).toBe('user_asserted');
    expect(c.adoption_lineage).toBeUndefined();
    expect(contractPhase(c, now)).toBe('sealed');
  });

  it('an empty sentence seals nothing (honest-empty)', () => {
    expect(buildLightSealContract('p1', { sentence: '  ', edited: false, when: 'tonight', problemText: 'x' }, now)).toBeNull();
  });
});

describe('composeDeepenText — the heavy handoff carries the light Q&A', () => {
  it('without Q&A it is the bare problem', () => {
    expect(composeDeepenText('문제', [], 'ko')).toBe('문제');
  });

  it('with Q&A the context rides inside the problem text (the wire the heavy flow reads)', () => {
    const text = composeDeepenText('문제', [{ question: '질문1', answer: '답1' }], 'ko');
    expect(text).toContain('문제');
    expect(text).toContain('Q. 질문1');
    expect(text).toContain('A. 답1');
  });
});
