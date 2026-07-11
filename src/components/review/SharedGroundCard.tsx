'use client';

/**
 * SharedGroundCard — the tier-1 relationship surface (judgment graph v1).
 *
 * Fires ONLY when the graph has a real event: a shared premise (same
 * normalized sentence under ≥2 receipts) recorded a drifted re-check while
 * sealed predictions still stand on it. On a flat day this renders nothing —
 * the restraint default (CLAUDE.md Zero-Judgment §4: manufacturing a daily
 * highlight out of flat data is over-fire).
 *
 * Copy contract: quote → fact (sealed baseline → today's value, with source)
 * → handle. Counts only, never a %, never advice. The one lean we cannot
 * remove — that surfacing THIS ground implies it matters — is disclosed by
 * the handle line ("다시 볼지는 당신 몫이에요"), not laundered.
 */

import { useState } from 'react';
import { LocaleLink } from '@/components/ui/LocaleLink';
import { useLocale } from '@/hooks/useLocale';
import { useReviewStore } from '@/stores/useReviewStore';
import { groundSpotlight } from '@/lib/judgment-graph';
import { formatCheckBy } from '@/lib/seal-core';
import { daysBetween } from '@/lib/premises-core';

const BETS_FOLD = 4;

function valueLabel(numeric?: number, text?: string): string | null {
  if (typeof numeric === 'number') return String(numeric);
  return text || null;
}

export function SharedGroundCard() {
  const locale = useLocale();
  const L = (ko: string, en: string) => (locale === 'ko' ? ko : en);
  const receipts = useReviewStore((s) => s.receipts);
  const [unfolded, setUnfolded] = useState(false);

  const spot = groundSpotlight(receipts ?? []);
  if (!spot) return null;

  const drift = spot.drift!;
  const baseline = valueLabel(drift.baseline_numeric, drift.baseline_text);
  const current = valueLabel(drift.current_numeric, drift.current_text);
  const n = spot.live_bets.length;
  const today = new Date().toISOString().slice(0, 10);
  const bets = unfolded ? spot.live_bets : spot.live_bets.slice(0, BETS_FOLD);
  const folded = spot.live_bets.length - bets.length;

  return (
    <section
      aria-label={L('같은 전제 위의 판단들', 'Judgments on shared ground')}
      className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-4 sm:px-5"
    >
      <p className="text-[11px] font-semibold text-[var(--text-tertiary)]">
        {L('같은 전제 위의 판단들', 'Judgments on shared ground')}
      </p>

      {/* The event, as a fact with counts — the graph's reason to speak. */}
      <h3 className="mt-1.5 text-[15px] sm:text-[16px] font-semibold leading-snug text-[var(--text-primary)]">
        {L(
          `전제 하나가 움직였어요 — 살아있는 판단 ${n}개가 그 위에 서 있어요.`,
          `A premise moved — ${n} live judgment${n === 1 ? '' : 's'} stand${n === 1 ? 's' : ''} on it.`,
        )}
      </h3>

      {/* The ground itself: quote + sealed baseline → today, with source. */}
      <div className="mt-3 rounded-lg bg-[var(--accent)]/[0.04] px-4 py-3 text-[13px] leading-relaxed">
        <p className="font-medium text-[var(--text-primary)]">“{spot.text}”</p>
        <p className="mt-1 text-[var(--text-secondary)] tabular-nums">
          {baseline != null && current != null ? (
            <>
              {L('봉인 당시', 'At seal')} <b>{baseline}</b> → {L('오늘', 'today')} <b>{current}</b>
            </>
          ) : (
            <>{L('지난 확인', 'Last check')}: {drift.finding}</>
          )}
          {drift.source_detail ? (
            <span className="text-[var(--text-tertiary)]"> · {L('출처', 'source')}: {drift.source_detail}</span>
          ) : null}
        </p>
      </div>

      {/* What stands on it — each bet is a working link, not decoration. */}
      <ul className="mt-3 divide-y divide-[var(--border-subtle)]">
        {bets.map((b) => {
          const days = daysBetween(today, b.check_by);
          return (
            <li key={`${b.receipt_id}:${b.followup_id}`}>
              <LocaleLink
                href="/tools/review"
                className="flex items-baseline gap-3 py-2.5 min-h-[44px] group"
              >
                <span className="flex-1 min-w-0 truncate text-[13.5px] text-[var(--text-primary)] group-hover:text-[var(--accent)] transition-colors">
                  “{b.predicate}”
                </span>
                <span className="shrink-0 text-[12px] text-[var(--text-tertiary)] tabular-nums">
                  {formatCheckBy(new Date(`${b.check_by}T00:00:00`), locale)}
                  {days > 0 ? ` · ${L(`${days}일 뒤`, `in ${days}d`)}` : ''}
                </span>
              </LocaleLink>
            </li>
          );
        })}
      </ul>
      {folded > 0 && (
        <button
          onClick={() => setUnfolded(true)}
          aria-expanded={unfolded}
          className="mt-1 text-[12px] font-medium text-[var(--text-secondary)] hover:text-[var(--accent)] min-h-[44px] px-1"
        >
          {L(`판단 ${folded}개 더 보기`, `Show ${folded} more`)}
        </button>
      )}

      <p className="mt-2 text-[12px] text-[var(--text-tertiary)]">
        {L(
          '사실만 전해요 — 다시 볼지는 당신 몫이에요.',
          'Facts only — whether to revisit is yours.',
        )}
      </p>
    </section>
  );
}
