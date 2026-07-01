'use client';

/**
 * Decision Contract card — the falsifiable closed loop, surfaced on the
 * project page (§0 KICK).
 *
 * Four states, derived (never stored as a status field):
 *   1. SEAL    — voyage FINISHED, has falsifiable predictions, no contract yet
 *                → offer to seal + pick a check-in date (self-commitment).
 *   2. WAITING — sealed, check-in date not yet here → quiet "확인 예정" + early grade.
 *   3. GRADE   — check-in due, predicates unresolved → scoring panel.
 *   4. VERIFIED— every prediction resolved → honest per-source scorecard.
 *
 * Honesty rules baked in (from adversarial review):
 *  - Each predicate is framed as a yes/no-checkable QUESTION per source, and
 *    the verdict buttons are labelled per source ("발생/회피" for a risk,
 *    "적중/빗나감" for a bet) — the same stored verdict value means the right
 *    thing for each. A risk "happened" is NOT celebrated as a win.
 *  - An "아직 모름" verdict resolves a predicate without scoring it, so a
 *    decision whose outcome isn't yet knowable never traps the contract open.
 *  - The copy does NOT claim "Argus learns your judgment" (nothing consumes the
 *    grade yet). It claims only what's true: you close the loop on your own call.
 *
 * All user/LLM-derived text renders through JSX ({…}) → React auto-escapes (no
 * XSS). `decision_contract`/`predicates` are accessed defensively.
 */

import { useMemo, useState } from 'react';
import { Sparkles, Check, Clock, Target, AlertTriangle, GitBranch, ChevronDown } from 'lucide-react';
import { useLocale } from '@/hooks/useLocale';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useProjectStore } from '@/stores/useProjectStore';
import { usePersonaStore } from '@/stores/usePersonaStore';
import { getStorage, STORAGE_KEYS } from '@/lib/storage';
import type {
  Project,
  RecastItem,
  FeedbackRecord,
  CheckInInterval,
  PredicateVerdict,
  PredicateBasis,
  PredicateSource,
  Predicate,
} from '@/stores/types';
import {
  generateDecisionContract,
  contractFromPredicates,
  withCheckIn,
  amendCheckIn,
  gradePredicate,
  setPredicateBasis,
  contractStatus,
  summarizeGrades,
  type PredicateSources,
} from '@/lib/decision-contract';

const SOURCE_ICON: Record<PredicateSource, typeof Target> = {
  governing_idea: Target,
  user_lean: Target,
  risk: AlertTriangle,
  actor: GitBranch,
};

export type Verdict = Exclude<PredicateVerdict, 'pending'>;

/** Per-source verdict buttons. Same stored value, source-appropriate label, so
 *  "happened" reads as "발생" for a risk but "적중" for a bet. `unknown` is always last.
 *  Exported: SettlementModal reuses these labels (single source of truth). */
export function verdictButtons(source: PredicateSource, ko: boolean): { value: Verdict; label: string }[] {
  const partial = { value: 'partial' as const, label: ko ? '부분' : 'Partial' };
  const unknown = { value: 'unknown' as const, label: ko ? '아직 모름' : 'Unknown' };
  if (source === 'governing_idea' || source === 'user_lean') {
    return [
      { value: 'happened', label: ko ? '적중' : 'Held' },
      { value: 'avoided', label: ko ? '빗나감' : 'Broke' },
      partial,
      unknown,
    ];
  }
  if (source === 'actor') {
    return [
      { value: 'happened', label: ko ? '맞았음' : 'Right call' },
      { value: 'avoided', label: ko ? '아니었음' : 'Unneeded' },
      partial,
      unknown,
    ];
  }
  return [
    { value: 'happened', label: ko ? '발생' : 'Happened' },
    { value: 'avoided', label: ko ? '회피' : 'Avoided' },
    partial,
    unknown,
  ];
}

/** Frame the raw subject as a yes/no-checkable question per source. Exported
 *  for SettlementModal (single source of truth). */
export function predicateQuestion(p: Predicate, ko: boolean): string {
  // user_lean: re-confront the user's OWN opening line as a bare neutral question
  // (the myth's "bind tighter" — their pre-AI lean is the anchor reality grades).
  if (p.source === 'user_lean') return ko ? `출항 때 당신의 한 줄이 맞았나요 — ${p.text}` : `Did your opening lean hold — ${p.text}`;
  if (p.source === 'governing_idea') return ko ? `핵심 가설이 맞았나요 — ${p.text}` : `Did the bet hold — ${p.text}`;
  if (p.source === 'actor') return ko ? `사람 판단이 필요했나요 — ${p.text}` : `Did this need human judgment — ${p.text}`;
  return ko ? `실제로 일어났나요 — ${p.text}` : `Did it happen — ${p.text}`;
}

/** A "good outcome" verdict where crediting the user's judgment is at stake — a
 *  held bet or an avoided risk. Only here do we offer the optional basis tap;
 *  asking "luck or skill?" about a loss or an unknown would be noise. */
export function isCreditClaimingOutcome(p: Predicate): boolean {
  return (
    (p.source === 'governing_idea' && p.verdict === 'happened') ||
    (p.source === 'user_lean' && p.verdict === 'happened') ||
    (p.source === 'risk' && p.verdict === 'avoided')
  );
}

/** The optional "why did it go your way?" choices — the light second tap, never a
 *  quiz. Self-report, NOT Argus grading (R17). Single source of truth shared with
 *  SettlementModal; values mirror the plugin settle `basis` (parity-guarded). */
export function basisOptions(ko: boolean): { value: PredicateBasis; label: string }[] {
  return [
    { value: 'reasoned', label: ko ? '판단대로' : 'My read' },
    { value: 'luck', label: ko ? '운이 좋았음' : 'Luck' },
    { value: 'external', label: ko ? '외부 요인' : 'Outside factors' },
    { value: 'mixed', label: ko ? '반반' : 'A bit of both' },
  ];
}

const INTERVALS: { value: CheckInInterval; ko: string; en: string }[] = [
  { value: '1w', ko: '1주 후', en: 'in 1 week' },
  { value: '2w', ko: '2주 후', en: 'in 2 weeks' },
  { value: '1m', ko: '1달 후', en: 'in 1 month' },
];

export function DecisionContractCard({
  project,
  sealable = true,
  livePredicates,
}: {
  project: Project;
  /** Only offer to SEAL once the voyage is actually finished. */
  sealable?: boolean;
  /** Live (progressive) path: predicates derived from the session, supplied
   *  directly. When provided, the card seals/offers from these instead of
   *  reading the legacy recast/feedback storage (which the live voyage never
   *  writes). Absent → legacy /project behavior (read from storage). */
  livePredicates?: Predicate[] | null;
}) {
  const locale = useLocale();
  const ko = locale === 'ko';
  const L = (k: string, e: string) => (ko ? k : e);
  const updateProject = useProjectStore((s) => s.updateProject);
  const personas = usePersonaStore((s) => s.personas);

  const [checkIn, setCheckIn] = useState<CheckInInterval>('2w');
  const [sealOpen, setSealOpen] = useState(false);
  const [gradeOpen, setGradeOpen] = useState(false);
  const [rescheduleOpen, setRescheduleOpen] = useState(false); // change the check-in date before it's due

  const contract = project.decision_contract ?? null;

  // Live path supplies predicates directly; legacy path reads them from storage.
  const live = !!livePredicates;

  const sources: PredicateSources = useMemo(() => {
    if (live) return { recast: null, feedbacks: [] }; // unused in live mode
    const recasts = getStorage<RecastItem[]>(STORAGE_KEYS.RECAST_LIST, []).filter(
      (r) => r.project_id === project.id,
    );
    const feedbacks = getStorage<FeedbackRecord[]>(STORAGE_KEYS.FEEDBACK_HISTORY, []).filter(
      (f) => f.project_id === project.id,
    );
    return {
      recast: recasts.length ? recasts[recasts.length - 1] : null,
      feedbacks,
      personaName: (id) => personas.find((p) => p.id === id)?.name,
    };
  }, [live, project.id, personas]);

  // Fresh, unsealed contract from whichever source applies. `now` injected by caller.
  const buildFresh = (now: number): ReturnType<typeof generateDecisionContract> =>
    livePredicates
      ? contractFromPredicates(project.id, livePredicates, now)
      : generateDecisionContract(project.id, sources, now);

  // Candidate only when the voyage is finished AND there's something to predict.
  const candidate = useMemo(
    () => (contract || !sealable ? null : buildFresh(Date.now())),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [contract, sealable, sources, livePredicates, project.id],
  );

  // NOT memoised on time — `checkInDue` depends on the wall clock; recompute each
  // render so the nudge appears as soon as the date passes (no stale gate).
  const status = contract ? contractStatus(contract, Date.now()) : null;

  function seal() {
    const now = Date.now();
    const fresh = buildFresh(now);
    if (!fresh) return;
    updateProject(project.id, { decision_contract: withCheckIn(fresh, checkIn, now) });
    setSealOpen(false);
  }

  function grade(predicateId: string, verdict: PredicateVerdict) {
    if (!contract) return;
    updateProject(project.id, {
      decision_contract: gradePredicate(contract, predicateId, verdict, Date.now()),
    });
  }

  /** Optional second tap on a win: the user's own read (luck vs. judgment). */
  function setBasis(predicateId: string, basis: PredicateBasis, selected: boolean) {
    if (!contract) return;
    updateProject(project.id, {
      decision_contract: setPredicateBasis(contract, predicateId, selected ? undefined : basis),
    });
  }

  function fmtDate(iso?: string): string {
    if (!iso) return '';
    const d = new Date(iso);
    const opts: Intl.DateTimeFormatOptions = { month: 'long', day: 'numeric' };
    // A promise that crosses the year boundary must say which year it means.
    if (d.getFullYear() !== new Date().getFullYear()) opts.year = 'numeric';
    return d.toLocaleDateString(ko ? 'ko-KR' : 'en-US', opts);
  }

  if (!contract && !candidate) return null;

  // ════ State 1: SEAL ════
  if (!contract && candidate) {
    return (
      <Card className="border-[var(--accent)]/30">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-[var(--ai)] text-[var(--accent)] flex items-center justify-center shrink-0">
            <Sparkles size={18} />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-[15px] font-bold text-[var(--text-primary)]">
              {L('이 결정, 나중에 어떻게 됐는지 물어봐 드릴까요?', 'Want me to ask you later how this turned out?')}
            </h3>
            <p className="text-[12.5px] text-[var(--text-secondary)] mt-1 leading-[1.55]">
              {L(
                '정한 날에 이 결정으로 한 번 돌아와, 실제로 어떻게 됐는지 직접 확인하는 거예요 — 판단의 고리를 닫는 일이죠.',
                "On the day you choose, you'll come back to this decision and check, for yourself, how it actually went — closing the loop on your own call.",
              )}
            </p>

            {!sealOpen ? (
              <button
                onClick={() => setSealOpen(true)}
                className="mt-3 text-[12.5px] font-semibold text-[var(--accent)] hover:underline inline-flex items-center gap-1 cursor-pointer"
              >
                {L('그날 물어볼 것들 보기', 'See what I’ll ask')} <ChevronDown size={14} />
              </button>
            ) : (
              <div className="mt-3 space-y-3">
                <PredicateList predicates={candidate.predicates} ko={ko} />
                <div>
                  <p className="text-[12px] font-semibold text-[var(--text-secondary)] mb-1.5">
                    {L('결과를 언제 확인하러 올까요?', 'When will you come back to check?')}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {INTERVALS.map((iv) => (
                      <button
                        key={iv.value}
                        onClick={() => setCheckIn(iv.value)}
                        className={`px-3 py-1.5 rounded-lg text-[12.5px] font-medium border transition-colors cursor-pointer ${
                          checkIn === iv.value
                            ? 'border-[var(--accent)] bg-[var(--ai)] text-[var(--accent)]'
                            : 'border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--text-secondary)]/40'
                        }`}
                      >
                        {L(iv.ko, iv.en)}
                      </button>
                    ))}
                  </div>
                </div>
                <Button variant="primary" size="sm" onClick={seal}>
                  {L('네 — 그날 물어봐 주세요', "Yes — ask me that day")}
                </Button>
              </div>
            )}
          </div>
        </div>
      </Card>
    );
  }

  const predicates = Array.isArray(contract!.predicates) ? contract!.predicates : [];

  // ════ State 4: VERIFIED ════
  // P2: allow re-grading a mistaken verdict — when gradeOpen, fall through to the
  // grade panel below instead of the read-only verified card (gradePredicate already
  // supports re-grading back to pending).
  if (status!.allGraded && !gradeOpen) {
    const g = summarizeGrades(contract!);
    const parts = [
      g.risksAvoided > 0 && L(`위험 ${g.risksAvoided}개 회피`, `${g.risksAvoided} risk${g.risksAvoided === 1 ? '' : 's'} avoided`),
      g.risksHappened > 0 && L(`${g.risksHappened}개 발생`, `${g.risksHappened} hit`),
      g.betsHeld > 0 && L(`가설 ${g.betsHeld}개 적중`, `${g.betsHeld} bet${g.betsHeld === 1 ? '' : 's'} held`),
      // The user's own read — a lucky win isn't a judgment win (R17).
      g.goodOutcomesOnLuck > 0 && L(`그중 운 ${g.goodOutcomesOnLuck}개`, `${g.goodOutcomesOnLuck} on luck`),
      // Draft-accepted verdicts disclosed — a rubber-stamped win isn't self-verified.
      (g.betsHeldAiDrafted + g.risksAvoidedAiDrafted) > 0 && L(`그중 초안 ${g.betsHeldAiDrafted + g.risksAvoidedAiDrafted}개`, `${g.betsHeldAiDrafted + g.risksAvoidedAiDrafted} from a draft`),
      g.unknown > 0 && L(`${g.unknown}개 미정`, `${g.unknown} unresolved`),
    ].filter(Boolean);
    return (
      <Card className="border-[var(--success)]/30">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-[var(--collab)] text-[var(--success)] flex items-center justify-center shrink-0">
            <Check size={18} strokeWidth={2.5} />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-[15px] font-bold text-[var(--text-primary)]">
              {L('검증된 항해', 'Verified voyage')}
            </h3>
            <p className="text-[12.5px] text-[var(--text-secondary)] mt-1 leading-[1.55]">
              {parts.length > 0
                ? parts.join(' · ')
                : L(`예측 ${predicates.length}개 확인 완료`, `${predicates.length} predictions checked`)}
            </p>
            <div className="mt-3">
              <PredicateList predicates={predicates} ko={ko} showVerdict />
            </div>
            <button
              onClick={() => setGradeOpen(true)}
              className="mt-2 text-[11.5px] text-[var(--text-tertiary)] hover:text-[var(--accent)] cursor-pointer transition-colors"
            >
              {L('잘못 표시했어요 — 고치기', 'Marked one wrong — edit')}
            </button>
          </div>
        </div>
      </Card>
    );
  }

  // ════ States 2 & 3: WAITING / GRADE ════
  const due = status!.checkInDue;
  const showGrades = due || gradeOpen;
  return (
    <Card className={due ? 'border-[var(--accent)]/50' : 'border-[var(--border)]'}>
      <div className="flex items-start gap-3">
        <div
          className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
            due ? 'bg-[var(--ai)] text-[var(--accent)]' : 'bg-[var(--bg)] text-[var(--text-secondary)]'
          }`}
        >
          {due ? <Sparkles size={18} /> : <Clock size={18} />}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-[15px] font-bold text-[var(--text-primary)]">
            {due
              ? L(`물어볼 게 ${status!.pending}개 있어요`, `${status!.pending} question${status!.pending === 1 ? '' : 's'} for you`)
              : L('예측 봉인됨', 'Predictions sealed')}
          </h3>
          <p className="text-[12.5px] text-[var(--text-secondary)] mt-1 leading-[1.55]">
            {due
              ? L('그때 이렇게 예측했죠. 실제로는 어땠나요?', 'Here is what you predicted. How did it actually turn out?')
              : contract!.check_in_at
              ? L(
                  `${fmtDate(contract!.check_in_at)}에 확인 예정 · 예측 ${predicates.length}개`,
                  `Check-in ${fmtDate(contract!.check_in_at)} · ${predicates.length} predictions`,
                )
              : L(`예측 ${predicates.length}개 · 언제든 확인`, `${predicates.length} predictions · check anytime`)}
          </p>

          {/* Change the check-in date BEFORE it's due (was only possible as an
              "아직"-extend AFTER the date arrived). amendCheckIn keeps the old date in
              history (변침도 기록이다). */}
          {!due && !showGrades && (
            <div className="mt-2">
              {!rescheduleOpen ? (
                <button
                  onClick={() => setRescheduleOpen(true)}
                  className="text-[11.5px] text-[var(--text-tertiary)] hover:text-[var(--accent)] cursor-pointer transition-colors"
                >
                  {L('날짜 바꾸기', 'Change the date')}
                </button>
              ) : (
                <div className="flex flex-wrap items-center gap-1.5">
                  {INTERVALS.map((iv) => (
                    <button
                      key={iv.value}
                      onClick={() => {
                        updateProject(project.id, { decision_contract: amendCheckIn(contract!, iv.value, Date.now()) });
                        setRescheduleOpen(false);
                      }}
                      className="px-2.5 py-1 rounded-lg text-[11.5px] font-medium border border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--accent)]/40 cursor-pointer transition-colors"
                    >
                      {L(iv.ko, iv.en)}
                    </button>
                  ))}
                  <button onClick={() => setRescheduleOpen(false)} className="text-[11.5px] text-[var(--text-tertiary)] hover:underline cursor-pointer">
                    {L('취소', 'Cancel')}
                  </button>
                </div>
              )}
            </div>
          )}

          {!showGrades && (
            <div className="mt-3 flex items-center gap-3 flex-wrap">
              <button
                onClick={() => setGradeOpen(true)}
                className="text-[12.5px] font-semibold text-[var(--accent)] hover:underline inline-flex items-center gap-1 cursor-pointer"
              >
                {L('지금 확인하기', 'Check now')} <ChevronDown size={14} />
              </button>
              {/* Unseal — cancel the whole commitment so it can be re-edited / re-sealed
                  (distinct from delete, which removes the decision entirely). The card
                  falls back to its SEAL state if predicates are still derivable. */}
              <button
                onClick={() => {
                  if (window.confirm(L('봉인을 취소할까요? 예측·확인일이 지워지고 다시 봉인할 수 있어요.', 'Unseal this? Its predictions & check-in date clear, and you can seal again.'))) {
                    updateProject(project.id, { decision_contract: undefined });
                  }
                }}
                className="text-[11.5px] text-[var(--text-tertiary)] hover:text-[var(--accent)] cursor-pointer transition-colors"
              >
                {L('봉인 취소', 'Unseal')}
              </button>
            </div>
          )}

          {showGrades && (
            <div className="mt-3 space-y-2.5">
              {predicates.map((p) => {
                const Icon = SOURCE_ICON[p.source] ?? AlertTriangle;
                return (
                  <div key={p.id} className="rounded-lg border border-[var(--border)] p-2.5 bg-[var(--surface)]">
                    <div className="flex items-start gap-2">
                      <Icon size={13} className="text-[var(--text-tertiary)] mt-0.5 shrink-0" />
                      <p className="text-[13px] text-[var(--text-primary)] leading-[1.5] flex-1 min-w-0">
                        {predicateQuestion(p, ko)}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-1.5 mt-2 pl-[21px]">
                      {verdictButtons(p.source, ko).map((v) => {
                        const selected = p.verdict === v.value;
                        return (
                          <button
                            key={v.value}
                            onClick={() => grade(p.id, selected ? 'pending' : v.value)}
                            className={`px-3 py-2.5 min-h-[44px] rounded-md text-[13px] font-semibold border transition-colors cursor-pointer ${
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
                    {/* Optional "luck or judgment?" tap on a win — never required
                        (R17). Same single-source helpers as the settlement modal. */}
                    {isCreditClaimingOutcome(p) && (
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
                                className={`px-2.5 py-2 min-h-[40px] rounded-md text-[12.5px] font-medium border transition-colors cursor-pointer ${
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
                    )}
                  </div>
                );
              })}
              {status!.graded > 0 && (
                <p className="text-[11.5px] text-[var(--text-tertiary)] pt-0.5">
                  {L(`${status!.graded}/${status!.total} 확인했어요`, `${status!.graded}/${status!.total} checked`)}
                </p>
              )}
              {gradeOpen && !due && (
                <button
                  onClick={() => setGradeOpen(false)}
                  className="text-[11.5px] font-semibold text-[var(--accent)] hover:underline cursor-pointer"
                >
                  {L('완료', 'Done')}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}

/** Read-only predicate list (framed as questions); optionally shows the graded verdict label. */
function PredicateList({
  predicates,
  ko,
  showVerdict,
}: {
  predicates: Predicate[];
  ko: boolean;
  showVerdict?: boolean;
}) {
  return (
    <ul className="space-y-1.5">
      {predicates.map((p) => {
        const Icon = SOURCE_ICON[p.source] ?? AlertTriangle;
        const v = p.verdict ? verdictButtons(p.source, ko).find((x) => x.value === p.verdict) : undefined;
        return (
          <li key={p.id} className="flex items-start gap-2 text-[13px] text-[var(--text-primary)] leading-[1.5]">
            <Icon size={13} className="text-[var(--text-tertiary)] mt-0.5 shrink-0" />
            <span className="flex-1 min-w-0">{predicateQuestion(p, ko)}</span>
            {showVerdict && v && (
              <span className="text-[11px] font-semibold text-[var(--accent)] shrink-0 whitespace-nowrap">{v.label}</span>
            )}
          </li>
        );
      })}
    </ul>
  );
}
