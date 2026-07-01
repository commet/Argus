/**
 * Elicitation seam (MCP elicitation/create). Lets a tool ask the END USER a
 * structured choice — the MCP-native equivalent of a choice+free-text picker —
 * for spine-SAFE inputs only: settlement outcome, concern selection, predicate
 * wording. Never for the decision crux (a multiple-choice crux is a fork, which
 * the spine forbids).
 *
 * The server injects the real elicitor at startup. When the host doesn't support
 * elicitation (many don't yet), `elicit` returns null and callers fall back to
 * the text flow — no crash, no dead end.
 */

export interface ElicitResult {
  action: 'accept' | 'decline' | 'cancel';
  content?: Record<string, unknown>;
}

export type Elicitor = (message: string, requestedSchema: Record<string, unknown>) => Promise<ElicitResult>;

let _elicit: Elicitor | null = null;

export function setElicitor(fn: Elicitor | null): void {
  _elicit = fn;
}

export function canElicit(): boolean {
  return _elicit !== null;
}

/** Ask the user; returns null if unsupported / errored / not accepted. */
export async function elicit(message: string, requestedSchema: Record<string, unknown>): Promise<Record<string, unknown> | null> {
  if (!_elicit) return null;
  try {
    const res = await _elicit(message, requestedSchema);
    return res.action === 'accept' && res.content ? res.content : null;
  } catch {
    return null; // host declared support but failed — fall back to text
  }
}
