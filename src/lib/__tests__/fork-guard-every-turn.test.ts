/**
 * The spine's hardest rule was enforced on turn 1 and nowhere else.
 *
 * CLAUDE.md is explicit: the firing form is "a bare neutral crux QUESTION,
 * never a directional statement, never a two-pole fork". The guard for it
 * existed and was wired only to `guardLowConfidenceOpeningQuestion`, which the
 * engine calls on the opening turn. Rounds 2, 3 and 4 emitted questions that
 * nothing checked.
 *
 * Driving the real local app on 2026-08-02 (scripts/sim/local-premise-eyes.mjs)
 * produced this on round 3, verbatim off the screen:
 *
 *   "그 두 분 얘기가, 다음 주 결정에 무게를 더하는 건가요?
 *    아니면 별개로 마음에 걸리는 부분인가요."
 *
 * Two poles, neither of which the user drew, offered as if the choice between
 * them were theirs. 4,492 tests were green.
 */
import { describe, expect, it } from 'vitest';
import { dropManufacturedFork, questionManufacturesFork } from '../progressive-guards';

const OPENER = '5명짜리 팀의 리더인데, 팀원 한 명이 6개월째 성과가 안 나요. '
  + '두 번 면담했고 개선 계획도 같이 잡았는데 변화가 없어요. '
  + '그 팀원은 작년에 저를 믿고 이직해서 온 사람이라 마음이 많이 무겁습니다.';
const ANSWERS = [
  '개선 계획은 문서로 남겼고, 두 번째 기한이 다음 주에 끝나요.',
  '다른 팀원 두 명이 이미 그 사람 몫까지 하고 있다고 힘들다는 얘기를 꺼냈어요.',
];
const CORPUS = [OPENER, ...ANSWERS].join('\n');

/** Off the screen, round 3, the run that found this. */
const SHIPPED = '그 두 분 얘기가, 다음 주 결정에 무게를 더하는 건가요? 아니면 별개로 마음에 걸리는 부분인가요.';

describe('the fork the live app shipped on round 3', () => {
  it('is recognised as manufactured', () => {
    expect(questionManufacturesFork(SHIPPED, undefined, CORPUS)).toBe(true);
  });

  it('does not get to be the question', () => {
    expect(dropManufacturedFork({ text: SHIPPED }, CORPUS)).toBeNull();
  });
});

describe('what it does NOT drop', () => {
  it('keeps a bare crux question', () => {
    const q = { text: '다음 주 기한이 끝났을 때, 어떤 결과면 마음이 정해질까요?' };
    expect(dropManufacturedFork(q, CORPUS)).toBe(q);
  });

  it('keeps a fork the USER drew', () => {
    // Their own either/or is theirs to be asked about. Refusing it would be the
    // mirror failure: restraint about a fork that already exists is just being
    // deaf.
    const corpus = '지금 회사에 남을지 아니면 스타트업 오퍼를 받을지 고민이에요.';
    const q = { text: '지금 회사에 남는 쪽인가요, 아니면 오퍼를 받는 쪽인가요?' };
    expect(dropManufacturedFork(q, corpus)).toBe(q);
  });

  it('sees a fork the user drew in a LATER ANSWER, not just the opener', () => {
    // Round 1's guard only ever saw the opening message. By round 3 the user
    // may have drawn the fork in an answer, and scoring against the opener
    // alone would throw away a question that is entirely about their words.
    const later = '한 달 더 지켜볼지 아니면 지금 정리할지 그게 고민이에요.';
    const q = { text: '한 달 더 지켜보는 쪽인가요, 아니면 지금 정리하는 쪽인가요?' };
    expect(dropManufacturedFork(q, OPENER)).toBeNull();
    expect(dropManufacturedFork(q, `${OPENER}\n${later}`)).toBe(q);
  });

  it('treats a missing question as nothing to guard', () => {
    expect(dropManufacturedFork(null, CORPUS)).toBeNull();
    expect(dropManufacturedFork({ text: '' }, CORPUS)).toBeNull();
  });
});

describe('the engine runs it on the deepening turn, not only the first', () => {
  it('filters both the model question and the typed upgrade', async () => {
    const { readFileSync } = await import('node:fs');
    const src = readFileSync('src/lib/progressive-engine.ts', 'utf8');
    const deepening = src.slice(src.indexOf('const nextQuestion = dropRepeatedQuestion'));
    // Both branches: the immediate question AND the typed upgrade that swaps in
    // ~5-10s later. Guarding only the first would let the fork arrive late.
    expect(deepening).toContain('dropManufacturedFork(legacyQuestion, userCorpus)');
    expect(deepening).toContain('dropManufacturedFork(t, userCorpus)');
    expect(deepening).toContain('dropManufacturedFork(typed, userCorpus)');
  });
});

describe('the pole gap, kept visible', () => {
  // The rule this SHOULD enforce is that every pole is the user's. It is not
  // enforced, and the comment in progressive-guards says why: no span length
  // separates "연봉이요" (theirs, 2 syllables) from "마음에" (generic, 2
  // syllables). This test asserts the CURRENT behaviour so the gap is visible
  // rather than assumed closed — if someone finds a real fix, this goes red and
  // that is the signal to delete it.
  it('still lets a one-sided fork through', () => {
    const said = '그냥 집에 있는 걸로 해결할까 싶기도 하고.';
    const q = '나가서 뭔가 먹고 싶으신 건지, 아니면 집에 있는 게 편하긴 한데 뭔가 마음에 걸려서인지.';
    expect(questionManufacturesFork(q, undefined, said)).toBe(false);
  });
});
