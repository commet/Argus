/**
 * Decision Contract — live (progressive) path.
 *
 * Covers deriving predicates from a finished ProgressiveSession (MixResult +
 * DM review + optional team debate) instead of the legacy recast/feedback data:
 *  - key_assumptions → governing bets (capped); concerns → risks (severity
 *    ordered); debate weakestClaim → a risk
 *  - NO `actor` predicates (the live flow has no role-assignment data)
 *  - stable ids identical to the legacy extractor (same hash → grades survive)
 *  - dedup, MAX_PREDICATES cap, null on nothing-falsifiable
 */

import { describe, it, expect } from 'vitest';
import {
  extractPredicatesFromSession,
  contractFromPredicates,
  stablePredicateId,
  type SessionPredicateInput,
} from '../decision-contract';
import type { MixResult, DMFeedbackResult, DMConcern } from '@/stores/types';

const T0 = new Date('2026-06-01T00:00:00Z').getTime();

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

function concern(text: string, severity: DMConcern['severity']): DMConcern {
  return { text, severity, fix_suggestion: '', applied: false };
}

function dm(concerns: DMConcern[]): DMFeedbackResult {
  return {
    persona_name: 'CFO',
    persona_role: 'finance',
    first_reaction: '',
    good_parts: [],
    concerns,
    would_ask: [],
    approval_condition: '',
  };
}

describe('extractPredicatesFromSession', () => {
  it('maps key_assumptions to governing bets and concerns to risks', () => {
    const input: SessionPredicateInput = {
      mix: mix({ key_assumptions: ['Market wants this'] }),
      dm_feedback: dm([concern('Costs blow past budget', 'critical')]),
    };
    const preds = extractPredicatesFromSession(input);
    expect(preds.map((p) => p.source)).toEqual(['governing_idea', 'risk']);
    expect(preds[0].text).toBe('Market wants this');
    expect(preds[1].text).toBe('Costs blow past budget');
    expect(preds[1].category).toBe('critical');
  });

  it('orders risks by severity (critical → important → minor)', () => {
    const input: SessionPredicateInput = {
      dm_feedback: dm([
        concern('minor thing', 'minor'),
        concern('critical thing', 'critical'),
        concern('important thing', 'important'),
      ]),
    };
    const preds = extractPredicatesFromSession(input);
    expect(preds.map((p) => p.text)).toEqual(['critical thing', 'important thing', 'minor thing']);
    expect(preds.map((p) => p.category)).toEqual(['critical', 'manageable', 'unspoken']);
  });

  it('never produces an actor predicate (no live role data)', () => {
    const input: SessionPredicateInput = {
      mix: mix({ key_assumptions: ['bet'], next_steps: ['someone does X', 'someone does Y'] }),
      dm_feedback: dm([concern('risk', 'important')]),
    };
    const preds = extractPredicatesFromSession(input);
    expect(preds.some((p) => p.source === 'actor')).toBe(false);
  });

  it('includes the team debate weakestClaim as a risk', () => {
    const input: SessionPredicateInput = {
      debate_result: {
        challenge: 'c',
        targetAgent: 'Strategist',
        weakestClaim: 'The timeline is optimistic',
        alternativeView: 'a',
        severity: 'important',
      },
    };
    const preds = extractPredicatesFromSession(input);
    expect(preds).toHaveLength(1);
    expect(preds[0]).toMatchObject({ source: 'risk', text: 'The timeline is optimistic', category: 'manageable' });
  });

  it('caps governing bets so risks still fit (max 2 governing)', () => {
    const input: SessionPredicateInput = {
      mix: mix({ key_assumptions: ['a1', 'a2', 'a3', 'a4'] }),
      dm_feedback: dm([concern('r1', 'critical')]),
    };
    const preds = extractPredicatesFromSession(input);
    const governing = preds.filter((p) => p.source === 'governing_idea');
    expect(governing).toHaveLength(2);
    expect(preds.some((p) => p.source === 'risk')).toBe(true);
  });

  it('caps total predicates at 6', () => {
    const input: SessionPredicateInput = {
      mix: mix({ key_assumptions: ['a1', 'a2'] }),
      dm_feedback: dm([
        concern('r1', 'critical'),
        concern('r2', 'critical'),
        concern('r3', 'important'),
        concern('r4', 'important'),
        concern('r5', 'minor'),
        concern('r6', 'minor'),
      ]),
    };
    const preds = extractPredicatesFromSession(input);
    expect(preds.length).toBeLessThanOrEqual(6);
    expect(preds).toHaveLength(6);
  });

  it('dedups identical text within the same source', () => {
    const input: SessionPredicateInput = {
      dm_feedback: dm([concern('Same risk', 'critical'), concern('Same risk', 'important')]),
    };
    const preds = extractPredicatesFromSession(input);
    expect(preds).toHaveLength(1);
  });

  it('prefers final_mix over mix for governing bets', () => {
    const input: SessionPredicateInput = {
      mix: mix({ key_assumptions: ['draft bet'] }),
      final_mix: mix({ key_assumptions: ['final bet'] }),
    };
    const preds = extractPredicatesFromSession(input);
    expect(preds[0].text).toBe('final bet');
  });

  it('skips empty/whitespace text', () => {
    const input: SessionPredicateInput = {
      mix: mix({ key_assumptions: ['', '   '] }),
      dm_feedback: dm([concern('', 'critical'), concern('real', 'important')]),
    };
    const preds = extractPredicatesFromSession(input);
    expect(preds.map((p) => p.text)).toEqual(['real']);
  });

  it('returns no predicates when nothing falsifiable is present', () => {
    expect(extractPredicatesFromSession({})).toEqual([]);
    expect(extractPredicatesFromSession({ mix: mix({}), dm_feedback: dm([]) })).toEqual([]);
  });

  it('assigns ids identical to the shared stablePredicateId (grades survive re-gen)', () => {
    const preds = extractPredicatesFromSession({ mix: mix({ key_assumptions: ['bet'] }) });
    expect(preds[0].id).toBe(stablePredicateId('governing_idea', 'bet'));
  });

  it('a risk and a governing bet with the SAME text get distinct ids (source-scoped)', () => {
    const preds = extractPredicatesFromSession({
      mix: mix({ key_assumptions: ['overlap'] }),
      dm_feedback: dm([concern('overlap', 'critical')]),
    });
    expect(preds).toHaveLength(2);
    expect(preds[0].id).not.toBe(preds[1].id);
  });
});

describe('contractFromPredicates', () => {
  it('returns null for an empty predicate list', () => {
    expect(contractFromPredicates('p1', [], T0)).toBeNull();
  });

  it('builds a contract carrying the predicates and project id', () => {
    const preds = extractPredicatesFromSession({ mix: mix({ key_assumptions: ['bet'] }) });
    const c = contractFromPredicates('p1', preds, T0);
    expect(c).not.toBeNull();
    expect(c!.project_id).toBe('p1');
    expect(c!.predicates).toEqual(preds);
    expect(c!.created_at).toBe(new Date(T0).toISOString());
  });
});
