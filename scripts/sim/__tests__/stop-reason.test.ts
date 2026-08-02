import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const shim = readFileSync(new URL('../llm-shim.mjs', import.meta.url), 'utf8');
const runner = readFileSync(new URL('../run-sim.mjs', import.meta.url), 'utf8');

describe('simulation completion evidence', () => {
  it('retains the provider stop reason through the saved call record', () => {
    expect(shim).toContain('stopReason: data.stop_reason || null');
    expect(shim).toContain('entry.stopReason = stopReason');
    expect(runner).toContain('stopReason: c.stopReason');
  });
});
