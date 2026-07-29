import { describe, expect, it, vi } from 'vitest';
import {
  canElicit,
  elicitDetailed,
  setElicitor,
  supportsReliableElicitation,
} from '../elicit.js';

describe('MCP host elicitation policy', () => {
  it('requires the protocol capability', () => {
    expect(supportsReliableElicitation({})).toBe(false);
    expect(supportsReliableElicitation(undefined)).toBe(false);
    expect(supportsReliableElicitation({ elicitation: {} })).toBe(true);
  });

  it('does not blacklist a capable Codex client by product name', () => {
    // The identity is deliberately absent from the policy API. Current Codex
    // app-server supports form elicitation when its outer client allows it.
    expect(supportsReliableElicitation({ elicitation: {} })).toBe(true);
  });

  /**
   * This assertion changed direction on 2026-07-29, and the reason is worth
   * keeping. It used to require that an immediate decline resolve to
   * `{ kind: 'declined' }` — the user's own act — on the reasoning that elapsed
   * time cannot separate a policy auto-reject from a person who answered fast.
   *
   * That reasoning is sound and is why nothing CONCLUDES from the timing. But it
   * does not follow that the safe report is "the user declined". Measured on a
   * real `codex app-server`: under `approval_policy = "never"` the request never
   * reaches anything that could render it and Codex declines on the user's
   * behalf in ~330ms. Calling that theirs credits a decision to someone who was
   * shown nothing and leaves them no way to continue.
   *
   * So the outcome is a NON-ANSWER: nothing recorded, nothing attributed, the
   * text path offered. The half both readings agreed on is unchanged and still
   * asserted below — the ask keeps going out, and no picker is disabled.
   */
  it('refuses to attribute an unreadably fast decline, and keeps later pickers alive', async () => {
    let calls = 0;
    setElicitor(async () => {
      calls++;
      return { action: 'decline' };
    }, () => true);
    try {
      await expect(elicitDetailed('first form', { type: 'object', properties: {} }))
        .resolves.toEqual({ kind: 'no_answer', reason: 'unattributable' });
      await expect(elicitDetailed('later form', { type: 'object', properties: {} }))
        .resolves.toEqual({ kind: 'no_answer', reason: 'unattributable' });
      // THE part that must never regress: the ask still went out both times, and
      // one "no" did not turn the session's pickers off.
      expect(calls).toBe(2);
      expect(canElicit()).toBe(true);
    } finally {
      setElicitor(null);
    }
  });

  it('does not infer user intent from elapsed time', async () => {
    let now = 0;
    const dateSpy = vi.spyOn(Date, 'now').mockImplementation(() => now);
    setElicitor(async () => {
      now += 24 * 60 * 60 * 1000;
      return { action: 'decline' };
    }, () => true);
    try {
      await expect(elicitDetailed('visible form', { type: 'object', properties: {} }))
        .resolves.toEqual({ kind: 'declined' });
      expect(canElicit()).toBe(true);
    } finally {
      dateSpy.mockRestore();
      setElicitor(null);
    }
  });

  it('turns a transport failure into a non-answer without disabling later calls', async () => {
    let calls = 0;
    setElicitor(async () => {
      calls++;
      if (calls === 1) throw new Error('method unavailable');
      return { action: 'accept', content: { answer: 'later' } };
    }, () => true);
    try {
      await expect(elicitDetailed('broken form', { type: 'object', properties: {} }))
        .resolves.toEqual({ kind: 'no_answer', reason: 'failed' });
      await expect(elicitDetailed('later form', { type: 'object', properties: {} }))
        .resolves.toEqual({ kind: 'accepted', content: { answer: 'later' } });
      expect(calls).toBe(2);
      expect(canElicit()).toBe(true);
    } finally {
      setElicitor(null);
    }
  });

  it('enforces a negative capability probe at the seam', async () => {
    let calls = 0;
    setElicitor(async () => {
      calls++;
      return { action: 'accept', content: {} };
    }, () => false);
    try {
      await expect(elicitDetailed('unsupported form', { type: 'object', properties: {} }))
        .resolves.toEqual({ kind: 'unsupported' });
      expect(calls).toBe(0);
    } finally {
      setElicitor(null);
    }
  });

  it('fails closed if the live capability probe itself throws', () => {
    setElicitor(async () => ({ action: 'accept', content: {} }), () => {
      throw new Error('host not initialized');
    });
    try {
      expect(canElicit()).toBe(false);
    } finally {
      setElicitor(null);
    }
  });
});
