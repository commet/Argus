/**
 * runFinalDeliverable tolerates a null dmFeedback.
 *
 * The focus path (and the sealed-prediction "최종 문서 다시 만들기" recovery)
 * finalizes the draft with NO DM feedback. Previously runFinalDeliverable did
 * `dmFeedback.concerns.filter(...)` and the caller guarded `if (!mix || !dmFb)
 * return` — so that button was a silent no-op, and naively dropping the guard
 * would have crashed here on `dmFeedback.concerns`. This proves the null path
 * renders the draft straight from the mix with no LLM call and no throw.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@/lib/supabase', () => ({
  supabase: { auth: { getUser: vi.fn(() => Promise.resolve({ data: { user: null }, error: null })) } },
  getCurrentUserId: vi.fn(() => Promise.resolve(null)),
  clearUserCache: vi.fn(),
}));
vi.mock('@/lib/llm', () => ({
  callLLMJson: vi.fn(),
  callLLMStreamThenParse: vi.fn(),
}));

import { runFinalDeliverable } from '@/lib/progressive-engine';
import { callLLMJson, callLLMStreamThenParse } from '@/lib/llm';
import type { MixResult } from '@/stores/types';

const mix: MixResult = {
  title: '퇴사 전 가게 검증 플랜',
  executive_summary: '검증 기준을 먼저 못 박아야 한다.',
  sections: [
    { heading: 'GO 기준 설계', content: '검증 전에 숫자를 정한다.' },
    { heading: '벤치마킹', content: '생존 조건을 역산한다.' },
  ],
  key_assumptions: ['수요가 실재한다'],
  next_steps: ['SNS 테스트'],
};

beforeEach(() => vi.clearAllMocks());

describe('runFinalDeliverable with null dmFeedback', () => {
  it('renders the draft from the mix without crashing or calling the LLM', async () => {
    const { markdown, finalMix } = await runFinalDeliverable(mix, null);

    // No applied fixes (there is no feedback) → it just formats the mix; no model call.
    expect(callLLMJson).not.toHaveBeenCalled();
    expect(callLLMStreamThenParse).not.toHaveBeenCalled();

    // The document is produced and carries the mix content + attribution forward.
    expect(typeof markdown).toBe('string');
    expect(markdown).toContain('퇴사 전 가게 검증 플랜');
    expect(markdown).toContain('GO 기준 설계');
    expect(finalMix).toBe(mix);
  });

  it('also handles a feedback object with no applied concerns (same no-LLM path)', async () => {
    const dmFb = {
      persona_name: '대표', first_reaction: '음', concerns: [
        { text: '리스크', applied: false, fix_suggestion: 'x' },
      ],
      good_parts: [], would_ask: [], approval_condition: '',
    } as never;
    const { markdown } = await runFinalDeliverable(mix, dmFb);
    expect(callLLMJson).not.toHaveBeenCalled();
    expect(markdown).toContain('퇴사 전 가게 검증 플랜');
  });
});
