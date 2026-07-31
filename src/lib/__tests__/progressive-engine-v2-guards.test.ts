/**
 * Sim v2 rerun — code-enforced guards (scripts/sim/REPORT.md §v2-3).
 *
 * Prompt rules for these four already existed and the v2 rerun measured them
 * being ignored or rephrased around on the default tier — so each one now has
 * a structural floor in the engine:
 *  R1 validation conditional reassurance ("없다면 걸림돌은 없어요") → sentence
 *     stripped by code post-scan on the validation route.
 *  R4 framing_confidence < 70 → skeleton truncated to 2 by code.
 *  R7 banned vocabulary (베팅/초안) leaked through heavy prose → mechanical
 *     token swap on insight/skeleton/mix strings.
 *  R8 a heavy question shipped with two question marks → limitQuestionMarks at
 *     the guardFinalQuestion choke point.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/supabase', () => ({
  supabase: { auth: { getUser: vi.fn(() => Promise.resolve({ data: { user: null }, error: null })) } },
  getCurrentUserId: vi.fn(() => Promise.resolve(null)),
  clearUserCache: vi.fn(),
}));
vi.mock('@/lib/llm', () => ({
  callLLMJson: vi.fn(),
  callLLMStreamThenParse: vi.fn(),
}));

import {
  runInitialAnalysis,
  stripConditionalReassurance,
  truncateLowConfidenceSkeleton,
  scrubBannedVocabulary,
  capEscalationArrival,
} from '@/lib/progressive-engine';
import { composeDeepenText } from '@/lib/light-path/light-engine';
import { callLLMJson } from '@/lib/llm';

const mockJson = vi.mocked(callLLMJson);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('R1 — stripConditionalReassurance (the sentence form is the violation)', () => {
  it('drops the v2 rerun quote and its v1 sibling, keeps the check itself', () => {
    expect(stripConditionalReassurance('취업규칙에 겸업 제한이 있는지 확인해 보세요. 없다면 걸림돌은 없어요.'))
      .toBe('취업규칙에 겸업 제한이 있는지 확인해 보세요.');
    expect(stripConditionalReassurance('사규를 확인해 보세요. 제한이 없다면 진행에 걸림돌은 없지만 확인이 먼저예요.'))
      .toBe('사규를 확인해 보세요.');
    expect(stripConditionalReassurance('겸업이 된다면 문제는 없어요. 사규만 확인하세요.'))
      .toBe('사규만 확인하세요.');
  });

  it('never touches a clean neutral check and never empties the whole insight', () => {
    expect(stripConditionalReassurance('사규에 겸업 제한이 있는지만 확인해 보세요.'))
      .toBe('사규에 겸업 제한이 있는지만 확인해 보세요.');
    // the whole insight IS the violation → keep it rather than return nothing
    // (an empty insight would fail the workspace empty-result guard dishonestly)
    expect(stripConditionalReassurance('제한이 없다면 걸림돌은 없어요.'))
      .toBe('제한이 없다면 걸림돌은 없어요.');
    expect(stripConditionalReassurance(undefined)).toBeUndefined();
  });

  it('wires onto the validation route insight in runInitialAnalysis', async () => {
    mockJson.mockResolvedValue({
      real_question: '이미 내린 결정을 기록해요',
      request_type: 'validation',
      insight: '취업규칙에 겸업 제한이 있는지 확인해 보세요. 없다면 걸림돌은 없어요.',
      hidden_assumptions: [],
      skeleton: [],
      next_question: null,
    } as never);
    const { snapshot } = await runInitialAnalysis('부업을 이미 결정했는데 맞는 선택이겠죠?');
    expect(snapshot.insight).toContain('확인해 보세요.');
    expect(snapshot.insight).not.toContain('없다면 걸림돌은 없어요');
  });
});

describe('R4 — truncateLowConfidenceSkeleton (volume follows confidence, by code)', () => {
  const FIVE = ['s1', 's2', 's3', 's4', 's5'];

  it('a REPORTED confidence below 70 truncates the plan to 2', () => {
    expect(truncateLowConfidenceSkeleton(FIVE, 45)).toEqual(['s1', 's2']);
    expect(truncateLowConfidenceSkeleton(FIVE, 69)).toEqual(['s1', 's2']);
  });

  it('a confident or UNREPORTED framing never shrinks a legitimate plan', () => {
    expect(truncateLowConfidenceSkeleton(FIVE, 70)).toEqual(FIVE);
    expect(truncateLowConfidenceSkeleton(FIVE, 90)).toEqual(FIVE);
    expect(truncateLowConfidenceSkeleton(FIVE, undefined)).toEqual(FIVE);
    expect(truncateLowConfidenceSkeleton(FIVE, null)).toEqual(FIVE);
    expect(truncateLowConfidenceSkeleton(undefined, 45)).toEqual([]);
  });

  it('wires into runInitialAnalysis (sim light-06: confidence 45 shipped 5 steps)', async () => {
    mockJson.mockResolvedValue({
      real_question: '퇴사하고 여행을 갈지 정하는 게 맞나요?',
      request_type: 'open',
      framing_confidence: 45,
      hidden_assumptions: ['a'],
      skeleton: ['s1', 's2', 's3', 's4', 's5'],
      next_question: null,
    } as never);
    const { snapshot } = await runInitialAnalysis('퇴사하고 여행이나 갈까');
    expect(snapshot.skeleton).toHaveLength(2);
  });
});

describe('R7 — scrubBannedVocabulary (heavy prose had no vocabulary guard)', () => {
  it('swaps the two leaked tokens with natural Korean', () => {
    expect(scrubBannedVocabulary('이건 40% 인상에 대한 베팅이에요')).toBe('이건 40% 인상에 대한 판단이에요');
    expect(scrubBannedVocabulary('먼저 초안을 만들어 보세요')).toBe('먼저 정리을 만들어 보세요');
    expect(scrubBannedVocabulary('깨끗한 문장')).toBe('깨끗한 문장');
  });

  it('wires onto the deepened insight and skeleton', async () => {
    mockJson.mockResolvedValue({
      real_question: '무엇을 확인할까?',
      request_type: 'vent',
      insight: '이 베팅이 성립하려면 초안부터 봐야 해요.',
      hidden_assumptions: [],
      skeleton: [],
      next_question: null,
    } as never);
    const { snapshot } = await runInitialAnalysis('요즘 일이 너무 힘들다');
    expect(snapshot.insight).not.toContain('베팅');
    expect(snapshot.insight).not.toContain('초안');
    expect(snapshot.insight).toContain('판단');
    expect(snapshot.insight).toContain('정리');
  });
});

describe('R2 (batch 3) — an accepted escalation gets MINIMAL first contact BY CODE', () => {
  const FIVE = { skeleton: ['s1', 's2', 's3', 's4', 's5'], hidden_assumptions: ['a1', 'a2', 'a3'] };

  it('caps skeleton to 2 and assumptions to 1 when the hand-up marker is present', () => {
    const marked = composeDeepenText('회식 가기 싫다', [], 'ko', { biggerQuestion: '이 회사에서 계속 일할지' });
    const capped = capEscalationArrival(FIVE, marked);
    expect(capped.skeleton).toEqual(['s1', 's2']);
    expect(capped.hidden_assumptions).toEqual(['a1']);
  });

  it('never touches an ordinary submission (no marker)', () => {
    expect(capEscalationArrival(FIVE, '회식 가기 싫다')).toEqual(FIVE);
  });

  it('wires into runInitialAnalysis on the real composeDeepenText wire (sim: 5-step plan on arrival)', async () => {
    mockJson.mockResolvedValue({
      real_question: '이 회사에서 계속 일할지가 진짜 질문인가요?',
      request_type: 'open',
      framing_confidence: 80,
      hidden_assumptions: ['a1', 'a2', 'a3'],
      skeleton: ['s1', 's2', 's3', 's4', 's5'],
      next_question: null,
    } as never);
    const marked = composeDeepenText('회식 가기 싫다', [{ question: 'q', answer: '몇 달째 힘들어' }], 'ko', { biggerQuestion: '이 회사에서 계속 일할지' });
    const { snapshot } = await runInitialAnalysis(marked);
    expect(snapshot.skeleton).toHaveLength(2);
    expect(snapshot.hidden_assumptions).toHaveLength(1);
  });
});

describe('R8 — a heavy question never carries two question marks', () => {
  it('softens the second question mark through the guardFinalQuestion choke point', async () => {
    mockJson.mockResolvedValue({
      real_question: '어느 쪽을 택할까요?',
      request_type: 'open',
      framing_confidence: 85,
      hidden_assumptions: ['a'],
      skeleton: ['s1', 's2'],
      next_question: { text: '지금 상황을 보고 있는 상황인가요? 그리고 같은 진단을 갖고 있나요?', type: 'short' },
    } as never);
    const { question } = await runInitialAnalysis('공동창업자와 방향이 갈립니다');
    expect((question.text.match(/[?？]/g) || []).length).toBeLessThanOrEqual(1);
    expect(question.text).toContain('보고 있는 상황인가요?');
  });
});
