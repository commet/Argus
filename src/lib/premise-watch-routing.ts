import { buildPremiseDriftEmail, type CompanionBriefEmail, type PremiseChange } from '@/lib/companion-brief';
import {
  gateNotification,
  notificationGateAllowsSend,
  type NotificationCandidate,
  type NotificationGateResult,
  type PremiseDriftMateriality,
} from '@/lib/notification-gate';
import type { InvestigationResult } from '@/lib/premise-researcher';
import type { JudgmentReceipt } from '@/lib/review';

export interface PremiseWatchAlertInput {
  userId: string;
  receiptId: string;
  receipt: JudgmentReceipt;
  premise: NonNullable<JudgmentReceipt['tracked_premises']>[number];
  result: InvestigationResult;
  checkedAt: string;
  baseUrl?: string;
  standaloneSentThisWeek?: number;
}

export interface PremiseWatchAlertDecision {
  materiality: PremiseDriftMateriality;
  gate: NotificationGateResult;
  change?: PremiseChange;
  email?: CompanionBriefEmail;
}

function resultMateriality(result: InvestigationResult): PremiseDriftMateriality {
  if (result.verdict === 'material') return 'material';
  if (result.verdict === 'quiet' && result.materiality && result.materiality !== 'material') return 'minor';
  return 'none';
}

export function applyWatchRecheck(
  premise: NonNullable<JudgmentReceipt['tracked_premises']>[number],
  result: InvestigationResult,
  opts: { now: string; queueForBrief?: boolean },
): void {
  const isOpenQuestion = premise.kind === 'open_question';
  if (result.verdict === 'material' || result.verdict === 'quiet') {
    const previous = premise.last_recheck;
    premise.last_recheck = {
      finding: result.fact || '(확인함)',
      ...(typeof result.current_value === 'number'
        ? { numeric_value: result.current_value }
        : typeof previous?.numeric_value === 'number'
          ? { numeric_value: previous.numeric_value }
          : {}),
      ...(previous?.finding ? { baseline_finding: previous.finding } : {}),
      ...(typeof previous?.numeric_value === 'number' ? { baseline_numeric_value: previous.numeric_value } : {}),
      drifted: result.verdict === 'material',
      baseline_only: !previous,
      source: 'url',
      ...(result.source_url ? { source_detail: `${result.source_url}${result.source_date ? ` (${result.source_date})` : ''}` } : {}),
      confidence: result.confidence,
      ...(opts.queueForBrief
        ? {
            brief_pending: true,
            brief_kind: isOpenQuestion
              ? 'open_question_new_info'
              : (result.verdict === 'material' ? 'standalone_overflow' : 'premise_minor_drift'),
          }
        : {}),
      ts: opts.now,
      auto: true,
    };
  } else {
    premise.last_recheck = {
      finding: '최근 확인 — 새 소식 없음',
      ...(typeof premise.last_recheck?.numeric_value === 'number' ? { numeric_value: premise.last_recheck.numeric_value } : {}),
      drifted: false,
      baseline_only: !premise.last_recheck,
      source: 'host_reported',
      ts: opts.now,
      auto: true,
    };
  }
  if (isOpenQuestion) premise.last_reconsidered = opts.now;
  premise.recheck_count = (premise.recheck_count || 0) + 1;
}

export function buildPremiseWatchAlert(input: PremiseWatchAlertInput): PremiseWatchAlertDecision {
  const materiality = resultMateriality(input.result);
  const hasPayload = Boolean(input.result.fact && input.result.source_url && materiality !== 'none');
  const candidateBase: Omit<NotificationCandidate, 'type'> = {
    channel: 'email',
    userId: input.userId,
    targetId: input.premise.premise_id,
    contentCount: hasPayload ? 1 : 0,
    materiality,
    isStandalone: true,
    standaloneSentThisWeek: input.standaloneSentThisWeek,
  };
  const candidate: NotificationCandidate = input.premise.kind === 'open_question'
    ? { ...candidateBase, type: 'T3_OPEN_QUESTION' }
    : { ...candidateBase, type: 'T2_PREMISE_DRIFT' };
  const gate = gateNotification(candidate);
  if (!hasPayload) return { materiality, gate };

  const prior = input.premise.last_recheck;
  const change: PremiseChange = {
    ordinal: input.premise.ordinal,
    premise_id: input.premise.premise_id,
    text: input.premise.text,
    ...(prior?.finding ? { baseline: prior.finding } : {}),
    ...(typeof prior?.numeric_value === 'number' ? { baseline_numeric_value: prior.numeric_value } : {}),
    fact: input.result.fact || '',
    ...(typeof input.result.current_value === 'number' ? { current_value: input.result.current_value } : {}),
    source_url: input.result.source_url || '',
    source_date: input.result.source_date,
    checked_at: input.checkedAt,
    confidence: input.result.confidence,
    kind: input.premise.kind,
  };

  return {
    materiality,
    gate,
    change,
    email: notificationGateAllowsSend(candidate)
      ? buildPremiseDriftEmail({
          decision_title: input.receipt.source_title || input.receipt.core_question || '제목 없는 문서',
          receipt_id: input.receiptId,
          baseUrl: input.baseUrl,
          change,
        })
      : undefined,
  };
}
