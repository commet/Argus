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
   * This assertion flipped on 2026-07-29, on evidence rather than argument.
   *
   * It used to require that an INSTANT decline resolve to `{ kind: 'declined' }`
   * — the user's own act — because elapsed time supposedly cannot separate a
   * policy rejection from a fast human. That reasoning was tested by measuring
   * both populations against a real `codex app-server`:
   *
   *     policy rejection   0.3 · 0.3 · 0.3 · 0.4 · 1.1 ms   (no UI in the path)
   *     fastest human      ~1000 ms                          (render, read, key)
   *
   * They do not overlap; they are ~1000x apart. So a decline under 5ms is not a
   * fast user, it is a window that was never drawn, and calling it theirs told
   * someone they refused a dialog they were never shown — then ended the turn
   * with next_actions:["stop"]. evals/decline-latency.mjs re-measures this on
   * every verify and fails if the two populations ever approach each other.
   *
   * The half both designs always agreed on is unchanged below: the ask keeps
   * going out, and one "no" never disables a later picker.
   */
  it('refuses to attribute a decline no form could have preceded, and keeps later pickers alive', async () => {
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
