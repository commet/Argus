import { describe, expect, it } from 'vitest';
import { settleCountsLine } from '@/components/projects/Logbook';
import { recordSummaryMarkdown } from '@/lib/record-core';
import type { DecisionContract } from '@/stores/types';

function foundationContract(responseText: string): DecisionContract {
  return {
    id: 'c1',
    project_id: 'p1',
    kind: 'prediction',
    predicates: [],
    created_at: '2026-06-12T09:00:00Z',
    settlements: [{
      option_id: 'not_observable',
      response_text: responseText,
      recorded_at: '2026-06-29T09:00:00Z',
      axes: { reality: 'not_observable', question: 'indeterminate' },
      present_standard: { status: 'changed', recorded_at: '2026-06-29T09:00:00Z' },
    }],
  };
}

describe('Logbook and Telegram project a neutral return inventory', () => {
  it('Logbook shows the user-selected return wording verbatim', () => {
    const line = settleCountsLine(foundationContract('지금 자료로는 확인할 수 없어요'), 'ko');
    expect(line).toBe('지금 자료로는 확인할 수 없어요');
  });

  it('Logbook never appends held/broke/luck aggregate labels', () => {
    for (const locale of ['ko', 'en'] as const) {
      const line = settleCountsLine(foundationContract(locale === 'ko' ? '일부만 확인했어요' : 'Only part was observable'), locale);
      expect(line).not.toMatch(/적중|빗나감|운\s*\d|held\s*\d|broke\s*\d|luck\s*\d|score|점수/i);
    }
  });

  it('legacy free text remains readable without reconstructing a bucket', () => {
    const legacy: DecisionContract = {
      id: 'legacy',
      project_id: 'p1',
      predicates: [],
      judgment_receipt: {
        human_judgment: 'We will keep the current rollout.',
        what_happened: 'The rollout stayed useful, but the evidence was mixed.',
      },
    };
    expect(settleCountsLine(legacy, 'en')).toBe('The rollout stayed useful, but the evidence was mixed.');
  });

  it('Telegram shows only to-revisit and revisited counts', () => {
    const md = recordSummaryMarkdown(
      { open: 1, settled: 2, happened: 9, avoided: 8, partial: 7 },
      'ko',
    );
    expect(md).toContain('나중에 다시 볼 기록: **1**');
    expect(md).toContain('돌아와 답을 덧붙인 기록: **2**');
    expect(md).not.toMatch(/9|8|7|적중|빗나감|점수/);
  });
});
