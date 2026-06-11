/**
 * Return email — "그래서, 어떻게 됐어요?" (W1.2 ③, STUB).
 *
 * 착수 조건 (EXECUTION-PLAN-v4.1 W1.2): 봉인 누적 ≥10건. Until then this stays
 * a pure builder with NO sending wired — building delivery infrastructure for
 * an audience of one is premature (현실 접촉 케이던스 원칙). When the threshold
 * is met: one Resend template, one email kind, subject below, link to /project
 * (the SettlementModal opens itself when the check-in is due).
 *
 * The builder is real so the send path, when it lands, has zero copy decisions
 * left to make.
 */

import type { LedgerDecision } from './ledger-schema';

/** Sealed-contract count at which the send path gets built. */
export const RETURN_EMAIL_SEAL_THRESHOLD = 10;

export interface ReturnEmailDraft {
  subject: string;
  /** Plain-text body. 해요체 동료 음성 — no scores, no praise/warning vocab. */
  body: string;
  /** Deep link the CTA points at. */
  url: string;
}

/** One email kind: the return question for a due decision. */
export function buildReturnEmail(
  decision: Pick<LedgerDecision, 'decision' | 'predicate' | 'check_by'>,
  baseUrl = 'https://argus.app',
): ReturnEmailDraft {
  const summary = (decision.decision || '').slice(0, 60) || '그 결정';
  return {
    subject: `그래서, 어떻게 됐어요? — ${summary}`,
    body: [
      `그때 이렇게 정하셨어요: ${decision.decision}`,
      '',
      `확인하기로 한 것: ${decision.predicate}`,
      '',
      '실제로 어떻게 됐는지, 1분이면 돼요. 아직 모르겠으면 "아직"도 답이에요 — 날짜만 미뤄둘게요.',
    ].join('\n'),
    url: `${baseUrl}/project`,
  };
}
