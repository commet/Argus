export const T1_RETURN_MAX_SENDS = 2;
export const USER_STANDALONE_WEEKLY_LIMIT = 2;

export type NotificationType =
  | 'T1_RETURN'
  | 'T2_PREMISE_DRIFT'
  | 'T3_OPEN_QUESTION'
  | 'T4_FIRST_SETTLEMENT'
  | 'T5_WEEKLY_BRIEF';

export type NotificationChannel = 'email' | 'telegram' | 'web' | 'mcp';
export type NotificationGateDecision = 'send' | 'merge_into_brief' | 'silence';
export type PremiseDriftMateriality = 'material' | 'minor' | 'none';

export interface NotificationCandidate {
  type: NotificationType;
  channel: NotificationChannel;
  userId: string;
  targetId?: string;
  contentCount?: number;
  muted?: boolean;
  reminderCount?: number;
  standaloneSentThisWeek?: number;
  isStandalone?: boolean;
  materiality?: PremiseDriftMateriality;
}

export interface NotificationGateResult {
  decision: NotificationGateDecision;
  reason:
    | 'allowed'
    | 'muted'
    | 'empty_content'
    | 't1_send_cap'
    | 't3_brief_only'
    | 'minor_premise_to_brief'
    | 'weekly_standalone_cap';
}

function hasContent(candidate: NotificationCandidate): boolean {
  return (candidate.contentCount ?? 1) > 0;
}

function isStandalone(candidate: NotificationCandidate): boolean {
  if (typeof candidate.isStandalone === 'boolean') return candidate.isStandalone;
  return candidate.type !== 'T5_WEEKLY_BRIEF';
}

export function gateNotification(candidate: NotificationCandidate): NotificationGateResult {
  if (candidate.muted) return { decision: 'silence', reason: 'muted' };
  if (!hasContent(candidate)) return { decision: 'silence', reason: 'empty_content' };

  if (candidate.type === 'T1_RETURN' && (candidate.reminderCount ?? 0) >= T1_RETURN_MAX_SENDS) {
    return { decision: 'silence', reason: 't1_send_cap' };
  }

  if (candidate.type === 'T3_OPEN_QUESTION') {
    return { decision: 'merge_into_brief', reason: 't3_brief_only' };
  }

  if (candidate.type === 'T2_PREMISE_DRIFT' && candidate.materiality && candidate.materiality !== 'material') {
    return { decision: 'merge_into_brief', reason: 'minor_premise_to_brief' };
  }

  if (
    isStandalone(candidate)
    && (candidate.standaloneSentThisWeek ?? 0) >= USER_STANDALONE_WEEKLY_LIMIT
  ) {
    return { decision: 'merge_into_brief', reason: 'weekly_standalone_cap' };
  }

  return { decision: 'send', reason: 'allowed' };
}

export function notificationGateAllowsSend(candidate: NotificationCandidate): boolean {
  return gateNotification(candidate).decision === 'send';
}
