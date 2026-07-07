import type { DecisionContract, Predicate } from '@/stores/types';
import { contractStatus, isResolved } from './decision-contract';
import { T1_RETURN_MAX_SENDS } from './notification-gate';

/** Reminder ceiling (10 S3): a due contract is nudged at most this many times,
 *  then the cron goes quiet — the decision stays visible on the web due
 *  surfaces, waiting instead of nagging. The mute button jumps straight here. */
export const REMINDER_MAX_SENDS = T1_RETURN_MAX_SENDS;

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

/** The return email body. The first visible line is the user's sealed sentence,
 *  then the fact, then one handle plus an exit. */
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
    const quote = escapeReminderHtml(lean || args.projectName || '그 결정');
    const finalHtml = args.isFinal
      ? `<p style="font-size:11px;color:#a8a29e;margin:8px 0 0">이 알림은 이번이 마지막이에요 — 이제 조용히 열어둘게요. 언제든 돌아오시면 프로젝트 페이지에 그대로 있어요.</p>`
      : '';
    return `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:480px;margin:0 auto;color:#1a1a1a">
      <p style="font-size:18px;font-weight:700;margin:0 0 12px">"${quote}"</p>
      <p style="font-size:14px;color:#57534e;line-height:1.6;margin:0 0 8px">${projectName}의 확인일이 왔어요. 맞았는지 틀렸는지는 제가 정하지 않아요 — 어땠는지만, 1분이면 기록할 수 있어요.</p>
      <a href="${linkHtml}" style="display:inline-block;background:#2d4a7c;color:#fff;text-decoration:none;font-size:14px;font-weight:600;padding:10px 18px;border-radius:10px">30초 안에 기록하기</a>
      <p style="font-size:11px;color:#a8a29e;margin:20px 0 0">아직 모르겠으면 그대로 열어두세요. 이 메일은 이 결정을 봉인할 때 직접 켜둔 알림이에요.</p>
      ${finalHtml}
    </div>`;
  }

  const quote = escapeReminderHtml(lean || args.projectName || 'that decision');
  const finalHtml = args.isFinal
    ? `<p style="font-size:11px;color:#a8a29e;margin:8px 0 0">This is the last reminder — I’ll keep it quietly open. Whenever you come back, it’s right there on your project page.</p>`
    : '';
  return `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:480px;margin:0 auto;color:#1a1a1a">
      <p style="font-size:18px;font-weight:700;margin:0 0 12px">"${quote}"</p>
      <p style="font-size:14px;color:#57534e;line-height:1.6;margin:0 0 8px">${projectName} is ready for its Argus check-in.</p>
      <a href="${linkHtml}" style="display:inline-block;background:#2d4a7c;color:#fff;text-decoration:none;font-size:14px;font-weight:600;padding:10px 18px;border-radius:10px">Record it in 30 seconds</a>
      <p style="font-size:11px;color:#a8a29e;margin:20px 0 0">If reality is still unclear, leave it open. You are receiving this because you turned on this decision reminder.</p>
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
