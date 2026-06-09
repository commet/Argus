/**
 * Overreach engine — runOverreach / runHighestLoad. Mocked LLM: proves ids get
 * assigned, empty claims are dropped, the overreached/highest_load flags are set,
 * and the no-flinch fallback degrades to the weakest assumption.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/supabase', () => ({
  supabase: {},
  getCurrentUserId: () => Promise.resolve(null),
  clearUserCache: () => {},
  withUser: () => Promise.resolve(null),
}));
vi.mock('@/lib/llm', () => ({ callLLMJson: vi.fn(), callLLMStreamThenParse: vi.fn() }));
vi.mock('@/lib/i18n', () => ({ getCurrentLanguage: () => 'en' }));

import { callLLMJson } from '@/lib/llm';
import { runOverreach, runHighestLoad } from '@/lib/progressive-engine';
import type { AnalysisSnapshot, MixResult } from '@/stores/types';

const mockCall = vi.mocked(callLLMJson);

const snapshot: AnalysisSnapshot = {
  version: 1,
  real_question: 'Will the referral loop move signups?',
  hidden_assumptions: ['Users will refer'],
  skeleton: ['build it'],
  weakest_assumption: { assumption: 'Existing users actively refer', explanation: 'no advocacy yet' },
};

const mix: MixResult = {
  title: 'Referral program',
  executive_summary: 'Grow via referrals.',
  sections: [{ heading: 'Plan', content: 'invite users' }],
  key_assumptions: ['users share'],
  next_steps: ['build invite flow'],
};

describe('runOverreach', () => {
  beforeEach(() => mockCall.mockReset());

  it('assigns ids, sets overreached, drops empties, trims', async () => {
    mockCall.mockResolvedValue({ strength: '  Real strength  ', claims: ['  c1  ', '', '   ', 'c2'] });
    const { strength, claims } = await runOverreach(snapshot, mix);
    expect(strength).toBe('Real strength');
    expect(claims.map((c) => c.text)).toEqual(['c1', 'c2']);
    expect(claims.every((c) => c.overreached === true)).toBe(true);
    expect(claims.every((c) => typeof c.id === 'string' && c.id.length > 0)).toBe(true);
    expect(new Set(claims.map((c) => c.id)).size).toBe(2); // unique ids
  });

  it('returns an empty claim list when the model returns none (caller will skip)', async () => {
    mockCall.mockResolvedValue({ strength: 's', claims: [] });
    const { claims } = await runOverreach(snapshot, mix);
    expect(claims).toEqual([]);
  });

  it('tolerates a missing claims field', async () => {
    mockCall.mockResolvedValue({ strength: 's' });
    const { claims } = await runOverreach(snapshot, mix);
    expect(claims).toEqual([]);
  });

  it('coerces object-shaped claims ({text}) instead of dropping the ladder', async () => {
    mockCall.mockResolvedValue({ strength: 's', claims: [{ text: ' c1 ' }, { text: 'c2' }, { nope: 'x' }, 'c3'] });
    const { claims } = await runOverreach(snapshot, mix);
    expect(claims.map((c) => c.text)).toEqual(['c1', 'c2', 'c3']); // {nope} dropped, rest kept
  });
});

describe('runHighestLoad', () => {
  beforeEach(() => mockCall.mockReset());

  it('returns a highest_load claim from the model text', async () => {
    mockCall.mockResolvedValue({ text: 'You are betting users will refer unprompted' });
    const claim = await runHighestLoad([{ id: 'a', text: 'c1', overreached: true }], snapshot);
    expect(claim.text).toBe('You are betting users will refer unprompted');
    expect(claim.highest_load).toBe(true);
    expect(claim.overreached).toBe(false);
    expect(claim.id.length).toBeGreaterThan(0);
  });

  it('falls back to the snapshot weakest assumption when the model returns empty', async () => {
    mockCall.mockResolvedValue({ text: '   ' });
    const claim = await runHighestLoad([], snapshot);
    expect(claim.text).toBe('Existing users actively refer');
    expect(claim.highest_load).toBe(true);
  });
});
