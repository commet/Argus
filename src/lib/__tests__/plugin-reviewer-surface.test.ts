import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const agentsDir = path.join(process.cwd(), 'argus-plugin-v2', 'agents');

describe('plugin reviewer surface', () => {
  it('is bounded and independent from the historical web persona roster', () => {
    const files = fs.readdirSync(agentsDir).filter((name) => name.endsWith('.md')).sort();
    expect(files).toEqual([
      'domain-reviewer.md',
      'evidence-reviewer.md',
      'risk-reviewer.md',
      'synthesizer.md',
    ]);
    for (const file of files) {
      const body = fs.readFileSync(path.join(agentsDir, file), 'utf8');
      expect(body).toContain('model: inherit');
      expect(body).toMatch(/maxTurns:\s*\d+/);
      expect(body).not.toContain('model: sonnet');
    }
    expect(fs.existsSync(path.join(process.cwd(), 'argus-plugin-v2', 'data', 'agents.yaml'))).toBe(false);
  });
});
