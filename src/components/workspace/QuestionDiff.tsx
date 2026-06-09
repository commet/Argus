'use client';

/**
 * QuestionDiff — the before→after reframe contrast ("당신의 질문이 바뀌었습니다").
 *
 * The user's original question struck through, the AI-reframed question below it
 * in accent. This is the small "your thinking moved" reward moment. Extracted as
 * a shared presentational component so both the live voyage (ProgressiveFlow's
 * Q&A) and the legacy ReframeStep can render the same device.
 *
 * Renders NOTHING when there is no real change (no `after`, or `after` is just
 * `before` re-spaced/re-cased) — a no-op diff would be noise, not a reward.
 *
 * All text renders through JSX ({…}) → React auto-escapes (no XSS).
 */

import { useLocale } from '@/hooks/useLocale';

/** Trim, collapse internal whitespace, lowercase — for the no-op comparison. */
function normalize(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, ' ');
}

export function QuestionDiff({
  before,
  after,
  note,
  className = '',
}: {
  /** The user's original framing. */
  before: string;
  /** The reframed question. */
  after: string;
  /** Optional one-line hint under the diff (e.g. uncertain-assumption count). */
  note?: string;
  className?: string;
}) {
  const locale = useLocale();
  const ko = locale === 'ko';

  // Never show a no-op diff (nothing actually changed) — or a missing reframe.
  if (!after?.trim() || !before?.trim() || normalize(before) === normalize(after)) {
    return null;
  }

  return (
    <div className={`reward-entrance ${className}`}>
      <p className="text-[11px] font-semibold text-[var(--text-secondary)] mb-2.5">
        {ko ? '당신의 질문이 바뀌었습니다' : 'Your question has changed'}
      </p>
      <div className="space-y-2">
        <p className="text-[13px] text-[var(--text-tertiary)] line-through decoration-[var(--text-tertiary)]/30">
          {before}
        </p>
        <p className="text-[13px] font-semibold text-[var(--accent)]">{after}</p>
      </div>
      {note && <p className="mt-2.5 text-[11px] text-[var(--accent)]">{note}</p>}
    </div>
  );
}
