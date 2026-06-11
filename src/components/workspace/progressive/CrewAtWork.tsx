'use client';

/**
 * CrewAtWork — 팀 작업 극장 (W1.6 ⑥, founder: "진행 막대 수준").
 *
 * While the auto-deployed crew works, the user should SEE work happening —
 * not a progress bar. Each card shows who's on what, and the live tail of
 * their actual stream while running (real typing, the honest theater), then
 * their completion line when done. Read-only: approval is automatic in focus
 * mode; the full report stepper stays one tap away ("열어보기").
 *
 * All text renders through JSX → auto-escaped.
 */

import { motion } from 'framer-motion';
import { Check, AlertTriangle } from 'lucide-react';
import { useLocale } from '@/hooks/useLocale';
import type { WorkerTask } from '@/stores/types';

/** Last visible chunk of the live stream — the "typing" effect, cheap. */
function streamTail(text: string, max = 90): string {
  const t = text.replace(/\s+/g, ' ').trim();
  return t.length <= max ? t : '…' + t.slice(-max);
}

/** First line of the finished work — the takeaway, not the document. */
function firstLine(w: WorkerTask): string {
  const src = w.completion_note || w.result || '';
  const line = src.replace(/^#+\s*/, '').split('\n').find((l) => l.trim().length > 0) || '';
  return line.length > 110 ? line.slice(0, 110) + '…' : line;
}

export function CrewAtWork({ workers }: { workers: WorkerTask[] }) {
  const locale = useLocale();
  const L = (ko: string, en: string) => (locale === 'ko' ? ko : en);
  if (workers.length === 0) return null;

  const ordered = [...workers].sort((a, b) => a.step_index - b.step_index);
  const doneCount = ordered.filter((w) => w.status === 'done').length;
  const allDone = ordered.every((w) => w.status === 'done' || w.status === 'error');

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] p-4 space-y-2.5"
    >
      <p className="text-[12.5px] font-semibold text-[var(--text-primary)]">
        {allDone
          ? L(`선원 ${doneCount}명의 작업이 끝났어요 — 전부 초안에 들어갑니다`, `${doneCount} crew finished — everything flows into the draft`)
          : L('선원들이 일하고 있어요', 'The crew is at work')}
      </p>

      <div className="space-y-1.5">
        {ordered.map((w) => {
          const name = (locale === 'en' ? w.persona?.nameEn : w.persona?.name) || w.persona?.name || L('선원', 'Crew');
          const emoji = w.persona?.emoji || '⚓';
          const running = w.status === 'running' || w.status === 'ai_preparing';
          return (
            <div key={w.id} className="flex items-start gap-2.5 rounded-xl bg-[var(--bg)] border border-[var(--border-subtle)] px-3 py-2.5">
              <span className="text-[15px] shrink-0 leading-none mt-0.5" aria-hidden>{emoji}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2">
                  <span className="text-[12px] font-semibold text-[var(--text-primary)]">{name}</span>
                  <span className="text-[11px] text-[var(--text-tertiary)] truncate">{w.task}</span>
                </div>
                {/* The theater: live stream tail while running; takeaway when done. */}
                {running && w.stream_text ? (
                  <p className="text-[11.5px] text-[var(--text-secondary)] mt-1 leading-[1.5] font-mono truncate">
                    {streamTail(w.stream_text)}
                    <span className="inline-block w-[6px] h-[12px] ml-0.5 align-text-bottom bg-[var(--accent)]/70 animate-pulse" />
                  </p>
                ) : w.status === 'done' && firstLine(w) ? (
                  <p className="text-[11.5px] text-[var(--text-secondary)] mt-1 leading-[1.5] line-clamp-2">{firstLine(w)}</p>
                ) : null}
              </div>
              <span className="shrink-0 mt-0.5">
                {w.status === 'done' ? (
                  <Check size={13} className="text-[var(--success)]" strokeWidth={2.5} />
                ) : w.status === 'error' ? (
                  <AlertTriangle size={13} className="text-amber-500" />
                ) : running ? (
                  <span className="inline-block w-2 h-2 rounded-full bg-[var(--accent)] animate-pulse mt-1" />
                ) : (
                  <span className="text-[10px] text-[var(--text-tertiary)]">{L('대기', 'queued')}</span>
                )}
              </span>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}
