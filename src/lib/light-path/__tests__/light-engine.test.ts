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
vi.mock('@/lib/analytics', () => ({
  track: vi.fn(),
}));

import { callLLMJson } from '@/lib/llm';
import { track } from '@/lib/analytics';
import {
  runLightGate,
  runLightNext,
  coerceLightGate,
  coerceLightTurn,
  clampLightDays,
  stripTrailingQuestion,
  stripOneLinePhrase,
  lightCheckBy,
  lightWhenLabel,
  buildLightSealContract,
  composeDeepenText,
  firstThoughtFromQas,
  LIGHT_MAX_QUESTIONS,
  LIGHT_PATH_ENABLED,
} from '@/lib/light-path/light-engine';
import { contractPhase, contractStatus } from '@/lib/decision-contract';

const mockJson = vi.mocked(callLLMJson);
const mockTrack = vi.mocked(track);
const DAY = 86_400_000;

beforeEach(() => {
  mockJson.mockReset();
  mockTrack.mockReset();
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

  it('a QUOTA failure still falls to heavy but is COUNTED (light_gate_quota_fallback)', async () => {
    mockJson.mockRejectedValueOnce(Object.assign(new Error('요청 한도에 도달했습니다.'), { category: 'rate_limit' }));
    expect(await runLightGate('오늘 뭐 먹지', 'ko')).toEqual({ need: 'heavy' });
    expect(mockTrack).toHaveBeenCalledWith('light_gate_quota_fallback');
  });

  it('anonymous quota exhaustion (LOGIN_REQUIRED) is counted the same way', async () => {
    mockJson.mockRejectedValueOnce(Object.assign(new Error('LOGIN_REQUIRED:무료 체험을 모두 사용했습니다.'), { category: 'auth' }));
    expect(await runLightGate('오늘 뭐 먹지', 'ko')).toEqual({ need: 'heavy' });
    expect(mockTrack).toHaveBeenCalledWith('light_gate_quota_fallback');
  });

  it('a non-quota failure (network / non-quota auth) is NOT counted as quota fallthrough', async () => {
    mockJson.mockRejectedValueOnce(Object.assign(new Error('네트워크 연결에 실패했습니다.'), { category: 'network' }));
    expect(await runLightGate('오늘 뭐 먹지', 'ko')).toEqual({ need: 'heavy' });
    mockJson.mockRejectedValueOnce(Object.assign(new Error('인증에 실패했습니다.'), { category: 'auth' }));
    expect(await runLightGate('오늘 뭐 먹지', 'ko')).toEqual({ need: 'heavy' });
    expect(mockTrack).not.toHaveBeenCalledWith('light_gate_quota_fallback');
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

describe('copy-redundancy guards (production capture)', () => {
  it('stripTrailingQuestion drops the mirror\'s trailing question sentence, keeps the statement', () => {
    expect(stripTrailingQuestion('집에 가야 하나 싶으신 거네요. 지금 마음은 어느 쪽으로 좀 더 가 있어요?'))
      .toBe('집에 가야 하나 싶으신 거네요.');
    expect(stripTrailingQuestion('아쉬움이 남으시는 거네요! 어느 쪽이 커요?')).toBe('아쉬움이 남으시는 거네요!');
    // only the LAST sentence is dropped — a mid-mirror question is the prompt's job
    expect(stripTrailingQuestion('앞 질문 있고요? 뒤 질문도 있어요?')).toBe('앞 질문 있고요?');
  });

  it('a mirror that was ONLY a question drops to empty', () => {
    expect(stripTrailingQuestion('지금 마음은 어느 쪽이에요?')).toBe('');
  });

  it('a statement mirror passes through untouched', () => {
    expect(stripTrailingQuestion('내일 피곤만 아니면 되는 거네요.')).toBe('내일 피곤만 아니면 되는 거네요.');
    expect(stripTrailingQuestion('')).toBe('');
  });

  it('the gate strips a question-ended mirror so the headline never repeats it', () => {
    const gate = coerceLightGate({
      need: 'light',
      mirror: '더 있고 싶으신 거네요. 지금 마음은 어느 쪽으로 좀 더 가 있어요?',
      question: '지금 마음은 어느 쪽으로 좀 더 가 있어요?',
    });
    expect(gate.mirror).toBe('더 있고 싶으신 거네요.');
    expect(gate.question).toBe('지금 마음은 어느 쪽으로 좀 더 가 있어요?');
  });

  it('a gate mirror that was ONLY the duplicated question falls to heavy (nothing left to mirror)', () => {
    expect(coerceLightGate({ need: 'light', mirror: '어느 쪽이에요?', question: '어느 쪽이에요?' }))
      .toEqual({ need: 'heavy' });
  });

  it('turn coercion strips the trailing mirror question before ask and offer beats', () => {
    const ask = coerceLightTurn(
      { mirror: '피곤이 관건이네요. 내일 몇 시에 일어나요?', action: 'ask', question: '내일 몇 시에 일어나요?' },
      0,
    );
    expect(ask.mirror).toBe('피곤이 관건이네요.');
    const offer = coerceLightTurn(
      { mirror: '되는 거네요. 물어볼까요?', action: 'offer', offer: { sentence: 's', when: 'tonight', ask: '제가 물어볼까요?' } },
      1,
    );
    expect(offer.mirror).toBe('되는 거네요.');
    // escalate/close mirrors are left alone — nothing follows that would repeat them
    const close = coerceLightTurn({ mirror: '그런 상황이네요?', action: 'close' }, 1);
    expect(close.mirror).toBe('그런 상황이네요?');
  });

  it('stripOneLinePhrase removes the placeholder\'s line from a question', () => {
    expect(stripOneLinePhrase('지금 마음은 어느 쪽에 가 있어요? 왜 그런지 한 줄이면 돼요.'))
      .toBe('지금 마음은 어느 쪽에 가 있어요?');
    expect(stripOneLinePhrase('Which way are you leaning? One line is enough.'))
      .toBe('Which way are you leaning?');
    expect(stripOneLinePhrase('한 줄이면 돼요.')).toBe('');
    expect(stripOneLinePhrase('어느 쪽이 커요?')).toBe('어느 쪽이 커요?');
  });

  it('the question field is cleaned through both gate and turn coercion', () => {
    const gate = coerceLightGate({ need: 'light', mirror: '고민이시네요.', question: '어느 쪽이에요? 한 줄이면 돼요.' });
    expect(gate.question).toBe('어느 쪽이에요?');
    const turn = coerceLightTurn(
      { mirror: 'm.', action: 'ask', question: '내일 몇 시에 일어나요? 한 줄이면 돼요.' },
      0,
    );
    expect(turn.question).toBe('내일 몇 시에 일어나요?');
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

describe('check-time sanity (production capture: a weekend claim checked BEFORE the weekend)', () => {
  const offerWith = (sentence: string, when: string) =>
    coerceLightTurn({ mirror: 'm.', action: 'offer', offer: { sentence, when } }, 1).offer!;

  it('a weekend claim pulled to tomorrow_morning is bumped to this_weekend', () => {
    expect(offerWith('주말에 부모님 댁에 다녀왔다', 'tomorrow_morning').when).toBe('this_weekend');
    expect(offerWith('이번 주 안에 답장을 보냈다', 'tomorrow_morning').when).toBe('this_weekend');
    expect(offerWith('다음 주까지는 결정을 내렸다', 'tomorrow_morning').when).toBe('this_weekend');
    expect(offerWith('I visited my parents this weekend', 'tomorrow_morning').when).toBe('this_weekend');
  });

  it('a claim without a later timeframe keeps tomorrow_morning', () => {
    expect(offerWith('케이크 자르고 나오면 내일 안 피곤하다', 'tomorrow_morning').when).toBe('tomorrow_morning');
  });

  it('a tomorrow-EVENING claim pulled to tomorrow morning is bumped past the event (R3 capture)', () => {
    const r3 = offerWith('내일 회식 빠지고 컨디션 챙기기로 했다', 'tomorrow_morning');
    expect(r3.when).toBe('in_days');
    expect(r3.days).toBe(2);
    expect(offerWith('내일 저녁 약속을 지켰다', 'tomorrow_morning').when).toBe('in_days');
    expect(offerWith('I kept tomorrow night free', 'tomorrow_morning').when).toBe('in_days');
    // 내일 without an evening marker is answerable tomorrow morning — untouched
    expect(offerWith('내일 일찍 일어났다', 'tomorrow_morning').when).toBe('tomorrow_morning');
  });

  it('an explicit non-tomorrow slot is never touched (the nudge only fixes the impossible case)', () => {
    expect(offerWith('주말에 부모님 댁에 다녀왔다', 'this_weekend').when).toBe('this_weekend');
    expect(offerWith('주말에 부모님 댁에 다녀왔다', 'tonight').when).toBe('tonight');
    const inDays = coerceLightTurn(
      { mirror: 'm.', action: 'offer', offer: { sentence: '주말에 다녀왔다', when: 'in_days', days: 5 } },
      1,
    ).offer!;
    expect(inDays.when).toBe('in_days');
    expect(inDays.days).toBe(5);
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

describe('firstThoughtFromQas — the first answer IS the first thought (첫 생각)', () => {
  it('tags the first answer, verbatim and trimmed', () => {
    expect(firstThoughtFromQas([
      { question: '지금 마음은 어느 쪽에 가 있어요?', answer: ' 남고 싶은데 내일이 걱정돼요 ' },
      { question: 'q2', answer: 'a2' },
    ])).toBe('남고 싶은데 내일이 걱정돼요');
  });

  it('is absent when nothing was answered (skipping loses nothing)', () => {
    expect(firstThoughtFromQas([])).toBeUndefined();
    expect(firstThoughtFromQas([{ question: 'q', answer: '   ' }])).toBeUndefined();
  });
});

describe('buildLightSealContract — 첫 생각 rides the EXISTING baseline_judgment slot', () => {
  const now = new Date(2026, 6, 28, 10, 0, 0, 0).getTime();
  const input = {
    sentence: '케이크 자르고 나오면 내일 안 피곤하다',
    edited: false as const,
    when: 'tomorrow_morning' as const,
    problemText: '파티에서 지금 나올까',
  };

  it('with a first thought: judgment_receipt reuses baseline_judgment (no new field)', () => {
    const c = buildLightSealContract('p1', { ...input, firstThought: '남고 싶은데 내일이 걱정돼요' }, now)!;
    const receipt = c.judgment_receipt!;
    expect(receipt.baseline_judgment).toBe('남고 싶은데 내일이 걱정돼요');
    // the sealed line mirrors into human_judgment so the return reads
    // 처음 생각 → 남긴 판단 → 현실 through the existing receipt renderer
    expect(receipt.human_judgment).toBe(input.sentence);
    expect(receipt.judgment_attribution).toEqual(c.predicates[0].attribution);
    // review-derived fields stay honestly EMPTY — never fabricated
    expect(receipt.real_question).toBe('');
    expect(receipt.unverified_assumption).toBe('');
    expect(receipt.human_only).toBe('');
    // the first thought is NEVER a scored predicate (baseline is deliberately unscored)
    expect(c.predicates).toHaveLength(1);
    expect(c.predicates[0].text).toBe(input.sentence);
    expect(contractPhase(c, now)).toBe('sealed');
  });

  it('without a first thought the contract shape is unchanged (no receipt)', () => {
    const c = buildLightSealContract('p1', input, now)!;
    expect(c.judgment_receipt).toBeUndefined();
  });

  it('a whitespace first thought is treated as absent, never sealed as an empty baseline', () => {
    const c = buildLightSealContract('p1', { ...input, firstThought: '   ' }, now)!;
    expect(c.judgment_receipt).toBeUndefined();
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
