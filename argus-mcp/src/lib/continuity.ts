import { readReceipt } from './receipt.js';

/**
 * Track-record continuity (addendum L — the n=1 moat). Given past decision ids
 * the user tags as similar, report a sample-size-scaled frequency statement.
 * NEVER a verdict, never "you tend to..." — frequency only, with a small-sample
 * caveat (spine rule 2).
 */
export function computeContinuity(argusDir: string, relatedIds: string[]): {
  related: Array<{ id: string; outcome?: string; predicate?: string }>;
  frequency_statement: string;
  sample_size: number;
  sample_size_caveat?: string;
} {
  const related: Array<{ id: string; outcome?: string; predicate?: string }> = [];
  let held = 0, settled = 0;
  for (const id of relatedIds) {
    const r = readReceipt(argusDir, id);
    if (!r) continue;
    related.push({ id, outcome: r.outcome, predicate: r.predicate });
    if (r.outcome) {
      settled++;
      if (r.outcome === 'held') held++;
    }
  }
  const frequency_statement = settled === 0
    ? 'No settled history among the decisions you tagged as similar.'
    : `Of ${settled} similar ${settled === 1 ? 'decision' : 'decisions'} you settled: ${held} held, ${settled - held} did not.`;
  return {
    related,
    frequency_statement,
    sample_size: settled,
    sample_size_caveat: settled > 0 && settled < 10 ? 'Sample is small. Read this as history, not a pattern about you.' : undefined,
  };
}
