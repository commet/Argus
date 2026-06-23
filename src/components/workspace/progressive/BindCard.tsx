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

  const trimmed = lean.trim();
  const hasCommitment = trimmed.length > 0 || interval !== null;

  const tie = () => onProceed(hasCommitment ? { lean: trimmed || undefined, interval: interval ?? undefined } : null);
  const skip = () => onProceed(null);

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
        <p className="text-[12.5px] text-[var(--text-tertiary)] mt-1.5 leading-snug">
          {L('안 적어도 됩니다. 적어두면 나중에 “그래서 어떻게 됐는지” 같이 맞춰봐요.',
             "Optional. If you jot it down, we'll check back later on how it actually went.")}
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

        {/* Check-in window — none preselected; an untapped default is never a commitment. */}
        <div className="mt-3 flex items-center gap-2">
          <span className="text-[12px] text-[var(--text-tertiary)]">{L('확인일:', 'Check back:')}</span>
          {INTERVALS.map((iv) => (
            <button
              key={iv.value}
              type="button"
              onClick={() => setInterval(interval === iv.value ? null : iv.value)}
              className={`rounded-full border px-3 py-1 text-[12.5px] transition-colors ${
                interval === iv.value
                  ? 'border-[var(--primary)] bg-[var(--primary)] text-[var(--bg)]'
                  : 'border-[var(--border-subtle)] text-[var(--text-secondary)] hover:border-[var(--text-tertiary)]'
              }`}
            >
              {ko ? iv.ko : iv.en}
            </button>
          ))}
        </div>
        {/* P0-4b: a lean with no date never auto-resurfaces — nudge a date so the
            rope actually comes back on its own. */}
        {trimmed.length > 0 && interval === null && (
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
      </div>
    </motion.div>
  );
}
