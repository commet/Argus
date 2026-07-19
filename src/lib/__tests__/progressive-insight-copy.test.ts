import { describe, expect, it } from 'vitest';
import { buildDeepeningPrompt, buildInitialAnalysisPrompt } from '../progressive-prompts';
import type { AnalysisSnapshot } from '@/stores/types';

const snapshot = {
  version: 1,
  real_question: '지금 회사를 떠날지 결정하려면 무엇부터 확인해야 할까?',
  insight: '성장 한계가 실제인지 먼저 확인해야 해요.',
  hidden_assumptions: ['현재 회사에서는 더 성장할 수 없다'],
  skeleton: ['먼저 — 성장 기회를 요청해본 기록을 확인한다.'],
} as unknown as AnalysisSnapshot;

describe('progressive insight copy — 결론 다음에 이유', () => {
  it('첫 분석에서 문장 해설이 아닌 결론과 이유를 요구한다', () => {
    const prompt = buildInitialAnalysisPrompt('이직을 고민 중이야.', 'ko');

    expect(prompt.system).toContain('TWO concise sentences with distinct jobs');
    expect(prompt.system).toContain('결론 → 이유');
    expect(prompt.system).toContain('“X라는 표현이 핵심이에요”');
    expect(prompt.user).toContain('takeaway first, reason second');
  });

  it('답변 반영 뒤에도 같은 두 문장 구조를 유지한다', () => {
    const prompt = buildDeepeningPrompt('이직을 고민 중이야.', snapshot, [], 1, 3, 'ko');

    expect(prompt.system).toContain('TWO concise sentences about what their answer MEANS');
    expect(prompt.system).toContain('Sentence 1 states the updated takeaway');
    expect(prompt.user).toContain('updated takeaway first, deciding reason second');
  });
});
