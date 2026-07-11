'use client';

/**
 * SharedGroundCard — the tier-1 relationship surface (judgment graph v1).
 *
 * Fires ONLY when the graph has a real event: a shared premise (same
 * normalized sentence under ≥2 receipts) recorded a drifted re-check while
 * sealed predictions still stand on it. Flat day → renders nothing
 * (restraint default, CLAUDE.md Zero-Judgment §4).
 *
 * Form follows the content's own structure: the content IS "judgments
 * standing on ground that moved" — so the card is a DIAGRAM, not prose.
 * Bet plates stand on legs; the legs land on a ground band; the moved value
 * (sealed ○──● today) lives inside the ground. The copy's metaphor ("그 위에
 * 서 있어요") and the composition are the same fact. One spoken headline;
 * lead-in labels dropped — the structure explains itself. Human sentences
 * stay quoted in --font-voice serif; gold scarce; the moved value alone
 * carries --warning. Never a %, never advice.
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
  const cols = bets.length + (folded > 0 ? 1 : 0) > 1;

  return (
    <section
      aria-label={L('같은 전제 위의 판단들', 'Judgments on shared ground')}
      className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] px-6 py-7 sm:px-8 shadow-[var(--shadow-sm)]"
    >
      {/* the event, spoken once */}
      <p className={`text-[16px] sm:text-[17px] font-semibold leading-[1.5] text-[var(--text-primary)] ${locale === 'ko' ? 'break-keep' : ''}`}>
        {L(
          `전제 하나가 움직였어요 — 살아있는 판단 ${n}개가 그 위에 서 있어요.`,
          `A premise moved — ${n} live judgment${n === 1 ? '' : 's'} stand${n === 1 ? 's' : ''} on it.`,
        )}
      </p>

      {/* THE DIAGRAM — plates standing on legs, legs landing on the ground */}
      <div className="mt-6">
        {/* standing bets */}
        <ul className={`grid gap-x-4 ${cols ? 'sm:grid-cols-2' : ''}`}>
          {bets.map((b) => {
            const days = daysBetween(today, b.check_by);
            return (
              <li key={`${b.receipt_id}:${b.followup_id}`} className="flex flex-col">
                <LocaleLink
                  href="/tools/review"
                  className="group flex-1 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg)] px-4 py-3.5 transition-colors hover:border-[var(--accent)]/50"
                >
                  <span
                    className={`block text-[14.5px] font-medium leading-[1.5] text-[var(--text-primary)] group-hover:text-[var(--accent)] transition-colors ${locale === 'ko' ? 'break-keep' : ''}`}
                    style={{ fontFamily: 'var(--font-voice, serif)' }}
                  >
                    &ldquo;{b.predicate}&rdquo;
                  </span>
                  <span className="mt-1.5 flex items-center gap-1 text-[12px] text-[var(--text-tertiary)] tabular-nums">
                    {L(
                      `${formatCheckBy(new Date(`${b.check_by}T00:00:00`), locale)}에 돌아와요`,
                      `returns ${formatCheckBy(new Date(`${b.check_by}T00:00:00`), locale)}`,
                    )}
                    {days > 0 && <> · D-{days}</>}
                    <ArrowRight size={12} className="ml-auto text-[var(--text-muted)] group-hover:text-[var(--accent)] group-hover:translate-x-0.5 transition-all" aria-hidden="true" />
                  </span>
                </LocaleLink>
                {/* the leg — this judgment stands on the ground below */}
                <span aria-hidden="true" className="self-center h-[18px] w-[2px] bg-[var(--border)]" />
              </li>
            );
          })}
          {folded > 0 && (
            <li className="flex flex-col">
              <button
                onClick={() => setUnfolded(true)}
                aria-expanded={unfolded}
                className="flex-1 rounded-xl border border-dashed border-[var(--border)] px-4 py-3.5 text-[13px] font-medium text-[var(--text-secondary)] hover:text-[var(--accent)] hover:border-[var(--accent)]/50 transition-colors cursor-pointer min-h-[44px]"
              >
                {L(`판단 ${folded}개 더 보기`, `Show ${folded} more`)}
              </button>
              <span aria-hidden="true" className="self-center h-[18px] w-[2px] bg-[var(--border)]" />
            </li>
          )}
        </ul>

        {/* the ground band — the premise they stand on, with the moved value */}
        <div className="rounded-xl border-t-2 border-[var(--border)] bg-[var(--bg)] px-5 py-4">
          <p
            className={`text-[16px] sm:text-[17px] font-medium leading-[1.55] text-[var(--text-primary)] ${locale === 'ko' ? 'break-keep' : ''}`}
            style={{ fontFamily: 'var(--font-voice, serif)' }}
          >
            &ldquo;{spot.text}&rdquo;
          </p>

          {baseline != null && current != null ? (
            <div className="mt-3.5 flex items-end gap-4 tabular-nums">
              <span className="text-right leading-none">
                <span className="block text-[11px] text-[var(--text-tertiary)] mb-1.5">{L('봉인 당시', 'at seal')}</span>
                <span className="block text-[22px] font-semibold tracking-[-0.01em] text-[var(--text-secondary)]">{baseline}</span>
              </span>
              <span aria-hidden="true" className="flex items-center flex-1 max-w-[240px] min-w-[80px] pb-[8px]">
                <span className="h-[9px] w-[9px] rounded-full border-[1.5px] border-[var(--text-tertiary)] bg-[var(--surface)] shrink-0" />
                <span className="h-[1.5px] flex-1 bg-[var(--border)]" />
                <span className="h-[9px] w-[9px] rounded-full bg-[var(--warning)] shrink-0" />
              </span>
              <span className="leading-none">
                <span className="block text-[11px] text-[var(--text-tertiary)] mb-1.5">{L('오늘', 'today')}</span>
                <span className="block text-[22px] font-semibold tracking-[-0.01em] text-[var(--warning)]">{current}</span>
              </span>
            </div>
          ) : (
            <p className="mt-3 text-[13.5px] text-[var(--text-secondary)]">
              {L('지난 확인', 'Last check')} — {drift.finding}
            </p>
          )}
          {drift.source_detail && (
            <p className="mt-2.5 text-[12px] text-[var(--text-tertiary)]">
              {L('출처', 'source')} · {drift.source_detail}
            </p>
          )}
        </div>
      </div>

      {/* the handle, and one door */}
      <div className="mt-6 flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
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
