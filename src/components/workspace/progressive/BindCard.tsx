'use client';

import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, CalendarDays, ChevronDown, Quote } from 'lucide-react';
import { useLocale } from '@/hooks/useLocale';
import type { CheckInInterval } from '@/stores/types';

/**
 * Phase 1 — BIND ("묶기"). Shown BEFORE the AI's answer is revealed, while the
 * initial analysis runs in parallel (buffered). The user MAY tie a rope: their own
 * one-line lean + a check-in window. Everything is optional; the dominant action is
 * to skip. This is "tie the rope before you hear the Sirens" — and it is what seeds
 * a decision_contract at OPEN so the moat fills even on mid-pipeline abandonment.
 *
 * SPINE INVARIANTS (do not regress):
 *  - The skip is unconditional and visually dominant (Enter = skip). Never a
 *    forced-typing gate — a tired user taps once and proceeds, losing nothing.
 *  - The lean field is NEVER prefilled from any model output (no borrowed rope).
 *  - No two-pole fork, no directional statement, no score. One neutral prompt.
 *  - On skip we fake nothing: onProceed(null) writes zero contract rows.
 */
export interface BindResult {
  lean?: string;
  interval?: CheckInInterval;
  /** A specific picked date (ISO) — overrides interval. Real outcomes often land
   *  on a known date (a launch, a result) that isn't 3d/1w/2w/1m. */
  check_in_at?: string;
}

const INTERVALS: { value: CheckInInterval; ko: string; en: string }[] = [
  { value: '1d', ko: '1일', en: '1 day' },
  { value: '3d', ko: '3일', en: '3 days' },
  { value: '1w', ko: '1주', en: '1 week' },
  { value: '2w', ko: '2주', en: '2 weeks' },
  { value: '1m', ko: '1달', en: '1 month' },
];

const INTERVAL_DAYS: Record<CheckInInterval, number> = { '1d': 1, '3d': 3, '1w': 7, '2w': 14, '1m': 30 };

const MAX_LEAN = 140;
const COLLAPSE_PROBLEM_AT = 160;

function toLocalDateInputValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function BindCard({
  onProceed,
  problem,
  recognition,
}: {
  /** null = full skip (no rope, write nothing). A BindResult = tie the rope. */
  onProceed: (bind: BindResult | null) => void;
  /** The problem the user just submitted — this remains the visual source record. */
  problem?: string;
  /** First-run only (#9): the buffered analysis's reframed crux question, shown as a
   *  READ-ONLY mirror so a cold first-timer gets recognition BEFORE the commitment
   *  ask. It is a neutral QUESTION (the user's own navigation words), NOT a verdict,
   *  and it NEVER seeds the lean field — spine invariants above hold unchanged. */
  recognition?: string | null;
}) {
  const locale = useLocale();
  const ko = locale === 'ko';
  const L = (k: string, e: string) => (ko ? k : e);

  const [lean, setLean] = useState('');
  const [interval, setInterval] = useState<CheckInInterval | null>(null);
  const [customDate, setCustomDate] = useState(''); // a specific picked date (yyyy-mm-dd)
  const [dateOpen, setDateOpen] = useState(false);
  const [problemExpanded, setProblemExpanded] = useState(false);
  const [proceeding, setProceeding] = useState(false);
  const proceedingRef = useRef(false);
  const leanRef = useRef<HTMLTextAreaElement>(null);

  // Desktop users can type immediately. On touch devices, auto-focus would
  // open the software keyboard before the person has read their own source
  // record, obscuring the very first checkpoint.
  useEffect(() => {
    if (window.matchMedia?.('(pointer: fine)').matches) {
      leanRef.current?.focus({ preventScroll: true });
    }
  }, []);

  const trimmed = lean.trim();
  const hasCommitment = trimmed.length > 0 || interval !== null || customDate !== '';

  const proceedOnce = (result: BindResult | null) => {
    if (proceedingRef.current) return;
    proceedingRef.current = true;
    setProceeding(true);
    onProceed(result);
  };
  const tie = () => proceedOnce(hasCommitment
    ? {
        lean: trimmed || undefined,
        interval: customDate ? undefined : (interval ?? undefined),
        check_in_at: customDate ? new Date(customDate).toISOString() : undefined,
      }
    : null);
  // Resolve a relative interval to a concrete date so "2주" reads as "2주 · 7월 8일".
  const dateLabel = (iv: CheckInInterval) => {
    const d = new Date(Date.now() + INTERVAL_DAYS[iv] * 86_400_000);
    return d.toLocaleDateString(ko ? 'ko-KR' : 'en-US', { month: 'short', day: 'numeric' });
  };
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const minimumCustomDate = toLocalDateInputValue(tomorrow);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="mx-auto w-full max-w-xl"
    >
      <div className="overflow-hidden rounded-[22px] border border-[var(--border)] bg-[var(--surface)] shadow-[0_18px_50px_rgba(31,24,15,0.10)]">
        {/* The user's own words come first. The previous layout asked for a lean
            before visually re-establishing what the person had actually said,
            making the machine's prompt feel like the subject. */}
        {problem && (
          <figure className="border-b border-[var(--border-subtle)] bg-[var(--bg)]/65 px-5 py-4 sm:px-6 sm:py-5">
            <figcaption className="mb-2 flex items-center justify-between gap-3 text-[11.5px] font-bold tracking-[0.11em] text-[var(--text-tertiary)]">
              <span className="flex items-center gap-2">
                <Quote size={13} className="text-[var(--accent)]" aria-hidden />
                {L('처음 적은 상황', 'What I wrote')}
              </span>
              {problem.length > COLLAPSE_PROBLEM_AT && (
                <button
                  type="button"
                  onClick={() => setProblemExpanded((expanded) => !expanded)}
                  aria-expanded={problemExpanded}
                  className="shrink-0 font-medium tracking-normal text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
                >
                  {problemExpanded ? L('접기', 'Collapse') : L('전체 보기', 'Read all')}
                </button>
              )}
            </figcaption>
            <blockquote
              className={`text-[16px] font-semibold leading-[1.55] text-[var(--text-primary)] sm:text-[17px] ${problemExpanded ? 'whitespace-pre-wrap break-words' : 'line-clamp-3'}`}
              style={{ fontFamily: 'var(--font-display)' }}
            >
              {problem}
            </blockquote>
          </figure>
        )}
        {/* First-run recognition mirror — read-only, never seeds the lean.
            Even when present, it follows the source record so an AI reframing
            can never visually precede what the person actually wrote. */}
        {recognition && (
          <div className="mx-4 mt-3 rounded-xl border border-[var(--accent)]/20 bg-[var(--ai)]/35 px-3.5 py-2.5 sm:mx-5">
            <p className="mb-1 text-[12px] font-semibold uppercase tracking-[0.14em] text-[var(--accent)]">
              {L('Argus가 먼저 짚은 한 질문 · AI', 'One question Argus surfaced · AI')}
            </p>
            <p className="line-clamp-2 text-[13.5px] font-semibold leading-[1.45] text-[var(--text-primary)]" style={{ fontFamily: 'var(--font-display)' }}>
              {recognition}
            </p>
          </div>
        )}

        <div className="px-5 pb-0 pt-5 sm:px-6 sm:pt-6">
          <p className="text-[11.5px] font-bold tracking-[0.11em] text-[var(--accent)]">
            {L('검토 전 · 선택 사항', 'Before the review · optional')}
          </p>
          <h2 className="mt-1.5 text-[19px] font-bold leading-snug text-[var(--text-primary)] sm:text-[21px]" style={{ fontFamily: 'var(--font-display)' }}>
            {L('지금 생각을 한 줄로 남길까요?', 'Leave your current view in one line?')}
          </h2>
          <p className="mt-1.5 text-[12.5px] leading-[1.55] text-[var(--text-secondary)]">
            {L(
              '나중에 검토 뒤의 최종 판단과 나란히 볼 수 있어요.',
              'You can compare it with your final judgment after the review.',
            )}
          </p>

          {/* One neutral optional line — never prefilled, never a fork. */}
          <textarea
            ref={leanRef}
            value={lean}
            maxLength={MAX_LEAN}
            disabled={proceeding}
            onChange={(e) => setLean(e.target.value)}
            onKeyDown={(e) => {
              if (e.nativeEvent.isComposing) return;
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                // Enter never blocks: with no commitment it skips; with one it ties.
                tie();
              }
            }}
            rows={3}
            placeholder={L('예: 지금은 연기하는 쪽에 가깝다 — 리스크가 더 커 보여서', 'e.g. I am closer to deferring — the risk looks bigger')}
            className="mt-3.5 w-full resize-none rounded-[14px] border border-[var(--border)] bg-[var(--bg)] px-4 py-3 text-[14px] leading-6 text-[var(--text-primary)] shadow-inner shadow-black/[0.02] placeholder:text-[var(--text-tertiary)] focus:border-[var(--primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/10"
          />

        {/* Check-in window — none preselected; an untapped default is never a commitment.
            Each chip shows its resolved date; "직접" picks a specific known day.
            On phones this optional choice starts folded so the primary thought
            and continue action remain one short reading path. Desktop keeps the
            choices open because they fit beside one another without burying it. */}
        <div className="mt-5 border-t border-[var(--border-subtle)] pt-4">
          <button
            type="button"
            onClick={() => setDateOpen((open) => !open)}
            aria-expanded={dateOpen}
            aria-controls="bind-review-date-options"
            className="flex min-h-11 w-full items-center gap-2.5 text-left sm:hidden"
          >
            <CalendarDays size={16} className="mt-0.5 shrink-0 text-[var(--accent)]" aria-hidden />
            <span className="min-w-0 flex-1">
              <span className="block text-[13px] font-bold text-[var(--text-primary)]">{L('언제 다시 볼까요? · 선택', 'When should we revisit? · optional')}</span>
              <span className="mt-0.5 block text-[11.5px] leading-4 text-[var(--text-tertiary)]">{L('원하면 날짜를 정할 수 있어요.', 'Set a date if it would help.')}</span>
            </span>
            <ChevronDown size={16} aria-hidden className={`shrink-0 text-[var(--text-tertiary)] transition-transform ${dateOpen ? 'rotate-180' : ''}`} />
          </button>
          <div className="mb-2.5 hidden items-start gap-2.5 sm:flex">
            <CalendarDays size={16} className="mt-0.5 shrink-0 text-[var(--accent)]" aria-hidden />
            <div>
              <span className="block text-[13px] font-bold text-[var(--text-primary)]">{L('언제 다시 볼까요?', 'When should we revisit this?')}</span>
              <span className="mt-0.5 block text-[11.5px] leading-4 text-[var(--text-tertiary)]">{L('선택한 날에 결과를 확인해요. 정하지 않아도 됩니다.', 'Check the outcome on that date. You can leave this unset.')}</span>
            </div>
          </div>
          <div
            id="bind-review-date-options"
            className={`${dateOpen ? 'mt-2.5 grid' : 'hidden'} grid-cols-2 gap-2 sm:mt-0 sm:flex sm:flex-wrap sm:items-stretch`}
          >
            {INTERVALS.map((iv) => (
              <button
                key={iv.value}
                type="button"
                onClick={() => { setInterval(interval === iv.value ? null : iv.value); setCustomDate(''); }}
                disabled={proceeding}
                aria-pressed={interval === iv.value && !customDate}
                className={`flex min-h-12 min-w-0 flex-col items-start justify-center rounded-xl border px-3 py-1.5 text-left transition-colors sm:min-h-11 sm:min-w-[88px] ${
                  interval === iv.value && !customDate
                    ? 'border-[var(--primary)] bg-[var(--primary)] text-[var(--bg)]'
                    : 'border-[var(--border-subtle)] text-[var(--text-secondary)] hover:border-[var(--text-tertiary)]'
                }`}
              >
                <span className="text-[13px] font-bold leading-4">{ko ? iv.ko : iv.en}</span>
                <span className={`mt-0.5 text-[11px] leading-4 ${
                  interval === iv.value && !customDate ? 'opacity-75' : 'text-[var(--text-tertiary)]'
                }`}>
                  {dateLabel(iv.value)}
                </span>
              </button>
            ))}
            <label className={`col-span-2 flex min-h-12 min-w-0 items-center gap-2 rounded-xl border bg-[var(--bg)] px-3 py-1.5 sm:col-auto sm:min-h-11 sm:w-[174px] ${
              customDate ? 'border-[var(--primary)] text-[var(--primary)]' : 'border-[var(--border-subtle)] text-[var(--text-secondary)]'
            }`}>
              <span className="shrink-0 text-[12px] font-bold">{L('직접', 'Custom')}</span>
              <input
                type="date"
                value={customDate}
                min={minimumCustomDate}
                disabled={proceeding}
                onChange={(e) => { setCustomDate(e.target.value); if (e.target.value) setInterval(null); }}
                className="min-w-0 flex-1 bg-transparent text-[12.5px] text-[var(--text-primary)] outline-none cursor-pointer"
                aria-label={L('직접 확인일 고르기', 'Pick a custom review date')}
                title={L('직접 고르기', 'Pick a date')}
              />
            </label>
          </div>
        </div>

        <div className="-mx-5 mt-5 flex flex-col gap-3 border-t border-[var(--border-subtle)] bg-[var(--bg)]/45 px-5 py-4 sm:-mx-6 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p className="text-[12px] leading-[1.5] text-[var(--text-tertiary)]">
            {L('입력과 날짜는 모두 선택 사항이에요.', 'The note and date are both optional.')}
          </p>
          <button
            type="button"
            onClick={tie}
            disabled={proceeding}
            className="inline-flex min-h-11 w-full items-center justify-center gap-1.5 rounded-xl bg-[var(--primary)] px-4 py-2 text-[13px] font-semibold text-[var(--bg)] transition-transform hover:-translate-y-px disabled:cursor-wait disabled:opacity-50 sm:w-auto"
          >
            {hasCommitment
              ? L('이 기준점 남기고 계속', 'Keep this baseline & continue')
              : L('건너뛰고 계속', 'Skip & continue')}
            <ArrowRight size={15} />
          </button>
        </div>

        <p className="pb-4 pt-3 text-[12.5px] leading-[1.5] text-[var(--text-tertiary)] sm:pb-5">
          {L('다음에는 결론을 바꿀 수 있는 한 가지 질문부터 봅니다.', 'Next, start with the one question that could change the call.')}
        </p>
        </div>
      </div>
    </motion.div>
  );
}
