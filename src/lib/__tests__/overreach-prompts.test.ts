import { describe, it, expect, vi } from 'vitest';
// progressive-prompts transitively imports the supabase client (via worker-personas
// → db); stub it so module load doesn't require runtime env in the test.
vi.mock('@/lib/supabase', () => ({
  supabase: {},
  getCurrentUserId: () => Promise.resolve(null),
  clearUserCache: () => {},
  withUser: () => Promise.resolve(null),
}));
import { buildOverreachPrompt, buildHighestLoadPrompt, buildExecutionPlanPrompt } from '../progressive-prompts';
import type { MixResult } from '@/stores/types';

const mix: MixResult = {
  title: 'Launch the referral program',
  executive_summary: 'Ship a referral loop to grow signups.',
  sections: [{ heading: 'Plan', content: 'Invite existing users to refer friends.' }],
  key_assumptions: ['Users will share', 'Friends will convert'],
  next_steps: ['Build the invite flow'],
};

const snapshot = {
  real_question: 'Will a referral loop actually move signups?',
  hidden_assumptions: ['Users are happy enough to refer'],
  weakest_assumption: { assumption: 'Existing users will actively refer', explanation: 'No evidence of advocacy yet' },
};

describe('buildOverreachPrompt', () => {
  it('returns a system+user pair', () => {
    const { system, user } = buildOverreachPrompt(snapshot, mix);
    expect(system.length).toBeGreaterThan(0);
    expect(user.length).toBeGreaterThan(0);
  });

  it('embeds the plan (mix) content in the user prompt', () => {
    const { user } = buildOverreachPrompt(snapshot, mix);
    expect(user).toContain('Launch the referral program');
    expect(user).toContain('Invite existing users to refer friends.');
    expect(user).toContain('Users will share');
  });

  it('anchors escalation on the weakest assumption', () => {
    const { user } = buildOverreachPrompt(snapshot, mix);
    expect(user).toContain('Existing users will actively refer');
    // The escalation rule is stated in the system prompt.
    expect(buildOverreachPrompt(snapshot, mix).system.toLowerCase()).toContain('load-bearing');
  });

  it('asks for a strength + a claims array in the JSON schema', () => {
    const { user } = buildOverreachPrompt(snapshot, mix);
    expect(user).toContain('"strength"');
    expect(user).toContain('"claims"');
  });

  it('switches language with locale', () => {
    expect(buildOverreachPrompt(snapshot, mix, 'ko').system).toContain('Korean');
    expect(buildOverreachPrompt(snapshot, mix, 'en').system).toContain('English');
    expect(buildOverreachPrompt(snapshot, mix, 'ko').system).toContain('해요체');
  });

  it('wraps user-derived text in <user-data> (prompt-injection guard)', () => {
    const { user } = buildOverreachPrompt(snapshot, mix);
    expect(user).toContain('<user-data>');
    expect(user).toContain('</user-data>');
  });

  it('does not throw when optional snapshot fields are absent', () => {
    expect(() => buildOverreachPrompt({}, mix)).not.toThrow();
  });
});

describe('buildHighestLoadPrompt', () => {
  it('lists the accepted claims and asks for one riskiest assumption', () => {
    const claims = ['c1', 'c2', 'c3'];
    const { system, user } = buildHighestLoadPrompt(claims, snapshot);
    expect(user).toContain('c1');
    expect(user).toContain('c3');
    expect(user).toContain('"text"');
    expect(system.toLowerCase()).toContain('riskiest');
  });

  it('includes the weakest-assumption hint when present', () => {
    const { user } = buildHighestLoadPrompt(['c1'], snapshot);
    expect(user).toContain('Existing users will actively refer');
  });

  it('switches language with locale', () => {
    expect(buildHighestLoadPrompt(['c1'], snapshot, 'ko').system).toContain('Korean');
    expect(buildHighestLoadPrompt(['c1'], snapshot, 'en').system).toContain('English');
  });
});

// F4-bar — the crew-sizing bar (mirror clause: over-firing a committee on a flat
// routine decision is itself a spine violation). The plan-generation prompt must
// instruct the model to default to ONE ai lens and scale up only when the decision
// earns it. If this instruction is deleted, routine decisions silently regrow a
// multi-lens committee (ceremony, not insight) — so guard the bar here.
describe('buildExecutionPlanPrompt — crew-sizing bar (F4)', () => {
  const analysis = {
    real_question: 'Should we switch the button copy?',
    hidden_assumptions: ['Copy drives clicks'],
    skeleton: ['Draft variants', 'Pick one'],
  };
  const qa: Parameters<typeof buildExecutionPlanPrompt>[2] = [];

  it('instructs restraint: default to a single AI lens', () => {
    const { system } = buildExecutionPlanPrompt('problem', analysis, qa, 1);
    const s = system.toLowerCase();
    expect(s).toContain('single');
    // the bar must name the scale-up condition (important / hard-to-reverse / 3+ domains)
    expect(s.includes('hard-to-reverse') || s.includes('irreversible')).toBe(true);
    expect(s).toContain('3+');
  });

  it('does not conflate a sequential dependency chain with an independent lens', () => {
    const { system } = buildExecutionPlanPrompt('problem', analysis, qa, 1);
    // the depends_on chain must be explicitly excluded from the lens limit
    expect(system.toLowerCase()).toContain('depends_on');
    expect(system).toMatch(/not a ["“]?lens/i);
  });

  it('switches language with locale (bar survives localization)', () => {
    expect(buildExecutionPlanPrompt('p', analysis, qa, 1, undefined, 'ko').system).toContain('Korean');
    expect(buildExecutionPlanPrompt('p', analysis, qa, 1, undefined, 'en').system).toContain('English');
  });
});
