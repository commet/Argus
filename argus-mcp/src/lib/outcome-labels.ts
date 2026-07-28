import type { SurfaceLocale } from './surfaces.js';

/**
 * The five ways reality can answer, in the user's words — ONE definition.
 *
 * These labels were written out twice (settle.ts's in-band picker and
 * ambient-elicit.ts's out-of-band one) with a comment asking future editors to
 * keep them in lockstep by hand, and a third, different vocabulary lived in the
 * settle card. The same user can meet all three in one week. CLAUDE.md's rule
 * is explicit: extract, don't copy, so the two surfaces cannot drift.
 *
 * Wording rules learned by rendering these and reading them cold (2026-07-28):
 *  - never show the enum value to a human (`held`, `partial`, …). It is our
 *    filing system, not their language.
 *  - `held` vs `avoided` is the pair people get wrong, and the tool description
 *    already warns about it. Say what each one means rather than trusting the
 *    label to be self-evident.
 *  - `still_pending` is NOT a verdict. It records nothing and moves the date.
 *    It must read as an escape, not as a fifth answer.
 */
export const OUTCOME_VALUES = ['held', 'avoided', 'partial', 'still_pending', 'missed'] as const;
export type OutcomeValue = (typeof OUTCOME_VALUES)[number];

const LABELS: Record<SurfaceLocale, Record<OutcomeValue, string>> = {
  ko: {
    held: '예측대로 됐다',
    avoided: '걱정한 일이 안 일어났다',
    partial: '일부만 맞았다',
    still_pending: '아직 모르겠다 (결과 기록 안 함)',
    missed: '예측이 빗나갔다',
  },
  en: {
    held: 'It held: the thing happened',
    avoided: 'Avoided: the risk did not occur',
    partial: 'Partially right',
    still_pending: "Don't know yet (records nothing)",
    missed: 'Missed: my read was wrong',
  },
};

/** enumNames for an elicitation picker, in OUTCOME_VALUES order. */
export function outcomeEnumNames(locale: SurfaceLocale): string[] {
  return OUTCOME_VALUES.map((v) => LABELS[locale][v]);
}

/** The one-line prompt above the choices. */
export function outcomeFieldDescription(locale: SurfaceLocale): string {
  return locale === 'ko'
    ? '저장한 예측에 현실이 어떻게 답했는지 고르세요.'
    : 'What reality did to your sealed prediction.';
}
