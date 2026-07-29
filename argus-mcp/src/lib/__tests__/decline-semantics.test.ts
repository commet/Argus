import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setElicitor, elicitDetailed, canElicit } from '../elicit.js';

beforeEach(() => {
  setElicitor(null);
  vi.useRealTimers();
});

describe('MCP decline semantics', () => {
  // Flipped 2026-07-29 on measurement. A real codex app-server with
  // elicitations blocked answers in 0.3-1.1ms; a human decline needs a render,
  // a read and a keypress (~1000ms). The two populations are ~1000x apart, so a
  // sub-5ms decline is a window that was never drawn — not a fast user. Calling
  // it theirs told someone they refused a dialog they never saw.
  // evals/decline-latency.mjs re-measures both sides on every verify.
  it('refuses to attribute a decline that no form could have preceded', async () => {
    setElicitor(async () => ({ action: 'decline' }), () => true);
    await expect(elicitDetailed('Record this?', {
      type: 'object',
      properties: {},
    })).resolves.toEqual({ kind: 'no_answer', reason: 'unattributable' });
  });

  it('honours a decline a person actually had time to make', async () => {
    setElicitor(async () => {
      await new Promise((r) => setTimeout(r, 120));
      return { action: 'decline' };
    }, () => true);
    await expect(elicitDetailed('Record this?', {
      type: 'object',
      properties: {},
    })).resolves.toEqual({ kind: 'declined' });
  });

  it('does not reinterpret the same wire action after an arbitrary time boundary', async () => {
    vi.useFakeTimers();
    setElicitor(async () => {
      await new Promise((resolve) => setTimeout(resolve, 60_000));
      return { action: 'decline' };
    }, () => true);

    const result = elicitDetailed('Record this?', {
      type: 'object',
      properties: {},
    });
    await vi.advanceTimersByTimeAsync(60_000);
    await expect(result).resolves.toEqual({ kind: 'declined' });
  });

  it('a decline never disables a later picker', async () => {
    let calls = 0;
    setElicitor(async () => {
      calls += 1;
      return calls === 1
        ? { action: 'decline' }
        : { action: 'accept', content: { outcome: 'held' } };
    }, () => true);

    await expect(elicitDetailed('First?', {
      type: 'object',
      properties: {},
    })).resolves.toEqual({ kind: 'no_answer', reason: 'unattributable' });
    expect(canElicit()).toBe(true);
    await expect(elicitDetailed('Second?', {
      type: 'object',
      properties: {},
    })).resolves.toEqual({ kind: 'accepted', content: { outcome: 'held' } });
  });

  it('keeps cancel and transport failure distinct from decline', async () => {
    setElicitor(async () => ({ action: 'cancel' }), () => true);
    await expect(elicitDetailed('Cancel?', {
      type: 'object',
      properties: {},
    })).resolves.toEqual({ kind: 'no_answer', reason: 'cancelled' });

    setElicitor(async () => { throw new Error('transport failed'); }, () => true);
    await expect(elicitDetailed('Failure?', {
      type: 'object',
      properties: {},
    })).resolves.toEqual({ kind: 'no_answer', reason: 'failed' });
  });
});
