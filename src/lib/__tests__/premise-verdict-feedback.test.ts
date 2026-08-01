/**
 * The gate's verdict was being computed and thrown away.
 *
 * Every proposal gets a precise machine reason on the way in — "this repeats
 * its own anchor", "this attributes a weighting the quote does not carry" — and
 * the model never saw any of it. So it made the same move again on the next
 * round, correctly, from where it was standing: nothing had told it otherwise.
 * Measured in the 2026-08-02 run, heavy-01 offered a verbatim copy of the
 * user's answer as a premise on round 2, one round after the identical thing.
 *
 * This is the deterministic half of the loop reporting to the probabilistic
 * half, which is the only half that can act on it.
 */
import { describe, expect, it } from 'vitest';
import {
  coercePremiseCandidates,
  verdictInstruction,
  verdictsWorthTelling,
} from '../judgment-state-contract';
import { buildDeepeningJudgmentPrompt } from '../judgment-harness-v2';
import type { AnalysisSnapshot } from '@/stores/types';

const CORPUS = '전세 만기가 4개월 남았는데 매매로 갈아탈까 고민이에요. '
  + '집주인이 전세금을 올려달라고 할 것 같기도 하고요.';

const restatement = {
  text: '전세 만기가 4개월 남았다',
  anchor_quote: '전세 만기가 4개월 남았는데',
  support_kind: 'explicit_condition',
  if_false_changes: '시점이 달라진다',
  kind: 'premise',
};

describe('only the surprising outcomes are worth a line', () => {
  it('says nothing when the proposal was taken as offered', () => {
    const { audit } = coercePremiseCandidates([{
      text: '집주인이 전세금을 올려달라고 할 것이다',
      anchor_quote: '집주인이 전세금을 올려달라고 할 것 같기도 하고요',
      support_kind: 'explicit_expectation',
      if_false_changes: '전세 유지가 편해진다',
      kind: 'prediction',
      observable: '갱신 의사를 물었을 때 나오는 답',
    }], CORPUS);
    expect(verdictsWorthTelling(audit)).toEqual([]);
  });

  it('reports a demotion, with what it was called and what it became', () => {
    const { audit } = coercePremiseCandidates([restatement], CORPUS);
    expect(verdictsWorthTelling(audit)).toEqual([{
      text: '전세 만기가 4개월 남았다',
      declared: 'premise',
      recorded: 'fact',
      reason: 'restates_anchor_recorded_as_fact',
    }]);
  });

  it('reports a refusal with no recorded kind at all', () => {
    const { audit } = coercePremiseCandidates([{
      ...restatement,
      text: '만기 시점이 이 사람에게 가장 중요한 기준이다',
      kind: 'standard',
    }], CORPUS);
    const [verdict] = verdictsWorthTelling(audit);
    expect(verdict.recorded).toBeUndefined();
    expect(verdict.reason).toBe('standard_without_user_stance');
  });
});

describe('the line tells it what to do next, not what it did wrong', () => {
  it('turns a demotion into the next move', () => {
    const text = verdictInstruction('restates_anchor_recorded_as_fact');
    expect(text).toContain('what that fact makes possible or impossible');
    // And explicitly blesses the honest outcome, so the fix for "stop copying"
    // is never "invent something instead".
    expect(text).toContain('leaving it as a fact is the right outcome');
  });

  it('sends an unearned attribution back to the user as a question', () => {
    expect(verdictInstruction('standard_without_user_stance')).toContain('Ask them');
  });

  it('never leaves a reason unexplained', () => {
    // An unmapped reason still prints something, so a new contract rule can
    // never reach the model as a bare identifier.
    expect(verdictInstruction('some_future_reason')).toBe('some_future_reason');
  });
});

describe('it reaches the prompt', () => {
  const snapshot = {
    version: 1,
    real_question: '전세를 유지할지 매매로 갈아탈지 고민 중이에요.',
    hidden_assumptions: [],
    skeleton: [],
    premise_verdicts: [{
      text: '전세 만기가 4개월 남았다',
      declared: 'premise' as const,
      recorded: 'fact' as const,
      reason: 'restates_anchor_recorded_as_fact',
    }],
  } as unknown as AnalysisSnapshot;

  it('carries the quote, the demotion and the instruction into the next turn', () => {
    const { user } = buildDeepeningJudgmentPrompt(
      CORPUS, snapshot, [], 1, 3, 'ko',
    );
    expect(user).toContain('전세 만기가 4개월 남았다');
    expect(user).toContain('you called it premise');
    expect(user).toContain('recorded as fact');
    expect(user).toContain('what that fact makes possible or impossible');
  });

  it('stays silent when there is nothing to report', () => {
    const clean = { ...snapshot, premise_verdicts: [] } as AnalysisSnapshot;
    const { user } = buildDeepeningJudgmentPrompt(CORPUS, clean, [], 1, 3, 'ko');
    expect(user).not.toContain('WHAT HAPPENED TO YOUR LAST PROPOSALS');
  });

  it('does not break a session saved before verdicts existed', () => {
    const legacy = { ...snapshot } as Record<string, unknown>;
    delete legacy.premise_verdicts;
    const { user } = buildDeepeningJudgmentPrompt(
      CORPUS, legacy as AnalysisSnapshot, [], 1, 3, 'ko',
    );
    expect(user).not.toContain('WHAT HAPPENED TO YOUR LAST PROPOSALS');
  });
});
