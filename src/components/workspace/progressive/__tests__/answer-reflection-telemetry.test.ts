import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = readFileSync(new URL('../ProgressiveFlow.tsx', import.meta.url), 'utf8');

describe('answer reflection telemetry', () => {
  it('measures the state change after the new snapshot is produced', () => {
    expect(source.indexOf('const answerDelta = analysisDelta(latest, mergedSnapshot)'))
      .toBeLessThan(source.indexOf("track('answer_reflected'"));
    expect(source).toContain('material_change: answerDelta.materialChange');
    expect(source).toContain('premises_revised: answerDelta.premisesRevised');
    expect(source).toContain('duration_ms: Math.round(performance.now() - answerStartedAt)');
  });

  it('never sends the decision, question, answer, or premise text', () => {
    const event = source.slice(
      source.indexOf("track('answer_reflected'"),
      source.indexOf("track('answer_reflected'") + 700,
    );
    expect(event).not.toMatch(/\b(value|text|answer|question|premise|decision_line)\s*[:,]/);
  });
});
