import { describe, it, expect } from 'vitest';
import { effectiveWorkerLevel, numericLevelToAgentLevel } from '../agent-skills';

describe('effectiveWorkerLevel — "base skill always on"', () => {
  it('floors a brand-new (numeric level 1-2) agent to senior, not junior', () => {
    // The whole point: a fresh agent runs at its senior prompt + token budget
    // instead of the 800-token junior cap, since sealed-decision XP starts at 0.
    expect(effectiveWorkerLevel(1, 'minjae')).toBe('senior');
    expect(effectiveWorkerLevel(2, 'sujin')).toBe('senior');
    expect(effectiveWorkerLevel(1, 'chief_strategist')).toBe('senior');
  });

  it('floors to senior even with no agentId', () => {
    expect(effectiveWorkerLevel(1)).toBe('senior');
  });

  it('keeps earned senior/guru — XP is a bonus on top, never a regression', () => {
    expect(effectiveWorkerLevel(3, 'minjae')).toBe('senior');
    expect(effectiveWorkerLevel(5, 'chief_strategist')).toBe('guru');
  });

  it('keeps intern at junior for every level (its senior/guru prompts are placeholders)', () => {
    expect(effectiveWorkerLevel(1, 'hayoon')).toBe('junior');
    expect(effectiveWorkerLevel(3, 'hayoon')).toBe('junior');
    expect(effectiveWorkerLevel(5, 'hayoon')).toBe('junior');
  });

  it('does NOT mutate the raw numeric mapping (planning/tool/routing gates stay on agent.level)', () => {
    expect(numericLevelToAgentLevel(1)).toBe('junior');
    expect(numericLevelToAgentLevel(3)).toBe('senior');
    expect(numericLevelToAgentLevel(5)).toBe('guru');
  });
});
