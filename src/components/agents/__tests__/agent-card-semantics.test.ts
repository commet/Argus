import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = readFileSync(new URL('../AgentCard.tsx', import.meta.url), 'utf8');

describe('AgentCard controls', () => {
  it('uses native button behavior for an available review mode', () => {
    expect(source).toContain('<button');
    expect(source).toContain('type="button"');
    expect(source).not.toContain('role="button"');
    expect(source).not.toContain('onKeyDown=');
  });
});
