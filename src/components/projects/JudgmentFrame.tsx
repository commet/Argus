'use client';

/**
 * JudgmentFrame — 판단 액자 (P1-A1 / 08 S1, polish audit 2026-07-03).
 *
 * The moat's raw material is the user's OWN two sentences — the one-line call
 * written at the seal (human_judgment) and the settlement narrative written at
 * the return (what_happened). Both used to be write-only: saved, then never
 * rendered again anywhere. This frame puts them on permanent display, in the
 * same register as the seal certificate (graticule texture + serif quotes).
 *
 * Spine contract (master §4 — P1-A1 row):
 *  - First-class quotes come from human_judgment ONLY — the user-typed field.
 *    An `authored:'ai_surfaced'` predicate line is NEVER promoted into the
 *    frame (CLAUDE.md rule 1: never lie about authorship).
 *  - No human_judgment → the whole frame renders nothing. No empty frame,
 *    no placeholder, no invented copy (Defensive Data Access).
 *  - what_happened absent (e.g. a Telegram button settlement) → only the
 *    seal-time quote renders. The blank is left honest.
 *  - Verbatim quotes + date stamps ONLY. The diff between the two sentences is
 *    read by the user — the product never summarizes, grades, or narrates it
 *    (the moment we explain the diff, it becomes a verdict).
 *  - Quotes render as JSX text nodes → React auto-escapes (XSS appendix).
 */

import { Graticule } from '@/components/ui/VoyageElements';
import { RetroBadge } from './RetroBadge';

export function JudgmentFrame({
  humanJudgment,
  whatHappened,
  sealedOn,
  settledOn,
  ko,
  retro = false,
  className = '',
}: {
  /** The user's seal-time one-liner. Empty/absent → the frame does not render. */
  humanJudgment?: string | null;
  /** The user's settlement narrative. Absent → only the seal quote shows. */
  whatHappened?: string | null;
  /** Formatted seal date stamp (fact only). */
  sealedOn?: string;
  /** Formatted settle date stamp (fact only). */
  settledOn?: string;
  ko: boolean;
  /** [C2] Retrospective (practice) frame → show the 「연습 · 회고」 badge so the
   *  frame never reads as a real, blind-made judgment. Default false (real). */
  retro?: boolean;
  className?: string;
}) {
  const quote = (humanJudgment || '').trim();
  if (!quote) return null;
  const happened = (whatHappened || '').trim();

  return (
    <div className={`relative overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-4 text-left ${className}`}>
      <Graticule opacity={0.04} spacing={26} />
      <div className="relative">
        {/* [C2] 판단 액자 표면의 「연습 · 회고」 상시 배지 — retro일 때만. */}
        {retro && (
          <div className="mb-2">
            <RetroBadge ko={ko} />
          </div>
        )}
        <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-[var(--text-tertiary)]">
          {ko ? '처음 기록할 때' : 'When first saved'}
          {sealedOn ? ` — ${sealedOn}` : ''}
        </p>
        <p className="mt-1.5 text-[14px] text-[var(--text-primary)] leading-[1.65]" style={{ fontFamily: 'var(--font-voice, serif)' }}>
          &ldquo;{quote}&rdquo;
        </p>
        {happened && (
          <>
            <p className="mt-4 text-[12px] font-semibold uppercase tracking-[0.18em] text-[var(--text-tertiary)]">
              {ko ? '결과를 확인한 뒤' : 'After reviewing the outcome'}
              {settledOn ? ` — ${settledOn}` : ''}
            </p>
            <p className="mt-1.5 text-[14px] text-[var(--text-primary)] leading-[1.65]" style={{ fontFamily: 'var(--font-voice, serif)' }}>
              &ldquo;{happened}&rdquo;
            </p>
          </>
        )}
      </div>
    </div>
  );
}
