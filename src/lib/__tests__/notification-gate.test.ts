import { describe, expect, it } from 'vitest';
import { gateNotification, T1_RETURN_MAX_SENDS, USER_STANDALONE_WEEKLY_LIMIT } from '../notification-gate';

describe('notification gate', () => {
  it('allows the promised return before the T1 cap, then goes silent', () => {
    expect(gateNotification({
      type: 'T1_RETURN',
      channel: 'email',
      userId: 'u1',
      targetId: 'p1',
      reminderCount: T1_RETURN_MAX_SENDS - 1,
    })).toEqual({ decision: 'send', reason: 'allowed' });

    expect(gateNotification({
      type: 'T1_RETURN',
      channel: 'email',
      userId: 'u1',
      targetId: 'p1',
      reminderCount: T1_RETURN_MAX_SENDS,
    })).toEqual({ decision: 'silence', reason: 't1_send_cap' });
  });

  it('never sends T3 as a standalone notification', () => {
    expect(gateNotification({
      type: 'T3_OPEN_QUESTION',
      channel: 'email',
      userId: 'u1',
      contentCount: 1,
    })).toEqual({ decision: 'merge_into_brief', reason: 't3_brief_only' });
  });

  it('allows the first-settlement invitation through the same deterministic gate', () => {
    expect(gateNotification({
      type: 'T4_FIRST_SETTLEMENT',
      channel: 'email',
      userId: 'u1',
      targetId: 'p1',
      contentCount: 1,
    })).toEqual({ decision: 'send', reason: 'allowed' });
  });

  it('downgrades non-material premise drift into the brief', () => {
    expect(gateNotification({
      type: 'T2_PREMISE_DRIFT',
      channel: 'email',
      userId: 'u1',
      contentCount: 1,
      materiality: 'minor',
    })).toEqual({ decision: 'merge_into_brief', reason: 'minor_premise_to_brief' });
  });

  it('silences empty briefs', () => {
    expect(gateNotification({
      type: 'T5_WEEKLY_BRIEF',
      channel: 'email',
      userId: 'u1',
      contentCount: 0,
      isStandalone: false,
    })).toEqual({ decision: 'silence', reason: 'empty_content' });
  });

  it('merges standalone overflow into the weekly brief', () => {
    expect(gateNotification({
      type: 'T2_PREMISE_DRIFT',
      channel: 'email',
      userId: 'u1',
      contentCount: 1,
      materiality: 'material',
      standaloneSentThisWeek: USER_STANDALONE_WEEKLY_LIMIT,
    })).toEqual({ decision: 'merge_into_brief', reason: 'weekly_standalone_cap' });
  });

  it('honors decision/premise mute before any other rule', () => {
    expect(gateNotification({
      type: 'T5_WEEKLY_BRIEF',
      channel: 'email',
      userId: 'u1',
      contentCount: 3,
      muted: true,
    })).toEqual({ decision: 'silence', reason: 'muted' });
  });
});
