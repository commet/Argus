import { describe, it, expect } from 'vitest';
import { planOrchestration } from '../orchestration-pattern';
import type { InputClassification } from '../orchestrator-classify';

const cls = (stakes: InputClassification['stakes'], decisionType = 'needs_analysis'): InputClassification =>
  ({ stakes, domains: [], decisionType, agentCount: 3 });

describe('planOrchestration', () => {
  it('a single lens → single pattern, regardless of stakes', () => {
    expect(planOrchestration(cls('important'), 1).pattern).toBe('single');
    expect(planOrchestration(cls('critical'), 1).pattern).toBe('single');
  });

  it('routine + few lenses → parallel with light verify (keeps small things small)', () => {
    const p = planOrchestration(cls('routine'), 2);
    expect(p.pattern).toBe('parallel');
    expect(p.verifyDepth).toBe('light');
  });

  it('important → parallel with standard verify', () => {
    const p = planOrchestration(cls('important'), 3);
    expect(p.pattern).toBe('parallel');
    expect(p.verifyDepth).toBe('standard');
  });

  it('critical → review_loop with deep verify', () => {
    const p = planOrchestration(cls('critical'), 4);
    expect(p.pattern).toBe('review_loop');
    expect(p.verifyDepth).toBe('deep');
  });

  it('on_fire crisis → review_loop + deep even when stakes is only important', () => {
    const p = planOrchestration(cls('important', 'on_fire'), 3);
    expect(p.pattern).toBe('review_loop');
    expect(p.verifyDepth).toBe('deep');
  });

  it('user leaning on an important call → deep verify (confirmation-bias guard)', () => {
    const p = planOrchestration(cls('important'), 3, { userLeaning: true });
    expect(p.verifyDepth).toBe('deep');
    expect(p.pattern).toBe('review_loop');
  });

  it('a routine lean does NOT escalate to deep (no over-fire on flat calls)', () => {
    const p = planOrchestration(cls('routine'), 2, { userLeaning: true });
    expect(p.verifyDepth).toBe('light');
  });

  it('verification is ALWAYS present — every run gets at least a light check', () => {
    for (const s of ['routine', 'important', 'critical'] as const) {
      for (const n of [1, 2, 3, 5]) {
        expect(['light', 'standard', 'deep']).toContain(planOrchestration(cls(s), n).verifyDepth);
      }
    }
  });
});
