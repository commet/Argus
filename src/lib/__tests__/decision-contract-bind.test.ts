import { describe, it, expect } from 'vitest';
import {
  buildEarlyContract,
  augmentContract,
  summarizeGrades,
  contractStatus,
  stablePredicateId,
  CHECK_IN_MS,
} from '../decision-contract';
import type { Predicate, DecisionContract } from '@/stores/types';

const T0 = new Date('2026-06-23T00:00:00Z').getTime();

describe('buildEarlyContract — Phase 1 BIND (rope at OPEN)', () => {
  it('typed lean → one user_lean predicate, authored:user, with check-in', () => {
    const c = buildEarlyContract('p1', { lean: '나는 연기 쪽으로 기운다', interval: '2w' }, T0)!;
    expect(c).not.toBeNull();
    expect(c.predicates).toHaveLength(1);
    const p = c.predicates[0];
    expect(p.source).toBe('user_lean');
    expect(p.authored).toBe('user');
    expect(p.text).toBe('나는 연기 쪽으로 기운다');
    expect(p.id).toBe(stablePredicateId('user_lean', '나는 연기 쪽으로 기운다'));
    expect(c.check_in_at).toBe(new Date(T0 + CHECK_IN_MS['2w']).toISOString());
    expect(c.project_id).toBe('p1');
  });

  it('date-only (no lean) → predicate-less rope with a check-in, NOT a closed loop', () => {
    const c = buildEarlyContract('p2', { interval: '1w' }, T0)!;
    expect(c).not.toBeNull();
    expect(c.predicates).toHaveLength(0);
    expect(c.check_in_at).toBe(new Date(T0 + CHECK_IN_MS['1w']).toISOString());
    // A predicate-less rope must never be miscounted as a settled loop.
    const st = contractStatus(c, T0 + CHECK_IN_MS['1w'] + 86_400_000);
    expect(st.allGraded).toBe(false);
    expect(st.checkInDue).toBe(true); // it DOES resurface at the date
  });

  it('honest-empty: no lean and no interval → null (writes zero rows, byte-identical to old skip)', () => {
    expect(buildEarlyContract('p3', {}, T0)).toBeNull();
    expect(buildEarlyContract('p3', { lean: '   ' }, T0)).toBeNull(); // whitespace-only is empty
  });

  it('lean without interval → user_lean predicate, no check-in date', () => {
    const c = buildEarlyContract('p4', { lean: '바로 출시' }, T0)!;
    expect(c.predicates).toHaveLength(1);
    expect(c.check_in_at).toBeUndefined();
  });
});

describe('augmentContract — "bind tighter": merge, never clobber the rope', () => {
  const early = buildEarlyContract('p1', { lean: '연기 쪽', interval: '2w' }, T0)!;
  const leanId = early.predicates[0].id;

  it('preserves id/created_at/check-in and the user_lean predicate; appends new ones', () => {
    const extracted: Predicate[] = [
      { id: stablePredicateId('governing_idea', 'AI 가정 A'), text: 'AI 가정 A', source: 'governing_idea', authored: 'ai_surfaced' },
      { id: stablePredicateId('risk', '법무 리스크'), text: '법무 리스크', source: 'risk' },
    ];
    const merged = augmentContract(early, extracted, T0);
    expect(merged.id).toBe(early.id);
    expect(merged.created_at).toBe(early.created_at);
    expect(merged.check_in_at).toBe(early.check_in_at);
    expect(merged.predicates).toHaveLength(3);
    // the user's own lean survives, first and intact
    const lean = merged.predicates.find((p) => p.id === leanId)!;
    expect(lean.source).toBe('user_lean');
    expect(lean.authored).toBe('user');
  });

  it('on id collision the existing user_lean predicate WINS (its authorship is never replaced)', () => {
    const collidingText = '연기 쪽';
    const collide: Predicate[] = [
      // same text → same stable id IF it were user_lean; but an AI-derived one with
      // the SAME id must not overwrite the user's provenance.
      { id: leanId, text: collidingText, source: 'governing_idea', authored: 'ai_surfaced' },
    ];
    const merged = augmentContract(early, collide, T0);
    expect(merged.predicates).toHaveLength(1);
    expect(merged.predicates[0].source).toBe('user_lean');
    expect(merged.predicates[0].authored).toBe('user');
  });

  it('re-confirms the check-in when a new interval is supplied', () => {
    const merged = augmentContract(early, [], T0, '1m');
    expect(merged.check_in_at).toBe(new Date(T0 + CHECK_IN_MS['1m']).toISOString());
    expect(merged.check_in_interval).toBe('1m');
  });
});

describe('summarizeGrades — a held user_lean is the user\'s own skill-win', () => {
  it('user_lean happened → betsHeld, never betsHeldAiSurfaced', () => {
    const c: DecisionContract = {
      id: 'x', project_id: 'p', created_at: new Date(T0).toISOString(),
      predicates: [
        { id: 'a', text: 'my lean', source: 'user_lean', authored: 'user', verdict: 'happened' },
        { id: 'b', text: 'ai bet', source: 'governing_idea', authored: 'ai_surfaced', verdict: 'happened' },
      ],
    };
    const g = summarizeGrades(c);
    expect(g.betsHeld).toBe(2);            // both held
    expect(g.betsHeldAiSurfaced).toBe(1);  // only the ai_surfaced one
  });

  it('user_lean broke → betsBroke', () => {
    const c: DecisionContract = {
      id: 'x', project_id: 'p', created_at: new Date(T0).toISOString(),
      predicates: [{ id: 'a', text: 'my lean', source: 'user_lean', authored: 'user', verdict: 'avoided' }],
    };
    expect(summarizeGrades(c).betsBroke).toBe(1);
  });
});
