/* ═══ Diff utility — compare two string arrays and mark new/same/removed ═══ */

export type DiffStatus = 'new' | 'same' | 'removed';
export interface DiffItem { text: string; status: DiffStatus }

export function diffItems(prev: string[], curr: string[]): DiffItem[] {
  const prevSet = new Set(prev);
  const currSet = new Set(curr);
  const result: DiffItem[] = [];
  // Removed items first (brief flash)
  for (const item of prev) {
    if (!currSet.has(item)) result.push({ text: item, status: 'removed' });
  }
  // Current items
  for (const item of curr) {
    result.push({ text: item, status: prevSet.has(item) ? 'same' : 'new' });
  }
  return result;
}

/* ═══ The same diff for premises, which carry their own lineage ═══════════ */

export type PremiseDiffStatus = DiffStatus | 'revised';
export interface PremiseRowLike { text: string; revised_from?: string }
export interface PremiseDiffItem {
  text: string;
  status: PremiseDiffStatus;
  /** Present only on 'revised': the sentence that stood here last turn. */
  previousText?: string;
}

const key = (text: string) => text.trim();

/**
 * Set difference cannot see a revision.
 *
 * When an answer sharpens a premise, the old text leaves the list and a new one
 * arrives, and `diffItems` — which knows nothing but membership — reports a
 * removal and an unrelated addition. The card rendered that faithfully: the
 * user's previous sentence struck through in red with a minus sign, the
 * improved one tagged "새로" as though it had come from nowhere. The single most
 * encouraging thing this product can show someone — *your answer changed this* —
 * was displayed as a death and a birth.
 *
 * The contract already knew better. An accepted `revise` delta carries the
 * record it overwrote, so the pairing is recorded fact, not a guess from string
 * similarity (which would eventually pair two unrelated sentences and tell a
 * person their answer did something it did not).
 *
 * Lineage is durable, so it is only honoured when the previous snapshot really
 * held that sentence. A record revised three turns ago keeps its `revised_from`
 * and correctly reads as 'same' today.
 */
export function diffPremiseRows(
  prev: PremiseRowLike[],
  curr: PremiseRowLike[],
): PremiseDiffItem[] {
  const prevKeys = new Set(prev.map((r) => key(r.text)));
  const currKeys = new Set(curr.map((r) => key(r.text)));

  const rows: PremiseDiffItem[] = [];
  /** Prior texts accounted for by a revision, so they are not also mourned. */
  const superseded = new Set<string>();

  for (const row of curr) {
    const text = key(row.text);
    if (prevKeys.has(text)) {
      rows.push({ text: row.text, status: 'same' });
      continue;
    }
    const from = row.revised_from ? key(row.revised_from) : '';
    // A revision only counts against a sentence that is genuinely gone. If the
    // prior text is still in the list, some other record holds it and this row
    // is a new arrival that happens to remember an older shape.
    if (from && prevKeys.has(from) && !currKeys.has(from)) {
      superseded.add(from);
      rows.push({ text: row.text, status: 'revised', previousText: row.revised_from });
      continue;
    }
    rows.push({ text: row.text, status: 'new' });
  }

  const removed: PremiseDiffItem[] = [];
  for (const row of prev) {
    const text = key(row.text);
    if (!currKeys.has(text) && !superseded.has(text)) {
      removed.push({ text: row.text, status: 'removed' });
    }
  }

  // Removed first, matching diffItems: the card flashes them out above the list.
  return [...removed, ...rows];
}
