import { describe, it, expect } from 'vitest';
import {
  derivePrimaryCheckpoint,
  verdictFromTap,
  tapFromVerdict,
  nextAmbiguityHandle,
  checkpointExpectation,
} from '../checkpoint-core';
import { contractFromPredicates, withCheckIn, gradePredicate, isResolved } from '../decision-contract';
import type { Predicate, DecisionContract, AmbiguityRecord } from '@/stores/types';

/**
 * Checkpoint loop-contract (DESIGN-judgment-checkpoints-v2 §5): walk a contract
 * through the real functions — designate → settle-tap → verdict → round-trip →
 * unclear — so a broken wire between two stages is caught, not just each stage
 * in isolation. The UI-only wires (W3 due surfaces, W4 verbatim render) were
 * browser-verified; this pins the DATA wires (W1 seed→seal, W2 authorship, the
 * 4-tap→verdict→display round-trip, and the unclear→next-handle path).
 */

const NOW = Date.parse('2026-07-06T00:00:00Z');

function preds(): Predicate[] {
  return [
    { id: 'risk1', text: 'CFO가 비용에 반대한다', source: 'risk' },
    { id: 'gov1', text: '신제품이 분기 내 손익분기를 넘는다', source: 'governing_idea' },
  ];
}

describe('W1 — seal designation picks the governing bet + a date handle', () => {
  it('derivePrimaryCheckpoint points at the governing predicate with an auto-due date handle', () => {
    const base = withCheckIn(contractFromPredicates('projX', preds(), NOW)!, '2w', NOW);
    const cp = derivePrimaryCheckpoint(base);
    expect(cp).not.toBeNull();
    expect(cp!.predicate_id).toBe('gov1');            // governing bet over the risk
    expect(cp!.return_handle.kind).toBe('date');
    expect(cp!.return_handle.auto_due).toBe(true);
    expect(cp!.type).toBe('outcome');                 // date handle → outcome
    expect(cp!.expectation).toBe('occur');            // governing bet expects to hold
  });
});

describe('W2 — authorship: a carried seed wins, else ai_suggested', () => {
  it('a user-authored seed keeps its authorship through designation', () => {
    const base = withCheckIn(contractFromPredicates('projX', preds(), NOW)!, '2w', NOW);
    const cp = derivePrimaryCheckpoint(base, { authorship: 'user_authored', check_prompt: '이사회가 승인하나' });
    expect(cp!.authorship).toBe('user_authored');
    expect(cp!.check_prompt).toBe('이사회가 승인하나');
  });
});

describe('the settle-tap → verdict → grade → round-trip loop holds', () => {
  it("a '빗나갔다' tap stores 'missed' on the primary predicate and round-trips back to the tap", () => {
    let contract: DecisionContract = withCheckIn(contractFromPredicates('projX', preds(), NOW)!, '2w', NOW);
    const cp = derivePrimaryCheckpoint(contract)!;
    contract = { ...contract, primary_checkpoint: cp };

    // settle-tap → verdict (the CheckpointReturnCard path)
    const verdict = verdictFromTap('missed', cp.expectation);
    expect(verdict).toBe('missed');

    // grade the primary predicate through the REAL grader
    contract = gradePredicate(contract, cp.predicate_id, verdict, NOW);
    const graded = contract.predicates.find((p) => p.id === cp.predicate_id)!;
    expect(graded.verdict).toBe('missed');
    expect(isResolved(graded)).toBe(true);            // 'missed' resolves the predicate

    // W4 round-trip: the stored verdict displays back as the same tap
    expect(tapFromVerdict(graded.verdict!, checkpointExpectation(contract))).toBe('missed');
  });

  it("'대체로 맞았다' on a governing bet stores 'happened' and round-trips", () => {
    let contract: DecisionContract = withCheckIn(contractFromPredicates('projX', preds(), NOW)!, '2w', NOW);
    const cp = derivePrimaryCheckpoint(contract)!;
    contract = { ...contract, primary_checkpoint: cp };
    const verdict = verdictFromTap('mostly_right', cp.expectation);
    expect(verdict).toBe('happened');
    contract = gradePredicate(contract, cp.predicate_id, verdict, NOW);
    expect(tapFromVerdict('happened', cp.expectation)).toBe('mostly_right');
  });
});

describe('unclear is a handle, not a dead end (§7.3)', () => {
  it('nextAmbiguityHandle extends the prior date handle forward; an AmbiguityRecord carries the reason', () => {
    const contract = withCheckIn(contractFromPredicates('projX', preds(), NOW)!, '2w', NOW);
    const cp = derivePrimaryCheckpoint(contract)!;
    const today = '2026-07-06';
    const next = nextAmbiguityHandle(cp.return_handle, today);
    expect(next.kind).toBe('date');
    expect(next.value > today).toBe(true);            // moved forward, never a dead end
    const rec: AmbiguityRecord = { reason: 'mixed_signals', next_handle: next };
    expect(rec.next_handle!.value > today).toBe(true);
  });
});
