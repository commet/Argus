'use client';

import React, { useEffect, useRef, useState, Suspense } from 'react';
import Image from 'next/image';
import dynamic from 'next/dynamic';
import { useSearchParams } from 'next/navigation';
import { useWorkspaceStore, type StepId } from '@/stores/useWorkspaceStore';
import { useProjectStore } from '@/stores/useProjectStore';
import { useProgressiveStore } from '@/stores/useProgressiveStore';
import { useShallow } from 'zustand/react/shallow';
import { useAgentStore } from '@/stores/useAgentStore';
import { WorkerDrawer, useWorkers } from '@/components/workspace/progressive/WorkerPanel';
import { LogbookDrawer } from '@/components/workspace/progressive/Logbook';
import { VoyageMapRail, VoyageMapViews } from '@/components/workspace/progressive/VoyageMapRail';
import { QuickChatBar } from '@/components/workspace/QuickChatBar';
import { NavigatorStrip } from '@/components/workspace/NavigatorStrip';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { useLocale } from '@/hooks/useLocale';
import { buildEarlyContract, summarizeRecord } from '@/lib/decision-contract';
import { recordCompactLine } from '@/lib/record-summary';
import { VoyageEta } from '@/components/workspace/VoyageEta';
import { Sparkles, ChevronRight, MessageSquare, Sliders, UserCheck, RefreshCw, FolderOpen, ChevronDown, AlertTriangle, Layers, History, Compass, FileText, BellRing, SearchCheck } from 'lucide-react';
import { useDueCount } from '@/hooks/useDueCount';
import { shouldShowLantern, localYMD } from '@/lib/lantern';
import { getStorage, setStorage, STORAGE_KEYS } from '@/lib/storage';
import { track } from '@/lib/analytics';
import { useAuth, hasKnownUser } from '@/lib/auth';
import { ensureUserId } from '@/lib/supabase';
import { LocaleLink } from '@/components/ui/LocaleLink';
import { Button } from '@/components/ui/Button';
import { Graticule } from '@/components/ui/VoyageElements';
import { EASE } from '@/components/workspace/progressive/shared/constants';
import { getPersonaPool } from '@/lib/worker-personas';
import { WorkerAvatar, AvatarRow } from '@/components/workspace/progressive/WorkerAvatar';
import { BindCard, type BindResult } from '@/components/workspace/progressive/BindCard';
import { getDemoScenarios } from '@/lib/demo-data';
import type { DemoScenario } from '@/lib/demo-data';
import { DEMO_SCENARIO_ART } from '@/lib/demo-scenario-art';
import { motion, AnimatePresence } from 'framer-motion';
import type { WorkerPersona, DecisionContract, VoyageBranch } from '@/stores/types';
import { ErrorBoundary } from '@/components/layout/ErrorBoundary';
import { parsePartialAnalysis } from '@/lib/partial-analysis';
import { ArgusCompanionNote } from '@/components/brand/ArgusCompanionNote';
import { Modal } from '@/components/ui/Modal';
import { LIGHT_PATH_ENABLED } from '@/lib/light-path/light-engine';
import type { LightDeepenContext } from '@/components/workspace/light/LightFlow';

type InitialAnalysisResult = Awaited<ReturnType<typeof import('@/lib/progressive-engine').runInitialAnalysis>>;

function WorkspaceChunkLoading() {
  const locale = useLocale();
  return (
    <div role="status" aria-live="polite" className="flex min-h-[45vh] items-center justify-center px-4 py-16">
      <div className="flex items-center gap-3 text-[13px] text-[var(--text-secondary)]">
        <span aria-hidden="true" className="h-5 w-5 animate-spin rounded-full border-2 border-[var(--accent)] border-t-transparent motion-reduce:animate-none" />
        {locale === 'ko' ? '작업 화면을 준비하고 있어요…' : 'Preparing your workspace…'}
      </div>
    </div>
  );
}

const ReframeStep = dynamic(() => import('@/components/workspace/ReframeStep').then((module) => module.ReframeStep), { loading: WorkspaceChunkLoading });
const RecastStep = dynamic(() => import('@/components/workspace/RecastStep').then((module) => module.RecastStep), { loading: WorkspaceChunkLoading });
const RehearseStep = dynamic(() => import('@/components/workspace/RehearseStep').then((module) => module.RehearseStep), { loading: WorkspaceChunkLoading });
const SynthesizeStep = dynamic(() => import('@/components/workspace/SynthesizeStep').then((module) => module.SynthesizeStep), { loading: WorkspaceChunkLoading });
const ProgressiveFlow = dynamic(() => import('@/components/workspace/progressive/ProgressiveFlow').then((module) => module.ProgressiveFlow), { loading: WorkspaceChunkLoading });
const InteractiveDemo = dynamic(() => import('@/components/workspace/InteractiveDemo').then((module) => module.InteractiveDemo), { loading: WorkspaceChunkLoading });
const RetroSeal = dynamic(() => import('@/components/workspace/RetroSeal').then((module) => module.RetroSeal), { loading: WorkspaceChunkLoading });
const LightFlow = dynamic(() => import('@/components/workspace/light/LightFlow').then((module) => module.LightFlow), { loading: WorkspaceChunkLoading });

/** Stable empty-array fallback for the sessionBranches selector — a fresh `[]`
 *  literal on every render makes zustand see a new snapshot each time → React's
 *  "getSnapshot should be cached" warning. One module-level reference fixes it. */
const EMPTY_BRANCHES: VoyageBranch[] = [];

/* ─── Step-level error fallback ─── */
function StepErrorFallback({ onRetry }: { onRetry?: () => void }) {
  const locale = useLocale();
  const L = (ko: string, en: string) => locale === 'ko' ? ko : en;
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center" role="alert">
      <AlertTriangle size={28} className="text-[var(--text-tertiary)] mb-3" aria-hidden="true" />
      <p className="text-[14px] font-semibold text-[var(--text-primary)] mb-1">{L('이 단계에서 문제가 생겼어요', 'An error occurred in this step')}</p>
      <p className="text-[12px] text-[var(--text-secondary)] mb-4">{L('작업 내용은 그대로 있어요 — 이 구역만 잠깐 멈췄어요.', 'Your work is intact — only this section paused.')}</p>
      <div className="flex flex-col items-center gap-2">
        {/* In-place retry first (cheap re-render, no state loss); reload is the
            fallback only if retry keeps throwing. */}
        {onRetry && (
          <button onClick={onRetry} className="px-4 py-2 text-[13px] font-medium rounded-lg bg-[var(--accent)] text-[var(--accent-fg)] hover:shadow-sm transition-all cursor-pointer">
            {L('다시 시도', 'Try again')}
          </button>
        )}
        <button onClick={() => window.location.reload()} className={onRetry
          ? 'text-[12px] text-[var(--text-tertiary)] underline underline-offset-2 hover:text-[var(--text-secondary)] transition-colors cursor-pointer'
          : 'px-4 py-2 text-[13px] font-medium rounded-lg bg-[var(--accent)] text-[var(--accent-fg)] hover:shadow-sm transition-all cursor-pointer'}>
          {L('새로고침', 'Refresh')}
        </button>
      </div>
    </div>
  );
}

/* ─── Progressive Layout: flow + worker panel ─── */
function ProgressiveLayout({ projectId, projectName, onReset }: { projectId: string; projectName?: string; onReset: () => void }) {
  const locale = useLocale();
  const L = (ko: string, en: string) => locale === 'ko' ? ko : en;
  const workers = useWorkers();
  const hasWorkers = workers.length > 0;
  // Ship's log accompanies the whole voyage — show the right rail as soon as
  // there are waypoints, even before any worker is deployed.
  const hasWaypoints = useProgressiveStore(s => {
    const sess = s.sessions.find(x => x.id === s.currentSessionId);
    return (sess?.waypoints?.length ?? 0) > 0;
  });
  // The Voyage Map rail (left) is the standing companion for the WHOLE voyage —
  // restored from the W1.6 focus-mode demotion that hid it until 'complete'. The
  // mid-voyage "중구난방" that prompted that demotion is now held off by the
  // rail's own collapse-to-spine (state in `voyage_map_collapsed`), not by hiding
  // it outright. It appears once the voyage has any map content or live crew.
  const hasCheckpoints = useProgressiveStore(s => {
    const sess = s.sessions.find(x => x.id === s.currentSessionId);
    return (sess?.checkpoints?.length ?? 0) > 0;
  });
  const showMap = hasWorkers || hasWaypoints || hasCheckpoints;
  // Mobile: log + crew live in bottom drawers (collapsed bars by default → no
  // clutter), now available throughout the voyage (not gated to 'complete').
  const mobileLogShow = hasWaypoints;
  const mobileWorkerShow = hasWorkers;
  // Which course are we on? Shown in the header once more than one exists, so a
  // fork/switch (which jumps the conversation) doesn't feel disorienting.
  // useShallow: this selector returns a fresh {name,color,count} object
  // when >1 branch exists. Without shallow equality, zustand sees a new snapshot
  // every render → React's "getSnapshot should be cached" → infinite re-render
  // (React #185) the moment a session has more than one course. Shallow-compare
  // the fields so a same-valued object is treated as unchanged.
  const branchInfo = useProgressiveStore(useShallow(s => {
    const sess = s.sessions.find(x => x.id === s.currentSessionId);
    const branches = sess?.branches || [];
    if (branches.length <= 1) return null;
    const active = branches.find(b => b.id === sess?.active_branch_id);
    return active ? { name: active.name, color: active.color, count: branches.length } : null;
  }));
  // The header chip switches courses too (not just displays). It complements the
  // Voyage Map rail's Logbook switcher: the chip is the standing branch surface
  // when the rail is collapsed to its spine (counts only, no switch) or on mobile
  // (rail hidden), and stays reachable while scrolled. Both call switchBranch.
  const sessionBranches = useProgressiveStore(s => {
    const sess = s.sessions.find(x => x.id === s.currentSessionId);
    return sess?.branches ?? EMPTY_BRANCHES;
  });
  const activeBranchId = useProgressiveStore(s => {
    const sess = s.sessions.find(x => x.id === s.currentSessionId);
    return sess?.active_branch_id ?? null;
  });
  const switchBranch = useProgressiveStore(s => s.switchBranch);
  const branchingLocked = useProgressiveStore(s => s.isBranchingLocked());
  const [branchMenuOpen, setBranchMenuOpen] = useState(false);
  const [mobileMapOpen, setMobileMapOpen] = useState(false);
  const branchTriggerRef = useRef<HTMLButtonElement>(null);
  const branchOptionRefs = useRef<Array<HTMLButtonElement | null>>([]);

  useEffect(() => {
    if (!branchMenuOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        setBranchMenuOpen(false);
        branchTriggerRef.current?.focus();
      }
    };
    document.addEventListener('keydown', closeOnEscape);
    const activeIndex = Math.max(0, sessionBranches.findIndex((branch) => branch.id === activeBranchId));
    const raf = requestAnimationFrame(() => branchOptionRefs.current[activeIndex]?.focus());
    return () => {
      document.removeEventListener('keydown', closeOnEscape);
      cancelAnimationFrame(raf);
    };
  }, [activeBranchId, branchMenuOpen, sessionBranches]);

  const handleBranchListKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const enabled = branchOptionRefs.current.filter((button): button is HTMLButtonElement => !!button && !button.disabled);
    if (enabled.length === 0) return;
    const current = Math.max(0, enabled.indexOf(document.activeElement as HTMLButtonElement));
    const next = event.key === 'Home' ? 0
      : event.key === 'End' ? enabled.length - 1
      : event.key === 'ArrowDown' ? (current + 1) % enabled.length
      : (current - 1 + enabled.length) % enabled.length;
    enabled[next]?.focus();
  };

  return (
    <div className="relative min-h-[calc(100vh-64px)] overflow-hidden">
      <div className="absolute inset-0 pointer-events-none" style={{ background: 'var(--gradient-concert-hall)' }} />
      <Graticule opacity={0.02} spacing={18} />

      <div className="relative pt-8 md:pt-12 pb-16">
        {/* Desktop (xl+): the flow column sits DEAD-CENTRE of the viewport, with
            the Voyage Map rail floating in the mirror-image RIGHT gutter. Two
            equal flex-1 spacers flank the capped flow column so the centre never
            drifts whether or not the rail is shown; the rail lives in the right
            spacer with a gap from the flow and breathing room off the edge. Below
            xl the gutters are too narrow, so the rail gives way to the bottom
            drawers. DOM order is flow-FIRST (keyboard reaches the task first). */}
        <div className="flex justify-center px-4 md:px-6 lg:px-8">
          {/* Left gutter — mirrors the right rail gutter to keep the flow centred */}
          <div className="hidden xl:block flex-1" aria-hidden="true" />
          {/* Centre: header + flow, capped so it reads as a column. min-w-0 lets
              long lines truncate. Bottom padding clears the stacked mobile drawers. */}
          <div className={`w-full max-w-2xl min-w-0 lg:pb-0 ${mobileWorkerShow && mobileLogShow ? 'pb-[calc(120px+env(safe-area-inset-bottom))]' : (mobileWorkerShow || mobileLogShow) ? 'pb-[calc(64px+env(safe-area-inset-bottom))]' : ''}`}>
        {/* Project header */}
        <div className="max-w-2xl mx-auto mb-6 flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <FolderOpen size={14} className="text-[var(--accent)] shrink-0" />
            <span
              className="text-[13px] font-semibold text-[var(--text-secondary)] truncate max-w-[160px] shrink-0"
              title={projectName} /* 05 §4: the 160px truncation needs a hover escape */
            >
              {projectName}
            </span>
            {branchInfo && (
              <span className="relative min-w-0 pl-2 ml-0.5 border-l border-[var(--border-subtle)]">
                {/* '결정 요약'(결과 카드, 옛 이름 '현재 방위')과의 혼동 방지 — 이 칩은 세션 갈래 전환기다 (06 S1) */}
                <button
                  ref={branchTriggerRef}
                  type="button"
                  onClick={() => setBranchMenuOpen((o) => !o)}
                  aria-expanded={branchMenuOpen}
                  aria-haspopup="listbox"
                  aria-controls="workspace-branch-listbox"
                  title={L(`지금 가는 갈래 · 총 ${branchInfo.count}개 — 눌러서 갈아타기`, `Current branch · ${branchInfo.count} total — tap to switch`)}
                  className="flex items-center gap-1 text-[12px] text-[var(--text-secondary)] min-w-0 hover:text-[var(--text-primary)] cursor-pointer min-h-[44px]"
                >
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ background: branchInfo.color }} />
                  <span className="truncate max-w-[140px]">{branchInfo.name}</span>
                  <ChevronDown size={11} className={`shrink-0 text-[var(--text-tertiary)] transition-transform ${branchMenuOpen ? 'rotate-180' : ''}`} />
                </button>
                {branchMenuOpen && (
                  <>
                    {/* click-away backdrop */}
                    <div className="fixed inset-0 z-40" onClick={() => setBranchMenuOpen(false)} aria-hidden="true" />
                    <div id="workspace-branch-listbox" role="listbox" aria-label={L('결정 방향 선택', 'Choose a decision direction')} onKeyDown={handleBranchListKeyDown} className="absolute left-0 top-full z-50 mt-1 w-56 rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-lg)] p-1.5 space-y-0.5">
                      {sessionBranches.map((b, index) => {
                        const isActive = b.id === activeBranchId;
                        const disabled = branchingLocked && !isActive;
                        return (
                          <button
                            ref={(node) => { branchOptionRefs.current[index] = node; }}
                            type="button"
                            key={b.id}
                            role="option"
                            aria-selected={isActive}
                            disabled={disabled}
                            onClick={() => { if (!isActive && !disabled) { switchBranch(b.id); } setBranchMenuOpen(false); }}
                            className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-left text-[12px] transition-colors ${
                              isActive
                                ? 'bg-[var(--bg)] text-[var(--text-primary)] font-semibold'
                                : disabled
                                ? 'text-[var(--text-tertiary)] opacity-50 cursor-not-allowed'
                                : 'text-[var(--text-secondary)] hover:bg-[var(--bg)] cursor-pointer'
                            }`}
                          >
                            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: b.color }} />
                            <span className="truncate flex-1 min-w-0">{b.name}</span>
                            {isActive && <span className="text-[12px] text-[var(--text-tertiary)] shrink-0">{L('현재', 'now')}</span>}
                          </button>
                        );
                      })}
                      <p className="px-2.5 pt-1 pb-0.5 text-[12px] text-[var(--text-tertiary)] leading-[1.5]">
                        {branchingLocked
                          ? L('지금은 작업 중이라 갈아탈 수 없어요 — 끝나면 풀려요.', 'Switching is locked while work is running.')
                          : L('다른 방향을 선택해도 지금 기록은 그대로 남아요.', 'Choosing another direction keeps this record intact.')}
                      </p>
                    </div>
                  </>
                )}
              </span>
            )}
          </div>
          <button onClick={onReset} className="text-[12px] text-[var(--text-tertiary)] hover:text-[var(--accent)] transition-colors cursor-pointer min-h-[44px] px-2 -mr-2 flex items-center">
            {L('새 프로젝트', 'New Project')}
          </button>
        </div>

        {showMap && (
          <div className="mb-3 flex justify-end xl:hidden">
            <button
              type="button"
              onClick={() => setMobileMapOpen(true)}
              className="inline-flex min-h-10 items-center gap-1.5 border-b border-[var(--border)] px-1 text-[12px] font-semibold text-[var(--text-secondary)] transition-colors hover:text-[var(--accent)]"
            >
              <SearchCheck size={14} className="text-[var(--accent)]" />
              {L('현재 판단 경로', 'Decision path')}
            </button>
            <Modal
              open={mobileMapOpen}
              onClose={() => setMobileMapOpen(false)}
              title={L('현재 판단 경로', 'Current decision path')}
              widthClass="max-w-2xl"
            >
              <VoyageMapViews surface="modal" onNavigate={() => setMobileMapOpen(false)} />
            </Modal>
          </div>
        )}

            <ErrorBoundary renderFallback={(reset) => <StepErrorFallback onRetry={reset} />}>
              <ProgressiveFlow projectId={projectId} />
            </ErrorBoundary>
          </div>
          {/* Right gutter — holds the rail (xl+) left-aligned with a gap from the
              flow; the rail brings its own width (full ↔ collapsed spine). When
              there's no map yet, the empty spacer still balances the left one so
              the flow stays centred. top-16 matches the 64px header. */}
          <div className="hidden xl:block flex-1" aria-hidden={!showMap}>
            {showMap && (
              <div className="sticky top-16 h-[calc(100vh-128px)] ml-4 2xl:ml-10">
                <VoyageMapRail />
              </div>
            )}
          </div>
        </div>

        {/* Below xl: ship's-log bottom drawer (sits above the crew bar), then the
            crew drawer. Hidden at xl+ where the right rail shows (the rail needs a
            wide-enough gutter, so 1024–1280 laptops keep the drawers). Collapsed
            bars by default, so no clutter. */}
        {mobileLogShow && <div className="xl:hidden"><LogbookDrawer offset={mobileWorkerShow} /></div>}
        {mobileWorkerShow && <WorkerDrawer className="xl:hidden" />}
      </div>
    </div>
  );
}


/* EASE — imported from shared/constants */

/* ─── HeroFlow: idle → (gating → light | binding) → assembling → analyzing → ready ───
   'gating' + 'light' are the light-path (가벼운 길) seam: one fast routing call
   decides whether an everyday decision gets the conversational LightFlow instead
   of the full heavy pipeline. 'heavy' falls through to the unchanged flow. */
type HeroPhase = 'idle' | 'retro' | 'gating' | 'light' | 'binding' | 'assembling' | 'analyzing' | 'ready';

function HeroFlow({ onReady, projects, user, reviewerAgentId, initialProblem, freshStart = false }: {
  onReady: (projectId: string) => void;
  projects: Array<{ id: string; name: string; updated_at?: string; created_at?: string; decision_contract?: DecisionContract }>;
  user: unknown;
  reviewerAgentId?: string;
  initialProblem?: string;
  /** Explicit ?new=1 entry: keep the page focused on a blank input instead of
   *  immediately resurfacing the project the user just left. */
  freshStart?: boolean;
}) {
  const locale = useLocale();
  const L = (ko: string, en: string) => locale === 'ko' ? ko : en;
  const [phase, setPhase] = useState<HeroPhase>('idle');
  const demoScenarios = getDemoScenarios(locale);
  const [demoScenario, setDemoScenario] = useState<DemoScenario | null>(null);
  const [problemInput, setProblemInput] = useState('');
  const [streamingText, setStreamingText] = useState('');
  const [previewPersonas, setPreviewPersonas] = useState<WorkerPersona[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [justFromDemo, setJustFromDemo] = useState(false);
  const [showAllProjects, setShowAllProjects] = useState(false);
  const inputRef = React.useRef<HTMLTextAreaElement>(null);
  const { createProject, updateProject } = useProjectStore();
  const progressiveStore = useProgressiveStore();
  const phaseRef = React.useRef<HeroPhase>('idle');
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const analyzeAbortRef = React.useRef<AbortController | null>(null);
  const elapsedTimerRef = React.useRef<ReturnType<typeof setInterval> | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const autoStartedRef = React.useRef(false);
  // Phase 1 BIND: the in-flight (buffered) initial analysis and the submitted text,
  // so the bind card can be shown WHILE the analysis runs and finalize after the rope.
  const analysisRef = React.useRef<Promise<{ result?: InitialAnalysisResult; error?: unknown }> | null>(null);
  // The settled value, the moment it exists. proceedAfterBind uses this to SKIP
  // the assembling beat when the buffered analysis already finished (usually:
  // failed fast on a quota 429) — entering assembling and leaving it within the
  // same beat produced back-to-back AnimatePresence(mode=wait) swaps that the
  // production bundle wedges on (재실사 2026-07-08: 429 사용자 화면이 '팀을
  // 꾸리는 중'에서 영구 동결). One swap, no race.
  const analysisSettledRef = React.useRef<{ result?: InitialAnalysisResult; error?: unknown } | null>(null);
  const pendingTextRef = React.useRef<string>('');
  // Light path (가벼운 길): the first beat (mirror + question) returned by the
  // SAME gate call that routed here — no second call before the light screen.
  const [lightOpening, setLightOpening] = useState<{ mirror: string; question: string } | null>(null);
  const searchParams = useSearchParams();

  // 착륙 등불 (P0-6 ②) — the landing surface finally knows about the return.
  // dueCount via the shared hook (Header / /project / here — one number).
  // "나중에 할게요" = same-day snooze in localStorage (argus:lantern-snooze),
  // re-renders the next day; a permanent dismiss is forbidden (master §4).
  const { dueCount, dueProjects } = useDueCount();
  const [lanternSnoozedYMD, setLanternSnoozedYMD] = useState<string | null>(null);
  React.useEffect(() => {
    // Read in an effect (SSR-safe) — getStorage returns the fallback on the server.
    setLanternSnoozedYMD(getStorage<string | null>(STORAGE_KEYS.LANTERN_SNOOZE, null));
  }, []);
  const lanternOn = shouldShowLantern(dueCount, lanternSnoozedYMD, localYMD());
  const snoozeLantern = () => {
    const today = localYMD();
    setStorage(STORAGE_KEYS.LANTERN_SNOOZE, today);
    setLanternSnoozedYMD(today);
  };

  // Keep ref in sync for use inside async callback
  phaseRef.current = phase;

  // Cleanup timer on unmount
  React.useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (elapsedTimerRef.current) clearInterval(elapsedTimerRef.current);
      analyzeAbortRef.current?.abort();
    };
  }, []);

  // Auto-select demo scenario from ?demo= query param
  React.useEffect(() => {
    const demoId = searchParams.get('demo');
    if (demoId && !demoScenario) {
      const matched = demoScenarios.find(s => s.id === demoId);
      if (matched) setDemoScenario(matched);
    }
  }, [searchParams, demoScenarios, demoScenario]);

  // Auto-submit from ?q= param (landing Hero inline input) — routes through full streaming flow.
  // Demo param takes priority if both are set.
  React.useEffect(() => {
    if (!initialProblem || autoStartedRef.current) return;
    if (searchParams.get('demo')) return;
    const text = initialProblem.trim();
    if (!text) return;
    autoStartedRef.current = true;
    // Consume the param IMMEDIATELY: leaving ?q= in the URL meant every
    // refresh (and "새 프로젝트", which remounts HeroFlow) re-ran the same
    // analysis — duplicate projects, quota burned twice (audit P0 #1).
    window.history.replaceState(null, '', window.location.pathname);
    // Defuse the persisted-project restore: loadProjects() restores the last
    // open project synchronously, which would unmount HeroFlow mid-analysis —
    // aborting this run and hijacking the screen to an old project while the
    // typed text is already gone from the URL (adversarial review P0 #1).
    useProjectStore.getState().setCurrentProjectId(null);
    setProblemInput(text);
    handleSubmit(text);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialProblem]);

  // Fire the (heavy) analysis buffered behind the BindCard — the song is captured
  // but not heard until the rope is tied. The promise never rejects — it settles
  // to { result } | { error } so an early failure during binding is surfaced only
  // when the user proceeds.
  const beginBufferedAnalysis = (text: string) => {
    const controller = new AbortController();
    analyzeAbortRef.current = controller;
    analysisSettledRef.current = null;
    analysisRef.current = startAnalysis(text, controller);
    analysisRef.current.then((s) => { analysisSettledRef.current = s; });
  };

  // Phase 1 BIND — submit no longer goes straight into generation. It fires the
  // initial analysis IN PARALLEL (buffered, not revealed) and shows the BindCard so
  // the user can tie their own rope BEFORE hearing the AI ("rope before the Sirens").
  // proceedAfterBind() then reveals the assembling/analyzing beat and finalizes.
  //
  // Light-path seam (the ONLY routing edit): when enabled, ONE fast gate call runs
  // FIRST. 'light' → render LightFlow and skip the heavy analysis call entirely
  // (no bind ceremony on an everyday decision). 'heavy' (or any gate failure) →
  // the existing behavior above, unchanged.
  const handleSubmit = (directText?: string) => {
    const text = (directText || problemInput).trim();
    if (!text || phase !== 'idle') return;
    if (directText) setProblemInput(text);

    pendingTextRef.current = text;
    setError(null);
    const pool = getPersonaPool(locale);
    setPreviewPersonas(pool.slice(0, 4));
    track('workspace_problem_submit', { text_length: text.length, source: 'hero_flow' });

    if (LIGHT_PATH_ENABLED) {
      const controller = new AbortController();
      analyzeAbortRef.current = controller;
      analysisSettledRef.current = null;
      setPhase('gating');
      import('@/lib/light-path/light-engine')
        .then(({ runLightGate }) => runLightGate(text, locale, controller.signal))
        .then((gate) => {
          if (controller.signal.aborted || phaseRef.current !== 'gating') return;
          track('light_gate_routed', { need: gate.need });
          if (gate.need === 'light' && gate.mirror && gate.question) {
            setLightOpening({ mirror: gate.mirror, question: gate.question });
            setPhase('light');
            return;
          }
          beginBufferedAnalysis(text);
          setPhase('binding');
        })
        .catch(() => {
          // runLightGate never throws by contract; this is a chunk-load backstop.
          if (controller.signal.aborted || phaseRef.current !== 'gating') return;
          beginBufferedAnalysis(text);
          setPhase('binding');
        });
      return;
    }

    beginBufferedAnalysis(text);
    setPhase('binding');
  };

  // Light → heavy handoff: escalation accept, the "더 깊이 보기" correction link,
  // or a deterministic crisis fire on a light answer. The light Q&A travels
  // INSIDE the problem text (composeDeepenText) — that is the wire the heavy
  // flow actually reads (createSession / runInitialAnalysis). Crisis skips the
  // bind ceremony and goes straight through; runInitialAnalysis re-fires
  // classifyCrisis on this text, so the EXISTING crisis surface owns it.
  const handleLightDeepen = (ctx: LightDeepenContext) => {
    pendingTextRef.current = ctx.text;
    setError(null);
    setLightOpening(null);
    beginBufferedAnalysis(ctx.text);
    if (ctx.reason === 'crisis') {
      void proceedAfterBind(null, { source: 'light_crisis' });
    } else {
      setPhase('binding');
    }
  };

  const startAnalysis = (text: string, controller: AbortController) =>
    import('@/lib/progressive-engine').then(({ runInitialAnalysis }) => runInitialAnalysis(text, (token) => {
      setStreamingText(token);
      if (phaseRef.current === 'assembling') {
        if (timerRef.current) clearTimeout(timerRef.current);
        setPhase('analyzing');
        track('first_analysis_start', { text_length: text.length, anonymous: !user });
      }
    }, controller.signal, (typedQ, replacesId) => {
      // P1-3: the first question shows instantly (legacy); the typed upgrade
      // lands a few seconds later — swap only while it's still unanswered.
      const s = progressiveStore.currentSession();
      if (!s) return;
      const last = s.questions[s.questions.length - 1];
      if (last?.id === replacesId && s.answers.length < s.questions.length) {
        progressiveStore.replaceLatestQuestion(typedQ);
      }
    })).then((result) => ({ result })).catch((error) => ({ error }));

  // Called by BindCard. `bind` = the rope (lean + check-in) or null on skip.
  // `opts.source === 'light_crisis'` = the light path routing a crisis answer
  // straight through (no BindCard was shown) — skip the bind funnel event so
  // the telemetry never claims a bind the user was never offered.
  const proceedAfterBind = async (bind: BindResult | null, opts?: { source?: 'bind' | 'light_crisis' }) => {
    const text = pendingTextRef.current;
    const controller = analyzeAbortRef.current;
    if (!text || !controller) { setPhase('idle'); return; }

    // The opening capture is a PRE-REVIEW BASELINE, not the closing seal. Keep
    // its analytics separate so the funnel cannot count one decision as sealed
    // twice or teach the UI the wrong mental model.
    if (opts?.source !== 'light_crisis') {
      track('bind_resolved', {
        committed: !!bind,
        has_lean: !!bind?.lean,
        has_date: !!(bind?.interval || bind?.check_in_at),
        anonymous: !user,
      });
    }

    // Reveal the team-assembling → analyzing beat ONLY while we genuinely wait.
    // If the buffered analysis already settled (typical: a quota 429 that failed
    // in ~1s while the user was still typing the rope), entering assembling and
    // leaving it in the same beat fires two back-to-back AnimatePresence
    // (mode=wait) swaps — the production bundle wedges on that race and the
    // user freezes on '팀을 꾸리는 중' forever (재실사 2026-07-08 실증). With a
    // settled result we jump straight to the outcome: one swap, no race.
    const preSettled = analysisSettledRef.current;
    if (!preSettled) {
      setPhase('assembling');
      setElapsed(0);
      if (elapsedTimerRef.current) clearInterval(elapsedTimerRef.current);
      elapsedTimerRef.current = setInterval(() => setElapsed(e => e + 1), 1000);
      timerRef.current = setTimeout(() => {
        if (phaseRef.current === 'assembling') setPhase('analyzing');
      }, 2000);
    }

    const settled = preSettled ?? await (analysisRef.current ?? Promise.resolve(
      { error: new Error('no analysis') } as { result?: InitialAnalysisResult; error?: unknown },
    ));

    try {
      if (settled.error) throw settled.error;
      const result = settled.result!;

      // ADD-4: 스트림은 정상 종료됐지만 파싱 결과가 비어있는 경우(첫 상호작용의 malformed JSON 등).
      // skeleton·hidden_assumptions가 모두 비면 분석이 사실상 실패한 것 — 재시도 가능한 에러로 표면화.
      // 단, 의도적으로 비어 있는 VALID 종착 상태는 에러로 튕기지 않는다:
      //   - 위기 백업(crisis): skeleton 억제가 설계.
      //   - 비-open 경로(flat/vent/info/validation/resistance/self_profiling) 또는 flat 프레임:
      //     STEP-0 분류상 plan을 만들지 않는 게 정상이고, 한 줄 답(insight)이 곧 결과물이다.
      //     이 경우 ProgressiveFlow가 terminal 분석 카드로 insight를 렌더하므로, skeleton이
      //     비어도 실패가 아니다. (insight조차 없으면 진짜 빈 결과이므로 아래 가드가 잡는다.)
      const rt = result.snapshot.request_type;
      const isDeliberatelyTerminal =
        result.snapshot.crisis?.isCrisis ||
        (((rt && rt !== 'open') || result.snapshot.frame_status === 'flat') &&
          !!result.snapshot.insight?.trim());
      if (
        !isDeliberatelyTerminal &&
        result.snapshot.skeleton.length === 0 &&
        result.snapshot.hidden_assumptions.length === 0
      ) {
        throw new Error(L('분석 결과를 받지 못했어요. 잠시 후 다시 시도해 주세요.', "Couldn't read the analysis result. Please try again."));
      }

      // 분석 성공 — 프로젝트 + (Phase 1 rope) + 세션 생성.
      if (elapsedTimerRef.current) clearInterval(elapsedTimerRef.current);
      // Persist even for logged-out voyagers: establish a durable anonymous auth
      // identity at the moment of commitment (a real submitted problem, past any
      // crawler) so the project + early seal + session reach the server. RLS
      // needs a real auth.uid(); this fails soft to local-only if anon sign-in
      // is disabled. A later real sign-in supersedes it (migrateLocalToAccount).
      await ensureUserId();
      const normalizedTitle = text.replace(/\s+/g, ' ').trim();
      const projectTitle = normalizedTitle.length > 72
        ? `${normalizedTitle.slice(0, 69).trimEnd()}…`
        : normalizedTitle;
      const pid = createProject(projectTitle);
      // Keep the pre-review baseline before analysis is revealed. The final seal
      // later separates it from the user's closing judgment while preserving the
      // baseline as chronology, never as a score input.
      // Skip (bind === null) writes nothing — honest-empty, identical to before.
      if (bind) {
        const early = buildEarlyContract(pid, bind, Date.now());
        if (early) {
          updateProject(pid, { decision_contract: early });
          track('decision_baseline_captured', { source: 'bind_open', anonymous: !user, has_lean: !!bind.lean, has_date: !!(bind.interval || bind.check_in_at) });
        }
      }
      progressiveStore.createSession(pid, text, reviewerAgentId);
      progressiveStore.addSnapshot(result.snapshot);
      if (result.detectedDM) progressiveStore.setDecisionMaker(result.detectedDM);
      progressiveStore.addQuestion(result.question);
      progressiveStore.setPhase('conversing');

      setPhase('ready');
      onReady(pid);
    } catch (err) {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (elapsedTimerRef.current) clearInterval(elapsedTimerRef.current);
      // 사용자가 직접 취소한 경우 → 에러 배너 없이 조용히 idle로 복귀
      if (controller.signal.aborted) {
        setPhase('idle');
        setStreamingText('');
        track('workspace_analysis_cancelled', { anonymous: !user });
        return;
      }
      const errMsg = err instanceof Error ? err.message : String(err);
      // LLM layer가 던지는 분류 신호:
      //   - "LOGIN_REQUIRED:..." prefix → 익명 무료 체험 소진 (categorizeError at 429+needsLogin)
      //   - "한도" / "rate" → 로그인 사용자의 일반 rate limit
      const needsLogin = errMsg.startsWith('LOGIN_REQUIRED');
      const isServiceUnavailable = errMsg.startsWith('SERVICE_UNAVAILABLE');
      const isRateLimit = !needsLogin && !isServiceUnavailable && (errMsg.includes('한도') || errMsg.includes('rate') || errMsg.includes('limit') || errMsg.includes('429'));

      // errMsg 그대로 setError — 렌더 쪽에서 prefix로 분기해 login CTA vs generic 배너 결정.
      // 세션은 아직 생성 안 했으므로 정리 로직 불필요.
      setError(errMsg || L('분석이 끝까지 가지 못했어요. 적어주신 내용은 그대로 있어요 — 다시 시도해 주세요.', "The analysis didn't finish. What you wrote is still here — please try again."));
      setPhase('idle');
      setStreamingText('');
      // Keep failure telemetry diagnostic but never persist the provider's raw
      // message: upstream errors can echo user material or internal details.
      track('workspace_start_error', {
        category: needsLogin
          ? 'login_required'
          : isServiceUnavailable
            ? 'service_unavailable'
            : isRateLimit
              ? 'rate_limit'
              : err instanceof Error ? err.name : 'unknown',
        is_rate_limit: isRateLimit,
        needs_login: needsLogin,
      });
      if (needsLogin || isRateLimit) {
        track('quota_blocked', { reason: needsLogin ? 'anon_quota' : 'auth_quota', anonymous: !user });
      }
    }
  };

  // 회고 봉인 온보딩 (베팅③, W2) — a first-session run of the seal→settle loop on
  // an already-known past decision. Rendered inside HeroFlow (no new route); exit
  // returns to idle, lossless. Demo-equal option, entered from the empty state.
  if (phase === 'retro') {
    return (
      <div className="relative min-h-[calc(100vh-64px)] overflow-hidden">
        <div className="absolute inset-0 pointer-events-none" style={{ background: 'var(--gradient-concert-hall)' }} />
        <Graticule opacity={0.02} spacing={18} />
        <div className="relative">
          <RetroSeal
            onExit={() => setPhase('idle')}
            onRealSeal={() => {
              // [C3] real-decision onramp: clear the just-closed retro project so
              // the idle main input starts a fresh, blind decision (not the retro).
              useProjectStore.getState().setCurrentProjectId(null);
              setPhase('idle');
            }}
          />
        </div>
      </div>
    );
  }

  // Demo mode — show showcase
  if (demoScenario) {
    return (
      <div className="relative min-h-[calc(100vh-64px)] overflow-hidden">
        <div className="absolute inset-0 pointer-events-none" style={{ background: 'var(--gradient-concert-hall)' }} />
        <Graticule opacity={0.02} spacing={18} />
        <div className="relative h-[calc(100vh-64px)]">
          <InteractiveDemo
            scenario={demoScenario}
            locale={locale}
            onStartReal={() => {
              setProblemInput(demoScenario.problemText);
              setJustFromDemo(true);
              setDemoScenario(null);
              // Next paint: scroll input into view + focus + place caret at end
              requestAnimationFrame(() => {
                const el = inputRef.current;
                if (el) {
                  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  el.focus();
                  const len = el.value.length;
                  el.setSelectionRange(len, len);
                }
              });
            }}
            onBack={() => setDemoScenario(null)}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-[calc(100vh-64px)] overflow-hidden">
      {/* Top heading rung for the document outline — the shell was built from
          spans + h2s with no h1, so screen-reader heading nav started mid-level.
          Visually hidden; the real orientation stays the on-screen h2 below. */}
      <h1 className="sr-only">{L('워크스페이스 — 결정 정리', 'Workspace — decision workspace')}</h1>
      <div className="absolute inset-0 pointer-events-none" style={{ background: 'var(--gradient-concert-hall)' }} />
      <div className="absolute inset-0 pointer-events-none" style={{ background: 'var(--gradient-warm-vignette)' }} />
      <Graticule opacity={0.03} spacing={14} />

      <div className="relative max-w-2xl mx-auto px-5 md:px-6 pt-8 md:pt-16 pb-16">
        {/* initial={false}: the first-mounted phase renders at its visible
            `animate` state with no enter animation, so the required idle input
            screen can never get stuck at opacity:0 if the entrance animation
            fails to fire (P0 render trap). Phase-to-phase transitions after the
            initial mount still animate normally. */}
        <AnimatePresence mode="wait" initial={false}>
          {/* ═══ IDLE: 시나리오 선택 + 입력 ═══ */}
          {phase === 'idle' && (
            <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.4, ease: EASE }}>

              {/* Anonymous trial note — utility copy stays on the page rather than
                  becoming the first of several stacked cards. */}
              {!user && (
                <div className="mb-5 flex items-center justify-between gap-3 border-b border-[var(--border-subtle)]/70 pb-3">
                  <div className="flex items-center gap-2 text-[12px]">
                    <Sparkles size={12} className="text-[var(--accent)] shrink-0" />
                    {/* "회" counts LLM calls, not sessions — a session uses 6–9.
                        Selling "30회" as 30 tries read as a lie by session 3.
                        Speak in the user's unit: decisions. */}
                    <span className="text-[var(--text-secondary)]">{locale === 'ko' ? <>로그인 없이도 <strong className="text-[var(--text-primary)]">하루 약 4~5개 결정</strong>을 살펴볼 수 있어요</> : <>Explore <strong className="text-[var(--text-primary)]">about 4–5 decisions a day</strong> without logging in</>}</span>
                  </div>
                  <LocaleLink href="/login" className="group -mr-2 inline-flex min-h-11 shrink-0 items-center gap-1 px-2 text-[12px] font-semibold text-[var(--accent)] hover:text-[var(--text-primary)] transition-colors">
                    {L('로그인', 'Log in')} <ChevronRight size={12} className="transition-transform group-hover:translate-x-0.5" />
                  </LocaleLink>
                </div>
              )}

              {/* Orientation — a short headline + the 3 steps, so first-timers know
                  what happens and "팀" isn't referenced cold in the input helper below. */}
              {/* The landing sells the voyage (알아봄 · the question the decision
                  rests on) — arriving on "기획안 생산 도구" copy broke that promise
                  mid-step. Same loop, same vocabulary (audit P0 #3). */}
              <div className="mb-5">
                <h2 className="text-[19px] md:text-[23px] font-semibold text-[var(--text-primary)] leading-tight mb-2.5" style={{ fontFamily: 'var(--font-display)' }}>
                  {L('지금 들고 있는 결정은 어떤 가정 위에 서 있을까요?', 'What assumptions does your decision rest on?')}
                </h2>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 text-[12.5px] text-[var(--text-tertiary)]">
                  {[
                    L('상황을 적고', 'Describe the situation'),
                    L('결정을 바꿀 전제를 짚고', 'Surface what could change the call'),
                    L('내 판단과 확인할 현실을 남겨요', 'Record your call and what to check'),
                  ].map((step, i) => (
                    <React.Fragment key={i}>
                      {i > 0 && <ChevronRight size={11} className="text-[var(--text-tertiary)]/50 shrink-0" />}
                      <span className="inline-flex items-center gap-1.5">
                        <span className="w-4 h-4 rounded-full bg-[var(--accent)]/12 text-[var(--accent)] flex items-center justify-center font-semibold text-[12.5px]">{i + 1}</span>
                        {step}
                      </span>
                    </React.Fragment>
                  ))}
                </div>
              </div>

              {/* 착륙 등불 (P0-6 ②) — one amber line when decisions wait for
                  their return answer. Same face as /project's due strip (the
                  two screens speak of the same event in the same tone).
                  Renders NOTHING at due 0; "나중에 할게요" snoozes for today
                  only. No absence-length greetings — the waiting decision is
                  the only recognition. */}
              {lanternOn && !freshStart && (
                <div className="mb-5 rounded-xl border border-amber-500/30 bg-amber-500/[0.08] px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                  <p className="flex items-center gap-1.5 text-[13px] font-semibold text-[var(--text-primary)] min-w-0 flex-1">
                    <BellRing size={16} className="shrink-0 text-amber-600 dark:text-amber-400" aria-hidden="true" />
                    <span>
                      {locale === 'ko'
                        ? `그래서, 어떻게 됐어요? — 돌아올 결정 ${dueCount}건`
                        : `So, how did it go? — ${dueCount} decision${dueCount === 1 ? '' : 's'} to return to`}
                    </span>
                  </p>
                  <div className="flex items-center gap-2 shrink-0">
                    <LocaleLink
                      href="/project"
                      className="px-3 py-1.5 rounded-lg text-[12px] font-semibold border border-amber-500/40 text-amber-700 dark:text-amber-400 hover:bg-amber-500/15 transition-colors"
                    >
                      {L('지금 답하기', 'Answer now')}
                    </LocaleLink>
                    <button
                      onClick={snoozeLantern}
                      className="px-2.5 py-1.5 rounded-lg text-[12px] text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors cursor-pointer"
                    >
                      {L('나중에 할게요', 'Later')}
                    </button>
                  </div>
                </div>
              )}

              {/* PRIMARY: Direct input — the workspace's hero. Big, prominent,
                  immediately actionable. Marketing copy lives below or
                  is reserved for first-time users (no projects yet). */}
              <div className="mb-3">
                <label htmlFor="workspace-decision-input" className="block text-[15px] md:text-[16px] font-semibold text-[var(--text-primary)] mb-1.5">
                  {L('어떤 상황인가요?', "What's the situation?")}
                </label>
                <p id="workspace-decision-help" className="text-[13px] text-[var(--text-secondary)] mb-2 leading-relaxed">
                  {L('분야나 형식은 상관없어요. 떠오르는 대로 적어주세요.', 'Any field or format is fine. Describe it however it comes to mind.')}
                </p>
                {projects.length === 0 && (
                  <ArgusCompanionNote
                    moment="companion"
                    compact
                    bare
                    mascotClassName="!h-14 !w-11"
                    title={L('한 문장이면 충분해요.', 'One sentence is enough.')}
                    className="mb-3"
                  >
                    {L('상황 속 전제와 지금 풀어야 할 질문을 함께 정리해요.', 'We’ll surface the assumptions and the question that matters now.')}
                  </ArgusCompanionNote>
                )}
                {/* PRIMARY input — lifted off the page with a soft shadow + a faint
                    accent border so it reads as THE thing to do, not just one more
                    same-toned card among the demo tiles below. */}
                <div className="rounded-2xl border border-[var(--accent)]/25 bg-[var(--surface)]/90 overflow-hidden shadow-[var(--shadow-sm)] focus-within:border-[var(--accent)]/55 focus-within:shadow-[var(--shadow-md)] transition-all">
                  {justFromDemo && (
                    <div className="px-4 md:px-5 py-2.5 bg-[var(--accent)]/8 border-b border-[var(--accent)]/15 text-[12px] text-[var(--accent)] flex items-center gap-2">
                      <Sparkles size={12} className="shrink-0" />
                      <span>{L('데모 내용을 가져왔어요. 그대로 쓰거나 내 상황으로 바꿔도 돼요.', 'Loaded from the demo. Run as-is, or rewrite for your own situation.')}</span>
                    </div>
                  )}
                  <div className="p-4 md:p-5">
                    {/* text-base (16px) on mobile prevents iOS Safari auto-zoom on focus.
                        text-[15px] on md+ keeps the desktop refined size. */}
                    <textarea ref={inputRef} id="workspace-decision-input" value={problemInput}
                      onChange={(e) => { setProblemInput(e.target.value); if (justFromDemo) setJustFromDemo(false); }}
                      onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(); } }}
                      placeholder={L('예: 다음 주까지 보고서를 써야 하는데 어디서 시작해야 할지 모르겠어', "e.g., I need to write a report by next week but don't know where to start")}
                      aria-describedby="workspace-decision-help"
                      name="decision-problem"
                      rows={3} maxLength={5000}
                      className="w-full px-3 py-2.5 bg-transparent text-base md:text-[16px] text-[var(--text-primary)] leading-[1.65] resize-none focus:outline-none placeholder:text-[var(--text-tertiary)]" />
                    <div className="flex items-center justify-between gap-3 mt-2 px-1">
                      {/* When empty: a gentle nudge (why is Start dimmed?) — shown on
                          all sizes. When typed: the desktop keyboard hint. */}
                      {problemInput.trim()
                        ? <span className="hidden md:inline text-[12.5px] text-[var(--text-tertiary)]">
                            {L('Enter로 시작 · Shift+Enter로 줄바꿈', 'Enter to start · Shift+Enter for newline')}
                          </span>
                        : <span className="text-[12.5px] text-[var(--text-tertiary)]">
                            {L('내용은 시작한 뒤에도 다듬을 수 있어요', 'You can refine this after you start')}
                          </span>}
                      {/* Shared Button, accent variant (H1-C3): the raw inline-gold
                          button had no active/hover depth and its disabled state
                          (opacity-30) visually erased the page's one next action. */}
                      <Button variant="accent" size="md" onClick={() => { setJustFromDemo(false); handleSubmit(); }} disabled={!problemInput.trim()}
                        className={`shrink-0 min-h-[44px] md:min-h-[40px] ${justFromDemo ? 'animate-pulse' : ''}`}>
                        {L('시작', 'Start')} <ChevronRight size={12} />
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Existing-document review is a secondary path, not another card. */}
                <LocaleLink
                  href="/tools/review"
                  className="group mt-2 flex items-center justify-between gap-3 border-b border-[var(--border-subtle)]/70 px-1 py-3.5 text-left"
                >
                  <div className="flex min-w-0 items-center gap-2.5">
                    <FileText size={15} className="shrink-0 text-[var(--accent)]" />
                    <div className="min-w-0">
                      <p className="text-[13px] font-semibold text-[var(--text-primary)] group-hover:text-[var(--accent)] transition-colors">
                        {L('이미 작성한 문서가 있나요?', 'Already have a document?')}
                      </p>
                      <p className="mt-0.5 text-[12px] leading-snug text-[var(--text-tertiary)]">
                        {L('전략안·기획안·PDF·PPT를 바로 검토할 수 있어요.', 'Review a strategy memo, plan, PDF, or deck.')}
                      </p>
                    </div>
                  </div>
                  <span className="shrink-0 inline-flex items-center gap-1 text-[12px] font-semibold text-[var(--accent)]">
                    <span className="hidden sm:inline">{L('문서 검토하기', 'Review document')}</span>
                    <ChevronRight size={13} className="transition-transform group-hover:translate-x-0.5" />
                  </span>
                </LocaleLink>

                {/* (P0-7) The 4 side-path chips (/agents /boss /teams /guide)
                    are gone: teams·guide were pure duplicates of the Header
                    overflow, /boss moved there too, and the crew is already
                    visible during the voyage (VoyageMapRail/CrewAtWork). The
                    routes all survive — only this extra doorway is removed so
                    the landing keeps one job: the input above. */}

                {error && error.startsWith('LOGIN_REQUIRED') && (
                  // P0-5: a returning account-holder whose session lapsed is NOT
                  // an anonymous visitor who "used up the free trial" — telling
                  // them so is a false verdict about who they are. knew-you flag
                  // (or a live user) → honest "sign-in lapsed" copy instead.
                  (user || hasKnownUser()) ? (
                    <div role="alert" className="mt-4 rounded-2xl border-2 border-[var(--accent)]/45 bg-[var(--accent)]/10 p-4 shadow-[0_12px_30px_rgba(146,105,25,0.12)] sm:p-5">
                      <div className="flex items-start gap-3">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--accent)] text-[var(--accent-fg)]">
                          <AlertTriangle size={17} aria-hidden="true" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-[15px] font-bold text-[var(--text-primary)]">{L('로그인이 잠시 풀렸어요', 'Your sign-in lapsed')}</p>
                          <p className="mt-1 text-[12.5px] leading-[1.6] text-[var(--text-secondary)]">{L('다시 로그인하면 계속 사용할 수 있어요.', 'Sign in again to continue using Argus.')}</p>
                          <LocaleLink href="/login?redirect=/workspace" className="mt-3 inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl bg-[var(--primary)] px-4 py-2 text-[12.5px] font-semibold text-[var(--bg)]">
                            {L('다시 로그인하고 이어가기', 'Sign in and continue')} <ChevronRight size={13} />
                          </LocaleLink>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div role="alert" className="mt-4 rounded-2xl border-2 border-[var(--accent)]/45 bg-[var(--accent)]/10 p-4 shadow-[0_12px_30px_rgba(146,105,25,0.12)] sm:p-5">
                      <div className="flex items-start gap-3">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--accent)] text-[var(--accent-fg)]">
                          <AlertTriangle size={17} aria-hidden="true" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-[15px] font-bold text-[var(--text-primary)]">{L('무료 사용량을 모두 썼어요', 'You’ve used the free allowance')}</p>
                          <p className="mt-1 text-[12.5px] leading-[1.6] text-[var(--text-secondary)]">{L('로그인하면 계속 사용할 수 있어요.', 'Sign in to continue using Argus.')}</p>
                          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
                            <LocaleLink href="/login?redirect=/workspace" className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl bg-[var(--primary)] px-4 py-2 text-[12.5px] font-semibold text-[var(--bg)]">
                              {L('로그인하고 계속하기', 'Sign in and continue')} <ChevronRight size={13} />
                            </LocaleLink>
                            <LocaleLink href="/settings" className="inline-flex min-h-10 items-center justify-center px-2 text-[12px] font-semibold text-[var(--accent)] hover:underline">
                              {L('API 키가 있다면 직접 연결', 'Or connect your own API key')}
                            </LocaleLink>
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                )}
                {error && !error.startsWith('LOGIN_REQUIRED') && (() => {
                  // Categorize so the user knows what to DO, not just that it failed.
                  const e = error.toLowerCase();
                  const isServiceUnavailable = e.startsWith('service_unavailable');
                  const isQuota = e.includes('한도') || e.includes('rate') || e.includes('limit') || e.includes('429') || e.includes('api 키') || e.includes('api key');
                  const isNetwork = e.includes('network') || e.includes('failed to fetch') || e.includes('fetch') || e.includes('네트워크') || e.includes('offline');
                  const isTimeout = e.includes('timeout') || e.includes('timed out') || e.includes('시간 초과') || e.includes('aborted');
                  if (isQuota) {
                    return (
                      <div role="alert" className="mt-4 rounded-2xl border-2 border-[var(--accent)]/45 bg-[var(--accent)]/10 p-4 shadow-[0_12px_30px_rgba(146,105,25,0.12)] sm:p-5">
                        <div className="flex items-start gap-3">
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--accent)] text-[var(--accent-fg)]">
                            <AlertTriangle size={17} aria-hidden="true" />
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="text-[15px] font-bold text-[var(--text-primary)]">
                              {user
                                ? L('오늘 제공된 사용량을 모두 썼어요', 'You’ve used today’s included allowance')
                                : L('무료 사용량을 모두 썼어요', 'You’ve used the free allowance')}
                            </p>
                            <p className="mt-1 text-[12.5px] leading-[1.6] text-[var(--text-secondary)]">
                              {user
                                ? L('본인의 API 키를 연결하면 계속 사용할 수 있어요.', 'Connect your own API key to continue.')
                                : L('로그인하면 계속 사용할 수 있어요.', 'Sign in to continue.')}
                            </p>
                            <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
                              <LocaleLink
                                href={user ? '/settings' : '/login?redirect=/workspace'}
                                className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl bg-[var(--primary)] px-4 py-2 text-[12.5px] font-semibold text-[var(--bg)]"
                              >
                                {user
                                  ? L('내 API 키 연결하기', 'Connect my API key')
                                  : L('로그인하고 계속하기', 'Sign in and continue')}
                                <ChevronRight size={13} />
                              </LocaleLink>
                              {!user && (
                                <LocaleLink href="/settings" className="inline-flex min-h-10 items-center justify-center px-2 text-[12px] font-semibold text-[var(--accent)] hover:underline">
                                  {L('API 키가 있다면 직접 연결', 'Or connect your own API key')}
                                </LocaleLink>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  }
                  const msg = isServiceUnavailable
                    ? L(
                        '현재 분석 기능을 사용할 수 없어요. 적어주신 내용은 그대로 남아 있습니다. 운영자 쪽 설정이 복구되면 다시 시작할 수 있어요.',
                        'Analysis is temporarily unavailable. What you wrote is still here; you can continue once the service is restored.',
                      )
                    : isNetwork
                      ? L('연결이 끊겼거나 불안정해요 — 적어주신 내용은 그대로 있어요. 연결을 확인하고 다시 시도해 주세요.', "Connection lost or unstable — what you wrote is still here. Check your connection and try again.")
                      : isTimeout
                        ? L('응답이 평소보다 오래 걸렸어요. 다시 시도하면 대개 해결돼요.', 'That took longer than usual. Trying again usually fixes it.')
                        : L('분석에 실패했어요. 잠시 후 다시 시도해주세요.', 'Analysis failed. Please try again in a moment.');
                  return (
                    // Failures wear the danger tone; gold is this product's reward
                    // color and was making errors read like promotions. Quota
                    // guidance (an FYI, not a failure) keeps the accent tone.
                    <div role="alert" className={`mt-3 px-3 py-2.5 rounded-xl text-[13px] text-[var(--text-primary)] flex items-start gap-2 border ${
                      'bg-[var(--danger)]/5 border-[var(--danger)]/25'
                    }`}>
                      <AlertTriangle size={14} aria-hidden="true" className="shrink-0 mt-0.5 text-[var(--danger)]" />
                      <div className="flex-1">
                        <span>{msg}</span>
                        <div className="mt-1.5 flex items-center gap-3">
                          {/* Quota/provider setup → settings; retry only transient failures. */}
                          {isQuota || isServiceUnavailable ? (
                            <LocaleLink href="/settings" className="text-[12px] text-[var(--accent)] font-medium hover:underline">
                              {isServiceUnavailable
                                ? L('내 API 키로 계속하기 →', 'Continue with my API key →')
                                : L('설정에서 API 키 등록하기 →', 'Register your API key in Settings →')}
                            </LocaleLink>
                          ) : (
                            <button onClick={() => handleSubmit()}
                              className="inline-flex items-center gap-1 text-[12px] text-[var(--accent)] font-semibold hover:underline cursor-pointer">
                              <RefreshCw size={11} /> {L('다시 시도', 'Try again')}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Returning user: previous projects — compact rows. Sits BELOW the
                  primary input so the workspace opens on "what's the situation?" not
                  on a history list; past projects stay reachable in the middle. */}
              {projects.length > 0 && !freshStart && (() => {
                // P1-A4: due voyages surface first (same due-first rule as
                // /project) so a promised return isn't buried under fold #4.
                const dueIdSet = new Set(dueProjects.map((d) => d.id));
                const sorted = [...projects].sort((a, b) => {
                  const ad = dueIdSet.has(a.id) ? 1 : 0;
                  const bd = dueIdSet.has(b.id) ? 1 : 0;
                  if (ad !== bd) return bd - ad;
                  const aT = a.updated_at || a.created_at || '';
                  const bT = b.updated_at || b.created_at || '';
                  return bT.localeCompare(aT);
                });
                const shown = showAllProjects ? sorted : sorted.slice(0, 3);
                // P1-A4: the quiet accumulation line — counts only, never a
                // score. Lives INSIDE the existing header (no new section:
                // the same screen just lost four chips to P0-7's subtraction).
                // Copy comes from record-summary (P1-A2) — the same brain as
                // the /project·/tools/review RecordStrip, so numbers can't drift.
                const rec = summarizeRecord(projects, Date.now());
                const sealedCount = projects.filter((p) => p.decision_contract).length;
                const accumulation = recordCompactLine(rec, sealedCount, locale);
                const relTime = (iso?: string) => {
                  if (!iso) return '';
                  const ms = Date.now() - new Date(iso).getTime();
                  if (!Number.isFinite(ms) || ms < 0) return '';
                  const m = Math.floor(ms / 60_000);
                  if (m < 60) return L(`${Math.max(1, m)}분 전`, `${Math.max(1, m)}m ago`);
                  const h = Math.floor(m / 60);
                  if (h < 24) return L(`${h}시간 전`, `${h}h ago`);
                  const d = Math.floor(h / 24);
                  return d < 30 ? L(`${d}일 전`, `${d}d ago`) : L(`${Math.floor(d / 30)}달 전`, `${Math.floor(d / 30)}mo ago`);
                };
                return (
                  // A real section break: the divider + heavier heading split "my
                  // own work" away from the input above and the demos below, so the
                  // three zones read as three, not one continuous list.
                  <div className="mt-9 pt-7 border-t border-[var(--border-subtle)]/60">
                    <div className="flex items-baseline justify-between gap-3 mb-3">
                      <p className="flex items-center gap-1.5 text-[14px] font-semibold text-[var(--text-secondary)] shrink-0">
                        <History size={14} className="text-[var(--accent)]" />
                        {L('이어서 작업', 'Continue where you left off')}
                      </p>
                      <span className="flex items-baseline gap-2.5 min-w-0 text-[12.5px] text-[var(--text-tertiary)]">
                        {accumulation && <span className="truncate">{accumulation}</span>}
                        <span className="tabular-nums shrink-0">{L(`${sorted.length}개`, `${sorted.length}`)}</span>
                      </span>
                    </div>
                    <div className="divide-y divide-[var(--border-subtle)]/70 border-y border-[var(--border-subtle)]/70">
                      {shown.map((p) => (
                        <button key={p.id} onClick={() => onReady(p.id)}
                          className="w-full text-left flex items-center gap-2.5 px-1 py-3 min-h-[44px] hover:bg-[var(--surface)]/45 cursor-pointer transition-colors group">
                          <FolderOpen size={14} className="text-[var(--accent)] shrink-0" />
                          <span className="text-[14px] text-[var(--text-primary)] truncate group-hover:text-[var(--accent)] transition-colors">{p.name}</span>
                          <span className="ml-auto flex items-center gap-2 shrink-0">
                            {/* P1-A4: the voyage-state chip this component's header
                                comment always promised (ETA D-N / 지금 정산 / 도착). */}
                            <VoyageEta contract={p.decision_contract} showArrived />
                            <span className="text-[12.5px] text-[var(--text-tertiary)] tabular-nums">{relTime(p.updated_at || p.created_at)}</span>
                          </span>
                          {/* Chevron stays visible on touch (no hover there) */}
                          <ChevronRight size={12} className="text-[var(--text-tertiary)] shrink-0 opacity-60 md:opacity-0 md:group-hover:opacity-100 transition-opacity" />
                        </button>
                      ))}
                    </div>
                    {/* Anonymous users can't reach /project (auth-gated) — without
                        this, project #4+ became unreachable though it's right
                        there in localStorage. */}
                    {sorted.length > 3 && (
                      <button onClick={() => setShowAllProjects((v) => !v)}
                        className="mt-1.5 px-3 text-[13px] text-[var(--text-tertiary)] hover:text-[var(--accent)] cursor-pointer transition-colors">
                        {showAllProjects ? L('접기 ▴', 'Show less ▴') : L(`전체 ${sorted.length}개 보기 ▾`, `Show all ${sorted.length} ▾`)}
                      </button>
                    )}
                  </div>
                );
              })()}

              {/* SECONDARY: Demo scenarios. Weight flips on who's here — for a
                  returning user (projects exist) this is a quiet "or browse" footer
                  under their own work; for a first-timer it's the main thing to try,
                  so the heading carries real weight and no divider buries it. */}
              {!freshStart && <div className={projects.length > 0 ? 'mt-9 pt-7 border-t border-[var(--border-subtle)]/60' : 'mt-7'}>
                {(() => {
                  // Returning users already have "이어서 작업" above as the main act,
                  // so the demos drop to a muted footer — smaller, flatter, single-
                  // line, no hover-lift — instead of full tiles that compete with it.
                  // A first-timer has no work yet, so for them the demos stay the
                  // primary thing to try (full tiles).
                  const muted = projects.length > 0;
                  return (
                    <>
                      <p className={`flex items-center gap-1.5 mb-3 ${muted ? 'text-[12px] text-[var(--text-tertiary)] font-medium' : 'text-[14px] text-[var(--text-secondary)] font-semibold'}`}>
                        <Compass size={muted ? 13 : 15} className="text-[var(--text-tertiary)]" />
                        {muted
                          ? L('다른 예시도 둘러보기', 'Or browse a few examples')
                          : L('처음이라면, 예시로 시작해보세요', 'New here? Start with an example')}
                      </p>
                      <div className="grid grid-cols-1 divide-y divide-[var(--border-subtle)]/70 border-y border-[var(--border-subtle)]/70 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
                        {demoScenarios.map(s => {
                          const art = DEMO_SCENARIO_ART[s.id];
                          return (
                            <button key={s.id} onClick={() => setDemoScenario(s)}
                              className="group flex min-w-0 cursor-pointer items-center gap-3 py-3 text-left transition-colors hover:bg-[var(--surface)]/45 sm:block sm:px-3 sm:py-4 first:sm:pl-0 last:sm:pr-0">
                              {art && (
                                <div className={`relative shrink-0 overflow-hidden rounded-sm bg-[var(--bg)] ${muted ? 'h-16 w-24 sm:aspect-[16/9] sm:h-auto sm:w-full' : 'h-[72px] w-[112px] sm:aspect-[16/9] sm:h-auto sm:w-full'}`} aria-hidden="true">
                                  <Image
                                    src={art}
                                    alt=""
                                    fill
                                    sizes={muted ? '(max-width: 639px) 96px, 220px' : '(max-width: 639px) 112px, 220px'}
                                    loading={muted ? 'lazy' : 'eager'}
                                    className="object-cover opacity-90 transition-[transform,opacity] duration-500 ease-out motion-reduce:transition-none group-hover:opacity-100 motion-safe:group-hover:scale-[1.02]"
                                  />
                                </div>
                              )}
                              <div className="min-w-0 flex-1 pt-0 sm:pt-2.5">
                                <div className={`flex items-center justify-between gap-2 ${muted ? 'mb-0.5' : 'mb-1.5'}`}>
                                  <span className={`font-semibold text-[var(--text-primary)] group-hover:text-[var(--accent)] transition-colors ${muted ? 'text-[12px]' : 'text-[13px]'}`}>{s.title}</span>
                                  <ChevronRight size={muted ? 12 : 13} className="shrink-0 text-[var(--text-tertiary)] opacity-55 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                                </div>
                                <p className={`text-[var(--text-tertiary)] leading-relaxed ${muted ? 'text-[12.5px] line-clamp-1' : 'text-[12px] line-clamp-3 sm:line-clamp-2'}`}>&ldquo;{s.problemText}&rdquo;</p>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </>
                  );
                })()}
              </div>}

              {/* 회고 봉인 진입 (베팅③ 1-A, W2) — a DEMO-EQUAL option in the empty
                  state: run the seal→settle loop once on a past decision you already
                  know the outcome of, so the moat (settle) is felt in the first
                  session instead of 2–3 weeks later. Never forced — sits quietly
                  beside the demos, and the primary input above is always the main
                  door. Empty state only (a returning user has their own record). */}
              {projects.length === 0 && (
                <div className="mt-1">
                  <button
                    onClick={() => setPhase('retro')}
                    className="group flex w-full cursor-pointer items-start justify-between gap-4 border-b border-[var(--border-subtle)]/70 px-1 py-4 text-left transition-colors hover:bg-[var(--surface)]/40"
                  >
                    <div className="flex min-w-0 items-start gap-2.5">
                      <History size={16} className="mt-0.5 shrink-0 text-[var(--accent)]" />
                      <div>
                        <span className="text-[13px] font-semibold text-[var(--text-primary)] group-hover:text-[var(--accent)] transition-colors">
                          {L('지난 결정으로 결과 확인 연습하기', 'Practice with a past decision')}
                        </span>
                        <p className="mt-1 text-[12px] text-[var(--text-tertiary)] leading-relaxed">
                          {L('이미 결과를 아는 결정 하나로, 결정을 남기고 결과를 확인하는 과정을 3분 안에 경험해보세요.',
                             'Use a decision whose outcome you already know to save the call and review the result in about three minutes.')}
                        </p>
                      </div>
                    </div>
                    <ChevronRight size={14} className="mt-0.5 shrink-0 text-[var(--text-tertiary)] transition-transform group-hover:translate-x-0.5 group-hover:text-[var(--accent)]" />
                  </button>
                </div>
              )}

              {/* TERTIARY: Marketing copy — only for absolute first-time users
                  (no recent projects). Returning users skip this entirely. */}
              {projects.length === 0 && (
                <div className="mt-12 pt-8 border-t border-[var(--border-subtle)]/60 text-center">
                  <p className="text-[14px] md:text-[15px] text-[var(--text-secondary)] leading-relaxed max-w-md mx-auto">
                    {locale === 'ko'
                      ? <>결정이 기대는 전제를 짚고, 지금 풀 질문을 좁혀요.<br className="hidden md:block" /> 검토 뒤에는 내 판단과 확인할 현실이 남습니다.</>
                      : <>Surface what the decision rests on and narrow the question.<br className="hidden md:block" /> Leave with your decision and a clear way to check it against reality.</>}
                  </p>
                </div>
              )}
            </motion.div>
          )}

          {/* ═══ GATING: 가벼운 길 판별 — one fast call decides light vs heavy ═══ */}
          {phase === 'gating' && (
            <motion.div key="gating" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.3, ease: EASE }} className="pt-8 md:pt-16">
              <div className="flex items-center gap-3 px-5 py-3 rounded-full bg-[var(--bg)] border border-[var(--border-subtle)] w-fit max-w-full mb-8">
                <div className="w-5 h-5 rounded-full bg-[var(--text-primary)] flex items-center justify-center shrink-0">
                  <span className="text-[var(--bg)] text-[12.5px] font-bold">{L('나', 'Me')}</span>
                </div>
                <p className="text-[13px] text-[var(--text-secondary)] truncate">{problemInput}</p>
              </div>
              <div className="flex items-center gap-2 px-1" aria-live="polite">
                <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}>
                  <Sparkles size={14} className="text-[var(--accent)]" />
                </motion.div>
                <span className="text-[12.5px] text-[var(--text-secondary)]">{L('읽고 있어요', 'Reading')}</span>
                <button
                  type="button"
                  onClick={() => { analyzeAbortRef.current?.abort(); setPhase('idle'); }}
                  className="ml-auto text-[12.5px] text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] underline underline-offset-2 cursor-pointer transition-colors"
                >
                  {L('취소', 'Cancel')}
                </button>
              </div>
            </motion.div>
          )}

          {/* ═══ LIGHT: 가벼운 길 — 비추기 → 묻기 → 남기기 ═══ */}
          {phase === 'light' && lightOpening && (
            <motion.div key="light" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.35, ease: EASE }} className="pt-4 md:pt-10">
              <LightFlow
                problemText={pendingTextRef.current}
                opening={lightOpening}
                onDeepen={handleLightDeepen}
                onClose={() => {
                  setLightOpening(null);
                  setProblemInput('');
                  setStreamingText('');
                  setPhase('idle');
                }}
              />
            </motion.div>
          )}

          {/* ═══ BIND: 출항 전 밧줄 묶기 (Phase 1) — analysis runs buffered behind it ═══ */}
          {phase === 'binding' && (
            <motion.div key="binding" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.3, ease: EASE }} className="pt-8 md:pt-16">
              <BindCard problem={pendingTextRef.current} onProceed={proceedAfterBind} />
            </motion.div>
          )}

          {/* ═══ ASSEMBLING: 팀 등장 ═══ */}
          {phase === 'assembling' && (
            <motion.div key="assembling" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.4, ease: EASE }} className="pt-8 md:pt-16">

              {/* 축소된 입력 */}
              <motion.div layout className="flex items-center gap-3 px-5 py-3 rounded-full bg-[var(--bg)] border border-[var(--border-subtle)] w-fit max-w-full mb-8">
                <div className="w-5 h-5 rounded-full bg-[var(--text-primary)] flex items-center justify-center shrink-0">
                  <span className="text-[var(--bg)] text-[12.5px] font-bold">{L('나', 'Me')}</span>
                </div>
                <p className="text-[13px] text-[var(--text-secondary)] truncate">{problemInput}</p>
              </motion.div>

              {/* 팀 등장 */}
              <div className="rounded-xl bg-[var(--accent)]/[0.03] border border-[var(--accent)]/10 p-4 space-y-2.5">
                {previewPersonas.map((p, i) => (
                  <motion.div key={p.id}
                    initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.2 + i * 0.3, duration: 0.4, ease: EASE }}
                    className="flex items-center gap-3">
                    <WorkerAvatar persona={p} size="sm" />
                    <span className="text-[13px] font-medium text-[var(--text-primary)]">{p.name}</span>
                    <span className="text-[12.5px] text-[var(--text-tertiary)]">{p.role}</span>
                  </motion.div>
                ))}
                <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.2, duration: 0.4 }}
                  className="text-[12.5px] text-[var(--text-tertiary)] pt-1">
                  {/* Honest framing: the initial pass is a single read that finds the real
                      question; this crew does its individual work later, at the worker stage. */}
                  {L('AI 검토자 4명이 이 상황을 따로 살펴보고 있어요 — 먼저 지금 풀어야 할 질문을 정리합니다...', 'Four AI reviewers are looking at this separately — first, organizing the question to solve...')}
                </motion.p>
              </div>
            </motion.div>
          )}

          {/* ═══ ANALYZING: 스트리밍 분석 — 구조화된 필드별 렌더링 ═══ */}
          {phase === 'analyzing' && (() => {
            const partial = parsePartialAnalysis(streamingText);
            const stageLabel = (() => {
              switch (partial.stage) {
                case 'reading': return L('상황을 읽는 중', 'Reading the situation');
                case 'question': return L('지금 풀어야 할 질문을 정리하는 중', 'Organizing the question to solve');
                case 'assumptions': return L('확인할 가정을 살펴보는 중', 'Reviewing assumptions to check');
                case 'skeleton': return L('문서 구성을 잡는 중', 'Structuring the document');
              }
            })();
            const hasQuestion = !!partial.real_question;
            const hasAssumptions = partial.hidden_assumptions.length > 0;
            const hasSkeleton = partial.skeleton.length > 0;
            return (
              <motion.div key="analyzing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                transition={{ duration: 0.4, ease: EASE }} className="pt-6 md:pt-10">

                {/* 상단: 팀 아바타 + 문제 echo */}
                <div className="flex items-center gap-3 mb-5">
                  <AvatarRow personas={previewPersonas} />
                  <p className="text-[13px] text-[var(--text-secondary)] truncate flex-1">{problemInput}</p>
                </div>

                {/* 현재 단계 표시 + 소요 시간 안내 (멈춘 게 아니라는 신호).
                    aria-live: the 20–40s core moment was silent to screen readers. */}
                <div className="flex items-center gap-2 mb-4 px-1" aria-live="polite">
                  <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}>
                    <Sparkles size={14} className="text-[var(--accent)]" />
                  </motion.div>
                  <span className="text-[12px] font-medium text-[var(--accent)]">{stageLabel}</span>
                  <span className="text-[12.5px] text-[var(--text-tertiary)] ml-auto tabular-nums">
                    {elapsed >= 3 ? L(`${elapsed}초 경과`, `${elapsed}s elapsed`) : L('보통 20~40초', 'usually 20–40s')}
                  </span>
                  <button
                    type="button"
                    onClick={() => analyzeAbortRef.current?.abort()}
                    className="text-[12.5px] text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] underline underline-offset-2 cursor-pointer transition-colors"
                  >
                    {L('취소', 'Cancel')}
                  </button>
                </div>

                {/* ─── 무대 연출: 이 순간의 주인공은 '진짜 질문' 하나다.
                    (기존: 같은 무게의 박스 3개가 전문을 폭포로 덤프 — 한 문장
                    입력에 600단어 벽. 창업자 실사용 지적.) 가정·뼈대는 개수 +
                    방금 채워진 한 줄 티커로만 살아있음을 보여주고, 전문은
                    분석 완료 후 항로 카드에서 제 위계로 읽힌다. */}
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: hasQuestion ? 1 : 0.5, y: 0 }}
                  transition={{ duration: 0.4, ease: EASE }}
                  className="rounded-2xl border border-[var(--accent)]/15 bg-[var(--surface)] p-5 md:p-6 mb-3"
                >
                  <div className="text-[12px] font-bold text-[var(--accent)] uppercase tracking-[0.15em] mb-2.5">
                    {L('지금 풀어야 할 질문', 'The question to solve now')}
                  </div>
                  <div className="text-[17px] md:text-[19px] leading-[1.45] text-[var(--text-primary)] whitespace-pre-wrap break-words min-h-[28px]" style={{ fontFamily: 'var(--font-display)' }}>
                    {hasQuestion ? partial.real_question : <span className="text-[var(--text-tertiary)] text-[13px]" style={{ fontFamily: 'inherit' }}>{L('찾는 중...', 'Searching...')}</span>}
                    {hasQuestion && !partial.real_question_complete && (
                      <span className="inline-block w-[2px] h-[18px] bg-[var(--accent)] ml-0.5 animate-pulse align-middle" />
                    )}
                  </div>
                </motion.div>

                {/* 채워지는 것들 — 개수 + 방금 도착한 항목 한 줄. 벽이 아니라 맥박. */}
                {(hasAssumptions || hasSkeleton || partial.stage === 'assumptions' || partial.stage === 'skeleton') && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.4, ease: EASE }}
                    className="px-1.5 space-y-1"
                  >
                    <div className="flex items-center gap-3 text-[13px] text-[var(--text-tertiary)] tabular-nums">
                      <span className={hasAssumptions ? 'text-[var(--text-secondary)]' : ''}>
                        {L(`확인할 가정 ${partial.hidden_assumptions.length}`, `${partial.hidden_assumptions.length} assumptions to check`)}
                      </span>
                      <span aria-hidden>·</span>
                      <span className={hasSkeleton ? 'text-[var(--text-secondary)]' : ''}>
                        {L(`문서 구성 ${partial.skeleton.length}`, `${partial.skeleton.length} document sections`)}
                      </span>
                      <span className="text-[var(--text-tertiary)]/70">{L('— 분석이 끝나면 전문이 열려요', '— full text opens when analysis lands')}</span>
                    </div>
                    {/* 마지막으로 도착한 항목 하나만 — 살아있다는 신호 */}
                    {(() => {
                      const latestItem = partial.stage === 'skeleton'
                        ? partial.skeleton[partial.skeleton.length - 1]
                        : partial.hidden_assumptions[partial.hidden_assumptions.length - 1];
                      return latestItem ? (
                        <motion.p
                          key={latestItem.slice(0, 24)}
                          initial={{ opacity: 0, y: 3 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.3, ease: EASE }}
                          className="text-[12px] text-[var(--text-tertiary)] leading-snug line-clamp-1"
                        >
                          <span className="text-[var(--accent)]">+</span> {latestItem}
                        </motion.p>
                      ) : null;
                    })()}
                  </motion.div>
                )}
              </motion.div>
            );
          })()}
        </AnimatePresence>
      </div>
    </div>
  );
}

/* ─── Step metadata ───
   NOTE: 'refine' was removed — its component no longer exists, so the tab
   rendered a completely blank content area (audit A: dead step). The refine
   loop lives inside Rehearse/Progressive flows now. `labelKo2` is the
   mobile-tab short label ('사전' alone read as "dictionary"). */
const STEPS: { id: StepId; number: string; label: string; labelKo2: string; labelEn: string; desc: string; descEn: string; icon: React.ReactNode; color: string }[] = [
  { id: 'reframe',    number: '01', label: '문제 재정의', labelKo2: '정의', labelEn: 'Reframe',    desc: '숨겨진 전제 발견', descEn: 'Uncover hidden assumptions', icon: <MessageSquare size={16} />, color: '#2d4a7c' },
  { id: 'recast',     number: '02', label: '실행 설계',   labelKo2: '설계', labelEn: 'Recast',     desc: '구조와 역할 배분', descEn: 'Structure & assign roles',    icon: <Sliders size={16} />,        color: '#8b6914' },
  { id: 'rehearse',   number: '03', label: '사전 검증',   labelKo2: '검증', labelEn: 'Rehearse',   desc: '판단자 시뮬레이션', descEn: 'Simulate decision-makers',   icon: <UserCheck size={16} />,      color: '#6b4c9a' },
  { id: 'synthesize', number: '04', label: '종합',       labelKo2: '종합', labelEn: 'Synthesize', desc: '다중 관점 통합',     descEn: 'Integrate perspectives',     icon: <Layers size={16} />,         color: '#9b5de5' },
];

function WorkspaceContent() {
  const locale = useLocale();
  const L = (ko: string, en: string) => locale === 'ko' ? ko : en;
  const searchParams = useSearchParams();
  const { activeStep, setActiveStep } = useWorkspaceStore();
  const { projects, currentProjectId, setCurrentProjectId, loadProjects } = useProjectStore();
  const { loadSettings } = useSettingsStore();
  const { user } = useAuth();
  const progressiveStore = useProgressiveStore();
  const [projectMenuOpen, setProjectMenuOpen] = useState(false);

  // Use legacy mode if ?step= is explicitly set ('refine' removed — no component)
  const explicitStep = searchParams.get('step') as StepId | null;
  const useLegacyMode = explicitStep && ['reframe', 'recast', 'rehearse', 'synthesize'].includes(explicitStep);

  // Boss에서 넘어온 경우 reviewer agent ID
  const reviewerParam = searchParams.get('reviewer');
  // "Start a fresh decision" signals: the hero input (?q=…) and the
  // "내 결정으로 직접 해보기" CTA (?new=1).
  const queryProblem = searchParams.get('q');
  const forceNew = searchParams.get('new') === '1';

  // Any fresh-start entry must land on a FRESH HeroFlow, not the persisted
  // recent project. currentProjectId is persisted (restored by loadProjects), so
  // without clearing it a returning user's open project renders and the fresh
  // intent — the Boss handoff (?reviewer), the typed problem (?q), or the CTA's
  // new start (?new) — is silently dropped. Clearing also wipes the stored id,
  // and this effect is declared BEFORE loadProjects so the restore finds nothing.
  useEffect(() => {
    if (reviewerParam || forceNew || queryProblem) setCurrentProjectId(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reviewerParam, forceNew, queryProblem]);

  useEffect(() => {
    loadProjects();
    loadSettings();
    progressiveStore.loadSessions();
    // Required so ReviewerBadge can resolve ?reviewer=<agentId> when the user
    // arrives from Boss's "기획안 만들기" link. Without this, agents stays
    // empty and the badge silently returns null even though the reviewer
    // is correctly attached to the session.
    useAgentStore.getState().loadAgents();
    track('workspace_enter', { has_user: !!user, has_projects: projects.length > 0 });
  }, [loadProjects, loadSettings]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (useLegacyMode && explicitStep) {
      setActiveStep(explicitStep);
    }
  }, [explicitStep, useLegacyMode, setActiveStep]);

  // Legacy mode navigates with pushState — without a popstate listener the
  // browser back button changed the URL but not the screen.
  useEffect(() => {
    const onPop = () => {
      const step = new URLSearchParams(window.location.search).get('step') as StepId | null;
      if (step && ['reframe', 'recast', 'rehearse', 'synthesize'].includes(step)) setActiveStep(step);
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [setActiveStep]);

  const handleNavigate = (step: string) => {
    const stepId = step.replace('/tools/', '') as StepId;
    setActiveStep(stepId);
    window.history.pushState(null, '', `${window.location.pathname}?step=${stepId}`);
  };

  const currentProject = currentProjectId ? projects.find(p => p.id === currentProjectId) : null;

  // Check if current project has a progressive session
  const progressiveSession = currentProjectId
    ? progressiveStore.sessions.find(s => s.project_id === currentProjectId)
    : null;

  // Sync the active session id to the restored project in an EFFECT, never during
  // render. The old in-render setState (below) flagged React's "Cannot update a
  // component while rendering" on every reload-with-session (currentSessionId
  // hydrates as null). The flow waits one frame for this to land (guard below).
  useEffect(() => {
    if (!progressiveSession || useLegacyMode) return;
    if (useProgressiveStore.getState().currentSessionId !== progressiveSession.id) {
      useProgressiveStore.setState({ currentSessionId: progressiveSession.id });
    }
    // Depend on the session id (stable), not the object (a fresh find() each render).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [progressiveSession?.id, useLegacyMode]);

  /* ─── Empty state: HeroFlow with morphing transition ─── */
  if (!currentProjectId) {
    return (
      <HeroFlow
        onReady={(pid) => {
          setCurrentProjectId(pid);
          // Strip the fresh-start params so a later reload of /workspace resumes
          // THIS new project instead of the clear-effect wiping it again.
          // reviewerParam MUST be here too: the clear-effect fires on all three,
          // but the strip omitted reviewer → reloading /workspace?reviewer=<id>
          // re-cleared the just-created reviewer session and landed on empty Hero.
          if ((forceNew || queryProblem || reviewerParam) && typeof window !== 'undefined') {
            window.history.replaceState(null, '', window.location.pathname);
          }
        }}
        projects={projects}
        user={user}
        reviewerAgentId={reviewerParam || undefined}
        initialProblem={queryProblem || undefined}
        freshStart={forceNew}
      />
    );
  }

  /* ─── Progressive Flow: default for new sessions ─── */
  if (progressiveSession && !useLegacyMode) {
    // Wait one frame for the effect above to sync the active session id — avoids
    // both the setState-in-render violation and rendering the flow on a null session.
    if (progressiveStore.currentSessionId !== progressiveSession.id) return null;
    return (
      <ProgressiveLayout projectId={progressiveSession.project_id} projectName={currentProject?.name} onReset={() => {
        setCurrentProjectId(null);
        useProgressiveStore.setState({ currentSessionId: null });
      }} />
    );
  }

  /* ─── Active workspace: step content (legacy 4-tab mode) ─── */
  return (
    <div className="flex flex-col min-h-[calc(100vh-64px)]">
      {/* Top bar: project + step indicator */}
      <div className="border-b border-[var(--border)] bg-[var(--surface)]">
        <div className="max-w-5xl mx-auto px-4 md:px-6 flex items-center gap-3">
          {/* Project name + switcher */}
          {currentProject && (
            <div className="relative shrink-0">
              <button
                onClick={() => setProjectMenuOpen(!projectMenuOpen)}
                className="flex items-center gap-1.5 py-2.5 text-[12px] font-semibold text-[var(--text-secondary)] hover:text-[var(--accent)] cursor-pointer transition-colors"
              >
                <FolderOpen size={13} className="text-[var(--accent)]" />
                <span className="max-w-[120px] truncate">{currentProject.name}</span>
                <ChevronDown size={11} />
              </button>
              {projectMenuOpen && (
                <div className="absolute top-full left-0 mt-1 w-56 bg-[var(--surface)] border border-[var(--border)] rounded-xl shadow-[var(--shadow-lg)] z-50 py-1">
                  {projects.map(p => (
                    <button
                      key={p.id}
                      onClick={() => { setCurrentProjectId(p.id); setProjectMenuOpen(false); }}
                      className={`w-full text-left px-3 py-2 text-[12px] cursor-pointer transition-colors ${
                        p.id === currentProjectId
                          ? 'text-[var(--accent)] font-semibold bg-[var(--accent)]/5'
                          : 'text-[var(--text-primary)] hover:bg-[var(--bg)]'
                      }`}
                    >
                      {p.name}
                    </button>
                  ))}
                  <div className="border-t border-[var(--border)] mt-1 pt-1">
                    <button
                      onClick={() => { setCurrentProjectId(null); setProjectMenuOpen(false); }}
                      className="w-full text-left px-3 py-2 text-[12px] text-[var(--accent)] font-medium cursor-pointer hover:bg-[var(--bg)]"
                    >
                      {L('+ 새 프로젝트', '+ New Project')}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Divider */}
          {currentProject && <div className="w-px h-5 bg-[var(--border)] shrink-0" />}

          {/* Step indicator */}
          <div className="flex items-center gap-1 overflow-x-auto py-2 scrollbar-hide flex-1">
            {STEPS.map((step, i) => {
              const isActive = activeStep === step.id;
              return (
                <div key={step.id} className="flex items-center shrink-0">
                  {i > 0 && (
                    <ChevronRight size={12} className="text-[var(--text-tertiary)] mx-1" />
                  )}
                  <button
                    ref={(el) => {
                      if (el && isActive) {
                        el.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
                      }
                    }}
                    onClick={(e) => {
                      handleNavigate(step.id);
                      (e.currentTarget as HTMLButtonElement).scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
                    }}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg text-[13px] font-medium transition-all cursor-pointer ${
                      isActive
                        ? 'bg-[var(--bg)] shadow-[var(--shadow-xs)] text-[var(--text-primary)]'
                        : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg)]/50'
                    }`}
                  >
                    <div
                      className="w-6 h-6 rounded-md flex items-center justify-center shrink-0"
                      style={{
                        backgroundColor: isActive ? `${step.color}15` : 'transparent',
                        color: isActive ? step.color : 'var(--text-tertiary)',
                      }}
                    >
                      {step.icon}
                    </div>
                    <span className="hidden sm:inline">{locale === 'ko' ? step.label : step.labelEn}</span>
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Step content area */}
      <div className="flex-1 overflow-y-auto relative">
        {/* Concert hall ambient */}
        <div className="absolute inset-x-0 top-0 h-64 pointer-events-none" style={{ background: 'var(--gradient-stage-light)' }} />
        <Graticule opacity={0.02} spacing={18} />

        {/* Anonymous trial banner */}
        {!user && (
          <div className="relative max-w-4xl mx-auto px-4 md:px-6 lg:px-8 mt-4">
            <div className="flex items-center justify-between gap-3 px-4 py-2.5 rounded-xl bg-[var(--accent)]/8 border border-[var(--accent)]/15">
              <div className="flex items-center gap-2 text-[12px]">
                <Sparkles size={13} className="text-[var(--accent)] shrink-0" />
                <span className="text-[var(--text-primary)]">
                  {locale === 'ko' ? <>일반적인 사용 기준, 로그인 없이 <strong>하루 약 4~5개 결정</strong> · <LocaleLink href="/login" className="text-[var(--accent)] font-semibold underline">로그인</LocaleLink>하면 약 6~8개</> : <>For typical use, <strong>about 4–5 decisions/day</strong> without login · <LocaleLink href="/login" className="text-[var(--accent)] font-semibold underline">log in</LocaleLink> for about 6–8</>}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Step component */}
        <div className="relative p-4 md:p-6 lg:p-8 max-w-4xl mx-auto animate-fade-in" key={activeStep}>
          <ErrorBoundary renderFallback={(reset) => <StepErrorFallback onRetry={reset} />}>
            {activeStep === 'reframe' && <ReframeStep onNavigate={handleNavigate} />}
            {activeStep === 'recast' && <RecastStep onNavigate={handleNavigate} />}
            {activeStep === 'rehearse' && <RehearseStep onNavigate={handleNavigate} />}
            {activeStep === 'synthesize' && <SynthesizeStep onNavigate={handleNavigate} />}
          </ErrorBoundary>
        </div>
      </div>

      {/* Quick chat bar */}
      <QuickChatBar activeStep={activeStep} onNavigate={handleNavigate} />

      {/* Navigator strip */}
      <NavigatorStrip />

      {/* Mobile bottom nav */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-[var(--surface)] border-t border-[var(--border)] z-40">
        <div className="flex items-center justify-around px-1 py-1.5">
          {STEPS.map((step) => (
            <button
              key={step.id}
              onClick={() => handleNavigate(step.id)}
              className={`flex flex-col items-center justify-center gap-0.5 min-w-[52px] min-h-[44px] px-2 py-1 rounded-xl cursor-pointer transition-colors ${
                activeStep === step.id
                  ? 'text-[var(--accent)] bg-[var(--accent)]/8'
                  : 'text-[var(--text-tertiary)]'
              }`}
            >
              <div style={{ color: activeStep === step.id ? step.color : undefined }}>
                {step.icon}
              </div>
              <span className="text-[12px] font-semibold">{locale === 'ko' ? step.labelKo2 : step.labelEn.slice(0, 3)}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function SuspenseFallback() {
  const locale = useLocale();
  const L = (ko: string, en: string) => locale === 'ko' ? ko : en;
  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="text-center space-y-3">
        <div className="w-8 h-8 rounded-full border-2 border-[var(--accent)] border-t-transparent animate-spin mx-auto" />
        <p className="text-[13px] text-[var(--text-secondary)]">{L('워크스페이스 준비 중...', 'Preparing your workspace...')}</p>
      </div>
    </div>
  );
}

export default function WorkspacePage() {
  return (
    <Suspense fallback={<SuspenseFallback />}>
      <WorkspaceContent />
    </Suspense>
  );
}
