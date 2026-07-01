'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Anchor, MapPin, ArrowDown } from 'lucide-react';
import { useLocale } from '@/hooks/useLocale';
import { track } from '@/lib/analytics';

/**
 * WakeReturn — the FIRST settlement (생각↔생각), shown on the completion screen the
 * moment the AI's answer is fully revealed. It mirrors the user's pre-AI `user_lean`
 * rope back and asks "still holds?" — they tap 그대로 (held) or rewrite one line.
 *
 * WHY: the bind ("tie the rope before the Sirens") used to pay off only weeks later at
 * settle (생각↔현실) — which almost nobody reaches (0 settled). This pass makes the
 * AI's pull on your OWN read visible immediately, in-session, for free. It is the
 * on-ramp that sells the later, opt-in 현실 settlement.
 *
 * SPINE INVARIANTS (do not regress):
 *  - The "after" line is PURE user-authored — never prefilled from model output, never
 *    a fork/two options (no borrowed rope; same floor as BindCard's lean).
 *  - argus passes NO verdict on the move. We mirror the two points the user wrote and
 *    state the bare fact (움직였어요 / 단단함). Never "wiser", never "AI's doing".
 *  - Tapping 그대로 is one tap and loses nothing — no forced re-typing gate.
 *  - Only rendered when a real rope exists (a `lean`); with no anchor there is nothing
 *    to weigh against, so the block is simply absent.
 */
export function WakeReturn({
  lean,
  leanAfter,
  onCommit,
}: {
  /** The pre-AI rope text (user_lean predicate). Required — the block hides without it. */
  lean: string;
  /** A previously-committed recheck; when present we render the settled wake, read-only. */
  leanAfter?: { text: string; changed: boolean; at: string } | null;
  /** Persist the recheck. `changed:false` (그대로) copies the rope text forward. */
  onCommit: (after: { text: string; changed: boolean }) => void;
}) {
  const locale = useLocale();
  const ko = locale === 'ko';
  const L = (k: string, e: string) => (ko ? k : e);

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');

  const committed = leanAfter ?? null;

  const hold = () => {
    track('wake_return', { changed: false });
    onCommit({ text: lean, changed: false });
  };
  const moved = () => {
    const text = draft.trim();
    if (!text) return;
    track('wake_return', { changed: true });
    onCommit({ text, changed: true });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="mx-auto w-full max-w-xl"
    >
      <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] px-6 py-7 shadow-sm">
        <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-[var(--text-tertiary)] mb-3">
          {L('항적 · 닿은 곳', 'Your wake · where you landed')}
        </p>

        {/* ── Settled wake (read-only): both points the user wrote, with a bare label ── */}
        {committed ? (
          <div>
            <div className="flex flex-col gap-0">
              {/* anchor */}
              <div className="flex items-start gap-2.5">
                <Anchor size={15} className="mt-0.5 shrink-0 text-[var(--text-tertiary)]" />
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">
                    {L('닻 내린 곳', 'Where you anchored')}
                  </p>
                  <p className="text-[14px] text-[var(--text-secondary)] leading-snug mt-0.5">{lean}</p>
                </div>
              </div>
              <div className="ml-[6px] my-1.5 h-5 border-l border-dashed border-[var(--border-subtle)]" />
              {/* landed */}
              <div className="flex items-start gap-2.5">
                <MapPin size={15} className="mt-0.5 shrink-0 text-[var(--primary)]" />
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--accent)]">
                    {L('닿은 곳', 'Where you landed')}
                  </p>
                  <p className="text-[14px] text-[var(--text-primary)] leading-snug mt-0.5">{committed.text}</p>
                </div>
              </div>
            </div>

            {/* Bare fact, never a verdict. */}
            <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-[var(--border-subtle)] bg-[var(--bg)] px-3 py-1.5">
              <span className="text-[12px] font-semibold text-[var(--text-primary)]">
                {committed.changed ? L('마음이 움직였어요', 'Your read moved') : L('단단함', 'It held')}
              </span>
            </div>
            <p className="mt-2 text-[12px] text-[var(--text-tertiary)] leading-snug">
              {committed.changed
                ? L('답을 듣고 기운 쪽이 달라졌어요. 무엇이 당신을 움직였는지는 당신이 압니다.',
                    "Hearing the answer shifted where you lean. What moved you, only you know.")
                : L('argus의 어떤 말도 이 닻을 움직이지 못했어요. 세이렌을 그냥 지나쳤다는 뜻이에요.',
                    "Nothing argus said moved this anchor. You sailed past the Sirens.")}
            </p>
          </div>
        ) : (
          /* ── Recheck prompt: mirror the rope, ask "still holds?" ── */
          <div>
            <div className="flex items-start gap-2.5">
              <Anchor size={15} className="mt-0.5 shrink-0 text-[var(--text-tertiary)]" />
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">
                  {L('출발할 때 당신은', 'When you set out, you said')}
                </p>
                <p className="text-[14px] text-[var(--text-secondary)] leading-snug mt-0.5">{lean}</p>
              </div>
            </div>

            <h3 className="mt-4 text-[16px] font-bold leading-snug text-[var(--text-primary)]" style={{ fontFamily: 'var(--font-display)' }}>
              {L('다 보고 난 지금도 그래요?', 'Now that you’ve seen it all — does it still hold?')}
            </h3>

            {!editing ? (
              <div className="mt-4 flex flex-col gap-2.5">
                <button
                  type="button"
                  onClick={hold}
                  className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl bg-[var(--primary)] px-4 py-3 text-[14px] font-semibold text-[var(--bg)] transition-colors"
                >
                  {L('그대로예요', 'It still holds')}
                </button>
                <button
                  type="button"
                  onClick={() => setEditing(true)}
                  className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl border border-[var(--border-subtle)] bg-transparent px-4 py-3 text-[14px] font-medium text-[var(--text-secondary)] hover:border-[var(--text-tertiary)] transition-colors"
                >
                  {L('바뀌었어요', 'It moved')}
                  <ArrowDown size={14} />
                </button>
              </div>
            ) : (
              <div className="mt-4">
                <textarea
                  autoFocus
                  value={draft}
                  maxLength={140}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      moved();
                    }
                  }}
                  rows={2}
                  placeholder={L('지금은 어디로 기울어요?', 'Where do you lean now?')}
                  className="w-full resize-none rounded-xl border border-[var(--border-subtle)] bg-[var(--bg)] px-3.5 py-3 text-[14px] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:border-[var(--primary)] focus:outline-none"
                />
                <div className="mt-3 flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => { setEditing(false); setDraft(''); }}
                    className="text-[12.5px] font-medium text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors"
                  >
                    {L('뒤로', 'Back')}
                  </button>
                  <button
                    type="button"
                    onClick={moved}
                    disabled={!draft.trim()}
                    className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-[13.5px] font-semibold transition-colors ${
                      draft.trim()
                        ? 'bg-[var(--primary)] text-[var(--bg)]'
                        : 'cursor-default border border-[var(--border-subtle)] bg-transparent text-[var(--text-tertiary)] opacity-60'
                    }`}
                  >
                    {L('이 이동 남기기', 'Mark this move')}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}
