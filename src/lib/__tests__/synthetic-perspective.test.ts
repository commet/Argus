import { describe, expect, it } from 'vitest';
import type { LegacyStructuredSynthesis, Persona, RehearsalResult } from '@/stores/types';
import {
  buildSyntheticPerspectiveSet,
  isLegacyStructuredSynthesis,
  isSyntheticPerspectiveSet,
  projectLegacySynthesis,
  syntheticPerspectiveSystem,
} from '@/lib/synthetic-perspective';

function result(personaId: string, concerns: string[]): RehearsalResult {
  return {
    persona_id: personaId,
    overall_reaction: '',
    failure_scenario: '',
    untested_assumptions: [],
    classified_risks: [],
    first_questions: [],
    praise: [],
    concerns,
    wants_more: [],
    approval_conditions: [],
  };
}

function persona(id: string, influence: Persona['influence']): Persona {
  return {
    id,
    name: id,
    role: `seat-${id}`,
    organization: '',
    priorities: `goal-${id}`,
    communication_style: '',
    known_concerns: '',
    decision_style: 'analytical',
    risk_tolerance: 'medium',
    influence,
    extracted_traits: [],
    feedback_logs: [],
    created_at: '2026-07-18T00:00:00.000Z',
    updated_at: '2026-07-18T00:00:00.000Z',
  };
}

describe('E4 synthetic perspective firewall', () => {
  it('fixes independence at one regardless of persona count, model reuse, or influence', () => {
    const set = buildSyntheticPerspectiveSet({
      setId: 'set:1',
      sourceCaseId: 'case:1',
      results: [result('a', ['risk a']), result('b', ['risk b']), result('c', ['risk c'])],
      personas: [persona('a', 'high'), persona('b', 'medium'), persona('c', 'low')],
      synthesisOutput: {
        convergent_simulated_concerns: [{
          statement: 'recurring concern',
          perspective_ids: ['perspective:a', 'perspective:b', 'perspective:c'],
          source_refs: ['rehearsal-result:a'],
        }],
        team_contradictions: [],
        strongest_dissent: {
          kind: 'observed', statement: 'risk c', source_refs: ['rehearsal-result:c'], search_method: 'compared all supplied concerns',
        },
        unknowns_that_block_judgment: ['actual capacity'],
        reality_check_questions: ['What is measured capacity?'],
      },
    });

    expect(set.independence_units).toBe(1);
    expect(new Set(set.perspectives.map((item) => item.model_lineage.source_input_cluster_ids[0])))
      .toEqual(new Set(['case:1']));
    expect(set.perspectives.map((item) => item.seat.authority)).toEqual(['high', 'medium', 'low']);
    expect(set.convergent_simulated_concerns[0]).not.toHaveProperty('confidence');
    expect(set.convergent_simulated_concerns[0]).not.toHaveProperty('priority');
    expect(isSyntheticPerspectiveSet(set)).toBe(true);
  });

  it('keeps observed and elicited dissent typed and rejects invented perspective references', () => {
    const set = buildSyntheticPerspectiveSet({
      setId: 'set:2', sourceCaseId: 'case:2',
      results: [result('a', []), result('b', [])],
      personas: [persona('a', 'high'), persona('b', 'low')],
      synthesisOutput: {
        convergent_simulated_concerns: [{
          statement: 'x', perspective_ids: ['perspective:a', 'perspective:invented'], source_refs: [],
        }],
        team_contradictions: [{
          topic: 'axis',
          positions: [
            { perspective_id: 'perspective:a', stance: 'A' },
            { perspective_id: 'perspective:invented', stance: 'B' },
          ],
        }],
        strongest_dissent: {
          kind: 'elicited_counter_lens', statement: 'counter-lens', source_refs: [], search_method: 'constructed after input comparison',
        },
        unknowns_that_block_judgment: [], reality_check_questions: ['Ask reality'],
      },
    });

    expect(set.convergent_simulated_concerns).toEqual([]);
    expect(set.team_contradictions).toEqual([]);
    expect(set.strongest_dissent.kind).toBe('elicited_counter_lens');
  });

  it('fails closed to an explicit unknown when structured synthesis is unavailable', () => {
    const set = buildSyntheticPerspectiveSet({
      setId: 'set:fallback', sourceCaseId: 'case:fallback',
      results: [result('a', ['one concern']), result('b', ['another'])],
      personas: [persona('a', 'high'), persona('b', 'low')],
    });
    expect(set.convergent_simulated_concerns).toEqual([]);
    expect(set.strongest_dissent.kind).toBe('none_found');
    expect(set.strongest_dissent.search_method).toContain('unavailable');
    expect(set.unknowns_that_block_judgment).toHaveLength(1);
    expect(set.reality_check_questions).toHaveLength(1);
  });

  it('preserves old bytes through an explicitly legacy read projection', () => {
    const old: LegacyStructuredSynthesis = {
      common_agreements: ['old recurring text'],
      key_conflicts: [{ topic: 'old axis', positions: [{ persona_id: 'a', stance: 'A' }] }],
      priority_actions: [{ action: 'old ranked action', requested_by: 'A', priority: 'high' }],
    };
    const before = JSON.stringify(old);
    const projected = projectLegacySynthesis(old);
    expect(JSON.stringify(old)).toBe(before);
    expect(isLegacyStructuredSynthesis(old)).toBe(true);
    expect(projected.legacy_simulated_convergence).toEqual(['old recurring text']);
    expect(projected.review_items).toEqual([{ statement: 'old ranked action', source: 'A' }]);
    expect(projected.review_items[0]).not.toHaveProperty('priority');
  });

  it('forbids count and seat influence from becoming evidence in both locales', () => {
    for (const locale of ['ko', 'en'] as const) {
      const prompt = syntheticPerspectiveSystem(locale);
      expect(prompt).toContain('independence');
      expect(prompt).toMatch(/evidence|증거/);
      expect(prompt).toMatch(/influence|영향력/);
      expect(prompt).toMatch(/reality|현실/);
    }
  });
});
