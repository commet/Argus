/**
 * F1 — bind the user's own judgment to the outcome (foundational review, deepest root).
 *
 * Two guarantees:
 *  (a) the user's committed decision_line seals into the DecisionContract AS THE
 *      USER'S (source 'user_lean', authored = user's own), never laundered into an
 *      ai_surfaced key_assumption (a CLAUDE.md Rule-1 violation).
 *  (b) the mix prompt renders the user's own calls as an authoritative block that
 *      OUTRANKS the worker research — and never attributes them to a persona.
 */

import { describe, it, expect } from 'vitest';
import { extractPredicatesFromSession } from '../decision-contract';
import { buildFinalDeliverablePrompt, buildMixPrompt } from '../progressive-prompts';
import type { AnalysisSnapshot } from '@/stores/types';

describe('F1(2) — decision_line seals as the user’s own', () => {
  it('adds the committed decision_line as a user_lean predicate, authored by the user (not ai_surfaced)', () => {
    const preds = extractPredicatesFromSession({
      user_judgment: { decision_line: 'Raise the Series A now — prove the sales motion transfers in 4 weeks.' },
      mix: { key_assumptions: ['some AI assumption'] } as never,
    });
    const userPred = preds.find(p => p.text.startsWith('Raise the Series A now'));
    expect(userPred).toBeTruthy();
    expect(userPred!.source).toBe('user_lean');
    expect(userPred!.authored).not.toBe('ai_surfaced'); // the user's own (absent === user)
  });

  it('composes the user decision FIRST so it is never dropped at the cap', () => {
    const preds = extractPredicatesFromSession({
      user_judgment: { decision_line: 'THE USER DECISION' },
      mix: { key_assumptions: Array.from({ length: 20 }, (_, i) => `assumption ${i}`) } as never,
    });
    expect(preds[0].text).toBe('THE USER DECISION');
    expect(preds[0].source).toBe('user_lean');
  });

  it('adds nothing when there is no decision_line (no fabrication)', () => {
    const preds = extractPredicatesFromSession({ mix: { key_assumptions: ['a'] } as never });
    expect(preds.some(p => p.source === 'user_lean')).toBe(false);
  });
});

describe('F1(1) — the mix renders the user’s calls as an authoritative, non-attributed block', () => {
  const snap = { version: 1, real_question: 'q?', hidden_assumptions: [], skeleton: ['s1'] } as unknown as AnalysisSnapshot;

  it('surfaces a user-authored worker result in the OWN-DECISIONS block, outranking research', () => {
    const { user } = buildMixPrompt('problem', [snap], [], null, [
      { task: 'the go/no-go call', result: 'We go — but phased.', authored: 'user', name: undefined },
      { task: 'market sizing', result: 'TAM is $2B', authored: 'ai', name: '규민' },
    ], 'en');
    expect(user).toContain("THE USER'S OWN DECISIONS");
    expect(user).toContain('We go — but phased.');
    // the user's call must NOT be offered as a citable contributor persona
    expect(user).not.toMatch(/AVAILABLE CONTRIBUTOR NAMES[\s\S]*the go\/no-go call/);
  });

  it('marks blocked (missing human input) tasks as provisional, never fabricated', () => {
    const { user } = buildMixPrompt('problem', [snap], [], null, [], 'en', null, ['customer interviews']);
    expect(user).toContain('MISSING HUMAN INPUTS');
    expect(user).toContain('customer interviews');
    expect(user).toMatch(/provisional/i);
  });

  it('asks for the smallest faithful receipt — no section, assumption, or step quota', () => {
    const { system, user } = buildMixPrompt('problem', [snap], [], null, [
      { task: 'market sizing', result: 'TAM is $2B', authored: 'ai', name: '규민', workerId: 'w1' },
    ], 'en');

    // The caps ("3-5 sections", "exactly 3 next steps") were themselves the
    // manufactured-content mandate: a quota is met by invention when the
    // material runs out. What replaces them is an emptiness licence.
    expect(system).not.toMatch(/\d\s*-\s*\d\s+sections/i);
    expect(system).not.toContain('exactly 3');
    expect(system).toContain('sections are optional');
    expect(system).toContain('[] is valid');
    expect(system).toContain('Add no new fact, premise, risk, option, stakeholder, metric, action, or');
    expect(user).toContain('Produce the smallest faithful judgment receipt.');
  });

  it('carries the AI lead read as a LEAD, never as a vote that settles anything', () => {
    const { system, user } = buildMixPrompt('problem', [snap], [], null, [], 'en', {
      lead_agent_id: 'l1',
      lead_agent_name: 'Lead',
      integrated_analysis: 'The two offers differ mainly on runway.',
      key_findings: ['runway is the live variable'],
      unresolved_tensions: ['salary vs stability'],
      open_question: 'Which risk is the user actually carrying?',
    });

    // The lead call is paid for upstream — dropping its output on the floor was
    // a silently broken wire, and promoting it to a verdict is a spine breach.
    expect(user).toContain('The two offers differ mainly on runway.');
    expect(user).toContain('AI LEAD READ');
    expect(system).toContain('leads, not evidence or votes');
    expect(system).toContain('No count of agreeing reviews makes a claim verified');
  });

  it('keeps the final rewrite bounded instead of expanding an already-complete draft', () => {
    const { system } = buildFinalDeliverablePrompt({
      title: 'Plan', executive_summary: 'Summary',
      sections: [{ heading: 'One', content: 'Body' }],
      key_assumptions: ['A'], next_steps: ['Do it'],
    }, [{ concern: 'Missing fact', fix: 'Mark it unverified' }], 'en');

    expect(system).toContain('each section to 2-3 sentences');
    expect(system).toContain('at most 4 assumptions');
    expect(system).toContain('as many as are real, at most 3');
  });
});
