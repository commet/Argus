import { describe, it, expect } from 'vitest';
import {
  isBaselineOnlyContract,
  contractPhase,
  summarizeGrades,
  aiSurfacedCheckedCount,
  buildEarlyContract,
  webUserAttribution,
  webAiAttribution,
} from '../decision-contract';
import type { DecisionContract, Predicate } from '@/stores/types';

/**
 * Regression home for the 2026-07-25 harbor regression.
 *
 * `closed_at` is a CEREMONY stamp written by exactly one path (SealMoment's
 * closing seal). Gating the "pre-review baseline" screen on its absence demoted
 * every other genuinely sealed record — the harbor card's own seal button,
 * RetroSeal, Telegram, and everything written before the field existed — into an
 * unfinished baseline WITH a destructive clear button and NO settlement route.
 *
 * These tests pin the lifecycle question to `contractPhase`, and they are written
 * as "what makes this red": each case is a record a user really owns.
 */

const NOW = Date.parse('2026-07-28T00:00:00.000Z');

function contract(over: Partial<DecisionContract> = {}): DecisionContract {
  return {
    id: 'c1',
    project_id: 'p1',
    predicates: [],
    created_at: '2026-07-01T00:00:00.000Z',
    ...over,
  };
}

const baselinePredicate = (text = '지금은 연기하는 쪽'): Predicate => ({
  id: 'pred_base',
  text,
  source: 'user_lean',
  authored: 'user',
  attribution: webUserAttribution(NOW, 'workspace:pre_review_baseline'),
});

const aiPredicate = (over: Partial<Predicate> = {}): Predicate => ({
  id: 'pred_ai',
  text: '경쟁사가 먼저 낼 수 있다',
  source: 'risk',
  authored: 'ai_surfaced',
  attribution: webAiAttribution(NOW, 'workspace:simulated_review'),
  ...over,
});

describe('isBaselineOnlyContract — only a true pre-review rope is a baseline', () => {
  it('the opening BIND rope (lean + date, nothing else) IS a baseline', () => {
    const early = buildEarlyContract('p1', { lean: '연기 쪽', interval: '1w' }, NOW)!;
    expect(isBaselineOnlyContract(early)).toBe(true);
    expect(contractPhase(early, NOW)).toBe('baseline');
  });

  it('a date-only rope with no line is still a baseline', () => {
    const early = buildEarlyContract('p1', { interval: '1w' }, NOW)!;
    expect(isBaselineOnlyContract(early)).toBe(true);
  });

  // ── each of these was misread as "baseline" by the closed_at gate ──

  it('RetroSeal (origin:retro, no closed_at) is NOT a baseline', () => {
    const c = contract({ origin: 'retro', predicates: [baselinePredicate()] });
    expect(isBaselineOnlyContract(c)).toBe(false);
    expect(contractPhase(c, NOW)).toBe('sealed');
  });

  it('the harbor card seal (AI-extracted predicates, no closed_at) is NOT a baseline', () => {
    const c = contract({ predicates: [aiPredicate()], check_in_at: '2026-08-10T00:00:00.000Z' });
    expect(isBaselineOnlyContract(c)).toBe(false);
  });

  it('a settled record with no closed_at is NOT a baseline', () => {
    const c = contract({
      predicates: [{ ...baselinePredicate(), verdict: 'happened', graded_at: '2026-07-20T00:00:00.000Z' }],
      graded_at: '2026-07-20T00:00:00.000Z',
    });
    expect(isBaselineOnlyContract(c)).toBe(false);
    expect(contractPhase(c, NOW)).toBe('settled');
  });

  it('a confirmed closing judgment in the receipt is NOT a baseline', () => {
    const c = contract({
      predicates: [baselinePredicate()],
      judgment_receipt: {
        real_question: 'q', unverified_assumption: '', human_only: '',
        baseline_judgment: '연기 쪽', human_judgment: '그래도 이번 주에 낸다',
      },
    });
    expect(isBaselineOnlyContract(c)).toBe(false);
  });

  it('a first-settlement lean already recorded is NOT a baseline', () => {
    const c = contract({
      predicates: [baselinePredicate()],
      lean_after: { view: 'better', recorded_at: '2026-07-20T00:00:00.000Z' },
    });
    expect(isBaselineOnlyContract(c)).toBe(false);
  });

  it('the closing ceremony stamp still means sealed (backwards compatible)', () => {
    const c = contract({ predicates: [baselinePredicate()], closed_at: '2026-07-20T00:00:00.000Z' });
    expect(isBaselineOnlyContract(c)).toBe(false);
    expect(contractPhase(c, NOW)).toBe('sealed');
  });

  it('never fabricates a seal from absence — an empty rope stays a baseline', () => {
    expect(isBaselineOnlyContract(contract())).toBe(true);
  });
});

describe('summarizeGrades — the record carries its losses, not only its wins', () => {
  const settled = (preds: Predicate[]) => summarizeGrades(contract({ predicates: preds }));

  it("an AI-surfaced risk that HAPPENED is counted, not dropped", () => {
    const g = settled([aiPredicate({ verdict: 'happened', graded_at: 'x' })]);
    // Before: neither risksHappened nor any AI counter moved — the bad outcome
    // vanished from the record entirely while good ones were kept.
    expect(g.risksHappenedAiDrafted).toBe(1);
    expect(g.risksHappened).toBe(0); // still not the user's own skill line
    expect(aiSurfacedCheckedCount(g)).toBe(1);
  });

  it('an AI-surfaced governing bet that BROKE is counted, not dropped', () => {
    const g = settled([
      aiPredicate({ id: 'g1', source: 'governing_idea', verdict: 'avoided', graded_at: 'x' }),
    ]);
    expect(g.betsBrokeAiDrafted).toBe(1);
    expect(g.betsBroke).toBe(0);
    expect(aiSurfacedCheckedCount(g)).toBe(1);
  });

  it('the AI disclosure count is wins AND losses, never wins alone', () => {
    const g = settled([
      aiPredicate({ id: 'r1', verdict: 'avoided', graded_at: 'x' }),
      aiPredicate({ id: 'r2', verdict: 'happened', graded_at: 'x' }),
      aiPredicate({ id: 'g1', source: 'governing_idea', verdict: 'happened', graded_at: 'x' }),
      aiPredicate({ id: 'g2', source: 'governing_idea', verdict: 'avoided', graded_at: 'x' }),
    ]);
    expect(aiSurfacedCheckedCount(g)).toBe(4);
    // and none of it leaks into the user's own columns
    expect(g.betsHeld + g.betsBroke + g.risksAvoided + g.risksHappened).toBe(0);
  });

  it("the user's own broken bet still counts as theirs", () => {
    const g = settled([{ ...baselinePredicate(), verdict: 'avoided', graded_at: 'x' }]);
    expect(g.betsBroke).toBe(1);
    expect(g.betsBrokeAiDrafted).toBe(0);
  });
});
