import { describe, expect, it } from 'vitest';
import { buildDeepeningPrompt, buildInitialAnalysisPrompt } from '../progressive-prompts';
import type { AnalysisSnapshot } from '@/stores/types';

const snapshot = {
  version: 1,
  real_question: '지금 회사를 떠날지 결정하려면 무엇부터 확인해야 할까?',
  insight: '성장 한계가 실제인지 먼저 확인해야 해요.',
  hidden_assumptions: ['현재 회사에서는 더 성장할 수 없다'],
  skeleton: [],
} as unknown as AnalysisSnapshot;

/**
 * The insight is the one line the user actually reads each turn. The old pin
 * was the retired prompt's literal "결론 → 이유" prose; what has to hold now is
 * the job that line does — mirror the state on the first turn, report the
 * DELTA after an answer — and that neither turn is allowed to pad it.
 */
describe('progressive insight copy — 한 줄이 하는 일', () => {
  it('첫 분석의 insight는 상태를 비추고, 없는 것을 지어내지 않는다', () => {
    const prompt = buildInitialAnalysisPrompt('이직을 고민 중이야.', 'ko');

    expect(prompt.system).toContain('insight: one or two concise sentences');
    expect(prompt.system).toContain('Mirror the current decision state');
    // Length is never bought with invention.
    expect(prompt.system).toContain('An empty field is better than a plausible invention');
    expect(prompt.system).toContain('There is NO minimum');
  });

  it('답변 반영 뒤의 insight는 "무엇이 달라졌는지"를 말한다 (안 달라졌으면 그대로 말한다)', () => {
    const prompt = buildDeepeningPrompt('이직을 고민 중이야.', snapshot, [], 1, 3, 'ko');

    expect(prompt.system).toContain('what the latest answer actually changed');
    expect(prompt.system).toContain('or that the picture held');
    // Stability is a legitimate answer — the old prompt demanded visible drama.
    expect(prompt.system).toContain('Visible stability is valid');
    expect(prompt.system).not.toContain('DRAMATIC');
  });
});
