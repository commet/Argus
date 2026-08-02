/**
 * A clamp that cannot fire in a language is not a clamp in that language.
 *
 * This is the ratchet for the defect found twice in one day and never before,
 * because nothing in this repo could see it.
 *
 * Every clamp on the judgment surfaces was written from a KOREAN production
 * capture — that is where the failures were measured — and then given an English
 * alternation, from imagination, never run. Measured 2026-08-03:
 *
 *   progressive-guards   caught 3 of 19 English violations; two of its four
 *                        clamps matched contractions only; one had no English
 *                        clause at all
 *   light-engine         19 of 34 English cases failed, including all four
 *                        neutral asks — the English session was still running
 *                        the bug the Korean session had already been cured of
 *
 * The mechanism is the LLM-glue invariant turned on our own defences. A regex
 * that cannot match is indistinguishable from a regex with nothing to match:
 * identical code path, identical green suite, identical silence. Weeks of CI
 * said nothing, because there was nothing for it to say.
 *
 * So the registry does not test the clamps — those have their own suites. It
 * asserts something narrower and unfakeable: each clamp DEMONSTRABLY FIRES in
 * both languages, and a new clamp cannot be added without either a pair of
 * fixtures or a written reason it needs none.
 *
 * The completeness check is the whole point. Without it this is a nicer place
 * to put tests; with it, the next bilingual clamp cannot ship half-built.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  questionManufacturesFork,
  stripConditionalReassurance,
  stripFrameSeizure,
  stripUnearnedRanking,
  stripWordChoiceReading,
} from '../progressive-guards';
import {
  isInterrogativeSentence,
  neutralizeUndecidedAsk,
  offerPicksUnstatedSide,
  stripSuppliedLean,
} from '../light-path/light-engine';
import type { LightTurn } from '../light-path/light-types';

const ROOT = process.cwd();

/**
 * One entry per language-dependent clamp. `ko` and `en` must each be a case the
 * clamp actually acts on — the assertion is that it FIRED, so a fixture that
 * quietly stopped matching fails here rather than passing as "no violation".
 */
const CLAMPS: Array<{
  name: string;
  fires: (input: string) => boolean;
  ko: string;
  en: string;
}> = [
  {
    name: 'stripWordChoiceReading',
    fires: (s) => stripWordChoiceReading(s) === '',
    ko: "'이나'가 붙은 거, 그냥 탈출하고 싶다는 말처럼 들려요.",
    en: 'Your tone here reads as resignation.',
  },
  {
    name: 'stripFrameSeizure',
    fires: (s) => stripFrameSeizure(s) === '',
    ko: "'내보낼지'를 고민하는 게 아니라, 다음 주 결과를 보고 판단하는 순서예요.",
    en: 'The real question is whether you trust the team.',
  },
  {
    name: 'stripUnearnedRanking',
    fires: (s) => stripUnearnedRanking(`앞 문장. ${s}`) === '앞 문장.',
    ko: '연봉 40% 차이보다 그쪽 회사의 지속 가능성이 더 걸리는 지점인 거죠.',
    en: 'The most important factor here is the salary.',
  },
  {
    name: 'stripConditionalReassurance',
    fires: (s) => stripConditionalReassurance(`앞 문장. ${s}`) === '앞 문장.',
    ko: '자금이 문제가 아니라면 지금 진행해도 돼요.',
    en: 'As long as the deadline holds, you are fine to proceed.',
  },
  {
    name: 'questionManufacturesFork',
    fires: (s) => questionManufacturesFork(s, [], '그냥 좀 지쳐서요'),
    ko: '돈이 문제인가요, 번아웃이 문제인가요?',
    en: 'Is this about the money, or is it about burnout?',
  },
  {
    name: 'offerPicksUnstatedSide',
    fires: (s) => offerPicksUnstatedSide(s, ['아직 못 정했어요']),
    // The Korean branch anchors on a decided verb at the END of the sentence,
    // so a fixture ending any other way silently proves nothing. That is the
    // failure this whole file exists to catch, and the first draft of this line
    // walked into it.
    ko: '고민 끝에 모임에는 끝까지 남았다.',
    en: 'I turned down the offer and felt fine about it.',
  },
  {
    name: 'isInterrogativeSentence',
    fires: (s) => isInterrogativeSentence(s),
    ko: '끝까지 남는 게 나았을까',
    en: 'Whether the early start was worth protecting.',
  },
  {
    name: 'stripSuppliedLean',
    fires: (s) => stripSuppliedLean(s, ['아직 못 정했어요']) === '',
    ko: '집에 있는 쪽으로 마음이 가시는 것 같아요.',
    en: 'You are leaning toward staying home.',
  },
  {
    name: 'neutralizeUndecidedAsk',
    fires: (ask) => {
      const turn = {
        mirror: 'm',
        offer: { sentence: '피곤함이 이걸 정한다', when: 'tomorrow_morning', ask },
      } as LightTurn;
      return neutralizeUndecidedAsk(turn, '아직 못 정했어요', []).offer?.ask === undefined;
    },
    ko: '그럼 토요일에 일찍 나오시는 걸로 하고 — 모임은 어떻게 하셨는지 물어볼까요?',
    en: 'So you left early — want me to ask how the morning went?',
  },
];

/**
 * Exported functions that are NOT language-dependent, with the reason. A clamp
 * belongs in CLAMPS; anything else belongs here, and saying which is the point
 * of the exercise.
 */
const NOT_LANGUAGE_DEPENDENT: Record<string, string> = {
  lowConfidenceOpeningCopy: 'produces copy per locale; it matches nothing',
  questionEchoesUser: 'branches on script and both branches are covered by its own suite',
  dropManufacturedFork: 'delegates to questionManufacturesFork, registered above',
  guardLowConfidenceOpeningQuestion: 'delegates to questionManufacturesFork and the copy builder',
  ensureCrisisResource: 'appends a per-locale resource line; no pattern',
  dropRepeatedQuestion: 'character-bigram similarity, script-independent by construction',
  capEscalationArrival: 'counts items; reads no text',
  scrubBannedVocabulary: 'vocabulary list is Korean-only by design (a brand-word sweep)',
  scrubList: 'maps scrubBannedVocabulary over an array',
  buildLightSystemPrompt: 'prompt builder',
  todayLine: 'date formatting',
  buildLightGateUserPrompt: 'prompt builder',
  buildLightNextUserPrompt: 'prompt builder',
  stripTrailingQuestion: 'keys on the question mark, which both languages share',
  limitQuestionMarks: 'counts question marks',
  stripOneLinePhrase: 'one fixed phrase per language, both in the pattern',
  clampLightDays: 'numeric clamp',
  coerceLightGate: 'shape coercion',
  coerceLightTurn: 'shape coercion; delegates to the clamps registered above',
  lightCheckBy: 'date arithmetic',
  lightWhenLabel: 'per-locale label lookup',
  firstThoughtFromQas: 'picks a stored string; no pattern',
  buildLightSealContract: 'assembles a contract; no pattern',
  composeDeepenText: 'joins stored strings',
};

function exportedFunctions(file: string): string[] {
  const src = readFileSync(join(ROOT, file), 'utf8');
  return [...src.matchAll(/^export function (\w+)/gm)].map((m) => m[1]);
}

describe('every language-dependent clamp fires in both languages', () => {
  it.each(CLAMPS)('$name fires on Korean', ({ fires, ko }) => {
    expect(fires(ko)).toBe(true);
  });

  it.each(CLAMPS)('$name fires on English', ({ fires, en }) => {
    // Before 2026-08-03 most of these were false, and nothing anywhere said so.
    expect(fires(en)).toBe(true);
  });

  it('every exported clamp is registered or explained', () => {
    const exported = [
      ...exportedFunctions('src/lib/progressive-guards.ts'),
      ...exportedFunctions('src/lib/light-path/light-engine.ts'),
    ];
    expect(exported.length).toBeGreaterThan(25);

    const registered = new Set(CLAMPS.map((c) => c.name));
    const unaccounted = exported.filter(
      (name) => !registered.has(name) && !NOT_LANGUAGE_DEPENDENT[name],
    );

    expect(
      unaccounted,
      'a new export on a judgment surface is neither registered as a bilingual '
      + 'clamp nor explained as language-independent. If it matches text, give it '
      + 'a Korean case AND an English case that both fire — an English branch '
      + 'written from imagination and never run is the defect this file exists '
      + `to end: ${unaccounted.join(', ')}`,
    ).toEqual([]);
  });

  it('every explanation still names an export that exists', () => {
    const exported = new Set([
      ...exportedFunctions('src/lib/progressive-guards.ts'),
      ...exportedFunctions('src/lib/light-path/light-engine.ts'),
    ]);
    const stale = [
      ...Object.keys(NOT_LANGUAGE_DEPENDENT),
      ...CLAMPS.map((c) => c.name),
    ].filter((name) => !exported.has(name));
    expect(stale, `entries for exports that no longer exist: ${stale.join(', ')}`).toEqual([]);
  });
});
