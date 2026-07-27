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

import { stripUnsafeChars } from './untrusted.js';

export interface ElicitResult {
  action: 'accept' | 'decline' | 'cancel';
  content?: Record<string, unknown>;
}

export type Elicitor = (message: string, requestedSchema: Record<string, unknown>) => Promise<ElicitResult>;

let _elicit: Elicitor | null = null;
let _capable: (() => boolean) | null = null;

/** Wire the elicitor and, optionally, a live capability probe. The probe must
 *  reflect the ACTUAL host: the MCP spec (and the SDK) only permit elicitInput
 *  when the client DECLARED the `elicitation` capability at initialize — calling
 *  it otherwise throws. Without an accurate probe, `canElicit()` would report
 *  true on a host that will actually throw, and a caller that reads a null result
 *  as "the user declined" (rather than "no picker here") silently drops work.
 *  The probe closes that gap: no declared capability ⇒ callers skip the picker
 *  and take their text path. */
export function setElicitor(fn: Elicitor | null, capable?: () => boolean): void {
  _elicit = fn;
  _capable = capable ?? null;
}

export function canElicit(): boolean {
  if (_capable) return _capable();
  return _elicit !== null;
}

/**
 * Why the caller must be able to tell a NO from a NON-ANSWER (2026-07-27, the
 * founder's second blocked settle): `elicit` collapsed decline, cancel, and a
 * host-side failure into one `null`, so a picker that never advanced — because
 * the host validated a field, or focus sat in a text input where Enter typed a
 * newline instead of submitting — was recorded as "the user said no", and the
 * work they had just done evaporated with a polite "기록하지 않았습니다".
 *
 * A decline is an answer and deserves silence. A non-answer is a BROKEN WIRE and
 * deserves the honest fallback: ask in one plain line. We cannot see or test the
 * host's form rendering, so the design must not depend on it working.
 */
export type ElicitOutcome =
  | { kind: 'accepted'; content: Record<string, unknown> }
  | { kind: 'declined' }          // the user said no — respect it, stay silent
  | { kind: 'no_answer' }         // cancel / error / host trouble — offer the text path
  | { kind: 'unsupported' };      // no picker on this host at all

/** Ask the user and report HOW it ended (see ElicitOutcome). */
export async function elicitDetailed(message: string, requestedSchema: Record<string, unknown>): Promise<ElicitOutcome> {
  if (!_elicit) return { kind: 'unsupported' };
  try {
    const res = await _elicit(stripUnsafeChars(message), requestedSchema);
    if (res.action === 'accept') return { kind: 'accepted', content: res.content ?? {} };
    if (res.action === 'decline') return { kind: 'declined' };
    return { kind: 'no_answer' }; // 'cancel' — the host closed it without an answer
  } catch {
    return { kind: 'no_answer' }; // declared support but failed mid-ask
  }
}

/** Ask the user; returns null if unsupported / errored / not accepted. */
export async function elicit(message: string, requestedSchema: Record<string, unknown>): Promise<Record<string, unknown> | null> {
  if (!_elicit) return null;
  try {
    // The elicitation `message` is a SEPARATE server→client request — it does NOT
    // pass through envelope()/sanitizeOutput, so a raw predicate/premise
    // interpolated into it (seal.ts, premises.ts) could carry ANSI escapes or a
    // forged "AI VERDICT" line that a terminal host renders (screen-clear +
    // spine spoof). Sanitize here, at the one seam every picker passes through,
    // so no call site can forget. stripUnsafeChars keeps \n and \t (a message
    // like `Record this?\n"…"` needs the newline).
    const res = await _elicit(stripUnsafeChars(message), requestedSchema);
    return res.action === 'accept' && res.content ? res.content : null;
  } catch {
    return null; // host declared support but failed — fall back to text
  }
}
