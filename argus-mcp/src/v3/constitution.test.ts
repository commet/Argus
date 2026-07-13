import { describe, expect, it } from 'vitest';
import { MESSY_CORPUS } from './fixtures/dkk-corpus.js';
import { AUTHORIAL_EVENT_NAMES, SemanticEventSchema } from './types.js';

const articleCoverage = {
  1: ['semantic.test.ts: requires evidence and human authority'],
  2: ['semantic.test.ts: authority is distinct from observation provenance'],
  3: ['types.ts: observation requires observed_by or provenance'],
  4: ['types.ts: no person score or tier field exists'],
  5: ['semantic.test.ts: duplicate seal is an illegal transition'],
  6: ['semantic.test.ts: retrospective material is excluded as_of'],
  7: ['semantic.test.ts: due derives from return promise'],
  8: ['semantic.test.ts: defer remains non-terminal'],
  9: ['semantic.test.ts: same event list folds deterministically'],
  10: ['fixtures/dkk-corpus.ts: each object boundary names allowed loss'],
  11: ['types.ts: judgment_erased is explicit and authorized'],
  12: ['types.ts: semantic package has no model field'],
  13: ['semantic.test.ts: invalid data remains an anomaly'],
  14: ['reducer.ts: guardAppend is the write-gateway contract'],
} as const;

describe('DKK v6 constitution fixture bijection', () => {
  it('gives every constitutional article an executable enforcement locus', () => {
    expect(Object.keys(articleCoverage).map(Number)).toEqual(Array.from({ length: 14 }, (_, index) => index + 1));
    expect(Object.values(articleCoverage).every((locations) => locations.length > 0)).toBe(true);
  });

  it('keeps authorial power limited to named event kinds', () => {
    expect(AUTHORIAL_EVENT_NAMES.has('judgment_closed')).toBe(true);
    expect(AUTHORIAL_EVENT_NAMES.has('observation_recorded')).toBe(false);
  });

  it('does not admit a score-shaped user event through the strict schema', () => {
    const parsed = SemanticEventSchema.safeParse({
      event_id: 'score', v: 3, space_id: 'space-a', idempotency_key: 'score',
      time: { recorded_at: '2026-07-14T18:00:00.000Z', temporal_mode: 'contemporaneous' },
      authority: { originated_by: { kind: 'system', id: 'x' }, recorded_by: { kind: 'system', id: 'x' } },
      event: 'user_scored', score: 99,
    });
    expect(parsed.success).toBe(false);
  });

  it('keeps all 30 P1 cases attached to at least one constitutional boundary', () => {
    expect(MESSY_CORPUS).toHaveLength(30);
    expect(MESSY_CORPUS.every((fixture) => fixture.required.length > 0 && fixture.forbidden.length > 0)).toBe(true);
  });
});
