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
      // Honest provenance (CLAUDE.md A1, R57-58): a verbatim-adopted surfaced
      // sentence ("use this sentence as-is", which sets realBet = surfaced) is
      // ai_surfaced — NOT laundered as the user's own bet. Only a genuine re-type
      // (the committed text differs from the surfaced sentence) is authored:'user'.
      // This routes use-as-is into the existing betsHeldAiSurfaced separation so a
      // rubber-stamped bet never inflates the user's self-verified track record.
      real_bet_authored: bet === surfaced.trim() ? 'ai_surfaced' : 'user',
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
      {/* Two-sentence instruction: (1) declare the ladder is DELIBERATELY
          inflated scenarios — half the novices read it as the AI's actual
          forecast ("이 계획이 이렇게 된다고?") — and (2) replace the
          double-negative click rule with a plain one. */}
      <p className="text-[13px] font-semibold text-[var(--accent)] leading-[1.55]">
        {L(
          '아래는 일부러 점점 크게 부풀린 성공 시나리오예요. 위에서부터 읽다가, 처음으로 "에이, 이건 아니다" 싶은 줄을 눌러 주세요.',
          'Below are success scenarios deliberately inflated step by step. Read from the top and tap the first line that makes you go "no, not that far."',
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
                    ? L('하나도 안 멈추셨네요. 그럼 하나만 같이 볼게요 — 이 계획이 기대고 있는 전제예요.', "You didn't stop anywhere. So here's just one to look at — a premise this plan is resting on.")
                    : L('여기서 멈추셨네요 — 이 줄이 기대고 있는 전제예요', 'You stopped here — the belief this step is betting on')}
                </p>
                <p className="text-[13.5px] text-[var(--text-primary)] leading-[1.55] mt-1">{surfaced}</p>
                {/* Spine (§2.4-2, CLAUDE.md rounds 5–8): the no-flinch path used to
                    assert a ranked verdict ("the belief I see as RISKIEST is this")
                    and the fork-callout asserted stakes ("this is where the plan
                    succeeds or fails"). Both are directional statements — even as
                    the one default-on measurement line, that tested as a lean you
                    cannot launder. The surfaced assumption is irreducible (value ∝
                    leverage ∝ tilt), so we still NAME it — but the crux is a bare
                    neutral QUESTION, never a verdict about which belief is riskiest
                    or what it decides. Ask; don't conclude. */}
                <p className="text-[11.5px] text-[var(--accent)] leading-[1.5] mt-1.5">
                  {L('이게 정말 맞나요?', 'Is it actually true?')}
                </p>
              </div>
            </div>

            <div>
              <label className="block text-[12.5px] font-semibold text-[var(--text-secondary)] mb-1.5">
                {L('이 계획이 정말로 기대고 있는 한 가지를 당신의 말로 적어주세요', 'In your own words — what is this plan really betting on?')}
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
                  {L('이 문장 그대로 쓰기', 'Use this sentence as-is')}
                </button>
                <Button variant="primary" size="sm" onClick={commit} disabled={!realBet.trim()}>
                  {L('이대로 정하고 마무리', 'Lock it in & finish')}
                </Button>
              </div>
              {/* The honest skip: 8 minutes in, a mandatory hand-written gate
                  is where busy users close the tab and never get the document
                  (novice audit BLOCKS). The surfaced belief stands in as the
                  bet — same data, zero friction, document still arrives. But it
                  is tagged `ai_surfaced`, NOT silently inherited as the user's
                  own bet (CLAUDE.md A1): the friction escape stays, the authorship
                  stays honest, so calibration never counts this as the user's
                  judgment. */}
              <div className="mt-2 text-center">
                <button
                  type="button"
                  onClick={() => { if (surfaced) onResolve({ claims, flinched_id: noFlinch ? null : flinched!.id, surfaced_constraint: surfaced, real_bet: surfaced, real_bet_authored: 'ai_surfaced', no_flinch_fallback: noFlinch }); }}
                  className="text-[11px] text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] underline underline-offset-2 cursor-pointer transition-colors"
                >
                  {L('이건 건너뛰고 문서만 받을게요', 'Skip this — just give me the document')}
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}
