/**
 * sim-entry.ts — bundled by run-sim.mjs (esbuild) with '@/lib/llm' aliased to
 * ../llm-shim.mjs (kept EXTERNAL so run-sim.mjs shares the same module instance
 * and can read the call log).
 *
 * Light path: the REAL engine functions (runLightGate / runLightNext) run
 * unmodified — real prompts, real crisis gate, real coercion/clamps.
 *
 * Heavy path: the REAL prompt builders (buildInitialAnalysisPrompt /
 * buildDeepeningPrompt / buildMixPrompt) called through the same callLLMJson
 * surface with the EXACT call shapes progressive-engine.ts uses (model tier,
 * maxTokens, shape, cacheSystem) — progressive-engine itself is store/UI-
 * entangled (zustand agent store, getCurrentLanguage) so its pure call shapes
 * are replicated here 1:1 instead of importing the file.
 */

export {
  runLightGate,
  runLightNext,
  composeDeepenText,
  buildLightSystemPrompt,
  LIGHT_MAX_QUESTIONS,
} from '@/lib/light-path/light-engine';
export { classifyCrisis } from '@/lib/crisis-gate';
export {
  buildInitialAnalysisPrompt,
  buildDeepeningPrompt,
  buildMixPrompt,
} from '@/lib/progressive-prompts';

import {
  buildInitialAnalysisPrompt,
  buildDeepeningPrompt,
  buildMixPrompt,
} from '@/lib/progressive-prompts';
import { callLLMJson } from '@/lib/llm';

type Locale = 'ko' | 'en';

// ─── Verbatim replica of progressive-engine.ts applyRouteContract (pure fn) ───

const NON_OPEN_REQUEST_TYPES = new Set([
  'vent', 'validation', 'info', 'self_profiling', 'flat', 'resistance',
]);

export function applyRouteContract<T extends { request_type?: string; skeleton?: string[] }>(
  result: T,
): { result: T; coerced: boolean } {
  const rt = result.request_type;
  if (rt && NON_OPEN_REQUEST_TYPES.has(rt) && Array.isArray(result.skeleton) && result.skeleton.length > 0) {
    return { result: { ...result, skeleton: [] }, coerced: true };
  }
  return { result, coerced: false };
}

// ─── Heavy call shapes (progressive-engine.ts runInitialAnalysis / runDeepening / runMix) ───

export interface SimSnapshot {
  version: number;
  insight?: string;
  real_question: string;
  hidden_assumptions: string[];
  skeleton: string[];
  stakes?: 'routine' | 'important' | 'critical';
  reversibility?: 'reversible' | 'partial' | 'irreversible';
  request_type?: string;
  timestamp?: number;
}

export interface SimQA {
  question: { id: string; text: string; subtext?: string; options?: string[]; type: string };
  answer: { question_id: string; value: string };
}

export async function runHeavyInitial(problemText: string, locale: Locale): Promise<{
  raw: Record<string, unknown>;
  result: Record<string, unknown>;
  routeCoerced: boolean;
}> {
  const { system, user } = buildInitialAnalysisPrompt(problemText, locale);
  // engine shape: maxTokens 4096, default tier, cacheSystem, same shape map
  const raw = await callLLMJson<Record<string, unknown>>(
    [{ role: 'user', content: user }],
    {
      system, maxTokens: 4096, cacheSystem: true,
      shape: { real_question: 'string', hidden_assumptions: 'array', skeleton: 'array', next_question: 'object' },
    } as never,
  ) as Record<string, unknown>;
  const { result, coerced } = applyRouteContract({ ...raw } as { request_type?: string; skeleton?: string[] });
  return { raw, result: result as Record<string, unknown>, routeCoerced: coerced };
}

export async function runHeavyDeepening(
  problemText: string,
  currentSnapshot: SimSnapshot,
  questionsAndAnswers: SimQA[],
  round: number,
  maxRounds: number,
  locale: Locale,
): Promise<Record<string, unknown>> {
  const { system, user } = buildDeepeningPrompt(
    problemText,
    currentSnapshot as never,
    questionsAndAnswers as never,
    round,
    maxRounds,
    locale,
  );
  // engine shape: maxTokens 2500, default tier
  return await callLLMJson<Record<string, unknown>>(
    [{ role: 'user', content: user }],
    {
      system, maxTokens: 2500,
      shape: { insight: 'string', real_question: 'string', hidden_assumptions: 'array', skeleton: 'array', ready_for_mix: 'boolean' },
    } as never,
  ) as Record<string, unknown>;
}

export async function runHeavyMix(
  problemText: string,
  snapshots: SimSnapshot[],
  questionsAndAnswers: SimQA[],
  decisionMaker: string | null,
  locale: Locale,
): Promise<Record<string, unknown>> {
  const { system, user } = buildMixPrompt(
    problemText,
    snapshots as never,
    questionsAndAnswers as never,
    decisionMaker,
    undefined, // workerResults — express path: no crew ran
    locale,
    null,      // leadSynthesis
    undefined, // blockedTasks
  );
  // engine shape: maxTokens 5500, model 'default' (standard judgment mode)
  return await callLLMJson<Record<string, unknown>>(
    [{ role: 'user', content: user }],
    {
      system, maxTokens: 5500, model: 'default',
      shape: { title: 'string', executive_summary: 'string', sections: 'array', key_assumptions: 'array', next_steps: 'array' },
    } as never,
  ) as Record<string, unknown>;
}
