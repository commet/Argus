import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = readFileSync(new URL('../InteractiveDemo.tsx', import.meta.url), 'utf8');

describe('InteractiveDemo review language', () => {
  it('shows review functions instead of a fictional AI team', () => {
    expect(source).toContain('personaReviewLabel');
    expect(source).toContain("L('검토 과정', 'Review process')");
    expect(source).toContain("L('검토에서 남은 한 줄들', 'What each review surfaced')");
    expect(source).not.toContain('{worker.persona.name}');
    expect(source).not.toContain('{thirdWorker.persona.name}');
    expect(source).not.toContain("L('분석 팀', 'Analysis Team')");
  });
});
