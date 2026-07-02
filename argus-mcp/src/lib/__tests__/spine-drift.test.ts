import { describe, it, expect } from 'vitest';
import { TOOLS } from '../../tools/index.js';
import { NEXT_ACTIONS, FORBIDDEN_VERDICT_VERBS, FORBIDDEN_FORK_KEYS } from '../spine.js';
import { openDecision } from '../../tools/open-decision.js';

/**
 * The drift guard (blueprint §3.6). If a future edit reintroduces a verdict
 * surface on any of the three Argus bodies, this fails CI.
 */
describe('spine drift guard', () => {
  it('exposes no verdict/grade/score tool', () => {
    for (const t of TOOLS) {
      for (const verb of FORBIDDEN_VERDICT_VERBS) {
        expect(t.name.toLowerCase()).not.toContain(verb);
      }
    }
  });

  it('next_actions enum contains no judgment verb', () => {
    for (const action of NEXT_ACTIONS) {
      for (const verb of FORBIDDEN_VERDICT_VERBS) {
        expect(action.toLowerCase()).not.toContain(verb);
      }
    }
  });

  it('open_decision output cannot express a fork or a lean', () => {
    const schema = JSON.stringify(openDecision.outputSchema ?? {});
    // The structured output is the generic envelope; fork keys must never be added as required output.
    for (const key of FORBIDDEN_FORK_KEYS) {
      // a defensive check: no fork key is a declared output property
      expect(JSON.parse(schema).properties?.[key]).toBeUndefined();
    }
  });

  it('no tool input or output schema can express a fork or a lean', () => {
    // plan v5 §3/§4: resolve is elicitation-only; recheck returns the handle.
    // If a future edit adds an options/lean-shaped field anywhere, this fails.
    for (const t of TOOLS) {
      const out = JSON.stringify(t.outputSchema ?? {});
      for (const key of FORBIDDEN_FORK_KEYS) {
        expect(JSON.parse(out).properties?.[key], `${t.name} output declares "${key}"`).toBeUndefined();
      }
      const input = t.inputSchema ? JSON.stringify((t.inputSchema as { shape?: Record<string, unknown> }).shape ? Object.keys((t.inputSchema as unknown as { shape: Record<string, unknown> }).shape) : []) : '[]';
      for (const key of FORBIDDEN_FORK_KEYS) {
        expect(input.includes(`"${key}"`), `${t.name} input declares "${key}"`).toBe(false);
      }
    }
  });

  it('every tool declares an input schema and a name', () => {
    for (const t of TOOLS) {
      expect(t.name).toMatch(/^argus_/);
      expect(t.inputSchema).toBeTruthy();
    }
  });
});
