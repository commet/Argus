/**
 * A Korean regex does not fire on English prose.
 *
 * Every guard in progressive-guards was written against a Korean transcript,
 * because every sim scenario that found a defect was Korean. Each grew an
 * English alternation afterwards — one or two clauses, added from imagination
 * rather than from a run, and never measured. So an unguarded English session
 * looks EXACTLY like a well-guarded one: same code path, same green tests, same
 * silence.
 *
 * That is the LLM-glue invariant pointed at our own guards. A guard that cannot
 * fire is indistinguishable from a guard that had nothing to catch.
 *
 * These are the same violations the Korean guards were built from, written the
 * way an English speaker would actually write them. They are not translations of
 * the Korean strings — a translation would only prove the regex can match the
 * shape someone had already thought of.
 *
 * The negative cases matter as much: a guard that eats ordinary analysis is
 * worse than one that misses, because it deletes the product's actual output.
 */
import { describe, expect, it } from 'vitest';
import {
  questionEchoesUser,
  questionManufacturesFork,
  stripConditionalReassurance,
  stripFrameSeizure,
  stripUnearnedRanking,
  stripWordChoiceReading,
} from '../progressive-guards';

describe('reading the user’s wording, in English', () => {
  const caught = [
    // The shape that was already covered, kept so a regression is visible.
    'The way you put it sounds like you already want out.',
    'Your phrasing suggests you have made up your mind.',
    // Everything below slipped through before this test existed.
    'The word "just" there is doing a lot of work.',
    'Calling it a break rather than quitting says something.',
    'You said "maybe", which reads as hesitation.',
    'That "or something" at the end sounds like exhaustion.',
    'You wrote "have to" instead of "want to", and that matters.',
    'Your tone here reads as resignation.',
    'How you framed it tells me you are leaning one way.',
    'The fact that you led with money is telling.',
  ];

  it.each(caught)('drops: %s', (sentence) => {
    expect(stripWordChoiceReading(sentence)).toBe('');
  });

  const kept = [
    'The offer is 40% above your current salary.',
    'You said the runway is 18 months, so the deadline is real.',
    'Two people on the team have already left this quarter.',
    'What happens to the project if you go is still unclear.',
    // Quoting the user back is not reading them. Provenance is the product.
    'You wrote that the deadline is next Friday.',
  ];

  it.each(kept)('keeps: %s', (sentence) => {
    expect(stripWordChoiceReading(sentence)).toBe(sentence);
  });
});

describe('taking the user’s frame, in English', () => {
  const caught = [
    'The real question is whether you trust the team.',
    'What you are actually deciding is when, not whether.',
    'It is not really about the money.',
    'You are not choosing between two jobs, you are choosing a decade.',
    'This is not a question about salary at all.',
    'The question is not whether to leave, it is what you would be leaving for.',
    'You think this is about the offer, but it is about the team.',
    'Underneath that question is a different one.',
    'The deeper issue here is trust.',
  ];

  it.each(caught)('drops: %s', (sentence) => {
    expect(stripFrameSeizure(sentence)).toBe('');
  });

  const kept = [
    'The offer expires on Friday, which is before the board meeting.',
    'It is not clear yet whether the funding closes.',
    'Your co-founder has not said what they would do.',
    // An ordinary factual correction is not a seizure of their frame.
    'The number in the letter is gross, not net.',
    'You said this is about the money, and the numbers below are about the money.',
  ];

  it.each(kept)('keeps: %s', (sentence) => {
    expect(stripFrameSeizure(sentence)).toBe(sentence);
  });
});

describe('manufactured forks, in English', () => {
  const user = 'I am thinking about quitting and travelling for a while.';

  it('drops a fork built from poles the user never wrote', () => {
    expect(questionManufacturesFork(
      'Is this about the money, or is it about burnout?', [], user,
    )).toBe(true);
  });

  it('allows a fork the user drew themselves', () => {
    expect(questionManufacturesFork(
      'Is it the travelling you want, or getting away from the job?',
      [],
      'I keep going back and forth between travelling and just getting away from the job.',
    )).toBe(false);
  });

  it('does not treat shared connective tissue as the user’s own words', () => {
    // "about", "think", "would" appear in any two English sentences. If they
    // counted, every manufactured fork would look like good listening.
    expect(questionEchoesUser(
      'Would you think about whether that is really the thing?', user,
    )).toBe(false);
  });

  it('recognises a genuine content word', () => {
    expect(questionEchoesUser('What would travelling actually give you?', user)).toBe(true);
  });
});

describe('unearned ranking, in English', () => {
  it('keeps the sentence when a ranking claim is the whole insight', () => {
    // stripUnearnedRanking deliberately falls back rather than returning empty:
    // a ranked sentence is still mostly about the decision. Pinned so the
    // difference from the other two strippers stays intentional.
    const only = 'The most important factor here is the salary.';
    expect(stripUnearnedRanking(only)).toBe(only);
  });

  const dropped = [
    'The most important factor here is the salary.',
    'The biggest concern is whether the team survives.',
    'What really matters most is the timing.',
    'The stability of that company weighs more than the 40% raise.',
  ];

  it.each(dropped)('drops when other analysis survives it: %s', (sentence) => {
    const mixed = `The offer expires Friday. ${sentence}`;
    expect(stripUnearnedRanking(mixed)).toBe('The offer expires Friday.');
  });

  const survives = [
    // Ranking risks in the WORLD is analysis. This guard is about ranking what
    // weighs on the PERSON, and eating the first would delete real output.
    'The biggest risk is that the funding round does not close.',
    // THEIR ranking, attributed. "AND WHEN THEY DO SAY IT, IT STANDS" — this
    // one was being deleted before these tests existed, which took the user's
    // own voice out of their own mirror.
    'You said the title matters more than the money.',
    'As you put it, the team matters more than the title.',
    '연봉보다 팀이 더 중요하다고 말씀하셨어요.',
    'Two factors are still unresolved.',
  ];

  it.each(survives)('leaves analysis alone: %s', (sentence) => {
    const mixed = `The offer expires Friday. ${sentence}`;
    expect(stripUnearnedRanking(mixed)).toBe(mixed);
  });
});

describe('conditional reassurance, in English', () => {
  // This guard had NO English clause at all — not a thin one, none. A guard
  // with no branch for a language cannot fail on it, which is how the gap
  // survived weeks of a green suite.
  const dropped = [
    'If the funding is not a concern, there is no real problem with waiting.',
    'As long as the deadline holds, you are fine to proceed.',
    'Assuming the team stays, nothing is standing in your way.',
    'Provided the offer is genuine, there is no downside to taking a week.',
  ];

  it.each(dropped)('drops: %s', (sentence) => {
    const mixed = `The offer expires Friday. ${sentence}`;
    expect(stripConditionalReassurance(mixed)).toBe('The offer expires Friday.');
  });

  const survives = [
    'If the funding does not close, the runway ends in March.',
    'As long as the deadline holds, the review lands before the board meeting.',
    'You have not said what happens if the team objects.',
  ];

  it.each(survives)('leaves the conditional alone: %s', (sentence) => {
    const mixed = `The offer expires Friday. ${sentence}`;
    expect(stripConditionalReassurance(mixed)).toBe(mixed);
  });
});
