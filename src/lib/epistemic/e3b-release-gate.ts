/**
 * E3B is a product evidence gate, not a deploy-time feature flag.
 *
 * A receipt is deliberately checked into this registry only after the O4
 * observation and the comprehension study have produced auditable evidence.
 * An environment variable can select an approved receipt, but can never make
 * an unapproved receipt valid on its own.
 */

export const O4_FUNNEL_STAGES = [
  'noticed',
  'captured',
  'accepted',
  'surfaced',
  'returned',
  'resolved',
  'again',
] as const;

export type O4FunnelStage = (typeof O4_FUNNEL_STAGES)[number];

export interface E3BReleaseReceipt {
  receipt_id: string;
  verdict: 'pass' | 'hold' | 'kill' | 'iterate';
  evidence_digest: `sha256:${string}`;
  thresholds_sealed_at: string;
  study_started_at: string;
  study_completed_at: string;
  participant_count: number;
  observation_days: number;
  completed_lifecycle_count: number;
  comparison_cohort_count: number;
  funnel_counts: Record<O4FunnelStage, number>;
  comprehension: {
    participant_count: number;
    completed_task_count: number;
    endorse_grant_confusion_count: number;
    source_drilldown_success_rate: number;
    separate_grant_recognition_rate: number;
  };
}

export type E3BGateReason =
  | 'receipt_not_selected'
  | 'receipt_not_registered'
  | 'o4_verdict_not_passed'
  | 'o4_protocol_incomplete'
  | 'thresholds_not_presealed'
  | 'funnel_invalid'
  | 'comprehension_not_passed'
  | 'evidence_digest_invalid';

export type E3BGateDecision =
  | { open: true; receipt: E3BReleaseReceipt }
  | { open: false; reason: E3BGateReason };

/**
 * Production registry. It is intentionally empty until real O4 and
 * comprehension evidence exists. Never add a synthetic, fixture, or local
 * study receipt here.
 */
const APPROVED_E3B_RELEASE_RECEIPTS: readonly E3BReleaseReceipt[] = [];

function validIso(value: string): boolean {
  return Number.isFinite(Date.parse(value));
}

function validDigest(value: string): boolean {
  return /^sha256:[a-f0-9]{64}$/.test(value);
}

function nonIncreasingFunnel(receipt: E3BReleaseReceipt): boolean {
  const counts = O4_FUNNEL_STAGES.map((stage) => receipt.funnel_counts[stage]);
  return counts.every((count) => Number.isInteger(count) && count >= 0)
    && counts.every((count, index) => index === 0 || count <= counts[index - 1]);
}

/** Pure evaluator accepts a registry so fixtures can prove both sides. */
export function evaluateE3BReleaseGate(
  requestedReceiptId: string | undefined,
  registry: readonly E3BReleaseReceipt[],
): E3BGateDecision {
  if (!requestedReceiptId?.trim()) return { open: false, reason: 'receipt_not_selected' };
  const receipt = registry.find((item) => item.receipt_id === requestedReceiptId);
  if (!receipt) return { open: false, reason: 'receipt_not_registered' };
  if (receipt.verdict !== 'pass') return { open: false, reason: 'o4_verdict_not_passed' };
  if (!validDigest(receipt.evidence_digest)) return { open: false, reason: 'evidence_digest_invalid' };
  if (![receipt.thresholds_sealed_at, receipt.study_started_at, receipt.study_completed_at].every(validIso)
    || Date.parse(receipt.thresholds_sealed_at) >= Date.parse(receipt.study_started_at)
    || Date.parse(receipt.study_completed_at) - Date.parse(receipt.study_started_at) < 21 * 24 * 60 * 60 * 1_000) {
    return { open: false, reason: 'thresholds_not_presealed' };
  }
  if (receipt.participant_count < 5 || receipt.observation_days < 21
    || receipt.completed_lifecycle_count < 10 || receipt.comparison_cohort_count < 1) {
    return { open: false, reason: 'o4_protocol_incomplete' };
  }
  if (!nonIncreasingFunnel(receipt)
    || receipt.funnel_counts.resolved < receipt.completed_lifecycle_count
    || receipt.funnel_counts.again < receipt.completed_lifecycle_count) {
    return { open: false, reason: 'funnel_invalid' };
  }
  const comprehension = receipt.comprehension;
  if (comprehension.participant_count < 5 || comprehension.completed_task_count < 10
    || comprehension.endorse_grant_confusion_count !== 0
    || comprehension.source_drilldown_success_rate !== 1
    || comprehension.separate_grant_recognition_rate !== 1) {
    return { open: false, reason: 'comprehension_not_passed' };
  }
  return { open: true, receipt };
}

/** Server-only production decision. An env value selects, never approves. */
export function productionE3BReleaseDecision(
  requestedReceiptId = process.env.ARGUS_E3B_RELEASE_RECEIPT,
): E3BGateDecision {
  return evaluateE3BReleaseGate(requestedReceiptId, APPROVED_E3B_RELEASE_RECEIPTS);
}

/** Navigation is discoverable only in builds selecting the same approved receipt. */
export function clientE3BReleaseDecision(
  requestedReceiptId = process.env.NEXT_PUBLIC_ARGUS_E3B_RELEASE_RECEIPT,
): E3BGateDecision {
  return evaluateE3BReleaseGate(requestedReceiptId, APPROVED_E3B_RELEASE_RECEIPTS);
}

export function hasApprovedE3BReleaseReceipt(): boolean {
  return APPROVED_E3B_RELEASE_RECEIPTS.some((receipt) =>
    evaluateE3BReleaseGate(receipt.receipt_id, APPROVED_E3B_RELEASE_RECEIPTS).open);
}
