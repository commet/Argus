import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * R42 — the stakeholder review's value is the SEAT, not the MBTI TYPE.
 *
 * Head-to-head (generic reviewer A vs MBTI persona B, 5 scaffolds, skeptic-refuted):
 * adds-value 4/5 but value_survived_skeptic 0/5 — ZERO value attributable to the
 * 4-letter type (the Barnum signature). The edge was BIMODAL: +6..+9 when the
 * persona's SEAT (its objective function: contracts / people / revenue /
 * system-ownership / compliance) contrasted the decision's default frame, but −13
 * in the one case where the seat coincided with the frame and the persona just
 * restated the generic concern LOUDER (value-NEGATIVE). Thesis refinement: "steal
 * the MBTI DELIVERY" is partly right, but the load-bearing primitive is the SEAT,
 * not the type ("reject the types" confirmed hard).
 *
 * Fix (both surfaces): anchor every concern to the SEAT's objective function;
 * suppress duplicates (never restate a generic concern louder in persona voice);
 * MBTI is a tone skin only, never the source, never surfaced as the type label.
 */
const boss = readFileSync(join(process.cwd(), 'argus-plugin-v2/skills/review/boss.md'), 'utf8');
const review = readFileSync(join(process.cwd(), 'src/lib/review-prompt.ts'), 'utf8');

describe('R42 — plugin boss anchors concerns to the SEAT, suppresses duplicates, demotes MBTI', () => {
  it('anchors every concern to the seat objective function, not the personality', () => {
    expect(boss).toMatch(/Anchor every concern to your SEAT/);
    expect(boss).toMatch(/objective function/i);
  });
  it('suppresses duplicate concerns (no louder restatement)', () => {
    expect(boss).toMatch(/Suppress duplicates/);
    expect(boss).toMatch(/restate it louder/i);
  });
  it('demotes MBTI to a tone skin, never the source / never the surfaced label', () => {
    expect(boss).toMatch(/tone skin only/);
    expect(boss).toMatch(/Barnum/);
  });
});

describe('R42 — webapp review prompt anchors to the seat on both locales', () => {
  it('en attitude block anchors concerns to the seat objective + suppresses louder restatement', () => {
    expect(review).toMatch(/Anchor every concern to YOUR SEAT/);
    expect(review).toMatch(/do NOT restate it louder/);
  });
  it('ko attitude block carries the same seat anchoring', () => {
    expect(review).toMatch(/자리\(seat\)/);
    expect(review).toMatch(/더 크게/);
  });
});

describe('O3 방3 — the plugin boss STRUCTURE is seat-first, not type-first', () => {
  // R42 fixed the prompt RULES; 방3 flips the remaining MBTI-first STRUCTURE
  // (required config key, type-labeled report header, forced catch-phrase gate,
  // minItems concern manufacturing). These pins keep it flipped.
  const configSchema = JSON.parse(
    readFileSync(join(process.cwd(), 'argus-plugin-v2/data/schemas/config.json'), 'utf8'),
  ) as { properties: { boss: { required: string[]; properties: Record<string, { description?: string }> } } };
  const dmSchema = JSON.parse(
    readFileSync(join(process.cwd(), 'argus-plugin-v2/data/schemas/dm-feedback.json'), 'utf8'),
  ) as { properties: { concerns: { minItems?: number; items: { required: string[] } } } };
  const configure = readFileSync(join(process.cwd(), 'argus-plugin-v2/skills/configure/SKILL.md'), 'utf8');

  it('config schema: boss no longer REQUIRES a type; seat fields exist; mbti_code is legacy tone alias', () => {
    const bossSchema = configSchema.properties.boss;
    expect(bossSchema.required).toEqual([]);
    for (const f of ['role', 'owns', 'goals', 'authority', 'tone']) {
      expect(bossSchema.properties[f], `boss.${f} must exist`).toBeDefined();
    }
    expect(bossSchema.properties['mbti_code']!.description).toMatch(/LEGACY/);
  });

  it('dm-feedback: empty concerns allowed (minItems concern-manufacturing retired), every concern carries seat_basis', () => {
    expect(dmSchema.properties.concerns.minItems).toBeUndefined();
    expect(dmSchema.properties.concerns.items.required).toContain('seat_basis');
  });

  it('boss step: seat block feeds the prompt; the report never surfaces the type label', () => {
    expect(boss).toMatch(/You own: \{\{boss\.owns\}\}/);
    expect(boss).toMatch(/Your authority: \{\{boss\.authority\}\}/);
    expect(boss).not.toMatch(/\{\{mbti_code\}\} \{\{boss\.name\}\}/); // 구 헤더 부활 금지
    expect(boss).not.toMatch(/literally the differentiator/); // 구 M7(MBTI=차별점) 부활 금지
    expect(boss).not.toMatch(/MUST contain at least one exact phrase/); // 입버릇 복창 게이트 은퇴
  });

  it('configure: gathers the seat, never quizzes the user into a type', () => {
    expect(configure).toMatch(/owns/);
    expect(configure).toMatch(/authority/);
    expect(configure).not.toMatch(/map to one of the 16/); // 2-question 성격 매퍼 은퇴
  });
});
