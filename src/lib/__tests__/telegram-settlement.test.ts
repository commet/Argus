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

const uuidProjectId = '11111111-1111-4111-8111-111111111111';
const uuidContractId = '22222222-2222-4222-8222-222222222222';

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

  it('parses Korean reply aliases and strips the alias from the note', () => {
    expect(parseSettlementIntent({
      replyText: `확인해 주세요\n${settlementToken('p1', 'c1')}`,
      text: '발생했어 - 활성화가 기준을 넘었어',
    })).toEqual({
      projectId: 'p1',
      contractId: 'c1',
      outcome: 'happened',
      note: '활성화가 기준을 넘었어',
      source: 'reply',
    });

    expect(parseSettlementIntent({
      replyText: `확인해 주세요\n${settlementToken('p1', 'c1')}`,
      text: '아직이야: 다음 주에 다시 볼게',
    })).toMatchObject({
      outcome: 'pending',
      note: '다음 주에 다시 볼게',
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

  it('parses command mode with the full reminder token so stale guards still work', () => {
    expect(parseSettlementIntent({ text: `/settle ${settlementToken('p1', 'c1')} happened checked from the reminder` })).toEqual({
      projectId: 'p1',
      contractId: 'c1',
      outcome: 'happened',
      note: 'checked from the reminder',
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

  it('packs project and contract ids into inline callbacks when ids are UUIDs', () => {
    const callbacks = settlementReplyMarkup(uuidProjectId, uuidContractId).inline_keyboard.flat().map((b) => b.callback_data);
    expect(callbacks.every((data) => data.length <= 64)).toBe(true);
    expect(callbacks).not.toContain(`stl|pending|${uuidProjectId}`);

    expect(parseSettlementIntent({ callbackData: callbacks[0] })).toEqual({
      projectId: uuidProjectId,
      contractId: uuidContractId,
      outcome: 'happened',
      source: 'callback',
    });
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
    expect(result.freeformClosed).toBe(false);
    expect(result.contract.history?.length).toBe(1);
    expect(result.contract.check_in_at).toBe('2026-01-16T00:00:00.000Z');
  });

  it('closes predicate-less date-only contracts like the web look-back path', () => {
    const dateOnly: DecisionContract = { ...contract(), predicates: [] };
    const result = applyTelegramSettlement(dateOnly, { outcome: 'partial', note: 'Looked back from Telegram.' }, Date.UTC(2026, 0, 9));

    expect(result.freeformClosed).toBe(true);
    expect(result.contract.graded_at).toBe('2026-01-09T00:00:00.000Z');
    expect(result.contract.check_in_at).toBeUndefined();
    expect(result.contract.check_in_interval).toBeUndefined();
    expect(result.contract.outcome_note).toBe('Looked back from Telegram.');
  });
});
