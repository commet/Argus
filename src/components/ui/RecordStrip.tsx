'use client';

/**
 * A quiet inventory of the user's own records.
 *
 * This deliberately counts only two neutral facts: how many records exist and
 * how many times the user returned to append a later answer. It never rolls
 * answers up into hits, misses, luck, accuracy, maturity, or a proxy score.
 */

import { useEffect } from 'react';
import { useProjectStore } from '@/stores/useProjectStore';
import { useReviewStore } from '@/stores/useReviewStore';
import { useLocale } from '@/hooks/useLocale';
import { summarizeReviewRecord, recordStartDate } from '@/lib/record-summary';

export function RecordStrip({ className }: { className?: string }) {
  const locale = useLocale();
  const L = (ko: string, en: string) => (locale === 'ko' ? ko : en);
  const projects = useProjectStore((state) => state.projects);
  const loadProjects = useProjectStore((state) => state.loadProjects);
  const receipts = useReviewStore((state) => state.receipts);
  const loadReceipts = useReviewStore((state) => state.load);

  useEffect(() => {
    loadProjects();
    loadReceipts();
  }, [loadProjects, loadReceipts]);

  const review = summarizeReviewRecord(receipts || []);
  const projectRecords = (projects || []).filter(
    (project) => project.decision_contract && project.decision_contract.origin !== 'retro',
  );
  const projectReturns = projectRecords.reduce((total, project) => {
    const contract = project.decision_contract!;
    if (contract.settlements?.length) return total + contract.settlements.length;
    return total + (contract.judgment_receipt?.settled_at ? 1 : 0);
  }, 0);
  const reviewRecords = (receipts || []).reduce(
    (total, receipt) => total
      + (receipt.falsifiable_followups || []).filter((followup) => followup.sealed_at).length,
    0,
  );
  const recordCount = projectRecords.length + reviewRecords;
  const returnCount = projectReturns + review.settled;
  if (recordCount === 0) return null;

  const since = recordStartDate(projects || [], receipts || []);

  return (
    <div
      className={`rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] px-4 py-2.5 flex items-baseline gap-2.5 ${className || ''}`}
    >
      <span className="text-[12px] font-bold uppercase tracking-[0.12em] text-[var(--text-tertiary)] shrink-0">
        {L('나의 기록', 'Your records')}
      </span>
      <span className="text-[13px] text-[var(--text-secondary)] leading-snug">
        {L(
          `남긴 판단 ${recordCount}건 · 다시 돌아와 답한 기록 ${returnCount}건`,
          `${recordCount} record${recordCount === 1 ? '' : 's'} · ${returnCount} revisited`,
        )}
      </span>
      {since ? (
        <span className="text-[12.5px] text-[var(--text-tertiary)] shrink-0">
          {L(`기록 시작 ${since}`, `since ${since}`)}
        </span>
      ) : null}
    </div>
  );
}
