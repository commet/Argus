'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
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

export function BindCard({
  onProceed,
  problem,
  recognition,
}: {
  /** null = full skip (no rope, write nothing). A BindResult = tie the rope. */
  onProceed: (bind: BindResult | null) => void;
  /** The problem the user just submitted — shown small, for orientation only. */
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

  const trimmed = lean.trim();
  const hasCommitment = trimmed.length > 0 || interval !== null || customDate !== '';

  const tie = () => onProceed(hasCommitment
    ? {
        lean: trimmed || undefined,
        interval: customDate ? undefined : (interval ?? undefined),
        check_in_at: customDate ? new Date(customDate).toISOString() : undefined,
      }
    : null);
  const skip = () => onProceed(null);

  // Resolve a relative interval to a concrete date so "2주" reads as "2주 · 7월 8일".
  const dateLabel = (iv: CheckInInterval) => {
    const d = new Date(Date.now() + INTERVAL_DAYS[iv] * 86_400_000);
    return d.toLocaleDateString(ko ? 'ko-KR' : 'en-US', { month: 'short', day: 'numeric' });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="mx-auto w-full max-w-xl"
    >
      <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] px-6 py-7 shadow-sm">
        {/* First-run recognition mirror — read-only, never seeds the lean. */}
        {recognition && (
          <div className="mb-5 rounded-xl border border-[var(--accent)]/20 bg-[var(--ai)]/40 px-4 py-3">
            <p className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-[var(--accent)] mb-1.5">
              {L('지금 풀어야 할 질문', 'The question to solve now')}
            </p>
            <p className="text-[14.5px] font-semibold leading-snug text-[var(--text-primary)]" style={{ fontFamily: 'var(--font-display)' }}>
              {recognition}
            </p>
          </div>
        )}
        <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-[var(--text-tertiary)] mb-2">
          {L('답을 듣기 전', 'Before you hear the answer')}
        </p>
        <h2 className="text-[19px] font-bold leading-snug text-[var(--text-primary)]" style={{ fontFamily: 'var(--font-display)' }}>
          {recognition
            ? L('이 질문을 두고 지금 마음은 어디로 기울어요?', 'Where are you leaning on this question right now?')
            : L('지금 마음은 어디로 기울어요?', 'Where are you leaning right now?')}
        </h2>
        {/* First-meeting metaphor bridge (06 S3) — half a sentence tying '밧줄/묶기'
            to its reason. Copy only; the SPINE INVARIANTS above are untouched. */}
        <p className="text-[12.5px] text-[var(--text-tertiary)] mt-1.5 leading-snug">
          {L('선택사항이에요. 지금 생각을 남겨두면 확인일에 실제 결과와 비교할 수 있어요.',
             'Optional. Leave your current view so you can compare it with the outcome on the review date.')}
        </p>

        {/* The user's own words are the hero of this screen (우정 1조: 네가 한 말을
            그대로 기억한다) — quote treatment, not a footnote. */}
        {problem && (
          <blockquote className="mt-4 rounded-lg bg-[var(--ai)]/40 px-4 py-3 text-[15px] font-medium leading-snug text-[var(--text-primary)] line-clamp-3" style={{ fontFamily: 'var(--font-display)' }}>
            {problem}
          </blockquote>
        )}

        {/* One neutral optional line — never prefilled, never a fork. */}
        <textarea
          autoFocus
          value={lean}
          maxLength={MAX_LEAN}
          onChange={(e) => setLean(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              // Enter never blocks: with no commitment it skips; with one it ties.
              hasCommitment ? tie() : skip();
            }
          }}
          rows={2}
          placeholder={L('예: 연기하는 쪽으로 기운다 — 리스크가 더 커 보여서', 'e.g. leaning toward deferring — the risk looks bigger')}
          className="mt-4 w-full resize-none rounded-xl border border-[var(--border-subtle)] bg-[var(--bg)] px-3.5 py-3 text-[14px] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:border-[var(--primary)] focus:outline-none"
        />

        {/* Check-in window — none preselected; an untapped default is never a commitment.
            Each chip shows its resolved date; "직접" picks a specific known day. */}
        <div className="mt-3 flex items-center gap-2 flex-wrap">
          <span className="text-[12px] text-[var(--text-tertiary)]">{L('확인일:', 'Check back:')}</span>
          {INTERVALS.map((iv) => (
            <button
              key={iv.value}
              type="button"
              onClick={() => { setInterval(interval === iv.value ? null : iv.value); setCustomDate(''); }}
              className={`rounded-full border px-3 py-1 text-[12.5px] transition-colors ${
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
            min={new Date(Date.now() + 86_400_000).toISOString().slice(0, 10)}
            onChange={(e) => { setCustomDate(e.target.value); if (e.target.value) setInterval(null); }}
            className={`rounded-full border px-2.5 py-1 text-[12px] bg-[var(--bg)] cursor-pointer ${
              customDate ? 'border-[var(--primary)] text-[var(--primary)]' : 'border-[var(--border-subtle)] text-[var(--text-secondary)]'
            }`}
            title={L('직접 고르기', 'Pick a date')}
          />
        </div>

        <div className="mt-6 flex items-center justify-between gap-3">
          {/* Dominant, unconditional skip. */}
          <button
            type="button"
            onClick={skip}
            className="text-[13.5px] font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
          >
            {L('아직 잘 모르겠어요 →', "I'm not sure yet →")}
          </button>

          {/* Secondary — only meaningful once there's something to tie. */}
          <button
            type="button"
            onClick={tie}
            disabled={!hasCommitment}
            className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-[13.5px] font-semibold transition-opacity ${
              hasCommitment
                ? 'bg-[var(--primary)] text-[var(--bg)]'
                : 'cursor-default bg-[var(--surface-2)] text-[var(--text-tertiary)] opacity-50'
            }`}
          >
            {L('생각 남기고 계속', 'Save view & continue')}
            <ArrowRight size={15} />
          </button>
        </div>

        {/* Progress signal (06 S3) — the read the user asked for IS running behind
            this card (buffered by design); say so in one machine-status sentence.
            No spinner: the analysis stays buffered, this is orientation only. */}
        <p className="mt-4 text-[12px] leading-snug text-[var(--text-secondary)]">
          {L('AI 팀원은 적어주신 내용을 이미 읽고 있어요. 다음 화면에서 정리한 질문을 보여드려요.',
             'AI reviewers are already reading what you wrote. The organized question appears next.')}
        </p>
      </div>
    </motion.div>
  );
}
