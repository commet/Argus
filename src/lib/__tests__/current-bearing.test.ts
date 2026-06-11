/**
 * Current Bearing — derivation from a finished progressive session.
 *
 * Covers the projection onto the plugin's current-bearing shape:
 *  - null when there's no draft to orient from (no mix / no summary)
 *  - summary from final_mix (preferred) over mix, capped
 *  - why_this_course priority: good_parts → key_assumptions; a section title or
 *    the summary is NOT a reason — empty otherwise (P3: the card omits the row)
 *  - fog from the sharpest concern (fix_suggestion → required_check), debate fallback
 *  - road_not_taken from the team debate's alternativeView (empty without debate)
 *  - status collect_evidence on a critical concern, else proceed; never blocked
 *  - contract_seed reuses extractPredicatesFromSession (top predicate)
 */

import { describe, it, expect } from 'vitest';
import { deriveCurrentBearing } from '../current-bearing';
import type { MixResult, DMFeedbackResult, DMConcern } from '@/stores/types';

function mix(partial: Partial<MixResult>): MixResult {
  return {
    title: 't',
    executive_summary: 's',
    sections: [],
    key_assumptions: [],
    next_steps: [],
    ...partial,
  };
}

function concern(
  text: string,
  severity: DMConcern['severity'],
  fix_suggestion = '',
): DMConcern {
  return { text, severity, fix_suggestion, applied: false };
}

function dm(partial: Partial<DMFeedbackResult>): DMFeedbackResult {
  return {
    persona_name: 'CFO',
    persona_role: 'finance',
    first_reaction: '',
    good_parts: [],
    concerns: [],
    would_ask: [],
    approval_condition: '',
    ...partial,
  };
}

describe('deriveCurrentBearing', () => {
  it('returns null when there is no draft to orient from', () => {
    expect(deriveCurrentBearing({})).toBeNull();
    expect(deriveCurrentBearing({ mix: null, final_mix: null })).toBeNull();
  });

  it('returns null when the draft has no summary or title', () => {
    expect(deriveCurrentBearing({ mix: mix({ executive_summary: '', title: '' }) })).toBeNull();
  });

  it('prefers final_mix over mix for the course summary', () => {
    const b = deriveCurrentBearing({
      mix: mix({ executive_summary: 'old draft' }),
      final_mix: mix({ executive_summary: 'final draft' }),
    });
    expect(b?.current_course.summary).toBe('final draft');
  });

  it('falls back to the title when the summary is empty', () => {
    const b = deriveCurrentBearing({ mix: mix({ executive_summary: '', title: 'Ship the spike' }) });
    expect(b?.current_course.summary).toBe('Ship the spike');
  });

  it('builds why_this_course from the judge good_parts first', () => {
    const b = deriveCurrentBearing({
      mix: mix({ key_assumptions: ['assumed demand'] }),
      dm_feedback: dm({ good_parts: ['Clear cost ceiling', 'Reversible in a week'] }),
    });
    expect(b?.why_this_course).toEqual([
      { point: 'Clear cost ceiling', source: 'review' },
      { point: 'Reversible in a week', source: 'review' },
    ]);
  });

  it('falls back to key_assumptions; a heading or the summary is not a reason (P3 silence)', () => {
    const assumptionOnly = deriveCurrentBearing({ mix: mix({ key_assumptions: ['demand is real'] }) });
    expect(assumptionOnly?.why_this_course).toEqual([{ point: 'demand is real', source: 'draft' }]);

    const headingOnly = deriveCurrentBearing({
      mix: mix({ sections: [{ heading: 'Cost', content: '' }] }),
    });
    expect(headingOnly?.why_this_course).toEqual([]);

    const summaryOnly = deriveCurrentBearing({ mix: mix({ executive_summary: 'just a summary' }) });
    expect(summaryOnly?.why_this_course).toEqual([]);
  });

  it('caps why_this_course at three reasons', () => {
    const b = deriveCurrentBearing({
      mix: mix({}),
      dm_feedback: dm({ good_parts: ['a', 'b', 'c', 'd', 'e'] }),
    });
    expect(b?.why_this_course).toHaveLength(3);
  });

  it('surfaces the sharpest concern as fog, with fix_suggestion as the required check', () => {
    const b = deriveCurrentBearing({
      mix: mix({}),
      dm_feedback: dm({
        concerns: [
          concern('minor nit', 'minor', 'tweak copy'),
          concern('budget blows up', 'critical', 'cap the spike at 4h'),
        ],
      }),
    });
    expect(b?.fog_or_reef).toEqual({ issue: 'budget blows up', required_check: 'cap the spike at 4h' });
  });

  it('falls back to the team debate weakestClaim for fog when there are no concerns', () => {
    const b = deriveCurrentBearing({
      mix: mix({}),
      debate_result: {
        challenge: 'c',
        targetAgent: 'a',
        weakestClaim: 'the depth gap is unproven',
        alternativeView: 'v',
        severity: 'important',
      },
    });
    expect(b?.fog_or_reef).toEqual({ issue: 'the depth gap is unproven' });
  });

  it('has null fog when nothing falsifiable was surfaced', () => {
    const b = deriveCurrentBearing({ mix: mix({ key_assumptions: ['x'] }) });
    expect(b?.fog_or_reef).toBeNull();
  });

  it('derives road_not_taken from the debate alternativeView', () => {
    const b = deriveCurrentBearing({
      mix: mix({}),
      debate_result: {
        challenge: 'spends migration cost before proving demand',
        targetAgent: 'a',
        weakestClaim: 'w',
        alternativeView: 'full consolidation now',
        severity: 'important',
      },
    });
    expect(b?.road_not_taken).toEqual([
      { option: 'full consolidation now', why_not_now: 'spends migration cost before proving demand' },
    ]);
  });

  it('has an empty road_not_taken when there was no debate', () => {
    const b = deriveCurrentBearing({ mix: mix({}) });
    expect(b?.road_not_taken).toEqual([]);
  });

  it('sets status collect_evidence on a critical concern, else proceed, and never blocks', () => {
    const critical = deriveCurrentBearing({
      mix: mix({}),
      dm_feedback: dm({ concerns: [concern('fatal', 'critical')] }),
    });
    expect(critical?.current_course.status).toBe('collect_evidence');
    expect(critical?.blocked).toBe(false);

    const calm = deriveCurrentBearing({
      mix: mix({}),
      dm_feedback: dm({ concerns: [concern('small', 'important')] }),
    });
    expect(calm?.current_course.status).toBe('proceed');
    expect(calm?.blocked).toBe(false);
  });

  it('takes next_helm from the first non-empty next step, falling back to approval_condition', () => {
    const fromStep = deriveCurrentBearing({
      mix: mix({ next_steps: ['  ', 'pull DAU split by surface'] }),
    });
    expect(fromStep?.next_helm).toBe('pull DAU split by surface');

    const fromApproval = deriveCurrentBearing({
      mix: mix({ next_steps: [] }),
      dm_feedback: dm({ approval_condition: 'get sign-off from finance' }),
    });
    expect(fromApproval?.next_helm).toBe('get sign-off from finance');
  });

  it('seeds the contract from the top derived predicate', () => {
    const b = deriveCurrentBearing({
      mix: mix({ key_assumptions: ['plugin can match webapp depth'] }),
      dm_feedback: dm({ concerns: [concern('cost', 'critical')] }),
    });
    // The flinch-surfaced bet leads when present; here the governing assumption does.
    expect(b?.contract_seed).toEqual({ predicate: 'plugin can match webapp depth' });
  });

  it('prefers the flinch-surfaced bet as the contract seed', () => {
    const b = deriveCurrentBearing({
      mix: mix({ key_assumptions: ['secondary bet'] }),
      falsification: {
        claims: [],
        flinched_id: null,
        real_bet: 'users will pay for orientation, not answers',
      },
    });
    expect(b?.contract_seed).toEqual({ predicate: 'users will pay for orientation, not answers' });
  });

  it('has a null contract_seed when nothing falsifiable exists', () => {
    const b = deriveCurrentBearing({ mix: mix({ executive_summary: 'just prose' }) });
    expect(b?.contract_seed).toBeNull();
  });

  it('caps the summary at 240 chars with an ellipsis', () => {
    const long = 'x'.repeat(300);
    const b = deriveCurrentBearing({ mix: mix({ executive_summary: long }) });
    expect(b?.current_course.summary.length).toBe(240);
    expect(b?.current_course.summary.endsWith('…')).toBe(true);
  });
});
