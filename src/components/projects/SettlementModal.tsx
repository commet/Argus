'use client';

/**
 * SettlementModal — "그래서, 어떻게 됐어요?" (W1.2 귀환 표면).
 *
 * Opens on /project when a sealed contract's check-in date has arrived. Each
 * prediction settles with the per-source 3-tap verdicts (발생/회피/부분 — labels
 * from DecisionContractCard, single source of truth), plus the 4th path:
 *
 *   "아직" — the outcome isn't knowable yet → EXTEND check_by via amendCheckIn.
 *   The superseded date goes to contract.history; amend never overwrites the
 *   original (변침도 기록이다 — same principle as the watch ledger's amend event).
 *   A REPEATED "아직" gets acknowledged (the history is right there) and offers
 *   a kind exit: close the whole decision as unknowable instead of deferring
 *   forever.
 *
 * Closing the loop returns something: one line of the user's own accumulating
 * record (n번째 고리, 비켜 간 위험) — the first sliver of the 자차표 promise.
 *
 * Verdicts persist immediately per tap (each tap = one gradePredicate write),
 * so closing mid-way loses nothing. Built on <Modal> for focus trap / Escape /
 * scroll lock / focus restore. Surface language: 해요체, no 내기/반증/predicate
 * vocabulary, no "채점" (확인, not scoring). All text renders through JSX →
 * auto-escaped.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { Target, AlertTriangle, GitBranch } from 'lucide-react';
import { ArgusMascot } from '@/components/brand/ArgusMascot';
import { ClosingAnchorMark } from '@/components/brand/ClosingAnchorMark';
import { useLocale } from '@/hooks/useLocale';
import { useProjectStore } from '@/stores/useProjectStore';
import { useReviewStore } from '@/stores/useReviewStore';
import { summarizeReviewRecord, shouldShowThirdLoop } from '@/lib/record-summary';
import { getStorage, setStorage, STORAGE_KEYS } from '@/lib/storage';
import type { Project, Predicate, PredicateSource, PredicateVerdict, PredicateBasis, CheckInInterval, AmbiguityRecord, ReturnHandle, OpenCheck } from '@/stores/types';
import {
  gradePredicate,
  setPredicateBasis,
  amendCheckIn,
  isResolved,
  summarizeRecord,
  CHECK_IN_MS,
} from '@/lib/decision-contract';
import { Modal } from '@/components/ui/Modal';
import { LocaleLink } from '@/components/ui/LocaleLink';
import { recordSignal } from '@/lib/signal-recorder';
import { track } from '@/lib/analytics';
import { verdictButtons, predicateQuestion, isCreditClaimingOutcome, basisOptions } from './DecisionContractCard';
import { CheckpointReturnCard } from './CheckpointReturnCard';
import { generateGrowthNote } from '@/lib/growth-note';
import { applySettlementReceipt } from '@/lib/settlement-receipt';
import { JudgmentReceipt } from './JudgmentReceipt';
import { JudgmentFrame } from './JudgmentFrame';
import { RetroBadge } from './RetroBadge';

const SOURCE_ICON: Record<PredicateSource, typeof Target> = {
  governing_idea: Target,
  user_lean: Target,
  risk: AlertTriangle,
  actor: GitBranch,
};

const EXTEND_OPTIONS: { value: CheckInInterval; ko: string; en: string }[] = [
  { value: '1w', ko: '1주 뒤', en: 'in 1 week' },
  { value: '2w', ko: '2주 뒤', en: 'in 2 weeks' },
  { value: '1m', ko: '1달 뒤', en: 'in 1 month' },
];

export function SettlementModal({
  project,
  onClose,
  remainingDue,
  draftVerdicts,
  onRealSeal,
}: {
  project: Project;
  onClose: () => void;
  /** Remaining due count from the parent's useDueCount (the ONE number the
   *  strip already shows) — passed down so the modal never grows its own
   *  drifting due arithmetic. Absent → the new-decision door shows instead. */
  remainingDue?: number;
  /** NON-BINDING pre-highlights from settle-align (베팅③ 회고 봉인 step 2).
   *  Maps predicate id → a drafted verdict. A matching verdict button gets a
   *  dashed "초안" ring, but is NEVER selected — the user still taps to commit
   *  (verdict_via:'ai_draft' in spirit; C5 — no AI verdict as the conclusion).
   *  Absent on the normal /project settle path — the ring simply never renders. */
  draftVerdicts?: Record<string, 'happened' | 'avoided' | 'partial'>;
  /** [C3] 실전 온램프 (베팅③ 회고 봉인 완료 화면). Present ONLY on the retro
   *  path (RetroSeal). When a retro loop closes, the done screen offers a single
   *  TEXT LINK — "이제 진짜 …" — that starts a real (blind) decision instead of
   *  the generic "새 결정 적기". A text link only: no button promotion, no auto-
   *  navigation (§C3 절제). Absent → the normal onramp shows unchanged. */
  onRealSeal?: () => void;
}) {
  const locale = useLocale();
  const ko = locale === 'ko';
  const L = (k: string, e: string) => (ko ? k : e);
  const updateProject = useProjectStore((s) => s.updateProject);
  const projects = useProjectStore((s) => s.projects);

  const [whatHappened, setWhatHappened] = useState('');
  const contract = project.decision_contract ?? null;
  // 회고(연습) 계약인가 — 이 표면 전체에서 「연습 · 회고」 배지를 상시 노출하는
  // 근거(C2). 정상 계약은 origin 부재 → false → 배지 미렌더(무영향).
  const isRetro = contract?.origin === 'retro';
  const predicates: Predicate[] = useMemo(
    () => (Array.isArray(contract?.predicates) ? contract!.predicates : []),
    [contract],
  );
  const resolvedCount = predicates.filter(isResolved).length;
  const allResolved = predicates.length > 0 && resolvedCount === predicates.length;

  // Judgment-checkpoint v2 (§7): the primary checkpoint gets the focused 4-tap
  // card at the top; its predicate is then excluded from the per-predicate list
  // below (no duplication). Absent primary_checkpoint (legacy contract) → the
  // old per-predicate flow renders unchanged.
  const primaryCheckpoint = contract?.primary_checkpoint ?? null;
  const primaryPred = primaryCheckpoint
    ? predicates.find((p) => p.id === primaryCheckpoint.predicate_id) ?? null
    : null;
  const showCheckpoint = !!(primaryCheckpoint && primaryPred);
  const listPredicates = showCheckpoint ? predicates.filter((p) => p.id !== primaryPred!.id) : predicates;
  // loop-17 B — the unverified facts carried from seal. At settle we ASK whether they
  // held (mirror, not verdict): held / broke / not-yet. A 'broke' leaves a light
  // learning note — a false premise the decision rested on is the highest-value recall.
  const openChecks: OpenCheck[] = Array.isArray(contract?.open_checks) ? contract!.open_checks! : [];
  const setCheckStatus = (checkId: string, status: NonNullable<OpenCheck['status']>) => {
    if (!contract) return;
    const now = new Date().toISOString();
    const next = openChecks.map((c) =>
      c.id !== checkId
        ? c
        : c.status === status
          ? { ...c, status: undefined, settled_at: undefined } // tap again = un-set
          : { ...c, status, settled_at: now },
    );
    updateProject(project.id, { decision_contract: { ...contract, open_checks: next } });
  };
  // How many times the user already said "아직" — the history is the receipt.
  const deferrals = Array.isArray(contract?.history) ? contract!.history.length : 0;

  // The user's accumulating record across ALL projects — the first sliver of
  // the 자차표. Single source: summarizeRecord (also feeds /project's strip),
  // so the two surfaces can never drift apart.
  const record = useMemo(() => {
    if (!allResolved) return null;
    const rec = summarizeRecord(projects, Date.now());
    return { ...rec, loops: Math.max(1, rec.loops) };
  }, [allResolved, projects]);

  // 3고리 의식 (P1-A5 = 08 S5): fires exactly when the MERGED settled count
  // (project loops + review settles — the same number RecordStrip gates on)
  // first reaches SETTLED_THRESHOLD. Lifetime-once via a local flag; the copy
  // below names a sample-size fact and carries "여전히 점수는 아니에요" so it
  // can never read as a grade. Strict equality: a user already past the
  // threshold never gets a late ceremony.
  const receipts = useReviewStore((s) => s.receipts);
  const reducedMotion = useReducedMotion();
  const [thirdLoop, setThirdLoop] = useState(false);
  useEffect(() => {
    if (!record) return;
    const merged = record.loops + summarizeReviewRecord(receipts || []).settled;
    if (shouldShowThirdLoop(merged, getStorage(STORAGE_KEYS.THIRD_LOOP_SEEN, false))) {
      setThirdLoop(true);
      setStorage(STORAGE_KEYS.THIRD_LOOP_SEEN, true);
    }
  }, [record, receipts]);

  // [활성화 계측 · 항목10] retro_settled — a practice (회고) loop closed. Fires
  // exactly when a retro contract reaches allResolved, and flips the persistent
  // RETRO_SETTLED flag so SealMoment can later fire first_real_seal_after_retro
  // on the user's first REAL blind seal. This is the "3분 완주=병목 해소" onramp
  // signal. Once per device: the flag guards the re-fire on re-open.
  useEffect(() => {
    if (!isRetro || !allResolved) return;
    if (getStorage(STORAGE_KEYS.RETRO_SETTLED, false)) return;
    setStorage(STORAGE_KEYS.RETRO_SETTLED, true);
    track('retro_settled', { predicates: predicates.length });
  }, [isRetro, allResolved, predicates.length]);

  // Growth note (§10): once the loop closes, generate the ONE structural
  // reflection from the record just written. Input-contained + vocab-blocked +
  // honest-gap in generateGrowthNote; here we only gate it (once per mount, real
  // anchor, not a retro practice loop) and persist a successful note.
  const growthTriedRef = useRef(false);
  useEffect(() => {
    if (isRetro || !allResolved || growthTriedRef.current) return;
    if (contract?.growth_note) return;
    const anchor = contract?.judgment_receipt?.human_judgment?.trim();
    if (!anchor) return; // no anchor → honest gap, no note
    growthTriedRef.current = true;
    const primaryId = contract?.primary_checkpoint?.predicate_id;
    const verdictWord = predicates.find((p) => p.id === primaryId)?.verdict
      ?? predicates.find(isResolved)?.verdict ?? 'unknown';
    generateGrowthNote(
      {
        originalJudgment: anchor,
        verdict: String(verdictWord),
        ambiguityReason: contract?.ambiguity?.reason,
        userNote: (contract?.judgment_receipt?.what_happened ?? whatHappened).trim() || undefined,
      },
      ko ? 'ko' : 'en',
    ).then((note) => {
      if (note) updateProject(project.id, { decision_contract: { ...contract!, growth_note: note } });
    });
  }, [isRetro, allResolved, contract, predicates, ko, whatHappened, project.id, updateProject]);

  function saveWhatHappened(text: string) {
    const existingReceipt = contract?.judgment_receipt;
    if (!existingReceipt || !text.trim()) return;
    updateProject(project.id, {
      decision_contract: {
        ...contract!,
        judgment_receipt: {
          ...existingReceipt,
          what_happened: text.trim(),
          settled_at: new Date().toISOString(),
        },
      },
    });
  }

  function grade(predicateId: string, verdict: PredicateVerdict) {
    if (!contract) return;
    const now = Date.now();
    const graded = gradePredicate(contract, predicateId, verdict, now);
    const withReceipt = applySettlementReceipt(
      graded,
      verdict,
      new Date(now).toISOString(),
      ko ? 'ko' : 'en',
      whatHappened,
    );
    updateProject(project.id, { decision_contract: withReceipt });
    // Learning signal — settlement is the return half of the loop; its verdict
    // is the ground truth the product is built to accumulate (2026-06-13 fix).
    recordSignal({ project_id: project.id, tool: 'voyage', signal_type: 'predicate_settled', signal_data: { verdict } });
    track('decision_graded', { verdict });
  }

  /** The light second tap: the user's own read of WHY a win went their way.
   *  Optional — tapping the selected basis again clears it. Self-report (R17). */
  function setBasis(predicateId: string, basis: PredicateBasis, selected: boolean) {
    if (!contract) return;
    updateProject(project.id, {
      decision_contract: setPredicateBasis(contract, predicateId, selected ? undefined : basis),
    });
    recordSignal({ project_id: project.id, tool: 'voyage', signal_type: 'predicate_settled', signal_data: { basis } });
  }

  /** Checkpoint unclear path (§7.3): record WHY it's unclear + defer via a
   *  history-preserving amend, then close. Never a penalty — leaving it open is
   *  a first-class answer; the ambiguity note is what makes it a handle, not a
   *  dead end. */
  function settleUnclear(reason: AmbiguityRecord['reason']) {
    if (!contract) return;
    const amended = amendCheckIn(contract, '1m', Date.now());
    const next_handle: ReturnHandle = amended.check_in_at
      ? { kind: 'date', value: amended.check_in_at, auto_due: true }
      : { kind: 'manual', value: '', auto_due: false };
    updateProject(project.id, { decision_contract: { ...amended, ambiguity: { reason, next_handle } } });
    recordSignal({ project_id: project.id, tool: 'voyage', signal_type: 'predicate_settled', signal_data: { ambiguity: reason } });
    onClose();
  }

  /** "아직" — extend the check-in (history-preserving amend) and close. */
  function extend(interval: CheckInInterval) {
    if (!contract) return;
    updateProject(project.id, { decision_contract: amendCheckIn(contract, interval, Date.now()) });
    onClose();
  }

  /** A repeated "아직" deserves an exit: settle every open prediction as
   *  unknowable, so the decision closes honestly instead of deferring forever. */
  function closeAsUnknown() {
    if (!contract) return;
    let next = contract;
    const now = Date.now();
    for (const p of predicates.filter((x) => !isResolved(x))) {
      next = gradePredicate(next, p.id, 'unknown', now);
    }
    updateProject(project.id, { decision_contract: next });
  }

  function fmtDate(input: number | string): string {
    const d = new Date(input);
    if (Number.isNaN(d.getTime())) return '';
    const sameYear = d.getFullYear() === new Date().getFullYear();
    return d.toLocaleDateString(
      ko ? 'ko-KR' : 'en-US',
      sameYear ? { month: 'long', day: 'numeric' } : { year: 'numeric', month: 'long', day: 'numeric' },
    );
  }

  // Defensive: a malformed contract (or one with zero predicates) has nothing
  // to ask about — render nothing instead of an empty shell with extend chips.
  if (!contract) return null;

  if (predicates.length === 0) {
    const closeDateOnlyLoop = () => {
      updateProject(project.id, {
        decision_contract: {
          ...contract,
          outcome_note: whatHappened.trim(),
          graded_at: new Date().toISOString(),
          check_in_at: undefined,
          check_in_interval: undefined,
        },
      });
      onClose();
    };

    return (
      <Modal open onClose={onClose} title={L('그래서, 어떻게 됐어요?', 'So, how did it go?')}>
        <div className="space-y-4">
          <p className="text-[13px] text-[var(--text-secondary)] leading-[1.6]">
            {L('봉인한 결정의 확인일이 왔어요. 어땠는지 간단히 기록하고 고리를 닫아주세요.', 'This sealed decision is due. Capture what happened and close the loop.')}
          </p>
          <textarea
            aria-label={L('실제로 일어난 일', 'What actually happened')}
            value={whatHappened}
            onChange={(e) => setWhatHappened(e.target.value)}
            rows={4}
            maxLength={1200}
            className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3.5 py-2.5 text-[13px] text-[var(--text-primary)] leading-[1.5] resize-none focus:outline-none focus:border-[var(--accent)]/60"
            placeholder={L('무엇이 어떻게 되었나요?', 'What happened?')}
          />
          <div className="flex justify-end">
            <button
              type="button"
              onClick={closeDateOnlyLoop}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[var(--primary)] text-[var(--bg)] text-[13px] font-semibold cursor-pointer"
            >
              {L('돌아보고 고리 닫기', 'Looked back and closed')}
            </button>
          </div>
        </div>
      </Modal>
    );
  }

  const sealedOn = fmtDate(contract.created_at);

  return (
    <Modal open onClose={onClose} title={L('그래서, 어떻게 됐어요?', 'So, how did it go?')}>
      <div className="space-y-4">
        {/* Settlement ceremony — this is the PAYOFF of the seal (the loop closing,
            the product's moat), but it used to read like a throwaway form. Give the
            moment weight: a medallion + a line that names what's happening, so the
            settle feels like arriving in port, not filling a dialog. Mirrors the
            SealMoment scene at the other end of the loop. */}
        <div className="flex flex-col items-center gap-3 pb-2 text-center sm:flex-row sm:items-center sm:text-left">
          {/* 돌아온 Argus가 직접 묻는다 — '제가 먼저 물어볼게요'의 그 감시자 */}
          <ArgusMascot moment="returning" size="lg" alt={L('약속한 날 돌아온 Argus', 'Argus, back on the promised day')} className="max-sm:h-20 max-sm:w-20" />
          <div className="min-w-0">
            <p className="text-[15px] md:text-[17px] font-bold text-[var(--text-primary)] leading-[1.35]" style={{ fontFamily: 'var(--font-display)' }}>
              {L('그때 건 예측을, 이제 현실과 맞춰봐요', 'Time to check your prediction against what happened')}
            </p>
            {/* [C2] 정산모달 표면의 「연습 · 회고」 상시 배지 — retro일 때만. */}
            {isRetro && <RetroBadge ko={ko} className="mt-2" />}
            <p className="mt-1.5 text-[12px] text-[var(--text-secondary)] leading-[1.5] max-w-[42ch]">
              {sealedOn
                ? L(`${sealedOn}에 봉인한 결정의 확인일이에요. 고리를 닫는 순간이에요.`, `The check-in day for the decision you sealed on ${sealedOn}. This is the loop closing.`)
                : L('봉인했던 결정의 확인일이에요. 고리를 닫는 순간이에요.', 'The check-in day for the decision you sealed. This is the loop closing.')}
            </p>
          </div>
        </div>

        {/* Judgment Receipt — 그때의 판단을 꺼내 보여준다. */}
        {contract.judgment_receipt && (
          <JudgmentReceipt
            mode="settle"
            receipt={contract.judgment_receipt}
            sealedOn={sealedOn}
            whatHappened={whatHappened}
            onWhatHappenedChange={setWhatHappened}
            onSave={saveWhatHappened}
            locale={ko ? 'ko' : 'en'}
          />
        )}
        {!contract.judgment_receipt && (
          <p className="text-[12.5px] text-[var(--text-secondary)] leading-[1.5] -mt-1">
            {sealedOn
              ? L(`${sealedOn}에 봉인한 결정이에요 — `, `You sealed this decision on ${sealedOn} — `)
              : L('그때 이 결정을 봉인하셨어요 — ', 'You sealed this decision — ')}
            <span className="font-semibold text-[var(--text-primary)]">{project.name}</span>
          </p>
        )}

        {/* 회고 봉인 초안 안내 (베팅③): the dashed rings are AI-read drafts, not
            verdicts. One quiet line so a first-timer knows to tap-confirm. Only
            renders on the retro path (draftVerdicts present). */}
        {draftVerdicts && Object.keys(draftVerdicts).length > 0 && (
          <p className="text-[11.5px] text-[var(--text-tertiary)] leading-[1.5] -mt-1">
            {L('점선으로 미리 짚어둔 건 AI가 읽어본 초안이에요 — 최종은 직접 눌러서 확정하세요.',
               'The dashed marks are the AI-read draft — you confirm the final call by tapping.')}
          </p>
        )}

        {/* Judgment checkpoint (§7): the focused 4-tap for the primary predicate. */}
        {showCheckpoint && !allResolved && primaryCheckpoint && primaryPred && (
          <CheckpointReturnCard
            checkpoint={primaryCheckpoint}
            currentVerdict={primaryPred.verdict}
            ambiguityReason={contract.ambiguity?.reason}
            onTap={(v) => grade(primaryPred.id, v)}
            onUnclear={settleUnclear}
            locale={ko ? 'ko' : 'en'}
          />
        )}

        {listPredicates.length > 0 && (
        <div className="space-y-2.5">
          {listPredicates.map((p) => {
            const Icon = SOURCE_ICON[p.source] ?? AlertTriangle;
            return (
              <div key={p.id} className="rounded-xl border border-[var(--border)] p-3 bg-[var(--surface)]">
                <div className="flex items-start gap-2">
                  <Icon size={13} className="text-[var(--text-tertiary)] mt-0.5 shrink-0" />
                  <p className="text-[13px] text-[var(--text-primary)] leading-[1.5] flex-1 min-w-0">
                    {predicateQuestion(p, ko)}
                    {/* Honest provenance at the re-verification moment (CLAUDE.md A1):
                        an ai_surfaced bet (the express/skip path keeps the AI's
                        constraint as the governing premise) must NOT read as the
                        user's own confirmed judgment. Quiet shade, no extra friction —
                        it's a pure read of the already-tracked `authored` field. */}
                    {p.authored === 'ai_surfaced' && (
                      <span className="ml-1.5 inline-block align-middle text-[10px] font-semibold text-[var(--text-tertiary)] border border-[var(--border)] rounded px-1 py-px">
                        {ko ? 'AI가 짚은 전제' : 'AI-surfaced'}
                      </span>
                    )}
                  </p>
                </div>
                <div className="flex flex-wrap gap-1.5 mt-2 pl-[21px]">
                  {/* 3-tap settle: resolved verdicts only. The 4th path ("아직")
                      lives at the contract level below — it extends, not resolves. */}
                  {verdictButtons(p.source, ko)
                    .filter((v) => v.value !== 'unknown')
                    .map((v) => {
                      const selected = p.verdict === v.value;
                      // NON-BINDING draft pre-highlight (베팅③ step 2): a dashed ring
                      // on the drafted verdict while the predicate is still ungraded.
                      // Cleared the instant the user commits anything (verdict set).
                      const isDraft = !isResolved(p) && draftVerdicts?.[p.id] === v.value;
                      return (
                        <button
                          type="button"
                          key={v.value}
                          onClick={() => grade(p.id, selected ? 'pending' : v.value)}
                          aria-pressed={selected}
                          title={isDraft ? L('AI가 미리 짚은 초안 — 눌러서 확정하세요', 'AI-drafted — tap to confirm') : undefined}
                          className={`px-2.5 py-1 rounded-lg text-[12px] font-semibold border transition-colors cursor-pointer ${
                            selected
                              ? 'border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-fg)]'
                              : isDraft
                                ? 'border-dashed border-[var(--accent)]/60 text-[var(--accent)] bg-[var(--accent)]/[0.06]'
                                : 'border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--accent)]/40'
                          }`}
                        >
                          {v.label}
                        </button>
                      );
                    })}
                </div>
                {/* Light, optional second tap on a WIN only: was it your read or
                    luck? Keeps a lucky outcome from logging as a judgment-win
                    (R17). Never required — the loop closes whether or not it's
                    answered. */}
                <AnimatePresence>
                  {isCreditClaimingOutcome(p) && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="pl-[21px] mt-2">
                        <p className="text-[11px] text-[var(--text-tertiary)] mb-1.5">
                          {L('어쩌다 그렇게 됐어요? (선택)', 'What made it go your way? (optional)')}
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {basisOptions(ko).map((b) => {
                            const on = p.basis === b.value;
                            return (
                              <button
                                type="button"
                                key={b.value}
                                onClick={() => setBasis(p.id, b.value, on)}
                                aria-pressed={on}
                                className={`px-2 py-0.5 rounded-md text-[11.5px] font-medium border transition-colors cursor-pointer ${
                                  on
                                    ? 'border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)]'
                                    : 'border-[var(--border)] text-[var(--text-tertiary)] hover:border-[var(--accent)]/40'
                                }`}
                              >
                                {b.label}
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
          })}
        </div>
        )}

        {/* loop-17 B — "확인할 것": the unverified facts carried from seal. A neutral
            question ("확인해보셨어요?"), never a verdict on the user. A 'broke' leaves
            a quiet learning note. */}
        {openChecks.length > 0 && (
          <div className="space-y-2">
            <p className="text-[12px] font-semibold text-[var(--text-secondary)]">
              {L('봉인할 때 확인이 필요했던 것 — 확인해보셨어요?', 'Things worth verifying at seal — did you check them?')}
            </p>
            {openChecks.map((c) => (
              <div key={c.id} className="rounded-xl border border-[var(--border)] p-3 bg-[var(--surface)]">
                <p className="text-[12.5px] text-[var(--text-primary)] leading-[1.5]">
                  {c.text}
                  {c.where && <span className="text-[var(--text-tertiary)]">{` · ${c.where}`}</span>}
                </p>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {([['held', '맞았어요', 'Held up'], ['broke', '틀렸어요', 'Turned out wrong'], ['skipped', '아직', 'Not yet']] as const).map(([val, koL, enL]) => {
                    const on = c.status === val;
                    return (
                      <button
                        type="button"
                        key={val}
                        onClick={() => setCheckStatus(c.id, val)}
                        aria-pressed={on}
                        className={`px-2.5 py-1 rounded-lg text-[12px] font-semibold border transition-colors cursor-pointer ${
                          on
                            ? 'border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-fg)]'
                            : 'border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--accent)]/40'
                        }`}
                      >
                        {L(koL, enL)}
                      </button>
                    );
                  })}
                </div>
                {c.status === 'broke' && (
                  <p className="mt-2 text-[12px] text-[var(--text-tertiary)] leading-relaxed">
                    {L('그때 이 전제가 틀렸었네요 — 기록해둘게요. 다음 결정 때 참고돼요.', 'This premise didn’t hold — noting it. It’ll inform the next call.')}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="pt-3 border-t border-[var(--border)]">
          <AnimatePresence mode="wait">
            {allResolved ? (
              <motion.div
                key="done"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-2.5"
              >
                <motion.div
                  initial={reducedMotion ? false : { opacity: 0, scale: 0.88, rotate: -4 }}
                  animate={{ opacity: 1, scale: 1, rotate: 0 }}
                  transition={{ duration: 0.55, ease: 'easeOut' }}
                  className="flex items-center gap-3"
                >
                  <ClosingAnchorMark size={58} className="shrink-0 shadow-[0_8px_22px_rgba(6,38,36,0.22)]" />
                  <div>
                    <p className="text-[10px] font-mono uppercase tracking-[0.16em] text-[var(--text-tertiary)]">
                      {L('현실 확인 완료', 'REALITY CHECK COMPLETE')}
                    </p>
                    <p className="mt-0.5 text-[15px] font-semibold text-[var(--success)]">
                      {L('판단의 고리를 닫았어요', 'The decision loop is closed')}
                    </p>
                  </div>
                </motion.div>
                {/* 판단 액자 (P1-A1): the moment the loop closes is the moment
                    the frame goes up — the user's own two sentences, verbatim,
                    with date stamps. The diff between them is theirs to read;
                    no summary, no commentary. Only the SAVED narrative shows
                    (an unsaved draft isn't engraved). Renders nothing without
                    a human_judgment. */}
                <JudgmentFrame
                  humanJudgment={contract.judgment_receipt?.human_judgment}
                  whatHappened={contract.judgment_receipt?.what_happened}
                  sealedOn={sealedOn}
                  settledOn={contract.judgment_receipt?.settled_at ? fmtDate(contract.judgment_receipt.settled_at) : undefined}
                  ko={ko}
                  retro={isRetro}
                />
                {/* [C4] 회고 완료 화면의 별도 안내 — retro는 자차표에서 격리돼
                    record가 null이라 위 카운트 문장이 안 뜬다. 빈 자차표가
                    배신처럼 안 보이게, "연습 고리를 닫았다 + 실제 기록은 진짜
                    봉인부터" 한 줄로 정직하게 잇는다. record 클로즈(운/위험 카운트)는
                    회상편향이 태생적인 회고엔 절대 안 붙인다(C4). */}
                {isRetro && (
                  <p className="text-[12.5px] text-[var(--text-secondary)] leading-[1.55]">
                    {L('연습 고리를 한 번 닫아봤어요 — 봉인부터 다시 보기까지 어떤 느낌인지 보셨죠. 실제 기록은 결과를 모르는 채로 거는 진짜 봉인부터 쌓여요.',
                       "You closed a practice loop — you've felt the seal-through-settle shape. Your real record starts building from the first real seal, one made before you know how it turns out.")}
                  </p>
                )}
                {!isRetro && record && (
                  <p className="text-[12.5px] text-[var(--text-secondary)] leading-[1.55]">
                    {record.loops === 1
                      ? L('첫 고리예요 — 결정이 어떻게 됐는지 끝까지 확인한 거, 이번이 처음이에요.', 'Your first loop — the first decision you followed all the way to how it turned out.')
                      : L(`이번이 ${record.loops}번째로 닫은 고리예요.`, `That's loop number ${record.loops} you've closed.`)}
                    {record.risksAvoided > 0 &&
                      ' ' + L(`지금까지 위험 ${record.risksAvoided}개를 비켜 갔어요.`, `So far you've steered past ${record.risksAvoided} risk${record.risksAvoided === 1 ? '' : 's'}.`)}
                    {/* The user's own read, not a verdict: keeps a lucky win from
                        reading as a judgment-win in the record (R17). */}
                    {record.goodOutcomesOnLuck > 0 &&
                      ' ' + L(`그중 ${record.goodOutcomesOnLuck}개는 운이었다고 보셨고요.`, `You marked ${record.goodOutcomesOnLuck} of those as luck.`)}
                  </p>
                )}
                {/* 3고리 의식 (P1-A5): one gold hairline (same ink-line family
                    as the seal ceremony, 2s draw — static under reduced
                    motion) + one sentence. The threshold is the product's own
                    codified sample-size constant (dim9), the copy describes
                    what the RECORD becomes and disclaims the score reading in
                    the same breath. Never a user-evaluation word, never
                    repeated (lifetime flag), never extended into a "we don't
                    judge" purity claim (§4 채택 조건). */}
                {thirdLoop && (
                  <div className="pt-0.5">
                    <motion.div
                      aria-hidden
                      initial={reducedMotion ? false : { scaleX: 0 }}
                      animate={{ scaleX: 1 }}
                      transition={{ duration: 2, ease: 'easeOut' }}
                      className="h-px w-full"
                      style={{ transformOrigin: 'left', background: 'var(--gradient-gold)' }}
                    />
                    <p className="mt-2 text-[12.5px] leading-[1.55] text-[var(--text-secondary)]">
                      {L(
                        '세 번째 고리를 닫았어요. 이제 이 기록의 빈도가 의미를 갖기 시작해요 — 여전히 점수는 아니에요.',
                        "That's the third loop closed. The frequencies in this record start to mean something now — still not a score.",
                      )}
                    </p>
                  </div>
                )}

                {/* Growth note (§10): the one structural reflection, tagged
                    ai_surfaced and dismissable. Absent when generation failed or
                    was blocked (honest gap) — then this simply doesn't render. */}
                {!isRetro && contract.growth_note && (
                  <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] font-semibold text-[var(--text-tertiary)] border border-[var(--border)] rounded px-1 py-px">
                        {L('AI가 비춘 한 줄', 'AI-surfaced')}
                      </span>
                      <button
                        type="button"
                        onClick={() => updateProject(project.id, { decision_contract: { ...contract, growth_note: undefined } })}
                        className="text-[11px] text-[var(--text-tertiary)] hover:text-[var(--danger)] cursor-pointer transition-colors"
                      >
                        {L('지우기', 'Dismiss')}
                      </button>
                    </div>
                    <p className="text-[12.5px] text-[var(--text-primary)] leading-[1.55] mt-1.5">{contract.growth_note.widened_view}</p>
                    <p className="text-[12px] text-[var(--text-secondary)] leading-[1.5] mt-1">{contract.growth_note.future_attention}</p>
                  </div>
                )}

                <div className="flex items-center justify-between gap-3">
                  {/* [C3] 회고 실전 온램프 — retro 완료 화면에서만. 연습을 닫은
                      직후가 진짜를 걸어볼 유일한 문. 텍스트 링크 1개(버튼 승격·
                      자동 네비 금지, §C3 절제). onRealSeal이 setCurrentProjectId(null)
                      류로 새(눈먼) 결정을 연다. 재봉인 온램프(아래)를 대체한다. */}
                  {isRetro && onRealSeal ? (
                    <button
                      type="button"
                      onClick={onRealSeal}
                      className="text-[12px] text-[var(--text-tertiary)] hover:text-[var(--accent)] hover:underline underline-offset-2 cursor-pointer transition-colors text-left"
                    >
                      {L('이제 진짜 — 결과를 아직 모르는 결정 하나 걸어볼까요? →', 'Now for real — want to seal one whose outcome you don’t know yet? →')}
                    </button>
                  ) : typeof remainingDue === 'number' && remainingDue > 0 ? (
                    <button
                      type="button"
                      onClick={onClose}
                      className="text-[12px] text-[var(--text-tertiary)] hover:text-[var(--accent)] hover:underline underline-offset-2 cursor-pointer transition-colors"
                    >
                      {L(`다음 확인할 것 ${remainingDue}건 →`, `${remainingDue} more to check →`)}
                    </button>
                  ) : (
                    <LocaleLink
                      href="/workspace"
                      className="text-[12px] text-[var(--text-tertiary)] hover:text-[var(--accent)] hover:underline underline-offset-2 transition-colors"
                    >
                      {L('새 결정 적기 →', 'Write a new decision →')}
                    </LocaleLink>
                  )}
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2 rounded-xl text-[12.5px] font-semibold text-[var(--accent-fg)] cursor-pointer"
                    style={{ background: 'var(--gradient-gold)' }}
                  >
                    {L('확인', 'Done')}
                  </button>
                </div>
              </motion.div>
            ) : showCheckpoint && listPredicates.length === 0 ? (
              // The primary checkpoint IS the only thing to settle — the card's
              // 4-tap (incl. "아직 판단하기 어렵다") drives it, so no duplicate
              // contract-level extend chips here.
              <motion.div key="cp-only" initial={{ opacity: 0 }} animate={{ opacity: 1 }} />
            ) : (
              <motion.div key="extend" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <p className="text-[12px] text-[var(--text-secondary)] mb-2">
                  {deferrals >= 1
                    ? L('지난번에도 아직이었죠 — 천천히 해도 돼요. 언제 다시 물어볼까요?', "It wasn't knowable last time either — no rush. When should I ask again?")
                    : L('아직 몰라요 — 나중에 다시 물어봐 주세요:', "Don't know yet — ask me again:")}
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  {EXTEND_OPTIONS.map((opt) => (
                    <button
                      type="button"
                      key={opt.value}
                      onClick={() => extend(opt.value)}
                      className="px-3 py-1.5 rounded-lg text-[12px] font-medium border border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--accent)]/40 hover:text-[var(--accent)] transition-colors cursor-pointer"
                    >
                      {L(opt.ko, opt.en)} · {fmtDate(Date.now() + CHECK_IN_MS[opt.value])}
                    </button>
                  ))}
                  {resolvedCount > 0 && (
                    <span className="ml-auto text-[11px] text-[var(--text-tertiary)] tabular-nums">
                      {L(`${resolvedCount}/${predicates.length} 확인했어요`, `${resolvedCount}/${predicates.length} checked`)}
                    </span>
                  )}
                </div>
                {deferrals >= 2 && (
                  <button
                    type="button"
                    onClick={closeAsUnknown}
                    className="mt-2.5 text-[11.5px] text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] underline underline-offset-2 cursor-pointer transition-colors"
                  >
                    {L('이 결정은 결과를 알 수 없는 걸로 닫아둘까요?', 'Close this one as unknowable?')}
                  </button>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </Modal>
  );
}
