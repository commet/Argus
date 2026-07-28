import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const pipeline = readFileSync(
  join(process.cwd(), 'argus-plugin-v2/skills/review/pipeline.md'),
  'utf8',
);
const resolve = readFileSync(
  join(process.cwd(), 'argus-plugin-v2/skills/resolve/SKILL.md'),
  'utf8',
);

describe('foundation seal — a returnable prediction remains answerable by reality', () => {
  it('the legacy contract seed still requires pass and fail conditions', () => {
    expect(pipeline).toMatch(/pass_condition/);
    expect(pipeline).toMatch(/fail_condition/);
  });

  it('an unfalsifiable seed is refused instead of sealed as a vibe', () => {
    expect(pipeline).toMatch(/not falsifiable.*write\s*`?null`?|cannot name (a )?(one|fail).*null/i);
    expect(pipeline).toMatch(/[Cc]ontract seed must be falsifiable/);
  });
});

describe('foundation return — original first, authorial answer, separate axes', () => {
  it('shows the sealed sentence before any answer choices', () => {
    const original = resolve.indexOf('## 2. Show the original before controls');
    const choices = resolve.indexOf('## 3. Ask one kind-appropriate question');
    expect(original).toBeGreaterThan(-1);
    expect(choices).toBeGreaterThan(original);
    expect(resolve).toMatch(/Never lead with an AI summary or a verdict/);
  });

  it('has honest indeterminate and moot exits with no more than five choices', () => {
    expect(resolve).toMatch(/no more than five choices/i);
    expect(resolve).toMatch(/not_observable/);
    expect(resolve).toMatch(/moot/);
  });

  it('records reality, commitment, and question validity without collapsing them', () => {
    expect(resolve).toMatch(/--reality/);
    expect(resolve).toMatch(/--commitment/);
    expect(resolve).toMatch(/--question-validity/);
    expect(resolve).toMatch(/--present-standard/);
  });

  it('the user supplies the answer and the model never infers it', () => {
    expect(resolve).toMatch(/The user supplies the authorial answer; Argus never infers it/);
    expect(resolve).toMatch(/Do not show held\/missed totals, accuracy, hit rate, a score/i);
  });
});
