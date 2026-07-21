/**
 * Blast-radius layout — deterministic radial placement + focus selection.
 * Pins: drift wins focus, exposure breaks ties, silence when nothing stands,
 * spokes cap with honest overflow, positions stay on-plate and circularize.
 */
import { describe, it, expect } from 'vitest';
import type { SharedGround, LiveBet } from '@/lib/judgment-graph';
import { pickFocusGround, blastRadius, MAX_SPOKES } from '@/lib/judgment-graph-layout';

function bet(id: string, check_by = '2026-08-01'): LiveBet {
  return { receipt_id: id, source_title: id, followup_id: `f_${id}`, predicate: `bet ${id}`, check_by };
}
function ground(key: string, over: Partial<SharedGround> = {}): SharedGround {
  return {
    key,
    text: key,
    members: [
      { receipt_id: 'r1', source_title: 'r1', premise: {} as never },
      { receipt_id: 'r2', source_title: 'r2', premise: {} as never },
    ],
    live_bets: [],
    ...over,
  };
}

describe('pickFocusGround — drift first, then exposure, else silence', () => {
  it('a drifted ground wins over a higher-exposure non-drifted one', () => {
    const drifted = ground('moved', { drift: { finding: 'x', source: 'url', ts: 't' }, live_bets: [bet('a')] });
    const loaded = ground('stable', { live_bets: [bet('b'), bet('c'), bet('d')] });
    expect(pickFocusGround([loaded, drifted])!.key).toBe('moved');
  });

  it('among drifted grounds, the most live exposure wins', () => {
    const g1 = ground('d1', { drift: { finding: 'x', source: 'url', ts: 't' }, live_bets: [bet('a')] });
    const g2 = ground('d2', { drift: { finding: 'y', source: 'url', ts: 't' }, live_bets: [bet('b'), bet('c')] });
    expect(pickFocusGround([g1, g2])!.key).toBe('d2');
  });

  it('with no drift, the most live exposure wins', () => {
    const g1 = ground('a', { live_bets: [bet('x')] });
    const g2 = ground('b', { live_bets: [bet('y'), bet('z')] });
    expect(pickFocusGround([g1, g2])!.key).toBe('b');
  });

  it('a ground with neither drift nor an open bet is not worth centering → null (restraint)', () => {
    expect(pickFocusGround([ground('settled-only', { live_bets: [] })])).toBeNull();
    expect(pickFocusGround([])).toBeNull();
  });
});

describe('blastRadius — deterministic radial placement', () => {
  it('centers the ground and marks hot iff it drifted', () => {
    const stable = blastRadius(ground('g', { live_bets: [bet('a')] }));
    expect(stable.center.x).toBe(50);
    expect(stable.center.y).toBe(50);
    expect(stable.hot).toBe(false);
    expect(stable.center.state).toBe('docked');

    const moved = blastRadius(ground('g', { drift: { finding: 'x', source: 'url', ts: 't' }, live_bets: [bet('a')] }));
    expect(moved.hot).toBe(true);
    expect(moved.center.state).toBe('adrift');
    expect(moved.edges.every((e) => e.hot)).toBe(true);
  });

  it('draws one spoke per open bet up to the cap, with an honest overflow count', () => {
    const many = ground('g', { live_bets: Array.from({ length: MAX_SPOKES + 3 }, (_, i) => bet(`b${i}`)) });
    const r = blastRadius(many);
    expect(r.spokes).toHaveLength(MAX_SPOKES);
    expect(r.overflow).toBe(3);
    expect(r.edges).toHaveLength(MAX_SPOKES);
  });

  it('keeps every node on the plate (0–100%) and circularizes by aspect', () => {
    const r = blastRadius(ground('g', { live_bets: Array.from({ length: 6 }, (_, i) => bet(`b${i}`)) }), 16 / 9);
    for (const node of [r.center, ...r.spokes]) {
      expect(node.x).toBeGreaterThanOrEqual(0);
      expect(node.x).toBeLessThanOrEqual(100);
      expect(node.y).toBeGreaterThanOrEqual(0);
      expect(node.y).toBeLessThanOrEqual(100);
    }
    // first spoke starts at the top (theta = -90°): x≈center, y < center.
    expect(Math.abs(r.spokes[0].x - 50)).toBeLessThan(0.001);
    expect(r.spokes[0].y).toBeLessThan(50);
    // x-radius is divided by aspect → narrower horizontal spread than vertical.
    const east = blastRadius(ground('g', { live_bets: [bet('a'), bet('b'), bet('c'), bet('d')] }), 16 / 9).spokes;
    const dx = Math.max(...east.map((s) => Math.abs(s.x - 50)));
    const dy = Math.max(...east.map((s) => Math.abs(s.y - 50)));
    expect(dx).toBeLessThan(dy);
  });
});
