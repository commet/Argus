import { describe, it, expect } from 'vitest';
import { routeLenses, applies } from '../routing';
import { LENSES } from '../lenses';
import { ingest } from '../ingest';
import { type DocumentProfile } from '../schema';

function profile(over: Partial<DocumentProfile> = {}): DocumentProfile {
  return {
    document_type: 'strategy_memo',
    intent: 'inform',
    audience: 'team',
    stakes: 'medium',
    artifact_maturity: 'working_draft',
    source_confidence: 0.7,
    inferred: { document_type: true, intent: true, audience: true, stakes: true },
    ...over,
  };
}

const textArtifact = ingest({ source_kind: 'markdown', text: '# t\n\n본문' });
const deckArtifact = ingest({ source_kind: 'pptx', text: '# s1\n\n- a\n\n---\n\n# s2\n\n- b' });

describe('routeLenses', () => {
  it('always includes the base judgment spine', () => {
    const r = routeLenses(profile(), textArtifact, { maxLensCalls: 9 });
    for (const id of ['core_question', 'claim_evidence', 'hidden_assumption', 'human_judgment', 'falsifiable_followup'] as const) {
      expect(r.selected).toContain(id);
    }
  });

  it('adds deck_narrative only for decks', () => {
    expect(routeLenses(profile(), deckArtifact, { maxLensCalls: 9 }).selected).toContain('deck_narrative');
    expect(routeLenses(profile(), textArtifact, { maxLensCalls: 9 }).selected).not.toContain('deck_narrative');
  });

  it('skips stakeholder_objection when stakes are low, includes when high', () => {
    const low = routeLenses(profile({ stakes: 'low' }), textArtifact, { maxLensCalls: 9 });
    expect(low.selected).not.toContain('stakeholder_objection');
    const high = routeLenses(profile({ stakes: 'high' }), textArtifact, { maxLensCalls: 9 });
    expect(high.selected).toContain('stakeholder_objection');
  });

  it('respects the lens-call budget and records the reason for cuts', () => {
    const r = routeLenses(profile({ stakes: 'high' }), deckArtifact, { maxLensCalls: 3 });
    expect(r.selected.length).toBe(3);
    const cut = r.skipped.find((s) => s.reason.includes('예산'));
    expect(cut).toBeTruthy();
  });

  it('discloses the applied lenses in plain language', () => {
    const r = routeLenses(profile(), textArtifact, { maxLensCalls: 7 });
    expect(r.disclosure).toContain('적용한 검수 렌즈');
    expect(r.disclosure).toContain(LENSES[r.selected[0]].label);
  });

  it('honors user concern chips by boosting the matching lens', () => {
    const r = routeLenses(profile({ stakes: 'low' }), textArtifact, {
      maxLensCalls: 6,
      concerns: ['stakeholder_objection'],
    });
    expect(r.selected).toContain('stakeholder_objection');
  });
});

describe('applies filter', () => {
  it('gates deck_only lenses', () => {
    expect(applies(LENSES.deck_narrative, profile(), false)).toBe(false);
    expect(applies(LENSES.deck_narrative, profile(), true)).toBe(true);
  });

  it('gates reversibility by document type', () => {
    expect(applies(LENSES.reversibility, profile({ document_type: 'llm_answer' }), false)).toBe(false);
    expect(applies(LENSES.reversibility, profile({ document_type: 'adr' }), false)).toBe(true);
  });
});
