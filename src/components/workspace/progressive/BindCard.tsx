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
  /** A specific picked date (ISO yyyy-mm-dd) — overrides interval. Real outcomes
   *  often land on a known date (a launch, a result) that isn't 1w/2w/1m. */
  check_in_at?: string;
}

const INTERVALS: { value: CheckInInterval; ko: string; en: string }[] = [
  { value: '1w', ko: '1주', en: '1 week' },
  { value: '2w', ko: '2주', en: '2 weeks' },
  { value: '1m', ko: '1달', en: '1 month' },
];

const MAX_LEAN = 140;

export function BindCard({
  onProceed,
  problem,
  initialLean,
  initialInterval,
  notice,
}: {
  /** null = full skip (no rope, write nothing). A BindResult = tie the rope. */
  onProceed: (bind: BindResult | null) => void;
  /** The problem the user just submitted — shown small, for orientation only. */
  problem?: string;
  /** Restore a previously-typed rope (P0-5: a quota/error after binding must not
   *  silently discard the user's words — re-show the card with them intact). */
  initialLean?: string;
  initialInterval?: CheckInInterval | null;
  /** A banner above the form — e.g. "log in to hear the crew; your note is kept". */
  notice?: string;
}) {
  const locale = useLocale();
  const ko = locale === 'ko';
  const L = (k: string, e: string) => (ko ? k : e);

  const [lean, setLean] = useState(initialLean ?? '');
  const [interval, setInterval] = useState<CheckInInterval | null>(initialInterval ?? null);
  const [customDate, setCustomDate] = useState(''); // P1-4: a specific picked date (yyyy-mm-dd)

  const trimmed = lean.trim();
  const hasCommitment = trimmed.length > 0 || interval !== null || customDate !== '';

  const tie = () => onProceed(hasCommitment
    ? { lean: trimmed || undefined, interval: customDate ? undefined : (interval ?? undefined), check_in_at: customDate ? new Date(customDate).toISOString() : undefined }
    : null);
  const skip = () => onProceed(null);

  // Resolve a relative interval to a concrete date so "2주" reads as "2주 · 7월 8일".
  const dateLabel = (iv: CheckInInterval) => {
    const MS = { '1w': 7, '2w': 14, '1m': 30 }[iv] * 86_400_000;
    const d = new Date(Date.now() + MS);
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
        <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-[var(--text-tertiary)] mb-2">
          {L('출항 전 · 밧줄 묶기', 'Before you sail · tie the rope')}
        </p>
        {notice && (
          <p className="mb-3 px-3 py-2 rounded-lg bg-[var(--accent)]/10 border border-[var(--accent)]/20 text-[12px] text-[var(--text-primary)] leading-snug">
            {notice}
          </p>
        )}
        <h2 className="text-[19px] font-bold leading-snug text-[var(--text-primary)]" style={{ fontFamily: 'var(--font-display)' }}>
          {L('답을 듣기 전에 — 지금 마음은 어디로 기울어요?', 'Before you hear the answer — where are you leaning right now?')}
        </h2>
        {/* P1: the WHY (cluster 4) — the rope metaphor needs its payload, or a
            skeptic reads "why ask me, you're the tool" and skips, defeating the phase. */}
        <p className="text-[12.5px] text-[var(--text-tertiary)] mt-1.5 leading-snug">
          {L('답을 먼저 들으면 원래 생각이 흐려져요. 그 전에 한 줄만 남겨두면, 나중에 그게 진짜 내 판단이었는지 같이 맞춰볼 수 있어요. (안 적어도 됩니다.)',
             "Hearing the answer first blurs your own read. Leave one line before it, and later we can check whether your call actually held. (Optional.)")}
        </p>

        {problem && (
          <p className="mt-3 text-[12px] text-[var(--text-secondary)] line-clamp-2 border-l-2 border-[var(--border-subtle)] pl-2.5">
            {problem}
          </p>
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
            Each chip shows its resolved date; "직접" opens a date picker for a known day. */}
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
        {/* P0-4b: a lean with no date never auto-resurfaces — nudge a date so the
            rope actually comes back on its own. */}
        {trimmed.length > 0 && interval === null && !customDate && (
          <p className="mt-2 text-[11.5px] text-[var(--accent)]/90 leading-snug">
            {L('확인일을 고르면 그날 이 한 줄을 다시 물어볼게요.', "Pick a date and I'll bring this line back to you that day.")}
          </p>
        )}

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
            {L('묶고 계속', 'Tie it & continue')}
            <ArrowRight size={15} />
          </button>
        </div>

        {/* Reassure that skipping is safe and the analysis isn't lost — the AI is
            already reading in the background (cluster 4: the buffered run is invisible,
            so the screen can feel like a gate of unknown cost). */}
        <p className="mt-3 text-[11px] text-[var(--text-tertiary)]/80 text-center">
          {L('AI 팀은 이미 이 건을 읽고 있어요 — 어느 쪽이든 다음 화면에서 보여드려요.',
             "The crew is already reading this — either way, you'll see it on the next screen.")}
        </p>
      </div>
    </motion.div>
  );
}
