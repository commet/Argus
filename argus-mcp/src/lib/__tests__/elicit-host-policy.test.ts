import { describe, expect, it } from 'vitest';
import {
  canElicit,
  elicitDetailed,
  INVISIBLE_DECLINE_MAX_MS,
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

  it('turns an impossibly fast synthetic decline into a non-answer and trips the circuit', async () => {
    let calls = 0;
    setElicitor(async () => {
      calls++;
      return { action: 'decline' };
    }, () => true);
    try {
      await expect(elicitDetailed('invisible form', { type: 'object', properties: {} }))
        .resolves.toEqual({ kind: 'no_answer', reason: 'failed' });
      expect(calls).toBe(1);
      expect(canElicit()).toBe(false);
    } finally {
      setElicitor(null);
    }
  });

  it('preserves a decline that took long enough to be a human answer', async () => {
    setElicitor(async () => {
      await new Promise((resolve) => setTimeout(resolve, INVISIBLE_DECLINE_MAX_MS + 50));
      return { action: 'decline' };
    }, () => true);
    try {
      await expect(elicitDetailed('visible form', { type: 'object', properties: {} }))
        .resolves.toEqual({ kind: 'declined' });
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
