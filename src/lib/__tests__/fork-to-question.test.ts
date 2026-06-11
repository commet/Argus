/**
 * W2.2 acceptance — deterministic, LLM-free unit tests.
 * Also covers probe-engine's mechanical enforcement helpers (quote anchoring),
 * since fork-to-question is the last gate before a fork reaches the user.
 */

import { describe, it, expect, vi } from 'vitest';

// ─── Mocks (before imports) — probe-engine → llm.ts → supabase chain must not
//     touch the network/env in tests (established pattern, captain-seat test). ───
vi.mock('@/lib/supabase', () => ({
  supabase: { auth: { getSession: vi.fn(() => Promise.resolve({ data: { session: null } })) } },
  getCurrentUserId: vi.fn(() => Promise.resolve(null)),
}));
vi.mock('@/lib/db', () => ({ upsertToSupabase: vi.fn(), loadAndMerge: vi.fn(() => Promise.resolve([])) }));

import {
  forksToQuestions,
  compareForkPriority,
  forkQuestionId,
  MAX_PROBE_QUESTIONS,
  WRITE_MY_OWN_KO,
  WRITE_MY_OWN_EN,
} from '../fork-to-question';
import { quoteOccursIn } from '../probe-engine';
import type { Fork } from '../probe-engine';

const fork = (over: Partial<Fork> = {}): Fork => ({
  field: 'week1_action',
  variants: ['MVP부터 만든다', '고객 인터뷰부터 한다'],
  cause_quote: '빠르게 검증한다',
  flipped_user_claim: '검증은 만들어봐야 가능하다',
  ...over,
});

describe('forksToQuestions — mechanical conversion', () => {
  it('converts a fork into a FlowQuestion with variants + 직접 쓸게요', () => {
    const [q] = forksToQuestions([fork()]);
    expect(q.type).toBe('select');
    expect(q.options).toEqual(['MVP부터 만든다', '고객 인터뷰부터 한다', WRITE_MY_OWN_KO]);
    // P2: the user's phrase is quoted in the question text.
    expect(q.text).toContain('빠르게 검증한다');
    // The flipped claim explains the stake.
    expect(q.subtext).toContain('검증은 만들어봐야 가능하다');
  });

  it('caps at MAX_PROBE_QUESTIONS (세션당 측정-정박 질문 ≤2)', () => {
    const forks = [
      fork({ field: 'week1_action' }),
      fork({ field: 'key_resource', cause_quote: 'a' }),
      fork({ field: 'success_test', cause_quote: 'b' }),
      fork({ field: 'purpose_reading', cause_quote: 'c' }),
    ];
    expect(forksToQuestions(forks)).toHaveLength(MAX_PROBE_QUESTIONS);
    // limit can shrink but never exceed the cap
    expect(forksToQuestions(forks, { limit: 1 })).toHaveLength(1);
    expect(forksToQuestions(forks, { limit: 99 })).toHaveLength(MAX_PROBE_QUESTIONS);
    expect(forksToQuestions(forks, { limit: 0 })).toHaveLength(0);
  });

  it('purpose-level forks outrank execution-level forks', () => {
    const exec = fork({ field: 'week1_action', variants: ['a', 'b', 'c', 'd'] });
    const purpose = fork({ field: 'purpose_reading', variants: ['x', 'y'] });
    const qs = forksToQuestions([exec, purpose]);
    expect(qs[0].engine_phase).toBe('reframe'); // purpose first despite fewer variants
    expect(qs[1].engine_phase).toBe('recast');
  });

  it('within a level, wider divergence (more variants) wins, then longer anchor', () => {
    const narrow = fork({ cause_quote: '짧은 인용', variants: ['a', 'b'] });
    const wide = fork({ cause_quote: '인용', variants: ['a', 'b', 'c'] });
    expect(compareForkPriority(wide, narrow)).toBeLessThan(0);
    const longAnchor = fork({ cause_quote: '훨씬 더 길고 구체적인 인용 구절' });
    const shortAnchor = fork({ cause_quote: '짧음' });
    expect(compareForkPriority(longAnchor, shortAnchor)).toBeLessThan(0);
  });

  it('drops forks without flipped_user_claim / quote / 2+ variants (defense in depth)', () => {
    expect(forksToQuestions([fork({ flipped_user_claim: '' })])).toHaveLength(0);
    expect(forksToQuestions([fork({ flipped_user_claim: '   ' })])).toHaveLength(0);
    expect(forksToQuestions([fork({ cause_quote: '' })])).toHaveLength(0);
    expect(forksToQuestions([fork({ variants: ['하나뿐'] })])).toHaveLength(0);
    // malformed input never crashes
    expect(forksToQuestions(null as unknown as Fork[])).toEqual([]);
    expect(forksToQuestions([null as unknown as Fork])).toEqual([]);
  });

  it('question ids are stable across re-probes (same fork → same id)', () => {
    expect(forkQuestionId(fork())).toBe(forkQuestionId(fork()));
    expect(forkQuestionId(fork())).not.toBe(forkQuestionId(fork({ cause_quote: '다른 인용' })));
    const [q1] = forksToQuestions([fork()]);
    const [q2] = forksToQuestions([fork()]);
    expect(q1.id).toBe(q2.id);
  });

  it('locale en renders english scaffolding with the same anchors', () => {
    const [q] = forksToQuestions([fork()], { locale: 'en' });
    expect(q.options).toContain(WRITE_MY_OWN_EN);
    expect(q.text).toContain('빠르게 검증한다'); // anchor quote stays verbatim
  });

  it('deterministic: same input → identical output (no randomness, no clock)', () => {
    const forks = [fork(), fork({ field: 'purpose_reading', cause_quote: '목적 구절' })];
    expect(forksToQuestions(forks)).toEqual(forksToQuestions(forks));
  });
});

describe('quoteOccursIn — hallucinated-anchor gate (P2 기계적 강제)', () => {
  const paragraph = '우리는 빠르게 검증한다. 첫 분기 안에 "유료 전환 10%"를 본다 — 그게 기준이다.';

  it('accepts verbatim and whitespace/punctuation-shifted quotes', () => {
    expect(quoteOccursIn(paragraph, '빠르게 검증한다')).toBe(true);
    expect(quoteOccursIn(paragraph, '유료 전환 10%')).toBe(true);
    expect(quoteOccursIn(paragraph, '빠르게  검증한다.')).toBe(true); // spacing/punct shift
  });

  it('rejects paraphrases and fabrications', () => {
    expect(quoteOccursIn(paragraph, '신속한 검증이 중요하다')).toBe(false);
    expect(quoteOccursIn(paragraph, '경쟁사가 먼저 출시한다')).toBe(false);
    expect(quoteOccursIn(paragraph, '')).toBe(false);
    expect(quoteOccursIn(paragraph, '   ')).toBe(false);
  });
});
