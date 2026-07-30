/**
 * Sim-campaign heavy-path prompt repairs (scripts/sim/REPORT.md, 2026-07-31).
 *
 * Each pin carries the sim finding it kills:
 *  F1② heavy-09: crisis output shipped with ZERO resources → the resource must
 *      live inside the insight text (code append stays the floor).
 *  F3  heavy-07: "사규 제한이 없다면 진행에 걸림돌은 없지만" (condition-framed
 *      reassurance) + "이 결정이 맞는 건지 확인하고 싶으세요?" (answer-knowing
 *      counter-ask) → the check stands alone, no re-question.
 *  F4② light-09: the engine classified stakes=routine/reversibility=reversible
 *      and STILL ran the full ritual — the ceremony-follows-weight rule existed
 *      only in the deepening prompt, not the initial one.
 *  F5  light-09: "실제로 등록 지속률 차이가 크거든요" — plausible social
 *      statistics were leaking through a guard whose examples were all
 *      prices/regulations.
 *  F8  light-06: a one-line problem got a 5-step plan in the first response
 *      while framing was admittedly unclear → volume follows confidence.
 *  F12 heavy-01: "지금 회사 카운터오퍼 쪽이 더 맞는 방향일 수 있어요" inside a
 *      tap option — a verdict collected by a tap.
 *  F14 heavy-05: "밑 빠진 독에 물 붓는" — a doomed metaphor convicting one side
 *      of a conflict while shaped as a question.
 */

import { describe, expect, it } from 'vitest';
import type { AnalysisSnapshot } from '@/stores/types';
import {
  buildInitialAnalysisPrompt,
  buildDeepeningPrompt,
  buildInitialRefinementPrompt,
} from '../progressive-prompts';

const snapshot = {
  version: 1,
  real_question: '무엇을 먼저 확인해야 할까?',
  insight: '',
  hidden_assumptions: ['가정 하나'],
  skeleton: ['먼저 확인한다'],
  stakes: 'important',
  reversibility: 'partial',
  request_type: 'open',
} as unknown as AnalysisSnapshot;

const initial = buildInitialAnalysisPrompt('테스트 문제', 'ko');
const deepening = buildDeepeningPrompt('테스트 문제', snapshot, [], 1, 3, 'ko');
const refinement = buildInitialRefinementPrompt('테스트 문제', '반려된 질문', '반려 이유', 'ko');

describe('F1② — the crisis resource lives INSIDE the insight (prompt line; code append stays the floor)', () => {
  it('GATE A demands a concrete reachable resource in the insight text', () => {
    expect(initial.system).toContain('THE RESOURCE LIVES INSIDE THE INSIGHT TEXT');
    expect(initial.system).toContain('자살예방상담 109(24시간)');
    expect(initial.system).toContain('no reachable resource is a FAILURE');
  });

  it('bans the unbacked world-promise comfort line the sim caught', () => {
    expect(initial.system).toContain('반드시 해결 가능한 경로가 있어요');
    expect(initial.system).toContain('fabricated world-fact, not a resource');
  });
});

describe('F3 — validation: the check stands alone', () => {
  it('bans the condition-framed reassurance with the sim quote as ✗', () => {
    expect(initial.system).toContain('THE CHECK STANDS ALONE');
    expect(initial.system).toContain('사규 제한이 없다면 진행에 걸림돌은 없지만');
    expect(initial.system).toContain('no "없다면/된다면 괜찮다" clause');
  });

  it('bans the answer-knowing counter-ask with the sim quote', () => {
    expect(initial.system).toContain('이 결정이 맞는 건지 확인하고 싶으세요?');
    expect(initial.system).toContain('RESTATES their decision as made');
  });

  it('the refinement route carries the short form of the same rule', () => {
    expect(refinement.system).toContain('The check stands alone');
    expect(refinement.system).toContain('없다면 걸림돌은 없지만');
  });
});

describe('F4② — ceremony follows weight in the FIRST response too', () => {
  it('the initial prompt now carries the routine+reversible reduction rule', () => {
    expect(initial.system).toContain('CEREMONY FOLLOWS WEIGHT');
    expect(initial.system).toContain('stakes=routine AND reversibility=reversible');
    expect(initial.system).toContain('skeleton at most 2 lines');
    expect(initial.system).toContain('skip the BREADTH sweeps');
  });

  it('names the self-contradiction the sim measured', () => {
    expect(initial.system).toContain('Self-classifying a decision as light and then running heavy ceremony on it is a self-contradiction');
  });
});

describe('F5 — world-fact guard covers plausible social/behavioral statistics', () => {
  it('initial prompt pins the 등록 지속률 fabrication as ✗', () => {
    expect(initial.system).toContain('SOCIAL/BEHAVIORAL statistics');
    expect(initial.system).toContain('집 앞이랑 먼 곳은 실제로 등록 지속률 차이가 크거든요');
  });

  it('the deepening prompt names the same class', () => {
    expect(deepening.system).toContain('behavioral/social statistics');
    expect(deepening.system).toContain('지속률·성공률');
  });
});

describe('F8 — skeleton volume follows framing confidence', () => {
  it('below-70 framing shrinks the skeleton to verification actions only', () => {
    expect(initial.system).toContain('VOLUME FOLLOWS CONFIDENCE');
    expect(initial.system).toContain('at most 2 lines, verification/clarification actions only');
    expect(initial.system).toContain('fabricated confidence');
  });
});

describe('F12 — options never carry a direction', () => {
  it('the deepening question rules pin the sim quote as a verdict-by-tap', () => {
    expect(deepening.system).toContain('OPTION NEUTRALITY');
    expect(deepening.system).toContain('지금 회사 카운터오퍼 쪽이 더 맞는 방향일 수 있어요');
    expect(deepening.system).toContain('a verdict collected by a tap');
  });
});

describe('F14 — no side-taking metaphors', () => {
  it('both prompt stages ban the doomed-metaphor framing with the sim quote', () => {
    for (const system of [initial.system, deepening.system]) {
      expect(system).toContain('METAPHOR GUARD');
      expect(system).toContain('밑 빠진 독에 물 붓는');
    }
  });

  it('a metaphor is allowed only when it mirrors the user\'s own words', () => {
    expect(initial.system).toContain('ONLY when the user used it first');
    expect(deepening.system).toContain('only when the user used it first');
  });
});
