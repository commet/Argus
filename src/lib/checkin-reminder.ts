import type { DecisionContract, Predicate } from '@/stores/types';
import { contractStatus, isResolved } from './decision-contract';

/** Reminder ceiling (10 S3): a due contract is nudged at most this many times,
 *  then the cron goes quiet — the decision stays visible on the web due
 *  surfaces, waiting instead of nagging. The mute button jumps straight here. */
export const REMINDER_MAX_SENDS = 3;

export function isCheckInReminderDue(
  contract: DecisionContract | null | undefined,
  now: number,
): boolean {
  if (!contract?.check_in_at) return false;
  return contractStatus(contract, now).checkInDue;
}

export function selectOpenPredicate(contract: DecisionContract): Predicate | undefined {
  const predicates = Array.isArray(contract.predicates) ? contract.predicates : [];
  return predicates.find((p) => !isResolved(p)) ?? predicates[0];
}

export function escapeReminderHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** The return email body. One voice with the Korean subject the cron already
 *  sends ("그래서, 어떻게 됐어요? — {name}") — a Korean user opening a Korean
 *  subject must not land in English plumbing (02 P0-2). */
export function renderCheckInReminderEmail(args: {
  projectName: string;
  lean?: string;
  link: string;
  locale?: 'ko' | 'en';
  /** True on the REMINDER_MAX_SENDS-th (last) send — says so honestly. */
  isFinal?: boolean;
}): string {
  const locale = args.locale ?? 'en';
  const projectName = escapeReminderHtml(args.projectName || (locale === 'ko' ? '제목 없는 결정' : 'Untitled'));
  const lean = args.lean?.trim();
  const linkHtml = escapeReminderHtml(args.link);

  if (locale === 'ko') {
    const leanHtml = lean
      ? `<p style="font-size:13px;color:#78716c;line-height:1.5;margin:0 0 16px">그때 적어둔 방향: <strong>${escapeReminderHtml(lean)}</strong></p>`
      : '';
    const finalHtml = args.isFinal
      ? `<p style="font-size:11px;color:#a8a29e;margin:8px 0 0">이 알림은 이번이 마지막이에요 — 이제 조용히 열어둘게요. 언제든 돌아오시면 프로젝트 페이지에 그대로 있어요.</p>`
      : '';
    return `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:480px;margin:0 auto;color:#1a1a1a">
      <p style="font-size:18px;font-weight:700;margin:0 0 12px">그래서, 어떻게 됐어요?</p>
      <p style="font-size:14px;color:#57534e;line-height:1.6;margin:0 0 8px">${projectName}의 확인일이 왔어요. 맞았는지 틀렸는지는 제가 정하지 않아요 — 어땠는지만, 1분이면 기록할 수 있어요.</p>
      ${leanHtml}
      <a href="${linkHtml}" style="display:inline-block;background:#2d4a7c;color:#fff;text-decoration:none;font-size:14px;font-weight:600;padding:10px 18px;border-radius:10px">돌아와서 정산하기</a>
      <p style="font-size:11px;color:#a8a29e;margin:20px 0 0">이 메일은 이 결정을 봉인할 때 직접 켜둔 1회성 알림이에요.</p>
      ${finalHtml}
    </div>`;
  }

  const leanHtml = lean
    ? `<p style="font-size:13px;color:#78716c;line-height:1.5;margin:0 0 16px">Your opening call: <strong>${escapeReminderHtml(lean)}</strong></p>`
    : '';
  const finalHtml = args.isFinal
    ? `<p style="font-size:11px;color:#a8a29e;margin:8px 0 0">This is the last reminder — I’ll keep it quietly open. Whenever you come back, it’s right there on your project page.</p>`
    : '';
  return `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:480px;margin:0 auto;color:#1a1a1a">
      <p style="font-size:18px;font-weight:700;margin:0 0 12px">So, how did it go?</p>
      <p style="font-size:14px;color:#57534e;line-height:1.6;margin:0 0 8px">${projectName} is ready for its Argus check-in.</p>
      ${leanHtml}
      <a href="${linkHtml}" style="display:inline-block;background:#2d4a7c;color:#fff;text-decoration:none;font-size:14px;font-weight:600;padding:10px 18px;border-radius:10px">Return and settle</a>
      <p style="font-size:11px;color:#a8a29e;margin:20px 0 0">You are receiving this because you turned on a one-time email reminder for this sealed decision.</p>
      ${finalHtml}
    </div>`;
}

export function resendEmailErrorMessage(result: unknown): string | null {
  if (!result || typeof result !== 'object' || !('error' in result)) return null;
  const error = (result as { error?: unknown }).error;
  if (!error) return null;
  if (typeof error === 'string') return error;
  if (typeof error === 'object' && error && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string' && message.trim()) return message;
  }
  return 'unknown email send error';
}
