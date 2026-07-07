/**
 * Return email builder.
 *
 * Pure only: sending stays in cron code. The CTA is part of the contract:
 * /[locale]/project?from=checkin&return={id} must open the exact due decision.
 */

import type { LedgerDecision } from './ledger-schema';

/** Sealed-contract count at which the send path gets built. */
export const RETURN_EMAIL_SEAL_THRESHOLD = 10;

export type ReturnEmailLocale = 'ko' | 'en';

export interface ReturnEmailDraft {
  subject: string;
  /** Plain-text body. No scores, no praise/warning vocabulary. */
  body: string;
  /** Deep link the CTA points at. */
  url: string;
}

function trimBaseUrl(baseUrl: string): string {
  return (baseUrl || 'https://argus.voyage').replace(/\/+$/, '');
}

export function buildProjectReturnUrl(
  baseUrl = 'https://argus.voyage',
  locale: ReturnEmailLocale = 'ko',
  returnId?: string,
): string {
  const url = new URL(`${trimBaseUrl(baseUrl)}/${locale}/project`);
  url.searchParams.set('from', 'checkin');
  if (returnId?.trim()) url.searchParams.set('return', returnId.trim());
  return url.toString();
}

export function returnEmailSubject(userSealedSentence: string | undefined, fallback: string): string {
  const subject = (userSealedSentence || fallback || '').trim().replace(/\s+/g, ' ');
  return subject.slice(0, 90) || fallback;
}

/** One email kind: the return question for a due decision. */
export function buildReturnEmail(
  decision: Pick<LedgerDecision, 'id' | 'decision' | 'predicate' | 'check_by'>,
  baseUrl = 'https://argus.voyage',
  locale: ReturnEmailLocale = 'ko',
): ReturnEmailDraft {
  const ko = locale === 'ko';
  const summary = (decision.decision || '').slice(0, 60) || (ko ? '그 결정' : 'that decision');
  const url = buildProjectReturnUrl(baseUrl, locale, decision.id);

  if (!ko) {
    return {
      subject: returnEmailSubject(decision.decision, summary),
      body: [
        `"${decision.decision}"`,
        '',
        `What you said would show it: ${decision.predicate}`,
        '',
        'One tap opens the decision. Record what happened, or leave it open if reality is not clear yet.',
      ].join('\n'),
      url,
    };
  }

  return {
    subject: returnEmailSubject(decision.decision, summary),
    body: [
      `"${decision.decision}"`,
      '',
      `그때 확인하기로 한 것: ${decision.predicate}`,
      '',
      '한 번 누르면 해당 결정이 열립니다. 실제로 어땠는지만 적고, 아직 모르겠으면 그대로 열어 두세요.',
    ].join('\n'),
    url,
  };
}
