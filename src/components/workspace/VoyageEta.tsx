'use client';

/**
 * VoyageEta — the "ship's arrival" badge for a decision-voyage. Single source for
 * how a sealed decision's ETA/arrival is shown across return surfaces (workspace
 * home "이어서 작업", /project cards, …). Reads contractStatus (defensive) so the
 * lifecycle is consistent everywhere:
 *
 *   scheduled  → ⚓ 도착 예정 D-N        (the lively countdown — the come-back pull)
 *   due        → 지금 정산 · N개         (check-in date arrived, still ungraded)
 *   arrived    → ⚓ 도착 완료            (fully settled)
 *
 * ETA = contract.check_in_at (target re-open date set at seal).
 * ATA  = when it actually settles (graded_at) — surfaced elsewhere; here we just
 * mark "arrived" once allGraded.
 */
import { Anchor, Sparkles } from 'lucide-react';
import { contractStatus } from '@/lib/decision-contract';
import type { DecisionContract } from '@/stores/types';
import { useLocale } from '@/hooks/useLocale';

export function VoyageEta({
  contract,
  now = Date.now(),
  showArrived = false,
  className = '',
}: {
  contract?: DecisionContract | null;
  now?: number;
  /** Show the muted "도착 완료" state for settled voyages (off by default — most
   *  lists only want the live/due states, not a badge on every finished item). */
  showArrived?: boolean;
  className?: string;
}) {
  const locale = useLocale();
  const L = (ko: string, en: string) => (locale === 'ko' ? ko : en);

  if (!contract) return null;
  const cs = contractStatus(contract, now);
  // Nothing committed to arrive (no predicates AND no promised date).
  if (cs.total === 0 && !contract.check_in_at) return null;

  // DUE — the date arrived and there's still something to settle. The hook.
  if (cs.checkInDue) {
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10.5px] font-bold bg-amber-500/15 text-amber-700 dark:text-amber-400 ${className}`}>
        <Sparkles size={10} className="shrink-0" />
        {cs.pending > 0
          ? L(`지금 정산 · ${cs.pending}개`, `Settle now · ${cs.pending}`)
          : L('도착 — 확인', 'Arrived — review')}
      </span>
    );
  }

  // SCHEDULED — the lively ETA countdown (days remaining until the promised date).
  if (cs.daysUntilCheckIn != null && cs.daysUntilCheckIn > 0) {
    const n = cs.daysUntilCheckIn;
    return (
      <span
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10.5px] font-semibold ${className}`}
        style={{ color: 'var(--accent)', background: 'var(--gold-muted)' }}
        title={L(`도착 예정 ${n}일 남음`, `${n} day${n === 1 ? '' : 's'} until arrival`)}
      >
        <Anchor size={10} className="shrink-0" />
        {L(`도착 예정 D-${n}`, `ETA D-${n}`)}
      </span>
    );
  }

  // ARRIVED — fully settled. Muted; opt-in.
  if (cs.allGraded && showArrived) {
    return (
      <span
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10.5px] font-semibold text-[var(--text-tertiary)] ${className}`}
        style={{ fontFamily: 'var(--font-mono)' }}
      >
        <Anchor size={10} className="shrink-0" />
        {L('도착 완료', 'Arrived')}
      </span>
    );
  }

  return null;
}
