/**
 * F3 — one honest routing authority.
 *  - sensitive anti-pattern = HARD ineligibility (legal), not a soft penalty;
 *  - assignment_reason speaks from the WINNER's own capability (not the fallible
 *    input classification that printed "legal strategy" on a marketing task);
 *  - no qualified bidder → honest "no strong fit"; a small margin → "near-tie".
 */

import { describe, it, expect } from 'vitest';
import { scoreAgentForTask } from '../agent-capabilities';
import { buildAssignmentReason } from '../assignment-reason';
import type { SelectionTrace } from '../orchestrator-select';
import type { Agent } from '@/stores/agent-types';

describe('F3e — sensitive anti-pattern is hard-ineligible', () => {
  it('an agent that anti-patterns legal_review is INELIGIBLE (-Infinity) for a legal task', () => {
    // hayoon (intern) antiPatterns include 'legal_review'.
    expect(scoreAgentForTask('hayoon', 'legal_review', null, 'legal', 'document')).toBe(-Infinity);
  });
  it('a NON-sensitive anti-pattern stays a soft penalty (not ineligible)', () => {
    // hayoon also antiPatterns 'calculation' — but calculation isn't sensitive.
    const s = scoreAgentForTask('hayoon', 'calculation', null, 'market', 'numbers');
    expect(s).toBeLessThan(0);
    expect(Number.isFinite(s)).toBe(true); // soft −0.4, not −Infinity
  });
});

const agents = new Map<string, Agent>([
  ['minjae', { id: 'minjae', name: '규민' } as Agent],
  ['sujin', { id: 'sujin', name: '다은' } as Agent],
]);

function trace(over: Partial<SelectionTrace>): SelectionTrace {
  return {
    stepIndex: 0,
    taskClassification: { taskType: 'strategy', secondaryType: null, contextDomain: 'legal', outputType: 'document' } as never,
    selectedAgent: 'minjae',
    scores: [{ agentId: 'minjae', baseScore: 0.5, experienceBoost: 0, total: 0.5 }],
    confidence: 0.5,
    outcome: 'awarded',
    ...over,
  };
}

describe('F3f — assignment_reason is honest', () => {
  it('derives the label from the WINNER’s own capability, not the (misfired) classification', () => {
    // Classification misfired to strategy/legal, but minjae's own strength is
    // calculation/market — the reason must reflect minjae, never "legal strategy".
    const reason = buildAssignmentReason(trace({}), agents);
    expect(reason.toLowerCase()).not.toContain('legal');
    expect(reason.toLowerCase()).not.toContain('strategy');
  });

  it('says "no strong fit" honestly when the bid was unfilled', () => {
    const reason = buildAssignmentReason(trace({ outcome: 'unfilled' }), agents);
    expect(reason).toMatch(/no strong fit|적합한 크루/i);
  });

  it('discloses a near-tie instead of a confident "best fit"', () => {
    const reason = buildAssignmentReason(trace({
      confidence: 0.03,
      scores: [
        { agentId: 'minjae', baseScore: 0.5, experienceBoost: 0, total: 0.5 },
        { agentId: 'sujin', baseScore: 0.47, experienceBoost: 0, total: 0.47 },
      ],
    }), agents);
    expect(reason).toMatch(/near-tie|접전/i);
    expect(reason).toContain('다은'); // the runner-up is named
  });
});
