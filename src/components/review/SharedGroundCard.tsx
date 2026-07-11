'use client';

/**
 * SharedGroundCard — the tier-1 relationship surface (judgment graph v1).
 *
 * Fires ONLY when the graph has a real event: a shared premise (same
 * normalized sentence under ≥2 receipts) recorded a drifted re-check while
 * sealed predictions still stand on it. On a flat day this renders nothing —
 * the restraint default (CLAUDE.md Zero-Judgment §4).
 *
 * Register (the approved '돌아온 순간' voice, brought in-app): no labels —
 * spoken lead-ins do the labeling; the human's sealed sentences quoted LARGE
 * in --font-voice serif; sections separated by air, not rules; one instrument
 * — the drift gauge (sealed ○──● today); gold scarce (hover + the one door).
 * Copy contract: quote → fact with source → handle. Never a %, never advice.
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
      className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] px-6 py-7 sm:px-8 shadow-[var(--shadow-sm)]"
    >
      {/* Argus speaks the event — one sentence, no header chrome. */}
      <p className={`text-[16px] sm:text-[17px] font-semibold leading-[1.5] text-[var(--text-primary)] ${locale === 'ko' ? 'break-keep' : ''}`}>
        {L(
          `전제 하나가 움직였어요 — 살아있는 판단 ${n}개가 그 위에 서 있어요.`,
          `A premise moved — ${n} live judgment${n === 1 ? '' : 's'} stand${n === 1 ? 's' : ''} on it.`,
        )}
      </p>

      {/* the ground — spoken lead-in, then the sealed sentence, large */}
      <div className="mt-7">
        <p className="text-[13.5px] text-[var(--text-tertiary)]">
          {L('봉인할 때, 이 전제 위에 서 있었죠.', 'At seal, these stood on this premise.')}
        </p>
        <p
          className={`mt-2.5 text-[18px] sm:text-[19px] font-medium leading-[1.55] text-[var(--text-primary)] ${locale === 'ko' ? 'break-keep' : ''}`}
          style={{ fontFamily: 'var(--font-voice, serif)' }}
        >
          &ldquo;{spot.text}&rdquo;
        </p>

        {/* the one instrument — sealed ○────● today */}
        {baseline != null && current != null ? (
          <div className="mt-5 flex items-end gap-4 tabular-nums">
            <span className="text-right leading-none">
              <span className="block text-[11px] text-[var(--text-tertiary)] mb-1.5">{L('봉인 당시', 'at seal')}</span>
              <span className="block text-[24px] font-semibold tracking-[-0.01em] text-[var(--text-secondary)]">{baseline}</span>
            </span>
            <span aria-hidden="true" className="flex items-center flex-1 max-w-[260px] min-w-[80px] pb-[9px]">
              <span className="h-[9px] w-[9px] rounded-full border-[1.5px] border-[var(--text-tertiary)] bg-[var(--surface)] shrink-0" />
              <span className="h-[1.5px] flex-1 bg-[var(--border)]" />
              <span className="h-[9px] w-[9px] rounded-full bg-[var(--warning)] shrink-0" />
            </span>
            <span className="leading-none">
              <span className="block text-[11px] text-[var(--text-tertiary)] mb-1.5">{L('오늘', 'today')}</span>
              <span className="block text-[24px] font-semibold tracking-[-0.01em] text-[var(--warning)]">{current}</span>
            </span>
          </div>
        ) : (
          <p className="mt-4 text-[14px] text-[var(--text-secondary)]">
            {L('지난 확인', 'Last check')} — {drift.finding}
          </p>
        )}
        {drift.source_detail && (
          <p className="mt-3 text-[12px] text-[var(--text-tertiary)]">
            {L('출처', 'source')} · {drift.source_detail}
          </p>
        )}
      </div>

      {/* the bets — spoken lead-in, each sealed sentence large, air between */}
      <div className="mt-8">
        <p className="text-[13.5px] text-[var(--text-tertiary)]">
          {L('지금도 그 위에 서 있는 판단들이에요.', 'Still standing on it now.')}
        </p>
        <ul className="mt-1">
          {bets.map((b) => {
            const days = daysBetween(today, b.check_by);
            return (
              <li key={`${b.receipt_id}:${b.followup_id}`}>
                <LocaleLink href="/tools/review" className="group flex items-center gap-4 py-3.5">
                  <span className="flex-1 min-w-0">
                    <span
                      className={`block text-[15.5px] font-medium leading-[1.5] text-[var(--text-primary)] group-hover:text-[var(--accent)] transition-colors ${locale === 'ko' ? 'break-keep' : ''}`}
                      style={{ fontFamily: 'var(--font-voice, serif)' }}
                    >
                      &ldquo;{b.predicate}&rdquo;
                    </span>
                    <span className="mt-1 block text-[12.5px] text-[var(--text-tertiary)] tabular-nums">
                      {L(
                        `${formatCheckBy(new Date(`${b.check_by}T00:00:00`), locale)}에 돌아와요`,
                        `returns ${formatCheckBy(new Date(`${b.check_by}T00:00:00`), locale)}`,
                      )}
                      {days > 0 && <> · D-{days}</>}
                    </span>
                  </span>
                  <ArrowRight
                    size={15}
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
            className="text-[13px] font-medium text-[var(--text-secondary)] hover:text-[var(--accent)] min-h-[44px] cursor-pointer"
          >
            {L(`판단 ${folded}개 더 보기 ↓`, `Show ${folded} more ↓`)}
          </button>
        )}
      </div>

      {/* the handle, and one door */}
      <div className="mt-7 pt-5 border-t border-[var(--border-subtle)] flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
        <p className="text-[13px] text-[var(--text-secondary)]">
          {L('사실만 전해요 — 다시 볼지는 당신 몫이에요.', 'Facts only — whether to revisit is yours.')}
        </p>
        <LocaleLink
          href="/tools/review"
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-[13px] font-medium border border-[var(--accent)] text-[var(--accent)] hover:bg-[var(--accent)] hover:text-white transition-colors"
        >
          {L('전제 살펴보기', 'Inspect the premise')}
          <ArrowRight size={13} aria-hidden="true" />
        </LocaleLink>
      </div>
    </section>
  );
}
