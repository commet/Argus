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

import { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Target, AlertTriangle, GitBranch, Check } from 'lucide-react';
import { useLocale } from '@/hooks/useLocale';
import { useProjectStore } from '@/stores/useProjectStore';
import type { Project, Predicate, PredicateSource, PredicateVerdict, PredicateBasis, CheckInInterval } from '@/stores/types';
import {
  gradePredicate,
  setPredicateBasis,
  amendCheckIn,
  isResolved,
  summarizeRecord,
  CHECK_IN_MS,
} from '@/lib/decision-contract';
import { Modal } from '@/components/ui/Modal';
import { recordSignal } from '@/lib/signal-recorder';
import { verdictButtons, predicateQuestion, isCreditClaimingOutcome, basisOptions } from './DecisionContractCard';

const SOURCE_ICON: Record<PredicateSource, typeof Target> = {
  governing_idea: Target,
  risk: AlertTriangle,
  actor: GitBranch,
};

const EXTEND_OPTIONS: { value: CheckInInterval; ko: string; en: string }[] = [
  { value: '1w', ko: '1주 뒤', en: 'in 1 week' },
  { value: '2w', ko: '2주 뒤', en: 'in 2 weeks' },
  { value: '1m', ko: '1달 뒤', en: 'in 1 month' },
];

export function SettlementModal({ project, onClose }: { project: Project; onClose: () => void }) {
  const locale = useLocale();
  const ko = locale === 'ko';
  const L = (k: string, e: string) => (ko ? k : e);
  const updateProject = useProjectStore((s) => s.updateProject);
  const projects = useProjectStore((s) => s.projects);

  const contract = project.decision_contract ?? null;
  const predicates: Predicate[] = useMemo(
    () => (Array.isArray(contract?.predicates) ? contract!.predicates : []),
    [contract],
  );
  const resolvedCount = predicates.filter(isResolved).length;
  const allResolved = predicates.length > 0 && resolvedCount === predicates.length;
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

  function grade(predicateId: string, verdict: PredicateVerdict) {
    if (!contract) return;
    updateProject(project.id, {
      decision_contract: gradePredicate(contract, predicateId, verdict, Date.now()),
    });
    // Learning signal — settlement is the return half of the loop; its verdict
    // is the ground truth the product is built to accumulate (2026-06-13 fix).
    recordSignal({ project_id: project.id, tool: 'voyage', signal_type: 'predicate_settled', signal_data: { verdict } });
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
  if (!contract || predicates.length === 0) return null;

  const sealedOn = fmtDate(contract.created_at);

  return (
    <Modal open onClose={onClose} title={L('그래서, 어떻게 됐어요?', 'So, how did it go?')}>
      <div className="space-y-4">
        <p className="text-[12.5px] text-[var(--text-secondary)] leading-[1.5] -mt-1">
          {sealedOn
            ? L(`${sealedOn}에 봉인한 결정이에요 — `, `You sealed this decision on ${sealedOn} — `)
            : L('그때 이 결정을 봉인하셨어요 — ', 'You sealed this decision — ')}
          <span className="font-semibold text-[var(--text-primary)]">{project.name}</span>
        </p>

        <div className="space-y-2.5">
          {predicates.map((p) => {
            const Icon = SOURCE_ICON[p.source] ?? AlertTriangle;
            return (
              <div key={p.id} className="rounded-xl border border-[var(--border)] p-3 bg-[var(--surface)]">
                <div className="flex items-start gap-2">
                  <Icon size={13} className="text-[var(--text-tertiary)] mt-0.5 shrink-0" />
                  <p className="text-[13px] text-[var(--text-primary)] leading-[1.5] flex-1 min-w-0">
                    {predicateQuestion(p, ko)}
                  </p>
                </div>
                <div className="flex flex-wrap gap-1.5 mt-2 pl-[21px]">
                  {/* 3-tap settle: resolved verdicts only. The 4th path ("아직")
                      lives at the contract level below — it extends, not resolves. */}
                  {verdictButtons(p.source, ko)
                    .filter((v) => v.value !== 'unknown')
                    .map((v) => {
                      const selected = p.verdict === v.value;
                      return (
                        <button
                          key={v.value}
                          onClick={() => grade(p.id, selected ? 'pending' : v.value)}
                          aria-pressed={selected}
                          className={`px-2.5 py-1 rounded-lg text-[12px] font-semibold border transition-colors cursor-pointer ${
                            selected
                              ? 'border-[var(--accent)] bg-[var(--accent)] text-white'
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

        <div className="pt-3 border-t border-[var(--border)]">
          <AnimatePresence mode="wait">
            {allResolved ? (
              <motion.div
                key="done"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-2.5"
              >
                <p className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-[var(--success)]">
                  <Check size={14} strokeWidth={2.5} />
                  {L('고리를 닫았어요.', 'Loop closed.')}
                </p>
                {record && (
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
                <div className="flex justify-end">
                  <button
                    onClick={onClose}
                    className="px-4 py-2 rounded-xl text-[12.5px] font-semibold text-white cursor-pointer"
                    style={{ background: 'var(--gradient-gold)' }}
                  >
                    {L('확인', 'Done')}
                  </button>
                </div>
              </motion.div>
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
