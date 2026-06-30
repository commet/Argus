'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useWorkspaceStore, type StepId } from '@/stores/useWorkspaceStore';
import { useProjectStore } from '@/stores/useProjectStore';
import { useProgressiveStore } from '@/stores/useProgressiveStore';
import { useShallow } from 'zustand/react/shallow';
import { useAgentStore } from '@/stores/useAgentStore';
import { ReframeStep } from '@/components/workspace/ReframeStep';
import { RecastStep } from '@/components/workspace/RecastStep';
import { RehearseStep } from '@/components/workspace/RehearseStep';
import { SynthesizeStep } from '@/components/workspace/SynthesizeStep';
import { ProgressiveFlow } from '@/components/workspace/progressive/ProgressiveFlow';
import { WorkerDrawer, useWorkers } from '@/components/workspace/progressive/WorkerPanel';
import { LogbookDrawer } from '@/components/workspace/progressive/Logbook';
import { VoyageMapRail } from '@/components/workspace/progressive/VoyageMapRail';
import { QuickChatBar } from '@/components/workspace/QuickChatBar';
import { NavigatorStrip } from '@/components/workspace/NavigatorStrip';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { useLocale } from '@/hooks/useLocale';
import { playTransitionTone, resumeAudioContext } from '@/lib/audio';
import { runInitialAnalysis } from '@/lib/progressive-engine';
import { buildEarlyContract } from '@/lib/decision-contract';
import { Sparkles, ChevronRight, MessageSquare, Sliders, UserCheck, RefreshCw, FolderOpen, ChevronDown, AlertTriangle, Layers, Bot, Users, BookOpen, History, Compass } from 'lucide-react';
import { track } from '@/lib/analytics';
import { useAuth } from '@/lib/auth';
import { LocaleLink } from '@/components/ui/LocaleLink';
import { Graticule } from '@/components/ui/VoyageElements';
import { EASE } from '@/components/workspace/progressive/shared/constants';
import { getPersonaPool } from '@/lib/worker-personas';
import { WorkerAvatar, AvatarRow } from '@/components/workspace/progressive/WorkerAvatar';
import { BindCard, type BindResult } from '@/components/workspace/progressive/BindCard';
import { InteractiveDemo } from '@/components/workspace/InteractiveDemo';
import { getDemoScenarios } from '@/lib/demo-data';
import type { DemoScenario } from '@/lib/demo-data';
import { motion, AnimatePresence } from 'framer-motion';
import type { WorkerPersona } from '@/stores/types';
import { ErrorBoundary } from '@/components/layout/ErrorBoundary';
import { parsePartialAnalysis } from '@/lib/partial-analysis';
import { DAILY_LIMIT } from '@/lib/quota-config';

/* ─── Step-level error fallback ─── */
function StepErrorFallback() {
  const locale = useLocale();
  const L = (ko: string, en: string) => locale === 'ko' ? ko : en;
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <AlertTriangle size={28} className="text-[var(--text-tertiary)] mb-3" />
      <p className="text-[14px] font-semibold text-[var(--text-primary)] mb-1">{L('이 단계에서 문제가 생겼어요', 'An error occurred in this step')}</p>
      <p className="text-[12px] text-[var(--text-secondary)] mb-4">{L('다른 단계는 정상적으로 쓸 수 있어요.', 'Other steps are still available.')}</p>
      <button onClick={() => window.location.reload()} className="px-4 py-2 text-[13px] font-medium rounded-lg bg-[var(--accent)] text-white hover:shadow-sm transition-all cursor-pointer">
        {L('새로고침', 'Refresh')}
      </button>
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
    return sess?.branches || [];
  });
  const activeBranchId = useProgressiveStore(s => {
    const sess = s.sessions.find(x => x.id === s.currentSessionId);
    return sess?.active_branch_id ?? null;
  });
  const switchBranch = useProgressiveStore(s => s.switchBranch);
  const branchingLocked = useProgressiveStore(s => s.isBranchingLocked());
  const [branchMenuOpen, setBranchMenuOpen] = useState(false);

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
            <span className="text-[13px] font-semibold text-[var(--text-secondary)] truncate max-w-[160px] shrink-0">
              {projectName}
            </span>
            {branchInfo && (
              <span className="relative min-w-0 pl-2 ml-0.5 border-l border-[var(--border-subtle)]">
                <button
                  onClick={() => setBranchMenuOpen((o) => !o)}
                  aria-expanded={branchMenuOpen}
                  aria-haspopup="listbox"
                  title={L(`현재 항로 · 총 ${branchInfo.count}개 — 눌러서 갈아타기`, `Current course · ${branchInfo.count} total — tap to switch`)}
                  className="flex items-center gap-1 text-[12px] text-[var(--text-secondary)] min-w-0 hover:text-[var(--text-primary)] cursor-pointer min-h-[44px]"
                >
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ background: branchInfo.color }} />
                  <span className="truncate max-w-[140px]">{branchInfo.name}</span>
                  <ChevronDown size={11} className={`shrink-0 text-[var(--text-tertiary)] transition-transform ${branchMenuOpen ? 'rotate-180' : ''}`} />
                </button>
                {branchMenuOpen && (
                  <>
                    {/* click-away backdrop */}
                    <div className="fixed inset-0 z-40" onClick={() => setBranchMenuOpen(false)} />
                    <div role="listbox" className="absolute left-0 top-full z-50 mt-1 w-56 rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-lg)] p-1.5 space-y-0.5">
                      {sessionBranches.map((b) => {
                        const isActive = b.id === activeBranchId;
                        const disabled = branchingLocked && !isActive;
                        return (
                          <button
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
                            {isActive && <span className="text-[10px] text-[var(--text-tertiary)] shrink-0">{L('현재', 'now')}</span>}
                          </button>
                        );
                      })}
                      <p className="px-2.5 pt-1 pb-0.5 text-[10px] text-[var(--text-tertiary)] leading-[1.5]">
                        {branchingLocked
                          ? L('지금은 작업 중이라 갈아탈 수 없어요 — 끝나면 풀려요.', 'Switching is locked while work is running.')
                          : L('갈아타도 지금 항로는 그대로 남아요.', 'Switching keeps this course intact.')}
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

            <ErrorBoundary fallback={<StepErrorFallback />}>
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

/* ─── HeroFlow: idle → assembling → analyzing → ready ─── */
type HeroPhase = 'idle' | 'binding' | 'assembling' | 'analyzing' | 'ready';

function HeroFlow({ onReady, projects, user, reviewerAgentId, initialProblem }: {
  onReady: (projectId: string) => void;
  projects: Array<{ id: string; name: string; updated_at?: string; created_at?: string }>;
  user: unknown;
  reviewerAgentId?: string;
  initialProblem?: string;
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
  const analysisRef = React.useRef<Promise<{ result?: Awaited<ReturnType<typeof runInitialAnalysis>>; error?: unknown }> | null>(null);
  const pendingTextRef = React.useRef<string>('');
  const searchParams = useSearchParams();

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
    window.history.replaceState(null, '', '/workspace');
    // Defuse the persisted-project restore: loadProjects() restores the last
    // open project synchronously, which would unmount HeroFlow mid-analysis —
    // aborting this run and hijacking the screen to an old project while the
    // typed text is already gone from the URL (adversarial review P0 #1).
    useProjectStore.getState().setCurrentProjectId(null);
    setProblemInput(text);
    handleSubmit(text);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialProblem]);

  // Phase 1 BIND — submit no longer goes straight into generation. It fires the
  // initial analysis IN PARALLEL (buffered, not revealed) and shows the BindCard so
  // the user can tie their own rope BEFORE hearing the AI ("rope before the Sirens").
  // proceedAfterBind() then reveals the assembling/analyzing beat and finalizes.
  const handleSubmit = (directText?: string) => {
    const text = (directText || problemInput).trim();
    if (!text || phase !== 'idle') return;
    if (directText) setProblemInput(text);

    pendingTextRef.current = text;
    setError(null);
    const pool = getPersonaPool(locale);
    setPreviewPersonas(pool.slice(0, 4));
    track('workspace_problem_submit', { text_length: text.length, source: 'hero_flow' });

    // Fire the analysis now; its stream is buffered (BindCard doesn't render it),
    // so the song is captured but not heard until the rope is tied. The promise
    // never rejects — it settles to { result } | { error } so an early failure
    // during binding is surfaced only when the user proceeds.
    const controller = new AbortController();
    analyzeAbortRef.current = controller;
    analysisRef.current = startAnalysis(text, controller);

    setPhase('binding');
  };

  const startAnalysis = (text: string, controller: AbortController) =>
    runInitialAnalysis(text, (token) => {
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
    }).then((result) => ({ result })).catch((error) => ({ error }));

  // Called by BindCard. `bind` = the rope (lean + check-in) or null on skip.
  const proceedAfterBind = async (bind: BindResult | null) => {
    const text = pendingTextRef.current;
    const controller = analyzeAbortRef.current;
    if (!text || !controller) { setPhase('idle'); return; }

    // Bind funnel (P1-8): every submit shows the bind, so submit→bind_resolved gives
    // the rope-vs-skip rate; decision_sealed(source:bind_open) fires only on a tied
    // rope. Captured (data > dashboard) so the conversion tradeoff is observable.
    track('bind_resolved', { committed: !!bind, has_lean: !!bind?.lean, has_date: !!bind?.interval, anonymous: !user });

    // Reveal the team-assembling → analyzing beat while we await the (often
    // already-resolved) in-flight analysis.
    setPhase('assembling');
    setElapsed(0);
    if (elapsedTimerRef.current) clearInterval(elapsedTimerRef.current);
    elapsedTimerRef.current = setInterval(() => setElapsed(e => e + 1), 1000);
    timerRef.current = setTimeout(() => {
      if (phaseRef.current === 'assembling') setPhase('analyzing');
    }, 2000);

    const settled = await (analysisRef.current ?? Promise.resolve(
      { error: new Error('no analysis') } as { result?: Awaited<ReturnType<typeof runInitialAnalysis>>; error?: unknown },
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
      const pid = createProject(text.slice(0, 40));
      // Tie the rope at OPEN: seal the user's own lean + check-in BEFORE the song,
      // so a contract exists even if the user abandons mid-pipeline (the 47/0 fix).
      // Skip (bind === null) writes nothing — honest-empty, identical to before.
      if (bind) {
        const early = buildEarlyContract(pid, bind, Date.now());
        if (early) {
          updateProject(pid, { decision_contract: early });
          track('decision_sealed', { source: 'bind_open', anonymous: !user, has_lean: !!bind.lean, has_date: !!(bind.interval || bind.check_in_at) });
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
      const isRateLimit = !needsLogin && (errMsg.includes('한도') || errMsg.includes('rate') || errMsg.includes('limit') || errMsg.includes('429'));

      // errMsg 그대로 setError — 렌더 쪽에서 prefix로 분기해 login CTA vs generic 배너 결정.
      // 세션은 아직 생성 안 했으므로 정리 로직 불필요.
      setError(errMsg || L('분석에 실패했습니다. 다시 시도해주세요.', 'Analysis failed. Please try again.'));
      setPhase('idle');
      setStreamingText('');
      track('workspace_start_error', { error: errMsg, is_rate_limit: isRateLimit, needs_login: needsLogin });
      if (needsLogin || isRateLimit) {
        track('quota_blocked', { reason: needsLogin ? 'anon_quota' : 'auth_quota', anonymous: !user });
      }
    }
  };

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
      <div className="absolute inset-0 pointer-events-none" style={{ background: 'var(--gradient-concert-hall)' }} />
      <div className="absolute inset-0 pointer-events-none" style={{ background: 'var(--gradient-warm-vignette)' }} />
      <Graticule opacity={0.03} spacing={14} />

      <div className="relative max-w-2xl mx-auto px-5 md:px-6 pt-8 md:pt-16 pb-16">
        <AnimatePresence mode="wait">
          {/* ═══ IDLE: 시나리오 선택 + 입력 ═══ */}
          {phase === 'idle' && (
            <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.4, ease: EASE }}>

              {/* Anonymous trial banner — compact, only critical info */}
              {!user && (
                <div className="mb-5 flex items-center justify-between gap-3 px-4 py-2.5 rounded-xl bg-[var(--accent)]/8 border border-[var(--accent)]/15">
                  <div className="flex items-center gap-2 text-[12px]">
                    <Sparkles size={12} className="text-[var(--accent)] shrink-0" />
                    {/* "회" counts LLM calls, not sessions — a session uses 6–9.
                        Selling "30회" as 30 tries read as a lie by session 3.
                        Speak in the user's unit: decisions. */}
                    <span className="text-[var(--text-primary)]">{locale === 'ko' ? <>로그인 없이 <strong>하루 결정 2~3개 분량 무료</strong> · 로그인하면 더 넉넉해요</> : <><strong>2–3 decisions/day free</strong> without login · more with login</>}</span>
                  </div>
                  <LocaleLink href="/login" className="shrink-0 px-3 py-1 rounded-lg bg-[var(--accent)] text-[var(--bg)] text-[12px] font-semibold hover:shadow-[var(--shadow-sm)] transition-all">{L('로그인', 'Log in')}</LocaleLink>
                </div>
              )}

              {/* Orientation — a short headline + the 3 steps, so first-timers know
                  what happens and "팀" isn't referenced cold in the input helper below. */}
              {/* The landing sells the voyage ("어디서 갈리는지 보여드려요") —
                  arriving on "기획안 생산 도구" copy broke that promise mid-step.
                  Same loop, same vocabulary (audit P0 #3). */}
              <div className="mb-5">
                <h2 className="text-[19px] md:text-[23px] font-semibold text-[var(--text-primary)] leading-tight mb-2.5" style={{ fontFamily: 'var(--font-display)' }}>
                  {L('지금 들고 있는 결정, 어디서 갈리는지 봐 드릴게요', "That decision you're holding — let's see where it forks")}
                </h2>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 text-[11px] text-[var(--text-tertiary)]">
                  {[
                    L('상황을 적으면', 'Describe the situation'),
                    L('AI 팀이 갈리는 자리를 보여드리고', 'an AI crew shows you where it forks'),
                    L('문서와 결론 요약 한 장(현재 방위)이 남아요', 'you leave with a document & a one-page Heading'),
                  ].map((step, i) => (
                    <React.Fragment key={i}>
                      {i > 0 && <ChevronRight size={11} className="text-[var(--text-tertiary)]/50 shrink-0" />}
                      <span className="inline-flex items-center gap-1.5">
                        <span className="w-4 h-4 rounded-full bg-[var(--accent)]/12 text-[var(--accent)] flex items-center justify-center font-semibold text-[9px]">{i + 1}</span>
                        {step}
                      </span>
                    </React.Fragment>
                  ))}
                </div>
              </div>

              {/* PRIMARY: Direct input — the workspace's hero. Big, prominent,
                  immediately actionable. Marketing copy lives below or
                  is reserved for first-time users (no projects yet). */}
              <div className="mb-3">
                <label className="block text-[15px] md:text-[16px] font-semibold text-[var(--text-primary)] mb-1.5">
                  {L('어떤 상황인가요?', "What's the situation?")}
                </label>
                <p className="text-[13px] text-[var(--text-secondary)] mb-3 leading-relaxed">
                  {L('분야·형식 상관없어요. 떠오르는 대로 편하게 적어주세요 — 나머지는 팀이 정리해요.', 'Any field or format — just describe it however it comes to mind. The team handles the rest.')}
                </p>
                {/* PRIMARY input — lifted off the page with a soft shadow + a faint
                    accent border so it reads as THE thing to do, not just one more
                    same-toned card among the demo tiles below. */}
                <div className="rounded-2xl border border-[var(--accent)]/20 bg-[var(--surface)] overflow-hidden shadow-[var(--shadow-md)] focus-within:border-[var(--accent)]/50 focus-within:shadow-[var(--shadow-lg)] transition-all">
                  {justFromDemo && (
                    <div className="px-4 md:px-5 py-2.5 bg-[var(--accent)]/8 border-b border-[var(--accent)]/15 text-[12px] text-[var(--accent)] flex items-center gap-2">
                      <Sparkles size={12} className="shrink-0" />
                      <span>{L('데모 내용을 가져왔어요. 그대로 쓰거나 내 상황으로 바꿔도 돼요.', 'Loaded from the demo. Run as-is, or rewrite for your own situation.')}</span>
                    </div>
                  )}
                  <div className="p-4 md:p-5">
                    {/* text-base (16px) on mobile prevents iOS Safari auto-zoom on focus.
                        text-[15px] on md+ keeps the desktop refined size. */}
                    <textarea ref={inputRef} value={problemInput}
                      onChange={(e) => { setProblemInput(e.target.value); if (justFromDemo) setJustFromDemo(false); }}
                      onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(); } }}
                      placeholder={L('예: 다음 주까지 보고서를 써야 하는데 어디서 시작해야 할지 모르겠어', "e.g., I need to write a report by next week but don't know where to start")}
                      rows={3} maxLength={5000}
                      className="w-full px-3 py-2.5 bg-transparent text-base md:text-[16px] text-[var(--text-primary)] leading-[1.65] resize-none focus:outline-none placeholder:text-[var(--text-tertiary)]" />
                    <div className="flex items-center justify-between gap-3 mt-2 px-1">
                      {/* When empty: a gentle nudge (why is Start dimmed?) — shown on
                          all sizes. When typed: the desktop keyboard hint. */}
                      {problemInput.trim()
                        ? <span className="hidden md:inline text-[11px] text-[var(--text-tertiary)]">
                            {L('Enter로 시작 · Shift+Enter로 줄바꿈', 'Enter to start · Shift+Enter for newline')}
                          </span>
                        : <span className="text-[11px] text-[var(--text-tertiary)]">
                            {L('한 줄만 적어도 시작할 수 있어요', 'A sentence is enough to begin')}
                          </span>}
                      <button onClick={() => { setJustFromDemo(false); handleSubmit(); }} disabled={!problemInput.trim()}
                        className={`shrink-0 inline-flex items-center gap-1.5 px-5 py-3 md:py-2.5 text-white rounded-xl text-[13px] font-semibold disabled:opacity-30 cursor-pointer min-h-[44px] md:min-h-[40px] transition-shadow hover:shadow-[var(--shadow-md)] ${justFromDemo ? 'animate-pulse' : ''}`}
                        style={{ background: 'var(--gradient-gold)' }}>
                        {L('시작', 'Start')} <ChevronRight size={12} />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Secondary entries — previously near-invisible tertiary text links
                    (G-design: "눈에 전혀 안 들어와"). Now tappable chips: an icon + label
                    with a real border and hover lift, so they read as "places you can go"
                    without boxing the whole row into a heavy panel. Still secondary to the
                    input above. */}
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  {[
                    { href: '/agents', icon: Bot, label: L('AI 팀 소개', 'Meet the AI crew') },
                    { href: '/boss', icon: UserCheck, label: L('보고 상대 설정', 'Set your reviewer') },
                    { href: '/teams', icon: Users, label: L('팀', 'Teams') },
                    { href: '/guide', icon: BookOpen, label: L('가이드', 'Guide') },
                  ].map(({ href, icon: Icon, label }) => (
                    <LocaleLink
                      key={href}
                      href={href}
                      className="group inline-flex items-center gap-1.5 rounded-full border border-[var(--border-subtle)] bg-[var(--surface)] pl-2.5 pr-3 py-1.5 min-h-[36px] text-[12px] font-medium text-[var(--text-secondary)] hover:border-[var(--accent)]/40 hover:text-[var(--accent)] hover:shadow-[var(--shadow-sm)] transition-all"
                    >
                      <Icon size={13} className="text-[var(--text-tertiary)] group-hover:text-[var(--accent)] transition-colors" />
                      {label}
                    </LocaleLink>
                  ))}
                </div>

                {error && error.startsWith('LOGIN_REQUIRED') && (
                  <div className="mt-3 p-4 rounded-xl bg-[var(--accent)]/8 border border-[var(--accent)]/20">
                    <p className="text-[14px] font-bold text-[var(--text-primary)] mb-1">{L('무료 체험을 모두 사용했어요', 'Free trial limit reached')}</p>
                    <p className="text-[12px] text-[var(--text-secondary)] mb-3 leading-relaxed">{L(`로그인하면 하루 ${DAILY_LIMIT}회까지 무료로 사용할 수 있습니다.`, `Sign in to get up to ${DAILY_LIMIT} free uses per day.`)}</p>
                    <LocaleLink href="/login" className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-white text-[12px] font-semibold" style={{ background: 'var(--gradient-gold)' }}>
                      {L('로그인', 'Sign In')} <ChevronRight size={12} />
                    </LocaleLink>
                  </div>
                )}
                {error && !error.startsWith('LOGIN_REQUIRED') && (() => {
                  // Categorize so the user knows what to DO, not just that it failed.
                  const e = error.toLowerCase();
                  const isQuota = e.includes('한도') || e.includes('rate') || e.includes('limit') || e.includes('429') || e.includes('api 키') || e.includes('api key');
                  const isNetwork = e.includes('network') || e.includes('failed to fetch') || e.includes('fetch') || e.includes('네트워크') || e.includes('offline');
                  const isTimeout = e.includes('timeout') || e.includes('timed out') || e.includes('시간 초과') || e.includes('aborted');
                  const msg = isQuota
                    // Disambiguate anon "trial" from a logged-in user's daily quota —
                    // a signed-in user hasn't hit a "trial", they've used today's allowance.
                    ? (user
                        ? L(`오늘의 무료 사용 한도(하루 ${DAILY_LIMIT}회)를 다 썼어요. Settings에서 본인의 API 키를 등록하면 무제한 사용이 가능합니다.`, `You've used today's free allowance (${DAILY_LIMIT}/day). Register your own API key in Settings for unlimited use.`)
                        : L('무료 체험 한도에 도달했어요. Settings에서 본인의 API 키를 등록하면 무제한 사용이 가능합니다.', 'Free trial limit reached. Register your own API key in Settings for unlimited use.'))
                    : isNetwork
                      ? L('네트워크 연결이 불안정해요. 연결을 확인하고 다시 시도해주세요.', 'Network looks unstable. Check your connection and try again.')
                      : isTimeout
                        ? L('응답이 평소보다 오래 걸렸어요. 다시 시도하면 대개 해결돼요.', 'That took longer than usual. Trying again usually fixes it.')
                        : L('분석에 실패했어요. 잠시 후 다시 시도해주세요.', 'Analysis failed. Please try again in a moment.');
                  return (
                    // Failures wear the danger tone; gold is this product's reward
                    // color and was making errors read like promotions. Quota
                    // guidance (an FYI, not a failure) keeps the accent tone.
                    <div className={`mt-3 px-3 py-2.5 rounded-xl text-[13px] text-[var(--text-primary)] flex items-start gap-2 border ${
                      isQuota ? 'bg-[var(--accent)]/5 border-[var(--accent)]/15' : 'bg-[var(--danger)]/5 border-[var(--danger)]/25'
                    }`}>
                      <AlertTriangle size={14} className={`shrink-0 mt-0.5 ${isQuota ? 'text-[var(--accent)]' : 'text-[var(--danger)]'}`} />
                      <div className="flex-1">
                        <span>{msg}</span>
                        <div className="mt-1.5 flex items-center gap-3">
                          {/* Quota → settings; everything else → an explicit retry. */}
                          {isQuota ? (
                            <LocaleLink href="/settings" className="text-[12px] text-[var(--accent)] font-medium hover:underline">
                              {L('Settings에서 API 키 등록하기 →', 'Register your API key in Settings →')}
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
              {projects.length > 0 && (() => {
                const sorted = [...projects].sort((a, b) => {
                  const aT = a.updated_at || a.created_at || '';
                  const bT = b.updated_at || b.created_at || '';
                  return bT.localeCompare(aT);
                });
                const shown = showAllProjects ? sorted : sorted.slice(0, 3);
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
                    <div className="flex items-baseline justify-between mb-3">
                      <p className="flex items-center gap-1.5 text-[14px] font-semibold text-[var(--text-secondary)]">
                        <History size={14} className="text-[var(--accent)]" />
                        {L('이어서 작업', 'Continue where you left off')}
                      </p>
                      <span className="text-[11px] text-[var(--text-tertiary)] tabular-nums">{L(`${sorted.length}개`, `${sorted.length}`)}</span>
                    </div>
                    {/* Each past voyage rests as a real, bordered surface (not a bare
                        hover-row) so the list reads as a stack of openable cards. */}
                    <div className="space-y-1.5">
                      {shown.map((p) => (
                        <button key={p.id} onClick={() => onReady(p.id)}
                          className="w-full text-left flex items-center gap-2.5 px-3.5 py-3 md:py-2.5 min-h-[44px] rounded-xl border border-[var(--border-subtle)]/70 bg-[var(--surface)]/50 hover:bg-[var(--surface)] hover:border-[var(--accent)]/30 hover:shadow-[var(--shadow-sm)] cursor-pointer transition-all group">
                          <FolderOpen size={14} className="text-[var(--accent)] shrink-0" />
                          <span className="text-[14px] text-[var(--text-primary)] truncate group-hover:text-[var(--accent)] transition-colors">{p.name}</span>
                          <span className="text-[11px] text-[var(--text-tertiary)] shrink-0 ml-auto tabular-nums">{relTime(p.updated_at || p.created_at)}</span>
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
                        className="mt-1.5 px-3 text-[11.5px] text-[var(--text-tertiary)] hover:text-[var(--accent)] cursor-pointer transition-colors">
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
              <div className={projects.length > 0 ? 'mt-9 pt-7 border-t border-[var(--border-subtle)]/60' : 'mt-7'}>
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
                          : L('처음이라면 — 시나리오로 둘러보기', 'New here? — try a sample scenario')}
                      </p>
                      <div className={`grid grid-cols-1 sm:grid-cols-3 ${muted ? 'gap-2' : 'gap-3'}`}>
                        {demoScenarios.map(s => (
                          <button key={s.id} onClick={() => setDemoScenario(s)}
                            className={`text-left rounded-xl border cursor-pointer transition-all duration-200 group ${
                              muted
                                ? 'p-3 border-[var(--border-subtle)]/50 bg-transparent hover:bg-[var(--surface)]/70 hover:border-[var(--accent)]/25'
                                : 'p-4 border-[var(--border-subtle)] bg-[var(--surface)]/60 hover:bg-[var(--surface)] hover:border-[var(--accent)]/30 hover:shadow-[var(--shadow-md)] hover:-translate-y-0.5'
                            }`}>
                            <div className={`flex items-center gap-2 ${muted ? 'mb-1' : 'mb-2'}`}>
                              <span className={muted ? 'text-[14px] opacity-70' : 'text-[18px]'}>{s.icon}</span>
                              <span className={`font-semibold text-[var(--text-primary)] group-hover:text-[var(--accent)] transition-colors ${muted ? 'text-[12px]' : 'text-[13px]'}`}>{s.title}</span>
                            </div>
                            <p className={`text-[var(--text-tertiary)] leading-relaxed ${muted ? 'text-[11px] line-clamp-1' : 'text-[12px] line-clamp-2'}`}>&ldquo;{s.problemText}&rdquo;</p>
                          </button>
                        ))}
                      </div>
                    </>
                  );
                })()}
              </div>

              {/* TERTIARY: Marketing copy — only for absolute first-time users
                  (no recent projects). Returning users skip this entirely. */}
              {projects.length === 0 && (
                <div className="mt-12 pt-8 border-t border-[var(--border-subtle)]/60 text-center">
                  <p className="text-[14px] md:text-[15px] text-[var(--text-secondary)] leading-relaxed max-w-md mx-auto">
                    {locale === 'ko' ? <>상황을 알려주시면 AI 팀이 분석하고, 초안을 만들고,<br className="hidden md:block" /> 의사결정권자 반응까지 시뮬레이션합니다.</> : <>Tell us the situation — an AI team will analyze, draft,<br className="hidden md:block" /> and simulate decision-maker reactions.</>}
                  </p>
                </div>
              )}
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
                  <span className="text-[var(--bg)] text-[9px] font-bold">{L('나', 'Me')}</span>
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
                    <span className="text-[11px] text-[var(--text-tertiary)]">{p.role}</span>
                  </motion.div>
                ))}
                <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.2, duration: 0.4 }}
                  className="text-[11px] text-[var(--text-tertiary)] pt-1">
                  {/* Honest framing: the initial pass is a single read that finds the real
                      question; this crew does its individual work later, at the worker stage. */}
                  {L('AI 팀원 4명이 이 건을 따로따로 봐요 — 먼저 상황을 읽고 진짜 질문을 찾는 중...', 'Four AI teammates take this on separately — first, reading the situation to find the real question...')}
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
                case 'question': return L('진짜 질문을 찾는 중', 'Finding the real question');
                case 'assumptions': return L('숨은 가정을 분석하는 중', 'Analyzing hidden assumptions');
                case 'skeleton': return L('뼈대를 작성하는 중', 'Drafting the skeleton');
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
                  <span className="text-[11px] text-[var(--text-tertiary)] ml-auto tabular-nums">
                    {elapsed >= 3 ? L(`${elapsed}초 경과`, `${elapsed}s elapsed`) : L('보통 20~40초', 'usually 20–40s')}
                  </span>
                  <button
                    type="button"
                    onClick={() => analyzeAbortRef.current?.abort()}
                    className="text-[11px] text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] underline underline-offset-2 cursor-pointer transition-colors"
                  >
                    {L('취소', 'Cancel')}
                  </button>
                </div>

                {/* ─── Field 1: 진짜 질문 ─── */}
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: hasQuestion ? 1 : 0.4, y: 0 }}
                  transition={{ duration: 0.4, ease: EASE }}
                  className="rounded-2xl border border-[var(--accent)]/12 bg-[var(--surface)] p-4 md:p-5 mb-3"
                >
                  <div className="text-[10px] font-bold text-[var(--accent)] uppercase tracking-[0.15em] mb-2">
                    {L('진짜 질문', 'Real question')}
                  </div>
                  <div className="text-[15px] md:text-[16px] leading-[1.6] text-[var(--text-primary)] whitespace-pre-wrap break-words min-h-[24px]">
                    {hasQuestion ? partial.real_question : <span className="text-[var(--text-tertiary)] text-[13px]">{L('찾는 중...', 'Searching...')}</span>}
                    {hasQuestion && !partial.real_question_complete && (
                      <span className="inline-block w-[2px] h-[16px] bg-[var(--accent)] ml-0.5 animate-pulse align-middle" />
                    )}
                  </div>
                </motion.div>

                {/* ─── Field 2: 숨은 가정 ─── */}
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: partial.stage === 'assumptions' || hasAssumptions ? 1 : 0.35, y: 0 }}
                  transition={{ duration: 0.4, ease: EASE }}
                  className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] p-4 md:p-5 mb-3"
                >
                  <div className="text-[10px] font-bold text-[var(--text-tertiary)] uppercase tracking-[0.15em] mb-2">
                    {L('숨은 가정', 'Hidden assumptions')}
                  </div>
                  {hasAssumptions ? (
                    <ul className="space-y-1.5">
                      {partial.hidden_assumptions.map((a, i) => (
                        <motion.li
                          key={i}
                          initial={{ opacity: 0, x: -6 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ duration: 0.3, ease: EASE }}
                          className="text-[13px] md:text-[14px] leading-[1.55] text-[var(--text-secondary)] flex gap-2"
                        >
                          <span className="text-[var(--accent)] shrink-0">·</span>
                          <span className="flex-1">{a}</span>
                        </motion.li>
                      ))}
                    </ul>
                  ) : (
                    <span className="text-[var(--text-tertiary)] text-[13px]">
                      {partial.stage === 'assumptions' ? L('찾는 중...', 'Searching...') : L('대기 중', 'Waiting')}
                    </span>
                  )}
                </motion.div>

                {/* ─── Field 3: 뼈대 ─── */}
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: partial.stage === 'skeleton' || hasSkeleton ? 1 : 0.35, y: 0 }}
                  transition={{ duration: 0.4, ease: EASE }}
                  className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] p-4 md:p-5"
                >
                  <div className="text-[10px] font-bold text-[var(--text-tertiary)] uppercase tracking-[0.15em] mb-2">
                    {L('문서 뼈대', 'Document skeleton')}
                  </div>
                  {hasSkeleton ? (
                    <ol className="space-y-1.5">
                      {partial.skeleton.map((s, i) => (
                        <motion.li
                          key={i}
                          initial={{ opacity: 0, x: -6 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ duration: 0.3, ease: EASE }}
                          className="text-[13px] md:text-[14px] leading-[1.55] text-[var(--text-secondary)] flex gap-2"
                        >
                          <span className="text-[var(--accent)] shrink-0 tabular-nums">{i + 1}.</span>
                          <span className="flex-1">{s}</span>
                        </motion.li>
                      ))}
                    </ol>
                  ) : (
                    <span className="text-[var(--text-tertiary)] text-[13px]">
                      {partial.stage === 'skeleton' ? L('작성 중...', 'Drafting...') : L('대기 중', 'Waiting')}
                    </span>
                  )}
                </motion.div>
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
  const { settings, loadSettings } = useSettingsStore();
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
    window.history.pushState(null, '', `/workspace?step=${stepId}`);
    if (settings.audio_enabled) {
      resumeAudioContext();
      playTransitionTone(settings.audio_volume);
    }
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
          if ((forceNew || queryProblem) && typeof window !== 'undefined') {
            window.history.replaceState(null, '', window.location.pathname);
          }
        }}
        projects={projects}
        user={user}
        reviewerAgentId={reviewerParam || undefined}
        initialProblem={queryProblem || undefined}
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
                  {locale === 'ko' ? <>로그인 없이 <strong>하루 결정 2~3개 분량 무료</strong> · <LocaleLink href="/login" className="text-[var(--accent)] font-semibold underline">로그인</LocaleLink>하면 더 넉넉해요</> : <><strong>2–3 decisions/day free</strong> without login · <LocaleLink href="/login" className="text-[var(--accent)] font-semibold underline">log in</LocaleLink> for more</>}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Step component */}
        <div className="relative p-4 md:p-6 lg:p-8 max-w-4xl mx-auto animate-fade-in" key={activeStep}>
          <ErrorBoundary fallback={<StepErrorFallback />}>
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
              <span className="text-[10px] font-semibold">{locale === 'ko' ? step.labelKo2 : step.labelEn.slice(0, 3)}</span>
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
        <p className="text-[13px] text-[var(--text-secondary)]">{L('워크스페이스 준비 중...', 'Preparing workspace...')}</p>
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
