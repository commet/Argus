'use client';

import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, Quote } from 'lucide-react';
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
  const skip = () => proceedOnce(null);

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
      <div className="overflow-hidden rounded-[18px] border border-[var(--border-subtle)] bg-[var(--surface)] shadow-sm">
        {/* The user's own words come first. The previous layout asked for a lean
            before visually re-establishing what the person had actually said,
            making the machine's prompt feel like the subject. */}
        {problem && (
          <figure className="border-b border-[var(--border-subtle)] bg-[var(--bg)]/55 px-4 py-3.5 sm:px-5">
            <figcaption className="mb-1.5 flex items-center justify-between gap-3 text-[12px] font-bold tracking-[0.12em] text-[var(--accent)]">
              <span className="flex items-center gap-2">
                <Quote size={12} aria-hidden />
                {L('내가 적은 상황 · 원문', 'What I wrote · original')}
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
              className={`text-[15.5px] font-semibold leading-[1.5] text-[var(--text-primary)] ${problemExpanded ? 'whitespace-pre-wrap break-words' : 'line-clamp-3'}`}
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

        <div className="px-4 py-4 sm:px-5 sm:py-5">
          <p className="text-[12px] font-bold tracking-[0.12em] text-[var(--text-tertiary)]">
            {L('검토 전 기준점 · 선택', 'Before-review baseline · optional')}
          </p>
          <h2 className="mt-1 text-[18px] font-bold leading-snug text-[var(--text-primary)] sm:text-[19px]" style={{ fontFamily: 'var(--font-display)' }}>
            {L('검토하기 전, 지금의 생각은 무엇인가요?', 'Before the review, what do you think right now?')}
          </h2>
          <p className="mt-1 text-[12px] leading-[1.5] text-[var(--text-tertiary)]">
            {L(
              '이 문장은 검토 전 기준점으로만 남아요. 마지막에는 무엇이 바뀌었는지 보고 최종 판단을 따로 확정합니다.',
              'This is only your pre-review baseline. At the end, you will see what changed and confirm a separate final judgment.',
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
                if (hasCommitment) tie();
                else skip();
              }
            }}
            rows={2}
            placeholder={L('예: 지금은 연기하는 쪽에 가깝다 — 리스크가 더 커 보여서', 'e.g. I am closer to deferring — the risk looks bigger')}
            className="mt-3 w-full resize-none rounded-xl border border-[var(--border-subtle)] bg-[var(--bg)] px-3.5 py-2.5 text-[14px] leading-6 text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:border-[var(--primary)] focus:outline-none"
          />

        {/* Check-in window — none preselected; an untapped default is never a commitment.
            Each chip shows its resolved date; "직접" picks a specific known day. */}
        <div className="mt-2.5">
          <span className="mb-1.5 block text-[13px] text-[var(--text-tertiary)]">{L('현실과 확인:', 'Check reality:')}</span>
          <div className="grid grid-cols-3 gap-1.5 sm:flex sm:items-center sm:overflow-x-auto sm:pb-1">
            {INTERVALS.map((iv) => (
              <button
                key={iv.value}
                type="button"
                onClick={() => { setInterval(interval === iv.value ? null : iv.value); setCustomDate(''); }}
                disabled={proceeding}
                aria-pressed={interval === iv.value && !customDate}
                className={`min-w-0 rounded-lg border px-1.5 py-1.5 text-[12.5px] leading-4 transition-colors sm:shrink-0 sm:rounded-full sm:px-2.5 sm:py-1 sm:text-[13px] ${
                  interval === iv.value && !customDate
                    ? 'border-[var(--primary)] bg-[var(--primary)] text-[var(--bg)]'
                    : 'border-[var(--border-subtle)] text-[var(--text-secondary)] hover:border-[var(--text-tertiary)]'
                }`}
              >
                {(ko ? iv.ko : iv.en)} · {dateLabel(iv.value)}
              </button>
            ))}
            <input
              type="date"
              value={customDate}
              min={minimumCustomDate}
              disabled={proceeding}
              onChange={(e) => { setCustomDate(e.target.value); if (e.target.value) setInterval(null); }}
              className={`w-full min-w-0 rounded-lg border bg-[var(--bg)] px-1.5 py-1.5 text-[12.5px] cursor-pointer sm:w-[116px] sm:shrink-0 sm:rounded-full sm:px-2 sm:py-1 sm:text-[12.5px] ${
                customDate ? 'border-[var(--primary)] text-[var(--primary)]' : 'border-[var(--border-subtle)] text-[var(--text-secondary)]'
              }`}
              aria-label={L('직접 확인일 고르기', 'Pick a custom review date')}
              title={L('직접 고르기', 'Pick a date')}
            />
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between gap-3">
          {/* Dominant, unconditional skip. */}
          <button
            type="button"
            onClick={skip}
            disabled={proceeding}
            className="min-h-11 text-left text-[12.5px] font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] disabled:cursor-wait disabled:opacity-50"
          >
            {L('아직 잘 모르겠어요 · 건너뛰기', "I'm not sure yet · skip")}
          </button>

          {/* Secondary — only meaningful once there's something to tie. */}
          <button
            type="button"
            onClick={tie}
            disabled={!hasCommitment || proceeding}
            className={`inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl px-3.5 py-2 text-[12.5px] font-semibold transition-opacity ${
              hasCommitment && !proceeding
                ? 'bg-[var(--primary)] text-[var(--bg)]'
                : 'cursor-default bg-[var(--surface-2)] text-[var(--text-tertiary)] opacity-50'
            }`}
          >
            {L('기준점 남기고 계속', 'Keep baseline & continue')}
            <ArrowRight size={15} />
          </button>
        </div>

        <p className="mt-2 text-[13px] leading-[1.45] text-[var(--text-tertiary)]">
          {L('다음에는 결론을 바꿀 수 있는 한 가지 질문부터 봅니다.', 'Next, start with the one question that could change the call.')}
        </p>
        </div>
      </div>
    </motion.div>
  );
}
