import { describe, it, expect } from 'vitest';
import { overfireGate } from '../overfire-gate.js';

describe('overfire gate (mirror clause)', () => {
  it('fires on a consequential, hard-to-reverse, high-stakes fork', () => {
    expect(overfireGate({ stakes: 'high', reversibility: 'one_way_door' }).fire).toBe(true);
  });

  it('restrains on low stakes', () => {
    expect(overfireGate({ stakes: 'low', reversibility: 'one_way_door' }).fire).toBe(false);
    expect(overfireGate({ stakes: 'trivial', reversibility: 'costly_to_reverse' }).fire).toBe(false);
  });

  it('restrains on reversible + not-high stakes', () => {
    expect(overfireGate({ stakes: 'moderate', reversibility: 'easily_reversible' }).fire).toBe(false);
  });

  it('restrains on already-decided', () => {
    expect(overfireGate({ stakes: 'high', reversibility: 'one_way_door', already_decided: true }).fire).toBe(false);
  });

  it('restrains on vent / factual', () => {
    expect(overfireGate({ stakes: 'high', reversibility: 'one_way_door', is_vent: true }).fire).toBe(false);
    expect(overfireGate({ stakes: 'high', reversibility: 'one_way_door', is_factual: true }).fire).toBe(false);
  });

  it('asks to reconfirm contradictory signals (high + easily reversible)', () => {
    const v = overfireGate({ stakes: 'high', reversibility: 'easily_reversible' });
    expect(v.fire).toBe(false);
    expect(v.response).toBe('reconfirm');
  });
});
