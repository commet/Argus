'use client';

/**
 * useWorkerRuntime — the crew-execution domain extracted out of ProgressiveFlow.
 * Owns the worker deploy/resume/run pipeline (startWorkerExecution + onDeploy +
 * onResume), the all-crew-settled ping effect, and the isResumable derivation.
 * The shared abort/promise/mounted refs stay owned by the parent (its unmount
 * cleanup aborts them) and are passed in, so this is a behaviour-preserving
 * lift: the only additions are null-session guards (the handlers were defined
 * after the parent's  and so saw a non-null session).
 */

import { useEffect, useRef, type Dispatch, type SetStateAction, type MutableRefObject } from 'react';
import { useLocale } from '@/hooks/useLocale';
import { runAllAIWorkers, runPipeline, type WorkerContext } from '@/lib/worker-engine';
import { withTranscript } from '@/lib/execution-transcript';
import { getCompletionNote } from '@/lib/worker-personas';
import { useAgentAttentionStore } from '@/stores/useAgentAttentionStore';
import { t } from '@/lib/i18n';
import type { WorkerTask, FlowQuestion, FlowAnswer, AnalysisSnapshot, ProgressiveSession } from '@/stores/types';
import type { ProgressiveState } from '@/stores/useProgressiveStore';

interface UseWorkerRuntimeArgs {
  store: ProgressiveState;
  session: ProgressiveSession | null;
  qaPairs: Array<{ question: FlowQuestion; answer: FlowAnswer | null }>;
  latest: AnalysisSnapshot | null;
  scroll: (mode?: 'top' | 'bottom') => void;
  setError: Dispatch<SetStateAction<string | null>>;
  workerAbortRef: MutableRefObject<AbortController | null>;
  workersRef: MutableRefObject<Promise<void> | null>;
  mountedRef: MutableRefObject<boolean>;
}

export function useWorkerRuntime({
  store, session, qaPairs, latest, scroll, setError, workerAbortRef, workersRef, mountedRef,
}: UseWorkerRuntimeArgs) {
  const locale = useLocale();
  const L = (ko: string, en: string) => (locale === 'ko' ? ko : en);
  const workers = session?.workers ?? [];
  const deployPhase = session?.worker_deploy_phase ?? 'none';

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

  /* Shared worker execution — used by both deploy and resume */
  const startWorkerExecution = (ws: WorkerTask[]) => {    if (!session) return;
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
  const onDeployWorkers = () => {    if (!session) return;
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
  const isResumable = deployPhase === 'deployed' && !session?.final_deliverable
    && workers.some(w => w.status === 'pending')
    && workers.some(w => w.status === 'done' && w.result);
  const onResumeWorkers = () => {
    const ws = store.currentSession()?.workers ?? [];
    startWorkerExecution(ws);
  };
  return { onDeployWorkers, onResumeWorkers, isResumable };
}
