/**
 * Collecting without using is just note-taking.
 *
 * Every premise had to earn its way in — quote the user, say what changes if it
 * is false — and then nothing ever asked about it again. The return screen read
 * one sentence (`sealed_statement`) and stopped, so `Predicate.verdict` stayed
 * `pending` forever and the track record (held / broke / avoided) could only
 * ever report zeros. These tests pin the wiring that closes that loop.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { gradePredicate } from '@/lib/decision-contract';
import type { DecisionContract } from '@/stores/types';

const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8');
const settlement = read('src/components/projects/FoundationSettlementModal.tsx');
const flow = read('src/components/workspace/progressive/ProgressiveFlow.tsx');
const engine = read('src/lib/progressive-engine.ts');

describe('the return surface asks about what was collected', () => {
  it('renders the premises the decision rested on, not only the sealed sentence', () => {
    expect(settlement).toContain('PremiseReturn');
    expect(settlement).toContain('그때 이게 맞다고 보고 결정하셨어요');
    expect(settlement).toContain('gradePredicate');
  });

  it('lets an answer be skipped — a return is complete without grading', () => {
    expect(settlement).toContain('안 고르셔도 돼요');
  });

  it('grading records the verdict and the time, and clears any stale basis', () => {
    const contract = {
      predicates: [
        { id: 'p1', text: '18개월 안에 다음 라운드가 온다', source: 'governing_idea', basis: 'luck' },
        { id: 'p2', text: '승진은 문서로 확정된다', source: 'governing_idea' },
      ],
    } as unknown as DecisionContract;
    const graded = gradePredicate(contract, 'p1', 'missed', 1_800_000_000_000);
    expect(graded.predicates[0].verdict).toBe('missed');
    expect(graded.predicates[0].graded_at).toBeTruthy();
    expect(graded.predicates[0].basis).toBeUndefined();
    expect(graded.predicates[1].verdict).toBeUndefined(); // untouched
  });
});

describe('the workspace can actually answer on the day it announces a return', () => {
  it('passes an onCheckNow so the record card can show its CTA', () => {
    expect(flow).toContain('onCheckNow={() => setSettleOpen(true)}');
    expect(flow).toContain('<SettlementModal');
  });
});

describe('what gets sealed is what the living state decided', () => {
  it('the final rewrite cannot repopulate assumptions or steps', () => {
    // extractPredicatesFromSession prefers final_mix, so anything invented in
    // the finalizer becomes a sealed predicate.
    expect(engine).not.toContain('result.key_assumptions || mix.key_assumptions');
    expect(engine).not.toContain('result.next_steps || mix.next_steps');
  });

  it('decision weight survives every round, so the seal ceremony stays proportional', () => {
    const deepening = engine.slice(engine.indexOf('export async function runDeepening'));
    const snapshot = deepening.slice(deepening.indexOf('const snapshot: AnalysisSnapshot'));
    expect(snapshot).toContain('stakes: currentSnapshot.stakes');
    expect(snapshot).toContain('reversibility: currentSnapshot.reversibility');
  });
});
