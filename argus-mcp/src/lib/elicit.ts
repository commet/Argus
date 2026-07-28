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

/**
 * A decline nobody could have read, and why we refuse to call it the user's.
 *
 * Measured on a real `codex app-server` (2026-07-29, Argus 2.0.5, five configs,
 * same build each time):
 *
 *   approval_policy default                → request FORWARDED to the client
 *   approval_policy = "never"              → request NEVER forwarded · 0 shown
 *   granular.mcp_elicitations = false      → request NEVER forwarded · 0 shown
 *
 * In the last two, Codex advertises the `elicitation` capability, intercepts the
 * request, and answers `decline` itself in ~330ms end to end. The person is not
 * involved at any point. Argus then told them, in full:
 *
 *     "Not recorded."      data: { sealed: false, choice: "declined" }
 *
 * That sentence attributes to a human a decision no human made — the first thing
 * CLAUDE.md forbids — and hands them no way forward. It is the whole of what a
 * Codex user on a restrictive policy gets today.
 *
 * Codex's own app-server schema was checked for a way to tell the two apart:
 * `McpServerElicitationRequestResponse` carries `action` (accept/decline/cancel),
 * optional `content`, and an `_meta` documented for "form-mode action handling"
 * that arrives null. There is no policy marker. So the protocol cannot answer it
 * and no amount of reading the response will.
 *
 * What CAN be said honestly: a form rendered just now and declined inside this
 * window was not read by anyone. That is a statement about reading speed, not
 * about which host it was, so it needs no product-name list. It does NOT tell us
 * the host is blocked — a person really can hammer Escape — so it must not be
 * used to conclude anything about the user. It is only ever grounds for refusing
 * to claim the decline was theirs.
 */
export const UNREADABLE_DECLINE_MAX_MS = 500;

let _elicit: Elicitor | null = null;
let _capable: (() => boolean) | null = null;
let _unreadableStreak = 0;

/**
 * Consecutive declines that came back too fast to have been read, with no
 * contrary evidence in between. TWO, not one, and the reset is the point.
 *
 * A blocked host produces this on every single ask, forever — that is what the
 * measurement above shows. A person produces it once and then does something
 * else. So requiring a streak, and clearing it on ANY other outcome (an accept,
 * a cancel, a decline someone actually took time over, a thrown request), keeps
 * a real user's fast "no" from being read as a broken environment.
 */
const UNREADABLE_STREAK_FOR_BLOCKED = 2;

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
  _unreadableStreak = 0;
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
  if (_capable) return _capable();
  return _elicit !== null;
}

/**
 * ADVISORY ONLY: this host looks like it is answering pickers without showing
 * them. Describes the environment (`check_in` reporting `text_fallback`); must
 * never gate an ask, and must never be phrased to the user as a fact about them.
 */
export function elicitationLikelyBlocked(): boolean {
  return _unreadableStreak >= UNREADABLE_STREAK_FOR_BLOCKED;
}

/** Test seam: forget what this session has observed about the host. */
export function resetElicitObservations(): void {
  _unreadableStreak = 0;
}

function noteOutcome(unreadableDecline: boolean): void {
  _unreadableStreak = unreadableDecline ? _unreadableStreak + 1 : 0;
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
  // host trouble — offer the text path. See the reason doc above; `unattributable`
  // behaves like `failed` for in-band tools and like `declined` for the ambient
  // ask, because those two surfaces are asking different questions of it.
  | { kind: 'no_answer'; reason: 'cancelled' | 'failed' | 'unattributable' }
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
 *   unattributable — a decline came back too fast to have been read (see
 *               UNREADABLE_DECLINE_MAX_MS). Nothing may be recorded and no
 *               choice may be attributed, so the in-band tools treat it exactly
 *               like `failed` and hand back the text path.
 *
 *               The OUT-OF-BAND ask must not, and this is the one place the two
 *               readings finally agree on something: if a policy answered, then
 *               re-asking means an invisible timer retrying forever; if a person
 *               hammered Escape, then re-asking means pushing an unprompted
 *               question at someone who just said no (the mirror clause). Both
 *               say stop. So it SPENDS the cooldown, unlike `failed`.
 */
export async function elicitDetailed(
  message: string,
  requestedSchema: Record<string, unknown>,
  timeoutMs: number = DECISION_ASK_TIMEOUT_MS,
): Promise<ElicitOutcome> {
  if (!_elicit) return { kind: 'unsupported' };
  try {
    const started = Date.now();
    const res = await _elicit(stripUnsafeChars(message), requestedSchema, timeoutMs);
    if (res.action === 'accept') {
      noteOutcome(false);
      return { kind: 'accepted', content: res.content ?? {} };
    }
    if (res.action === 'decline') {
      // Unreadably fast. We do not know whether a policy answered for them or
      // they hammered Escape, and we are not going to guess in the user's name.
      // `no_answer` is the honest reading of both: nothing was recorded, no
      // choice is attributed to anyone, and the caller offers the text path —
      // which is exactly what a blocked host's user needs and costs a genuinely
      // fast decliner one plain sentence.
      if (Date.now() - started <= UNREADABLE_DECLINE_MAX_MS) {
        noteOutcome(true);
        return { kind: 'no_answer', reason: 'unattributable' };
      }
      noteOutcome(false);
      return { kind: 'declined' };
    }
    noteOutcome(false);
    return { kind: 'no_answer', reason: 'cancelled' }; // the host closed it without an answer
  } catch {
    noteOutcome(false);
    return { kind: 'no_answer', reason: 'failed' }; // declared support but the ask never landed
  }
}

/** Ask the user; returns null if unsupported / errored / not accepted. */
export async function elicit(
  message: string,
  requestedSchema: Record<string, unknown>,
  timeoutMs: number = DECISION_ASK_TIMEOUT_MS,
): Promise<Record<string, unknown> | null> {
  if (!_elicit) return null;
  try {
    // The elicitation `message` is a SEPARATE server→client request — it does NOT
    // pass through envelope()/sanitizeOutput, so a raw predicate/premise
    // interpolated into it (seal.ts, premises.ts) could carry ANSI escapes or a
    // forged "AI VERDICT" line that a terminal host renders (screen-clear +
    // spine spoof). Sanitize here, at the one seam every picker passes through,
    // so no call site can forget. stripUnsafeChars keeps \n and \t (a message
    // like `Record this?\n"…"` needs the newline).
    const started = Date.now();
    const res = await _elicit(stripUnsafeChars(message), requestedSchema, timeoutMs);
    noteOutcome(res.action === 'decline' && Date.now() - started <= UNREADABLE_DECLINE_MAX_MS);
    return res.action === 'accept' && res.content ? res.content : null;
  } catch {
    noteOutcome(false);
    return null; // host declared support but failed — fall back to text
  }
}
