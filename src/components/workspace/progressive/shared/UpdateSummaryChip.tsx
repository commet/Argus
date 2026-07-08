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
      {/* De-emphasized: this is a transient "your answer moved it" footnote, NOT a
          peer of the gold "우리가 잡은 항로" card eyebrow below it. Drop the accent
          gold + uppercase so the two stacked eyebrows don't read as one ambiguous
          block (and so the persistent course card clearly outranks this chip). */}
      {/* 수집의 가시화 — "+5 −5" 암호가 아니라 사람의 문장으로: 방금의 답이
          무엇을 움직였는지가 매 턴 눈에 보여야 기록되고 있다는 감각이 생긴다
          (MCP 당직 capture의 웹 등가물, 창업자 지시 2026-07-08). */}
      <p className="text-[11.5px] text-[var(--text-secondary)] leading-snug">
        <span className="font-semibold text-[var(--accent)]">{L('방금 답이 반영됐어요', 'Your answer landed')}</span>
        <span className="text-[var(--text-tertiary)]"> — </span>
        {[
          hasSkDelta && (skNew > 0
            ? L(`단계 ${skNew}개 다시 짜임${skRem > 0 ? ` (이전 ${skRem}개 정리)` : ''}`, `${skNew} steps redrawn${skRem > 0 ? ` (${skRem} folded)` : ''}`)
            : L(`단계 ${skRem}개 정리`, `${skRem} steps folded`)),
          hasAsDelta && (asNew > 0
            ? L(`가정 ${asNew}개 새로 세움${asRem > 0 ? ` (${asRem}개 걷어냄)` : ''}`, `${asNew} new assumptions${asRem > 0 ? ` (${asRem} cleared)` : ''}`)
            : L(`가정 ${asRem}개 걷어냄`, `${asRem} assumptions cleared`)),
          questionChanged && !hasSkDelta && !hasAsDelta && L('질문 자체가 바뀜', 'the question itself moved'),
        ].filter(Boolean).join(' · ')}
      </p>

      <div className="flex items-center gap-4 text-[11px] tabular-nums">
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
