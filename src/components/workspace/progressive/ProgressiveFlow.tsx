'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useProgressiveStore } from '@/stores/useProgressiveStore';
import {
  runDeepening,
  refineInitialFraming,
  runMix,
  runDMFeedback,
  runBossDMFeedback,
  runFinalDeliverable,
  runNavigatorReview,
  runDebate,
  runLeadSynthesis,
  type NavigatorReview,
  type DebateResult,
} from '@/lib/progressive-engine';
import { buildLeadDecompositionContext, type LeadAgentConfig } from '@/lib/lead-agent';
import { assessConvergence, assessConvergenceWithWorkers } from '@/lib/progressive-convergence';
import { exportProgressiveAsReframe, exportProgressiveAsRecast } from '@/lib/progressive-handoff';
import { useAgentStore } from '@/stores/useAgentStore';
import { usePersonaStore } from '@/stores/usePersonaStore';
import { useReframeStore } from '@/stores/useReframeStore';
import { useRecastStore } from '@/stores/useRecastStore';
import { useProjectStore } from '@/stores/useProjectStore';
import { useAgentAttentionStore, useAttributionClickOutside } from '@/stores/useAgentAttentionStore';
import { PingToast } from './PingToast';
import { runAllAIWorkers, runPipeline, type WorkerContext } from '@/lib/worker-engine';
import { withTranscript } from '@/lib/execution-transcript';
import { getCompletionNote } from '@/lib/worker-personas';
import { track } from '@/lib/analytics';
import type { FlowAnswer, AnalysisSnapshot, WorkerTask, LeadSynthesisResult } from '@/stores/types';
import { findEffectForAnswer, applySnapshotPatch } from '@/lib/question-types';
import type { StrategicForkEffect, WeaknessCheckEffect } from '@/lib/question-types';
import { TeamAssignmentModal, type PoolModalState } from './TeamAssignmentModal';
import { useChronicler } from './useChronicler';
import { useDraftManagement } from './hooks/useDraftManagement';
import { useScrollManagement } from './hooks/useScrollManagement';
import { DraftModals } from './DraftModals';
import { CompletionView } from './CompletionView';
import { WorkerReportStepper } from './WorkerReportStepper';
import { QuestionSection } from './QuestionSection';
import { ErrorBanner } from './ErrorBanner';
import { DeployResumeBanners } from './DeployResumeBanners';
import { PreMixStage } from './PreMixStage';
import { useWorkerActions } from '@/hooks/useWorkerActions';
import { useWorkerContext } from './WorkerPanel';
import { useLocale } from '@/hooks/useLocale';
import { t } from '@/lib/i18n';
import { personaName, personaRole } from './shared/persona-format';
import { MixPreview } from './MixPreview';
import { DMFeedback } from './DMFeedback';
import { VerificationGate } from './VerificationGate';
import { TeamDeployBanner } from './TeamDeployBanner';
import { FinalCard } from './FinalCard';
export { DMFeedback, VerificationGate, TeamDeployBanner, FinalCard }; // back-compat re-exports (were defined here)
import { EASE } from './shared/constants';
import { AnalysisCard } from './shared/AnalysisCard';
import { UpdateSummaryChip } from './shared/UpdateSummaryChip';

import {
  ReviewerBadge, PhaseAmbient, ProgressLine, AnsweredPills, PhaseStatusBar,
  StreamSnippet, LeadSynthesisCard, PhaseDivider,
  FramingConfirmation, ConvergenceStatus, PipelineExitOptions,
} from './ProgressiveFlowParts';

/* ═══ MAIN                             ═══ */
/* ═══════════════════════════════════════════ */

export function ProgressiveFlow({ projectId }: { projectId: string }) {
  const locale = useLocale();
  const L = (ko: string, en: string) => locale === 'ko' ? ko : en;
  const store = useProgressiveStore();
  const session = store.currentSession();
  // Global click-outside: clears sticky attribution hover state when user taps blank space
  useAttributionClickOutside();
  const [busy, setBusy] = useState(false);
  // Chronicler — enriches log waypoints with narration once the stream settles.
  useChronicler(session, !busy);
  const [error, setError] = useState<string | null>(null);
  const [showMix, setShowMix] = useState(false);
  const [streamingText, setStreamingText] = useState<string | null>(null);
  // Verification gate — open when the captain tries to sail with unreviewed work.
  const [verifyGateOpen, setVerifyGateOpen] = useState(false);
  // Manual team-assignment modal — kept on the parent so children can open
  // it with a single callback while we own the data shape it needs. Two
  // modes: `task` (add to a specific group) and `free` (auto-match a
  // persona to the best-fitting open group).
  const [poolModal, setPoolModal] = useState<PoolModalState>(null);
  // Which response shape the current stream represents. Handlers set this
  // because phase alone isn't enough — e.g. onFinalize streams while
  // phase === 'refining', but the stream is a doc, not feedback.
  const [streamKind, setStreamKind] = useState<'analysis' | 'doc' | 'feedback'>('analysis');
  // Fine-grained stage inside long async pipelines (mix, final) — feeds
  // PhaseStatusBar's substage so the user sees "gathering → debate → drafting"
  // instead of 30s of "Drafting the document".
  const [substage, setSubstage] = useState<string | null>(null);
  const [cmReview, setCmReview] = useState<NavigatorReview | null>(null);
  const debateResult = session?.debate_result as DebateResult | null ?? null;
  const abortRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);
  const workerAbortRef = useRef<AbortController | null>(null);
  const workersRef = useRef<Promise<void> | null>(null);
  // Scroll refs + helpers — extracted to useScrollManagement. Pure DOM
  // navigation, decoupled from worker runtime and the phase machine.
  const {
    statusBarRef, questionRef, workerSectionRef, mixPreviewRef, dmFeedbackRef,
    finalRef, answeredPillsRef, analysisCardRef, teamDeployRef,
    scroll, scrollToRef,
  } = useScrollManagement();
  // Report step is a one-at-a-time stepper (not a long scroll of all drafts).
  // The cursor is a projection of the shared `focusedWorkerId` channel, so the
  // body card and the rail roster row stay one selection: clicking a rail station
  // moves this stepper, and stepping here highlights the rail. id-based, so a
  // re-sorted crew can't drift the cursor onto the wrong agent.
  const focusedWorkerId = useAgentAttentionStore(s => s.focusedWorkerId);
  const setFocusedWorker = useAgentAttentionStore(s => s.setFocusedWorker);


  // Reset the report stepper when the active session changes — otherwise a focus
  // left on a worker id from the previous session would resolve to "not found"
  // (cursor 0) inconsistently, or linger on a stale highlight. Clearing focus
  // restarts the stepper at the first worker.
  useEffect(() => { setFocusedWorker(null); }, [session?.id, setFocusedWorker]);

  // Cleanup: abort all in-flight requests on unmount
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      workerAbortRef.current?.abort();
      abortRef.current?.abort();
    };
  }, []);

  // Auto-create the origin checkpoint on first mount of an active session
  // that has at least an initial snapshot but no checkpoints yet. Lets
  // legacy (pre-checkpoint) sessions populate naturally as the user
  // continues — and gives new sessions an "origin" rewind target.
  useEffect(() => {
    if (!session) return;
    if ((session.checkpoints || []).length > 0) return;
    if (session.snapshots.length === 0) return;
    store.recordCheckpoint('origin');
    // Single fire per session — guarded by checkpoints.length === 0.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.id, session?.snapshots.length]);

  // Supabase Realtime: subscribe to session updates (human agent responses)
  useEffect(() => {
    if (!session?.id) return;
    const hasPendingHumans = (session.workers || []).some(
      w => w.agent_type === 'human' && (w.status === 'sent' || w.status === 'waiting_response')
    );
    if (!hasPendingHumans) return;

    let channel: ReturnType<typeof import('@supabase/supabase-js').SupabaseClient.prototype.channel> | null = null;
    import('@/lib/supabase').then(({ supabase }) => {
      channel = supabase.channel(`session:${session.id}`)
        .on('postgres_changes', {
          event: 'UPDATE',
          schema: 'public',
          table: 'progressive_sessions',
          filter: `id=eq.${session.id}`,
        }, (payload) => {
          // Remote update — per-worker patch instead of full session overwrite
          // Only applies human response arrivals; preserves local AI worker progress
          if (!payload.new || !mountedRef.current) return;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const newRow = payload.new as any;
          const remoteData = newRow?.data;
          // Only a genuinely newer remote row warrants the heavy full reload —
          // our own writes echo back with an equal/older timestamp and must NOT
          // trigger a reload that could stomp local in-flight state.
          const localUpdatedAt = store.currentSession()?.updated_at ?? '';
          const remoteNewer = !!newRow?.updated_at && newRow.updated_at > localUpdatedAt;
          if (remoteData?.workers && Array.isArray(remoteData.workers)) {
            const localWorkers = store.currentSession()?.workers ?? [];
            let patched = false;
            for (const rw of remoteData.workers) {
              const lw = localWorkers.find(w => w.id === rw.id);
              if (lw && rw.status === 'done' && lw.status !== 'done' && rw.human_input) {
                store.updateWorker(rw.id, {
                  status: 'done',
                  result: rw.result,
                  human_input: rw.human_input,
                  response_at: rw.response_at,
                  completed_at: rw.completed_at,
                  approved: rw.approved ?? true,
                });
                patched = true;
              }
            }
            // Fallback only for a real remote change we couldn't patch precisely.
            if (!patched && remoteNewer) store.loadSessions();
          } else if (remoteNewer) {
            store.loadSessions();
          }
        })
        .subscribe();
    });

    return () => {
      if (channel) {
        import('@/lib/supabase').then(({ supabase }) => {
          supabase.removeChannel(channel!);
        });
      }
    };
  }, [session?.id, session?.workers?.filter(w => w.agent_type === 'human' && (w.status === 'sent' || w.status === 'waiting_response')).length]);

  const phase = session?.phase ?? 'input';
  const snapshots = session?.snapshots ?? [];
  const questions = session?.questions ?? [];
  const answers = session?.answers ?? [];
  const mix = session?.mix ?? null;
  const dmFb = session?.dm_feedback ?? null;
  const final_ = session?.final_deliverable ?? null;
  const finalMix = session?.final_mix ?? null;
  const round = session?.round ?? 0;
  const maxR = session?.max_rounds ?? 5; // match createSession default (legacy sessions lacking the field)

  // Elapsed timer for PhaseStatusBar — tracks seconds rather than formatting
  // inline so the same value can derive isLongWait (30s threshold) for the
  // cancel affordance.
  const [phaseStartTime, setPhaseStartTime] = useState<number | null>(null);
  const [elapsedSec, setElapsedSec] = useState(0);
  useEffect(() => {
    if (busy || phase === 'analyzing' || phase === 'mixing' || phase === 'lead_synthesizing') {
      if (!phaseStartTime) setPhaseStartTime(Date.now());
    } else {
      setPhaseStartTime(null);
      setElapsedSec(0);
    }
  }, [busy, phase]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!phaseStartTime) return;
    const t = setInterval(() => {
      setElapsedSec(Math.floor((Date.now() - phaseStartTime) / 1000));
    }, 1000);
    return () => clearInterval(t);
  }, [phaseStartTime]);
  const elapsedLabel = phaseStartTime
    ? (elapsedSec < 60 ? `${elapsedSec}s` : `${Math.floor(elapsedSec / 60)}m ${elapsedSec % 60}s`)
    : '';
  const isLongWait = elapsedSec >= 30;

  // ── Post-complete draft tree — extracted to useDraftManagement. Reads only
  // the session's drafts; decoupled from worker runtime + the phase machine. ──
  const {
    drafts, activeDraftId, activeDraft, activeDraftPathIds,
    draftIsOnBranch, previewDraft,
    drawerOpen, setDrawerOpen, previewDraftId, setPreviewDraftId,
    iterationOpen, setIterationOpen, iterationDirective, setIterationDirective,
    isIterating, justReactivatedFromBranch, setJustReactivatedFromBranch,
    onRequestRevision, handleBranchToDraft, handlePromoteDraft,
  } = useDraftManagement({ store, setError, scroll });
  const dm = session?.decision_maker ?? null;

  const qaPairs = useMemo(() => questions.map((q, i) => ({ question: q, answer: answers[i] || null })), [questions, answers]);
  const curQ = questions.length > answers.length ? questions[questions.length - 1] : null;
  const latest = snapshots[snapshots.length - 1] || null;
  const shouldMix = showMix || (phase === 'conversing' && snapshots.length > 0 && !curQ && !mix && !busy);
  const deployPhase = session?.worker_deploy_phase ?? 'none';
  const workers = session?.workers ?? [];
  const workerContext = useWorkerContext();
  const workerActions = useWorkerActions(workerContext);

  // Ping the user when every deployed worker reaches a terminal state so they
  // notice the transition — especially on mobile where the worker drawer is
  // closed by default. We only ping if we've actually *seen* workers in a
  // non-terminal state first; otherwise a resumed session with all workers
  // already done would fire the toast on mount.
  const workersPingedRef = useRef(false);
  const sawWorkingRef = useRef(false);
  useEffect(() => {
    if (workers.length === 0 || deployPhase !== 'deployed') {
      workersPingedRef.current = false;
      sawWorkingRef.current = false;
      return;
    }
    const isTerminal = (s: WorkerTask['status']) =>
      // 'validation_failed' is user-actionable (retry / use-anyway), not
      // auto-working — count it as settled so the "team done" ping isn't
      // blocked forever.
      s === 'done' || s === 'error' || s === 'waiting_input' || s === 'validation_failed';
    const stillWorking = workers.some(w => !isTerminal(w.status));
    if (stillWorking) {
      sawWorkingRef.current = true;
      workersPingedRef.current = false;
      return;
    }
    if (sawWorkingRef.current && !workersPingedRef.current) {
      workersPingedRef.current = true;
      useAgentAttentionStore.getState().ping('workers_done');
      // Voyage chart — workers all reached terminal state.
      store.recordCheckpoint('crew_done');
    }
  }, [workers, deployPhase]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!session) return null;

  /* Shared worker execution — used by both deploy and resume */
  const startWorkerExecution = (ws: WorkerTask[]) => {
    const qa = qaPairs.filter(q => q.answer).map(q => ({ question: q.question, answer: q.answer! }));
    const ctx: WorkerContext = {
      problemText: session.problem_text,
      realQuestion: latest?.real_question ?? '',
      skeleton: latest?.skeleton ?? [],
      hiddenAssumptions: latest?.hidden_assumptions ?? [],
      qaHistory: qa.map(q => ({ q: q.question.text, a: q.answer.value })),
      sessionId: session.id,
    };
    workerAbortRef.current?.abort();
    workerAbortRef.current = new AbortController();
    const workerCallbacks = {
      onStart: (id: string) => store.updateWorker(id, { status: 'running', started_at: new Date().toISOString() }),
      onStream: (id: string, text: string) => store.setWorkerStreamText(id, text),
      onComplete: (id: string, result: string, validation?: { score: number; passed: boolean; issues: string[] }) => {
        const w = store.currentSession()?.workers.find(ww => ww.id === id);
        const persona = w?.persona;
        const note = persona
          ? getCompletionNote(persona.id, locale)
          : null;
        const validationFields = validation
          ? { validation_score: validation.score, validation_passed: validation.passed, validation_feedback: validation.issues.join('; ') }
          : {};
        // v2: Use agent_type + ai_scope to determine completion behavior (not status, which gets overwritten by onStart)
        const aType = w?.agent_type;
        const isAiPreparing = (aType === 'self' || aType === 'human') && w?.ai_scope;
        if (isAiPreparing) {
          store.updateWorker(id, { status: 'waiting_input', ai_preliminary: result, stream_text: '', ...validationFields });
        } else if (w?.who === 'both' || (aType === 'ai' && w?.self_scope)) {
          store.updateWorker(id, { status: 'waiting_input', result, stream_text: '', completion_note: note, ...validationFields });
        } else {
          store.updateWorker(id, { status: 'done', result, stream_text: '', completion_note: note, completed_at: new Date().toISOString(), ...validationFields });
        }
        scroll();
      },
      onError: (id: string, error: string) => {
        // For SELF/HUMAN workers the AI step is only an optional preliminary —
        // if it fails, still drop to 'waiting_input' so the user can enter their
        // own decision. Only pure-AI workers become a hard 'error'.
        const w = store.currentSession()?.workers.find(ww => ww.id === id);
        const isAiPrep = (w?.agent_type === 'self' || w?.agent_type === 'human') && w?.ai_scope;
        if (isAiPrep) {
          store.updateWorker(id, { status: 'waiting_input', stream_text: '', error });
        } else {
          store.updateWorker(id, { status: 'error', error, stream_text: '' });
        }
      },
    };

    // Transcript wrapping — 한 번만, 최외곽에서
    const trackedCallbacks = withTranscript(session.id, workerCallbacks);

    const stages = store.currentSession()?.stages;
    const hasMultipleStages = stages && stages.length > 1;

    workersRef.current = (hasMultipleStages
      ? runPipeline(ws, stages, ctx, trackedCallbacks, workerAbortRef.current.signal)
      : runAllAIWorkers(ws, ctx, trackedCallbacks, workerAbortRef.current.signal)
    ).catch((err) => {
      console.error('[Worker orchestration error]', err);
      if (mountedRef.current) {
        setError(err instanceof Error ? err.message : L('에이전트 작업 중 오류가 발생했습니다.', 'Agent task error occurred.'));
      }
    });
  };

  /* Deploy workers — user confirmed the team */
  const onDeployWorkers = () => {
    if (deployPhase === 'deployed') return;
    const preDeployWorkers = store.currentSession()?.workers ?? [];
    if (preDeployWorkers.length === 0) return;
    // Voyage chart — capture crew composition right before they set off,
    // so the user can rewind to "before deploy" and try a different team.
    store.recordCheckpoint('crew_set');
    store.deployWorkers();
    useAgentAttentionStore.getState().ping('deploy');
    const ws = store.currentSession()?.workers ?? [];

    // Auto-send human agent questions (fire-and-forget)
    const humanWorkers = ws.filter(w => w.agent_type === 'human' && w.contact?.address && !w.sent_at);
    if (humanWorkers.length > 0) {
      import('@/lib/supabase').then(({ supabase }) => {
        supabase.auth.getSession().then(({ data: { session: authSession } }) => {
          if (!authSession?.access_token) return;
          const headers = { 'Authorization': `Bearer ${authSession.access_token}`, 'Content-Type': 'application/json' };
          for (const hw of humanWorkers) {
            const endpoint = hw.contact?.channel === 'slack' ? '/api/slack/send' : '/api/email/send-question';
            const qTitle = t('progressive.humanQTitle', { task: hw.task });
            const qContext = hw.ai_preliminary ? t('progressive.humanQContext', { ai: hw.ai_preliminary }) : '';
            const body = hw.contact?.channel === 'slack'
              ? { userId: hw.contact.address, title: qTitle, content: `${hw.question_to_human || hw.task}${qContext ? `\n\n${qContext}` : ''}`, sessionId: session.id, workerId: hw.id }
              : { to: hw.contact!.address, subject: qTitle, question: hw.question_to_human || hw.task, context: hw.ai_preliminary || '', senderName: session.decision_maker || 'Argus', sessionId: session.id, workerId: hw.id };
            fetch(endpoint, { method: 'POST', headers, body: JSON.stringify(body) })
              .then(r => r.json())
              .then(r => {
                if (r.ok) {
                  store.updateWorker(hw.id, { status: 'sent', sent_at: new Date().toISOString() });
                } else {
                  store.updateWorker(hw.id, { status: 'error', error: t('progressive.sendFailed', { reason: r.error || t('progressive.unknownError') }) });
                }
              })
              .catch(() => {
                store.updateWorker(hw.id, { status: 'error', error: t('progressive.networkError') });
              });
          }
        });
      });
    }
    startWorkerExecution(ws);
  };

  /* Resume workers — after crash/reload, continue from where we left off */
  const isResumable = deployPhase === 'deployed' && !final_
    && workers.some(w => w.status === 'pending')
    && workers.some(w => w.status === 'done' && w.result);
  const onResumeWorkers = () => {
    const ws = store.currentSession()?.workers ?? [];
    startWorkerExecution(ws);
  };

  /* Handlers */
  const onAnswer = async (value: string) => {
    if (!curQ || busy || !latest) return;
    const ans: FlowAnswer = { question_id: curQ.id, value };
    store.addAnswer(ans); store.setPhase('analyzing'); track('flow_answer', { round }); setBusy(true); setError(null); scrollToRef(statusBarRef);
    // Tell the sidebar agents "new input just landed" — triggers flash
    useAgentAttentionStore.getState().ping('answer');

    // ── Phase 1: capture typed question effect ──
    // If the question had typed metadata, pull out the effect tied to the
    // chosen option. We apply it onto the post-deepening snapshot below so
    // the LLM cannot overwrite the user's explicit fork / weakness choice.
    const typedEffect = findEffectForAnswer(curQ, value);
    let forkEffect: StrategicForkEffect | null = null;
    let weakEffect: WeaknessCheckEffect | null = null;
    if (typedEffect) {
      if ('decisionLine' in typedEffect) forkEffect = typedEffect as StrategicForkEffect;
      else if ('weakestAssumption' in typedEffect && 'nextThreeDays' in typedEffect) weakEffect = typedEffect as WeaknessCheckEffect;
    }

    try {
      const qa = qaPairs.filter(q => q.answer).map(q => ({ question: q.question, answer: q.answer! }));
      qa.push({ question: curQ, answer: ans });
      if (!dm && round === 0) {
        const v = value.toLowerCase();
        const g = value.includes('대표') || v.includes('ceo') || v.includes('founder') ? (locale === 'ko' ? '대표님' : 'CEO')
          : value.includes('팀장') || v.includes('manager') || v.includes('lead') ? (locale === 'ko' ? '팀장님' : 'Manager')
          : value.includes('투자') || v.includes('investor') || v.includes('vc') ? (locale === 'ko' ? '투자자' : 'Investor')
          : null;
        if (g) store.setDecisionMaker(g);
      }
      abortRef.current = new AbortController();
      setStreamKind('analysis');
      setStreamingText('');
      // Lead context: inject lead agent persona into deepening prompt
      let leadCtx: string | undefined;
      if (session.lead_agent) {
        const leadAgent = useAgentStore.getState().getAgent(session.lead_agent.agent_id);
        if (leadAgent) {
          const cfg: LeadAgentConfig = {
            agentId: leadAgent.id, agentName: leadAgent.name, agentNameEn: leadAgent.nameEn || leadAgent.name,
            agentRole: leadAgent.role, agentRoleEn: leadAgent.roleEn || leadAgent.role,
            expertise: leadAgent.expertise || '', tone: leadAgent.tone || '',
            domain: (session.lead_agent?.domain || 'strategy') as import('@/lib/orchestrator-classify').Domain,
          };
          leadCtx = buildLeadDecompositionContext(cfg, locale as 'ko' | 'en');
        }
      }
      const personas = usePersonaStore.getState().personas.filter(p => !p.is_example && !p.deleted_at).map(p => ({ name: p.name, role: p.role, hasContact: !!(p.contact?.email || p.contact?.slack_id) }));
      const r = await runDeepening(session.problem_text, latest, qa, round, maxR, snapshots, (text) => setStreamingText(text), abortRef.current.signal, leadCtx, personas.length > 0 ? personas : undefined);
      setStreamingText(null);
      // Phase 1: merge typed-question effects onto the fresh snapshot.
      // Strategy: if the user picked a strategic_fork option, the fork's
      // snapshotPatch (real_question/skeleton/hidden_assumptions) is what
      // the user explicitly signed up for — it takes precedence over the
      // LLM's own reinterpretation in runDeepening. decision_line is
      // stickiest: it must survive every subsequent round.
      let mergedSnapshot: AnalysisSnapshot = r.snapshot;
      if (forkEffect?.snapshotPatch) {
        mergedSnapshot = applySnapshotPatch(mergedSnapshot, forkEffect.snapshotPatch);
      }
      if (weakEffect?.snapshotPatch) {
        mergedSnapshot = applySnapshotPatch(mergedSnapshot, weakEffect.snapshotPatch);
      }
      mergedSnapshot = {
        ...mergedSnapshot,
        decision_line: forkEffect?.decisionLine ?? latest.decision_line ?? r.snapshot.decision_line,
        weakest_assumption: weakEffect?.weakestAssumption ?? latest.weakest_assumption ?? r.snapshot.weakest_assumption,
        next_three_days: weakEffect?.nextThreeDays ?? latest.next_three_days ?? r.snapshot.next_three_days,
      };
      store.addSnapshot(mergedSnapshot); store.advanceRound();
      // Prepare workers when execution_plan appears
      const existingWorkers = store.currentSession()?.workers ?? [];
      const currentDeployPhase = store.currentSession()?.worker_deploy_phase ?? 'none';
      if (r.snapshot.execution_plan && r.snapshot.execution_plan.steps.length > 0) {
        if (existingWorkers.length === 0) {
          // First time — init workers
          store.initWorkers(r.snapshot.execution_plan.steps);
        } else if (currentDeployPhase === 'ready') {
          // Plan changed before deploy — check if tasks differ
          const oldTasks = existingWorkers.map(w => w.task).sort().join('|');
          const newTasks = r.snapshot.execution_plan.steps.map(s => s.task).sort().join('|');
          if (oldTasks !== newTasks) {
            // Re-init with updated plan (workers haven't been deployed yet, safe to replace)
            store.initWorkers(r.snapshot.execution_plan.steps);
          }
        }
        // After deployed — don't touch running workers
      }
      if (r.readyForMix || !r.question) {
        setShowMix(true); store.setPhase('conversing');
        // Team analysis done — MixTrigger is mounting below. Scroll there so
        // users see the next CTA, not the phase bar above.
        scroll();
      } else {
        store.addQuestion(r.question); store.setPhase('conversing');
        // If the team is already assembled, the follow-up question is an
        // OPTIONAL refinement — the user can deploy right now. Keep the 출항
        // CTA in view (scroll to the team) instead of pulling focus down to
        // the new question, which used to strand the deploy button above.
        const teamReady = (r.snapshot.execution_plan?.steps?.length ?? 0) > 0 || currentDeployPhase === 'ready';
        // Don't guard on teamDeployRef.current here — on the turn the team first
        // appears it isn't mounted yet (React hasn't re-rendered). scrollToRef
        // re-checks the ref inside its rAF, by which point it's mounted; the
        // 'top' fallback covers the rare miss.
        if (teamReady) scrollToRef(teamDeployRef, 'top');
        else scrollToRef(questionRef);
      }
      // Voyage chart checkpoint — captures the post-answer state. Recorded
      // after addSnapshot/addQuestion so the snapshot reflects the user's
      // most recent answer.
      store.recordCheckpoint('briefing');
    } catch (e) { setStreamingText(null); if (!(e instanceof DOMException && e.name === 'AbortError')) setError(e instanceof Error ? e.message : L('분석 실패', 'Analysis failed')); store.setPhase('conversing'); scrollToRef(statusBarRef); }
    finally { setBusy(false); abortRef.current = null; }
  };

  const runMixCore = async () => {
    setBusy(true); setError(null); store.setPhase('mixing'); scrollToRef(statusBarRef);
    setSubstage(L('팀 결과 모으는 중', 'Gathering team results'));
    abortRef.current = new AbortController();
    try {
      // Wait for any running AI workers to finish before collecting results
      if (workersRef.current) {
        await workersRef.current;
        workersRef.current = null;
      }
      const qa = qaPairs.filter(q => q.answer).map(q => ({ question: q.question, answer: q.answer! }));
      // Collect mixable worker results — final + preliminary + pending_human
      const enrichedResults = store.mixableWorkerResults();
      // Group same-task results so the LLM sees them adjacent. Group order
      // mirrors first-worker step_index from initWorkers; within a group
      // results stay in their original order.
      const groupOrder = new Map<string, number>();
      enrichedResults.forEach((w, i) => {
        if (!groupOrder.has(w.taskGroupId)) groupOrder.set(w.taskGroupId, i);
      });
      const sortedResults = enrichedResults.slice().sort((a, b) => {
        const ga = groupOrder.get(a.taskGroupId) ?? 0;
        const gb = groupOrder.get(b.taskGroupId) ?? 0;
        return ga - gb;
      });
      const workerResults = sortedResults.map(w => ({
        workerId: w.workerId,
        name: w.agentName || w.persona || undefined,
        task: w.type === 'preliminary' ? `[${L('참고', 'Ref')}] ${w.task}` : w.type === 'pending_human' ? `[${L('대기', 'Pending')}] ${w.task}` : w.task,
        result: w.result,
        // Pass taskGroupId so the Mix prompt can render same-task multi-persona
        // results as a single block with sub-bullets.
        taskGroupId: w.taskGroupId,
      }));

      // 항해장 메타 리뷰 + debate (해금 시만, 비차단)
      if (workerResults.length > 0) {
        const cmWorkers = session!.workers
          .filter(w => w.approved !== false && w.result)
          .map(w => ({
            agentName: personaName(w.persona, locale) || L('에이전트', 'Agent'),
            agentRole: personaRole(w.persona, locale),
            task: w.task,
            result: w.result || '',
            // Same-task multi-persona signal for the Navigator prompt.
            taskGroupId: w.task_group_id || w.id,
          }));
        runNavigatorReview(session!.problem_text, cmWorkers)
          .then(r => { if (r && mountedRef.current) setCmReview(r); })
          .catch(() => {});

        // Critical stakes: Cross-Agent Debate (mix 전에 실행하여 결과를 반영)
        const stages = session?.stages;
        if (stages && stages.length > 1) {
          setSubstage(L('팀 내 반론 검토 중', 'Running team-internal debate'));
          const debateWorkers = cmWorkers.map(w => ({ ...w, framework: session!.workers.find(ww => ww.persona?.name === w.agentName)?.framework || null }));
          try {
            const debateRes = await runDebate(session!.problem_text, debateWorkers);
            if (debateRes) {
              store.setDebateResult(debateRes);
              // debate 결과를 workerResults에 추가하여 mix에 반영
              workerResults.push({
                workerId: '',
                name: undefined,
                task: locale === 'ko' ? `[팀 내 반론] ${debateRes.targetAgent}의 분석에 대한 비판` : `[Team Dissent] Critique of ${debateRes.targetAgent}'s analysis`,
                result: locale === 'ko' ? `${debateRes.challenge}\n\n약점: ${debateRes.weakestClaim}\n\n대안: ${debateRes.alternativeView}` : `${debateRes.challenge}\n\nWeakness: ${debateRes.weakestClaim}\n\nAlternative: ${debateRes.alternativeView}`,
                taskGroupId: 'debate',
              });
            }
          } catch { /* debate 실패해도 mix는 진행 */ }
        }
      }

      // Lead Agent Synthesis + Mix: 병렬 실행
      // Lead synthesis는 Mix의 품질을 높이지만 필수가 아님 (null 허용).
      // Lead를 먼저 시작하고 Mix와 병렬로 진행 — Lead가 먼저 끝나면 Mix에 반영, 아니면 Mix는 Lead 없이 실행.
      let leadSynthesis: LeadSynthesisResult | null = null;
      const sessionLead = session?.lead_agent;
      let leadPromise: Promise<LeadSynthesisResult | null> = Promise.resolve(null);

      if (sessionLead && workerResults.length > 0) {
        const leadAgent = useAgentStore.getState().getAgent(sessionLead.agent_id);
        if (leadAgent) {
          store.setPhase('lead_synthesizing'); scrollToRef(statusBarRef);
          const leadConfig: LeadAgentConfig = {
            agentId: leadAgent.id, agentName: leadAgent.name, agentNameEn: leadAgent.nameEn || leadAgent.name,
            agentRole: leadAgent.role, agentRoleEn: leadAgent.roleEn || leadAgent.role,
            expertise: leadAgent.expertise || '', tone: leadAgent.tone || '',
            domain: (session?.lead_agent?.domain || 'strategy') as import('@/lib/orchestrator-classify').Domain,
          };
          const attributedResults = enrichedResults.map(w => ({
            agentName: w.agentName || L('에이전트', 'Agent'),
            agentRole: w.agentRole || '',
            task: w.task,
            result: w.result,
            // Same-task multi-persona signal for Lead synthesis.
            taskGroupId: w.taskGroupId,
          }));
          const realQ = latest?.real_question || session!.problem_text;
          // Lead synthesis를 비동기로 시작 (await 하지 않음)
          leadPromise = runLeadSynthesis(session!.problem_text, realQ, attributedResults, leadConfig, abortRef.current?.signal)
            .then(result => {
              const currentSession = store.currentSession();
              if (currentSession?.id !== session?.id) return null;
              store.setLeadSynthesis(result);
              // Record synthesis activity so the lead's growth (XP / level /
              // last_used_at) reflects the work it just did. Without this,
              // the lead never accrues XP from synthesis work.
              useAgentStore.getState().recordActivity(
                leadConfig.agentId,
                'synthesis_completed',
                session!.problem_text.slice(0, 100),
                session!.id,
              );
              return result;
            })
            .catch(() => null);
        }
      }

      // Lead synthesis 완료 대기 (짧은 타임아웃) — 끝났으면 Mix에 포함, 아니면 null로 진행
      store.setPhase('mixing'); scrollToRef(statusBarRef);
      setSubstage(L('문서 구조 잡는 중', 'Building document structure'));
      leadSynthesis = await Promise.race([
        leadPromise,
        new Promise<null>(resolve => setTimeout(() => resolve(null), 4000)),
      ]);

      setSubstage(L('초안 본문 작성 중', 'Writing draft body'));
      setStreamKind('doc');
      setStreamingText('');
      const m = await runMix(
        session!.problem_text, snapshots, qa, dm,
        workerResults.length > 0 ? workerResults : undefined,
        abortRef.current.signal, leadSynthesis, session?.user_notes,
        (text) => setStreamingText(text),
      );
      setStreamingText(null);
      // Lead가 Mix보다 늦게 끝났으면 비동기로 저장 (Mix에는 미포함이지만 UI에는 표시)
      if (!leadSynthesis) leadPromise.then(late => { if (late) store.setLeadSynthesis(late); });
      store.setMix(m); setShowMix(false); track('flow_mix', { rounds: round, has_lead: !!leadSynthesis });
      // Voyage chart — mix landed; user can rewind here to try a different
      // mix (e.g., add user_notes and re-run).
      store.recordCheckpoint('mix');

      // Phase 6: Boss reviewer가 있으면 자동 DM 피드백
      let autoDMFired = false;
      if (session?.reviewer_agent_id) {
        const reviewerAgent = useAgentStore.getState().getAgent(session.reviewer_agent_id);
        if (reviewerAgent) {
          setSubstage(L(`${reviewerAgent.name}이(가) 검토 중`, `${reviewerAgent.name} is reviewing`));
          setStreamKind('feedback');
          setStreamingText('');
          const f = await runBossDMFeedback(m, reviewerAgent, session.problem_text, abortRef.current.signal, 'quick', (text) => setStreamingText(text));
          setStreamingText(null);
          store.setDMFeedback(f);
          store.recordCheckpoint('review');
          autoDMFired = true;
          import('@/lib/observation-engine').then(({ onBossReviewCompleted }) => {
            onBossReviewCompleted(reviewerAgent.id, f);
          }).catch(() => {});
          useAgentStore.getState().recordActivity(reviewerAgent.id, 'review_given', session.problem_text.slice(0, 100));
        }
      }
      // Fire the most specific completion cue (DM > mix) and scroll to the
      // card that will actually render. MixPreview hides when dmFb is set.
      if (autoDMFired) {
        useAgentAttentionStore.getState().ping('dm_ready');
        scrollToRef(dmFeedbackRef, 'bottom');
      } else {
        useAgentAttentionStore.getState().ping('mix_done');
        scrollToRef(mixPreviewRef, 'bottom');
      }
    } catch (e) { setStreamingText(null); if (!(e instanceof DOMException && e.name === 'AbortError')) setError(e instanceof Error ? e.message : L('초안 생성 실패', 'Draft creation failed')); store.setPhase('conversing'); scrollToRef(statusBarRef); }
    finally { setBusy(false); setSubstage(null); abortRef.current = null; }
  };

  // Verification gate — the captain stays in the loop. If any worker finished
  // but hasn't been accepted/excluded, intercept the sail and surface them
  // (the central "사람이 반드시 검증" promise, made real as a junction — not a
  // hard block; an explicit override always exists).
  const onMix = () => {
    const pending = store.unreviewedWorkers().length;
    if (pending > 0) { track('verify_gate_shown', { pending }); setVerifyGateOpen(true); return; }
    runMixCore();
  };

  const onDM = async () => {
    if (!mix) return; setBusy(true); setError(null); scrollToRef(statusBarRef);
    abortRef.current = new AbortController();
    try {
      // Boss agent가 연결되어 있으면 Boss 성격 DM 피드백
      const reviewerAgent = session?.reviewer_agent_id
        ? useAgentStore.getState().getAgent(session.reviewer_agent_id)
        : undefined;

      setSubstage(
        reviewerAgent
          ? L(`${reviewerAgent.name}이(가) 읽는 중`, `${reviewerAgent.name} is reading`)
          : L('초안을 검토하는 중', 'Reviewing the draft')
      );
      setStreamKind('feedback');
      setStreamingText('');

      const f = reviewerAgent
        ? await runBossDMFeedback(mix, reviewerAgent, session!.problem_text, abortRef.current.signal, 'quick', (text) => setStreamingText(text))
        : await runDMFeedback(mix, dm || L('의사결정권자', 'Decision-Maker'), session!.problem_text, abortRef.current.signal, 'quick', (text) => setStreamingText(text));

      setStreamingText(null);
      store.setDMFeedback(f);
      store.recordCheckpoint('review');
      useAgentAttentionStore.getState().ping('dm_ready');
      scrollToRef(dmFeedbackRef, 'bottom');

      // Boss 리뷰 후 observation 업데이트 + XP
      if (reviewerAgent && f) {
        import('@/lib/observation-engine').then(({ onBossReviewCompleted }) => {
          onBossReviewCompleted(reviewerAgent.id, f);
        }).catch(() => {});
        useAgentStore.getState().recordActivity(reviewerAgent.id, 'review_given', session!.problem_text.slice(0, 100));
      }
    }
    catch (e) { setStreamingText(null); if (!(e instanceof DOMException && e.name === 'AbortError')) setError(e instanceof Error ? e.message : L('DM 피드백 실패', 'DM feedback failed')); scrollToRef(statusBarRef); }
    finally { setBusy(false); setSubstage(null); abortRef.current = null; }
  };

  const onDeepen = async () => {
    if (!mix) return; setBusy(true); setError(null); scrollToRef(statusBarRef);
    abortRef.current = new AbortController();
    try {
      const reviewerAgent = session?.reviewer_agent_id
        ? useAgentStore.getState().getAgent(session.reviewer_agent_id)
        : undefined;

      setSubstage(L('심화 검토 중 — 논리·근거 점검', 'Deep review — logic & evidence'));
      setStreamKind('feedback');
      setStreamingText('');

      const f = reviewerAgent
        ? await runBossDMFeedback(mix, reviewerAgent, session!.problem_text, abortRef.current.signal, 'deep', (text) => setStreamingText(text))
        : await runDMFeedback(mix, dm || L('의사결정권자', 'Decision-Maker'), session!.problem_text, abortRef.current.signal, 'deep', (text) => setStreamingText(text));

      setStreamingText(null);
      store.setDMFeedback(f);
      store.recordCheckpoint('review', L('심화 검토', 'Deep review'));
      useAgentAttentionStore.getState().ping('dm_ready');
      scrollToRef(dmFeedbackRef, 'bottom');
      track('flow_deepen', { has_boss: !!reviewerAgent });
    }
    catch (e) { setStreamingText(null); if (!(e instanceof DOMException && e.name === 'AbortError')) setError(e instanceof Error ? e.message : L('심화 검토 실패', 'Deep review failed')); scrollToRef(statusBarRef); }
    finally { setBusy(false); setSubstage(null); abortRef.current = null; }
  };

  const onMore = async () => {
    if (!latest) return; setShowMix(false); setBusy(true); store.setPhase('analyzing'); scrollToRef(statusBarRef);
    try {
      const qa = qaPairs.filter(q => q.answer).map(q => ({ question: q.question, answer: q.answer! }));
      qa.push({ question: { id: 's', text: locale === 'ko' ? '더?' : 'More?', type: 'select', engine_phase: 'recast' }, answer: { question_id: 's', value: t('progressive.oneMore') } });
      abortRef.current = new AbortController();
      setStreamKind('analysis');
      setStreamingText('');
      // Lead context for onMore deepening
      let moreLeadCtx: string | undefined;
      if (session?.lead_agent) {
        const la = useAgentStore.getState().getAgent(session.lead_agent.agent_id);
        if (la) {
          const cfg: LeadAgentConfig = {
            agentId: la.id, agentName: la.name, agentNameEn: la.nameEn || la.name,
            agentRole: la.role, agentRoleEn: la.roleEn || la.role,
            expertise: la.expertise || '', tone: la.tone || '',
            domain: (session.lead_agent?.domain || 'strategy') as import('@/lib/orchestrator-classify').Domain,
          };
          moreLeadCtx = buildLeadDecompositionContext(cfg, locale as 'ko' | 'en');
        }
      }
      const personas2 = usePersonaStore.getState().personas.filter(p => !p.is_example && !p.deleted_at).map(p => ({ name: p.name, role: p.role, hasContact: !!(p.contact?.email || p.contact?.slack_id) }));
      const r = await runDeepening(session!.problem_text, latest, qa, round, round + 2, snapshots, (text) => setStreamingText(text), abortRef.current.signal, moreLeadCtx, personas2.length > 0 ? personas2 : undefined);
      setStreamingText(null);
      r.question ? (store.addQuestion(r.question), store.setPhase('conversing')) : (setShowMix(true), store.setPhase('conversing'));
    } catch (e) { setStreamingText(null); if (!(e instanceof DOMException && e.name === 'AbortError')) setError(e instanceof Error ? e.message : L('실패', 'Failed')); store.setPhase('conversing'); setShowMix(true); }
    finally { setBusy(false); abortRef.current = null; scroll(); }
  };

  const onSkip = () => {
    if (!mix) return;
    const md = [`# ${mix.title}`, '', `> ${mix.executive_summary}`, '', ...mix.sections.flatMap(s => [`## ${s.heading}`, '', s.content, '']),
      ...(mix.key_assumptions.length ? [`## ${L('전제 조건', 'Assumptions')}`, '', ...mix.key_assumptions.map(a => `- ${a}`), ''] : []),
      ...(mix.next_steps.length ? [`## ${L('다음 단계', 'Next Steps')}`, '', ...mix.next_steps.map(s => `- ${s}`), ''] : [])].join('\n');
    // Skip keeps the original mix intact → attribution survives for FinalCard.
    store.setFinalDeliverable(md, mix);
    store.recordCheckpoint('anchor', L('정박 (피드백 건너뜀)', 'Anchor (skipped review)'));
    setError(null);
    useAgentAttentionStore.getState().ping('final_done');
    scrollToRef(finalRef, 'top');
  };

  const onFinalize = async () => {
    if (!mix || !dmFb) return; setBusy(true); setError(null); scrollToRef(statusBarRef);
    setSubstage(L('피드백 반영 + 최종본 다듬는 중', 'Applying feedback + polishing'));
    setStreamKind('doc');
    setStreamingText('');
    abortRef.current = new AbortController();
    try {
      // Carry the original mixableWorkerResults forward so unmatched sections can still resolve via heuristic.
      const enrichedResults = store.mixableWorkerResults();
      const workerSources = enrichedResults
        .filter(w => !!w.workerId && !!(w.agentName || w.persona))
        .map(w => ({ workerId: w.workerId, name: (w.agentName || w.persona)!, result: w.result }));
      const { markdown, finalMix } = await runFinalDeliverable(mix, dmFb, abortRef.current.signal, workerSources, (text) => setStreamingText(text));
      setStreamingText(null);
      store.setFinalDeliverable(markdown, finalMix);
      store.recordCheckpoint('anchor');
      useAgentAttentionStore.getState().ping('final_done');
      scrollToRef(finalRef, 'top');
      track('flow_done', { project_id: projectId, rounds: round });
    }
    catch (e) { setStreamingText(null); if (!(e instanceof DOMException && e.name === 'AbortError')) setError(e instanceof Error ? e.message : L('최종본 실패', 'Finalization failed')); scrollToRef(statusBarRef); }
    finally { setBusy(false); setSubstage(null); abortRef.current = null; }
  };

  return (
    <>
      <PhaseAmbient phase={phase} />
      <motion.div className="relative z-10 mx-auto px-4 md:px-0"
        animate={{ maxWidth: phase === 'complete' ? '56rem' : (phase === 'mixing' || phase === 'lead_synthesizing' || phase === 'dm_feedback' || phase === 'refining') ? '48rem' : '42rem' }}
        transition={{ duration: 0.8, ease: EASE }}>

        <PingToast />
        <TeamAssignmentModal
          poolModal={poolModal}
          workers={workers}
          setPoolModal={setPoolModal}
          store={store}
          workerActions={workerActions}
        />

        {/* Verification gate — opens when the captain tries to sail with
            unreviewed work. Reads the unreviewed set fresh each render so it
            shrinks as items are accepted/excluded inside the gate. */}
        <AnimatePresence>
          {verifyGateOpen && (
            <VerificationGate
              key="verify-gate"
              workers={store.unreviewedWorkers()}
              anyRunning={workers.some(w => w.status === 'running' || w.status === 'ai_preparing')}
              onApprove={workerActions.handleApprove}
              onReject={workerActions.handleReject}
              onRetry={workerActions.handleRetry}
              onSail={() => { setVerifyGateOpen(false); runMixCore(); }}
              onOverride={() => { track('verify_gate_override', { count: store.unreviewedWorkers().length }); store.approveAllPending(); setVerifyGateOpen(false); runMixCore(); }}
              onClose={() => setVerifyGateOpen(false)}
            />
          )}
        </AnimatePresence>
        <ProgressLine phase={phase} />

        {/* PhaseStatusBar + StreamSnippet — sticky wrapper so progress info
            stays glued to the top while the user scrolls through the long
            page. Sticky lives on the wrapper, not the bar itself, so the
            wrapper provides the scroll travel room (its bottom is the body
            of the page). */}
        <div ref={statusBarRef} className="sticky top-14 z-30 mb-6 pt-2 pb-1 bg-[var(--bg)]/85 backdrop-blur-sm">
          <PhaseStatusBar
            phase={phase} busy={busy}
            hasQuestion={!!curQ && !busy && phase === 'conversing'}
            deployReady={deployPhase === 'ready' && workers.length > 0}
            shouldMix={shouldMix && !busy && phase === 'conversing' && !curQ}
            workersRunning={workers.filter(w => w.status === 'running').length}
            workersDone={workers.filter(w => w.status === 'done').length}
            workersTotal={workers.length}
            elapsedLabel={elapsedLabel}
            leadAgentName={session?.lead_agent?.agent_name}
            substage={substage}
            isLongWait={isLongWait}
            onCancel={busy ? () => abortRef.current?.abort() : undefined}
          />
          {/* Live preview of the streaming response — makes the 15–45s LLM
              waits (analysis / mix / DM review / final) visible instead of
              silent spinners. Handlers set `streamKind` because phase alone
              doesn't disambiguate (onFinalize runs while phase='refining'). */}
          <AnimatePresence>
            {streamingText !== null && (
              <StreamSnippet key="stream" text={streamingText} kind={streamKind} />
            )}
          </AnimatePresence>
        </div>

        <div className="space-y-8">
          {/* User input + reviewer — stacked pills */}
          <div className="flex flex-col gap-2 items-start">
            <motion.div layout className="flex items-center gap-3 px-5 py-3 rounded-full bg-[var(--bg)] border border-[var(--border-subtle)] max-w-full">
              <div className="w-5 h-5 rounded-full bg-[var(--text-primary)] flex items-center justify-center shrink-0">
                <span className="text-[var(--bg)] text-[9px] font-bold">{L('나', 'Me')}</span>
              </div>
              <p className="text-[13px] text-[var(--text-secondary)] truncate">{session.problem_text}</p>
            </motion.div>
            <ReviewerBadge reviewerId={session.reviewer_agent_id || null} />
          </div>

          {/* PhaseDivider: Team assembled → confirm */}
          {deployPhase === 'ready' && workers.length > 0 && (
            <PhaseDivider done={L('상황 파악', 'Analysis')} next={L('팀 구성 확인', 'Confirm team')} yourTurn />
          )}

          <DeployResumeBanners
            deployPhase={deployPhase}
            workers={workers}
            teamDeployRef={teamDeployRef}
            onDeployWorkers={onDeployWorkers}
            store={store}
            setPoolModal={setPoolModal}
            isResumable={isResumable}
            onResumeWorkers={onResumeWorkers}
          />

          {/* Update summary chip — surfaces "what changed" at the user's eye level
              (right above the next question). AnalysisCard lives further down,
              so without this, users miss the evolution they just triggered. */}
          {latest && snapshots.length > 1 && !final_ && phase === 'conversing' && !mix && (
            <UpdateSummaryChip
              snapshot={latest}
              prevSnapshot={snapshots[snapshots.length - 2]}
              onSeeDetail={() => scrollToRef(analysisCardRef, 'top')}
              locale={locale}
            />
          )}

          <QuestionSection
            curQ={curQ}
            busy={busy}
            phase={phase}
            round={round}
            answers={answers}
            deployPhase={deployPhase}
            workers={workers}
            onAnswer={onAnswer}
            onDeployWorkers={onDeployWorkers}
            questionRef={questionRef}
          />

          {/* Inline worker reports — ONE-AT-A-TIME stepper. Reviewing 3 long
              drafts in a single scroll was a huge burden; instead the user
              handles one agent at a time with a finding-first card and the full
              draft one tap away. */}
          {deployPhase === 'deployed' && !final_ && (
            <WorkerReportStepper
              workers={workers}
              focusedWorkerId={focusedWorkerId}
              setFocusedWorker={setFocusedWorker}
              workerActions={workerActions}
              setPoolModal={setPoolModal}
              workerSectionRef={workerSectionRef}
            />
          )}

          <PreMixStage
            shouldMix={shouldMix}
            busy={busy}
            phase={phase}
            curQ={curQ}
            workers={workers}
            session={session}
            store={store}
            latest={latest}
            onMix={onMix}
            onMore={onMore}
            scrollToRef={scrollToRef}
            answeredPillsRef={answeredPillsRef}
          />

          {/* Lead Synthesis — previously hidden, now visible.
              (Drafting status already surfaced in PhaseStatusBar.) */}
          {session?.lead_synthesis && !final_ && (
            <LeadSynthesisCard synthesis={session.lead_synthesis} />
          )}

          {/* Living Analysis — stays collapsed throughout the conversing
              phase so the user isn't buried under accumulating cards.
              VoyagePrepSummary picks up the decision-point role at the
              shouldMix moment; this card is a "tap to read the full
              breakdown" affordance, not the primary narrative. Auto-
              expands once mix begins (phase moves past 'conversing'). */}
          {latest && !final_ && (
            <div ref={analysisCardRef}>
              <AnalysisCard
                snapshot={latest}
                prevSnapshot={snapshots.length > 1 ? snapshots[snapshots.length - 2] : null}
                isActive={!mix}
                showExecutionPlan
                locale={locale}
                defaultCollapsed={phase === 'conversing' && !mix}
              />
            </div>
          )}

          {/* Framing Confirmation — Round 1 후 사용자 확인 (Weakness A) */}
          {latest && !latest.framing_locked && snapshots.length === 1 && phase === 'conversing' && !mix && !final_ && (
            <FramingConfirmation
              snapshot={latest}
              onConfirm={() => {
                store.updateLatestSnapshot({ framing_locked: true });
                track('framing_confirmed', { confidence: latest.framing_confidence });
              }}
              onReject={async (reason) => {
                setBusy(true); setError(null);
                try {
                  setStreamKind('analysis');
                  setStreamingText('');
                  const r = await refineInitialFraming(
                    session.problem_text, latest.real_question, reason,
                    (text) => setStreamingText(text),
                  );
                  setStreamingText(null);
                  store.replaceInitialSnapshot(r.snapshot);
                  if (r.detectedDM) store.setDecisionMaker(r.detectedDM);
                  store.replaceLatestQuestion(r.question);
                  track('framing_rejected', { reason });
                } catch (e) { setStreamingText(null); setError(e instanceof Error ? e.message : L('재분석 실패', 'Re-analysis failed')); }
                finally { setBusy(false); scroll(); }
              }}
              busy={busy}
            />
          )}

          {/* Convergence Status — 라운드 2+ (Weakness C) */}
          {snapshots.length >= 2 && !mix && !final_ && phase === 'conversing' && (
            <ConvergenceStatus metrics={
              workers.length > 0
                ? assessConvergenceWithWorkers(snapshots, workers.map(w => ({ validationScore: w.validation_score, approved: w.approved })))
                : assessConvergence(snapshots)
            } />
          )}

          {/* Pipeline Exit — 라운드 1+ 후 4R로 분기 가능 (Weakness D) */}
          {latest && snapshots.length >= 1 && !mix && !final_ && phase === 'conversing' && !busy && (
            <PipelineExitOptions
              onReframe={() => {
                try {
                  const item = exportProgressiveAsReframe(session);
                  // 실제 store에 저장 + 프로젝트 연결
                  useReframeStore.getState().addItem(item);
                  store.linkToReframe(item.id);
                  if (session.project_id) {
                    useProjectStore.getState().addRef(session.project_id, {
                      tool: 'reframe', itemId: item.id, label: session.problem_text.slice(0, 30),
                    });
                  }
                  track('progressive_exit_to_reframe', { round });
                  window.location.href = `/workspace?step=reframe&handoff=progressive&itemId=${item.id}`;
                } catch (e) { setError(e instanceof Error ? e.message : L('전환 실패', 'Switch failed')); }
              }}
              onRehearse={() => {
                try {
                  const item = exportProgressiveAsRecast(session);
                  // 실제 store에 저장 + 프로젝트 연결
                  useRecastStore.getState().addItem(item);
                  store.linkToRecast(item.id);
                  if (session.project_id) {
                    useProjectStore.getState().addRef(session.project_id, {
                      tool: 'recast', itemId: item.id, label: session.problem_text.slice(0, 30),
                    });
                  }
                  track('progressive_exit_to_rehearse', { round });
                  window.location.href = `/workspace?step=rehearse&handoff=progressive&itemId=${item.id}`;
                } catch (e) { setError(e instanceof Error ? e.message : L('전환 실패', 'Switch failed')); }
              }}
            />
          )}

          {/* Answered Q&A history — collapsed at bottom. ref is used by
              VoyagePrepSummary's "Revisit my answers" link to scroll back
              to the Q&A history without disrupting the user's flow. */}
          {!final_ && (
            <div ref={answeredPillsRef}>
              <AnsweredPills qaPairs={qaPairs} />
            </div>
          )}

          {/* PhaseDivider: Draft ready → Review */}
          {mix && !dmFb && !final_ && phase !== 'mixing' && (
            <PhaseDivider done={L('초안 완성', 'Draft ready')} next={L('검토', 'Review')} yourTurn />
          )}
          <div ref={mixPreviewRef}>
            {mix && !dmFb && !final_ && phase !== 'mixing' && <MixPreview mix={mix} dm={dm} onDM={onDM} onSkip={onSkip} busy={busy} cmReview={cmReview} debateResult={debateResult} />}
          </div>
          <div ref={dmFeedbackRef}>
            {dmFb && !final_ && (
              // Stable key per review — rebuilds the baseline snapshot only
              // when a new review arrives, not when toggleFix rebuilds the
              // fb object. first_reaction is effectively unique per review.
              <DMFeedback
                key={`${dmFb.persona_name}::${dmFb.first_reaction}`}
                fb={dmFb}
                onToggle={(i) => store.toggleFix(i)}
                onFinalize={onFinalize}
                onDeepen={onDeepen}
                busy={busy}
              />
            )}
          </div>

          {final_ && <div ref={finalRef}>
            <CompletionView
              final_={final_}
              finalMix={finalMix}
              mix={mix}
              dmFb={dmFb}
              debateResult={debateResult}
              session={session}
              store={store}
              activeDraft={activeDraft}
              activeDraftId={activeDraftId}
              drafts={drafts}
              draftIsOnBranch={draftIsOnBranch}
              justReactivatedFromBranch={justReactivatedFromBranch}
              setJustReactivatedFromBranch={setJustReactivatedFromBranch}
              setDrawerOpen={setDrawerOpen}
              setIterationOpen={setIterationOpen}
              setIterationDirective={setIterationDirective}
              setShowMix={setShowMix}
            />
          </div>}

          <ErrorBanner error={error} />

          {/* The bottom milestone row used to duplicate the top stepper with a
              different vocabulary; the top ProgressLine is now the single,
              sticky progress indicator, so the redundant row was removed. */}
        </div>
      </motion.div>

      <DraftModals
        drafts={drafts}
        releasedDraftId={session?.released_draft_id}
        activeDraftId={activeDraftId}
        activeDraftPathIds={activeDraftPathIds}
        activeDraft={activeDraft}
        previewDraft={previewDraft}
        previewDraftId={previewDraftId}
        setPreviewDraftId={setPreviewDraftId}
        drawerOpen={drawerOpen}
        setDrawerOpen={setDrawerOpen}
        iterationOpen={iterationOpen}
        setIterationOpen={setIterationOpen}
        iterationDirective={iterationDirective}
        setIterationDirective={setIterationDirective}
        isIterating={isIterating}
        onRequestRevision={onRequestRevision}
        handleBranchToDraft={handleBranchToDraft}
        handlePromoteDraft={handlePromoteDraft}
        error={error}
        setError={setError}
      />
    </>
  );
}
