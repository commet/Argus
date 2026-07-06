/**
 * Growth note — the ONE structural reflection shown right after a settle
 * (DESIGN-judgment-checkpoints-v2 §10). NOT a coach, NOT a verdict about the
 * user: it cites only the record just written and names one contrast + one
 * thing to look at earlier next time.
 *
 * Three LLM-glue rules the doc insists on, all enforced here:
 *  1. INPUT CONTAINMENT — the prompt sees ONLY the original call + the just-
 *     recorded verdict/ambiguity/one-line. No session history, no profiling.
 *     If the model can only cite the record, it structurally can't invent.
 *  2. VOCAB BLOCK — a personality-trait verdict ("당신은 ~한 유형") drops the
 *     whole note (hasPersonalityVerdict); never softened.
 *  3. HONEST GAP — any failure (parse, empty, blocked, thrown) returns null and
 *     the caller shows just "기록됐습니다" — the blank is never filled.
 */

import { callLLMJson } from '@/lib/llm';
import { hasPersonalityVerdict } from '@/lib/question-rules';
import type { GrowthNote } from '@/stores/types';

export interface GrowthNoteInput {
  /** The user's own sealed line, verbatim (contract.judgment_receipt.human_judgment). */
  originalJudgment: string;
  /** The settled verdict word (happened/avoided/partial/unknown/missed) or 'mixed'. */
  verdict: string;
  /** For an unclear settle, the recorded reason. */
  ambiguityReason?: string;
  /** The user's one-line "what happened", if any. */
  userNote?: string;
}

export function buildGrowthNotePrompt(input: GrowthNoteInput, locale: 'ko' | 'en'): { system: string; user: string } {
  const lang = locale === 'ko' ? 'Korean' : 'English';
  const system = [
    `You reflect ONE structural contrast back to someone who just settled a decision. Always respond in ${lang}. Warm, plain, one breath.`,
    'You may cite ONLY the record below. You have no other information about this person — no history, no personality, no pattern across decisions.',
    'Produce exactly two one-sentence fields:',
    '  widened_view: what became a little clearer by holding the original call against what happened. Name the STRUCTURE (a premise, a signal, a timing), not the person.',
    '  future_attention: one concrete thing worth looking at earlier in a SIMILAR decision next time.',
    'HARD BANS: never say "you are a … type/person", never a trait, never a score/%/tier, never "you always/tend to". If you cannot do this from the record alone, return empty strings.',
    'Respond in JSON only: {"widened_view": "...", "future_attention": "..."}',
  ].join('\n');

  const lines = [
    `Original call (verbatim): ${input.originalJudgment}`,
    `What reality did: ${input.verdict}`,
    input.ambiguityReason ? `Still-unclear reason: ${input.ambiguityReason}` : '',
    input.userNote ? `Their one line: ${input.userNote}` : '',
  ].filter(Boolean);
  const user = `The record:\n${lines.join('\n')}\n\nReflect the one contrast now. JSON:`;
  return { system, user };
}

/**
 * Generate the growth note. Returns null on ANY failure or a blocked personality
 * verdict (honest gap — the caller renders nothing extra). scope is always
 * 'single_check' here: aggregate tiers (2+) are patterns' domain, not this one
 * (§11). Pure except the LLM call; `signal` cancellable.
 */
export async function generateGrowthNote(
  input: GrowthNoteInput,
  locale: 'ko' | 'en',
  signal?: AbortSignal,
): Promise<GrowthNote | null> {
  if (!input.originalJudgment?.trim()) return null; // no anchor → nothing honest to say
  try {
    const { system, user } = buildGrowthNotePrompt(input, locale);
    const r = await callLLMJson<{ widened_view?: string; future_attention?: string }>(
      [{ role: 'user', content: user }],
      { system, maxTokens: 400, signal, shape: { widened_view: 'string', future_attention: 'string' } },
    );
    const widened = (r.widened_view ?? '').trim();
    const future = (r.future_attention ?? '').trim();
    if (!widened || !future) return null;
    if (hasPersonalityVerdict(widened) || hasPersonalityVerdict(future)) return null;
    return { scope: 'single_check', widened_view: widened, future_attention: future, evidence_count: 1 };
  } catch {
    return null;
  }
}
