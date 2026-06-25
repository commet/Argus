import type { DecisionContract, Predicate } from '@/stores/types';
import { contractStatus, isResolved } from './decision-contract';

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

export function renderCheckInReminderEmail(args: {
  projectName: string;
  lean?: string;
  link: string;
}): string {
  const projectName = escapeReminderHtml(args.projectName || 'Untitled');
  const lean = args.lean?.trim();
  const leanHtml = lean
    ? `<p style="font-size:13px;color:#78716c;line-height:1.5;margin:0 0 16px">Your opening call: <strong>${escapeReminderHtml(lean)}</strong></p>`
    : '';
  return `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:480px;margin:0 auto;color:#1a1a1a">
      <p style="font-size:18px;font-weight:700;margin:0 0 12px">So, how did it go?</p>
      <p style="font-size:14px;color:#57534e;line-height:1.6;margin:0 0 8px">${projectName} is ready for its Argus check-in.</p>
      ${leanHtml}
      <a href="${escapeReminderHtml(args.link)}" style="display:inline-block;background:#2d4a7c;color:#fff;text-decoration:none;font-size:14px;font-weight:600;padding:10px 18px;border-radius:10px">Return and settle</a>
      <p style="font-size:11px;color:#a8a29e;margin:20px 0 0">You are receiving this because you turned on a one-time email reminder for this sealed decision.</p>
    </div>`;
}
