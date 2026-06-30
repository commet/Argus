import { describe, it, expect } from 'vitest';
import { guardTransition, deriveState, GuardError } from '../state-machine.js';
import type { ContractEntry } from '../ledger-replay.js';

function entry(p: Partial<ContractEntry>): ContractEntry {
  return { id: 'x', status: 'candidate', text: '', amend_history: [], ...p };
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
    try { guardTransition('settled', 'seal'); } catch (e) { expect((e as GuardError).code).toBe('DECISION_CLOSED'); }
    try { guardTransition('dismissed', 'seal'); } catch (e) { expect((e as GuardError).code).toBe('DECISION_CLOSED'); }
  });

  it('refuses seal from sealed (re-seal must be amend)', () => {
    try { guardTransition('sealed', 'seal'); } catch (e) { expect((e as GuardError).code).toBe('ILLEGAL_TRANSITION'); }
  });
});
