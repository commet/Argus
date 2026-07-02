'use client';

/**
 * RecordStrip — the 자차표 as ONE component (P1-A2 = 08 S2).
 *
 * The user's accumulating record of closed loops, rendered identically on
 * /project (its original home) and /tools/review, with the workspace header
 * reading its compact form from the same lib (record-summary.ts). Numbers come
 * from two brains merged at the DISPLAY layer only: summarizeRecord (project
 * decision contracts) ⊕ summarizeReviewRecord (review receipts). Tables stay
 * separate (master §5-12).
 *
 * Spine: counts of what happened, never a score. The dim9 gate
 * (recordDisclosure) runs on the MERGED settled count — below the threshold
 * the honest italic renders; at/after it, a plain date fact ("기록 시작 …",
 * P1-A5) takes its place. All user data renders as JSX text nodes (XSS 헌법).
 */

import { useEffect } from 'react';
import { useProjectStore } from '@/stores/useProjectStore';
import { useReviewStore } from '@/stores/useReviewStore';
import { useLocale } from '@/hooks/useLocale';
import { summarizeRecord, recordDisclosure } from '@/lib/decision-contract';
import {
  summarizeReviewRecord,
  recordStripLine,
  recordStartDate,
} from '@/lib/record-summary';

export function RecordStrip({ className }: { className?: string }) {
  const locale = useLocale();
  const L = (ko: string, en: string) => (locale === 'ko' ? ko : en);
  const projects = useProjectStore((s) => s.projects);
  const loadProjects = useProjectStore((s) => s.loadProjects);
  const receipts = useReviewStore((s) => s.receipts);
  const loadReceipts = useReviewStore((s) => s.load);

  // localStorage-first: both halves of the record must be present wherever the
  // strip renders (/tools/review doesn't otherwise load projects, and vice
  // versa). Loads are idempotent local+remote merges.
  useEffect(() => {
    loadProjects();
    loadReceipts();
  }, [loadProjects, loadReceipts]);

  const record = summarizeRecord(projects || [], Date.now());
  const review = summarizeReviewRecord(receipts || []);
  const mergedSettled = record.loops + review.settled;
  if (mergedSettled === 0) return null;

  // Dim9 gate on the MERGED count — the same number both clauses sum to.
  const reveal = recordDisclosure({ ...record, loops: mergedSettled });
  const since = recordStartDate(projects || [], receipts || []);

  return (
    <div
      className={`rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] px-4 py-2.5 flex items-baseline gap-2.5 ${className || ''}`}
    >
      <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--text-tertiary)] shrink-0">
        {L('나의 기록', 'Your record')}
      </span>
      <span className="text-[13px] text-[var(--text-secondary)] leading-snug">
        {recordStripLine(record, review, locale)}
      </span>
      {/* Below the threshold: the honest "not yet a track record" italic.
          At/after it (P1-A5): the italic seat becomes a plain date fact. */}
      {!reveal.showStats ? (
        <span className="text-[11px] text-[var(--text-tertiary)] italic shrink-0">
          {L('아직 확정된 기록은 아님', 'not yet a track record')}
        </span>
      ) : since ? (
        <span className="text-[11px] text-[var(--text-tertiary)] shrink-0">
          {L(`기록 시작 ${since}`, `on record since ${since}`)}
        </span>
      ) : null}
    </div>
  );
}
