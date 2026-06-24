'use client';

import { motion } from 'framer-motion';
import { ArrowDown } from 'lucide-react';
import type { AnalysisSnapshot } from '@/stores/types';
import { diffItems } from './diffItems';
import { EASE } from './constants';

interface UpdateSummaryChipProps {
  /** Current snapshot (after the latest refinement) */
  snapshot: AnalysisSnapshot;
  /** Previous snapshot — used to compute the before/after */
  prevSnapshot: AnalysisSnapshot | null;
  /** Optional handler for "see full" — scroll to full AnalysisCard */
  onSeeDetail?: () => void;
  /** Suppress the "이전(Before)" block — used on the first refinement, where the
   *  previous question was never really read so the contrast is contextless. */
  hideBefore?: boolean;
  locale?: 'ko' | 'en';
}

/**
 * Quiet summary of what changed since the previous snapshot — sits near the
 * next CTA (question / mix trigger) so the reader sees the evolution at their
 * current scroll position instead of having to look up/down at AnalysisCard.
 *
 * Renders nothing if the only change is the version counter.
 */
export function UpdateSummaryChip({
  snapshot,
  prevSnapshot,
  onSeeDetail,
  hideBefore = false,
  locale = 'ko',
}: UpdateSummaryChipProps) {
  const L = (ko: string, en: string) => (locale === 'ko' ? ko : en);

  if (!prevSnapshot) return null;
  if (snapshot.version <= (prevSnapshot.version ?? 0)) return null;

  const questionChanged = prevSnapshot.real_question !== snapshot.real_question;
  const skeletonDiff = diffItems(prevSnapshot.skeleton, snapshot.skeleton);
  const assumptionDiff = diffItems(
    prevSnapshot.hidden_assumptions,
    snapshot.hidden_assumptions,
  );

  const skNew = skeletonDiff.filter((d) => d.status === 'new').length;
  const skRem = skeletonDiff.filter((d) => d.status === 'removed').length;
  const asNew = assumptionDiff.filter((d) => d.status === 'new').length;
  const asRem = assumptionDiff.filter((d) => d.status === 'removed').length;

  const hasSkDelta = skNew > 0 || skRem > 0;
  const hasAsDelta = asNew > 0 || asRem > 0;

  if (!questionChanged && !hasSkDelta && !hasAsDelta) return null;

  return (
    <motion.section
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: EASE, delay: 0.2 }}
      className="rounded-2xl bg-[var(--accent)]/[0.03] px-5 py-5 md:px-6"
      aria-label={L('팀 분석 업데이트 요약', 'Team analysis update summary')}
    >
      {/* Eyebrow — humble verb phrase that works for the first refinement
          (v0→v1) and any subsequent one. Avoids meta-labels like "Updated". */}
      <div className="text-[10px] font-bold tracking-[0.14em] uppercase text-[var(--accent)] mb-4">
        {L('반영해서 다시 봤어요', 'Refined with your input')}
      </div>

      {/* Question before/after — typography carries the evolution. On the first
          refinement the "이전" is suppressed (contextless), leaving just the
          refined question under the "반영해서 다시 봤어요" eyebrow. */}
      {questionChanged && (
        <div className="mb-4 space-y-3">
          {!hideBefore && (
            <div>
              <div className="text-[9px] font-semibold tracking-[0.14em] uppercase text-[var(--text-tertiary)] mb-1">
                {L('이전', 'Before')}
              </div>
              <p
                className="text-[13px] md:text-[14px] text-[var(--text-tertiary)] leading-[1.55]"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                {prevSnapshot.real_question}
              </p>
            </div>
          )}
          <div>
            {!hideBefore && (
              <div className="text-[9px] font-semibold tracking-[0.14em] uppercase text-[var(--accent)] mb-1">
                {L('지금', 'Now')}
              </div>
            )}
            <p
              className="text-[15px] md:text-[17px] font-semibold text-[var(--text-primary)] leading-[1.4] tracking-tight"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              {snapshot.real_question}
            </p>
          </div>
        </div>
      )}

      {/* Footer: stats + see-detail link */}
      {(hasSkDelta || hasAsDelta || onSeeDetail) && (
        <div className="flex items-center justify-between gap-3 text-[11px]">
          <div className="flex items-center gap-5 tabular-nums">
            {hasSkDelta && (
              <span className="inline-flex items-baseline gap-1.5">
                <span className="text-[var(--text-tertiary)]">
                  {L('단계', 'Steps')}
                </span>
                {skNew > 0 && (
                  <span className="font-semibold text-[var(--text-primary)]">
                    +{skNew}
                  </span>
                )}
                {skRem > 0 && (
                  <span className="text-[var(--text-tertiary)]">−{skRem}</span>
                )}
              </span>
            )}
            {hasAsDelta && (
              <span className="inline-flex items-baseline gap-1.5">
                <span className="text-[var(--text-tertiary)]">
                  {L('가정', 'Assumptions')}
                </span>
                {asNew > 0 && (
                  <span className="font-semibold text-[var(--text-primary)]">
                    +{asNew}
                  </span>
                )}
                {asRem > 0 && (
                  <span className="text-[var(--text-tertiary)]">−{asRem}</span>
                )}
              </span>
            )}
          </div>
          {onSeeDetail && (
            <button
              type="button"
              onClick={onSeeDetail}
              className="inline-flex items-center gap-1 text-[var(--text-tertiary)] hover:text-[var(--accent)] transition-colors -mr-1 px-1.5 py-1 rounded-md group"
            >
              <span>{L('전체 보기', 'See full')}</span>
              <ArrowDown
                size={10}
                className="transition-transform group-hover:translate-y-0.5"
              />
            </button>
          )}
        </div>
      )}
    </motion.section>
  );
}
