/**
 * Derived receipt status — the "Active Course" projection.
 *
 * The stored `receipt.state` is the coarse lifecycle bucket (reviewed → owned →
 * sealed → settled). But whether a sealed prediction is *due* depends on the
 * clock, not on a stored flag — so the dashboard derives it here instead of
 * mutating state on every load. Pure + today-injectable so the webapp and the
 * MCP (`recall`/list) share one definition of "what needs the user now".
 */

import type { JudgmentReceipt, FalsifiableFollowup, ReceiptState } from './schema';

export type DerivedStatus = 'reviewed' | 'owned' | 'sealed' | 'due' | 'settled';

export interface ReceiptStatus {
  /** stored lifecycle bucket */
  state: ReceiptState;
  /** clock-aware display bucket */
  derived: DerivedStatus;
  /** soonest check-by among sealed-but-unsettled follow-ups (YYYY-MM-DD) */
  next_check_by?: string;
  /** whole days from today to next_check_by; negative = overdue */
  days_until?: number;
  sealed_count: number;
  settled_count: number;
  open_followups: number;
  /** true when a sealed prediction's check date has arrived or passed */
  urgent: boolean;
  /** short Korean status label for a card */
  label: string;
}

/** whole calendar days between two YYYY-MM-DD dates (to − from). */
export function daysBetween(fromYMD: string, toYMD: string): number {
  const a = Date.parse(`${fromYMD.slice(0, 10)}T00:00:00Z`);
  const b = Date.parse(`${toYMD.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(a) || Number.isNaN(b)) return 0;
  return Math.round((b - a) / 86_400_000);
}

function isSealedOpen(f: FalsifiableFollowup): boolean {
  return Boolean(f.sealed_at) && !f.settled_at;
}

const LABELS: Record<DerivedStatus, string> = {
  reviewed: '검수됨',
  owned: '내가 소유한 판단',
  sealed: '봉인됨 · 현실 대기',
  due: '확인할 차례',
  settled: '정산 완료',
};

/**
 * Project a receipt onto its clock-aware status. `todayYMD` defaults to the
 * caller's date; pass it explicitly in tests / the MCP for determinism.
 */
export function summarizeReceipt(r: JudgmentReceipt, todayYMD: string): ReceiptStatus {
  const followups = r.falsifiable_followups || [];
  const open = followups.filter(isSealedOpen);
  const sealed_count = followups.filter((f) => f.sealed_at).length;
  const settled_count = followups.filter((f) => f.settled_at).length;

  // soonest open check date
  let next_check_by: string | undefined;
  for (const f of open) {
    if (!next_check_by || f.check_by < next_check_by) next_check_by = f.check_by;
  }
  const days_until = next_check_by ? daysBetween(todayYMD, next_check_by) : undefined;

  let derived: DerivedStatus;
  if (open.length > 0) {
    derived = days_until !== undefined && days_until <= 0 ? 'due' : 'sealed';
  } else if (r.state === 'settled' || (sealed_count > 0 && settled_count >= sealed_count)) {
    derived = 'settled';
  } else if (r.state === 'owned') {
    derived = 'owned';
  } else {
    derived = 'reviewed';
  }

  let label = LABELS[derived];
  if (derived === 'due' && days_until !== undefined && days_until < 0) {
    label = `확인 지남 (${-days_until}일)`;
  } else if (derived === 'sealed' && days_until !== undefined) {
    label = `${days_until}일 뒤 확인`;
  }

  return {
    state: r.state,
    derived,
    next_check_by,
    days_until,
    sealed_count,
    settled_count,
    open_followups: open.length,
    urgent: derived === 'due',
    label,
  };
}

/** Sort order for the dashboard: what needs the user first. */
const RANK: Record<DerivedStatus, number> = { due: 0, sealed: 1, owned: 2, reviewed: 3, settled: 4 };

/** Stable urgency sort — due (most overdue) → sealed (soonest) → recent → settled. */
export function sortByUrgency(receipts: JudgmentReceipt[], todayYMD: string): JudgmentReceipt[] {
  return [...receipts]
    .map((r) => ({ r, s: summarizeReceipt(r, todayYMD) }))
    .sort((x, y) => {
      const rk = RANK[x.s.derived] - RANK[y.s.derived];
      if (rk !== 0) return rk;
      // within due/sealed, sort by check date ascending (soonest / most overdue first)
      if (x.s.next_check_by && y.s.next_check_by && x.s.next_check_by !== y.s.next_check_by) {
        return x.s.next_check_by < y.s.next_check_by ? -1 : 1;
      }
      // otherwise most-recently-updated first
      return (y.r.updated_at || '').localeCompare(x.r.updated_at || '');
    })
    .map(({ r }) => r);
}
