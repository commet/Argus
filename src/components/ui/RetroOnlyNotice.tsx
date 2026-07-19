'use client';

/**
 * RetroOnlyNotice — 회고만 한 사용자의 빈 자차표 안내 (베팅③ C4 / W3 항목 7).
 *
 * A retro (practice) loop is fully EXCLUDED from the 자차표 (summarizeRecord
 * skips origin==='retro' — C1), so a user who has only ever closed a PRACTICE
 * loop sees the RecordStrip render nothing (mergedSettled === 0). Left alone,
 * that blank reads as a betrayal ("나 방금 고리 닫았는데 왜 아무것도 없지?").
 *
 * This strip fills that exact gap — and ONLY that gap:
 *  - shows ONLY when there is at least one SETTLED retro loop AND the real
 *    merged record is still empty (loops + review settles === 0). The instant a
 *    real loop closes, RecordStrip takes over and this renders null.
 *  - carries NO count, %, score, tier, or comparison (spine: no verdict). It
 *    names the honest fact — practice loops don't build the real record — and
 *    points forward, once, without a button or auto-navigation.
 *
 * All text renders as JSX nodes → React auto-escapes (XSS 헌법).
 */

import { useEffect } from 'react';
import { History } from 'lucide-react';
import { useProjectStore } from '@/stores/useProjectStore';
import { useReviewStore } from '@/stores/useReviewStore';
import { useLocale } from '@/hooks/useLocale';
import { summarizeRecord, isResolved } from '@/lib/decision-contract';
import { summarizeReviewRecord } from '@/lib/record-summary';

export function RetroOnlyNotice({ className }: { className?: string }) {
  const locale = useLocale();
  const L = (ko: string, en: string) => (locale === 'ko' ? ko : en);
  const projects = useProjectStore((s) => s.projects);
  const loadProjects = useProjectStore((s) => s.loadProjects);
  const receipts = useReviewStore((s) => s.receipts);
  const loadReceipts = useReviewStore((s) => s.load);

  useEffect(() => {
    loadProjects();
    loadReceipts();
  }, [loadProjects, loadReceipts]);

  // Real merged record — the SAME number RecordStrip gates its null on. If this
  // is > 0 the real strip shows and we defer to it entirely.
  const record = summarizeRecord(projects || [], Date.now());
  const reviewSettled = summarizeReviewRecord(receipts || []).settled;
  const mergedSettled = record.loops + reviewSettled;
  if (mergedSettled > 0) return null;

  // At least one SETTLED retro loop → there's a practice-loop blank worth
  // explaining. A retro loop that isn't closed yet (mid-flow) shows nothing.
  const hasSettledRetro = (projects || []).some((p) => {
    const c = p?.decision_contract;
    if (!c || c.origin !== 'retro') return false;
    const preds = Array.isArray(c.predicates) ? c.predicates : [];
    return preds.length > 0 && preds.every(isResolved);
  });
  if (!hasSettledRetro) return null;

  return (
    <div
      className={`rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] px-4 py-3 flex items-start gap-2.5 ${className || ''}`}
    >
      <History size={14} className="text-[var(--text-tertiary)] shrink-0 mt-0.5" />
      <p className="text-[12.5px] text-[var(--text-secondary)] leading-[1.55]">
        {L(
          '회고 연습은 실제 판단 기록 수에 포함하지 않아요. 실제 기록은 결과를 모르는 시점에 남긴 결정부터 시작됩니다.',
          "Practice loops (retro) don't build this record — they look back on outcomes you already knew. Your real record starts with the first real seal, one made before you know how it turns out.",
        )}
      </p>
    </div>
  );
}
