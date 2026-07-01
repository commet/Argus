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

  it('every tool declares an input schema and a name', () => {
    for (const t of TOOLS) {
      expect(t.name).toMatch(/^argus_/);
      expect(t.inputSchema).toBeTruthy();
    }
  });
});
