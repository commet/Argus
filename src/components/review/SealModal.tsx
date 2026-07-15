'use client';

/**
 * Judgment Ownership / Seal modal (design doc §"Judgment Ownership Modal" +
 * §Activation Event). Sealing one falsifiable follow-up IS the activation event.
 *
 * Spine rules baked in:
 *  - The user writes/edits the predicate themselves — Argus only pre-fills its
 *    ai_surfaced draft and offers a falsifiability nudge. Sealing flips
 *    predicate_owner to 'user' (honest authorship; no relabeled AI line).
 *  - No verdict, no "proceed". The user owns the lean, the conditions, the date.
 */

import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from 'framer-motion';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { SealStamp } from '@/components/workspace/progressive/SealStamp';
import { useLocale } from '@/hooks/useLocale';
import { type FalsifiableFollowup } from '@/lib/review';
import { type SealPatch } from '@/stores/useReviewStore';

export function SealModal({
  followups,
  onSeal,
  onClose,
  obligation,
  busy,
  error,
}: {
  followups: FalsifiableFollowup[];
  onSeal: (followupId: string, patch: SealPatch) => void;
  onClose: () => void;
  /** When set, this seals a judgment OBLIGATION into the DKK ledger — the
   *  followups become optional prediction suggestions for the return contract. */
  obligation?: { statement: string };
  /** submit in flight (network seal) — disables the button, shows progress. */
  busy?: boolean;
  /** a user-facing error from the seal attempt (e.g. sign-in required). */
  error?: string | null;
}) {
  const locale = useLocale();
  const L = (ko: string, en: string) => (locale === 'ko' ? ko : en);
  const [selectedId, setSelectedId] = useState(followups[0]?.followup_id ?? '');
  const selected = followups.find((f) => f.followup_id === selectedId) ?? followups[0];

  const [predicate, setPredicate] = useState(selected?.predicate ?? '');
  const [lean, setLean] = useState(selected?.lean ?? '');
  const [assumption, setAssumption] = useState(selected?.key_assumption ?? '');
  const [pass, setPass] = useState(selected?.pass_condition ?? '');
  const [fail, setFail] = useState(selected?.fail_condition ?? '');
  const [checkBy, setCheckBy] = useState(selected?.check_by ?? '');

  const pickFollowup = (f: FalsifiableFollowup) => {
    setSelectedId(f.followup_id);
    setPredicate(f.predicate);
    setLean(f.lean ?? '');
    setAssumption(f.key_assumption ?? '');
    setPass(f.pass_condition);
    setFail(f.fail_condition);
    setCheckBy(f.check_by);
  };

  const today = new Date().toISOString().slice(0, 10);
  const canSeal = predicate.trim().length > 5 && /^\d{4}-\d{2}-\d{2}$/.test(checkBy) && checkBy > today;

  // Abbreviated ceremony (P1-A3 S5): the modal doesn't just vanish — the same
  // ink stamp as the voyage seal presses in for 480ms before the commit.
  // reduced-motion (or an unmount mid-press) commits immediately/cleans up.
  const [stamping, setStamping] = useState(false);
  const reducedMotion = useReducedMotion();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);
  const stampDate = /^\d{4}-\d{2}-\d{2}$/.test(checkBy)
    ? `${Number(checkBy.slice(5, 7))}.${Number(checkBy.slice(8, 10))}`
    : '';

  if (!selected && !obligation) return null;

  const commitSeal = () =>
    onSeal(selected?.followup_id ?? '', { predicate, lean, key_assumption: assumption, pass_condition: pass, fail_condition: fail, check_by: checkBy });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={stamping ? undefined : onClose}>
      <div className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        {stamping && (
          <div className="absolute inset-0 z-10 flex items-center justify-center rounded-2xl bg-[var(--surface)]/85">
            <SealStamp animate date={stampDate} />
          </div>
        )}
        <Card variant="elevated">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-[16px] font-bold text-[var(--text-primary)]">{L('이 판단을 내가 소유하기', 'Own this judgment')}</h3>
            <button onClick={onClose} className="text-[var(--text-tertiary)] text-[18px] leading-none">×</button>
          </div>
          {obligation && (
            <div className="mb-3 rounded-lg bg-[var(--accent)]/[0.05] px-3 py-2">
              <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--accent)] mb-0.5">{L('내가 소유하는 판단', 'The judgment I own')}</div>
              <p className="text-[13px] leading-snug text-[var(--text-primary)]">{obligation.statement}</p>
            </div>
          )}
          <p className="text-[12px] text-[var(--text-secondary)] mb-1.5">
            {obligation
              ? L(
                  '이 판단을 내 것으로 봉인하고, 나중에 현실이 맞다/틀리다로 답할 확인 예측을 하나 겁니다. Argus가 판단하지 않습니다 — 확인일에 당신이 정산합니다.',
                  "Own this judgment, and commit to one prediction reality will later answer. Argus does not judge — you settle it on the check-in date.",
                )
              : L(
                  '나중에 현실이 맞다/틀리다로 답할 예측을 하나 봉인합니다. Argus가 판단하지 않습니다 — 확인일에 당신이 정산합니다.',
                  "Seal one prediction that reality will later answer as right or wrong. Argus does not judge — you settle it on the check-in date.",
                )}
          </p>
          {/* Email disclosure (04 S5): the Companion Brief mails this prediction on
              its check-in date — say so BEFORE the seal, not after the send. */}
          <p className="text-[11.5px] text-[var(--text-tertiary)] mb-4">
            {L(
              '확인일이 오면 이 예측을 이메일로 돌려드려요 — 정산을 위한 한 통이고, 그 외 메일은 없어요.',
              'When the check-in date arrives, this prediction comes back to you by email — one message for the settlement, nothing else.',
            )}
          </p>

          {followups.length > 1 && (
            <div className="flex flex-wrap gap-1.5 mb-3">
              {followups.map((f) => (
                <button
                  key={f.followup_id}
                  onClick={() => pickFollowup(f)}
                  className={`px-2 py-1 text-[11px] rounded-full border ${
                    f.followup_id === selectedId
                      ? 'border-[var(--accent)] text-[var(--accent)]'
                      : 'border-[var(--border-subtle)] text-[var(--text-secondary)]'
                  }`}
                >
                  {f.predicate.slice(0, 18)}…
                </button>
              ))}
            </div>
          )}

          <label className="block text-[11px] font-bold text-[var(--text-secondary)] mb-1">
            {L('내가 책임질 예측', 'The prediction I own')} {selected?.predicate_owner === 'ai_surfaced' && <span className="text-[var(--text-tertiary)] font-normal">{L('(Argus 초안 — 당신 말로 고쳐 쓰세요)', "(Argus draft — rewrite it in your own words)")}</span>}
          </label>
          <textarea
            value={predicate}
            onChange={(e) => setPredicate(e.target.value)}
            maxLength={400}
            className="w-full h-20 resize-y px-3 py-2 rounded-lg border border-[var(--border-subtle)] bg-transparent text-[13px] outline-none"
          />

          {/* The user writes their own lean + assumption. Argus never fills a
              pole here — that would tilt the judgment (spine §Ownership Modal). */}
          <div className="grid grid-cols-1 gap-2 mt-3">
            <div>
              <label className="block text-[11px] font-bold text-[var(--text-secondary)] mb-1">
                {L('지금 내 예상', 'My lean right now')} <span className="text-[var(--text-tertiary)] font-normal">{L('(내 판단 — 당신이 직접)', '(your judgment — in your own words)')}</span>
              </label>
              <input value={lean} onChange={(e) => setLean(e.target.value)} maxLength={200}
                placeholder={L('예: 그래도 이번 분기엔 리빌드가 맞다고 본다', 'e.g. I still think the rebuild is right this quarter')}
                className="w-full px-3 py-2 rounded-lg border border-[var(--border-subtle)] bg-transparent text-[13px] outline-none placeholder:text-[var(--text-tertiary)]" />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-[var(--text-secondary)] mb-1">
                {L('내가 믿고 있는 핵심 가정', 'The key assumption I am relying on')}
              </label>
              <input value={assumption} onChange={(e) => setAssumption(e.target.value)} maxLength={200}
                placeholder={L('예: 이탈의 주원인이 온보딩 복잡도라는 것', 'e.g. that onboarding complexity is the main cause of churn')}
                className="w-full px-3 py-2 rounded-lg border border-[var(--border-subtle)] bg-transparent text-[13px] outline-none placeholder:text-[var(--text-tertiary)]" />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-2 mt-3">
            <div>
              <label className="block text-[11px] font-bold text-[var(--text-secondary)] mb-1">{L('맞았다고 볼 조건', 'What counts as right')}</label>
              <input value={pass} onChange={(e) => setPass(e.target.value)} maxLength={200}
                className="w-full px-3 py-2 rounded-lg border border-[var(--border-subtle)] bg-transparent text-[13px] outline-none" />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-[var(--text-secondary)] mb-1">{L('틀렸다고 볼 조건', 'What counts as wrong')}</label>
              <input value={fail} onChange={(e) => setFail(e.target.value)} maxLength={200}
                className="w-full px-3 py-2 rounded-lg border border-[var(--border-subtle)] bg-transparent text-[13px] outline-none" />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-[var(--text-secondary)] mb-1">{L('확인 날짜', 'Check-in date')}</label>
              <input type="date" value={checkBy} min={today} onChange={(e) => setCheckBy(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-[var(--border-subtle)] bg-transparent text-[13px] outline-none" />
            </div>
          </div>

          {error && <p className="mt-3 text-[12px] text-red-600">{error}</p>}
          <div className="flex gap-2 mt-5">
            <Button
              variant="accent"
              size="md"
              className="transition-transform duration-150 active:scale-[0.96]"
              onClick={() => {
                if (stamping || busy) return;
                // Obligation seal is a network commit — go straight to it (the
                // busy state shows progress). The ink-stamp ceremony is only for
                // the instant local followup seal.
                if (obligation || reducedMotion) { commitSeal(); return; }
                setStamping(true);
                timerRef.current = setTimeout(commitSeal, 480);
              }}
              disabled={!canSeal || stamping || busy}
              style={canSeal ? undefined : { opacity: 0.5 }}
            >
              {busy ? L('봉인 중…', 'Sealing…') : obligation ? L('봉인하기', 'Own & seal') : L('봉인하기', 'Seal')}
            </Button>
            <Button variant="ghost" size="md" onClick={onClose} disabled={stamping || busy}>
              {L('취소', 'Cancel')}
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
