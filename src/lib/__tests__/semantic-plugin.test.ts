import { describe, expect, it } from 'vitest';
import { fold, projectJudgment } from '@/lib/decision-kernel';
import { closePluginRecord, recordPluginAnswer, reforgePluginDecision } from '@/lib/semantic-plugin';
import type { PluginDecision } from '@/stores/types';

const decision: PluginDecision = {
  id: 'd1', source: 'push', ledger_id: 'legacy-1', decision: 'Keep the current price.',
  predicate: 'Will conversion remain above 3.2%?', check_by: '2026-09-01',
  sealed_at: '2026-07-01T00:00:00.000Z', created_at: '2026-07-01T00:00:00.000Z', updated_at: '2026-07-01T00:00:00.000Z',
};

describe('plugin semantic reforge adapter', () => {
  it('requires an explicit reforge and still separates answer from close', () => {
    const record = reforgePluginDecision(decision, 'confirm-1', '2026-07-14T00:00:00.000Z');
    const answered = recordPluginAnswer(decision, record, 'answer-1', 'happened', '2026-09-02T00:00:00.000Z');
    const beforeClose = fold([...record.events, ...answered]);
    expect(projectJudgment(beforeClose, record.judgment_id, '2026-09-03T00:00:00.000Z')?.lifecycle).toBe('due');
    const resolutionId = beforeClose.judgments.get(record.judgment_id)?.resolution?.id;
    expect(resolutionId).toBeTruthy();
    const closed = closePluginRecord(decision, { ...record, events: [...record.events, ...answered] }, 'close-1', resolutionId!, '2026-09-03T00:00:00.000Z');
    expect(projectJudgment(fold([...record.events, ...answered, ...closed]), record.judgment_id, '2026-09-04T00:00:00.000Z')?.lifecycle).toBe('resolved_answered');
  });
});
