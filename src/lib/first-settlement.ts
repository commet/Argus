import type { DecisionContract, LeanAfter } from '@/stores/types';
import { buildProjectReturnUrl, type ReturnEmailLocale } from './return-email';
import { escapeReminderHtml } from './checkin-reminder';

export const FIRST_SETTLEMENT_INVITE_DAY = 7;
export const FIRST_SETTLEMENT_MIN_HORIZON_DAYS = 21;

const DAY_MS = 86_400_000;

function localDayMs(input: string | number): number | null {
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return null;
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

export function daysBetweenLocal(start: string | number, end: string | number): number | null {
  const a = localDayMs(start);
  const b = localDayMs(end);
  if (a === null || b === null) return null;
  return Math.round((b - a) / DAY_MS);
}

export function isFirstSettlementInviteDue(contract: DecisionContract | null | undefined, now: number): boolean {
  if (!contract?.created_at || !contract.check_in_at) return false;
  if (contract.first_settlement_invited_at || contract.first_settlement_muted || contract.lean_after) return false;
  const horizon = daysBetweenLocal(contract.created_at, contract.check_in_at);
  const age = daysBetweenLocal(contract.created_at, now);
  return horizon !== null
    && age !== null
    && horizon >= FIRST_SETTLEMENT_MIN_HORIZON_DAYS
    && age >= FIRST_SETTLEMENT_INVITE_DAY
    && age < FIRST_SETTLEMENT_INVITE_DAY + 1;
}

export function firstSettlementAnchor(contract: DecisionContract, fallback = ''): string {
  return (
    contract.judgment_receipt?.human_judgment?.trim()
    || contract.predicates?.find((p) => p.source === 'user_lean')?.text?.trim()
    || contract.predicates?.[0]?.text?.trim()
    || fallback
  );
}

export function buildFirstSettlementUrl(
  baseUrl: string,
  locale: ReturnEmailLocale,
  projectId: string,
  view?: LeanAfter['view'] | 'unknown',
): string {
  const url = new URL(buildProjectReturnUrl(baseUrl, locale, projectId));
  url.searchParams.set('from', 'first-settlement');
  if (view) url.searchParams.set('first', view);
  return url.toString();
}

export function buildFirstSettlementEmail(args: {
  anchor: string;
  projectId: string;
  baseUrl?: string;
  locale?: ReturnEmailLocale;
}): { subject: string; html: string } {
  const locale = args.locale ?? 'ko';
  const ko = locale === 'ko';
  const baseUrl = args.baseUrl || 'https://argus.voyage';
  const anchor = args.anchor.trim() || (ko ? '그때의 판단' : 'the call you made');
  const quote = escapeReminderHtml(anchor);
  const sameUrl = escapeReminderHtml(buildFirstSettlementUrl(baseUrl, locale, args.projectId, 'same'));
  const shiftedUrl = escapeReminderHtml(buildFirstSettlementUrl(baseUrl, locale, args.projectId, 'shifted'));
  const unknownUrl = escapeReminderHtml(buildFirstSettlementUrl(baseUrl, locale, args.projectId, 'unknown'));
  const settingsUrl = escapeReminderHtml(buildFirstSettlementUrl(baseUrl, locale, args.projectId));

  if (!ko) {
    return {
      subject: 'No result yet — want to revisit what you thought then?',
      html: `
        <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:520px;margin:0 auto;color:#1a1a1a">
          <p style="font-size:18px;font-weight:700;margin:0 0 14px">"${quote}"</p>
          <p style="font-size:14px;color:#57534e;line-height:1.65;margin:0 0 16px">Seven days ago, this was the line you sealed. This is not about scoring the outcome; it is only a 30-second reread from today.</p>
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            <a href="${sameUrl}" style="display:inline-block;border:1px solid #2d4a7c;color:#2d4a7c;text-decoration:none;font-size:13px;font-weight:650;padding:9px 12px;border-radius:8px">Still the same</a>
            <a href="${shiftedUrl}" style="display:inline-block;border:1px solid #2d4a7c;color:#2d4a7c;text-decoration:none;font-size:13px;font-weight:650;padding:9px 12px;border-radius:8px">A bit shifted</a>
            <a href="${unknownUrl}" style="display:inline-block;border:1px solid #d6d3d1;color:#78716c;text-decoration:none;font-size:13px;font-weight:650;padding:9px 12px;border-radius:8px">Not sure</a>
          </div>
          <p style="font-size:11px;color:#a8a29e;margin:22px 0 0"><a href="${settingsUrl}" style="color:#78716c">Stop these invitations</a></p>
        </div>`,
    };
  }

  return {
    subject: '결과는 아직이에요 — 그때의 당신만 잠깐 볼래요?',
    html: `
      <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:520px;margin:0 auto;color:#1a1a1a">
        <p style="font-size:18px;font-weight:700;margin:0 0 14px">"${quote}"</p>
        <p style="font-size:14px;color:#57534e;line-height:1.65;margin:0 0 16px">7일 전, 이 문장을 봉인해두셨어요. 결과를 채점하는 게 아니에요; 그때의 문장을 지금의 눈으로 다시 읽어보는 것, 그게 전부예요. (30초)</p>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <a href="${sameUrl}" style="display:inline-block;border:1px solid #2d4a7c;color:#2d4a7c;text-decoration:none;font-size:13px;font-weight:650;padding:9px 12px;border-radius:8px">그대로예요</a>
          <a href="${shiftedUrl}" style="display:inline-block;border:1px solid #2d4a7c;color:#2d4a7c;text-decoration:none;font-size:13px;font-weight:650;padding:9px 12px;border-radius:8px">조금 바뀌었어요</a>
          <a href="${unknownUrl}" style="display:inline-block;border:1px solid #d6d3d1;color:#78716c;text-decoration:none;font-size:13px;font-weight:650;padding:9px 12px;border-radius:8px">모르겠어요</a>
        </div>
        <p style="font-size:11px;color:#a8a29e;margin:22px 0 0"><a href="${settingsUrl}" style="color:#78716c">이런 초대 그만 받기</a></p>
      </div>`,
  };
}
