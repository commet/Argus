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
 *
 * Verdicts persist immediately per tap (each tap = one gradePredicate write),
 * so closing mid-way loses nothing. Surface language: 해요체, no 내기/반증/
 * predicate vocabulary. All text renders through JSX → auto-escaped.
 */

import { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X as XIcon, Target, AlertTriangle, GitBranch, Check } from 'lucide-react';
import { useLocale } from '@/hooks/useLocale';
import { useProjectStore } from '@/stores/useProjectStore';
import type { Project, Predicate, PredicateSource, PredicateVerdict, CheckInInterval } from '@/stores/types';
import { gradePredicate, amendCheckIn, isResolved, CHECK_IN_MS } from '@/lib/decision-contract';
import { verdictButtons, predicateQuestion } from './DecisionContractCard';

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

  const contract = project.decision_contract ?? null;
  const predicates: Predicate[] = useMemo(
    () => (Array.isArray(contract?.predicates) ? contract!.predicates : []),
    [contract],
  );
  const resolvedCount = predicates.filter(isResolved).length;
  const allResolved = predicates.length > 0 && resolvedCount === predicates.length;

  function grade(predicateId: string, verdict: PredicateVerdict) {
    if (!contract) return;
    updateProject(project.id, {
      decision_contract: gradePredicate(contract, predicateId, verdict, Date.now()),
    });
  }

  /** "아직" — extend the check-in (history-preserving amend) and close. */
  function extend(interval: CheckInInterval) {
    if (!contract) return;
    updateProject(project.id, { decision_contract: amendCheckIn(contract, interval, Date.now()) });
    onClose();
  }

  function fmtDate(ms: number): string {
    return new Date(ms).toLocaleDateString(ko ? 'ko-KR' : 'en-US', { month: 'long', day: 'numeric' });
  }

  if (!contract) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, y: 14, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
        role="dialog"
        aria-modal="true"
        aria-label={L('결정 확인', 'Decision check-in')}
        className="relative w-full max-w-lg max-h-[85vh] bg-[var(--bg)] rounded-2xl shadow-[var(--shadow-lg)] border border-[var(--border)] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-start justify-between gap-3 px-6 pt-6 pb-4">
          <div className="min-w-0">
            <h2 className="text-[18px] font-bold text-[var(--text-primary)] leading-[1.35]">
              {L('그래서, 어떻게 됐어요?', 'So, how did it go?')}
            </h2>
            <p className="text-[12.5px] text-[var(--text-secondary)] mt-1 leading-[1.5] line-clamp-2">
              {L(`그때 이 결정을 봉인하셨어요 — `, 'You sealed this decision — ')}
              <span className="font-semibold text-[var(--text-primary)]">{project.name}</span>
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label={L('닫기', 'Close')}
            className="p-1.5 rounded-lg hover:bg-[var(--surface)] shrink-0 cursor-pointer"
          >
            <XIcon className="w-4 h-4" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-6 space-y-2.5 pb-2">
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
                  {/* 3-tap settle: scored verdicts only. The 4th path ("아직")
                      lives at the contract level below — it extends, not resolves. */}
                  {verdictButtons(p.source, ko)
                    .filter((v) => v.value !== 'unknown')
                    .map((v) => {
                      const selected = p.verdict === v.value;
                      return (
                        <button
                          key={v.value}
                          onClick={() => grade(p.id, selected ? 'pending' : v.value)}
                          className={`px-2.5 py-1 rounded-md text-[11.5px] font-semibold border transition-colors cursor-pointer ${
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
              </div>
            );
          })}
        </div>

        <footer className="px-6 py-4 border-t border-[var(--border)] space-y-3">
          <AnimatePresence mode="wait">
            {allResolved ? (
              <motion.div
                key="done"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center justify-between gap-3"
              >
                <p className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-[var(--success)]">
                  <Check size={14} strokeWidth={2.5} />
                  {L('고리를 닫았어요.', 'Loop closed.')}
                </p>
                <button
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl text-[12.5px] font-semibold text-white cursor-pointer"
                  style={{ background: 'var(--gradient-gold)' }}
                >
                  {L('확인', 'Done')}
                </button>
              </motion.div>
            ) : (
              <motion.div key="extend" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <p className="text-[12px] text-[var(--text-secondary)] mb-2">
                  {L('아직 몰라요 — 나중에 다시 물어봐 주세요:', "Don't know yet — ask me again:")}
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
                    <span className="ml-auto text-[11.5px] text-[var(--text-tertiary)] tabular-nums">
                      {resolvedCount}/{predicates.length}
                    </span>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </footer>
      </motion.div>
    </div>
  );
}
