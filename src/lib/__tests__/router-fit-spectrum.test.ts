/**
 * F3-spectrum — the missing middle between "best fit" and "unfilled".
 *
 * The router used to treat capability fit as binary: any positive score was
 * assigned AND described as a confident best fit, so a 0.05 "nothing matched"
 * score masqueraded as a fit. This pins the honest three-tier reading:
 *   strong  (baseScore ≥ STRONG_FIT_THRESHOLD) → real specialist, "best fit"
 *   stretch (0 < baseScore < threshold)         → closest available, said plainly
 *   none    (baseScore ≤ 0)                      → 'unfilled' upstream
 *
 * Deliberately NOT dynamic role fabrication: a stretch names the honest gap
 * ("no specialist — closest fit"); it never invents an ad-hoc expert to stand in
 * for an absent qualified agent (CLAUDE.md "Honest gap over fabrication").
 */

import { describe, it, expect, vi } from 'vitest';

// buildAssignmentReason reads the active language; pin it per-test.
let LANG: 'ko' | 'en' = 'en';
vi.mock('@/lib/i18n', () => ({ getCurrentLanguage: () => LANG }));

import { fitTier, scoreAgentForTask, STRONG_FIT_THRESHOLD } from '@/lib/agent-capabilities';
import { buildAssignmentReason } from '@/lib/assignment-reason';
import type { SelectionTrace as Trace } from '@/lib/orchestrator-select';
import type { TaskClassification } from '@/lib/task-classifier';
import type { Agent } from '@/stores/agent-types';

const tc = (over: Partial<TaskClassification> = {}): TaskClassification =>
  ({ taskType: 'research', secondaryType: null, contextDomain: 'market', outputType: 'report', ...over } as TaskClassification);

const agent = (id: string, name: string): Agent => ({ id, name } as Agent);
const byId = (...as: Agent[]) => new Map(as.map(a => [a.id, a]));

describe('fitTier — absolute capability-fit boundary', () => {
  it('splits at STRONG_FIT_THRESHOLD', () => {
    expect(fitTier(STRONG_FIT_THRESHOLD)).toBe('strong');
    expect(fitTier(STRONG_FIT_THRESHOLD + 0.5)).toBe('strong');
    expect(fitTier(STRONG_FIT_THRESHOLD - 0.01)).toBe('stretch');
    expect(fitTier(0.05)).toBe('stretch');
  });
  it('treats a non-positive score as no fit (→ unfilled upstream)', () => {
    expect(fitTier(0)).toBe('none');
    expect(fitTier(-0.4)).toBe('none');
    expect(fitTier(-Infinity)).toBe('none');
  });
});

describe('scoreAgentForTask → tier on real profiles', () => {
  it('a specialist match is strong (규민/minjae on calculation·finance·numbers)', () => {
    const s = scoreAgentForTask('minjae', 'calculation', null, 'finance', 'numbers');
    expect(s).toBeGreaterThanOrEqual(STRONG_FIT_THRESHOLD);
    expect(fitTier(s)).toBe('strong');
  });
  it('a no-anti-pattern-but-unmatched task is a positive stretch (하윤/hayoon on planning·people)', () => {
    const s = scoreAgentForTask('hayoon', 'planning', null, 'people', 'plan');
    expect(s).toBeGreaterThan(0);
    expect(s).toBeLessThan(STRONG_FIT_THRESHOLD);
    expect(fitTier(s)).toBe('stretch');
  });
});

describe('buildAssignmentReason — surfaces the tier honestly', () => {
  const strongTrace = (): Trace => ({
    stepIndex: 0, taskClassification: tc({ taskType: 'calculation', contextDomain: 'finance' }),
    selectedAgent: 'minjae', outcome: 'awarded', fit: 'strong',
    scores: [{ agentId: 'minjae', baseScore: 0.9, experienceBoost: 0, total: 0.9 }],
  });
  const stretchTrace = (): Trace => ({
    stepIndex: 0, taskClassification: tc(),
    selectedAgent: 'hayoon', outcome: 'awarded', fit: 'stretch',
    scores: [{ agentId: 'hayoon', baseScore: 0.05, experienceBoost: 0, total: 0.05 }],
  });

  it('a strong fit reads as a confident best fit', () => {
    LANG = 'en';
    const r = buildAssignmentReason(strongTrace(), byId(agent('minjae', 'Ethan')));
    expect(r.toLowerCase()).toContain('best fit');
  });

  it('a stretch fit does NOT claim "best fit" — it names the gap', () => {
    LANG = 'en';
    const r = buildAssignmentReason(stretchTrace(), byId(agent('hayoon', 'Riley')));
    expect(r.toLowerCase()).not.toContain('best fit');
    expect(r.toLowerCase()).toContain('closest');
    expect(r).toContain('Riley');
  });

  it('the stretch line localizes (ko names the missing specialist, not "가장 적합")', () => {
    LANG = 'ko';
    const r = buildAssignmentReason(stretchTrace(), byId(agent('hayoon', '하윤')));
    expect(r).not.toContain('가장 적합');
    expect(r).toContain('가장 근접');
  });
});
