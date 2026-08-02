/**
 * The light path in English, measured rather than assumed.
 *
 * Every clamp here was written from a Korean production capture and then given
 * an English alternation from imagination. progressive-guards scored 3 of 19
 * that way (fixed 2026-08-03); these are the same shape of patterns guarding
 * the surface a first-time user actually meets.
 *
 * The stakes differ per function, and both directions hurt:
 *
 *   offerPicksUnstatedSide  under-fires ⇒ a decision the user never made is
 *                           sealed as their judgment and graded later
 *   STATED_DECISION         under-fires ⇒ the clamp above over-fires and eats a
 *                           legitimate offer from someone who HAD decided
 *   neutralizeUndecidedAsk  over-fires ⇒ the tailored last sentence of the
 *                           session is thrown away, which is the exact failure
 *                           the Korean version of this clamp was written to cure
 */
import { describe, expect, it } from 'vitest';
import {
  isInterrogativeSentence,
  neutralizeUndecidedAsk,
  offerPicksUnstatedSide,
  stripSuppliedLean,
} from '../light-engine';
import type { LightTurn } from '../light-types';

const UNDECIDED = ['I said I would think about it tonight.'];

describe('a sentence that picks a side the user never picked', () => {
  const picks = [
    'I stayed till the end and still made my early start.',
    'I went home before the second round.',
    'I ended up cancelling the trip.',
    'I turned down the offer and felt fine about it.',
    'I kept the apartment.',
    'I signed the lease on Saturday.',
    'I ordered the cheaper one.',
    'We booked the later flight.',
    'I said no and slept fine.',
  ];

  it.each(picks)('is refused: %s', (sentence) => {
    expect(offerPicksUnstatedSide(sentence, UNDECIDED)).toBe(true);
  });

  const honest = [
    // A claim about how it felt, not about which branch was taken.
    'Tomorrow morning I will know whether the early start was worth protecting.',
    'The tiredness is the part that decides this.',
    'Either way the meetup is over by ten.',
  ];

  it.each(honest)('is left alone: %s', (sentence) => {
    expect(offerPicksUnstatedSide(sentence, UNDECIDED)).toBe(false);
  });

  const decided = [
    'I am going to stay till the end.',
    'I have decided to leave early.',
    "I'm gonna skip it.",
    'I will take the offer.',
    'I am going with the cheaper one.',
  ];

  it.each(decided)('does not overrule someone who decided: %s', (userText) => {
    // They said which way they were going, so the sentence may say so too.
    // A miss here makes the clamp above eat a legitimate offer.
    expect(offerPicksUnstatedSide('I stayed till the end.', [userText])).toBe(false);
  });
});

describe('the last sentence of the session', () => {
  const turn = (ask: string): LightTurn => ({
    mirror: 'You are weighing the early start against the meetup.',
    offer: { sentence: 'The tiredness is what decides this.', when: 'tomorrow_morning', ask },
  } as LightTurn);

  const neutral = [
    'Can I ask how Saturday went?',
    'Mind if I check in tomorrow to see how the meetup turned out?',
    'Shall I ask you tomorrow morning what happened?',
    'Want me to come back tomorrow and ask how the morning felt?',
  ];

  it.each(neutral)('survives, because it presumes nothing: %s', (ask) => {
    // The Korean version of this clamp discarded the model's tailored ask in 5
    // of 5 sessions and five different people got the same subjectless
    // boilerplate. That was fixed for Korean. An English ask has to clear the
    // same bar: asking how it went is always fine.
    expect(neutralizeUndecidedAsk(turn(ask), 'I cannot decide about Saturday.', []).offer?.ask)
      .toBe(ask);
  });

  const presumes = [
    'Can I ask tomorrow how staying till the end worked out?',
    "Let's go with skipping it — shall I check tomorrow?",
    'So you left early — want me to ask how the morning went?',
  ];

  it.each(presumes)('is dropped, because it decides for them: %s', (ask) => {
    expect(neutralizeUndecidedAsk(turn(ask), 'I cannot decide about Saturday.', []).offer?.ask)
      .toBeUndefined();
  });
});

describe('a lean the user never expressed', () => {
  it('is removed when nothing in their words leans', () => {
    const mirror = 'You are leaning toward staying home. Either way it is over by ten.';
    expect(stripSuppliedLean(mirror, ['I cannot decide.']))
      .toBe('Either way it is over by ten.');
  });

  const theirOwnLean = [
    'Honestly I would rather stay home.',
    'I am tempted to just skip it.',
    'I feel like staying in.',
    'Part of me is inclined to go.',
  ];

  it.each(theirOwnLean)('is mirrored back when they said it: %s', (said) => {
    const mirror = 'You are leaning toward staying home.';
    expect(stripSuppliedLean(mirror, [said])).toBe(mirror);
  });
});

describe('a question cannot be sealed as a claim', () => {
  const questions = [
    'Was staying till the end worth it?',
    'Whether the early start was worth protecting.',
    'How much the tiredness actually cost.',
  ];

  it.each(questions)('is not gradeable: %s', (sentence) => {
    expect(isInterrogativeSentence(sentence)).toBe(true);
  });

  const claims = [
    'The early start was worth protecting.',
    'I will know by tomorrow morning whether the tiredness mattered.',
  ];

  it.each(claims)('is gradeable: %s', (sentence) => {
    expect(isInterrogativeSentence(sentence)).toBe(false);
  });
});
