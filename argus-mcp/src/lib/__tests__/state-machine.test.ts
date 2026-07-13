import { describe, it, expect } from 'vitest';
import { guardTransition, deriveState, GuardError } from '../state-machine.js';
import type { DecisionState, LedgerEventType } from '../state-machine.js';
import type { ContractEntry } from '../ledger-replay.js';

function entry(p: Partial<ContractEntry>): ContractEntry {
  return { id: 'x', status: 'candidate', text: '', amend_history: [], ...p };
}

/** Assert the transition throws a GuardError with `code` — never a silent pass. */
function expectGuard(state: DecisionState, event: LedgerEventType, code: string): void {
  let caught: unknown;
  try { guardTransition(state, event); } catch (e) { caught = e; }
  expect(caught, `${event} from ${state} should throw ${code}`).toBeInstanceOf(GuardError);
  expect((caught as GuardError).code).toBe(code);
}

describe('deriveState', () => {
  it('maps statuses and derives due from check_by', () => {
    expect(deriveState(undefined, '2026-07-01')).toBe('absent');
    expect(deriveState(entry({ status: 'candidate' }), '2026-07-01')).toBe('opened');
    expect(deriveState(entry({ status: 'sealed', check_by: '2026-12-01' }), '2026-07-01')).toBe('sealed');
    expect(deriveState(entry({ status: 'sealed', check_by: '2026-06-01' }), '2026-07-01')).toBe('due');
    expect(deriveState(entry({ status: 'settled' }), '2026-07-01')).toBe('settled');
    expect(deriveState(entry({ status: 'dismissed' }), '2026-07-01')).toBe('dismissed');
  });
});

describe('premise-on-absent does not dead-end (orphaned-premise trap fix)', () => {
  it('refuses premise_add from absent but recovery points at the working seal-first path', () => {
    try {
      guardTransition('absent', 'premise_add');
      throw new Error('should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(GuardError);
      const g = e as GuardError;
      expect(g.code).toBe('ILLEGAL_TRANSITION');
      // Must NOT dead-end at "open first" (re-opening a restraint decision just
      // returns restraint again); it must name the public save path, which self-creates.
      expect(g.recovery).toMatch(/argus_save_prediction/);
    }
  });

  it('premise_add is allowed from sealed (the path the recovery hint sends you down)', () => {
    expect(() => guardTransition('sealed', 'premise_add')).not.toThrow();
  });
});

describe('guardTransition', () => {
  it('refuses settle without a prior seal', () => {
    expect(() => guardTransition('opened', 'settle')).toThrow(GuardError);
    try { guardTransition('opened', 'settle'); } catch (e) { expect((e as GuardError).code).toBe('NO_PRIOR_SEAL'); }
  });

  it('allows settle from sealed and due', () => {
    expect(() => guardTransition('sealed', 'settle')).not.toThrow();
    expect(() => guardTransition('due', 'settle')).not.toThrow();
  });

  it('refuses re-settling', () => {
    try { guardTransition('settled', 'settle'); } catch (e) { expect((e as GuardError).code).toBe('ALREADY_SETTLED'); }
  });

  it('blocks amend once due (goalpost guard)', () => {
    try { guardTransition('due', 'amend'); } catch (e) { expect((e as GuardError).code).toBe('GOALPOST_MOVED'); }
  });

  it('refuses any event on a terminal decision', () => {
    try {
      guardTransition('settled', 'amend');
    } catch (e) {
      expect((e as GuardError).code).toBe('DECISION_CLOSED');
      expect((e as GuardError).message).toContain('an amend');
      expect((e as GuardError).message).not.toContain('a amend');
    }
    try { guardTransition('dismissed', 'seal'); } catch (e) { expect((e as GuardError).code).toBe('DECISION_CLOSED'); }
  });

  it('refuses seal from sealed (re-seal must be amend)', () => {
    try { guardTransition('sealed', 'seal'); } catch (e) { expect((e as GuardError).code).toBe('ILLEGAL_TRANSITION'); }
  });

  it('allows defer once due (still_pending re-arm) but not before, and never on a terminal', () => {
    // due → defer OK: the outcome is genuinely unknown, so this is NOT a goalpost move.
    expect(() => guardTransition('due', 'defer')).not.toThrow();
    // The negatives ASSERT the throw first — a bare try/catch passes silently
    // when nothing is thrown (the catch never runs), so it would not catch a
    // regression that made the guard permissive.
    // sealed (not yet due) → defer refused: still_pending before the check-by is PREMATURE upstream.
    expectGuard('sealed', 'defer', 'ILLEGAL_TRANSITION');
    // terminal states never re-open.
    expectGuard('settled', 'defer', 'DECISION_CLOSED');
    expectGuard('dismissed', 'defer', 'DECISION_CLOSED');
  });

  it('defer on an unknown id names the id — it does NOT point at argus_amend, which also fails there', () => {
    let caught: unknown;
    try { guardTransition('absent', 'defer'); } catch (e) { caught = e; }
    expect(caught).toBeInstanceOf(GuardError);
    expect((caught as GuardError).recovery).not.toMatch(/argus_amend/);
    expect((caught as GuardError).recovery).toMatch(/argus_clarify_decision|argus_save_prediction/);
    // but from `sealed` (a real decision), "amend moves it" is the right advice.
    let s: unknown;
    try { guardTransition('sealed', 'defer'); } catch (e) { s = e; }
    expect((s as GuardError).recovery).toMatch(/argus_clarify_decision/);
  });
});
