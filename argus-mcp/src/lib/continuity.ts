import { readReceipt } from './receipt.js';

/** Read-only continuity over records the user explicitly linked. Individual
 * answers remain on their receipts; this projection never compares or buckets
 * them into a performance statement. */
export function computeContinuity(argusDir: string, relatedIds: string[]): {
  related: Array<{ id: string; predicate?: string }>;
  frequency_statement: string;
  sample_size: number;
} {
  const related: Array<{ id: string; predicate?: string }> = [];
  let revisited = 0;
  for (const id of relatedIds) {
    const r = readReceipt(argusDir, id);
    if (!r) continue;
    related.push({ id, predicate: r.predicate });
    if (r.outcome) revisited++;
  }
  const frequency_statement = revisited === 0
    ? 'No revisited records among the decisions you linked.'
    : `${revisited} linked ${revisited === 1 ? 'record has' : 'records have'} a later answer to reread.`;
  return {
    related,
    frequency_statement,
    sample_size: revisited,
  };
}
