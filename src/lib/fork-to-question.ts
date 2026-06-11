/**
 * fork-to-question — mechanical Fork → FlowQuestion conversion (W2.2).
 *
 * NO LLM anywhere in this file. The probe already did the measuring; turning a
 * measured fork into a question is pure assembly, so it is deterministic and
 * unit-testable. (The plan allows LLM "포매팅만" — we don't even need that.)
 *
 * Priority (plan): 목적-수준 갈림 (purpose_reading) first, then by
 * flipped_user_claim strength. "Strength" must be mechanical, so it is defined
 * as: more variants = wider measured divergence, then a longer cause_quote =
 * a more specific anchor. Documented here, asserted in tests.
 *
 * Cap: ≤2 measurement-anchored questions per session (MAX_PROBE_QUESTIONS) —
 * the deepening loop keeps the rest of the conversation (적층, not 교체).
 *
 * Copy rules (P1/P2): the question presents the fork as a MEASUREMENT
 * ("따로따로 읽은 실행자들이 갈렸어요") quoting the user's own phrase, never as
 * a verdict. Options = the variants the executors actually produced + the
 * standing escape hatch "직접 쓸게요".
 */

import type { FlowQuestion } from '@/stores/types';
import type { Fork, ForkField } from './probe-engine';

/** 세션당 측정-정박 질문 상한 (plan W2.2). */
export const MAX_PROBE_QUESTIONS = 2;

/** The standing free-text option appended to every probe question. */
export const WRITE_MY_OWN_KO = '직접 쓸게요';
export const WRITE_MY_OWN_EN = "I'll write my own";

/** Per-field question lead-ins — what the fork is ABOUT, in plain 해요체. */
const FIELD_LEAD: Record<ForkField, { ko: string; en: string }> = {
  purpose_reading: {
    ko: '이 일이 누구의 어떤 문제를 푸는지부터 갈렸어요',
    en: 'They split on whose problem this is solving',
  },
  week1_action: {
    ko: '첫 주에 무엇부터 할지가 갈렸어요',
    en: 'They split on what to do first',
  },
  key_resource: {
    ko: '성패를 가르는 핵심 자원이 무엇인지 갈렸어요',
    en: 'They split on the make-or-break resource',
  },
  success_test: {
    ko: '"됐다"를 어떻게 확인할지가 갈렸어요',
    en: 'They split on how to verify success',
  },
};

/** purpose-level forks outrank execution-level forks (plan priority rule). */
function fieldRank(field: ForkField): number {
  return field === 'purpose_reading' ? 0 : 1;
}

/** Mechanical flipped-claim strength: variants count desc, cause_quote length
 *  desc. Deterministic tiebreak: field name, then claim text. */
export function compareForkPriority(a: Fork, b: Fork): number {
  const rank = fieldRank(a.field) - fieldRank(b.field);
  if (rank !== 0) return rank;
  const variants = b.variants.length - a.variants.length;
  if (variants !== 0) return variants;
  const quote = b.cause_quote.length - a.cause_quote.length;
  if (quote !== 0) return quote;
  const field = a.field.localeCompare(b.field);
  if (field !== 0) return field;
  return a.flipped_user_claim.localeCompare(b.flipped_user_claim);
}

/** Deterministic id from fork identity (djb2, mirrors stablePredicateId) so a
 *  re-probe that finds the same fork never duplicates the question. */
export function forkQuestionId(fork: Fork): string {
  const key = `${fork.field}|${fork.cause_quote}|${fork.flipped_user_claim}`;
  let hash = 5381;
  for (let i = 0; i < key.length; i++) {
    hash = ((hash << 5) + hash + key.charCodeAt(i)) | 0;
  }
  return `probe-fork-${(hash >>> 0).toString(36)}`;
}

export interface ForkToQuestionOptions {
  locale?: 'ko' | 'en';
  /** Question slots remaining this session (default MAX_PROBE_QUESTIONS). */
  limit?: number;
  /** Set false when the consuming UI already renders its own free-text input
   *  (e.g. QuestionCard's "또는 직접 입력...") — avoids a duplicate escape hatch. */
  includeWriteMyOwn?: boolean;
}

/**
 * Convert measured forks into FlowQuestions, highest priority first, capped.
 * Forks without a flipped_user_claim never reach here (probe-engine drops
 * them), but the filter is repeated — defense in depth, this module is the
 * last gate before the user sees a question.
 */
export function forksToQuestions(forks: Fork[], opts: ForkToQuestionOptions = {}): FlowQuestion[] {
  const locale = opts.locale ?? 'ko';
  const ko = locale === 'ko';
  const limit = Math.max(0, Math.min(opts.limit ?? MAX_PROBE_QUESTIONS, MAX_PROBE_QUESTIONS));

  const eligible = (Array.isArray(forks) ? forks : []).filter(
    (f) =>
      f &&
      typeof f.flipped_user_claim === 'string' &&
      f.flipped_user_claim.trim().length > 0 &&
      typeof f.cause_quote === 'string' &&
      f.cause_quote.trim().length > 0 &&
      Array.isArray(f.variants) &&
      f.variants.length >= 2,
  );

  return [...eligible]
    .sort(compareForkPriority)
    .slice(0, limit)
    .map((fork) => {
      const lead = FIELD_LEAD[fork.field] ?? FIELD_LEAD.purpose_reading;
      return {
        id: forkQuestionId(fork),
        // The measurement, anchored to the user's own phrase (P2) — no verdict
        // (P1). SUBJECT restored: "갈렸어요" without naming WHO read it lands
        // as "the AI is confused" for users who never saw the theater.
        text: ko
          ? `같은 글을 따로 읽은 AI들이 ${lead.ko} — "${fork.cause_quote}"를 서로 다르게 읽었어요. 어느 쪽이 맞아요?`
          : `AIs reading the same text separately ${lead.en.toLowerCase().replace(/^they /, '')} — they read "${fork.cause_quote}" differently. Which is right?`,
        // Why this fork matters to THEM: their own implicit claim flips on it.
        subtext: ko
          ? `이 선택에 따라 "${fork.flipped_user_claim}"이 참도 거짓도 됩니다.`
          : `Depending on this, "${fork.flipped_user_claim}" becomes true or false.`,
        options: [
          ...fork.variants,
          ...(opts.includeWriteMyOwn === false ? [] : [ko ? WRITE_MY_OWN_KO : WRITE_MY_OWN_EN]),
        ],
        type: 'select' as const,
        // Purpose-level forks reframe the question itself; execution-level
        // forks shape the plan.
        engine_phase: fork.field === 'purpose_reading' ? ('reframe' as const) : ('recast' as const),
      };
    });
}
