'use client';

/**
 * Falsification — "시험한다" (the overreach / flinch step).
 *
 * We acknowledge one genuine strength, then deliberately over-inflate the plan
 * into an escalating ladder of success-claims and ask the user to stop where they
 * stop believing. The flinch point isolates the load-bearing assumption — which
 * the user then restates in their own words as the "real bet." That bet is sealed
 * by the Decision Contract downstream (this component does NOT seal anything).
 *
 * No-flinch path: if the user believes every claim, we surface the single
 * riskiest assumption instead (via `onRequestHighestLoad`).
 *
 * Presentational + self-contained step state; all I/O via props. All text renders
 * through JSX → React auto-escapes (no XSS).
 */

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Loader2, AlertTriangle, ArrowDown, Check } from 'lucide-react';
import { useLocale } from '@/hooks/useLocale';
import { Button } from '@/components/ui/Button';
import type { Falsification as FalsificationResult, LoadBearingClaim } from '@/stores/types';
import { EASE } from './shared/constants';

export function Falsification({
  strength,
  claims,
  onResolve,
  onRequestHighestLoad,
}: {
  /** One genuine strength of the plan — earns the right to push. */
  strength: string;
  /** The escalating overclaim ladder (ordered plausible → grandiose). */
  claims: LoadBearingClaim[];
  /** Commit the resolved bet. The parent persists it + advances to finalize. */
  onResolve: (f: FalsificationResult) => void;
  /** No-flinch path: ask the engine for the single riskiest assumption. */
  onRequestHighestLoad: () => Promise<LoadBearingClaim | null>;
}) {
  const locale = useLocale();
  const L = (ko: string, en: string) => (locale === 'ko' ? ko : en);

  // Step state: pick a flinch point (or believe all) → restate the bet.
  const [flinched, setFlinched] = useState<LoadBearingClaim | null>(null);
  const [noFlinch, setNoFlinch] = useState(false);
  const [busy, setBusy] = useState(false);
  const [realBet, setRealBet] = useState('');

  const resolved = flinched !== null; // a flinch OR a no-flinch pick has landed
  // The surfaced bet is the BELIEF the flinched rung rests on (assumption) — not
  // the success-claim's text. Fall back to the claim text only if the model
  // didn't emit a per-rung assumption.
  const surfaced = (flinched?.assumption || flinched?.text) ?? '';

  function flinch(claim: LoadBearingClaim) {
    if (busy || resolved) return;
    setFlinched(claim);
    setNoFlinch(false);
  }

  async function believeAll() {
    if (busy || resolved) return;
    setBusy(true);
    try {
      const top = await onRequestHighestLoad();
      // Degrade gracefully: if the engine returns nothing usable (null OR empty
      // text), fall back to the FIRST rung — the minimal belief whose failure
      // breaks everything (the most defensible load-bearing candidate), not the
      // most grandiose one — so the surfaced bet is never blank or absurd.
      const pick = top?.text?.trim() ? top : (claims[0] ?? null);
      if (pick) {
        setFlinched(pick);
        setNoFlinch(true);
      }
    } finally {
      setBusy(false);
    }
  }

  function commit() {
    const bet = realBet.trim();
    if (!bet || !flinched) return;
    onResolve({
      claims,
      flinched_id: noFlinch ? null : flinched.id,
      surfaced_constraint: surfaced,
      real_bet: bet,
      no_flinch_fallback: noFlinch,
    });
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: EASE }}
      className="rounded-2xl border border-[var(--accent)]/25 bg-[var(--surface)] p-5 md:p-6 space-y-4"
    >
      {/* Strength acknowledgement — earns the right to push. */}
      {strength && (
        <div className="flex items-start gap-2.5">
          <div className="w-7 h-7 rounded-full bg-[var(--collab)] text-[var(--success)] flex items-center justify-center shrink-0">
            <Check size={14} strokeWidth={2.5} />
          </div>
          <p className="text-[13.5px] text-[var(--text-primary)] leading-[1.55] flex-1 min-w-0">{strength}</p>
        </div>
      )}

      {/* The framing line — paint success at growing scale (not "I'm faking it",
          which would poison the believability gradient), and make the click
          unambiguous: the FIRST line you can't quite believe anymore. */}
      <p className="text-[13px] font-semibold text-[var(--accent)] leading-[1.55]">
        {L(
          '계획이 성공하는 모습을 점점 크게 그려볼게요. 더는 그렇게까지 될 것 같지 않은 첫 줄을 눌러 주세요.',
          "I'll picture your plan succeeding at a bigger and bigger scale. Tap the first line you can't quite believe anymore.",
        )}
      </p>

      {/* The escalating ladder. Clicking a claim = a flinch. */}
      <ul className="space-y-2">
        {claims.map((c, i) => {
          const isFlinch = flinched?.id === c.id && !noFlinch;
          const dimmed = resolved && !isFlinch;
          return (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => flinch(c)}
                disabled={busy || resolved}
                aria-pressed={isFlinch}
                className={`w-full text-left rounded-xl border px-3.5 py-2.5 text-[13px] leading-[1.5] transition-colors ${
                  isFlinch
                    ? 'border-[var(--accent)] bg-[var(--accent)] text-white'
                    : dimmed
                    ? 'border-[var(--border)] text-[var(--text-tertiary)] opacity-60'
                    : 'border-[var(--border)] text-[var(--text-primary)] hover:border-[var(--accent)]/50 cursor-pointer'
                }`}
              >
                <span className="inline-flex items-baseline gap-2">
                  <span className="text-[10px] font-bold tabular-nums opacity-60">{i + 1}</span>
                  <span>{c.text}</span>
                </span>
              </button>
              {i < claims.length - 1 && !resolved && (
                <div className="flex justify-center py-0.5 text-[var(--text-tertiary)]/40">
                  <ArrowDown size={12} />
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {/* Believe-all (no-flinch) escape — only while unresolved. */}
      {!resolved && (
        <button
          type="button"
          onClick={believeAll}
          disabled={busy}
          className="text-[12.5px] font-medium text-[var(--text-secondary)] hover:text-[var(--accent)] transition-colors inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
        >
          {busy && <Loader2 size={13} className="animate-spin" />}
          {L('전부 믿겨요', 'I believe all of it')}
        </button>
      )}

      {/* Resolution — the surfaced constraint + the user's active restatement. */}
      {resolved && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          transition={{ duration: 0.3, ease: EASE }}
          className="overflow-hidden"
        >
          <div className="pt-1 space-y-3">
            <div className="flex items-start gap-2.5 rounded-xl bg-[var(--ai)] p-3">
              <AlertTriangle size={15} className="text-[var(--accent)] mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-[11.5px] font-semibold text-[var(--text-secondary)]">
                  {noFlinch
                    ? L('하나도 안 멈추셨네요 — 제가 제일 위험하다 보는 전제는 이거예요', "You didn't stop anywhere — the belief I see as riskiest is this")
                    : L('여기서 멈추셨네요 — 이 줄이 기대고 있는 전제예요', 'You stopped here — the belief this step is betting on')}
                </p>
                <p className="text-[13.5px] text-[var(--text-primary)] leading-[1.55] mt-1">{surfaced}</p>
              </div>
            </div>

            <div>
              <label className="block text-[12.5px] font-semibold text-[var(--text-secondary)] mb-1.5">
                {L('이 계획이 정말 기대고 있는 한 가지를, 당신의 말로 적어주세요', 'In your own words, what is this plan really resting on?')}
              </label>
              <textarea
                value={realBet}
                onChange={(e) => setRealBet(e.target.value)}
                rows={2}
                maxLength={280}
                placeholder={L('예: 기존 사용자들이 시키지 않아도 자발적으로 공유할 것이다', 'e.g. Existing users will share unprompted')}
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3.5 py-2.5 text-[13px] text-[var(--text-primary)] leading-[1.5] resize-none focus:outline-none focus:border-[var(--accent)]/60"
              />
              <div className="mt-1 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setRealBet(surfaced)}
                  className="text-[11px] text-[var(--text-tertiary)] hover:text-[var(--accent)] transition-colors cursor-pointer"
                >
                  {L('이 전제로 시작하기', 'Start from this')}
                </button>
                <Button variant="primary" size="sm" onClick={commit} disabled={!realBet.trim()}>
                  {L('이대로 정하고 마무리', 'Lock it in & finish')}
                </Button>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}
