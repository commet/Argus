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
  PredicateSource,
  Predicate,
} from '@/stores/types';
import {
  generateDecisionContract,
  contractFromPredicates,
  withCheckIn,
  gradePredicate,
  contractStatus,
  summarizeGrades,
  type PredicateSources,
} from '@/lib/decision-contract';

const SOURCE_ICON: Record<PredicateSource, typeof Target> = {
  governing_idea: Target,
  risk: AlertTriangle,
  actor: GitBranch,
};

type Verdict = Exclude<PredicateVerdict, 'pending'>;

/** Per-source verdict buttons. Same stored value, source-appropriate label, so
 *  "happened" reads as "발생" for a risk but "적중" for a bet. `unknown` is always last. */
function verdictButtons(source: PredicateSource, ko: boolean): { value: Verdict; label: string }[] {
  const partial = { value: 'partial' as const, label: ko ? '부분' : 'Partial' };
  const unknown = { value: 'unknown' as const, label: ko ? '아직 모름' : 'Unknown' };
  if (source === 'governing_idea') {
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

/** Frame the raw subject as a yes/no-checkable question per source. */
function predicateQuestion(p: Predicate, ko: boolean): string {
  if (p.source === 'governing_idea') return ko ? `핵심 가설이 맞았나 — ${p.text}` : `Did the bet hold — ${p.text}`;
  if (p.source === 'actor') return ko ? `사람 판단이 필요했나 — ${p.text}` : `Did this need human judgment — ${p.text}`;
  return ko ? `실제로 일어났나 — ${p.text}` : `Did it happen — ${p.text}`;
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

  function fmtDate(iso?: string): string {
    if (!iso) return '';
    return new Date(iso).toLocaleDateString(ko ? 'ko-KR' : 'en-US', { month: 'long', day: 'numeric' });
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
              {L('이 결정을 예측으로 봉인하기', 'Seal this decision as predictions')}
            </h3>
            <p className="text-[12.5px] text-[var(--text-secondary)] mt-1 leading-[1.55]">
              {L(
                `이번 항해에서 당신은 ${candidate.predicates.length}가지를 예측했습니다. 정한 날짜에 다시 와서, 실제로 맞았는지 스스로 확인하세요 — 판단의 고리를 닫는 일입니다.`,
                `You made ${candidate.predicates.length} predictions this voyage. Come back on your chosen date and check, for yourself, whether they held — closing the loop on your own call.`,
              )}
            </p>

            {!sealOpen ? (
              <button
                onClick={() => setSealOpen(true)}
                className="mt-3 text-[12.5px] font-semibold text-[var(--accent)] hover:underline inline-flex items-center gap-1 cursor-pointer"
              >
                {L('예측 보기 & 봉인', 'Review & seal')} <ChevronDown size={14} />
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
                  {L('약속하고 봉인', 'Commit & seal')}
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
  if (status!.allGraded) {
    const g = summarizeGrades(contract!);
    const parts = [
      g.risksAvoided > 0 && L(`위험 ${g.risksAvoided}개 회피`, `${g.risksAvoided} risk${g.risksAvoided === 1 ? '' : 's'} avoided`),
      g.risksHappened > 0 && L(`${g.risksHappened}개 발생`, `${g.risksHappened} hit`),
      g.betsHeld > 0 && L(`가설 ${g.betsHeld}개 적중`, `${g.betsHeld} bet${g.betsHeld === 1 ? '' : 's'} held`),
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
                : L(`예측 ${predicates.length}개 채점 완료`, `${predicates.length} predictions graded`)}
            </p>
            <div className="mt-3">
              <PredicateList predicates={predicates} ko={ko} showVerdict />
            </div>
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
              ? L(`예측 ${status!.pending}개, 채점할 시간입니다`, `${status!.pending} predictions — time to score`)
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
              : L(`예측 ${predicates.length}개 · 언제든 채점`, `${predicates.length} predictions · grade anytime`)}
          </p>

          {!showGrades && (
            <button
              onClick={() => setGradeOpen(true)}
              className="mt-3 text-[12.5px] font-semibold text-[var(--accent)] hover:underline inline-flex items-center gap-1 cursor-pointer"
            >
              {L('지금 채점하기', 'Grade now')} <ChevronDown size={14} />
            </button>
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
              {status!.graded > 0 && (
                <p className="text-[11.5px] text-[var(--text-tertiary)] pt-0.5">
                  {L(`${status!.graded}/${status!.total} 채점됨`, `${status!.graded}/${status!.total} graded`)}
                </p>
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
