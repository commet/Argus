/**
 * Single source of truth for the Argus spine (blueprint §3.6 + addendum G/K).
 *
 * The spine is enforced by STRUCTURE, not prose: there is no verdict tool,
 * settle hard-errors without a prior seal, malformed seals are refused. The
 * little prose that remains (restraint framing, crux rules) lives ONLY here so
 * the three surfaces (webapp / plugin / mcp) cannot drift. The MCP server
 * `instructions` field and any prompt text are rendered from this object — they
 * are never re-typed elsewhere.
 */

/**
 * The closed set of follow-up actions a tool may suggest. There is, by
 * construction, no 'verdict' / 'recommend' / 'decide' / 'advise' member — a
 * verdict cannot be expressed as a next action because the type cannot name it.
 * The drift-guard test asserts this list contains no judgment verb.
 */
export const NEXT_ACTIONS = [
  'argus_open_decision',
  'argus_seal',
  'argus_settle',
  'argus_check_in',
  'argus_recall',
  'argus_config',
  'skip',
  'leave_as_is',
  'stop',
] as const;

export type NextAction = (typeof NEXT_ACTIONS)[number];

/** Verbs that must never appear in a tool name or a next-action (drift-guard). */
export const FORBIDDEN_VERDICT_VERBS = [
  'verdict',
  'recommend',
  'decide',
  'advise',
  'grade',
  'score',
  'judge',
  'rank',
] as const;

/**
 * The schema keys that, if present on `argus_open_decision`'s output, would let
 * a fork or a lean be expressed. The drift-guard test asserts their ABSENCE.
 */
export const FORBIDDEN_FORK_KEYS = ['options', 'poles', 'lean', 'tilt', 'recommendation'] as const;

/**
 * Server `instructions` string returned at `initialize` (addendum G). This is
 * the one spec-sanctioned, host-universal place for spine bias — loaded once on
 * connect, before any tool call. It is RESTRAINT FRAMING, not a pasted
 * system-prompt: it tells the model what Argus refuses, not how to think.
 */
export const SERVER_INSTRUCTIONS = [
  'Argus records decisions; it does not judge them.',
  '',
  'When the user calls a tool, honor these invariants:',
  '- Never deliver a verdict on the user\'s decision (no "you were right/wrong", no "the stronger case is X", no disclaimed lean). There is no verdict tool because there is no verdict to give.',
  '- Surface at most ONE neutral crux question — phrased as a question, never a two-pole fork, never a recommendation. On a flat, low-stakes, reversible, or already-closed decision, prefer restraint ("leave it as is") over manufacturing a question.',
  '- A prediction is the user\'s. Seal it with a falsifiable predicate and a check-by date; at that date, record what reality did. Never infer the outcome — ask, and record what the user says.',
  '- Authorship is honest: a sentence the user wrote is theirs; a sentence Argus surfaced is tagged ai_surfaced. Never relabel an Argus-drafted line as the user\'s.',
  '',
  'Argus surfaces one question and names any faint lean as a known limit. It does not claim to be free of judgment — that is an asymptote, not a promise.',
].join('\n');

/** The schema version stamped on every persisted record (addendum N1). */
export const SCHEMA_VERSION = 1;

/**
 * Invariants the drift-guard test pins. If any surface diverges, CI fails.
 * (Mirrors the CLAUDE.md "single source of truth for prompts" rule.)
 */
export const SPINE_INVARIANTS = {
  nextActions: NEXT_ACTIONS,
  forbiddenVerdictVerbs: FORBIDDEN_VERDICT_VERBS,
  forbiddenForkKeys: FORBIDDEN_FORK_KEYS,
  serverInstructions: SERVER_INSTRUCTIONS,
  schemaVersion: SCHEMA_VERSION,
  /** Every settled receipt asserts this literal — reality settles, the model never grades. */
  aiVerdict: null as null,
} as const;
