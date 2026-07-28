'use client';

/**
 * CheckpointReturnCard — the 30-second "판단 체크포인트" return
 * (DESIGN-judgment-checkpoints-v2 §7). The focused, primary-checkpoint face of
 * settlement: one card, four taps, the original judgment shown verbatim first
 * (W4 — creation is banned). It grades the ONE primary predicate; the 4-tap →
 * verdict mapping is deterministic (verdictFromTap keyed on the checkpoint's
 * expectation), and "아직 판단하기 어렵다" is a first-class path, not a dead end.
 *
 * Spine: no verdict about the user, every string a neutral observation, the
 * unclear path never demands an answer (§7.3). Surface language 해요체, no
 * 채점/predicate vocabulary.
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Anchor } from 'lucide-react';
import type { PrimaryCheckpoint, PredicateVerdict, AmbiguityRecord } from '@/stores/types';
import { verdictFromTap, tapFromVerdict, type ReturnTap } from '@/lib/checkpoint-core';

const TAPS: { value: ReturnTap; ko: string; en: string }[] = [
  { value: 'mostly_right', ko: '대체로 맞았다', en: 'Mostly right' },
  { value: 'missed', ko: '빗나갔다', en: 'Missed' },
  { value: 'mixed', ko: '섞여 있었다', en: 'Mixed' },
  { value: 'unclear', ko: '아직 판단하기 어렵다', en: 'Too early to tell' },
];

const REASONS: { value: AmbiguityRecord['reason']; ko: string; en: string }[] = [
  { value: 'insufficient_data', ko: '자료가 아직 부족해요', en: 'Not enough data yet' },
  { value: 'mixed_signals', ko: '신호가 섞여 있어요', en: 'Signals are mixed' },
  { value: 'low_confidence_interpretation', ko: '해석이 애매해요', en: 'Hard to read yet' },
  { value: 'changed_context', ko: '상황이 바뀌었어요', en: 'The context changed' },
];

export function CheckpointReturnCard({
  checkpoint,
  currentVerdict,
  ambiguityReason,
  onTap,
  onUnclear,
  locale,
}: {
  checkpoint: PrimaryCheckpoint;
  /** The primary predicate's current verdict, if already graded. */
  currentVerdict?: PredicateVerdict;
  /** The recorded ambiguity reason, if the user previously chose unclear. */
  ambiguityReason?: AmbiguityRecord['reason'];
  /** Commit a resolved tap → verdict (mostly_right / missed / mixed). */
  onTap: (verdict: PredicateVerdict) => void;
  /** The unclear path: record the reason + defer via a lighter next handle. */
  onUnclear: (reason: AmbiguityRecord['reason']) => void;
  locale: 'ko' | 'en';
}) {
  const ko = locale === 'ko';
  const L = (k: string, e: string) => (ko ? k : e);
  const expectation = checkpoint.expectation ?? 'occur';
  const userOwned = checkpoint.authorship === 'user_authored' || checkpoint.authorship === 'user_edited';

  // Which tap is currently reflected by the stored verdict (for the selected ring).
  const selectedTap: ReturnTap | null =
    currentVerdict && currentVerdict !== 'pending' ? tapFromVerdict(currentVerdict, expectation) : null;
  const [showReasons, setShowReasons] = useState(selectedTap === 'unclear');

  function handleTap(tap: ReturnTap) {
    if (tap === 'unclear') {
      setShowReasons((v) => !v);
      return;
    }
    setShowReasons(false);
    onTap(verdictFromTap(tap, expectation));
  }

  return (
    <div className="rounded-xl border border-[var(--accent)]/30 bg-[var(--surface)] p-3 sm:p-3.5">
      <div className="flex items-center gap-1.5 mb-2">
        <Anchor size={13} className="text-[var(--accent)]" />
        <span className="text-[12.5px] font-bold uppercase tracking-wide text-[var(--accent)]">
          {L('판단 체크포인트', 'Judgment checkpoint')}
        </span>
      </div>

      {/* Do not transfer authorship merely because the user kept an AI draft. */}
      <p className="text-[12.5px] font-semibold text-[var(--text-tertiary)]">
        {userOwned
          ? L('그때 내가 확정한 판단', 'The judgment you chose')
          : L('Argus가 함께 확인하자고 제안한 항목', 'A check Argus suggested')}
      </p>
      <p className="text-[13.5px] text-[var(--text-primary)] leading-[1.5] mt-0.5">{checkpoint.check_prompt}</p>

      {checkpoint.expected_signal && (
        <>
          <p className="text-[12.5px] font-semibold text-[var(--text-tertiary)] mt-2.5">{L('다시 볼 기준', 'What to look for')}</p>
          <p className="text-[12.5px] text-[var(--text-secondary)] leading-[1.5] mt-0.5">{checkpoint.expected_signal}</p>
        </>
      )}

      <p className="text-[12px] text-[var(--text-secondary)] mt-3 mb-1.5">
        {userOwned
          ? L('현실과 대조해 보면 어땠나요?', 'How did it hold up against reality?')
          : L('지금 확인해 보면 이 전제는 어땠나요?', 'What happened to this assumption?')}
      </p>
      <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:gap-1.5">
        {TAPS.map((t) => {
          const selected = t.value === 'unclear' ? showReasons || selectedTap === 'unclear' : selectedTap === t.value;
          return (
            <button
              type="button"
              key={t.value}
              onClick={() => handleTap(t.value)}
              aria-pressed={selected}
              className={`min-h-11 px-2.5 py-1.5 rounded-lg text-[12px] font-semibold border transition-colors cursor-pointer ${
                selected
                  ? 'border-[var(--accent)] bg-[var(--accent)] text-white'
                  : 'border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--accent)]/40'
              }`}
            >
              {L(t.ko, t.en)}
            </button>
          );
        })}
      </div>

      {/* Unclear → one reason tap, then a light close (§7.3). Never a penalty. */}
      <AnimatePresence>
        {showReasons && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="pt-3">
              <p className="text-[13px] text-[var(--text-secondary)] mb-1.5">
                {L('무엇이 아직 부족한가요? 열어두고 다음에 다시 볼게요.', "What's still missing? We'll keep it open and look again.")}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {REASONS.map((r) => {
                  const on = ambiguityReason === r.value;
                  return (
                    <button
                      type="button"
                      key={r.value}
                      onClick={() => onUnclear(r.value)}
                      aria-pressed={on}
                      className={`min-h-10 px-2.5 py-1 rounded-md text-[13px] font-medium border transition-colors cursor-pointer ${
                        on
                          ? 'border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)]'
                          : 'border-[var(--border)] text-[var(--text-tertiary)] hover:border-[var(--accent)]/40'
                      }`}
                    >
                      {L(r.ko, r.en)}
                    </button>
                  );
                })}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
