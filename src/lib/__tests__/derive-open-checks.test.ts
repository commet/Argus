import { describe, it, expect } from 'vitest';
import { deriveOpenChecks, stableCheckId, MAX_OPEN_CHECKS } from '../decision-contract';
import type { HonestyFlag } from '../honesty-scan';

const wf = (text: string, where?: string): HonestyFlag => ({ text, kind: 'world_fact', stake: '', ...(where ? { where } : {}) });
const fab = (text: string): HonestyFlag => ({ text, kind: 'fabricated', stake: '' });

describe('deriveOpenChecks (loop-17 B — founder settings)', () => {
  it('carries ONLY world_fact WITH a source', () => {
    const out = deriveOpenChecks([
      wf('동탄 공급이 많아요', '청약홈'),   // ✓ world_fact + where
      wf('시장이 과열이에요'),               // ✗ no source
      fab('온보딩 1~3개월'),                 // ✗ fabricated (nothing to look up)
    ]);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ text: '동탄 공급이 많아요', where: '청약홈', id: stableCheckId('동탄 공급이 많아요') });
    expect(out[0].status).toBeUndefined();
  });

  it(`caps at MAX_OPEN_CHECKS (${MAX_OPEN_CHECKS})`, () => {
    const many = Array.from({ length: 5 }, (_, i) => wf(`사실 ${i}`, `출처 ${i}`));
    expect(deriveOpenChecks(many)).toHaveLength(MAX_OPEN_CHECKS);
  });

  it('dedupes by stable id (same text → one check)', () => {
    expect(deriveOpenChecks([wf('같은 사실', '실거래가'), wf('같은 사실', '다른출처')])).toHaveLength(1);
  });

  it('is safe on empty/undefined (no checks, never throws)', () => {
    expect(deriveOpenChecks(undefined)).toEqual([]);
    expect(deriveOpenChecks([])).toEqual([]);
    expect(deriveOpenChecks([fab('x'), wf('출처없음')])).toEqual([]);
  });

  it('stableCheckId is deterministic and text-normalized', () => {
    expect(stableCheckId('  A  B ')).toBe(stableCheckId('a b'));
    expect(stableCheckId('다른 것')).not.toBe(stableCheckId('또 다른 것'));
  });
});
