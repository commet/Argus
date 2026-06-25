import { describe, expect, it } from 'vitest';
import type { DecisionContract } from '@/stores/types';
import {
  applyTelegramSettlement,
  parseSettlementIntent,
  settlementReminderText,
  settlementReplyMarkup,
  settlementToken,
} from '../telegram-settlement';

const contract = (): DecisionContract => ({
  id: 'c1',
  project_id: 'p1',
  created_at: '2026-01-01T00:00:00.000Z',
  check_in_at: '2026-01-08T00:00:00.000Z',
  predicates: [
    { id: 'pred_1', source: 'governing_idea', text: 'Users will activate.' },
    { id: 'pred_2', source: 'risk', text: 'Support load will not spike.', verdict: 'avoided', graded_at: '2026-01-02T00:00:00.000Z' },
  ],
});

describe('telegram settlement intent parsing', () => {
  it('parses inline keyboard callback data', () => {
    expect(parseSettlementIntent({ callbackData: 'stl|partial|p1' })).toEqual({
      projectId: 'p1',
      outcome: 'partial',
      source: 'callback',
    });
  });

  it('parses a reply against the hidden settlement token', () => {
    expect(parseSettlementIntent({
      replyText: `Check this\n${settlementToken('p1', 'c1')}`,
      text: 'happened - activation beat the target',
    })).toEqual({
      projectId: 'p1',
      contractId: 'c1',
      outcome: 'happened',
      note: 'activation beat the target',
      source: 'reply',
    });
  });

  it('parses command mode for non-reply clients', () => {
    expect(parseSettlementIntent({ text: '/settle p1 avoided launch was quieter than expected' })).toEqual({
      projectId: 'p1',
      outcome: 'avoided',
      note: 'launch was quieter than expected',
      source: 'command',
    });
  });

  it('builds a compact reminder with callback buttons', () => {
    expect(settlementReminderText({
      projectName: 'Launch',
      projectId: 'p1',
      contractId: 'c1',
      predicate: 'Activation holds',
    })).toContain('ARGUS_SETTLE:p1:c1');
    expect(settlementReplyMarkup('p1').inline_keyboard.flat().map((b) => b.callback_data)).toContain('stl|pending|p1');
  });
});

describe('applyTelegramSettlement', () => {
  it('grades only unresolved predicates and preserves existing verdicts', () => {
    const result = applyTelegramSettlement(contract(), { outcome: 'happened', note: 'It worked.' }, Date.UTC(2026, 0, 9));
    expect(result.graded).toBe(1);
    expect(result.contract.predicates[0].verdict).toBe('happened');
    expect(result.contract.predicates[1].verdict).toBe('avoided');
    expect(result.contract.graded_at).toBeTruthy();
    expect(result.contract.outcome_note).toBe('It worked.');
  });

  it('extends the check-in by one week when still pending', () => {
    const result = applyTelegramSettlement(contract(), { outcome: 'pending' }, Date.UTC(2026, 0, 9));
    expect(result.deferred).toBe(true);
    expect(result.contract.history?.length).toBe(1);
    expect(result.contract.check_in_at).toBe('2026-01-16T00:00:00.000Z');
  });
});
