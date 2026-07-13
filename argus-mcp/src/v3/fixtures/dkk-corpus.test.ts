import { describe, expect, it } from 'vitest';
import { MESSY_CORPUS, type CorpusCategory } from './dkk-corpus.js';
import { P5_BASELINES, P5_GO_KILL, P5_KILL_CONDITIONS, P5_METRICS } from './p5-measurement-plan.js';

describe('DKK v6 P1 messy corpus', () => {
  it('has 30 uniquely named cases with no unnamed loss', () => {
    expect(MESSY_CORPUS).toHaveLength(30);
    expect(new Set(MESSY_CORPUS.map((fixture) => fixture.id)).size).toBe(MESSY_CORPUS.length);
    expect(MESSY_CORPUS.every((fixture) => fixture.required.length > 0 && fixture.forbidden.length > 0)).toBe(true);
    expect(MESSY_CORPUS.every((fixture) => fixture.allowedLoss !== 'unnamed loss')).toBe(true);
  });

  it('covers every v6 messy-reality boundary', () => {
    const categories = new Set<CorpusCategory>(MESSY_CORPUS.map((fixture) => fixture.category));
    for (const category of [
      'temporality', 'authority', 'resolution', 'ambiguity', 'incompleteness',
      'relationships', 'legacy', 'synchronization', 'erasure', 'surface',
    ] as const) {
      expect(categories.has(category)).toBe(true);
    }
  });

  it('keeps defer non-terminal and requires authority for terminal outcomes', () => {
    const deferred = MESSY_CORPUS.find((fixture) => fixture.id === 'C24-still-pending-rearms-return');
    const autoClose = MESSY_CORPUS.find((fixture) => fixture.id === 'C18-ai-suggested-terminal-rejected');
    const directClose = MESSY_CORPUS.find((fixture) => fixture.id === 'C17-direct-command-close');

    expect(deferred?.expectedLifecycle).toBe('sealed');
    expect(deferred?.forbidden).toContain('terminal state');
    expect(autoClose?.forbidden).toContain('terminal event is appended');
    expect(directClose?.expectedResolution).toBe('answered');
  });

  it('pre-registers all comparison arms, metrics, and go/kill thresholds before P2', () => {
    expect(P5_BASELINES).toEqual([
      'raw_transcript_search',
      'transcript_rag_with_citations',
      'decision_journal_template',
      'argus_judgment_ledger',
    ]);
    expect(P5_METRICS).toContain('authorship_attribution_error');
    expect(P5_METRICS).toContain('confirmation_actions');
    expect(P5_GO_KILL.corpusCaseCount).toBe(MESSY_CORPUS.length);
    expect(P5_GO_KILL.silentFalseSealRate).toBe(0);
    expect(P5_KILL_CONDITIONS.length).toBeGreaterThanOrEqual(5);
  });
});
