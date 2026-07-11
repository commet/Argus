import type { ProgressiveSession } from '@/stores/types';

/**
 * The premise texts to offer for tracking on the web DecisionItemsCard, in
 * priority order. Pure + standalone so the population path is unit-testable
 * without a browser (the fix for "the card is empty for a normal sealed voyage",
 * internal design notes Phase 2 gap).
 *
 *   1. the progressive decision's OWN assumptions — the user's flinch bet (if any),
 *      then final_mix (preferred) / mix `key_assumptions`. These are present for a
 *      normally-sealed voyage, which is why they are the primary source.
 *   2. fallback: legacy reframe `hidden_assumptions` — only exists if the user
 *      exited to reframe mid-flow (ProgressiveFlow PipelineExitOptions.onReframe),
 *      so it is empty for a normal decision. Passed in by the caller.
 *
 * De-duped; empty/whitespace-only entries dropped.
 */
export function derivePremiseTexts(
  session: ProgressiveSession | null | undefined,
  reframeAssumptionTexts: (string | undefined)[],
): string[] {
  const clean = (arr: (string | undefined)[]) =>
    arr.filter((t): t is string => !!t && !!t.trim()).map((t) => t.trim());

  const mix = session?.final_mix ?? session?.mix ?? null;
  const fromSession = clean([session?.falsification?.real_bet, ...(mix?.key_assumptions || [])]);
  if (fromSession.length > 0) return [...new Set(fromSession)];

  return [...new Set(clean(reframeAssumptionTexts))];
}
