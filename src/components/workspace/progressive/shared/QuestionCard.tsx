'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { EASE } from './constants';

interface QuestionCardProps {
  question: { id?: string; text: string; subtext?: string; options?: string[] };
  onAnswer: (value: string) => void;
  disabled?: boolean;
  allowFreeText?: boolean;
  locale?: 'ko' | 'en';
  /** Small label above the question (e.g. "2번째 질문 · 선택") — gives the user
   *  a sense of progress so the Q&A doesn't feel open-ended. */
  meta?: string;
  /** When provided, renders a tertiary skip action with `skipLabel`. */
  onSkip?: () => void;
  skipLabel?: string;
  /** Seed the free-text box — used to restore a draft after an error remount so a
   *  typed answer isn't lost when the turn fails and the card re-renders. */
  initialValue?: string;
  /** Report the current free-text draft up so the parent can preserve it across
   *  an error/rollback remount. */
  onDraftChange?: (value: string) => void;
}

export function QuestionCard({
  question,
  onAnswer,
  disabled = false,
  allowFreeText = true,
  locale = 'ko',
  meta,
  onSkip,
  skipLabel,
  initialValue,
  onDraftChange,
}: QuestionCardProps) {
  const L = (ko: string, en: string) => locale === 'ko' ? ko : en;
  const [input, setInput] = useState(initialValue ?? '');
  const [submitted, setSubmitted] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const updateInput = (v: string) => { setInput(v); onDraftChange?.(v); };

  const go = (v: string) => {
    if (disabled || submitted) return;
    setSelected(v);
    setSubmitted(true);
    setTimeout(() => onAnswer(v), 300);
  };
  const goText = () => {
    if (!input.trim() || disabled || submitted) return;
    setSubmitted(true);
    onAnswer(input.trim());
  };

  // 2x2 grid if all options are short, otherwise stacked. Mobile always stacks —
  // two 19-char Korean options side-by-side wrap to 3–4 lines and lose scannability.
  const options = question.options || [];
  const useGrid = options.length > 0 && options.every(o => o.length < 20);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12, scale: 0.99 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.5, ease: EASE }}
      // The ONE elevated card on the screen — the thing to act on. A real
      // surface + soft shadow lifts it above the flat margin-notes around it
      // (course / premise / crew), so the eye lands on the question to answer.
      className="rounded-xl bg-[var(--surface)] border border-[var(--accent)]/20 p-5 md:p-6 shadow-[var(--shadow-sm)]">
      {/* Question */}
      <div className="flex items-start gap-2.5 mb-4">
        <div className="w-6 h-6 rounded-full bg-[var(--accent)]/10 flex items-center justify-center shrink-0 mt-0.5">
          <ArrowRight size={11} className="text-[var(--accent)]" />
        </div>
        <div>
          {meta && (
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--accent)]/70 mb-1">{meta}</p>
          )}
          <p className="text-[17px] md:text-[19px] font-semibold text-[var(--text-primary)] leading-[1.4] tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>
            {question.text}
          </p>
          {question.subtext && (
            <p className="mt-2 text-[13px] text-[var(--text-secondary)] leading-relaxed">{question.subtext}</p>
          )}
        </div>
      </div>

      {/* Options */}
      {options.length > 0 ? (
        <div className="pl-8.5">
          <div className={useGrid ? 'grid grid-cols-1 sm:grid-cols-2 gap-2' : 'space-y-1.5'}>
            {options.map((opt, i) => (
              <motion.button
                key={i}
                onClick={() => go(opt)}
                disabled={disabled || submitted}
                whileTap={{ scale: 0.97 }}
                className={`w-full text-left px-4 py-3 min-h-[44px] md:min-h-0 rounded-xl text-[13px] leading-snug border cursor-pointer ${
                  selected === opt
                    ? 'border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--text-primary)] font-semibold shadow-sm'
                    : submitted
                      ? 'border-[var(--border-subtle)] text-[var(--text-tertiary)] opacity-20 scale-[0.98]'
                      : 'border-[var(--border-subtle)] bg-[var(--surface)] text-[var(--text-primary)] hover:border-[var(--accent)]/40 hover:bg-[var(--accent)]/[0.03]'
                }`}
                style={{
                  transitionProperty: 'all',
                  transitionDuration: '350ms',
                  transitionTimingFunction: 'cubic-bezier(0.32,0.72,0,1)',
                }}>
                {opt}
              </motion.button>
            ))}
          </div>

          {/* Free text input below options — workspace only */}
          {allowFreeText && (
            <div className="flex gap-2 mt-2">
              <input
                value={input}
                onChange={e => updateInput(e.target.value)}
                placeholder={L('또는 직접 입력...', 'Or type your own...')}
                disabled={disabled || submitted}
                className="flex-1 px-3.5 py-2.5 md:py-2 min-h-[44px] md:min-h-0 rounded-xl bg-[var(--surface)] border border-[var(--border-subtle)] text-base md:text-[12px] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:border-[var(--accent)]/30 disabled:opacity-30"
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); goText(); } }}
              />
              {input.trim() && (
                <motion.button
                  onClick={goText}
                  disabled={disabled || submitted}
                  whileTap={{ scale: 0.95 }}
                  className="shrink-0 px-4 py-2.5 md:py-2 min-h-[44px] md:min-h-0 text-white rounded-xl text-[12px] font-semibold cursor-pointer disabled:opacity-30"
                  style={{ background: 'var(--gradient-gold)' }}>
                  {L('확인', 'OK')}
                </motion.button>
              )}
            </div>
          )}
        </div>
      ) : (
        /* No options — free text only */
        <div className="flex gap-2 pl-8.5">
          <input
            value={input}
            onChange={e => updateInput(e.target.value)}
            placeholder={L('입력...', 'Type here...')}
            autoFocus
            disabled={disabled || submitted}
            className="flex-1 px-3.5 py-2.5 min-h-[44px] md:min-h-0 rounded-xl bg-[var(--surface)] border border-[var(--border-subtle)] text-base md:text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:border-[var(--accent)]/30 disabled:opacity-30"
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); goText(); } }}
          />
          <motion.button
            onClick={goText}
            disabled={disabled || !input.trim() || submitted}
            whileTap={{ scale: 0.95 }}
            className="shrink-0 px-5 py-2.5 min-h-[44px] md:min-h-0 text-white rounded-xl text-[13px] font-semibold shadow-[var(--shadow-sm)] cursor-pointer disabled:opacity-30"
            style={{ background: 'var(--gradient-gold)' }}>
            {L('확인', 'OK')}
          </motion.button>
        </div>
      )}

      {/* Optional skip — only when the parent says this question isn't required
          (e.g. the crew is already assembled). Gives a concrete way out so the
          user never feels trapped answering. */}
      {onSkip && !submitted && (
        <div className="pl-8.5 mt-3">
          {/* A visible chip, not a buried footer link — the user must always
              SEE the way out of the question loop (G-W1 #1: "끊는 곳이 없다").
              NOTE: skip must NOT set `submitted` — the parent may bounce back
              to this same card (e.g. the verification gate gets closed without
              approving), and a locally-locked card would strand the user with
              every option disabled and the escape chip gone. The card unmounts
              on a real transition anyway; `disabled` covers the busy window. */}
          <button
            onClick={() => { if (!disabled) onSkip(); }}
            disabled={disabled}
            className="inline-flex items-center gap-1.5 px-3 py-2.5 md:py-1.5 min-h-[44px] md:min-h-0 rounded-lg border border-[var(--border)] text-[12px] font-medium text-[var(--text-secondary)] hover:border-[var(--accent)]/50 hover:text-[var(--accent)] cursor-pointer transition-colors disabled:opacity-40">
            {skipLabel || L('건너뛰기', 'Skip')} <ArrowRight size={11} />
          </button>
        </div>
      )}
    </motion.div>
  );
}
