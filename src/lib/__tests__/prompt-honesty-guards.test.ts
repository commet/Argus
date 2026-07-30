/**
 * Heavy-path prompt honesty guards (정직한 빈손 doctrine, 2026-07-31).
 *
 * Founder-approved rules this file pins:
 *  1. NO drama/count mandates — an honest empty/stable result beats a
 *     manufactured one. The deepening prompt must not demand DRAMATIC change or
 *     a NEW dimension per question; the mix must not demand a SURPRISING insight
 *     or fixed counts; reviews must not have numeric finding floors.
 *  2. The round-0 weight classification flows downstream as a LIVING estimate
 *     (현재 추정 — 명령이 아니라 갱신 대상).
 *  3. The engine never issues a verdict — decision_read is a neutral headline,
 *     never an imperative command.
 *  4. World-fact honesty binds every prompt that writes user-visible claims.
 */

import { describe, expect, it } from 'vitest';
import type { AnalysisSnapshot } from '@/stores/types';
import {
  buildDeepeningPrompt,
  buildExecutionPlanPrompt,
  buildInitialRefinementPrompt,
  buildMixPrompt,
  buildWorkerTaskPrompt,
} from '../progressive-prompts';
import { KOREAN_VOICE_RULES } from '../prompt-voice';

const snapshot = {
  version: 1,
  real_question: '무엇을 먼저 확인해야 할까?',
  insight: '',
  hidden_assumptions: ['가정 하나'],
  skeleton: ['먼저 확인한다'],
  stakes: 'routine',
  reversibility: 'reversible',
  request_type: 'open',
} as unknown as AnalysisSnapshot;

describe('FIX 1 — deepening prompt: honest stability, no drama mandates', () => {
  const { system, user } = buildDeepeningPrompt('문제', snapshot, [], 1, 3, 'ko');

  it('drops every drama/novelty mandate', () => {
    expect(system).not.toContain('DRAMATIC');
    expect(system).not.toContain('NEW dimension');
    expect(system).not.toContain('the question was pointless');
    expect(user).not.toContain('FEEL the plan getting sharper');
  });

  it('states honest stability as the headline rule', () => {
    expect(system).toContain('HONEST STABILITY IS THE HEADLINE RULE');
    expect(system).toContain('stability = trust');
  });

  it('injects the round-0 weight as a LIVING estimate (not a command)', () => {
    expect(system).toContain('현재 추정: routine / reversible / open');
    expect(system).toContain('명령이 아니라 갱신 대상');
  });

  it('scales ceremony down on routine+reversible and allows an early honest stop', () => {
    expect(system).toContain('stakes=routine AND reversibility=reversible');
    expect(system).toMatch(/ready_for_mix true/);
  });

  it('anchors questions to what the user actually said (no invented dimensions)', () => {
    expect(system).toContain('ANCHOR RULE');
    expect(system).toContain("never surface '술' from '파티'");
  });

  it('carries the no-verdict + everyday-leak + neutralize guards', () => {
    expect(system).toContain("NEVER decide the user's OPEN choice");
    expect(system).toContain('THE EVERYDAY LEAK');
    expect(system).toContain('NEUTRALIZE PATTERN');
  });

  it('falls back honestly when the round-0 weight is absent', () => {
    const bare = { ...snapshot, stakes: undefined, reversibility: undefined } as unknown as AnalysisSnapshot;
    const p = buildDeepeningPrompt('문제', bare, [], 1, 3, 'ko');
    expect(p.system).toContain('현재 추정: unknown / unknown / open');
  });
});

describe('FIX 2/11 — mix prompt: no manufactured content, no verdict headline', () => {
  const { system, user } = buildMixPrompt('문제', [snapshot], [], null, [], 'ko');

  it('drops the SURPRISING mandate and the fixed counts', () => {
    expect(system).not.toContain('SURPRISING');
    expect(system).not.toContain('exactly 3');
    expect(system).toContain('최대 3');
  });

  it('carries the world-fact honesty guard (the missing sleep-study guard)', () => {
    expect(system).toContain('WORLD-FACT HONESTY');
    expect(system).toContain('no laundered recall');
  });

  it('makes the risks section conditional on real risks', () => {
    expect(system).toContain('ONLY if real risks exist');
    expect(system).not.toContain('2-3 risks');
  });

  it('decision_read is a neutral headline, never an imperative pick', () => {
    expect(user).toContain('never a command');
    expect(user).toContain('NEVER an imperative');
    expect(user).not.toContain('NO hedging');
  });

  it('kills the borrowed-authority rigor theater (synthetic = zero support units)', () => {
    expect(system).not.toContain('sense of team rigor');
    expect(system).toContain('zero support units');
  });

  it('addresses the document to the user themselves when no decision-maker exists', () => {
    expect(system).toContain('USER THEMSELVES');
    expect(system).toContain('스스로 보는 정리');
    const withDM = buildMixPrompt('문제', [snapshot], [], '김CFO', [], 'ko').system;
    expect(withDM).toContain('presented to 김CFO');
    expect(withDM).not.toContain('USER THEMSELVES');
  });

  it('injects the shared Korean voice rules on the ko path only', () => {
    expect(system).toContain('보고서 톤, 번역투, AI 느낌 절대 금지');
    const en = buildMixPrompt('problem', [snapshot], [], null, [], 'en').system;
    expect(en).not.toContain(KOREAN_VOICE_RULES);
  });
});

describe('FIX 3 — initial refinement prompt is fully guarded', () => {
  const { system, user } = buildInitialRefinementPrompt('문제', '거부된 질문?', '방향이 달라요', 'ko');

  it('re-classifies before re-analyzing (a rejected question is not automatically OPEN)', () => {
    expect(system).toContain('STEP 0');
    expect(system).toContain('VENT');
    expect(system).toContain('VALIDATION');
    expect(system).toContain('FLAT');
    expect(user).toContain('request_type');
    expect(user).toContain('skeleton [] and next_question null');
  });

  it('carries the world-fact honesty and no-verdict guards + ko voice', () => {
    expect(system).toContain('WORLD-FACT HONESTY');
    expect(system).toContain("NEVER decide the user's OPEN choice");
    expect(system).toContain('해요체');
    expect(system).toContain(KOREAN_VOICE_RULES);
  });
});

describe('FIX 4 — worker prompt: facts only from provided material', () => {
  const ctx = { problemText: '문제', realQuestion: '질문?', skeleton: [], hiddenAssumptions: [], qaHistory: [] };
  const { system, user } = buildWorkerTaskPrompt('일', '산출물', 'ai', ctx, undefined, 'junior', undefined, undefined, undefined, 'ko');

  it('replaces the unguarded specificity mandate with the honesty-bounded version', () => {
    expect(user).not.toContain('Use specific numbers, names, and facts — not generic statements.');
    expect(user).toContain('ONLY where the provided material');
    expect(system).toContain('WORLD-FACT HONESTY');
  });

  it('injects the shared Korean voice rules on the ko path only', () => {
    expect(system).toContain(KOREAN_VOICE_RULES);
    const en = buildWorkerTaskPrompt('t', 'o', 'ai', ctx, undefined, 'junior', undefined, undefined, undefined, 'en');
    expect(en.system).not.toContain(KOREAN_VOICE_RULES);
  });
});

describe('FIX 5 — execution plan receives the measured weight', () => {
  const analysis = { real_question: 'q?', hidden_assumptions: [], skeleton: ['s'] };

  it('feeds measured stakes/reversibility into the crew-restraint clause', () => {
    const { system } = buildExecutionPlanPrompt('p', analysis, [], 1, undefined, 'ko', undefined, undefined,
      { stakes: 'routine', reversibility: 'reversible' });
    expect(system).toContain('MEASURED WEIGHT');
    expect(system).toContain('stakes=routine, reversibility=reversible');
    expect(system).toContain('SINGLE "ai" step is the MAXIMUM');
  });

  it('does not fabricate a weight block when no measurement exists', () => {
    const { system } = buildExecutionPlanPrompt('p', analysis, [], 1, undefined, 'ko');
    expect(system).not.toContain('MEASURED WEIGHT');
  });

  it('an important decision gets the weight but not the single-step cap', () => {
    const { system } = buildExecutionPlanPrompt('p', analysis, [], 1, undefined, 'ko', undefined, undefined,
      { stakes: 'important', reversibility: 'partial' });
    expect(system).toContain('stakes=important, reversibility=partial');
    expect(system).not.toContain('SINGLE "ai" step is the MAXIMUM');
  });
});
