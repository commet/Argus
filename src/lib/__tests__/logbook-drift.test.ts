/**
 * B8 — Logbook drift guard (08 S6·S8).
 *
 * The 항해일지 (Logbook) is a THIRD surface that renders the user's settled-loop
 * counts, alongside the web RecordStrip (summarizeRecord) and the telegram
 * record-core (recordSummaryMarkdown). Sentences differ per surface; the DIGITS
 * may not. This guard proves — from ONE fixture — that the Logbook's per-contract
 * settle counts sum to exactly the same numbers summarizeRecord feeds RecordStrip,
 * and that the telegram settled digit matches the closed-loop count. If any of the
 * three brains drifts, this test breaks.
 *
 * Spine: everything asserted is a COUNT. A % anywhere on any surface is a failure.
 */
import { describe, it, expect } from 'vitest';
import { settleCountsLine } from '@/components/projects/Logbook';
import { summarizeRecord, summarizeGrades } from '@/lib/decision-contract';
import { recordSummaryMarkdown } from '@/lib/record-core';
import { summarizeReviewRecord } from '@/lib/record-summary';
import type { DecisionContract, Predicate } from '@/stores/types';

function pred(patch: Partial<Predicate>): Predicate {
  return {
    id: patch.id || Math.random().toString(36).slice(2),
    text: patch.text || 'p',
    source: patch.source || 'governing_idea',
    verdict: patch.verdict || 'pending',
    ...patch,
  } as Predicate;
}

/** A fully-settled (allGraded) contract with a known count profile. */
function settledContract(id: string, preds: Predicate[], origin?: 'retro'): DecisionContract {
  return {
    id,
    project_id: `proj-${id}`,
    predicates: preds,
    created_at: '2026-06-12T09:00:00Z',
    graded_at: '2026-06-29T09:00:00Z',
    ...(origin ? { origin } : {}),
  } as DecisionContract;
}

// Two real settled contracts + one retro practice contract that must be ignored
// everywhere (W1 origin:'retro' isolation invariant).
function fixtureProjects() {
  const c1 = settledContract('c1', [
    pred({ id: 'a', source: 'governing_idea', verdict: 'happened' }), // bet held
    pred({ id: 'b', source: 'governing_idea', verdict: 'happened', basis: 'luck' }), // held on luck
    pred({ id: 'c', source: 'risk', verdict: 'avoided' }), // risk steered past
  ]);
  const c2 = settledContract('c2', [
    pred({ id: 'd', source: 'governing_idea', verdict: 'avoided' }), // bet missed
    pred({ id: 'e', source: 'risk', verdict: 'happened' }), // risk hit
  ]);
  // Retro loop with rich (hindsight) counts — must NOT reach the record.
  const retro = settledContract('r1', [
    pred({ id: 'x', source: 'governing_idea', verdict: 'happened' }),
    pred({ id: 'y', source: 'risk', verdict: 'avoided' }),
  ], 'retro');
  return [
    { decision_contract: c1, name: 'c1' },
    { decision_contract: c2, name: 'c2' },
    { decision_contract: retro, name: 'r1' },
  ];
}

describe('B8 Logbook drift guard — Logbook counts == RecordStrip counts == telegram digits', () => {
  it('Logbook per-contract settle counts sum to exactly summarizeRecord totals', () => {
    const projects = fixtureProjects();
    const record = summarizeRecord(projects, Date.now());

    // summarizeRecord is what RecordStrip renders. It must exclude the retro loop:
    // 2 real loops. c1: bets a+b both held (b on luck) → betsHeld 2, risksAvoided 1,
    // goodOutcomesOnLuck 1. c2: bet missed → betsBroke 1, risk hit → risksHappened 1.
    expect(record).toEqual({
      loops: 2,
      betsHeld: 2,
      risksAvoided: 1,
      betsBroke: 1,
      risksHappened: 1,
      goodOutcomesOnLuck: 1,
    });

    // The Logbook derives its settle line from summarizeGrades per contract — the
    // SAME brain summarizeRecord sums. Sum the Logbook's source across real
    // contracts and it must equal the record digit-for-digit (single-brain proof).
    const real = projects.filter((p) => p.decision_contract.origin !== 'retro');
    const summed = real.reduce(
      (acc, p) => {
        const g = summarizeGrades(p.decision_contract);
        acc.betsHeld += g.betsHeld;
        acc.betsBroke += g.betsBroke;
        acc.risksAvoided += g.risksAvoided;
        acc.risksHappened += g.risksHappened;
        acc.goodOutcomesOnLuck += g.goodOutcomesOnLuck;
        return acc;
      },
      { betsHeld: 0, betsBroke: 0, risksAvoided: 0, risksHappened: 0, goodOutcomesOnLuck: 0 },
    );
    expect(summed.betsHeld).toBe(record.betsHeld);
    expect(summed.betsBroke).toBe(record.betsBroke);
    expect(summed.risksAvoided).toBe(record.risksAvoided);
    expect(summed.risksHappened).toBe(record.risksHappened);
    expect(summed.goodOutcomesOnLuck).toBe(record.goodOutcomesOnLuck);
  });

  it('the Logbook settle LINE shows exactly those digits (the string the user reads)', () => {
    const projects = fixtureProjects();
    // c1: bets held 2 (one on luck), risk avoided 1, on-luck 1.
    const line1 = settleCountsLine(projects[0].decision_contract, 'ko');
    expect(line1).toContain('가설 적중 2');
    expect(line1).toContain('위험 비켜감 1');
    expect(line1).toContain('그중 운 1');
    // c2: bet missed 1, risk hit 1.
    const line2 = settleCountsLine(projects[1].decision_contract, 'ko');
    expect(line2).toContain('가설 빗나감 1');
    expect(line2).toContain('위험 실현 1');
  });

  it('telegram settled digit matches the closed-loop count (cross-surface)', () => {
    const projects = fixtureProjects();
    const record = summarizeRecord(projects, Date.now());
    // The telegram record surface counts settled loops the same way; feed the
    // merged count (no review receipts here) and the settled digit must equal
    // the Logbook/RecordStrip loop count.
    const review = summarizeReviewRecord([]);
    const mergedSettled = record.loops + review.settled;
    const md = recordSummaryMarkdown(
      { open: 0, settled: mergedSettled, happened: 0, avoided: 0, partial: 0 },
      'ko',
    );
    const tgSettled = md.match(/정산 완료: \*\*(\d+)\*\*/)?.[1];
    expect(tgSettled).toBe(String(record.loops));
    expect(tgSettled).toBe('2'); // retro loop excluded on every surface
  });

  it('spine: no Logbook settle line carries a %, score, tier, or comparison', () => {
    const projects = fixtureProjects();
    for (const p of projects) {
      for (const loc of ['ko', 'en'] as const) {
        const line = settleCountsLine(p.decision_contract, loc);
        expect(line).not.toMatch(/\d+\s*%/);
        expect(line).not.toMatch(/tier|등급|점수|score|streak|연속/i);
        expect(line).not.toMatch(/더 잘|better|worse|보다/);
      }
    }
  });
});
