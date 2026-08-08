'use client';

/**
 * Judgment Ownership / Seal modal (design doc §"Judgment Ownership Modal" +
 * §Activation Event). Sealing one falsifiable follow-up IS the activation event.
 *
 * Spine rules baked in:
 *  - 저자성은 정본 판정기(closingJudgmentAuthorship)가 정한다: AI 초안을 고치면
 *    사용자 문장이 되고, **한 글자도 안 고치고 봉인하면 ai_surfaced 로 남는다.**
 *    그대로 채택하는 것은 허용된 탈출구다 — 기록만 정직하게 남긴다. (예전엔
 *    봉인이 무조건 'user' 로 승격해서, 판정기가 세탁이라 부르는 바로 그 형태였다.)
 *  - No verdict, no "proceed". The user owns the lean, the conditions, the date.
 */

import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from 'framer-motion';
import { ChevronDown, X } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { SealStamp } from '@/components/workspace/progressive/SealStamp';
import { useLocale } from '@/hooks/useLocale';
import { type FalsifiableFollowup } from '@/lib/review';
import { type SealPatch } from '@/stores/useReviewStore';
import { closingJudgmentAuthorship } from '@/lib/judgment-authorship';

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
  // 저자성 판정 재료 — 이 칸을 건드렸는가 (판정기의 touched 입력).
  const [predicateTouched, setPredicateTouched] = useState(false);
  const [lean, setLean] = useState(selected?.lean ?? '');
  const [assumption, setAssumption] = useState(selected?.key_assumption ?? '');
  const [pass, setPass] = useState(selected?.pass_condition ?? '');
  const [fail, setFail] = useState(selected?.fail_condition ?? '');
  const [checkBy, setCheckBy] = useState(selected?.check_by ?? '');
  const [showCriteria, setShowCriteria] = useState(false);

  const pickFollowup = (f: FalsifiableFollowup) => {
    setSelectedId(f.followup_id);
    setPredicate(f.predicate);
    setPredicateTouched(false);
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
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !stamping && !busy) onClose();
    };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [busy, onClose, stamping]);
  const stampDate = /^\d{4}-\d{2}-\d{2}$/.test(checkBy)
    ? `${Number(checkBy.slice(5, 7))}.${Number(checkBy.slice(8, 10))}`
    : '';

  if (!selected && !obligation) return null;

  const commitSeal = () => {
    // 초안이 AI 것일 때만 판정 대상 — 이미 사용자 소유였던 술어의 재봉인은
    // 동일 문장이어도 세탁이 아니다.
    const aiDraft = selected?.predicate_owner === 'ai_surfaced' ? (selected?.predicate ?? '') : '';
    const { authored } = closingJudgmentAuthorship({
      text: predicate,
      aiDraft,
      touched: predicateTouched,
      now: Date.now(),
      sourceRef: 'review:seal_followup',
    });
    onSeal(selected?.followup_id ?? '', {
      predicate,
      predicate_owner: authored,
      lean,
      key_assumption: assumption,
      pass_condition: pass,
      fail_condition: fail,
      check_by: checkBy,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-3 backdrop-blur-[2px] sm:p-5" onClick={stamping ? undefined : onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="record-judgment-title"
        aria-describedby="record-judgment-description"
        className="relative w-full max-w-xl max-h-[calc(100dvh-1.5rem)] overflow-y-auto sm:max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {stamping && (
          <div className="absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-[var(--surface)]/85">
            <SealStamp animate date={stampDate} />
          </div>
        )}
        <Card variant="elevated">
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <h3 id="record-judgment-title" className="text-[18px] font-bold text-[var(--text-primary)]">
                {L('내 판단으로 기록하기', 'Record as my judgment')}
              </h3>
              <p id="record-judgment-description" className="mt-1 text-[12px] leading-relaxed text-[var(--text-secondary)]">
                {L(
                  '확인할 질문과 날짜만 정하면 됩니다. 그날 Argus가 다시 가져올게요.',
                  'Choose one question and a date. Argus will bring it back then.',
                )}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={stamping || busy}
              aria-label={L('닫기', 'Close')}
              title={L('닫기', 'Close')}
              className="grid h-8 w-8 shrink-0 place-items-center rounded text-[var(--text-tertiary)] hover:bg-black/[0.04] hover:text-[var(--text-primary)] disabled:opacity-40 dark:hover:bg-white/[0.06]"
            >
              <X size={17} />
            </button>
          </div>
          {obligation && (
            <div className="mb-4 rounded-sm bg-[var(--accent)]/[0.045] px-3 py-2.5">
              <div className="mb-1 text-[12px] font-bold uppercase tracking-[0.16em] text-[var(--accent)]">
                {L('기록할 판단', 'Judgment to record')}
              </div>
              <p className="text-[13px] leading-relaxed text-[var(--text-primary)]">{obligation.statement}</p>
            </div>
          )}

          {followups.length > 1 && (
            <div className="mb-3">
              <label htmlFor="followup-suggestion" className="mb-1 block text-[12.5px] font-semibold text-[var(--text-secondary)]">
                {L('Argus가 찾은 확인 질문', 'Check-in question suggested by Argus')}
              </label>
              <select
                id="followup-suggestion"
                value={selectedId}
                onChange={(event) => {
                  const followup = followups.find((item) => item.followup_id === event.target.value);
                  if (followup) pickFollowup(followup);
                }}
                className="w-full rounded border border-[var(--border-subtle)] bg-[var(--surface)] px-3 py-2 text-[12px] text-[var(--text-primary)] outline-none focus:border-[var(--accent)]"
              >
                {followups.map((followup) => <option key={followup.followup_id} value={followup.followup_id}>{followup.predicate}</option>)}
              </select>
            </div>
          )}

          <label htmlFor="record-predicate" className="mb-1 block text-[12px] font-bold text-[var(--text-primary)]">
            {L('나중에 무엇을 확인할까요?', 'What should we check later?')}
          </label>
          <p className="mb-2 text-[12.5px] leading-relaxed text-[var(--text-tertiary)]">
            {selected?.predicate_owner === 'ai_surfaced'
              ? L('문서에서 뽑아 AI가 쓴 말입니다. 고치면 내 말이 됩니다 — 실제로 답할 수 있는 질문이 되도록 다듬어 보세요.', 'AI-written, pulled from the document. Edit it and it becomes your words — shape it into a question reality can answer.')
              : L('결과를 보고 분명하게 답할 수 있는 질문으로 적어주세요.', 'Write a question the outcome can answer clearly.')}
          </p>
          <textarea
            id="record-predicate"
            value={predicate}
            onChange={(e) => { setPredicate(e.target.value); setPredicateTouched(true); }}
            maxLength={400}
            className="h-20 w-full resize-y rounded border border-[var(--border-subtle)] bg-transparent px-3 py-2 text-[13px] leading-relaxed outline-none focus:border-[var(--accent)]"
          />

          <div className="mt-3">
            <label htmlFor="record-check-date" className="mb-1 block text-[12px] font-bold text-[var(--text-primary)]">
              {L('언제 다시 확인할까요?', 'When should we check again?')}
            </label>
            <input
              id="record-check-date"
              type="date"
              value={checkBy}
              min={today}
              onChange={(e) => setCheckBy(e.target.value)}
              className="w-full rounded border border-[var(--border-subtle)] bg-transparent px-3 py-2 text-[13px] outline-none focus:border-[var(--accent)] sm:w-52"
            />
          </div>

          <button
            type="button"
            onClick={() => setShowCriteria((value) => !value)}
            aria-expanded={showCriteria}
            className="mt-4 flex w-full items-center justify-between border-y border-[var(--border-subtle)] py-2.5 text-left text-[12px] font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
          >
            <span>{L('판단 기준 더하기', 'Add judgment criteria')} <span className="font-normal text-[var(--text-tertiary)]">{L('(선택)', '(optional)')}</span></span>
            <ChevronDown size={15} className={`transition-transform ${showCriteria ? 'rotate-180' : ''}`} />
          </button>

          {showCriteria && (
            <div className="mt-3 grid grid-cols-1 gap-3 border-b border-[var(--border-subtle)] pb-4 sm:grid-cols-2">
              <div>
                <label htmlFor="record-pass" className="mb-1 block text-[12.5px] font-bold text-[var(--text-secondary)]">{L('이 정도면 맞았다고 봄', 'This would count as right')}</label>
                <input id="record-pass" value={pass} onChange={(e) => setPass(e.target.value)} maxLength={200}
                  className="w-full rounded border border-[var(--border-subtle)] bg-transparent px-3 py-2 text-[12px] outline-none focus:border-[var(--accent)]" />
              </div>
              <div>
                <label htmlFor="record-fail" className="mb-1 block text-[12.5px] font-bold text-[var(--text-secondary)]">{L('이러면 다시 생각해야 함', 'This would make me reconsider')}</label>
                <input id="record-fail" value={fail} onChange={(e) => setFail(e.target.value)} maxLength={200}
                  className="w-full rounded border border-[var(--border-subtle)] bg-transparent px-3 py-2 text-[12px] outline-none focus:border-[var(--accent)]" />
              </div>
              {!obligation && (
                <>
                  <div>
                    <label htmlFor="record-lean" className="mb-1 block text-[12.5px] font-bold text-[var(--text-secondary)]">{L('지금 내 예상', 'My expectation now')}</label>
                    <input id="record-lean" value={lean} onChange={(e) => setLean(e.target.value)} maxLength={200}
                      className="w-full rounded border border-[var(--border-subtle)] bg-transparent px-3 py-2 text-[12px] outline-none focus:border-[var(--accent)]" />
                  </div>
                  <div>
                    <label htmlFor="record-assumption" className="mb-1 block text-[12.5px] font-bold text-[var(--text-secondary)]">{L('기대고 있는 가정', 'Assumption I rely on')}</label>
                    <input id="record-assumption" value={assumption} onChange={(e) => setAssumption(e.target.value)} maxLength={200}
                      className="w-full rounded border border-[var(--border-subtle)] bg-transparent px-3 py-2 text-[12px] outline-none focus:border-[var(--accent)]" />
                  </div>
                </>
              )}
            </div>
          )}

          <p className="mt-4 text-[12.5px] leading-relaxed text-[var(--text-tertiary)]">
            {L(
              '확인 날짜에 이 질문을 이메일로 한 번 보내드려요. 결과는 Argus가 판정하지 않고, 당신이 직접 기록합니다.',
              'On the check-in date, we send this question once by email. Argus does not grade it; you record the outcome.',
            )}
          </p>

          {error && <p className="mt-3 text-[12px] text-red-600">{error}</p>}
          <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row">
            <Button
              variant="accent"
              size="md"
              className="transition-transform duration-150 active:scale-[0.98]"
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
            >
              {busy ? L('기록 중…', 'Recording…') : L('이 판단 기록하기', 'Record this judgment')}
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
