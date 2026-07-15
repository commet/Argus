import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { DEFAULT_BUDGET } from '@/lib/review';

describe('document review latency contract', () => {
  const flow = fs.readFileSync(path.resolve('src/components/review/ReviewFlow.tsx'), 'utf8');
  const pipeline = fs.readFileSync(path.resolve('src/lib/review/pipeline.ts'), 'utf8');

  it('keeps the complete five-lens judgment spine in quick mode', () => {
    expect(DEFAULT_BUDGET.quick.max_lens_calls).toBe(5);
  });

  it('routes short pasted documents through the quick budget', () => {
    expect(flow).toContain('sourceLength <= 6_000 && artifact.units.length <= 20');
    expect(flow).toContain('? DEFAULT_BUDGET.quick');
  });

  it('bounds compact pipeline stages to compact output sizes', () => {
    expect(pipeline).toContain("budget.depth === 'quick'");
    expect(pipeline).toContain('buildQuickReviewPrompt');
    expect(pipeline).toContain('Math.min(budget.max_tokens, 2800)');
    expect(pipeline).toContain('Math.min(budget.max_tokens, 2500)');
    expect(pipeline).toContain('maxTokens: 1600');
    expect(pipeline).toContain('maxTokens: 2000');
  });

  it('locks fast-path output to one language and requires material anchored findings', () => {
    const prompts = fs.readFileSync(path.resolve('src/lib/review/prompts.ts'), 'utf8');
    // Output language is pinned by the shared langDirective (reader's locale),
    // appended last so it overrides the Korean scaffold above it — and it
    // forbids mixing the two languages in the JSON values.
    expect(prompts).toContain('function langDirective(lang: ReviewLocale)');
    expect(prompts).toContain('${langDirective(lang)}');
    expect(prompts).toContain('must never mix the two');
    expect(prompts).toContain('두 언어를 섞지 않는다');
    expect(prompts).toContain('return 2 to 5 material findings');
    expect(prompts).toContain('Copy one exact snake_case lens_id');
  });

  it('does not blame a short input for provider latency', () => {
    expect(flow).toContain('취소해도 입력 내용은 그대로 남아 있어요');
    expect(flow).toContain('longSource');
  });
});
