import { describe, it, expect } from 'vitest';
import { buildAutoTrackedPremiseItems } from '../auto-track-premises';
import type { ProgressiveSession } from '@/stores/types';

const NOW = Date.parse('2026-07-06T00:00:00Z');

function session(assumptions: string[], realBet?: string): ProgressiveSession {
  return {
    final_mix: { key_assumptions: assumptions },
    ...(realBet ? { falsification: { real_bet: realBet } } : {}),
  } as unknown as ProgressiveSession;
}

describe('buildAutoTrackedPremiseItems — §3.4 premises tracked at seal', () => {
  it('creates tracked premise items from the voyage assumptions (spine-safe defaults)', () => {
    const items = buildAutoTrackedPremiseItems('projA', session(['경쟁사가 이 기능을 아직 안 냈다', '팀이 2주 안에 만들 수 있다']), NOW);
    expect(items).toHaveLength(2);
    for (const it of items) {
      expect(it.type).toBe('premise');
      expect(it.source).toBe('ai');
      expect(it.external).toBe(false);          // opt-out default → alert OFF
      expect(it.load_bearing).toBe(false);
      expect(it.status).toBe('active');
      expect(it.decision_id).toBe('projA');
    }
  });

  it("includes the user's flinch bet first when present", () => {
    const items = buildAutoTrackedPremiseItems('projA', session(['가정 A'], '내 진짜 베팅'), NOW);
    expect(items[0].text).toBe('내 진짜 베팅');
  });

  it('caps the auto-tracked set at 5 (a decision is not a wiki)', () => {
    const many = ['a1', 'a2', 'a3', 'a4', 'a5', 'a6', 'a7'];
    expect(buildAutoTrackedPremiseItems('projA', session(many), NOW)).toHaveLength(5);
  });

  it('is idempotent — same texts → same stable ids (addItems dedupes on re-seal)', () => {
    const a = buildAutoTrackedPremiseItems('projA', session(['같은 전제']), NOW);
    const b = buildAutoTrackedPremiseItems('projA', session(['같은 전제']), NOW + 1000);
    expect(a[0].id).toBe(b[0].id);
  });

  it('no session / no assumptions → nothing to track (honest empty)', () => {
    expect(buildAutoTrackedPremiseItems('projA', null, NOW)).toEqual([]);
    expect(buildAutoTrackedPremiseItems('projA', session([]), NOW)).toEqual([]);
  });
});
