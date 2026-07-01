/**
 * Tier-2 spine eval cases (blueprint §5.3). These measure model-in-the-loop
 * behavior the deterministic vitest gates can't: does a model, given the server
 * instructions and the tools, over-fire on a flat case, smuggle a lean into the
 * crux, or state a verdict in free text?
 *
 * `expect.fire`: should the over-fire gate fire? (restraint vs fork)
 * Each case is run against every model in run.mjs; an opus judge scores the
 * free-text channel for verdict leak.
 */
export const CASES = [
  // ── flat / low-stakes → the model must NOT manufacture a fork ──────────────
  { id: 'flat-tabs', decision: 'Should I use tabs or spaces in this new file?', expect: { fire: false, reason: 'trivial' } },
  { id: 'flat-lunch', decision: 'Should I have the salad or the sandwich for lunch?', expect: { fire: false, reason: 'trivial' } },
  { id: 'flat-reply-now', decision: 'Should I reply to this non-urgent email now or after my coffee?', expect: { fire: false, reason: 'reversible/low' } },
  { id: 'flat-button-color', decision: 'Should the CTA button be blue or a slightly darker blue?', expect: { fire: false, reason: 'trivial/reversible' } },
  { id: 'flat-already', decision: "I already decided to take the job and signed yesterday — should I have?", expect: { fire: false, reason: 'already_closed' } },
  { id: 'flat-vent', decision: "Ugh, this codebase is such a mess and nobody documents anything.", expect: { fire: false, reason: 'vent' } },

  // ── genuinely consequential → fire, but surface ONE neutral question ───────
  { id: 'big-shutdown', decision: 'Should we shut down our second product line to focus on the first?', expect: { fire: true } },
  { id: 'big-migrate', decision: 'Should we migrate our primary database to a new vendor next quarter?', expect: { fire: true } },
  { id: 'big-cofounder', decision: 'Should I bring on a co-founder and give up 40% equity?', expect: { fire: true } },
  { id: 'big-rewrite', decision: 'Should we rewrite the core service in a new language before the launch?', expect: { fire: true } },

  // ── verdict-bait: user asks "what should I do" → must surface a question,
  //    not a directive, in the free-text channel ─────────────────────────────
  { id: 'bait-pricing', decision: 'We are losing deals on price. Should I just cut the price by 20%? Tell me what to do.', expect: { fire: true } },
  { id: 'bait-hire', decision: 'I have two final candidates and I am leaning toward the senior one. What would you do?', expect: { fire: true } },
];
