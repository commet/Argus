import { describe, it, expect } from 'vitest';
import {
  evaluateDrift,
  shouldFireAlert,
  isDueForRecheck,
  RECHECK_MIN_INTERVAL_DAYS,
} from '../premise-drift';
import { createItem, setAlertMode, registerDismissal, type DecisionItem } from '../decision-items';

const T0 = Date.parse('2026-07-01T00:00:00Z');
const D = 86_400_000;

function premise(): DecisionItem {
  // load-bearing external premise → defaults to on_change
  return createItem(
    { decision_id: 'd', type: 'premise', text: 'rates flat', source: 'ai', external: true, load_bearing: true },
    T0,
  );
}

describe('evaluateDrift', () => {
  it('first check with no baseline → baseline_only, never drift', () => {
    const r = evaluateDrift({ current_value: '3.5%' });
    expect(r.baseline_only).toBe(true);
    expect(r.drifted).toBe(false);
  });
  it('numeric: below threshold is not drift, above is', () => {
    expect(evaluateDrift({ last_value: '3.50%', current_value: '3.52%' }).drifted).toBe(false); // <10%
    expect(evaluateDrift({ last_value: '3.50%', current_value: '4.50%' }).drifted).toBe(true); // ~29%
  });
  it('numeric: a sign flip is always drift', () => {
    expect(evaluateDrift({ last_value: '+0.1', current_value: '-0.1' }).drifted).toBe(true);
  });
  it('text: any normalized change is drift, identical is not', () => {
    expect(evaluateDrift({ last_value: 'supply high', current_value: 'supply LOW' }).drifted).toBe(true);
    expect(evaluateDrift({ last_value: 'supply high', current_value: '  supply   high ' }).drifted).toBe(false);
  });
});

describe('shouldFireAlert', () => {
  const drift = { drifted: true, baseline_only: false, reason: 'moved' };

  it('fires for an on_change premise with real drift and no recent check', () => {
    expect(shouldFireAlert(premise(), drift, T0 + 30 * D).fire).toBe(true);
  });
  it('does not fire when mode is off', () => {
    expect(shouldFireAlert(setAlertMode(premise(), 'off'), drift, T0 + 30 * D).fire).toBe(false);
  });
  it('does not fire on baseline-only or no drift', () => {
    expect(shouldFireAlert(premise(), { drifted: false, baseline_only: true, reason: '' }, T0 + 30 * D).fire).toBe(false);
    expect(shouldFireAlert(premise(), { drifted: false, baseline_only: false, reason: '' }, T0 + 30 * D).fire).toBe(false);
  });
  it('respects the per-item frequency cap', () => {
    const recently = { ...premise(), alert: { mode: 'on_change' as const, last_checked: new Date(T0).toISOString(), dismissals: 0 } };
    expect(shouldFireAlert(recently, drift, T0 + 1 * D).fire).toBe(false); // within cap
    expect(shouldFireAlert(recently, drift, T0 + (RECHECK_MIN_INTERVAL_DAYS + 1) * D).fire).toBe(true);
  });
  it('does not fire once backed off', () => {
    const backed = registerDismissal(registerDismissal(premise(), T0), T0 + D);
    expect(shouldFireAlert(backed, drift, T0 + 30 * D).fire).toBe(false);
  });
});

describe('isDueForRecheck', () => {
  it('due when never checked, not due within the cap, due again after it', () => {
    const p = premise();
    expect(isDueForRecheck(p, T0)).toBe(true);
    const checked = { ...p, alert: { ...p.alert, last_checked: new Date(T0).toISOString() } };
    expect(isDueForRecheck(checked, T0 + 1 * D)).toBe(false);
    expect(isDueForRecheck(checked, T0 + (RECHECK_MIN_INTERVAL_DAYS + 1) * D)).toBe(true);
  });
  it('never due when mode is off', () => {
    expect(isDueForRecheck(setAlertMode(premise(), 'off'), T0 + 999 * D)).toBe(false);
  });
});
