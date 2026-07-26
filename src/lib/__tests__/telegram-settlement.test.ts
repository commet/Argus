import { describe, expect, it } from 'vitest';
import type { DecisionContract } from '@/stores/types';
import {
  applyTelegramSettlement,
  foundationPresentStandardReplyMarkup,
  foundationSettlementReplyMarkup,
  parseFoundationSettlementCallback,
  parseSettlementIntent,
  parseSemanticCloseCallback,
  semanticCloseReplyMarkup,
  settlementReminderText,
  settlementReplyMarkup,
  settlementToken,
} from '../telegram-settlement';
import { REMINDER_MAX_SENDS } from '../checkin-reminder';

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
      locale: 'en',
    })).toContain('ARGUS_SETTLE:p1:c1');
    expect(settlementReplyMarkup('p1').inline_keyboard.flat().map((b) => b.callback_data)).toContain('stl|pending|p1');
  });

  it('speaks the seal-core Korean voice by default (one reminder brain, 02 P0-1)', () => {
    const ko = settlementReminderText({
      projectName: '런칭 결정',
      projectId: 'p1',
      contractId: 'c1',
      predicate: '활성화 지표가 유지된다',
    });
    expect(ko).toContain('그래서, 어떻게 됐어요?');
    expect(ko).toContain('「런칭 결정」');
    expect(ko).toContain('확인할 것: 활성화 지표가 유지된다');
    expect(ko).toContain('ARGUS_SETTLE:p1:c1'); // reply-matching token stays, last line only
    expect(ko).not.toContain('Argus check-in'); // the cold machine voice is gone

    const en = settlementReminderText({ projectName: 'Launch', projectId: 'p1', locale: 'en' });
    expect(en).toContain('So — how did it go?');

    const koButtons = settlementReplyMarkup('p1', undefined, 'ko').inline_keyboard.flat().map((b) => b.text);
    expect(koButtons).toEqual(expect.arrayContaining(['✅ 잘 됐어요', '✋ 안 됐어요', '〰 반반', '⏳ 아직']));
  });

  it('keyboard carries five buttons — the fifth is the mute escape hatch (10 S3)', () => {
    const buttons = settlementReplyMarkup('p1', undefined, 'ko').inline_keyboard.flat();
    expect(buttons).toHaveLength(5);
    expect(buttons[4].text).toBe('🌙 그만 물어봐 주세요');
    expect(buttons[4].callback_data).toBe('stl|mute|p1');
    expect(parseSettlementIntent({ callbackData: 'stl|mute|p1' })).toEqual({
      projectId: 'p1',
      outcome: 'mute',
      source: 'callback',
    });

    // Packed (uuid) callbacks carry mute too, still under Telegram's 64-byte cap.
    const packed = settlementReplyMarkup(uuidProjectId, uuidContractId).inline_keyboard.flat();
    expect(packed).toHaveLength(5);
    expect(packed.every((b) => b.callback_data.length <= 64)).toBe(true);
    expect(parseSettlementIntent({ callbackData: packed[4].callback_data })).toEqual({
      projectId: uuidProjectId,
      contractId: uuidContractId,
      outcome: 'mute',
      source: 'callback',
    });
  });

  it('announces the last wave honestly when isFinal is set', () => {
    const text = settlementReminderText({ projectName: '런칭', projectId: 'p1', isFinal: true });
    expect(text).toContain('이제 조용히 열어둘게요');
    expect(settlementReminderText({ projectName: '런칭', projectId: 'p1' })).not.toContain('이제 조용히 열어둘게요');
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

  it('keeps a foundation return as two compact, kind-specific callbacks', () => {
    const first = foundationSettlementReplyMarkup(
      uuidProjectId,
      uuidContractId,
      'commitment',
      'en',
    ).inline_keyboard.flat();
    expect(first.map((button) => button.text)).toEqual(expect.arrayContaining([
      'I acted on the commitment',
      'The commitment still stands',
      'The commitment became moot',
    ]));
    expect(first.every((button) => button.callback_data.length <= 64)).toBe(true);
    const selected = parseFoundationSettlementCallback(first[0]?.callback_data);
    expect(selected).toEqual({
      projectId: uuidProjectId,
      contractId: uuidContractId,
      optionKind: 'commitment',
      optionId: 'enacted',
      source: 'callback',
    });

    const second = foundationPresentStandardReplyMarkup(
      uuidProjectId,
      uuidContractId,
      'commitment',
      'enacted',
      'en',
    ).inline_keyboard.flat();
    expect(second.every((button) => button.callback_data.length <= 64)).toBe(true);
    expect(parseFoundationSettlementCallback(second[1]?.callback_data)).toEqual({
      projectId: uuidProjectId,
      contractId: uuidContractId,
      optionKind: 'commitment',
      optionId: 'enacted',
      presentStandard: 'changed',
      source: 'callback',
    });
  });

  it('uses the record kind in the Telegram return question', () => {
    const commitment = settlementReminderText({
      projectName: 'Offer',
      projectId: 'p1',
      locale: 'en',
      kind: 'commitment',
    });
    expect(commitment).toContain('What happened to that commitment?');
    expect(commitment).toContain('Choose one button below.');
    expect(commitment).not.toContain('just reply');
    expect(settlementReminderText({
      projectName: '기준',
      projectId: 'p1',
      kind: 'declaration',
    })).toContain('그 기준을 지금은 어떻게 보고 있나요?');
  });

  it('keeps canonical close as a distinct callback from the answer buttons', () => {
    const button = semanticCloseReplyMarkup(uuidProjectId, uuidContractId).inline_keyboard[0][0];
    expect(button.callback_data).toMatch(/^stlc1\|/);
    expect(button.callback_data.length).toBeLessThanOrEqual(64);
    expect(parseSemanticCloseCallback(button.callback_data)).toEqual({ projectId: uuidProjectId, contractId: uuidContractId });
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

  it('mute stops the reminders without settling anything (escape hatch, 10 S3)', () => {
    const result = applyTelegramSettlement(contract(), { outcome: 'mute' }, Date.UTC(2026, 0, 9));
    expect(result.muted).toBe(true);
    expect(result.graded).toBe(0);
    expect(result.contract.reminder_count).toBe(REMINDER_MAX_SENDS);
    // The decision stays OPEN: check-in date untouched, no predicate graded.
    expect(result.contract.check_in_at).toBe('2026-01-08T00:00:00.000Z');
    expect(result.contract.predicates[0].verdict).toBeUndefined();
    expect(result.contract.graded_at).toBeUndefined();
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
