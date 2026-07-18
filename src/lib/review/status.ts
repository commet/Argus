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

// ---------------------------------------------------------------------------
// Version drift (Retention Loop B §747): diff a re-review against the prior one.
// ---------------------------------------------------------------------------

export interface ReceiptDiff {
  resolved: string[]; // finding titles present before, gone now
  added: string[]; // finding titles new this version
  note: string; // one-line human summary
}

/** Compare two receipts of the same source by finding titles (cheap, pure). */
export function diffReceipts(prev: JudgmentReceipt, next: JudgmentReceipt): ReceiptDiff {
  const prevTitles = new Set((prev.findings || []).map((f) => f.title.trim()));
  const nextTitles = new Set((next.findings || []).map((f) => f.title.trim()));
  const resolved = [...prevTitles].filter((t) => !nextTitles.has(t));
  const added = [...nextTitles].filter((t) => !prevTitles.has(t));
  const note =
    resolved.length || added.length
      ? `이전 검수 대비 해소 ${resolved.length}건 · 새로 발견 ${added.length}건.`
      : '이전 검수와 발견 항목이 크게 다르지 않습니다.';
  return { resolved, added, note };
}

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
  owned: '내 판단으로 기록됨',
  sealed: '기록됨 · 결과 기다리는 중',
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

  // 웹앱 사용자 표면에는 지각 집계(OVERDUE/"N일 지남")를 쓰지 않는다 — 늦음을 세는 라벨은
  // 사용자에 대한 판정이다(스파인 규칙2). 플러그인 statusline의 OVERDUE는 개발자 표면이라 예외 —
  // 그 어휘를 여기로 수입하지 말 것. days_until은 정렬용 사실로만 내부 유지.
  let label = LABELS[derived];
  if (derived === 'sealed' && days_until !== undefined) {
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
