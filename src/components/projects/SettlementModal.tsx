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
import { motion, AnimatePresence } from 'framer-motion';
import { Target, AlertTriangle, GitBranch, Check, Sparkles, Loader2 } from 'lucide-react';
import { useLocale } from '@/hooks/useLocale';
import { useProjectStore } from '@/stores/useProjectStore';
import { useAuth } from '@/lib/auth';
import { LocaleLink } from '@/components/ui/LocaleLink';
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
import { track } from '@/lib/analytics';
import { alignOutcome, type OutcomeDraft } from '@/lib/settle-align';
import { verdictButtons, predicateQuestion, isCreditClaimingOutcome, basisOptions } from './DecisionContractCard';

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

export function SettlementModal({ project, onClose }: { project: Project; onClose: () => void }) {
  const locale = useLocale();
  const ko = locale === 'ko';
  const L = (k: string, e: string) => (ko ? k : e);
  const updateProject = useProjectStore((s) => s.updateProject);
  const projects = useProjectStore((s) => s.projects);
  const { user } = useAuth();

  const contract = project.decision_contract ?? null;
  const predicates: Predicate[] = useMemo(
    // P2: the user's OWN opening lean is the emotional core of the settle — pin it
    // first so "was MY call right?" is the headline, not a line item among machine bets.
    () => {
      const ps = Array.isArray(contract?.predicates) ? [...contract!.predicates] : [];
      return ps.sort((a, b) => (a.source === 'user_lean' ? -1 : 0) - (b.source === 'user_lean' ? -1 : 0));
    },
    [contract],
  );
  const resolvedCount = predicates.filter(isResolved).length;
  const allResolved = predicates.length > 0 && resolvedCount === predicates.length;
  // How many times the user already said "아직" — the history is the receipt.
  const deferrals = Array.isArray(contract?.history) ? contract!.history.length : 0;

  // ── Outcome-alignment agent (단발 정산 도우미) ──
  // The user can write one paragraph of what actually happened; a single-shot
  // agent reads it against each sealed prediction and pre-highlights a draft
  // verdict + a grounding line lifted from their own words. The draft is
  // non-binding — they confirm/override/accept, and a draft-accepted verdict is
  // tagged `ai_draft` so it never inflates the self-verified record (spine).
  const [account, setAccount] = useState(contract?.outcome_note ?? '');
  const [drafts, setDrafts] = useState<Record<string, OutcomeDraft>>({});
  const [aligning, setAligning] = useState(false);
  const [alignError, setAlignError] = useState(false);
  const hasDrafts = Object.keys(drafts).length > 0;

  /** Persist the account, then read it against the predicates (single shot). */
  async function runAlign() {
    if (!contract || !account.trim() || aligning) return;
    setAligning(true);
    setAlignError(false);
    // Persist the account first — it's the user's own words, valuable even if the
    // alignment call fails (and it rehydrates on reopen).
    updateProject(project.id, { decision_contract: { ...contract, outcome_note: account.trim() } });
    track('settle_align_used', { project_id: project.id, predicates: predicates.length });
    try {
      setDrafts(await alignOutcome(predicates, account.trim(), ko ? 'ko' : 'en'));
    } catch {
      setAlignError(true);
    } finally {
      setAligning(false);
    }
  }

  /** Commit every still-open predicate from its draft — tagged `ai_draft`. Each is
   *  still individually overridable above; this is the one-tap "looks right". */
  function acceptAllDrafts() {
    if (!contract) return;
    let next = contract;
    const now = Date.now();
    let count = 0;
    for (const p of predicates) {
      if (isResolved(p)) continue;
      const d = drafts[p.id];
      if (!d) continue;
      next = gradePredicate(next, p.id, d.verdict, now, 'ai_draft');
      count++;
    }
    if (count === 0) return;
    updateProject(project.id, { decision_contract: next });
    recordSignal({ project_id: project.id, tool: 'voyage', signal_type: 'predicate_settled', signal_data: { verdict: 'align_accept_all' } });
    track('settle_align_accepted_all', { project_id: project.id, count });
  }

  // Return-loop instrumentation: the founder's core question is "do people who
  // came back actually close the loop?" — so we need the came-back-but-left
  // number, not just the graded one. `shown` fires on open; `abandoned` fires on
  // unmount when the contract still wasn't fully resolved (read from a ref so the
  // cleanup sees the latest state, not the mount-time snapshot). Internal-only.
  const allResolvedRef = useRef(allResolved);
  allResolvedRef.current = allResolved;
  useEffect(() => {
    track('settle_prompt_shown', { project_id: project.id, predicates: predicates.length });
    return () => {
      if (!allResolvedRef.current) track('settle_abandoned', { project_id: project.id });
    };
    // mount/unmount only — one shown per open, one abandoned-or-not per close.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The user's accumulating record across ALL projects — the first sliver of
  // the 자차표. Single source: summarizeRecord (also feeds /project's strip),
  // so the two surfaces can never drift apart.
  const record = useMemo(() => {
    if (!allResolved) return null;
    const rec = summarizeRecord(projects, Date.now());
    return { ...rec, loops: Math.max(1, rec.loops) };
  }, [allResolved, projects]);

  function grade(predicateId: string, verdict: PredicateVerdict, via?: 'ai_draft') {
    if (!contract) return;
    updateProject(project.id, {
      decision_contract: gradePredicate(contract, predicateId, verdict, Date.now(), via),
    });
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

  if (!contract) return null;

  // P0-4: a date-armed contract with NO predicates (a date-only BIND rope, or a
  // completed voyage that yielded nothing falsifiable) still reaches its check-in
  // date. Rendering null = the day we promised to "bring it up" arrives and nothing
  // happens — a broken promise. Keep it: ask the one free question and let them close
  // the loop. Closing clears the check-in so it stops resurfacing.
  if (predicates.length === 0) {
    const closeFreeform = () => {
      updateProject(project.id, {
        decision_contract: { ...contract, graded_at: new Date().toISOString(), check_in_at: undefined, check_in_interval: undefined },
      });
      recordSignal({ project_id: project.id, tool: 'voyage', signal_type: 'predicate_settled', signal_data: { verdict: 'freeform_close' } });
      track('decision_graded', { verdict: 'freeform_close' });
      onClose();
    };
    return (
      <Modal open onClose={onClose} title={L('그래서, 어떻게 됐어요?', 'So, how did it go?')}>
        <div className="space-y-4">
          <p className="text-[12.5px] text-[var(--text-secondary)] leading-[1.5] -mt-1">
            {L('그날 이 결정을 다시 보기로 했었죠 — ', 'You set a date to revisit this — ')}
            <span className="font-semibold text-[var(--text-primary)]">{project.name}</span>
          </p>
          <p className="text-[12.5px] text-[var(--text-tertiary)] leading-[1.5]">
            {L('따로 봉인한 예측은 없었어요 — 한 번 돌아본 걸로 이 고리를 닫을게요.',
               "No specific predictions were sealed for this one — we'll close the loop as a look-back.")}
          </p>
          <button
            onClick={closeFreeform}
            className="w-full px-4 py-2.5 rounded-xl text-[13px] font-semibold text-white cursor-pointer"
            style={{ background: 'var(--gradient-gold, var(--accent))' }}
          >
            {L('돌아봤어요 — 닫기', 'Looked back — close it')}
          </button>
        </div>
      </Modal>
    );
  }

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
        {/* Fights loss-avoidance (the return asymmetry): a bad outcome is the
            hardest to come back and grade, so say plainly we're checking the
            prediction, not the person. Honest, non-judgmental (spine). */}
        <p className="text-[11.5px] text-[var(--text-tertiary)] leading-[1.5] -mt-2">
          {L('결과가 어떻든 괜찮아요 — 확인하는 건 그때의 예측이지, 당신이 아니에요. 좋은 판단도 결과는 나쁠 수 있으니까요.',
             "However it turned out is fine — what we check is the prediction back then, not you. A good call can still get a bad result.")}
        </p>

        {/* Optional outcome account → single-shot alignment. Never blocks: the
            manual taps below always work, with or without this. */}
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3">
          <label className="block text-[12px] font-medium text-[var(--text-secondary)] mb-1.5 leading-[1.5]">
            {L('무슨 일이 있었는지 한 단락으로 적어볼까요? (선택) — 적어주시면 아래 질문에 초안을 맞춰드려요.',
               "Want to write a paragraph on what actually happened? (optional) — I'll line it up against the questions below as a draft.")}
          </label>
          <textarea
            value={account}
            onChange={(e) => setAccount(e.target.value)}
            rows={3}
            maxLength={1000}
            placeholder={L('그때 이 결정이 실제로 어떻게 흘러갔는지, 기억나는 대로…', 'However it actually played out, as best you remember…')}
            className="w-full resize-none rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-[12.5px] text-[var(--text-primary)] leading-[1.5] focus:outline-none focus:border-[var(--accent)]/50"
          />
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <button
              onClick={runAlign}
              disabled={!account.trim() || aligning}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold text-white disabled:opacity-50 cursor-pointer"
              style={{ background: 'var(--gradient-gold, var(--accent))' }}
            >
              {aligning ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
              {aligning ? L('맞춰보는 중…', 'Lining up…') : L('맞춰보기', 'Line it up')}
            </button>
            {hasDrafts && (
              <span className="text-[11px] text-[var(--text-tertiary)] leading-[1.4] flex-1 min-w-[160px]">
                {L('초안은 적어주신 글을 읽어 표시해둔 것뿐이에요 — 맞는지는 직접 정하세요.', "The drafts are just a reading of what you wrote — you decide what's right.")}
              </span>
            )}
          </div>
          {alignError && (
            <p className="mt-1.5 text-[11px] text-amber-600 dark:text-amber-400">
              {L('지금은 맞춰드리기 어려워요 — 아래에서 직접 표시해 주세요.', "Couldn't line it up right now — please mark them below yourself.")}
            </p>
          )}
        </div>

        <div className="space-y-2.5">
          {predicates.map((p) => {
            const Icon = SOURCE_ICON[p.source] ?? AlertTriangle;
            const draft = drafts[p.id];
            return (
              <div key={p.id} className={`rounded-xl border p-3 ${p.source === 'user_lean' ? 'border-[var(--accent)]/40 bg-[var(--ai)]/30' : 'border-[var(--border)] bg-[var(--surface)]'}`}>
                {p.source === 'user_lean' && (
                  <p className="text-[10.5px] font-semibold uppercase tracking-wide text-[var(--accent)] mb-1">
                    {L('출항 때 당신의 한 줄', 'Your opening call')}
                  </p>
                )}
                <div className="flex items-start gap-2">
                  <Icon size={13} className="text-[var(--text-tertiary)] mt-0.5 shrink-0" />
                  <p className="text-[13px] text-[var(--text-primary)] leading-[1.5] flex-1 min-w-0">
                    {predicateQuestion(p, ko)}
                  </p>
                </div>
                <div className="flex flex-wrap gap-1.5 mt-2 pl-[21px]">
                  {/* 3-tap settle: resolved verdicts only. The 4th path ("아직")
                      lives at the contract level below — it extends, not resolves.
                      A settle-align draft pre-highlights its verdict (dashed); the
                      user still owns the tap. Tapping the highlighted draft commits
                      as `ai_draft`; tapping any other button commits clean. */}
                  {verdictButtons(p.source, ko)
                    .filter((v) => v.value !== 'unknown')
                    .map((v) => {
                      const selected = p.verdict === v.value;
                      const isDraft = !!draft && draft.verdict === v.value && !isResolved(p) && !selected;
                      return (
                        <button
                          key={v.value}
                          onClick={() => grade(p.id, selected ? 'pending' : v.value, isDraft ? 'ai_draft' : undefined)}
                          aria-pressed={selected}
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[12px] font-semibold border transition-colors cursor-pointer ${
                            selected
                              ? 'border-[var(--accent)] bg-[var(--accent)] text-white'
                              : isDraft
                                ? 'border-dashed border-[var(--accent)] text-[var(--accent)] bg-[var(--ai)]/40'
                                : 'border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--accent)]/40'
                          }`}
                        >
                          {v.label}
                          {isDraft && <span className="text-[9px] font-bold uppercase tracking-wide opacity-70">{L('초안', 'draft')}</span>}
                        </button>
                      );
                    })}
                </div>
                {/* The grounding the draft read from the user's own account — a
                    READING frame ("이렇게 읽었어요"), never claimed as their words. */}
                {draft && !isResolved(p) && (
                  <p className="pl-[21px] mt-1.5 text-[11px] text-[var(--text-tertiary)] leading-[1.5]">
                    <span className="text-[var(--text-secondary)]">{L('이렇게 읽었어요 — ', 'Read it as — ')}</span>
                    {draft.evidence}
                  </p>
                )}
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

        {/* One-tap "looks right" — commits every still-open draft as `ai_draft`.
            Each remains individually overridable above; hidden once all resolved. */}
        {hasDrafts && !allResolved && (
          <div className="flex items-center justify-between gap-3 rounded-xl bg-[var(--ai)]/30 border border-[var(--accent)]/20 px-3 py-2.5">
            <span className="text-[11.5px] text-[var(--text-secondary)] leading-[1.4]">
              {L('각 항목은 따로 바꿔도 돼요.', 'You can still change any of them.')}
            </span>
            <button
              onClick={acceptAllDrafts}
              className="shrink-0 px-3 py-1.5 rounded-lg text-[12px] font-semibold text-white cursor-pointer"
              style={{ background: 'var(--gradient-gold, var(--accent))' }}
            >
              {L('초안대로 다 확인', 'Accept all drafts')}
            </button>
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
                    {/* Disclose draft-accepted verdicts so a rubber-stamped win
                        never silently reads as the user's own self-verified one. */}
                    {record.draftedWins > 0 &&
                      ' ' + L(`그중 ${record.draftedWins}개는 초안대로 확인했어요.`, `${record.draftedWins} of those you confirmed from the draft.`)}
                  </p>
                )}
                {/* P2/P1-9: the hard-won record is localStorage-only for anon users —
                    mirror the seal-time honesty + give a one-tap way to keep it. */}
                {!user && (
                  <p className="text-[11.5px] text-[var(--text-tertiary)] leading-[1.5]">
                    {L('이 기록은 지금 이 기기에만 있어요 — ', 'This record lives on this device only — ')}
                    <LocaleLink href="/login" className="font-semibold text-[var(--accent)] hover:underline">
                      {L('로그인하면 어디서나 남아요', 'log in to keep it anywhere')}
                    </LocaleLink>
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
