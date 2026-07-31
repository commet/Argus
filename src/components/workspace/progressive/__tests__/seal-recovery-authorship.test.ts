/**
 * The recovery seal must not launder the AI's sentence as the user's.
 *
 * Found 2026-08-01 by audit: SealMoment's manualSeal() — the path that runs
 * whenever premise extraction comes back empty, which the v2 harness made the
 * COMMON case — hardcoded `authored: 'user'`, sealed the pre-filled AI draft
 * (the box starts as aiDraftJudgment), told the user "검토 전에 직접 남긴
 * 문장을 기준으로 기록합니다", and hid the textarea so they could not see it.
 * Three lies stacked on CLAUDE.md rule 1 ("never lie about authorship").
 *
 * The authorship verdict itself lives in one pure function; these tests pin
 * (a) that function's behaviour for the recovery cases, and (b) that the
 * recovery path in the component actually calls it and always shows the box.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { closingJudgmentAuthorship } from '@/lib/judgment-authorship';

const source = readFileSync(
  join(process.cwd(), 'src/components/workspace/progressive/SealMoment.tsx'),
  'utf8',
);
const manualSeal = source.slice(
  source.indexOf('function manualSeal'),
  source.indexOf('function manualSeal') + 2600,
);

describe('recovery seal — authorship is decided, never assumed', () => {
  it('an untouched AI draft stays the AI’s, adopted by the user', () => {
    const verdict = closingJudgmentAuthorship({
      text: '이직 여부는 아직 열려 있고 승진은 구두 단계예요.',
      aiDraft: '이직 여부는 아직 열려 있고 승진은 구두 단계예요.',
      touched: false,
      now: 1_700_000_000_000,
    });
    expect(verdict.authored).toBe('ai_surfaced');
  });

  it('a sentence the user actually reworded becomes theirs', () => {
    const verdict = closingJudgmentAuthorship({
      text: '문서로 확정되면 남고, 아니면 옮긴다.',
      aiDraft: '이직 여부는 아직 열려 있어요.',
      touched: true,
      now: 1_700_000_000_000,
    });
    expect(verdict.authored).toBe('user');
  });

  it('manualSeal asks that function instead of stamping "user" itself', () => {
    expect(manualSeal).toContain('closingJudgmentAuthorship');
    expect(manualSeal).not.toMatch(/authored:\s*'user'\s*as const/);
  });

  it('an untouched box seals the user’s own baseline, not the AI draft', () => {
    // The box is pre-filled with the AI draft, so "what is in the box" is not
    // evidence of what the user wrote.
    expect(manualSeal).toContain('judgmentTouched');
    expect(manualSeal).toContain('baselineJudgment');
    expect(manualSeal).not.toMatch(/const recoveryJudgment = humanJudgment\.trim\(\) \|\| baselineJudgment/);
  });

  it('the sentence being sealed is always visible and editable', () => {
    // The textarea must not be hidden behind "no baseline exists".
    expect(source).not.toContain('{!baselineJudgment && (');
  });
});
