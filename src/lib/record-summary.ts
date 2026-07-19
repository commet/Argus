/**
 * record-summary — the ONE display-layer brain for the 자차표 (P1-A2 = 08 S2).
 *
 * The user's record used to live in four ledgers with four ad-hoc renderings:
 * project decision contracts (/project strip + SettlementModal), review
 * receipts (/tools/review, previously uncounted anywhere), the workspace
 * accumulation line, and the telegram bot's record-core. This file merges the
 * DISPLAY layer only — tables and types stay separate on purpose (master §5-12,
 * parallel-session rule: no physical ledger unification).
 *
 * Spine: every string here is a COUNT of what actually happened — never a
 * score, %, tier, or comparison. The recordDisclosure (dim9) gate is applied
 * on the MERGED settled count so a handful of review settles can't smuggle a
 * "track record" claim past the threshold.
 */

import type { CrossProjectRecord } from './decision-contract';
import type { JudgmentReceipt } from './review/schema';
import { SETTLED_THRESHOLD } from './calibration-disclosure';

/** Same shape as record-core's RecordCounts — the cross-surface number contract.
 *  A cross test (record-summary.test.ts) asserts the web strip and the telegram
 *  markdown render the SAME numbers from the same data. */
export interface ReviewRecordCounts {
  /** sealed follow-ups still awaiting their check-in */
  open: number;
  /** follow-ups settled against reality */
  settled: number;
  /** outcome breakdown (sum ≤ settled — 'unclear'/'missed' have no bucket) */
  happened: number;
  avoided: number;
  partial: number;
}

/**
 * Count the review-receipt half of the record (08 S2-1). Reads the followup
 * settle fields useReviewStore.settleFollowup writes (sealed_at / settled_at /
 * outcome). Defensive on every level — old receipts may lack arrays/fields.
 */
export function summarizeReviewRecord(receipts: JudgmentReceipt[]): ReviewRecordCounts {
  const c: ReviewRecordCounts = { open: 0, settled: 0, happened: 0, avoided: 0, partial: 0 };
  for (const r of receipts || []) {
    for (const f of r?.falsifiable_followups || []) {
      if (!f?.sealed_at) continue; // unsealed drafts are not part of the record
      if (!f.settled_at) {
        c.open++;
        continue;
      }
      c.settled++;
      if (f.outcome === 'happened') c.happened++;
      else if (f.outcome === 'avoided') c.avoided++;
      else if (f.outcome === 'partial') c.partial++;
      // 'unclear'/'missed' count in settled but get no outcome bucket (sum ≤ settled).
    }
  }
  return c;
}

/**
 * The full strip sentence (08 S2-3) — /project and /tools/review render this
 * verbatim through <RecordStrip/>. Counts only; each clause appears only when
 * its count is real (no zero-padding a thin record to look fuller).
 */
export function recordStripLine(
  record: CrossProjectRecord,
  review: ReviewRecordCounts | undefined,
  locale: 'ko' | 'en',
): string {
  const ko = locale === 'ko';
  const reviewSettled = review?.settled ?? 0;
  const parts: string[] = [];
  if (record.loops > 0) {
    parts.push(ko ? `결과 확인 완료 ${record.loops}건` : `${record.loops} outcome${record.loops === 1 ? '' : 's'} reviewed`);
    if (record.betsHeld > 0) parts.push(ko ? `적중한 가설 ${record.betsHeld}개` : `${record.betsHeld} bet${record.betsHeld === 1 ? '' : 's'} held`);
    if (record.risksAvoided > 0) parts.push(ko ? `비켜 간 위험 ${record.risksAvoided}개` : `${record.risksAvoided} risk${record.risksAvoided === 1 ? '' : 's'} steered past`);
    if (record.goodOutcomesOnLuck > 0) parts.push(ko ? `그중 운으로 본 게 ${record.goodOutcomesOnLuck}개` : `${record.goodOutcomesOnLuck} marked as luck`);
  }
  if (reviewSettled > 0) {
    parts.push(ko ? `문서 검수 결과 확인 ${reviewSettled}건` : `${reviewSettled} document-review outcome${reviewSettled === 1 ? '' : 's'} recorded`);
  }
  return parts.join(' · ');
}

/**
 * The workspace section-header one-liner (08 S3-3, shipped as P1-A4) — moved
 * here so the third placement reads from the same brain as the other two.
 * loops-only on purpose: the compact form names the closed-loop count, and the
 * forming state is an honest "record starts on the first check-in" fact.
 */
export function recordCompactLine(
  record: CrossProjectRecord,
  sealedCount: number,
  locale: 'ko' | 'en',
): string | null {
  const ko = locale === 'ko';
  if (record.loops > 0) {
    return ko ? `결과 확인 완료 ${record.loops}건` : `${record.loops} outcome${record.loops === 1 ? '' : 's'} reviewed`;
  }
  if (sealedCount > 0) {
    return ko
      ? `확인 대기 ${sealedCount}건 — 확인일이 오면 결과를 이어서 기록해요`
      : `${sealedCount} awaiting review — add the outcome on the review date`;
  }
  return null;
}

/**
 * "기록 시작 YYYY-MM-DD" source (08 S4/S5 각인): the oldest project created_at,
 * falling back to the oldest receipt when the record is review-only. A plain
 * date fact — never a duration ("N주째" style aging is 08 S4's engraving and
 * stays out of the strip).
 */
export function recordStartDate(
  projects: Array<{ created_at?: string }>,
  receipts: Array<{ created_at?: string }>,
): string | undefined {
  let min: string | undefined;
  for (const list of [projects || [], receipts || []]) {
    for (const item of list) {
      const d = item?.created_at ? String(item.created_at).slice(0, 10) : undefined;
      if (d && /^\d{4}-\d{2}-\d{2}$/.test(d) && (!min || d < min)) min = d;
    }
  }
  return min;
}

/**
 * 형태2 기념일 각인 (08 B6) — the anniversary inscription: `첫 항해 {date} ·
 * 오늘로 N주째`. A PURE elapsed FACT built only on the record's oldest seal date
 * and the current clock. There is NO continuity condition anywhere in here — an
 * empty gap (weeks with no seal) renders the identical string, so it can never be
 * read as a "streak kept" or "streak broken". Not a streak, not a push, and it
 * only exists while the surface is on screen.
 *
 * Returns undefined when there is no start date (nothing to inscribe). The date
 * source is recordStartDate (the same oldest-seal fact the strip already uses),
 * so the inscription and the strip's "기록 시작" can never disagree.
 */
export function firstVoyageInscription(
  since: string | undefined,
  now: number,
  locale: 'ko' | 'en',
): string | undefined {
  if (!since) return undefined;
  const then = new Date(since).getTime();
  if (Number.isNaN(then)) return undefined;
  // Whole elapsed weeks — floor, clamped at 0 (a same-day seal reads "0주째").
  const weeks = Math.max(0, Math.floor((now - then) / (7 * 86_400_000)));
  return locale === 'ko'
    ? `기록 시작 ${since} · ${weeks}주 경과`
    : `Record started ${since} · ${weeks} weeks ago`;
}

/**
 * 3고리 의식 gate (P1-A5 = 08 S5): fires EXACTLY at the moment the merged
 * settled count first reaches SETTLED_THRESHOLD, once per lifetime (the caller
 * persists `alreadySeen` via STORAGE_KEYS.THIRD_LOOP_SEEN). Strict equality on
 * purpose: a user who crossed the threshold before this shipped never gets a
 * late "third loop" line about their fifth loop.
 */
export function shouldShowThirdLoop(mergedLoops: number, alreadySeen: boolean): boolean {
  return !alreadySeen && mergedLoops === SETTLED_THRESHOLD;
}
