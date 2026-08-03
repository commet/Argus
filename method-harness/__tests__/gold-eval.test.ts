// STRICT GOLD-CASE EVAL — the adversarial battery.
//
// For every gold case, this suite constructs the WORST plausible model outputs
// (the exact failure the case annotates) and asserts the machinery holds:
// fire-gate silence on flat/closed cases, rejection/downgrade of forbidden
// moves, the initiative hierarchy at one-way stakes, baseline extraction
// coverage against annotations. One table, every case, printed — so a human
// can eyeball the verdict grid instead of trusting a green dot.

import { describe, expect, it } from 'vitest';
import { GOLD_CASES } from '../fixtures/gold-cases';
import { Ledger, resetEventIds } from '../ledger';
import { validateTurn } from '../validator';
import { fireGate } from '../surfaces/mcp';
import { baselineCoverage, type BaselineCoverageCase } from '../influence';
import { type ArgusTurn } from '../types';

function ledgerFor(caseText: string): Ledger {
  resetEventIds();
  const l = new Ledger();
  l.append({ id: 'u0', caseId: 'gc', at: '2026-08-04T00:00:00.000Z', type: 'user_utterance', text: caseText });
  return l;
}

// Adversarial envelope 1: a falsifier-less reframe (the model "knows better").
const nakedReframe = (): ArgusTurn => ({
  phase: 'improve',
  route: 'decision',
  caseFit: 'in_scope',
  primaryMove: { type: 'reframe', content: '진짜 문제는 따로 있습니다', whyNow: 'frame' },
  claims: [],
});

// Adversarial envelope 2: a pushed directional recommendation with fabricated
// value grounding (refs that do not exist — the LLM-glue signature move).
const pushedDirectional = (): ArgusTurn => ({
  phase: 'improve',
  route: 'decision',
  caseFit: 'in_scope',
  primaryMove: { type: 'recommendation', content: 'A로 가세요', whyNow: '충분해 보임' },
  claims: [],
  recommendation: {
    readiness: 'ready',
    kind: 'directional',
    initiative: 'pushed',
    proposal: 'A로 가세요',
    rationale: '당신이 중요하게 본 가치 X 아래에서',
    valueClaimRefs: ['fabricated_ref'],
    changeCondition: 'Y면 바뀜',
  },
});

describe('gold-case adversarial battery', () => {
  const grid: Array<Record<string, string>> = [];

  it('every case: a naked reframe never survives as a reframe', () => {
    for (const c of GOLD_CASES) {
      const r = validateTurn(nakedReframe(), { ledger: ledgerFor(c.utterance), caseId: 'gc' });
      expect(r.turn.primaryMove.type, c.id).not.toBe('reframe');
      expect(r.downgrades.map((d) => d.code), c.id).toContain('reframe_without_falsifier_to_question');
    }
  });

  it('every case: a fabricated-grounding directional recommendation is never delivered directional', () => {
    for (const c of GOLD_CASES) {
      const r = validateTurn(pushedDirectional(), {
        ledger: ledgerFor(c.utterance),
        caseId: 'gc',
        stakes: { weight: c.axis.reversibility === 'one_way' ? 'major' : 'significant', reversibility: c.axis.reversibility },
      });
      expect(r.turn.recommendation?.kind, c.id).not.toBe('directional');
      grid.push({
        case: c.id,
        bottleneck: c.axis.bottleneck,
        reframe: 'demoted',
        directional: r.turn.recommendation?.kind ?? 'n/a',
        notes: r.downgrades.map((d) => d.code).join(','),
      });
    }
    // The human-eyeball grid — strict eval means someone LOOKS at this.

    console.table(grid);
  });

  it('flat/closed/ambient cases: the MCP fire-gate stays silent', () => {
    // gc02 (flat), gc09 (closed): ambient mention must not manufacture a fork.
    const flat = GOLD_CASES.find((c) => c.id === 'gc02_pricing_flat')!;
    const closed = GOLD_CASES.find((c) => c.id === 'gc09_closed_decision')!;
    resetEventIds();
    const l = new Ledger();
    expect(fireGate(l, { hostUtterance: flat.utterance, userInvokedArgus: false }).fire).toBe(false);
    expect(fireGate(l, { hostUtterance: closed.utterance, userInvokedArgus: false })).toEqual({ fire: false, reason: 'closed_decision' });
  });

  it('decision-opening cases: the fire-gate does fire (restraint, not paralysis)', () => {
    const opening = GOLD_CASES.filter((c) => c.axis.route === 'decision' && c.axis.bottleneck !== 'none_flat' && /고민|할까|결정|정해야/.test(c.utterance));
    expect(opening.length).toBeGreaterThanOrEqual(3);
    resetEventIds();
    const l = new Ledger();
    for (const c of opening) {
      expect(fireGate(l, { hostUtterance: c.utterance, userInvokedArgus: false }).fire, c.id).toBe(true);
    }
  });

  it('safety-route case: recommendations are structurally rejected', () => {
    const crisis = GOLD_CASES.find((c) => c.axis.route === 'safety')!;
    const turn = pushedDirectional();
    turn.caseFit = 'safety_route';
    const r = validateTurn(turn, { ledger: ledgerFor(crisis.utterance), caseId: 'gc' });
    expect(r.ok).toBe(false);
    expect(r.rejections.map((x) => x.code)).toContain('recommendation_on_safety_route');
  });

  it('baseline extraction coverage over the corpus annotations is 100% recallable in principle', () => {
    // The corpus annotates which utterances contain a lean. The harness-side
    // coverage function must classify a perfect extractor at 1.0 and a lazy
    // extractor (never capturing) at 0 — the metric itself is on trial here.
    const perfect: BaselineCoverageCase[] = GOLD_CASES.map((c) => ({
      utterance: c.utterance,
      utteranceContainsLean: c.utteranceContainsLean,
      captured: c.utteranceContainsLean ? { lean: '(annotated lean)', statedReasons: [] } : 'not_captured',
    }));
    expect(baselineCoverage(perfect).coverage).toBe(1);

    const lazy: BaselineCoverageCase[] = GOLD_CASES.map((c) => ({
      utterance: c.utterance,
      utteranceContainsLean: c.utteranceContainsLean,
      captured: 'not_captured',
    }));
    expect(baselineCoverage(lazy).coverage).toBe(0);
    expect(baselineCoverage(lazy).missed).toBe(GOLD_CASES.filter((c) => c.utteranceContainsLean).length);
  });
});
