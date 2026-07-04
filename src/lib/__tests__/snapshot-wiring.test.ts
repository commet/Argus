import { describe, it, expect } from 'vitest';
import { compactSnapshots } from '../compact-context';
import type { AnalysisSnapshot } from '@/stores/types';

// The user's own chosen decision (strategic_fork.decision_line) and 3-day plan
// (weakness_check.next_three_days) used to be captured on the snapshot but never
// fed into the mix prompt — human judgment dropped downstream (dead-wiring, same
// class as the ai_scope bug). compactSnapshots → formatSnapshot is what
// buildMixPrompt injects, so these lock the wiring.
const base: AnalysisSnapshot = {
  version: 1,
  real_question: 'raise now or later?',
  hidden_assumptions: ['a1'],
  skeleton: ['s1', 's2'],
  insight: 'the growth is founder-led',
} as unknown as AnalysisSnapshot;

describe('snapshot → mix wiring (decision_line / next_three_days)', () => {
  it('surfaces the user-chosen decision_line into the compacted snapshot', () => {
    const s = { ...base, decision_line: 'Raise now — prove the sales motion transfers in 4 weeks.' };
    const ko = compactSnapshots([s], 'ko');
    const en = compactSnapshots([s], 'en');
    expect(ko).toContain('Raise now — prove the sales motion transfers in 4 weeks.');
    expect(ko).toContain('사용자가 택한 방향');
    expect(en).toContain('Direction the user committed to');
  });

  it('surfaces the user-chosen next_three_days plan into the compacted snapshot', () => {
    const s = { ...base, next_three_days: ['Day 1: draft the playbook', 'Day 2: shadow a call', 'Day 3: hire brief'] };
    const out = compactSnapshots([s], 'en');
    expect(out).toContain('Day 1: draft the playbook');
    expect(out).toContain("User's chosen 3-day plan");
  });

  it('omits both lines when absent (no fabrication)', () => {
    const out = compactSnapshots([base], 'en');
    expect(out).not.toContain('Direction the user committed to');
    expect(out).not.toContain("User's chosen 3-day plan");
  });
});
