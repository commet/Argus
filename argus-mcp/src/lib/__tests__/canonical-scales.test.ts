import { describe, it, expect } from 'vitest';
import { normalizeLabel, normalizeUnit } from '../canonical-scales.js';

describe('canonical-scales — ordinal label normalization (M2 §3.1)', () => {
  it('S&P credit ranks are ordered top→bottom', () => {
    expect(normalizeLabel('sp_credit', 'AAA')).toBe(1);
    expect(normalizeLabel('sp_credit', 'BBB')).toBe(9);
    expect(normalizeLabel('sp_credit', 'D')).toBe(22);
  });

  it('Moody\'s aliases collapse onto the S&P rank (Baa2 ≡ BBB) — CAT-06', () => {
    expect(normalizeLabel('sp_credit', 'Baa2')).toBe(normalizeLabel('sp_credit', 'BBB'));
    expect(normalizeLabel('sp_credit', 'A2')).toBe(normalizeLabel('sp_credit', 'A'));
  });

  it('is case/space insensitive', () => {
    expect(normalizeLabel('sp_credit', ' bbb ')).toBe(normalizeLabel('sp_credit', 'BBB'));
  });

  it('product tier and lts scales place labels', () => {
    expect(normalizeLabel('tier', 'Enterprise')).toBeGreaterThan(normalizeLabel('tier', 'Free')!);
    expect(normalizeLabel('lts', 'EOL')).toBeGreaterThan(normalizeLabel('lts', 'Active')!);
  });

  it('unknown scale or unknown label returns null (→ uncertain lane, never a guess)', () => {
    expect(normalizeLabel('nope', 'BBB')).toBeNull();
    expect(normalizeLabel('sp_credit', 'not-a-rating')).toBeNull();
    expect(normalizeLabel(undefined, 'BBB')).toBeNull();
  });

  it('accepts an inline custom ordinal scale (ordered labels)', () => {
    const custom = { belt: ['white', 'yellow', 'green', 'black'] };
    expect(normalizeLabel('belt', 'white', custom)).toBe(1);
    expect(normalizeLabel('belt', 'black', custom)).toBe(4);
  });
});

describe('canonical-scales — unit conversion (M2 §3.2)', () => {
  it('Kelvin → Celsius offset', () => {
    const r = normalizeUnit(300, 'K');
    expect(r?.unit).toBe('c');
    expect(r?.value).toBeCloseTo(26.85, 1);
  });

  it('unknown unit passes through tagged (host_reported lane, not an invented conversion)', () => {
    const r = normalizeUnit(42, 'widgets');
    expect(r?.value).toBe(42);
    expect(r?.unit).toBe('widgets');
  });

  it('no unit → null', () => {
    expect(normalizeUnit(1, undefined)).toBeNull();
  });
});
