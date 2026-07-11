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
 * Form: the dependency is DRAWN, not narrated — an amber tree rail hangs the
 * live bets off the premise chip (structure is information; this is a tree
 * connector, not the banned left quote-bar). Amber = the due-strip's "reality
 * is asking" register; the moved value is emphasized, never colored as a
 * verdict. Copy contract: quote → fact (sealed baseline → today, with source)
 * → handle. Counts only, never a %, never advice.
 */

import { useState } from 'react';
import { ArrowRight } from 'lucide-react';
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
      className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-5 py-5 sm:px-6 shadow-[var(--shadow-sm)]"
    >
      {/* eyebrow — the graph speaking, marked by its glyph */}
      <p className="flex items-center gap-1.5 text-[11.5px] font-semibold text-[var(--text-tertiary)]">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
          <circle cx="5" cy="12" r="2.2" /><circle cx="19" cy="5" r="2.2" /><circle cx="19" cy="12" r="2.2" /><circle cx="19" cy="19" r="2.2" />
          <path d="M7.1 11l9.8-5.2M7.3 12h9.4M7.1 13l9.8 5.2" />
        </svg>
        {L('같은 전제 위의 판단들', 'Judgments on shared ground')}
      </p>

      {/* the event as a fact — the moved value carries the emphasis */}
      <h3 className="mt-2 text-[16.5px] sm:text-[17.5px] font-bold leading-snug tracking-[-0.01em] text-[var(--text-primary)] text-balance">
        {L('전제 하나가 움직였어요 — 살아있는 판단 ', 'A premise moved — ')}
        <span className="tabular-nums">{n}</span>
        {L('개가 그 위에 서 있어요.', ` live judgment${n === 1 ? '' : 's'} stand${n === 1 ? 's' : ''} on it.`)}
        {baseline != null && current != null && (
          <span className="ml-1.5 font-bold tabular-nums text-amber-700 dark:text-amber-400 whitespace-nowrap">
            {baseline} → {current}
          </span>
        )}
      </h3>

      {/* the ground chip: ◆ + quote + sealed baseline → today, with source */}
      <div className="mt-3.5 rounded-lg border border-amber-500/25 bg-amber-500/[0.07] px-4 py-3">
        <p className="flex items-start gap-2.5 text-[14px] font-semibold leading-snug text-[var(--text-primary)]">
          <span aria-hidden="true" className="mt-[5px] h-[8px] w-[8px] shrink-0 rotate-45 bg-amber-600/80 dark:bg-amber-400/80" />
          <span>“{spot.text}”</span>
        </p>
        <p className="mt-1.5 pl-[18.5px] text-[13px] text-[var(--text-secondary)] tabular-nums">
          {baseline != null && current != null ? (
            <>
              {L('봉인 당시 ', 'At seal ')}
              <b className="text-[var(--text-primary)]">{baseline}</b>
              {' → '}
              {L('오늘 ', 'today ')}
              <b className="text-amber-700 dark:text-amber-400">{current}</b>
            </>
          ) : (
            <>{L('지난 확인', 'Last check')}: {drift.finding}</>
          )}
          {drift.source_detail ? (
            <span className="text-[var(--text-tertiary)]"> · {L('출처', 'source')}: {drift.source_detail}</span>
          ) : null}
        </p>
      </div>

      {/* the dependency tree — bets hang off the ground on an amber rail.
          Drawn with positioned fills (structure-as-information), NOT the
          banned left accent quote-bar. */}
      <ul className="relative mt-1 ml-[15px] pl-[18px]">
        <span aria-hidden="true" className="absolute left-0 top-0 bottom-[26px] w-px bg-amber-500/35" />
        {bets.map((b) => {
          const days = daysBetween(today, b.check_by);
          return (
            <li key={`${b.receipt_id}:${b.followup_id}`} className="relative">
              <span aria-hidden="true" className="absolute -left-[18px] top-[26px] h-px w-[13px] bg-amber-500/35" />
              <LocaleLink
                href="/tools/review"
                className="group flex items-center gap-3 border-b border-[var(--border-subtle)] py-3 min-h-[48px] last:border-0"
              >
                <span className="flex-1 min-w-0 truncate text-[14.5px] font-medium text-[var(--text-primary)] group-hover:text-[var(--accent)] transition-colors">
                  “{b.predicate}”
                </span>
                <span className="shrink-0 text-[12.5px] text-[var(--text-tertiary)] tabular-nums">
                  {formatCheckBy(new Date(`${b.check_by}T00:00:00`), locale)}
                  {days > 0 && (
                    <b className="ml-1.5 font-semibold text-[var(--text-secondary)]">D-{days}</b>
                  )}
                </span>
                <ArrowRight
                  size={14}
                  className="shrink-0 text-[var(--text-tertiary)] group-hover:text-[var(--accent)] group-hover:translate-x-0.5 transition-all"
                  aria-hidden="true"
                />
              </LocaleLink>
            </li>
          );
        })}
      </ul>
      {folded > 0 && (
        <button
          onClick={() => setUnfolded(true)}
          aria-expanded={unfolded}
          className="mt-1 ml-[33px] text-[12.5px] font-semibold text-[var(--text-secondary)] hover:text-[var(--accent)] min-h-[44px] px-1 cursor-pointer"
        >
          {L(`판단 ${folded}개 더 보기`, `Show ${folded} more`)} ↓
        </button>
      )}

      {/* handle + one quiet action — the lean disclosed, the pen returned */}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-[var(--border-subtle)] pt-3">
        <p className="text-[12.5px] text-[var(--text-tertiary)]">
          {L('사실만 전해요 — 다시 볼지는 당신 몫이에요.', 'Facts only — whether to revisit is yours.')}
        </p>
        <LocaleLink
          href="/tools/review"
          className="inline-flex items-center gap-1 rounded-lg border border-[var(--border)] px-3 py-1.5 text-[12.5px] font-semibold text-[var(--text-secondary)] hover:text-[var(--accent)] hover:border-[var(--accent)]/40 transition-colors min-h-[36px]"
        >
          {L('전제 살펴보기', 'Inspect the premise')}
          <ArrowRight size={13} aria-hidden="true" />
        </LocaleLink>
      </div>
    </section>
  );
}
