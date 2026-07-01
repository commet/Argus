/**
 * Deterministic ids + fingerprints for the review pipeline.
 *
 * Fingerprints are deterministic (same text → same hash) so we can cache
 * analysis and detect version drift when a user re-uploads a document. Ids that
 * must be unique per object use the app's generateId(); ids that must be stable
 * across re-runs (units, claims) derive from content via djb2 — the same hash
 * the codebase already uses for stablePredicateId.
 */

/** djb2 — stable, fast, non-cryptographic. Matches decision-contract.ts. */
export function djb2(input: string): string {
  let hash = 5381;
  for (let i = 0; i < input.length; i++) {
    hash = ((hash << 5) + hash + input.charCodeAt(i)) & 0xffffffff;
  }
  // unsigned hex
  return (hash >>> 0).toString(16);
}

/** Normalizes whitespace so trivial reformatting doesn't change the fingerprint. */
export function normalizeForFingerprint(text: string): string {
  return text.replace(/\r\n/g, '\n').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
}

export function fingerprint(text: string): string {
  return djb2(normalizeForFingerprint(text));
}

/** Stable id for a content-derived object (unit/claim), scoped by a prefix. */
export function stableId(prefix: string, ...parts: (string | number)[]): string {
  return `${prefix}_${djb2(parts.join(''))}`;
}
