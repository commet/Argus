import { describe, it, expect } from 'vitest';
import { buildWorkerTaskPrompt } from '../progressive-prompts';

// Minimal context — buildWorkerTaskPrompt only needs the shape, not real data.
const ctx = {
  problemText: 'should we adopt X',
  realQuestion: 'is X worth it',
  skeleton: [] as string[],
  hiddenAssumptions: [] as string[],
  qaHistory: [] as Array<{ q: string; a: string }>,
};

const mkAgent = (id: string, level = 1) =>
  ({
    id,
    level,
    name: '규민',
    nameEn: 'Ethan',
    role: '숫자 분석가',
    roleEn: 'Numbers Analyst',
    expertise: '',
    tone: '',
  }) as never;

describe('worker outputFormat budgeting', () => {
  it('scopes the response to a word budget at the senior-floored level (1500*0.6=900)', () => {
    const { system } = buildWorkerTaskPrompt(
      'do X', 'out', 'ai', ctx, undefined, 'junior', mkAgent('minjae'), undefined, undefined, 'en',
    );
    expect(system).toContain('within roughly 900 words');
    expect(system).toContain('instead of padding');
  });

  it('keeps intern at the junior budget (800*0.6=480) — base-skill-on does not lift intern', () => {
    const { system } = buildWorkerTaskPrompt(
      'do X', 'out', 'ai', ctx, undefined, 'junior', mkAgent('hayoon'), undefined, undefined, 'en',
    );
    expect(system).toContain('within roughly 480 words');
  });

  // The AI/human role split (ai_scope/self_scope) used to be generated + shown in
  // the UI but never reached the prompt — the split was decorative to the model.
  // These lock the wiring: the AI now SEES its scope and the human's boundary.
  it('injects ai_scope + self_scope into the worker user prompt when provided', () => {
    const { user } = buildWorkerTaskPrompt(
      'decide the launch', 'a memo', 'human', ctx, undefined, 'junior', undefined, undefined, undefined, 'en',
      'gather and summarize the migration data', 'the final go/no-go call',
    );
    expect(user).toContain('gather and summarize the migration data');
    expect(user).toContain('the final go/no-go call');
    // The human-boundary instruction must be present so the AI doesn't decide it.
    expect(user).toContain('do NOT make the decision for them');
  });

  it('adds no scope lines when ai_scope/self_scope are absent (no fabrication)', () => {
    const { user } = buildWorkerTaskPrompt(
      'do X', 'out', 'ai', ctx, undefined, 'junior', undefined, undefined, undefined, 'en',
    );
    expect(user).not.toContain('the part the AI handles');
    expect(user).not.toContain('will SEPARATELY judge');
  });

  it('adds the framework-focus note only when a framework is assigned', () => {
    const unfocused = buildWorkerTaskPrompt(
      'do X', 'out', 'ai', ctx, undefined, 'junior', mkAgent('minjae'), undefined, undefined, 'en',
    ).system;
    expect(unfocused).not.toContain('scoped to the assigned framework');

    const focused = buildWorkerTaskPrompt(
      'do X', 'out', 'ai', ctx, undefined, 'junior', mkAgent('minjae'), 'Market Sizing', undefined, 'en',
    ).system;
    expect(focused).toContain('scoped to the assigned framework');
  });
});
