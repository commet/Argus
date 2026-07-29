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

export type Elicitor = (
  message: string,
  requestedSchema: Record<string, unknown>,
  timeoutMs?: number,
) => Promise<ElicitResult>;

/**
 * How long a person may take to answer, and why this is not a detail.
 *
 * The MCP SDK times a server→client request out after 60 seconds by default
 * (`DEFAULT_REQUEST_TIMEOUT_MSEC`). Nobody passed an option, so every picker
 * inherited it — and a picker is not a machine call. It is a human being reading
 * their own prediction and deciding whether to commit to it, which routinely
 * takes longer than a minute.
 *
 * What that produced, from the founder's own host log (2026-07-27):
 *
 *     07:22:16  argus_predict called, ask sent
 *     07:23:16  tool completed in 1m 0s      ← the SDK gave up, exactly on time
 *     07:23:27  {"action":"accept"}          ← their Accept, 11 seconds too late
 *
 * They pressed Accept. The answer arrived. It was thrown away, and the tool had
 * already told them nothing was recorded. This was reported twice as "Accept
 * does not work" and fixed twice — as a schema-constraint problem, which was
 * also real — while the clock went unmeasured both times.
 *
 * So: minutes, not seconds, and the number lives here rather than in the SDK's
 * defaults where nobody looks.
 */
export const DECISION_ASK_TIMEOUT_MS = 10 * 60 * 1000;

export interface McpClientCapabilities {
  elicitation?: unknown;
}

/**
 * Branch on the protocol capability, never the host's product name. Codex can
 * surface standard MCP forms when mcp_elicitations are allowed; blacklisting
 * `codex-mcp-client` made the working path impossible along with the broken one.
 */
export function supportsReliableElicitation(
  capabilities: McpClientCapabilities | undefined,
): boolean {
  return Boolean(capabilities?.elicitation);
}

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

/**
 * Can this host show a picker at all? DECLARED CAPABILITY ONLY.
 *
 * Deliberately NOT influenced by the streak below. An earlier design turned the
 * whole session's pickers off after a single fast decline, which made one
 * ordinary "no" delete the settle picker, the defer picker and the premise
 * picker for the rest of the session — the blast radius of a guess was every
 * later surface. Asking a blocked host again costs one intercepted request that
 * nobody sees (~0ms, measured); guessing wrong costs the user their pickers. The
 * asymmetry is not close, so the ask is never suppressed.
 */
export function canElicit(): boolean {
  // Fail CLOSED if the probe itself throws: an exception from the capability
  // check is not evidence of capability, and answering "yes, this host has a
  // picker" on the strength of a crash launches an ask into the dark.
  if (_capable) {
    try {
      return _capable();
    } catch {
      return false;
    }
  }
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
  | { kind: 'no_answer'; reason: 'cancelled' | 'failed' }
  | { kind: 'unsupported' };      // no picker on this host at all

/**
 * Ask the user and report HOW it ended (see ElicitOutcome).
 *
 * `no_answer.reason` splits two facts the in-band tools treat alike but the
 * OUT-OF-BAND ask must not (audit 2026-07-27):
 *   cancelled — the host returned action:"cancel". A window existed; a human or
 *               their client closed it. They were interrupted, so the ambient
 *               cooldown has been honestly spent.
 *   failed    — the request itself threw (method not found, transport dead, a
 *               host that declares `elicitation` and then rejects it). NOTHING
 *               was ever shown to anyone, so burning a 4-hour cooldown on it
 *               silences a user who was never asked.
 */
export async function elicitDetailed(
  message: string,
  requestedSchema: Record<string, unknown>,
  timeoutMs: number = DECISION_ASK_TIMEOUT_MS,
): Promise<ElicitOutcome> {
  // Enforce the capability at the seam itself. Call sites use canElicit() to
  // choose their UI branch, but forgetting that pre-check must never bypass the
  // gate and launch an ask at a host that never declared it could show one.
  if (!_elicit || !canElicit()) return { kind: 'unsupported' };
  try {
    const res = await _elicit(stripUnsafeChars(message), requestedSchema, timeoutMs);
    if (res.action === 'accept') return { kind: 'accepted', content: res.content ?? {} };
    // MCP defines `decline` as an explicit user decision. Some clients violate
    // that contract by returning the same bare action for a policy rejection,
    // but the server receives no marker that distinguishes the two. Response
    // time cannot repair the missing provenance: a keyboard user, accessibility
    // automation, a scripted client, or a person who already knows their answer
    // can all decline immediately. Preserve the protocol fact; do not invent a
    // fourth action from elapsed time.
    if (res.action === 'decline') return { kind: 'declined' };
    return { kind: 'no_answer', reason: 'cancelled' }; // the host closed it without an answer
  } catch {
    return { kind: 'no_answer', reason: 'failed' }; // declared support but the ask never landed
  }
}

/** Ask the user; returns null if unsupported / errored / not accepted. */
export async function elicit(
  message: string,
  requestedSchema: Record<string, unknown>,
  timeoutMs: number = DECISION_ASK_TIMEOUT_MS,
): Promise<Record<string, unknown> | null> {
  if (!_elicit || !canElicit()) return null;
  try {
    // The elicitation `message` is a SEPARATE server→client request — it does NOT
    // pass through envelope()/sanitizeOutput, so a raw predicate/premise
    // interpolated into it (seal.ts, premises.ts) could carry ANSI escapes or a
    // forged "AI VERDICT" line that a terminal host renders (screen-clear +
    // spine spoof). Sanitize here, at the one seam every picker passes through,
    // so no call site can forget. stripUnsafeChars keeps \n and \t (a message
    // like `Record this?\n"…"` needs the newline).
    const res = await _elicit(stripUnsafeChars(message), requestedSchema, timeoutMs);
    return res.action === 'accept' && res.content ? res.content : null;
  } catch {
    return null; // host declared support but failed — fall back to text
  }
}
