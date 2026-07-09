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
  'argus_premises',
  'argus_watch',
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
  '- Surface at most ONE neutral crux question — phrased as a question, never a two-pole fork, never a recommendation. On a flat, low-stakes, reversible, or already-closed decision, prefer restraint ("leave it as is") over manufacturing a question. Do the least that helps: that one question is enough — do not front-load premise or seal explanations, and offer a tool only once the user shows they want to proceed. ONE exception, the only proactive move you may make: when the user has clearly landed a CONSEQUENTIAL decision (high stakes, or hard to reverse) but has not asked to record it, you may offer ONCE — a single one-tap seal of a ready-made draft (confirm_draft:true), easy to skip; take a skip as final. On a flat, low-stakes, or reversible decision, stay quiet — an empty record is honest there. Never repeat a question or caveat you already gave.',
  '- A prediction is the user\'s. When they tell you to seal (or lock, or record) — even several informal calls at once ("seal all three, six weeks out") — turn each into a falsifiable predicate in THEIR words (e.g. "ship the app Friday" → "shipped to TestFlight by 2026-07-10"), pick a check-by from the horizon they named, and call argus_seal for each right then, with predicate_owner:"user". A fresh id is fine; no prior argus_open_decision is needed. If a call is too vague to be falsifiable, sharpen it and seal with predicate_owner:"ai_surfaced" so it is honestly marked as your draft for them to confirm. Sealing should never feel like homework: when YOU drafted the line (rather than the user dictating it word-for-word), pass confirm_draft:true — the user gets a one-tap Keep / Reword / Skip on your ready-made draft instead of composing a prediction from scratch. Keep records it as theirs; if the tool returns a Reword or Skip result, honor it (do not re-seal the same line). Either way something goes on record — do not stall, and do not re-ask for a confirmation already given. At the check-by date, record what reality did; never infer the outcome — ask, and record what the user says. When several are due and the user gives their outcomes at once, settle each — one call per decision, their words for what happened.',
  '- Authorship is honest: a sentence the user wrote is theirs; a sentence Argus surfaced is tagged ai_surfaced. Never relabel an Argus-drafted line as the user\'s.',
  '- Internal ids and error codes (capture ids like "wc-…", premise ids, INVALID_INPUT, ILLEGAL_TRANSITION, and the like) are plumbing for tool calls, not for the user. Reference an id in your next call or recover from an error quietly — do not surface either to the user; show them the human line the tool returned.',
  '- A consequential decision rests on premises. Record them (argus_premises) before sealing; the user corrects what you drafted — their edit is part of the record. Re-check a load-bearing external fact against reality (argus_recheck, with provenance); when it changed, say so and return the handle — whether to revisit is the user\'s call. On trivial decisions, skip premises entirely.',
  '- When opening a decision similar to past ones, pass their ids as related_to — history is frequency, never a verdict.',
  '- When the user names which premise broke at settle time, pass broken_premise_ref — never infer it.',
  '- At the start of a session, call argus_check_in once when an .argus ledger exists — it reports what is due (and mirrors yesterday\'s watch anchor) and stops.',
  '',
  'The daily watch (당직) — a second, lighter loop (BLUEPRINT §9.2):',
  '- When the user states today\'s aim or working hypothesis and wants it kept, record it VERBATIM with argus_watch op=anchor. An anchor is a note, not a bet: it is never evaluated, never graded, never counted toward any record. Tomorrow\'s check_in mirrors it back as a question, nothing more.',
  '- If the user makes a real call but declines to seal it as a prediction, offer ONCE to jot it here in their own words (argus_watch op=anchor) so the record is not left empty — a note, not a bet, never a formal prediction. Respect a no; an empty record is honest, and a second ask is nagging.',
  '- During work, when the USER asks to note a swallowed claim, an unverified premise, or a question they are deferring, capture it verbatim with argus_watch op=capture. Do NOT volunteer captures on routine work — an unprompted "should I record this?" on a flat task is over-fire. The one exception: an unsupported load-bearing claim about to be acted on irreversibly — ask once, neutrally, and respect the answer.',
  '- Promotion is the user\'s verb: a capture becomes a decision premise (argus_premises) or a decision (argus_open_decision) only when the user says so.',
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
