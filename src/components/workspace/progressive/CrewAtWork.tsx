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
  // Per-worker report expansion — a single-open accordion (efficient: one report
  // in view at a time, not a wall of text). A DONE row's 2-line takeaway is the
  // peek; tapping opens that worker's full result inline. This is the "눌러도
  // 정보가 안 보인다" fix — progressive disclosure, no separate stepper hunt.
  const [expandedId, setExpandedId] = useState<string | null>(null);
  if (workers.length === 0) return null;

  const ordered = [...workers].sort((a, b) => a.step_index - b.step_index);
  const doneCount = ordered.filter((w) => w.status === 'done').length;
  const errorCount = ordered.filter((w) => w.status === 'error').length;
  // Terminal set MUST match `crewSettled` in ProgressiveFlow — otherwise a crew
  // with no AI work (all 'waiting_input') or a user-actionable failure keeps this
  // header saying "일하고 있어요" forever while the flow has already moved on.
  // That mismatch is the "선원 0/N 영구 고정" bug. A human worker out for an
  // external reply ('sent'/'waiting_response') is settled for this AI header too.
  const isTerminal = (w: (typeof ordered)[number]) =>
    w.status === 'done' || w.status === 'error' || w.status === 'waiting_input' || w.status === 'validation_failed' ||
    w.status === 'blocked' ||
    (w.agent_type === 'human' && (w.status === 'sent' || w.status === 'waiting_response'));
  const allDone = ordered.every(isTerminal);

  // Honest headline: a failed crew member's share does NOT flow into the
  // draft — "전부 초안에 들어갑니다" over a failure would be failure≠silence
  // in miniature. And when no AI actually produced anything (doneCount 0), don't
  // claim crew output flowed in — this is a human-judgment item.
  const headline = !allDone
    ? L('선원들이 일하고 있어요', 'The crew is at work')
    : doneCount === 0
      ? L('이 건은 사람이 판단할 항목이에요 — AI가 대신 정하지 않아요', "This one is yours to judge — AI doesn't decide it for you")
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
      // ④ 보조 — no line, no box. Background work while the user answers; set off
      // by spacing alone, collapsed. The full theater (its own surfaces) only
      // appears on expand.
      className="pt-1"
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
          {/* Learn-more cue so the row reads as "tap to understand", not passive status. */}
          {!open && <span className="text-[var(--accent)]">{L('이게 뭐예요?', 'What is this?')}</span>}
          <ChevronDown size={13} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
        </span>
      </button>

      {/* Always-visible orienting line (NOT gated by expand): a novice meets the
          crew cold, so state what/why + the honest boundary in ONE tertiary line
          at first contact — the definition used to be trapped inside the collapsed
          panel. One line only, to respect the ④보조 / "진행 막대 수준" constraint. */}
      <p className="mt-2 text-[11px] text-[var(--text-tertiary)] leading-[1.5]">
        {L('AI 팀원들이 이 결정을 각자 다른 눈으로 대신 살펴봐요 · 판단은 당신 몫이에요.', 'A team of AI reviewers is looking at this from different angles — the call stays yours.')}
      </p>

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
      {/* Privacy recap only — the always-visible orienting line above now teaches
          what/why at first contact, so this in-panel line keeps just the privacy
          reassurance (no longer teaching the same thing twice). */}
      <p className="text-[11px] text-[var(--text-tertiary)]">
        {L('입력하신 내용은 이 분석에만 쓰여요.', 'What you typed is used only for this analysis.')}
      </p>

      <div className="space-y-1.5">
        {ordered.map((w, i) => {
          const name = (locale === 'en' ? w.persona?.nameEn : w.persona?.name) || w.persona?.name || L('선원', 'Crew');
          const emoji = w.persona?.emoji || '⚓';
          const running = w.status === 'running' || w.status === 'ai_preparing';
          // Purpose-first: shade AI vs human by MEANING (verb phrase), not just
          // emoji — surfaces the split in focus mode. Derive agent_type the same
          // way deployWorkers does so legacy 'who'-only sessions still resolve.
          const at = w.agent_type || (w.who === 'both' ? 'ai' : w.who === 'human' ? 'self' : 'ai');
          const purpose = at === 'ai'
            ? L('AI가 대신 봐요', 'Handled by AI')
            : at === 'self'
              ? L('이건 당신이 정해요', "Yours to decide")
              : L('사람에게 물어봐요', 'Asking a person');
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
                {/* Purpose lead-in — what this crew member is FOR (routing is real
                    even without the scope wiring). Honest provenance: AI is the
                    subject of AI-authored work; the human half names ownership. */}
                <p className="text-[11px] text-[var(--accent)]/85 mt-0.5">{purpose}</p>
                {/* The human-judgment boundary the user owns — describes what they
                    were asked to decide (true regardless of AI internals). Never
                    truncated: the "you decide" half is load-bearing. */}
                {at === 'self' && w.self_scope && (
                  <p className="text-[11px] text-[var(--text-secondary)] mt-0.5 leading-[1.5]">
                    {L('당신이 정해요', 'You decide')}: {w.self_scope}
                  </p>
                )}
                {/* Why THIS lens was assigned (router rationale) — quiet, guarded;
                    absent → render nothing (never fabricate). */}
                {at === 'ai' && w.assignment_reason && (
                  <p className="text-[11px] text-[var(--text-tertiary)] mt-0.5 leading-[1.5]">↳ {w.assignment_reason}</p>
                )}
                {/* The theater: live stream tail while running; takeaway when done;
                    an honest line + inline retry when the work didn't land. */}
                {running && w.stream_text ? (
                  <p className="text-[11.5px] text-[var(--text-secondary)] mt-1 leading-[1.5] font-mono truncate">
                    {streamTail(w.stream_text)}
                    <span className="inline-block w-[6px] h-[12px] ml-0.5 align-text-bottom bg-[var(--accent)]/70 animate-pulse" />
                  </p>
                ) : w.status === 'done' && firstLine(w) ? (() => {
                  const full = (w.result || w.completion_note || '').trim();
                  const isOpen = expandedId === w.id;
                  // Offer expansion only when the full report is substantially longer
                  // than the ~2-line peek. A fixed threshold (not a cross-source length
                  // subtraction) avoids misfiring when the peek and full come from
                  // different fields (completion_note-first vs result-first).
                  const hasMore = full.length > 160;
                  // Toggle control and the full report are SEPARATE — reading/scrolling
                  // the open report must not collapse it (which a text-inside-button
                  // accordion would do on any tap).
                  return (
                    <div className="mt-1">
                      {isOpen ? (
                        <>
                          <p className="text-[11.5px] text-[var(--text-secondary)] leading-[1.6] whitespace-pre-wrap max-h-[240px] overflow-y-auto pr-1">{full}</p>
                          <button
                            type="button"
                            onClick={() => setExpandedId(null)}
                            className="mt-1 inline-flex items-center gap-0.5 text-[10.5px] font-medium text-[var(--text-tertiary)] hover:text-[var(--accent)] transition-colors cursor-pointer"
                          >
                            {L('접기', 'Collapse')} <ChevronDown size={11} className="rotate-180" />
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={hasMore ? () => setExpandedId(w.id) : undefined}
                          className={`w-full text-left group/rep ${hasMore ? 'cursor-pointer' : 'cursor-default'}`}
                        >
                          <p className="text-[11.5px] text-[var(--text-secondary)] leading-[1.5] line-clamp-2">{firstLine(w)}</p>
                          {hasMore && (
                            <span className="mt-0.5 inline-flex items-center gap-0.5 text-[10.5px] font-medium text-[var(--text-tertiary)] group-hover/rep:text-[var(--accent)] transition-colors">
                              {L('열어보기', 'Open report')} <ChevronDown size={11} />
                            </span>
                          )}
                        </button>
                      )}
                    </div>
                  );
                })() : (w.status === 'error' || w.status === 'validation_failed') ? (
                  <p className="text-[11.5px] text-[var(--text-tertiary)] mt-1 leading-[1.5]">
                    {w.status === 'validation_failed'
                      ? L('이 선원의 결과가 확인을 통과하지 못했어요.', "This crew member's result didn't pass the check.")
                      : L('이 선원의 작업이 닿지 않았어요.', "This crew member's work didn't land.")}
                    {onRetry && (
                      <button
                        onClick={() => onRetry(w.id)}
                        className="ml-2 inline-flex items-center gap-1 text-[var(--accent)] font-medium hover:underline cursor-pointer"
                      >
                        <RefreshCw size={10} /> {L('다시 시도', 'Retry')}
                      </button>
                    )}
                  </p>
                ) : w.status === 'blocked' ? (
                  // Layer 0: honest "waiting on a human input" — NOT fabricated output.
                  <p className="text-[11.5px] text-[var(--text-secondary)] mt-1 leading-[1.5]">
                    {(w.blocked_on && w.blocked_on.length > 0)
                      ? L(`입력 대기: ${w.blocked_on.join(', ')} — 그 답이 있어야 이 부분을 지어내지 않고 채울 수 있어요.`,
                          `Waiting on: ${w.blocked_on.join(', ')} — that answer is needed so this part isn't made up.`)
                      : L('입력을 기다리는 중이에요.', 'Waiting on an input.')}
                  </p>
                ) : null}
              </div>
              <span className="shrink-0 mt-0.5">
                {w.status === 'done' ? (
                  <Check size={13} className="text-[var(--success)]" strokeWidth={2.5} />
                ) : (w.status === 'error' || w.status === 'validation_failed') ? (
                  <AlertTriangle size={13} className="text-amber-500" />
                ) : w.status === 'blocked' ? (
                  <span className="text-[10px] text-[var(--text-tertiary)]">{L('대기', 'waiting')}</span>
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
