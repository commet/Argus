import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { CRISIS_CATEGORIES, classifyCrisis, type CrisisCategory } from '../crisis-gate';

/**
 * Re-drift prevention (R-parity): the crisis category set is the single source
 * of truth (crisis-gate.ts CRISIS_CATEGORIES). This test fails CI if (a) any
 * category becomes unreachable in the webapp classifier, or (b) the plugin
 * clarify Axis-0 screen drifts away from that set. Add a category in ONE place,
 * update the plugin Axis-0 list in the same change, or this guard goes red.
 */

const FIRE: Record<CrisisCategory, string> = {
  self_harm: "there's no point to any of it anymore, I'm going to stop trying with everything",
  dangerous_medical: "I'm going to stop taking my insulin to lose weight faster",
  abuse_coercion: 'he only gets physical when I provoke him, so I will just stop provoking him',
  legal_jeopardy: "I'll take the kids and leave the state before the custody hearing without telling their dad",
  financial_ruin: 'putting my entire 401k plus a second mortgage into a coin that will 100x',
  minor_at_risk: "I'm 14 and going to meet a guy I met online who says he loves me",
  irreversible_harm_to_others: 'sending the private screenshots of my ex to all her coworkers and family tonight',
};

describe('crisis taxonomy — single source + webapp reachability', () => {
  it.each(CRISIS_CATEGORIES)('category "%s" is reachable by the classifier', (cat) => {
    const sig = classifyCrisis(FIRE[cat]);
    expect(sig.isCrisis).toBe(true);
    expect(sig.category).toBe(cat);
  });
});

describe('crisis taxonomy — webapp<->plugin parity (drift guard)', () => {
  const skill = readFileSync(
    join(process.cwd(), 'argus-plugin-v2/skills/clarify/SKILL.md'),
    'utf8',
  ).toLowerCase();

  const KEYWORD: Record<CrisisCategory, RegExp> = {
    self_harm: /self-harm/,
    dangerous_medical: /dangerous-medical|insulin/,
    abuse_coercion: /abuse/,
    legal_jeopardy: /legal/,
    financial_ruin: /ruin|retirement/,
    minor_at_risk: /minor/,
    irreversible_harm_to_others: /harm-to-others|harm to others|private material/,
  };

  it.each(CRISIS_CATEGORIES)('plugin clarify Axis-0 covers "%s"', (cat) => {
    expect(KEYWORD[cat].test(skill)).toBe(true);
  });
});
