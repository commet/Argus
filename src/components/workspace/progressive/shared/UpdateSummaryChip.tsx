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
      // No rule, no box — the faintest line in the hierarchy. Smallest type,
      // grouped by spacing; it's a quiet "your answer moved it" footnote, not a
      // bordered strip.
      className="flex items-center justify-between gap-x-4 gap-y-1 flex-wrap py-1"
      aria-label={L('팀 분석 업데이트 요약', 'Team analysis update summary')}
    >
      <div className="text-[10px] font-semibold tracking-[0.12em] uppercase text-[var(--accent)]/85 shrink-0">
        {L('답 반영해서 다시 봤어요', 'Refined with your answer')}
      </div>

      <div className="flex items-center gap-4 text-[11px] tabular-nums">
        {hasSkDelta && (
          <span className="inline-flex items-baseline gap-1.5">
            <span className="text-[var(--text-tertiary)]">{L('단계', 'Steps')}</span>
            {skNew > 0 && <span className="font-semibold text-[var(--text-primary)]">+{skNew}</span>}
            {skRem > 0 && <span className="text-[var(--text-tertiary)]">−{skRem}</span>}
          </span>
        )}
        {hasAsDelta && (
          <span className="inline-flex items-baseline gap-1.5">
            <span className="text-[var(--text-tertiary)]">{L('가정', 'Assumptions')}</span>
            {asNew > 0 && <span className="font-semibold text-[var(--text-primary)]">+{asNew}</span>}
            {asRem > 0 && <span className="text-[var(--text-tertiary)]">−{asRem}</span>}
          </span>
        )}
        {onSeeDetail && (
          <button
            type="button"
            onClick={onSeeDetail}
            className="inline-flex items-center gap-1 text-[var(--text-tertiary)] hover:text-[var(--accent)] transition-colors -mr-1 px-1.5 py-1 rounded-md group"
          >
            <span>{L('전체 보기', 'See full')}</span>
            <ArrowDown size={10} className="transition-transform group-hover:translate-y-0.5" />
          </button>
        )}
      </div>
    </motion.section>
  );
}
