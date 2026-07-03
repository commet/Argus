'use client';

import { useEffect, useMemo, useState } from 'react';
import { useProjectStore } from '@/stores/useProjectStore';
import { useReframeStore } from '@/stores/useReframeStore';
import { useRecastStore } from '@/stores/useRecastStore';
import { useSynthesizeStore } from '@/stores/useSynthesizeStore';
import { usePersonaStore } from '@/stores/usePersonaStore';
import { useJudgmentStore } from '@/stores/useJudgmentStore';
import { useProgressiveStore } from '@/stores/useProgressiveStore';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { CopyButton } from '@/components/ui/CopyButton';
import { generateProjectBrief } from '@/lib/project-brief';
import { OutputSelector } from '@/components/ui/OutputSelector';
import { ExecutionReadiness } from '@/components/ui/ExecutionReadiness';
import { LocaleLink } from '@/components/ui/LocaleLink';
import { Layers, Map as MapIcon, Users, FileText, Check, ArrowRight, Download, Sparkles, Plus, Search, GitBranch, Scale, AlertTriangle, MessageSquare } from 'lucide-react';
import { useLocale } from '@/hooks/useLocale';
import { VoyageShip, Graticule } from '@/components/ui/VoyageElements';
import { getVoyageState, VOYAGE_STATE_META, type VoyageLeg } from '@/lib/voyage-state';
import { DecisionContractCard } from '@/components/projects/DecisionContractCard';
import { DecisionItemsCard } from '@/components/projects/DecisionItemsCard';
import { SettlementModal } from '@/components/projects/SettlementModal';
import { contractStatus, summarizeRecord } from '@/lib/decision-contract';
import { RecordStrip } from '@/components/ui/RecordStrip';
import { RetroOnlyNotice } from '@/components/ui/RetroOnlyNotice';
import { FleetChart } from '@/components/projects/FleetChart';
import { Logbook } from '@/components/projects/Logbook';
import { useDueCount } from '@/hooks/useDueCount';
import { VoyageEta } from '@/components/workspace/VoyageEta';
import { deriveCurrentBearing } from '@/lib/current-bearing';
import { CurrentBearingCard } from '@/components/workspace/progressive/CurrentBearingCard';

// Hick's law (05 S7): filter chips + search only earn their place once the
// list outgrows a single screen.
const FILTER_TOOLS_MIN = 7;

const STEP_LABELS_KO = ['재정의', '설계', '검증', '종합'] as const;
const STEP_LABELS_EN = ['Reframe', 'Recast', 'Rehearse', 'Synth'] as const;

// Project-page step index → voyage leg (page order: reframe, recast, rehearse, synthesize)
const STEP_IDX_TO_LEG: ReadonlyArray<VoyageLeg> = ['reframe', 'recast', 'rehearse', 'synthesize'];

// Voyage state tone → pill styling (keeps the label color in sync with the ship)
const VOYAGE_TONE_CLS: Record<string, string> = {
  neutral: 'bg-[var(--bg)] text-[var(--text-tertiary)]',
  active: 'bg-[var(--accent)]/10 text-[var(--accent)]',
  warning: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  danger: 'bg-[var(--danger)]/10 text-[var(--danger)]',
  arrived: 'bg-[var(--collab)] text-[var(--success)]',
  gold: 'text-[var(--accent)]',
};

type ToolStatus = 'done' | 'in-progress' | 'not-started';
type StatusFilter = 'all' | 'active' | 'done' | 'new';

function relativeDate(dateStr: string | undefined, locale: 'ko' | 'en'): string {
  if (!dateStr) return '';
  const then = new Date(dateStr).getTime();
  if (Number.isNaN(then)) return '';
  const diff = (Date.now() - then) / 1000;
  if (diff < 60) return locale === 'ko' ? '방금' : 'just now';
  if (diff < 3600) return locale === 'ko' ? `${Math.floor(diff / 60)}분 전` : `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return locale === 'ko' ? `${Math.floor(diff / 3600)}시간 전` : `${Math.floor(diff / 3600)}h ago`;
  if (diff < 7 * 86400) return locale === 'ko' ? `${Math.floor(diff / 86400)}일 전` : `${Math.floor(diff / 86400)}d ago`;
  return new Date(dateStr).toLocaleDateString(locale === 'ko' ? 'ko-KR' : 'en-US');
}

interface StepStatus {
  tool: string;
  label: string;
  icon: React.ReactNode;
  href: string;
  status: 'done' | 'in-progress' | 'not-started';
  summary?: string;
  color: string;
  bgColor: string;
}

export default function ProjectPage() {
  const locale = useLocale();
  const L = (ko: string, en: string) => locale === 'ko' ? ko : en;
  const { projects, currentProjectId, loadProjects, setCurrentProjectId } = useProjectStore();
  const { items: reframeItems, loadItems: loadReframe } = useReframeStore();
  const { items: recastItems, loadItems: loadRecast } = useRecastStore();
  const { items: synthesizeItems, loadItems: loadSynthesize } = useSynthesizeStore();
  const { feedbackHistory, loadData: loadPersona } = usePersonaStore();
  const { judgments, loadJudgments, getUserPatterns } = useJudgmentStore();
  const { sessions: progressiveSessions, loadSessions: loadProgressive } = useProgressiveStore();
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  // ?from=checkin — arrived via a check-in reminder email. On a logged-out /
  // fresh device the generic new-user empty state would read as "your sealed
  // decision is gone"; greet the returner honestly instead (03 S5 / P1-B2).
  const [fromCheckin, setFromCheckin] = useState(false);
  useEffect(() => {
    setFromCheckin(new URLSearchParams(window.location.search).get('from') === 'checkin');
  }, []);
  // Settlement modal (W1.2 귀환 표면) — derived at render from contractStatus,
  // gated by a per-visit dismissed set. Deriving (instead of a getState()
  // snapshot in an effect) means the modal still opens when the async Supabase
  // merge lands AFTER the project is selected — once per project per visit.
  const [settleDismissed, setSettleDismissed] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadProjects();
    loadReframe();
    loadRecast();
    loadSynthesize();
    loadPersona();
    loadJudgments();
    loadProgressive();
  }, [loadProjects, loadReframe, loadRecast, loadSynthesize, loadPersona, loadJudgments, loadProgressive]);

  const currentProject = currentProjectId ? projects.find((p) => p.id === currentProjectId) : null;

  // Opening a project whose contract is due → surface the settle question.
  // ARM-once, close-only-on-onClose: deriving open purely from checkInDue
  // killed the modal the instant the LAST verdict landed (allGraded flips
  // checkInDue false on that very render), so the "고리를 닫았어요" reward
  // screen was unreachable dead code (adversarial review P0 #3). The arm
  // effect still fires when the async Supabase merge lands late.
  const [settleOpenId, setSettleOpenId] = useState<string | null>(null);
  const settleDueNow = !!(
    currentProject?.decision_contract &&
    contractStatus(currentProject.decision_contract, Date.now()).checkInDue
  );
  useEffect(() => {
    if (currentProject && settleDueNow && !settleDismissed.has(currentProject.id)) {
      setSettleOpenId(currentProject.id);
    }
  }, [currentProject, settleDueNow, settleDismissed]);
  const settleOpen = !!currentProject && settleOpenId === currentProject.id;

  /* ─── Per-project rich metrics (used in list view) ─── */
  interface ProjectMetrics {
    statuses: ToolStatus[];
    completedSteps: number;
    hasProgress: boolean;
    isDone: boolean;
    questionExcerpt: string | null;
    stepCount: number;
    aiRatio: number | null;
    humanRatio: number | null;
    reviewerCount: number;
    riskCount: number;
    lastActivityStepIdx: number;
    lastActivityAt: string;
    // Progressive-voyage + contract truth. The legacy hasProgress/isDone read ONLY
    // the dead 4-tool stores; a progressive voyage (the real flow) + seal/settle
    // write to decision_contract / the progressive session, so status MUST derive
    // from these or a sealed+settled project reads as "출항 전" forever.
    hasVoyage: boolean;
    voyageComplete: boolean;
    contractSealed: boolean;
    contractAllGraded: boolean;
    /** started ∪ progressive ∪ sealed — the honest "underway" signal. */
    startedEff: boolean;
    /** legacy-done ∪ voyage-complete ∪ settled — the honest "done" signal. */
    doneEff: boolean;
  }

  const projectMetricsMap = useMemo(() => {
    const map = new Map<string, ProjectMetrics>();
    for (const p of projects) {
      const r = reframeItems.filter((d) => d.project_id === p.id);
      const rc = recastItems.filter((o) => o.project_id === p.id);
      const sy = synthesizeItems.filter((s) => s.project_id === p.id);
      const fb = feedbackHistory.filter((f) => f.project_id === p.id);
      const lastR = r[r.length - 1];
      const lastRc = rc[rc.length - 1];
      const lastF = fb[fb.length - 1];
      const lastS = sy[sy.length - 1];

      const statuses: ToolStatus[] = [
        lastR?.status === 'done' ? 'done' : lastR ? 'in-progress' : 'not-started',
        lastRc?.status === 'done' ? 'done' : lastRc ? 'in-progress' : 'not-started',
        lastF ? 'done' : 'not-started',
        sy.length > 0 ? 'done' : 'not-started',
      ];
      const completedSteps = statuses.filter((s) => s === 'done').length;
      const isDone = completedSteps === 4;
      const hasProgress = completedSteps > 0 || statuses.some((s) => s === 'in-progress');

      // Progressive + contract truth (the real flow). allGraded is time-independent
      // (total>0 && pending===0), so a constant `now` is safe inside this memo.
      const voyageSession = progressiveSessions.find((s) => s.project_id === p.id);
      const contractSealed = !!p.decision_contract;
      const contractAllGraded = p.decision_contract ? contractStatus(p.decision_contract, 0).allGraded : false;
      const voyageComplete = voyageSession?.phase === 'complete';
      const hasVoyage = !!voyageSession || contractSealed;
      const startedEff = hasProgress || hasVoyage;
      const doneEff = isDone || voyageComplete || contractAllGraded;

      // Content excerpt — what the user is actually working on
      const questionExcerpt =
        lastR?.selected_question || lastR?.analysis?.surface_task || null;

      // Workflow shape
      const stepCount = lastRc?.steps?.length || 0;
      const aiRatio =
        typeof lastRc?.analysis?.ai_ratio === 'number' ? Math.round(lastRc.analysis.ai_ratio * 100) : null;
      const humanRatio =
        typeof lastRc?.analysis?.human_ratio === 'number' ? Math.round(lastRc.analysis.human_ratio * 100) : null;

      // Reviewer count — unique persona ids across all feedback runs
      const reviewerSet = new Set<string>();
      for (const f of fb) for (const pid of f.persona_ids || []) reviewerSet.add(pid);
      const reviewerCount = reviewerSet.size;

      // Risk count — critical risks from rehearsal + high-severity findings from recast review
      let riskCount = 0;
      for (const result of lastF?.results || []) {
        for (const rr of result.classified_risks || []) {
          if (rr.category === 'critical') riskCount++;
        }
      }
      const reviews = lastRc?.analysis?.reviews || [];
      for (const rv of reviews) {
        for (const f of rv.findings || []) {
          if (f.severity === 'high' && (f.type === 'gap' || f.type === 'risk')) riskCount++;
        }
      }

      // Last activity — find the most-recently-touched tool
      const candidates: Array<{ idx: number; at: string }> = [];
      if (lastR?.updated_at || lastR?.created_at) candidates.push({ idx: 0, at: lastR.updated_at || lastR.created_at });
      if (lastRc?.updated_at || lastRc?.created_at) candidates.push({ idx: 1, at: lastRc.updated_at || lastRc.created_at });
      if (lastF?.created_at) candidates.push({ idx: 2, at: lastF.created_at });
      if (lastS?.created_at) candidates.push({ idx: 3, at: lastS.created_at });
      candidates.sort((a, b) => b.at.localeCompare(a.at));
      const lastActivityStepIdx = candidates[0]?.idx ?? -1;
      const lastActivityAt = candidates[0]?.at || p.updated_at || p.created_at || '';

      map.set(p.id, {
        statuses,
        completedSteps,
        hasProgress,
        isDone,
        questionExcerpt,
        stepCount,
        aiRatio,
        humanRatio,
        reviewerCount,
        riskCount,
        lastActivityStepIdx,
        lastActivityAt,
        hasVoyage,
        voyageComplete,
        contractSealed,
        contractAllGraded,
        startedEff,
        doneEff,
      });
    }
    return map;
  }, [projects, reframeItems, recastItems, synthesizeItems, feedbackHistory, progressiveSessions]);

  const stats = useMemo(() => {
    let inProgress = 0;
    let done = 0;
    let untouched = 0;
    for (const p of projects) {
      const m = projectMetricsMap.get(p.id);
      if (!m) continue;
      if (m.doneEff) done++;
      else if (m.startedEff) inProgress++;
      else untouched++;
    }
    return { total: projects.length, inProgress, done, untouched };
  }, [projects, projectMetricsMap]);

  // What is due for the user's return — the 귀환 (return) surface. Shared hook
  // (P0-6 ④): Header badge, this strip and the workspace lantern all read
  // useDueCount, so the numbers can never drift. Review receipts past their
  // check-by join the same strip (P0-6 ① — one harbor), rendered as chips that
  // route to /tools/review where ReceiptList already sorts urgent first.
  const { dueProjects, dueReceipts } = useDueCount();
  // Recomputed per render on purpose (the hook is un-memoized so midnight
  // flips the count) — cheap on a small list; memos below key on a stable id
  // string so they don't re-sort every render.
  const dueIds = new Set(dueProjects.map((p) => p.id));
  const dueKey = dueProjects.map((p) => p.id).sort().join('|');

  const sortedProjects = useMemo(() => {
    const dueIds = new Set(dueKey.split('|').filter(Boolean));
    return [...projects].sort((a, b) => {
      // Due contracts surface first — the product's promise is the return.
      const ad = dueIds.has(a.id) ? 1 : 0;
      const bd = dueIds.has(b.id) ? 1 : 0;
      if (ad !== bd) return bd - ad;
      const am = projectMetricsMap.get(a.id);
      const bm = projectMetricsMap.get(b.id);
      const at = am?.lastActivityAt || a.updated_at || a.created_at || '';
      const bt = bm?.lastActivityAt || b.updated_at || b.created_at || '';
      return bt.localeCompare(at);
    });
  }, [projects, projectMetricsMap, dueKey]);

  const filteredProjects = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = sortedProjects;
    if (statusFilter !== 'all') {
      list = list.filter((p) => {
        const m = projectMetricsMap.get(p.id);
        if (!m) return false;
        if (statusFilter === 'active') return m.startedEff && !m.doneEff;
        if (statusFilter === 'done') return m.doneEff;
        if (statusFilter === 'new') return !m.startedEff;
        return true;
      });
    }
    if (q) list = list.filter((p) => p.name.toLowerCase().includes(q));
    return list;
  }, [sortedProjects, query, statusFilter, projectMetricsMap]);

  // Get items for current project
  const projectReframes = reframeItems.filter((d) => d.project_id === currentProjectId);
  const projectRecasts = recastItems.filter((o) => o.project_id === currentProjectId);
  const projectSyntheses = synthesizeItems.filter((s) => s.project_id === currentProjectId);
  const projectFeedbacks = feedbackHistory.filter((f) => f.project_id === currentProjectId);

  const getSteps = (): StepStatus[] => {
    const latestReframe = projectReframes[projectReframes.length - 1];
    const latestRecast = projectRecasts[projectRecasts.length - 1];
    const latestFeedback = projectFeedbacks[projectFeedbacks.length - 1];

    return [
      {
        tool: 'reframe',
        label: L('문제 재정의', 'Reframe'),
        icon: <Layers size={18} />,
        href: '/workspace?step=reframe',
        status: latestReframe?.status === 'done' ? 'done' : latestReframe ? 'in-progress' : 'not-started',
        summary: latestReframe?.selected_question || latestReframe?.analysis?.surface_task,
        color: 'text-[#2d4a7c]',
        bgColor: 'bg-[var(--ai)]',
      },
      {
        tool: 'recast',
        label: L('실행 설계', 'Recast'),
        icon: <MapIcon size={18} />,
        href: '/workspace?step=recast',
        status: latestRecast?.status === 'done' ? 'done' : latestRecast ? 'in-progress' : 'not-started',
        summary: latestRecast?.analysis
          ? L(`${latestRecast.steps.length}단계 워크플로우`, `${latestRecast.steps.length}-step workflow`)
          : undefined,
        color: 'text-[#8b6914]',
        bgColor: 'bg-[var(--human)]',
      },
      {
        tool: 'rehearse',
        label: L('사전 검증', 'Rehearse'),
        icon: <Users size={18} />,
        href: '/workspace?step=rehearse',
        status: latestFeedback ? 'done' : 'not-started',
        summary: latestFeedback
          ? L(`${latestFeedback.results.length}명 피드백 완료`, `${latestFeedback.results.length} reviewer${latestFeedback.results.length === 1 ? '' : 's'} done`)
          : undefined,
        color: 'text-purple-700 dark:text-purple-300',
        bgColor: 'bg-purple-500/10',
      },
      {
        tool: 'synthesize',
        label: L('종합', 'Synthesize'),
        icon: <Sparkles size={18} />,
        href: '/workspace?step=synthesize',
        status: projectSyntheses.length > 0 ? 'done' : 'not-started',
        summary: projectSyntheses.length > 0
          ? L(`${projectSyntheses.length}건 종합 완료`, `${projectSyntheses.length} synthesis${projectSyntheses.length === 1 ? '' : 'es'} done`)
          : undefined,
        color: 'text-[#9b5de5]',
        bgColor: 'bg-[#9b5de5]/10',
      },
    ];
  };

  const steps = currentProject ? getSteps() : [];
  const completedSteps = steps.filter((s) => s.status === 'done').length;
  const nextStep = steps.find((s) => s.status !== 'done');

  // Progressive voyage status for the open project — a voyage writes nothing to
  // the legacy 4-tool stores, so the "다음 단계: 문제 재정의" CTA would
  // contradict a sealed/due contract right next to it. Suppress it and point
  // back to the workspace instead.
  const currentVoyageSession = currentProject
    ? progressiveSessions.find((s) => s.project_id === currentProject.id)
    : undefined;
  const currentHasVoyage = !!currentVoyageSession || !!currentProject?.decision_contract;
  // Settled (all predicates graded) → the voyage is VERIFIED, which outranks the
  // top pill saying "진행 중" next to a "검증된 항해" card just below it.
  const currentContractAllGraded = currentProject?.decision_contract
    ? contractStatus(currentProject.decision_contract, Date.now()).allGraded
    : false;
  const currentVoyageDone = currentContractAllGraded || (currentVoyageSession
    ? currentVoyageSession.phase === 'complete'
    : !!currentProject?.decision_contract);
  const currentVoyageStatusLabel = currentContractAllGraded
    ? L('검증된 항해', 'Verified voyage')
    : currentVoyageDone ? L('항해 완료', 'Voyage complete') : L('항해 진행 중', 'Voyage under way');
  // The decision's CONTENT — until now this page showed only process chrome
  // (progress %, steps, formats) and never WHAT was decided. The bearing is
  // the one-screen answer; it replaces the bare "항해 완료" status card.
  const currentBearing = currentVoyageSession ? deriveCurrentBearing(currentVoyageSession) : null;
  // 자차표 — the user's accumulating record across all projects. Quiet, factual.
  const crossRecord = summarizeRecord(projects, Date.now());

  return (
    <div className="space-y-6">
      {/* Page header — title row with primary action */}
      {!currentProject && (
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
          <div>
            <h1 className="text-[22px] font-bold text-[var(--text-primary)] tracking-tight">{L('프로젝트', 'Projects')}</h1>
            <p className="text-[13px] text-[var(--text-secondary)] mt-1">
              {L('떠난 결정과 돌아올 결정을 한눈에.', 'Decisions that set out, and decisions coming back — at a glance.')}
            </p>
          </div>
          {projects.length > 0 && (
            <LocaleLink
              href="/workspace"
              onClick={() => setCurrentProjectId(null)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[var(--bg)] text-[12.5px] font-semibold hover:shadow-[var(--shadow-md)] transition-all cursor-pointer self-start sm:self-auto"
              style={{ background: 'var(--gradient-gold)' }}
            >
              <Plus size={13} /> {L('새 프로젝트', 'New project')}
            </LocaleLink>
          )}
        </div>
      )}

      {currentProject && (
        <div>
          <h1 className="text-[22px] font-bold text-[var(--text-primary)]">{L('프로젝트 오버뷰', 'Project Overview')}</h1>
          <p className="text-[13px] text-[var(--text-secondary)] mt-1">
            {L('떠난 결정과 돌아올 결정을 한눈에.', 'Decisions that set out, and decisions coming back — at a glance.')}
          </p>
        </div>
      )}

      {/* Project selector */}
      {!currentProject && (
        <div className="space-y-5">
          {projects.length === 0 && fromCheckin ? (
            <Card className="text-center py-12">
              <FileText size={24} className="mx-auto text-[var(--text-secondary)] mb-3" />
              <p className="text-[14px] text-[var(--text-secondary)] font-medium">
                {L('봉인해 둔 결정이 이 기기엔 없어요', 'Your sealed decision isn’t on this device')}
              </p>
              <p className="text-[12px] text-[var(--text-secondary)] mt-1 max-w-xs mx-auto">
                {L('봉인할 때 쓴 계정으로 로그인하면 바로 보여요.', 'Sign in with the account you sealed it with and it’s right here.')}
              </p>
              <div className="mt-4 flex items-center justify-center">
                <LocaleLink href="/login?redirect=/project">
                  <button className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[var(--primary)] text-[var(--bg)] text-[13px] font-semibold hover:shadow-[var(--shadow-sm)] hover:-translate-y-[1px] active:translate-y-0 transition-all cursor-pointer">
                    {L('로그인', 'Sign in')} <ArrowRight size={14} />
                  </button>
                </LocaleLink>
              </div>
            </Card>
          ) : projects.length === 0 ? (
            <Card className="text-center py-12">
              <FileText size={24} className="mx-auto text-[var(--text-secondary)] mb-3" />
              <p className="text-[14px] text-[var(--text-secondary)] font-medium">{L('아직 항해 전이에요', 'Before the first voyage')}</p>
              <p className="text-[12px] text-[var(--text-secondary)] mt-1 max-w-xs mx-auto">
                {L('워크스페이스에서 첫 결정을 적으면, 여기가 그 결정이 돌아올 모항이 돼요. 확인일이 오면 이 페이지가 먼저 물어요 — 그래서, 어떻게 됐어요?', "Write your first decision in the workspace and this becomes its home port. When the check-in day comes, this page asks first — so, how did it go?")}
              </p>
              <div className="mt-4 flex items-center justify-center gap-2 flex-wrap">
                <LocaleLink href="/workspace">
                  <button className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[var(--primary)] text-[var(--bg)] text-[13px] font-semibold hover:shadow-[var(--shadow-sm)] hover:-translate-y-[1px] active:translate-y-0 transition-all cursor-pointer">
                    {L('워크스페이스에서 시작하기', 'Start in workspace')} <ArrowRight size={14} />
                  </button>
                </LocaleLink>
                <LocaleLink href="/workspace?demo=planning" className="text-[12px] text-[var(--text-tertiary)] hover:text-[var(--accent)] transition-colors">
                  {L('또는 30초 데모 먼저 보기 →', 'Or see a 30-second demo first →')}
                </LocaleLink>
              </div>
            </Card>
          ) : (
            <>
              {/* 자차표 — the user's accumulating record of closed loops.
                  Until now this only flashed once inside the settlement modal
                  and vanished; this is where it LIVES. Facts, never a score.
                  P1-A2 (08 S2): extracted to the shared <RecordStrip/> (one
                  display brain — /tools/review renders the SAME component, and
                  review-receipt settles now join the count). */}
              <RecordStrip />

              {/* [C4·항목7] 회고만 한 사용자용 빈 자차표 안내 — RecordStrip이 null인
                  (실 record 0) 상태에서 정산한 회고가 있을 때만. 빈 자차표가
                  배신처럼 안 보이게 하고, 실 봉인으로 한 번 가리킨다. */}
              <RetroOnlyNotice />

              {/* 함대 해도 (S4 최소형 · B1) — 봉인한 항해들이 한 폭의 해도 위에
                  봉인일 순으로 늘어선다. 2척 미만이면 스스로 미렌더. 상태별 그룹핑·
                  강조·카운트 배지 없이 시간축 하나만이 정렬키 (거울 조항 게이트). */}
              <FleetChart
                projects={projects}
                reframeItems={reframeItems}
                recastItems={recastItems}
                synthesizeItems={synthesizeItems}
                feedbackHistory={feedbackHistory}
                progressiveSessions={progressiveSessions}
                locale={locale}
                onSelect={setCurrentProjectId}
              />

              {/* 돌아올 결정 — the return strip. The loop's last leg: 귀환.
                  Review receipts past check-by join the SAME strip (P0-6 ① —
                  one harbor): same amber tone, a FileText mark to tell them
                  apart, routing to /tools/review (ReceiptList sorts urgent
                  first, so the destination doesn't lose them). No new
                  settlement UI — the two existing surfaces stay (§5-11). */}
              {dueProjects.length + dueReceipts.length > 0 && (
                <div className="rounded-xl border border-amber-500/30 bg-amber-500/[0.08] px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                  <p className="text-[13px] font-semibold text-[var(--text-primary)] shrink-0">
                    {locale === 'ko'
                      ? `그래서, 어떻게 됐어요? — 돌아올 결정 ${dueProjects.length + dueReceipts.length}건`
                      : `So, how did it go? — ${dueProjects.length + dueReceipts.length} decision${dueProjects.length + dueReceipts.length === 1 ? '' : 's'} to return to`}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {dueProjects.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => {
                          // Re-arm the settle question even if dismissed earlier this visit.
                          setSettleDismissed((prev) => {
                            const next = new Set(prev);
                            next.delete(p.id);
                            return next;
                          });
                          setCurrentProjectId(p.id);
                        }}
                        className="max-w-full truncate px-2.5 py-1 rounded-lg text-[12px] font-medium border border-amber-500/40 text-amber-700 dark:text-amber-400 hover:bg-amber-500/15 transition-colors cursor-pointer"
                      >
                        {p.name}
                      </button>
                    ))}
                    {(dueReceipts || []).map((r) => (
                      <LocaleLink
                        key={r.receipt_id}
                        href="/tools/review"
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[12px] font-medium border border-amber-500/40 text-amber-700 dark:text-amber-400 hover:bg-amber-500/15 transition-colors cursor-pointer max-w-full"
                      >
                        <FileText size={12} className="shrink-0" />
                        <span className="truncate">{r.source_title || L('검수한 문서', 'Reviewed document')}</span>
                      </LocaleLink>
                    ))}
                  </div>
                </div>
              )}

              {/* Filter chips + search — Hick (05 S7): below FILTER_TOOLS_MIN the
                  whole fleet fits one screen, so the tools would only add choices. */}
              {stats.total >= FILTER_TOOLS_MIN && (
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-1">
                <div className="flex items-center gap-1.5 flex-wrap">
                  {([
                    { key: 'all', label: L('전체', 'All'), count: stats.total },
                    { key: 'active', label: L('진행 중', 'Active'), count: stats.inProgress },
                    { key: 'done', label: L('완료', 'Done'), count: stats.done },
                    { key: 'new', label: L('시작 전', 'New'), count: stats.untouched },
                  ] as const).map((f) => {
                    const active = statusFilter === f.key;
                    return (
                      <button
                        key={f.key}
                        onClick={() => setStatusFilter(f.key)}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11.5px] font-medium transition-all cursor-pointer ${
                          active
                            ? 'bg-[var(--text-primary)] text-[var(--bg)]'
                            : 'bg-[var(--surface)] text-[var(--text-secondary)] border border-[var(--border-subtle)] hover:border-[var(--text-secondary)]/30'
                        }`}
                      >
                        <span>{f.label}</span>
                        <span className={`tabular-nums text-[10.5px] ${active ? 'opacity-70' : 'text-[var(--text-tertiary)]'}`}>
                          {f.count}
                        </span>
                      </button>
                    );
                  })}
                </div>
                <div className="relative">
                  <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)] pointer-events-none" />
                  <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder={L('프로젝트 검색', 'Search projects')}
                    className="pl-7 pr-3 py-1.5 text-[12px] rounded-lg bg-[var(--bg)] border border-[var(--border)] focus:border-[var(--accent)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]/20 w-full sm:w-52 placeholder:text-[var(--text-tertiary)] transition-all"
                  />
                </div>
              </div>
              )}

              {/* Project grid — rich cards */}
              {filteredProjects.length === 0 ? (
                <div className="text-center py-10 text-[13px] text-[var(--text-tertiary)]">
                  {L("그 이름의 항해는 안 보여요 — 철자를 바꾸거나 필터를 '전체'로 돌려보세요.", 'No voyage by that name — try a different spelling, or set the filter back to All.')}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredProjects.map((project) => {
                    const m = projectMetricsMap.get(project.id);
                    if (!m) return null;
                    const labels = locale === 'ko' ? STEP_LABELS_KO : STEP_LABELS_EN;
                    const lastStepLabel = m.lastActivityStepIdx >= 0 ? labels[m.lastActivityStepIdx] : null;
                    const hasMetrics =
                      m.stepCount > 0 || m.aiRatio !== null || m.reviewerCount > 0 || m.riskCount > 0;

                    // ── Voyage state (single source of truth: lib/voyage-state) ──
                    // Feed the PROGRESSIVE + contract signals, not the dead 4-tool
                    // stores: a settled contract → verified, a sealed/complete voyage
                    // → sailing, so a finished decision never reads as "출항 전".
                    // (getVoyageState only checks outcomeVerdict !== 'pending' to pick
                    // verified vs arrived, so 'mixed' stands in for "settled".)
                    const isDue = dueIds.has(project.id);
                    const voyageState = getVoyageState({
                      started: m.startedEff,
                      // A SEALED contract (decision committed, awaiting its check-in
                      // date weeks out) must count as "reached port" so it can never
                      // drift/wreck on idleness — the user isn't expected to touch it
                      // while it waits. Without contractSealed here a sealed-but-not-
                      // settled project would flip to 표류/난파 after 14/30 idle days.
                      completedAllLegs: m.doneEff || m.contractSealed,
                      lastActivityAt: m.lastActivityAt || project.updated_at || project.created_at || '',
                      hasCoda: !!project.meta_reflection || m.contractAllGraded,
                      lastLeg: m.lastActivityStepIdx >= 0 ? STEP_IDX_TO_LEG[m.lastActivityStepIdx] : null,
                      outcomeVerdict: m.contractAllGraded ? 'mixed' : project.outcome?.verdict,
                    }, Date.now());
                    const vMeta = VOYAGE_STATE_META[voyageState];

                    return (
                      <button
                        key={project.id}
                        onClick={() => setCurrentProjectId(project.id)}
                        className={`group text-left bg-[var(--surface)] border rounded-xl p-4 hover:-translate-y-0.5 transition-all cursor-pointer flex flex-col gap-3 ${
                          isDue
                            ? 'border-amber-500/50 hover:border-amber-500/80 hover:shadow-[var(--shadow-md)]'
                            : m.doneEff
                            ? 'border-[var(--success)]/30 hover:border-[var(--success)]/60 hover:shadow-[var(--shadow-md)]'
                            : m.startedEff
                            ? 'border-[var(--accent)]/25 hover:border-[var(--accent)]/55 hover:shadow-[var(--shadow-md)]'
                            : 'border-[var(--border-subtle)] hover:border-[var(--text-secondary)]/30 hover:shadow-[var(--shadow-sm)]'
                        }`}
                      >
                        {/* Chart vignette — the project as a ship on the sea chart */}
                        <div className="relative -mx-4 -mt-4 mb-1 h-[92px] overflow-hidden rounded-t-xl border-b border-[var(--border-subtle)] bg-[var(--bp-paper)] flex items-end justify-center">
                          <Graticule opacity={0.09} spacing={24} />
                          <VoyageShip
                            state={voyageState}
                            size={84}
                            title={L(vMeta.ko, vMeta.en)}
                            className="relative z-[1] mb-0.5 transition-transform duration-300 group-hover:scale-[1.04]"
                          />
                        </div>

                        {/* Header: status pill + last-activity time */}
                        <div className="flex items-center justify-between gap-2 text-[10.5px] uppercase tracking-wide font-bold">
                          <span
                            className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md ${VOYAGE_TONE_CLS[vMeta.tone]}`}
                            style={vMeta.tone === 'gold' ? { background: 'var(--gradient-gold-subtle)' } : undefined}
                          >
                            {voyageState === 'sailing' && <span className="w-1 h-1 rounded-full bg-[var(--accent)] animate-pulse" />}
                            {voyageState === 'verified' && <Check size={9} strokeWidth={3} />}
                            {L(vMeta.ko, vMeta.en)}
                          </span>
                          <span className="text-[var(--text-tertiary)] normal-case tracking-normal font-normal tabular-nums">
                            {relativeDate(m.lastActivityAt || project.updated_at, locale)}
                            {/* Legacy leg label is a false coordinate for voyage projects — suppress it there. */}
                            {lastStepLabel && m.hasProgress && !m.isDone && !m.hasVoyage ? (
                              <span className="text-[var(--text-tertiary)]/70"> · {lastStepLabel}</span>
                            ) : null}
                          </span>
                        </div>

                        {/* Voyage ETA / arrival — the return hook. Lively countdown
                            (도착 예정 D-N) → due (지금 정산) → arrived. Single source: VoyageEta. */}
                        <VoyageEta contract={project.decision_contract} className="self-start normal-case tracking-normal" />

                        {/* Title */}
                        <h3 className="text-[15px] font-bold text-[var(--text-primary)] leading-[1.35] line-clamp-2 break-words min-w-0 group-hover:text-[var(--accent)] transition-colors">
                          {project.name}
                        </h3>

                        {/* Content excerpt — what they're actually working on.
                            The status itself lives in the badge (single source); a
                            redundant "항해 진행 중" body line was contradicting it, so
                            we only show CONTENT here, or the not-started nudge. */}
                        {m.questionExcerpt ? (
                          <p className="text-[12.5px] text-[var(--text-secondary)] leading-[1.55] line-clamp-2 border-l-2 border-[var(--accent)]/30 pl-2.5">
                            {m.questionExcerpt}
                          </p>
                        ) : !m.startedEff ? (
                          <p className="text-[12px] text-[var(--text-tertiary)] italic leading-[1.55]">
                            {L('아직 출항 전 — 워크스페이스에서 시작해 보세요.', 'Not yet under way — start in the workspace.')}
                          </p>
                        ) : null}

                        {/* Metrics strip — only when meaningful */}
                        {hasMetrics && (
                          <div className="flex flex-wrap gap-x-3.5 gap-y-1.5 text-[11.5px] text-[var(--text-secondary)]">
                            {m.stepCount > 0 && (
                              <span className="inline-flex items-center gap-1 tabular-nums">
                                <GitBranch size={11} className="text-[var(--text-tertiary)]" strokeWidth={2.25} />
                                {locale === 'ko' ? `${m.stepCount}단계` : `${m.stepCount} step${m.stepCount === 1 ? '' : 's'}`}
                              </span>
                            )}
                            {m.aiRatio !== null && m.humanRatio !== null && (
                              <span className="inline-flex items-center gap-1 tabular-nums">
                                <Scale size={11} className="text-[var(--text-tertiary)]" strokeWidth={2.25} />
                                {locale === 'ko'
                                  ? `AI ${m.aiRatio}·사람 ${m.humanRatio}`
                                  : `AI ${m.aiRatio}/Hum ${m.humanRatio}`}
                              </span>
                            )}
                            {m.reviewerCount > 0 && (
                              <span className="inline-flex items-center gap-1 tabular-nums">
                                <MessageSquare size={11} className="text-[var(--text-tertiary)]" strokeWidth={2.25} />
                                {locale === 'ko' ? `${m.reviewerCount}명 리뷰` : `${m.reviewerCount} reviewer${m.reviewerCount === 1 ? '' : 's'}`}
                              </span>
                            )}
                            {m.riskCount > 0 && (
                              <span className="inline-flex items-center gap-1 tabular-nums text-amber-600 dark:text-amber-400">
                                <AlertTriangle size={11} strokeWidth={2.25} />
                                {locale === 'ko' ? `리스크 ${m.riskCount}` : `${m.riskCount} risk${m.riskCount === 1 ? '' : 's'}`}
                              </span>
                            )}
                          </div>
                        )}

                        {/* 4-step progress — legacy 4-tool route ONLY. A voyage
                            project writes nothing to those stores, so this bar would
                            render 4 empty grey segments (재정의/설계/검증/종합 the user
                            never walked) and reinforce the false "출항 전". Hide it. */}
                        {!m.hasVoyage && (
                        <div className="space-y-1.5 mt-auto pt-1">
                          <div className="flex items-center gap-1">
                            {m.statuses.map((s, i) => (
                              <div
                                key={i}
                                className={`flex-1 h-[3px] rounded-full transition-colors ${
                                  s === 'done'
                                    ? m.isDone
                                      ? 'bg-[var(--success)]'
                                      : 'bg-[var(--accent)]'
                                    : s === 'in-progress'
                                    ? 'bg-[var(--accent)]/45'
                                    : 'bg-[var(--border)]'
                                }`}
                              />
                            ))}
                          </div>
                          <div className="flex items-center justify-between text-[10px]">
                            {labels.map((label, i) => {
                              const isLast = i === m.lastActivityStepIdx && !m.isDone;
                              return (
                                <span
                                  key={label}
                                  className={`${
                                    m.statuses[i] === 'done'
                                      ? m.isDone
                                        ? 'text-[var(--success)] font-semibold'
                                        : 'text-[var(--accent)] font-semibold'
                                      : m.statuses[i] === 'in-progress' || isLast
                                      ? 'text-[var(--text-primary)] font-semibold'
                                      : 'text-[var(--text-tertiary)]'
                                  }`}
                                >
                                  {label}
                                </span>
                              );
                            })}
                          </div>
                        </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* 항해일지 (S6 · B4/B5) — 봉인·변침·정산을 시간순 세로 원장으로.
                  '문장만 보기' 토글이 인용벽(제안2 형태1)을 흡수한다. 이벤트 2개
                  미만이면 스스로 미렌더. 그리드 아래 접힌 보조 뷰. */}
              <Logbook projects={projects} locale={locale} />
            </>
          )}
        </div>
      )}

      {/* Project detail */}
      {currentProject && (
        <div className="space-y-6 animate-fade-in">
          <div className="flex items-center justify-between">
            <button onClick={() => setCurrentProjectId(null)} className="text-[12px] text-[var(--accent)] hover:underline cursor-pointer">
              {L('← 프로젝트 목록', '← Project list')}
            </button>
            <div className="flex gap-2">
              <CopyButton getText={() => generateProjectBrief(currentProject)} label={L('브리프 복사', 'Copy brief')} />
              <Button variant="secondary" size="sm" onClick={() => {
                const brief = generateProjectBrief(currentProject);
                const blob = new Blob([brief], { type: 'text/markdown' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `${currentProject.name}-brief.md`;
                a.click();
                URL.revokeObjectURL(url);
              }}>
                <Download size={14} /> {L('다운로드', 'Download')}
              </Button>
            </div>
          </div>

          {/* Project header — the legacy 4-step progress bar is a FALSE
              coordinate for voyage projects (they write nothing to those
              stores), so it only renders for legacy-tool projects. */}
          <Card>
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-[18px] font-bold text-[var(--text-primary)] break-words min-w-0">{currentProject.name}</h2>
              {currentHasVoyage && (
                <span className="shrink-0 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-[var(--accent)]/10 text-[var(--accent)]">
                  {currentVoyageStatusLabel}
                </span>
              )}
            </div>
            {!currentHasVoyage && (
              <div className="flex items-center gap-3 mt-2">
                <span className="text-[12px] text-[var(--text-secondary)]">{L('진행률', 'Progress')}</span>
                <div className="flex-1 h-2 bg-[var(--border)] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[var(--accent)] rounded-full transition-all"
                    style={{ width: `${(completedSteps / steps.length) * 100}%` }}
                  />
                </div>
                <span className="text-[12px] font-semibold text-[var(--accent)]">{completedSteps}/{steps.length}</span>
              </div>
            )}
          </Card>

          {/* The decision itself — the Current Bearing IS the content of a
              voyage project (the long document stays in the workspace).
              Falls back to the plain status row when no bearing derives
              (voyage still under way / very old session). */}
          {currentHasVoyage && (
            currentBearing ? (
              <div>
                <CurrentBearingCard bearing={currentBearing} />
                <div className="flex justify-end -mt-2">
                  <LocaleLink
                    href="/workspace"
                    className="inline-flex items-center gap-1 text-[12px] font-semibold text-[var(--accent)] hover:underline"
                  >
                    {L('워크스페이스에서 열기', 'Open in workspace')} <ArrowRight size={12} />
                  </LocaleLink>
                </div>
              </div>
            ) : (
              <Card className="!border-[var(--accent)]/30">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[13px] font-bold text-[var(--text-primary)]">
                      {currentVoyageStatusLabel}
                    </p>
                    <p className="text-[12px] text-[var(--text-secondary)] mt-0.5">
                      {L('이 프로젝트는 워크스페이스 항해로 진행됐어요.', 'This project ran as a workspace voyage.')}
                    </p>
                  </div>
                  <LocaleLink
                    href="/workspace"
                    className="shrink-0 inline-flex items-center gap-1 text-[12.5px] font-semibold text-[var(--accent)] hover:underline"
                  >
                    {L('워크스페이스에서 열기', 'Open in workspace')} <ArrowRight size={12} />
                  </LocaleLink>
                </div>
              </Card>
            )
          )}

          {/* Decision Contract — falsifiable closed loop (§0 KICK).
              Seal only offered once the voyage is finished (all legs done). */}
          <DecisionContractCard project={currentProject} sealable={completedSteps === steps.length} />

          {/* Decision items — editable premises/phenomena + per-item change alerts
              (living-premises layer, DESIGN-decision-items-living-premises). */}
          <DecisionItemsCard project={currentProject} session={currentVoyageSession} />

          {/* Settlement modal — "그래서, 어떻게 됐어요?" Auto-opens when the
              check-in date arrives (W1.2). "아직" extends via history-preserving
              amend; verdicts persist per tap, so closing mid-way loses nothing. */}
          {settleOpen && currentProject.decision_contract && (
            <SettlementModal
              project={currentProject}
              /* P1-A1 재봉인 온램프: the modal's quiet next-handle shows the same
                 number the due strip shows — one source (useDueCount), no drift. */
              remainingDue={dueProjects.length + dueReceipts.length}
              onClose={() => {
                setSettleOpenId(null);
                setSettleDismissed((prev) => new Set(prev).add(currentProject.id));
              }}
            />
          )}

          {/* Steps journey — legacy 4-tool projects only. For a voyage project
              these four "아직 시작 전" cards were dead chrome contradicting the
              완료 state right above them (compression audit B-6). */}
          {!currentHasVoyage && <div className="space-y-0">
            {steps.map((step, i) => (
              <div key={step.tool}>
                {/* Connector */}
                {i > 0 && (
                  <div className="flex justify-start ml-[19px]">
                    <div className={`w-0.5 h-4 ${step.status !== 'not-started' || steps[i - 1].status !== 'not-started' ? 'bg-[var(--accent)]' : 'bg-[var(--border)]'}`} />
                  </div>
                )}

                <LocaleLink href={step.href}>
                  <div className={`flex items-start gap-4 p-4 rounded-xl border transition-all hover:shadow-[var(--shadow-md)] hover:-translate-y-0.5 cursor-pointer ${
                    step.status === 'done'
                      ? 'border-[var(--success)] bg-[var(--surface)]'
                      : step.status === 'in-progress'
                      ? 'border-[var(--accent)] bg-[var(--ai)]'
                      : 'border-[var(--border)] bg-[var(--surface)]'
                  }`}>
                    {/* Status icon */}
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                      step.status === 'done'
                        ? 'bg-[var(--collab)] text-[var(--success)]'
                        : step.status === 'in-progress'
                        ? `${step.bgColor} ${step.color}`
                        : 'bg-[var(--bg)] text-[var(--text-secondary)]'
                    }`}>
                      {step.status === 'done' ? <Check size={18} /> : step.icon}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-bold text-[var(--text-secondary)]">STEP {i + 1}</span>
                        <h3 className="text-[15px] font-bold text-[var(--text-primary)]">{step.label}</h3>
                        {step.status === 'done' && <Badge variant="both">{L('완료', 'Done')}</Badge>}
                        {step.status === 'in-progress' && <Badge variant="ai">{L('진행 중', 'In progress')}</Badge>}
                      </div>
                      {step.summary ? (
                        <p className="text-[13px] text-[var(--text-secondary)] mt-1 truncate">{step.summary}</p>
                      ) : step.status === 'not-started' ? (
                        <p className="text-[13px] text-[var(--text-secondary)] mt-1 italic">{L('아직 시작 전', 'Not started')}</p>
                      ) : null}
                    </div>

                    <ArrowRight size={14} className="text-[var(--text-secondary)] mt-3 shrink-0" />
                  </div>
                </LocaleLink>
              </div>
            ))}
          </div>}

          {/* Metacognition: 나의 판단 패턴 — North-Star D.
              Was derived from judgmentStore, which ONLY the legacy 4-tool flow
              writes — so the DEFAULT progressive voyage (which seals into
              decision_contract) showed the user no track record at all. Now the
              primary source is the sealed contracts (counts-only, via
              summarizeRecord); legacy tool judgments are kept as a secondary line
              when present. A "forming" state at the first seal stops the moat from
              looking empty the moment it starts accruing. */}
          {(() => {
            const sealedProjects = projects.filter(p => p.decision_contract);
            const sealedCount = sealedProjects.length;
            const patterns = judgments.length > 0 ? getUserPatterns() : null;
            const projectJudgments = judgments.filter(j => j.project_id === currentProjectId);
            // Nothing to show: neither a sealed decision nor a legacy judgment.
            if (sealedCount === 0 && (!patterns || patterns.totalJudgments === 0)) return null;
            const settled = crossRecord.loops;
            const forming = sealedCount > 0 && settled === 0; // sealed, no outcome graded yet
            return (
              <Card className="!bg-[var(--bg)]">
                {/* "패턴(patterns)" over-claimed — the body is seal/settle COUNTS,
                    and getUserPatterns().commonThemes is hardcoded []. No recurring-
                    theme detection or calibration trend exists yet, so name it for
                    what it honestly is: a record. (Real cross-decision aggregation is
                    tracked as deeper work in the audit.) */}
                <h3 className="text-[14px] font-bold text-[var(--text-primary)] mb-3">{L('나의 기록', 'My record')}</h3>
                <div className="space-y-2 text-[12px] text-[var(--text-secondary)]">
                  {sealedCount > 0 && (forming ? (
                    <p>
                      {locale === 'ko' ? (
                        <><span className="font-bold text-[var(--accent)]">패턴이 만들어지는 중</span> — 지금까지 <span className="font-bold text-[var(--text-primary)]">{sealedCount}개</span> 결정을 봉인했어요. 확인일이 오면 결과가 여기 쌓여요.</>
                      ) : (
                        <><span className="font-bold text-[var(--accent)]">Your pattern is forming</span> — <span className="font-bold text-[var(--text-primary)]">{sealedCount}</span> decision{sealedCount === 1 ? '' : 's'} sealed. When the check-in day comes, the outcome lands here.</>
                      )}
                    </p>
                  ) : (
                    <p>
                      {locale === 'ko' ? (
                        <>지금까지 <span className="font-bold text-[var(--text-primary)]">{sealedCount}개</span> 결정을 봉인했고, 그중 <span className="font-bold text-[var(--text-primary)]">{settled}개</span>는 결과까지 확인했어요.</>
                      ) : (
                        <>You&apos;ve sealed <span className="font-bold text-[var(--text-primary)]">{sealedCount}</span> decision{sealedCount === 1 ? '' : 's'}, and closed the loop on <span className="font-bold text-[var(--text-primary)]">{settled}</span>.</>
                      )}
                    </p>
                  ))}
                  {/* The accrued record — counts of what happened, never a score. */}
                  {settled > 0 && (crossRecord.betsHeld > 0 || crossRecord.risksAvoided > 0 || crossRecord.betsBroke > 0) && (
                    <p>
                      {locale === 'ko'
                        ? [
                            crossRecord.betsHeld > 0 ? `적중한 가설 ${crossRecord.betsHeld}개` : '',
                            crossRecord.risksAvoided > 0 ? `비켜 간 위험 ${crossRecord.risksAvoided}개` : '',
                            crossRecord.betsBroke > 0 ? `빗나간 가설 ${crossRecord.betsBroke}개` : '',
                            crossRecord.goodOutcomesOnLuck > 0 ? `그중 운으로 본 게 ${crossRecord.goodOutcomesOnLuck}개` : '',
                          ].filter(Boolean).join(' · ')
                        : [
                            crossRecord.betsHeld > 0 ? `${crossRecord.betsHeld} bet${crossRecord.betsHeld === 1 ? '' : 's'} held` : '',
                            crossRecord.risksAvoided > 0 ? `${crossRecord.risksAvoided} risk${crossRecord.risksAvoided === 1 ? '' : 's'} steered past` : '',
                            crossRecord.betsBroke > 0 ? `${crossRecord.betsBroke} bet${crossRecord.betsBroke === 1 ? '' : 's'} missed` : '',
                            crossRecord.goodOutcomesOnLuck > 0 ? `${crossRecord.goodOutcomesOnLuck} marked as luck` : '',
                          ].filter(Boolean).join(' · ')}
                    </p>
                  )}
                  {/* Legacy 4-tool judgments — kept as a secondary line when present. */}
                  {patterns && projectJudgments.length > 0 && (
                    <p>
                      {locale === 'ko' ? (
                        <>이 프로젝트에서 <span className="font-bold text-[var(--text-primary)]">{projectJudgments.length}건</span>의 판단을 내렸습니다.</>
                      ) : (
                        <>You&apos;ve made <span className="font-bold text-[var(--text-primary)]">{projectJudgments.length}</span> judgment{projectJudgments.length === 1 ? '' : 's'} in this project.</>
                      )}
                    </p>
                  )}
                </div>
              </Card>
            );
          })()}

          {/* (The "이전 프로젝트 N건과 비교할 수 있습니다" hint was a dead
              sentence — no action attached — and was removed.) */}

          {/* Execution readiness + output formats read the LEGACY tool stores;
              a voyage project would get empty/hollow documents from them. */}
          {!currentHasVoyage && <ExecutionReadiness projectId={currentProject.id} />}
          {!currentHasVoyage && <OutputSelector project={currentProject} />}

          {/* Next step guide — suppressed for voyage projects (the legacy 4-tool
              CTA contradicts a finished/sealed voyage). */}
          {nextStep && !currentHasVoyage && (
            <Card className="!bg-[var(--checkpoint)] !border-amber-500/30">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-amber-500/15 flex items-center justify-center shrink-0">
                  <ArrowRight size={14} className="text-amber-600 dark:text-amber-400" />
                </div>
                <div className="flex-1">
                  <p className="text-[13px] font-bold text-[var(--text-primary)]">{L(`다음 단계: ${nextStep.label}`, `Next step: ${nextStep.label}`)}</p>
                  <p className="text-[12px] text-[var(--text-secondary)] mt-0.5">
                    {nextStep.tool === 'reframe' && L('숨겨진 전제를 찾고 진짜 질문을 정의합니다.', 'Find hidden assumptions and define the real question.')}
                    {nextStep.tool === 'recast' && L('AI와 사람의 역할을 설계합니다.', 'Design the split between AI and human roles.')}
                    {nextStep.tool === 'rehearse' && L('판단자의 예상 반응을 시뮬레이션합니다.', 'Simulate how decision-makers will react.')}
                    {nextStep.tool === 'synthesize' && L('피드백을 반영하여 최종본을 완성합니다.', 'Apply feedback and finalize the draft.')}
                  </p>
                  <LocaleLink href={nextStep.href}>
                    <Button size="sm" className="mt-2">
                      {L(`${nextStep.label} 시작`, `Start ${nextStep.label}`)} <ArrowRight size={12} />
                    </Button>
                  </LocaleLink>
                </div>
              </div>
            </Card>
          )}

          {/* All done */}
          {completedSteps === steps.length && (
            <Card className="!bg-[var(--collab)] !border-[var(--success)]/30 text-center py-6">
              <Check size={24} className="mx-auto text-[var(--success)] mb-2" />
              <p className="text-[15px] font-bold text-[var(--success)]">{L('모든 단계를 완료했습니다', 'All steps complete')}</p>
              <p className="text-[12px] text-[var(--success)] mt-1">{L('프로젝트 브리프를 복사하거나 다운로드하세요.', 'Copy or download the project brief.')}</p>
              <div className="flex justify-center gap-2 mt-3">
                <CopyButton getText={() => generateProjectBrief(currentProject)} label={L('브리프 복사', 'Copy brief')} />
              </div>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
