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

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Check, AlertTriangle, RefreshCw, ChevronDown } from 'lucide-react';
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

export function CrewAtWork({ workers, onRetry, reportsOpen, onToggleReports }: {
  workers: WorkerTask[];
  onRetry?: (workerId: string) => void;
  /** When provided, the headline carries the report-stepper toggle as a tail
   *  link — the standalone "선원 보고 N건 — 자동 반영됐어요" line below this
   *  card said the same thing twice (compression audit, worst-duplicate #2). */
  reportsOpen?: boolean;
  onToggleReports?: () => void;
}) {
  const locale = useLocale();
  const L = (ko: string, en: string) => (locale === 'ko' ? ko : en);
  // Collapsed by default (④ 보조): the crew works in the background while the
  // user answers the question above. The header keeps the live "team working"
  // signal (avatars + count); the full theater opens on tap.
  const [open, setOpen] = useState(false);
  if (workers.length === 0) return null;

  const ordered = [...workers].sort((a, b) => a.step_index - b.step_index);
  const doneCount = ordered.filter((w) => w.status === 'done').length;
  const errorCount = ordered.filter((w) => w.status === 'error').length;
  const allDone = ordered.every((w) => w.status === 'done' || w.status === 'error');

  // Honest headline: a failed crew member's share does NOT flow into the
  // draft — "전부 초안에 들어갑니다" over a failure would be failure≠silence
  // in miniature.
  const headline = !allDone
    ? L('선원들이 일하고 있어요', 'The crew is at work')
    : errorCount === 0
      ? L(`선원 ${doneCount}명의 작업이 끝났어요 — 전부 초안에 들어갑니다`, `${doneCount} crew finished — everything flows into the draft`)
      : L(
          `선원 ${ordered.length}명 중 ${doneCount}명 완료 · ${errorCount}명은 닿지 않았어요 — 실패한 몫은 빼고 갑니다`,
          `${doneCount} of ${ordered.length} finished · ${errorCount} didn't land — the draft goes on without that share`,
        );

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      // ④ 보조 — not a card. The crew is background work while the user answers,
      // so it sits on a hairline rule, collapsed; the full theater (with its own
      // surfaces) only appears on expand.
      className="border-t border-[var(--border-subtle)]/50 pt-3"
    >
      {/* Header — tap to expand the full theater. Avatars + a live count keep the
          "team is working" signal without the whole crew list taking over the
          screen while the user is answering above. */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="w-full flex items-center justify-between gap-3 text-left cursor-pointer"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="flex -space-x-1 shrink-0">
            {ordered.slice(0, 5).map((w, i) => (
              <span
                key={w.id}
                className="w-5 h-5 rounded-full bg-[var(--bg)] border border-[var(--surface)] flex items-center justify-center text-[10px] leading-none"
                style={{ zIndex: 5 - i }}
                aria-hidden
              >
                {w.persona?.emoji || '⚓'}
              </span>
            ))}
          </div>
          <p className="text-[12.5px] font-semibold text-[var(--text-primary)] truncate">{headline}</p>
        </div>
        <span className="shrink-0 flex items-center gap-1.5 text-[11px] text-[var(--text-tertiary)]">
          {!allDone && <span className="inline-block w-1.5 h-1.5 rounded-full bg-[var(--accent)] animate-pulse" aria-hidden />}
          <span className="tabular-nums">{doneCount}/{ordered.length}</span>
          <ChevronDown size={13} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
        </span>
      </button>

      {!open ? null : (
      <div className="mt-3 space-y-2.5">
      {/* Report stepper toggle (when finished) */}
      {onToggleReports && allDone && (doneCount > 0 || errorCount > 0) && (
        <button
          onClick={onToggleReports}
          className="text-[11.5px] font-medium text-[var(--text-tertiary)] hover:text-[var(--accent)] cursor-pointer transition-colors"
        >
          {reportsOpen ? L('보고 접기 ▴', 'Hide reports ▴') : L('선원 보고 열어보기 ▾', 'Open crew reports ▾')}
        </button>
      )}
      {/* First-use definition — a novice meets "선원" cold here. One line, once:
          they're AI teammates, and the brief stays inside the analysis. */}
      <p className="text-[11px] text-[var(--text-tertiary)]">
        {L('선원은 이 건을 각자 따로 검토하는 AI 팀원이에요 — 입력하신 내용은 분석에만 쓰여요.', 'Crew members are AI teammates each reviewing this separately — your input is used for analysis only.')}
      </p>

      <div className="space-y-1.5">
        {ordered.map((w, i) => {
          const name = (locale === 'en' ? w.persona?.nameEn : w.persona?.name) || w.persona?.name || L('선원', 'Crew');
          const emoji = w.persona?.emoji || '⚓';
          const running = w.status === 'running' || w.status === 'ai_preparing';
          return (
            <motion.div
              key={w.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.12, duration: 0.35 }}
              className="flex items-start gap-2.5 rounded-xl bg-[var(--bg)] border border-[var(--border-subtle)] px-3 py-2.5"
            >
              <span className="text-[15px] shrink-0 leading-none mt-0.5" aria-hidden>{emoji}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2">
                  <span className="text-[12px] font-semibold text-[var(--text-primary)]">{name}</span>
                  <span className="text-[11px] text-[var(--text-tertiary)] truncate">{w.task}</span>
                </div>
                {/* The theater: live stream tail while running; takeaway when done;
                    an honest line + inline retry when the work didn't land. */}
                {running && w.stream_text ? (
                  <p className="text-[11.5px] text-[var(--text-secondary)] mt-1 leading-[1.5] font-mono truncate">
                    {streamTail(w.stream_text)}
                    <span className="inline-block w-[6px] h-[12px] ml-0.5 align-text-bottom bg-[var(--accent)]/70 animate-pulse" />
                  </p>
                ) : w.status === 'done' && firstLine(w) ? (
                  <p className="text-[11.5px] text-[var(--text-secondary)] mt-1 leading-[1.5] line-clamp-2">{firstLine(w)}</p>
                ) : w.status === 'error' ? (
                  <p className="text-[11.5px] text-[var(--text-tertiary)] mt-1 leading-[1.5]">
                    {L('이 선원의 작업이 닿지 않았어요.', "This crew member's work didn't land.")}
                    {onRetry && (
                      <button
                        onClick={() => onRetry(w.id)}
                        className="ml-2 inline-flex items-center gap-1 text-[var(--accent)] font-medium hover:underline cursor-pointer"
                      >
                        <RefreshCw size={10} /> {L('다시 시도', 'Retry')}
                      </button>
                    )}
                  </p>
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
            </motion.div>
          );
        })}
      </div>
      </div>
      )}
    </motion.div>
  );
}
