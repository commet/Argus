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
 * Form: the house ledger DNA (JudgmentReceipt's stacked, ruled sections;
 * quiet 11px labels; the human's sealed words quoted in --font-voice serif).
 * One signature element: the DRIFT GAUGE — sealed value ●───○ today's value,
 * a measurement line, not a warning banner. Gold stays scarce (action border,
 * hover); the moved value alone carries --text-warning. Copy contract:
 * quote → fact with source → handle. Counts only, never a %, never advice.
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
      className="rounded-xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden text-[13px] leading-[1.6] shadow-[var(--shadow-sm)]"
    >
      {/* header row — the event, said once, quietly */}
      <div className="px-4 sm:px-5 py-3 border-b border-[var(--border)] flex items-baseline justify-between gap-3">
        <p className="text-[14px] font-semibold text-[var(--text-primary)]">
          {L(
            `전제 하나가 움직였어요 — 살아있는 판단 ${n}개가 그 위에 서 있어요.`,
            `A premise moved — ${n} live judgment${n === 1 ? '' : 's'} stand${n === 1 ? 's' : ''} on it.`,
          )}
        </p>
        <span className="hidden sm:flex items-center gap-1.5 shrink-0 text-[11px] text-[var(--text-tertiary)]">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
            <circle cx="5" cy="12" r="2.2" /><circle cx="19" cy="5" r="2.2" /><circle cx="19" cy="12" r="2.2" /><circle cx="19" cy="19" r="2.2" />
            <path d="M7.1 11l9.8-5.2M7.3 12h9.4M7.1 13l9.8 5.2" />
          </svg>
          {L('같은 전제 위', 'shared ground')}
        </span>
      </div>

      {/* the ground — the sealed sentence in the house voice, then the gauge */}
      <div className="px-4 sm:px-5 py-3.5 border-b border-[var(--border)] bg-[var(--bg)]">
        <p className="text-[11px] text-[var(--text-tertiary)] mb-1.5">
          {L('이 판단들이 서 있던 전제', 'The premise these stand on')}
        </p>
        <p
          className="text-[14.5px] font-medium text-[var(--text-primary)]"
          style={{ fontFamily: 'var(--font-voice, serif)' }}
        >
          &ldquo;{spot.text}&rdquo;
        </p>

        {/* the drift gauge — a measurement, not a warning */}
        {baseline != null && current != null ? (
          <div className="mt-3 flex items-end gap-3 tabular-nums">
            <span className="text-right leading-none">
              <span className="block text-[10.5px] text-[var(--text-tertiary)] mb-1">{L('봉인 당시', 'at seal')}</span>
              <span className="block text-[19px] font-semibold text-[var(--text-secondary)]">{baseline}</span>
            </span>
            <span aria-hidden="true" className="flex items-center flex-1 max-w-[220px] min-w-[72px] pb-[7px]">
              <span className="h-[8px] w-[8px] rounded-full border-[1.5px] border-[var(--text-tertiary)] bg-[var(--surface)] shrink-0" />
              <span className="h-[1.5px] flex-1 bg-[var(--border)]" />
              <span className="h-[8px] w-[8px] rounded-full bg-[var(--warning)] shrink-0" />
            </span>
            <span className="leading-none">
              <span className="block text-[10.5px] text-[var(--text-tertiary)] mb-1">{L('오늘', 'today')}</span>
              <span className="block text-[19px] font-semibold text-[var(--warning)]">{current}</span>
            </span>
          </div>
        ) : (
          <p className="mt-2 text-[12.5px] text-[var(--text-secondary)]">
            {L('지난 확인', 'Last check')}: {drift.finding}
          </p>
        )}
        {drift.source_detail && (
          <p className="mt-2 text-[11px] text-[var(--text-tertiary)]">
            {L('출처', 'source')} · {drift.source_detail}
          </p>
        )}
      </div>

      {/* the bets standing on it — sealed words, quoted in the voice face */}
      <div className="px-4 sm:px-5 py-3 border-b border-[var(--border)]">
        <p className="text-[11px] text-[var(--text-tertiary)] mb-0.5">
          {L('그 위에 선 판단', 'Standing on it')}
        </p>
        <ul>
          {bets.map((b) => {
            const days = daysBetween(today, b.check_by);
            return (
              <li key={`${b.receipt_id}:${b.followup_id}`} className="border-b border-[var(--border-subtle)] last:border-0">
                <LocaleLink
                  href="/tools/review"
                  className="group flex items-center gap-3 py-2.5 min-h-[44px]"
                >
                  <span
                    className="flex-1 min-w-0 truncate text-[13.5px] font-medium text-[var(--text-primary)] group-hover:text-[var(--accent)] transition-colors"
                    style={{ fontFamily: 'var(--font-voice, serif)' }}
                  >
                    &ldquo;{b.predicate}&rdquo;
                  </span>
                  <span className="shrink-0 text-[12px] text-[var(--text-tertiary)] tabular-nums">
                    {formatCheckBy(new Date(`${b.check_by}T00:00:00`), locale)}
                    {days > 0 && <span className="ml-1.5 font-semibold text-[var(--text-secondary)]">D-{days}</span>}
                  </span>
                  <ArrowRight
                    size={13}
                    className="shrink-0 text-[var(--text-muted)] group-hover:text-[var(--accent)] group-hover:translate-x-0.5 transition-all"
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
            className="text-[12px] font-medium text-[var(--text-secondary)] hover:text-[var(--accent)] min-h-[40px] cursor-pointer"
          >
            {L(`판단 ${folded}개 더 보기 ↓`, `Show ${folded} more ↓`)}
          </button>
        )}
      </div>

      {/* footer — the handle, and one door */}
      <div className="px-4 sm:px-5 py-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <p className="text-[12px] text-[var(--text-tertiary)]">
          {L('사실만 전해요 — 다시 볼지는 당신 몫이에요.', 'Facts only — whether to revisit is yours.')}
        </p>
        <LocaleLink
          href="/tools/review"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium border border-[var(--accent)] text-[var(--accent)] hover:bg-[var(--accent)] hover:text-white transition-colors"
        >
          {L('전제 살펴보기', 'Inspect the premise')}
          <ArrowRight size={12} aria-hidden="true" />
        </LocaleLink>
      </div>
    </section>
  );
}
