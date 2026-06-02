import { create } from 'zustand';
import { generateId } from '@/lib/uuid';
import { getStorage, setStorage, STORAGE_KEYS } from '@/lib/storage';
import { upsertToSupabase, loadAndMerge } from '@/lib/db';
import { track } from '@/lib/analytics';
import { useAgentStore } from '@/stores/useAgentStore';
import { agentToWorkerPersona } from '@/lib/agent-adapters';
import { XP_REWARDS } from '@/stores/agent-types';
import { numericLevelToAgentLevel } from '@/lib/agent-skills';
import { onTaskApproved, onTaskRejected } from '@/lib/observation-engine';
import { planWorkers } from '@/lib/orchestrator';
import { selectLeadAgent } from '@/lib/lead-agent';
import { computeQualityXP } from '@/lib/agent-quality';
import { nextChildLabel, promoteToMajor, ROOT_LABEL } from '@/lib/version-numbering';
import { getCurrentLanguage } from '@/lib/i18n';
import { getActivePath as getActivePathGeneric, overallLatest } from '@/lib/version-tree';
import { deriveWaypoint } from '@/lib/voyage-log';
import type {
  ProgressiveSession,
  ProgressivePhase,
  FlowQuestion,
  FlowAnswer,
  AnalysisSnapshot,
  MixResult,
  DMFeedbackResult,
  DMConcern,
  InterviewSignals,
  PipelineStage,
  WorkerTask,
  WorkerPersona,
  WorkerDeployPhase,
  LeadSynthesisResult,
  Draft,
  VoyageCheckpoint,
  VoyageStage,
  VoyageCheckpointState,
  VoyageBranch,
  Waypoint,
} from '@/stores/types';

/** Course-line colors, cycled as new branches fork off the tree. */
const BRANCH_COLORS = ['#2d4a7c', '#8b6914', '#6b4c9a', '#2d6b2d', '#9b5de5', '#b5651d'];

/** Hard cap on branches per session — guards localStorage (each branch's
 *  checkpoints are full-state copies) and keeps the chart legible. */
const MAX_BRANCHES = 8;

/** Locale-aware name for the auto-created trunk branch. */
function defaultMainBranchName(): string {
  return getCurrentLanguage() === 'ko' ? '본 항로' : 'Main course';
}

/** Map the live flow phase to the nearest voyage stage — used when recording a
 *  safety checkpoint of in-progress state before a fork/switch. */
function phaseToStage(phase: ProgressivePhase): VoyageStage {
  switch (phase) {
    case 'input': case 'analyzing': case 'conversing': return 'briefing';
    case 'lead_synthesizing': case 'mixing': return 'mix';
    case 'dm_feedback': case 'refining': return 'review';
    case 'complete': case 'iterating': return 'anchor';
    default: return 'briefing';
  }
}

/** The live session fields restored from a checkpoint's state snapshot. Shared
 *  by restoreCheckpoint and switchBranch/forkBranch so the field list lives in
 *  exactly one place (adding a field to VoyageCheckpointState updates all). */
function restoreFields(snap: VoyageCheckpointState): Partial<ProgressiveSession> {
  return {
    phase: snap.phase,
    round: snap.round,
    questions: snap.questions,
    answers: snap.answers,
    snapshots: snap.snapshots,
    workers: snap.workers,
    worker_deploy_phase: snap.worker_deploy_phase,
    mix: snap.mix,
    dm_feedback: snap.dm_feedback,
    final_deliverable: snap.final_deliverable,
    final_mix: snap.final_mix,
    user_notes: snap.user_notes,
    decision_maker: snap.decision_maker,
    lead_synthesis: snap.lead_synthesis,
  };
}

/** True when the live state has advanced past the active checkpoint's snapshot
 *  (cheap scalar comparison). Used to decide whether a fork/switch must first
 *  preserve in-progress work as a safety checkpoint — no data loss. */
function progressAheadOfHead(session: ProgressiveSession): boolean {
  const head = (session.checkpoints || []).find(c => c.id === session.active_checkpoint_id);
  if (!head) return false;
  const s = head.state_snapshot;
  return s.phase !== session.phase
    || s.round !== session.round
    || s.snapshots.length !== session.snapshots.length;
}

/** Auto-generated label per stage. Locale-aware fallback when callers
 *  don't provide their own. */
function defaultCheckpointLabel(stage: VoyageStage, round: number): string {
  const lang = getCurrentLanguage();
  const ko = lang === 'ko';
  switch (stage) {
    case 'origin':     return ko ? '출발' : 'Origin';
    case 'briefing':   return ko ? `항해 준비 ${round}` : `Briefing ${round}`;
    case 'crew_set':   return ko ? '선원 배정' : 'Crew assigned';
    case 'crew_done':  return ko ? '선원 작업 완료' : 'Crew done';
    case 'mix':        return ko ? '항해 보고서' : 'Mix';
    case 'review':     return ko ? '리뷰어 검토' : 'Review';
    case 'anchor':     return ko ? '정박' : 'Anchor';
  }
}

/**
 * Args for `addDraft` — the internal id/label/created_at are computed by the
 * store so callers only supply the meaningful fields.
 */
export interface AddDraftInit {
  parent_draft_id: string | null;
  directive: string | null;
  change_summary: string;
  final_text: string;
  final_mix?: MixResult | null;
  reviewing_agent_id: string | null;
}

interface ProgressiveState {
  sessions: ProgressiveSession[];
  currentSessionId: string | null;

  // Derived
  currentSession: () => ProgressiveSession | null;
  /** The active branch (course-line) of the current session, or null. */
  currentBranch: () => VoyageBranch | null;

  // Actions
  loadSessions: () => void;
  createSession: (projectId: string, problemText: string, reviewerAgentId?: string) => string;
  setPhase: (phase: ProgressivePhase) => void;
  setDecisionMaker: (name: string) => void;

  // ── Post-complete draft tree ──
  /** Append a new draft as a child of `parent_draft_id` (null = root child). Returns new id. */
  addDraft: (init: AddDraftInit) => string | null;
  /** Switch the active draft pointer without creating anything new. */
  setActiveDraft: (draftId: string | null) => void;
  /** Relabel a pre-release draft as v{major}.0 and mark it as released. */
  promoteDraftToV1: (draftId: string) => void;
  /** Return the root→leaf path of drafts for the currently-active branch. */
  getActiveDraftPath: () => Draft[];

  // Q&A
  addQuestion: (question: FlowQuestion) => void;
  addAnswer: (answer: FlowAnswer) => void;
  advanceRound: () => void;

  // Analysis
  addSnapshot: (snapshot: AnalysisSnapshot) => void;
  updateLatestSnapshot: (partial: Partial<AnalysisSnapshot>) => void;

  // Mix & DM
  setMix: (mix: MixResult) => void;
  setDMFeedback: (feedback: DMFeedbackResult) => void;
  toggleFix: (concernIndex: number) => void;

  // Final
  setFinalDeliverable: (text: string, finalMix?: MixResult | null) => void;

  // Framing (Weakness A)
  replaceInitialSnapshot: (snapshot: AnalysisSnapshot) => void;
  replaceLatestQuestion: (question: FlowQuestion) => void;

  // Pipeline bridge (Weakness D)
  linkToReframe: (reframeItemId: string) => void;
  linkToRecast: (recastItemId: string) => void;

  // Workers
  initWorkers: (steps: { task: string; who?: string; agent_type?: string; output: string; agent_hint?: string; ai_scope?: string; self_scope?: string; decision?: string; question_to_human?: string; human_contact_hint?: string }[], signals?: InterviewSignals) => WorkerTask[];
  deployWorkers: () => void;
  updateWorker: (workerId: string, partial: Partial<WorkerTask>) => void;
  setWorkerStreamText: (workerId: string, text: string) => void;
  submitHumanInput: (workerId: string, input: string) => void;
  approveWorker: (workerId: string) => void;
  rejectWorker: (workerId: string) => void;
  allWorkersDone: () => boolean;
  /** Manual team assignment — clone a peer in the same task group, replacing
   *  the persona only. Returns the new worker id (or null if validation
   *  fails: group not found, max-5 reached, or persona already in group). */
  addWorkerToGroup: (taskGroupId: string, persona: WorkerPersona) => string | null;
  /** Remove a worker. No-op if it is the last surviving worker in its group
   *  (auto-assigned tasks must always have at least one worker). */
  removeWorker: (workerId: string) => boolean;
  /** Replace just the persona on an existing worker; resets execution state. */
  replaceWorkerPersona: (workerId: string, persona: WorkerPersona) => void;
  /** Edit the task text for an entire group. All workers sharing the
   *  task_group_id receive the same updated task string. Empty/whitespace-only
   *  input is ignored. */
  updateGroupTask: (taskGroupId: string, newText: string) => void;

  // ─── Voyage chart (decision checkpoints) ───
  /** Record a checkpoint at the current state. Called automatically at
   *  each stage transition. Returns the new checkpoint, or null if no
   *  active session. */
  recordCheckpoint: (stage: VoyageStage, label?: string) => VoyageCheckpoint | null;
  /** Rewind to a checkpoint: replaces the live session fields with that
   *  waypoint's snapshot and moves active_checkpoint_id to it. The next
   *  recordCheckpoint() call will then attach to it as parent — producing
   *  a fresh branch automatically. */
  restoreCheckpoint: (checkpointId: string) => void;
  /** Fork a new course-line from a checkpoint: restores live state to that
   *  point, creates a sibling branch, and makes it active. Preserves any
   *  in-progress work on the current branch first. Returns the new branch id. */
  forkBranch: (fromCheckpointId: string, label?: string) => string | null;
  /** Switch the live session to another branch's head (single-active model).
   *  Preserves the current branch's in-progress work before leaving. */
  switchBranch: (branchId: string) => void;
  /** Mark a branch as the chosen final course; all others become 'abandoned'
   *  (preserved in the tree, never deleted). */
  anchorBranch: (branchId: string) => void;
  /** Resolve a chart checkpoint click to the right branch verb: switch to the
   *  branch that owns it, else fork a new course from it. Keeps the chart in
   *  sync with the branch model (no silent reassignment). */
  navigateToCheckpoint: (checkpointId: string) => void;
  /** Merge Chronicler narration (significance / why_abandoned) into a waypoint.
   *  Best-effort enrichment from the async LLM pass; no-op if not found. */
  enrichWaypoint: (waypointId: string, patch: Partial<Waypoint>) => void;
  /** @deprecated Use mixableWorkerResults instead */
  approvedWorkerResults: () => Array<{ task: string; result: string; type?: string; persona: string | null; agentName: string | null; agentRole: string | null }>;
  mixableWorkerResults: () => Array<{ workerId: string; task: string; result: string; type: 'final' | 'preliminary' | 'pending_human'; persona: string | null; agentName: string | null; agentRole: string | null; taskGroupId: string }>;

  // Lead Agent
  setLeadAgent: (agentId: string, agentName: string, domain: string) => void;
  setLeadSynthesis: (result: LeadSynthesisResult) => void;
  setUserNotes: (notes: string | null) => void;
  setDebateResult: (result: { challenge: string; targetAgent: string; weakestClaim: string; alternativeView: string; severity: string } | null) => void;

  // Cleanup
  deleteSession: (id: string) => void;
}

/**
 * Persist to localStorage + async Supabase sync for mutated sessions.
 * Supabase sync is debounced per session ID to avoid flooding.
 */
const _pendingSyncs = new Set<string>();
function persist(sessions: ProgressiveSession[]) {
  setStorage(STORAGE_KEYS.PROGRESSIVE_SESSIONS, sessions);

  // Supabase async sync — find sessions that changed (heuristic: any with workers or non-input phase)
  for (const s of sessions) {
    if (s.phase === 'input' && (!s.workers || s.workers.length === 0)) continue; // Skip empty sessions
    if (_pendingSyncs.has(s.id)) continue; // Already queued

    _pendingSyncs.add(s.id);
    // Debounce: wait 2s to batch rapid mutations (e.g., streaming token updates)
    setTimeout(() => {
      _pendingSyncs.delete(s.id);
      const latest = getStorage<ProgressiveSession[]>(STORAGE_KEYS.PROGRESSIVE_SESSIONS, []).find(ss => ss.id === s.id);
      if (!latest) return;
      upsertToSupabase('progressive_sessions', {
        id: latest.id,
        project_id: latest.project_id,
        data: latest,
        phase: latest.phase,
        has_pending_humans: (latest.workers || []).some(
          w => w.agent_type === 'human' && (w.status === 'sent' || w.status === 'waiting_response')
        ),
        updated_at: latest.updated_at || new Date().toISOString(),
      }).catch(() => { /* fire-and-forget — localStorage is primary */ });
    }, 2000);
  }
}

/** Migrate worker statuses and add v2 fields for backward compat */
function migrateWorkers(sessions: ProgressiveSession[]): ProgressiveSession[] {
  return sessions.map(s => ({
    ...s,
    phase: (s.phase === 'lead_synthesizing' && !s.lead_synthesis) ? 'mixing' as const
      : (s.phase === 'analyzing' || s.phase === 'mixing') ? 'conversing' as const
      : s.phase,
    worker_deploy_phase: s.worker_deploy_phase ?? (s.workers?.length ? 'deployed' : 'none'),
    workers: (s.workers || []).map(w => ({
      ...w,
      stream_text: '',
      persona: w.persona ?? null,
      level: w.level ?? 'junior',
      approved: w.approved ?? null,
      completion_note: w.completion_note ?? null,
      status: (w.status === 'running' || w.status === 'ai_preparing') ? 'pending' as const : w.status,
      agent_type: w.agent_type || (w.who === 'both' ? 'ai' : w.who === 'human' ? 'self' : 'ai') as 'ai' | 'self' | 'human',
    })),
  }));
}

/**
 * Synthesize drafts[0] from legacy sessions that already have a
 * `final_deliverable` but no drafts tree. Deterministic id keeps the record
 * stable across reloads. Idempotent: sessions that already have `drafts`
 * are returned untouched.
 */
function migrateSessionDrafts(sessions: ProgressiveSession[]): ProgressiveSession[] {
  return sessions.map((s) => {
    if (s.drafts && s.drafts.length > 0) return s;
    if (!s.final_deliverable) return s;
    const id = `legacy-${s.id}-0`;
    const draft: Draft = {
      id,
      parent_draft_id: null,
      version_label: 'v0.1',
      change_summary: getCurrentLanguage() === 'ko' ? '첫 초안 (에이전트 팀 분석)' : 'First draft (agent team analysis)',
      directive: null,
      final_text: s.final_deliverable,
      final_mix: s.final_mix ?? null,
      reviewing_agent_id: null,
      created_at: s.updated_at || s.created_at || new Date().toISOString(),
    };
    return {
      ...s,
      drafts: [draft],
      active_draft_id: s.active_draft_id ?? id,
    };
  });
}

/**
 * Synthesize a single "main course" branch for sessions that already carry
 * checkpoints but no `branches[]` (pre-branching sessions). The branch is
 * metadata only — its lineage is derived from the checkpoint tree at read time
 * (see `lib/version-tree.ts`), so we never stamp checkpoints.
 *
 * Idempotent: sessions that already have `branches` are returned untouched.
 * Sessions with no checkpoints are left as-is — their main branch is created
 * lazily when the first (origin) checkpoint is recorded. Deterministic id
 * (`main-<sessionId>`) keeps the record stable across reloads.
 */
function migrateBranches(sessions: ProgressiveSession[]): ProgressiveSession[] {
  return sessions.map((s) => {
    if (s.branches && s.branches.length > 0) return s;
    const checkpoints = s.checkpoints || [];
    if (checkpoints.length === 0) return s;
    const headId = s.active_checkpoint_id || overallLatest(checkpoints)?.id;
    if (!headId) return s;
    const main: VoyageBranch = {
      id: `main-${s.id}`,
      name: defaultMainBranchName(),
      head_checkpoint_id: headId,
      forked_from_checkpoint_id: null,
      status: 'sailing',
      color: BRANCH_COLORS[0],
      created_at: s.created_at || new Date().toISOString(),
    };
    return { ...s, branches: [main], active_branch_id: main.id };
  });
}

function updateSession(
  sessions: ProgressiveSession[],
  id: string,
  updater: (s: ProgressiveSession) => Partial<ProgressiveSession>,
): ProgressiveSession[] {
  return sessions.map(s =>
    s.id === id ? { ...s, ...updater(s), updated_at: new Date().toISOString() } : s,
  );
}

export const useProgressiveStore = create<ProgressiveState>((set, get) => ({
  sessions: [],
  currentSessionId: null,

  currentSession: () => {
    const { sessions, currentSessionId } = get();
    return sessions.find(s => s.id === currentSessionId) || null;
  },

  currentBranch: () => {
    const session = get().currentSession();
    if (!session?.branches) return null;
    return session.branches.find(b => b.id === session.active_branch_id) ?? null;
  },

  loadSessions: () => {
    const local = getStorage<ProgressiveSession[]>(STORAGE_KEYS.PROGRESSIVE_SESSIONS, []);
    const migrated = migrateSessionDrafts(migrateBranches(migrateWorkers(local)));
    set({ sessions: migrated });

    // Async: merge with Supabase remote sessions (cross-device sync)
    import('@/lib/supabase').then(({ supabase, getCurrentUserId }) =>
      getCurrentUserId().then(userId => {
        if (!userId) return;
        supabase
          .from('progressive_sessions')
          .select('id, data, updated_at')
          .eq('user_id', userId)
          .order('updated_at', { ascending: false })
          .limit(100)
          .then(({ data: remoteSessions }) => {
            if (!remoteSessions || remoteSessions.length === 0) return;
            const currentLocal = get().sessions;
            const localMap = new Map(currentLocal.map(s => [s.id, s]));
            let changed = false;

            for (const remote of remoteSessions) {
              const remoteSession = remote.data as ProgressiveSession;
              if (!remoteSession?.id) continue;
              const localSession = localMap.get(remoteSession.id);
              if (!localSession) {
                // Remote-only: add to local
                localMap.set(remoteSession.id, remoteSession);
                changed = true;
              } else if (
                remote.updated_at &&
                localSession.updated_at &&
                new Date(remote.updated_at) > new Date(localSession.updated_at)
              ) {
                // Remote is newer: replace local (e.g., human response arrived on another device)
                localMap.set(remoteSession.id, remoteSession);
                changed = true;
              }
            }

            if (changed) {
              const merged = migrateSessionDrafts(migrateBranches(migrateWorkers(Array.from(localMap.values()))));
              setStorage(STORAGE_KEYS.PROGRESSIVE_SESSIONS, merged);
              set({ sessions: merged });
            }
          });
      })
    ).catch(() => { /* Supabase unavailable — local is fine */ });
  },

  createSession: (projectId, problemText, reviewerAgentId?) => {
    const id = generateId();
    const now = new Date().toISOString();
    const session: ProgressiveSession = {
      id,
      project_id: projectId,
      problem_text: problemText,
      decision_maker: null,
      reviewer_agent_id: reviewerAgentId,
      phase: 'analyzing',
      round: 0,
      max_rounds: 5,
      questions: [],
      answers: [],
      snapshots: [],
      workers: [],
      worker_deploy_phase: 'none' as WorkerDeployPhase,
      mix: null,
      dm_feedback: null,
      final_deliverable: null,
      final_mix: null,
      created_at: now,
      updated_at: now,
    };
    const sessions = [...get().sessions, session];
    persist(sessions);
    set({ sessions, currentSessionId: id });
    track('progressive_session_created', { project_id: projectId });
    return id;
  },

  setPhase: (phase) => {
    const { currentSessionId } = get();
    if (!currentSessionId) return;
    const sessions = updateSession(get().sessions, currentSessionId, () => ({ phase }));
    persist(sessions);
    set({ sessions });
    track('progressive_phase_change', { phase });
  },

  setDecisionMaker: (name) => {
    const { currentSessionId } = get();
    if (!currentSessionId) return;
    const sessions = updateSession(get().sessions, currentSessionId, () => ({ decision_maker: name }));
    persist(sessions);
    set({ sessions });
  },

  addQuestion: (question) => {
    const { currentSessionId } = get();
    if (!currentSessionId) return;
    const sessions = updateSession(get().sessions, currentSessionId, (s) => ({
      questions: [...s.questions, question],
    }));
    persist(sessions);
    set({ sessions });
  },

  addAnswer: (answer) => {
    const { currentSessionId } = get();
    if (!currentSessionId) return;
    const sessions = updateSession(get().sessions, currentSessionId, (s) => ({
      answers: [...s.answers, answer],
    }));
    persist(sessions);
    set({ sessions });
  },

  advanceRound: () => {
    const { currentSessionId } = get();
    if (!currentSessionId) return;
    const sessions = updateSession(get().sessions, currentSessionId, (s) => ({
      round: s.round + 1,
    }));
    persist(sessions);
    set({ sessions });
  },

  addSnapshot: (snapshot) => {
    const { currentSessionId } = get();
    if (!currentSessionId) return;
    const sessions = updateSession(get().sessions, currentSessionId, (s) => ({
      snapshots: [...s.snapshots, snapshot],
    }));
    persist(sessions);
    set({ sessions });
  },

  updateLatestSnapshot: (partial) => {
    const { currentSessionId } = get();
    if (!currentSessionId) return;
    const sessions = updateSession(get().sessions, currentSessionId, (s) => {
      const snaps = [...s.snapshots];
      if (snaps.length === 0) return {};
      snaps[snaps.length - 1] = { ...snaps[snaps.length - 1], ...partial };
      return { snapshots: snaps };
    });
    persist(sessions);
    set({ sessions });
  },

  replaceInitialSnapshot: (snapshot) => {
    const { currentSessionId } = get();
    if (!currentSessionId) return;
    const sessions = updateSession(get().sessions, currentSessionId, () => ({
      snapshots: [snapshot],
    }));
    persist(sessions);
    set({ sessions });
  },

  replaceLatestQuestion: (question) => {
    const { currentSessionId } = get();
    if (!currentSessionId) return;
    const sessions = updateSession(get().sessions, currentSessionId, (s) => {
      const questions = [...s.questions];
      if (questions.length > 0) {
        questions[questions.length - 1] = question;
      } else {
        questions.push(question);
      }
      return { questions };
    });
    persist(sessions);
    set({ sessions });
  },

  linkToReframe: (reframeItemId) => {
    const { currentSessionId } = get();
    if (!currentSessionId) return;
    const sessions = updateSession(get().sessions, currentSessionId, (s) => ({
      reframe_item_id: reframeItemId,
      exited_at_phase: s.phase,
      exited_at_round: s.round,
    }));
    persist(sessions);
    set({ sessions });
  },

  linkToRecast: (recastItemId) => {
    const { currentSessionId } = get();
    if (!currentSessionId) return;
    const sessions = updateSession(get().sessions, currentSessionId, (s) => ({
      recast_item_id: recastItemId,
      exited_at_phase: s.phase,
      exited_at_round: s.round,
    }));
    persist(sessions);
    set({ sessions });
  },

  setMix: (mix) => {
    const { currentSessionId } = get();
    if (!currentSessionId) return;
    const sessions = updateSession(get().sessions, currentSessionId, () => ({
      mix,
      phase: 'dm_feedback' as ProgressivePhase,
    }));
    persist(sessions);
    set({ sessions });
  },

  setDMFeedback: (feedback) => {
    const { currentSessionId } = get();
    if (!currentSessionId) return;
    const sessions = updateSession(get().sessions, currentSessionId, () => ({
      dm_feedback: feedback,
      phase: 'refining' as ProgressivePhase,
    }));
    persist(sessions);
    set({ sessions });
  },

  toggleFix: (concernIndex) => {
    const { currentSessionId } = get();
    if (!currentSessionId) return;
    const sessions = updateSession(get().sessions, currentSessionId, (s) => {
      if (!s.dm_feedback) return {};
      const concerns = s.dm_feedback.concerns.map((c: DMConcern, i: number) =>
        i === concernIndex ? { ...c, applied: !c.applied } : c,
      );
      return { dm_feedback: { ...s.dm_feedback, concerns } };
    });
    persist(sessions);
    set({ sessions });
  },

  setFinalDeliverable: (text, finalMix) => {
    const { currentSessionId } = get();
    if (!currentSessionId) return;

    // Phase transition is always applied — writing to final_deliverable marks
    // the session as complete (this preserves the existing reset-then-rerun
    // flow used by "이해관계자 검증 다시 하기").
    let sessions = updateSession(get().sessions, currentSessionId, () => ({
      final_deliverable: text,
      final_mix: finalMix ?? null,
      phase: 'complete' as ProgressivePhase,
    }));

    // Auto-append a Draft node only for *real* completions — i.e. when the
    // caller is writing a non-empty final text. The reset path that passes
    // null must not pollute the draft tree.
    if (text && typeof text === 'string' && text.length > 0) {
      const current = sessions.find((s) => s.id === currentSessionId);
      if (current) {
        const existingDrafts = current.drafts || [];
        let parentId: string | null;
        let reviewingAgentId: Draft['reviewing_agent_id'];
        let changeSummary: string;

        if (existingDrafts.length === 0) {
          // Initial completion — root of the draft tree.
          parentId = null;
          reviewingAgentId = null;
          changeSummary = getCurrentLanguage() === 'ko' ? '첫 초안 (에이전트 팀 분석)' : 'First draft (agent team analysis)';
        } else {
          // Re-run of DM stakeholder review — append as child of active leaf.
          parentId = current.active_draft_id
            ?? existingDrafts[existingDrafts.length - 1].id;
          reviewingAgentId = 'dm_reroll';
          changeSummary = getCurrentLanguage() === 'ko' ? '이해관계자 재검증 반영' : 'Re-applied stakeholder validation';
        }

        // Compute the new version label via pure version-numbering helpers.
        const parentLabel = parentId
          ? (existingDrafts.find((d) => d.id === parentId)?.version_label || ROOT_LABEL)
          : ROOT_LABEL;
        const siblingLabels = existingDrafts
          .filter((d) => (d.parent_draft_id ?? null) === parentId)
          .map((d) => d.version_label);
        const versionLabel = nextChildLabel(parentLabel, siblingLabels);

        const newDraft: Draft = {
          id: generateId(),
          parent_draft_id: parentId,
          version_label: versionLabel,
          change_summary: changeSummary,
          directive: null,
          final_text: text,
          final_mix: finalMix ?? null,
          reviewing_agent_id: reviewingAgentId,
          created_at: new Date().toISOString(),
        };

        sessions = updateSession(sessions, currentSessionId, (s) => ({
          drafts: [...(s.drafts || []), newDraft],
          active_draft_id: newDraft.id,
        }));
      }
    }

    persist(sessions);
    set({ sessions });
  },

  // ─── Post-complete draft tree actions ───

  addDraft: (init) => {
    const { currentSessionId } = get();
    if (!currentSessionId) return null;
    const current = get().sessions.find((s) => s.id === currentSessionId);
    if (!current) return null;

    const existing = current.drafts || [];
    const parentId = init.parent_draft_id;
    const parentLabel = parentId
      ? (existing.find((d) => d.id === parentId)?.version_label || ROOT_LABEL)
      : ROOT_LABEL;
    const siblingLabels = existing
      .filter((d) => (d.parent_draft_id ?? null) === parentId)
      .map((d) => d.version_label);
    const versionLabel = nextChildLabel(parentLabel, siblingLabels);

    const newId = generateId();
    const newDraft: Draft = {
      id: newId,
      parent_draft_id: parentId,
      version_label: versionLabel,
      change_summary: init.change_summary.slice(0, 60),
      directive: init.directive,
      final_text: init.final_text,
      final_mix: init.final_mix ?? null,
      reviewing_agent_id: init.reviewing_agent_id,
      created_at: new Date().toISOString(),
    };

    const sessions = updateSession(get().sessions, currentSessionId, (s) => ({
      drafts: [...(s.drafts || []), newDraft],
      active_draft_id: newId,
      // Also update the flat final_deliverable so the rest of the UI (ShareBar,
      // FinalCard, export) sees the new version without any special casing.
      final_deliverable: init.final_text,
      final_mix: init.final_mix ?? s.final_mix ?? null,
      phase: 'complete' as ProgressivePhase,
    }));
    persist(sessions);
    set({ sessions });
    track('progressive_draft_added', {
      parent_id: parentId,
      label: versionLabel,
      agent: init.reviewing_agent_id,
    });
    return newId;
  },

  setActiveDraft: (draftId) => {
    const { currentSessionId } = get();
    if (!currentSessionId) return;
    const current = get().sessions.find((s) => s.id === currentSessionId);
    if (!current) return;
    const target = draftId
      ? (current.drafts || []).find((d) => d.id === draftId)
      : undefined;

    const sessions = updateSession(get().sessions, currentSessionId, () => ({
      active_draft_id: draftId,
      // When branching to an older draft, update the surface-level final_*
      // fields so the main UI (FinalCard) shows that draft's content.
      ...(target
        ? { final_deliverable: target.final_text, final_mix: target.final_mix ?? null }
        : {}),
    }));
    persist(sessions);
    set({ sessions });
    track('progressive_active_draft_changed', { draft_id: draftId });
  },

  promoteDraftToV1: (draftId) => {
    const { currentSessionId } = get();
    if (!currentSessionId) return;

    const sessions = updateSession(get().sessions, currentSessionId, (s) => {
      const drafts = s.drafts || [];
      const target = drafts.find((d) => d.id === draftId);
      if (!target) return {};
      const newLabel = promoteToMajor(target.version_label);
      return {
        drafts: drafts.map((d) =>
          d.id === draftId ? { ...d, version_label: newLabel } : d,
        ),
        released_draft_id: draftId,
      };
    });
    persist(sessions);
    set({ sessions });
    track('progressive_draft_promoted', { draft_id: draftId });
  },

  getActiveDraftPath: () => {
    const current = get().currentSession();
    if (!current || !current.drafts || current.drafts.length === 0) return [];
    const nodes = current.drafts.map((d) => ({
      id: d.id,
      parent_id: d.parent_draft_id,
      created_at: d.created_at,
      _full: d,
    }));
    const path = getActivePathGeneric(nodes, current.active_draft_id ?? null);
    return path.map((n) => n._full);
  },

  // ─── Workers ───

  initWorkers: (steps, signals?) => {
    const { currentSessionId } = get();
    if (!currentSessionId) return [];
    const agentStore = useAgentStore.getState();

    // Agent store 미초기화 시 seed (최초 실행 대비)
    if (agentStore.agents.length === 0) {
      agentStore.loadAgents();
    }

    // Orchestrator: 입력 분류 → 에이전트 선택 → 프레임워크 배정
    const unlockedAgents = agentStore.getUnlockedAgents();
    const allObservations = unlockedAgents.flatMap(a => a.observations || []);
    const { classification, workers: planned, stages: plannedStages } = planWorkers(steps, signals, unlockedAgents, allObservations);

    // Lead Agent 선정: stakes >= important AND agentCount >= 2
    const leadConfig = selectLeadAgent(classification, unlockedAgents);
    if (leadConfig) {
      // Defer store update to after workers are set — use get().setLeadAgent
      // (called at the end of initWorkers after session update)
    }

    const latestSnapshot = get().currentSession()?.snapshots?.slice(-1)[0];
    const snapshotVersion = latestSnapshot?.version ?? 0;

    const workers: WorkerTask[] = planned.map((pw) => {
      const si = pw.stepIndex; // Use stepIndex, not loop index — buildStages may reorder workers
      // ai 타입만 에이전트 배정. self/human은 persona 없음
      const needsAgent = pw.agentType === 'ai';
      const agent = needsAgent && pw.agentId ? agentStore.getAgent(pw.agentId) : null;
      const fallbackAgent = needsAgent
        ? (agent || agentStore.assignAgentToTask(steps[si].task, steps[si].output, new Set()))
        : null;

      // legacy who 역산: agent_type → who (하위호환)
      const who: 'ai' | 'human' | 'both' = pw.agentType === 'ai' && pw.selfScope ? 'both'
        : pw.agentType === 'ai' ? 'ai'
        : 'human'; // self/human → legacy 'human'

      return {
        id: generateId(),
        // task_group_id seeds at init so users can later add a peer worker
        // to the same group (Manual team assignment). Each auto-assigned
        // task starts as its own group of 1.
        task_group_id: generateId(),
        // origin tracking — auto-assigned, original task captured for diff.
        added_manually: false,
        original_task: steps[si].task,
        step_index: si,
        task: steps[si].task,
        who,
        expected_output: steps[si].output,
        status: 'pending' as const,
        persona: fallbackAgent ? agentToWorkerPersona(fallbackAgent) : null,
        agent_id: fallbackAgent?.id,
        level: fallbackAgent ? numericLevelToAgentLevel(fallbackAgent.level) : 'junior' as const,
        framework: pw.framework || undefined,
        stage_id: pw.stageId || undefined,
        task_type: pw.taskType || undefined,
        stream_text: '',
        result: null,
        human_input: null,
        error: null,
        approved: null,
        completion_note: null,
        started_at: null,
        completed_at: null,
        // v2 Unified Agent System fields
        agent_type: pw.agentType,
        ai_scope: pw.aiScope || undefined,
        self_scope: pw.selfScope || undefined,
        decision: pw.decision || undefined,
        ai_preliminary: null,
        question_to_human: pw.questionToHuman || undefined,
        // Auto-match contact from registered personas
        contact: (() => {
          if (pw.agentType !== 'human') return undefined;
          const hint = pw.humanContactHint?.toLowerCase() || '';
          const { usePersonaStore: pStore } = require('@/stores/usePersonaStore');
          const personas = pStore?.getState?.()?.personas || [];
          const match = personas.find((p: { name: string; role: string; contact?: { email?: string; slack_id?: string }; deleted_at?: string | null }) =>
            !p.deleted_at && (p.contact?.email || p.contact?.slack_id) &&
            (p.name.toLowerCase().includes(hint) || p.role.toLowerCase().includes(hint) || hint.includes(p.name.toLowerCase()))
          );
          if (match?.contact) {
            return {
              name: match.name,
              channel: match.contact.slack_id ? 'slack' as const : 'email' as const,
              address: match.contact.slack_id || match.contact.email || '',
            };
          }
          return undefined;
        })(),
        snapshot_version: snapshotVersion,
      };
    });

    // dependsOn: stepIndex[] → depends_on: workerId[] 변환
    const stepToWorkerId = new Map(workers.map(w => [w.step_index, w.id]));
    for (let i = 0; i < workers.length; i++) {
      const pw = planned[i];
      if (pw.dependsOn && pw.dependsOn.length > 0) {
        workers[i].depends_on = pw.dependsOn
          .map(si => stepToWorkerId.get(si))
          .filter((id): id is string => !!id);
      }
    }

    // 스테이지의 workerIds를 실제 생성된 ID로 매핑
    const stages = plannedStages.map(stage => ({
      ...stage,
      workerIds: workers.filter(w => w.stage_id === stage.id).map(w => w.id),
    }));

    // 'ready' = 팀 구성 완료, 사용자 확인 대기
    const sessions = updateSession(get().sessions, currentSessionId, () => ({
      workers,
      stages,
      worker_deploy_phase: 'ready' as WorkerDeployPhase,
    }));
    persist(sessions);
    set({ sessions });

    // Lead Agent 설정 (workers 영속화 이후)
    if (leadConfig) {
      get().setLeadAgent(leadConfig.agentId, leadConfig.agentName, leadConfig.domain);
    }

    track('workers_initialized', { count: workers.length, lead_agent: leadConfig?.agentId || null });
    return workers;
  },

  deployWorkers: () => {
    const { currentSessionId } = get();
    if (!currentSessionId) return;
    const sessions = updateSession(get().sessions, currentSessionId, (s) => ({
      worker_deploy_phase: 'deployed' as WorkerDeployPhase,
      workers: s.workers.map(w => {
        if (w.status !== 'pending') return w;
        const aType = w.agent_type || (w.who === 'both' ? 'ai' : w.who === 'human' ? 'self' : 'ai');
        // self/human with ai_scope → ai_preparing (AI 보조 먼저 실행)
        if ((aType === 'self' || aType === 'human') && w.ai_scope) {
          return { ...w, status: 'ai_preparing' as const };
        }
        // self/human without ai_scope → waiting_input (즉시 사용자 입력 대기)
        if (aType === 'self' || aType === 'human') {
          return { ...w, status: 'waiting_input' as const };
        }
        // ai → pending (runAllAIWorkers에서 실행)
        return w;
      }),
    }));
    persist(sessions);
    set({ sessions });
  },

  updateWorker: (workerId, partial) => {
    const { currentSessionId } = get();
    if (!currentSessionId) return;
    const sessions = updateSession(get().sessions, currentSessionId, (s) => ({
      workers: s.workers.map(w => w.id === workerId ? { ...w, ...partial } : w),
    }));
    persist(sessions);
    set({ sessions });
  },

  setWorkerStreamText: (workerId, text) => {
    const { currentSessionId } = get();
    if (!currentSessionId) return;
    // Bypass updateSession — no updated_at stamp, no persist. Minimizes object churn.
    const sessions = get().sessions.map(s => {
      if (s.id !== currentSessionId) return s;
      return {
        ...s,
        workers: s.workers.map(w =>
          w.id === workerId ? { ...w, stream_text: text } : w
        ),
      };
    });
    set({ sessions });
  },

  submitHumanInput: (workerId, input) => {
    const { currentSessionId } = get();
    if (!currentSessionId) return;
    const now = new Date().toISOString();
    const sessions = updateSession(get().sessions, currentSessionId, (s) => ({
      workers: s.workers.map(w => w.id === workerId ? {
        ...w, human_input: input, result: input, status: 'done' as const, approved: true, completed_at: now,
      } : w),
    }));
    persist(sessions);
    set({ sessions });
  },

  approveWorker: (workerId) => {
    const { currentSessionId } = get();
    if (!currentSessionId) return;
    const session = get().currentSession();
    const worker = session?.workers.find(w => w.id === workerId);

    const sessions = updateSession(get().sessions, currentSessionId, (s) => ({
      workers: s.workers.map(w => w.id === workerId ? { ...w, approved: true } : w),
    }));
    persist(sessions);
    set({ sessions });

    // Agent XP 적립 + Observation (품질 기반 XP)
    if (worker?.agent_id) {
      const qualityXP = computeQualityXP('task_approved', worker.validation_score);
      useAgentStore.getState().recordActivity(
        worker.agent_id, 'task_approved', `${worker.task}|qxp:${qualityXP}`, currentSessionId,
      );
      onTaskApproved(worker.agent_id, worker.task, worker.result || '');
    }
  },

  rejectWorker: (workerId) => {
    const { currentSessionId } = get();
    if (!currentSessionId) return;
    const session = get().currentSession();
    const worker = session?.workers.find(w => w.id === workerId);

    const sessions = updateSession(get().sessions, currentSessionId, (s) => ({
      workers: s.workers.map(w => w.id === workerId ? { ...w, approved: false } : w),
    }));
    persist(sessions);
    set({ sessions });

    // Agent XP 차감 + Observation
    if (worker?.agent_id) {
      const qualityXP = computeQualityXP('task_rejected', worker.validation_score);
      useAgentStore.getState().recordActivity(
        worker.agent_id, 'task_rejected', `${worker.task}|qxp:${qualityXP}`, currentSessionId,
      );
      onTaskRejected(worker.agent_id, worker.task);
    }
  },

  // ─── Manual team assignment ───
  // Cap on parallel personas per task group. Each entry in the group runs
  // its own LLM call, so we keep a hard ceiling regardless of UI state.
  // Ceiling matches the user-facing limit advertised in PersonaPoolModal.

  addWorkerToGroup: (taskGroupId, persona) => {
    const { currentSessionId } = get();
    if (!currentSessionId) return null;
    const session = get().currentSession();
    if (!session) return null;
    const groupMembers = session.workers.filter(w => (w.task_group_id || w.id) === taskGroupId);
    if (groupMembers.length === 0) return null;
    if (groupMembers.length >= 5) return null;
    if (groupMembers.some(w => w.persona?.id === persona.id)) return null;

    // Use the first member as a template. Manual additions are always 'ai'
    // type — self/human still go through the existing toggle on the row.
    const seed = groupMembers[0];
    const newId = generateId();
    // Match the picked persona to a real Agent when one exists with the same
    // id — this is what wires manual additions into the XP/level/observation
    // system. Custom personas (no matching agent) keep agent_id undefined.
    const matchedAgent = useAgentStore.getState().getAgent(persona.id);
    const newWorker: WorkerTask = {
      ...seed,
      id: newId,
      task_group_id: taskGroupId,
      who: 'ai',
      agent_type: 'ai',
      persona,
      agent_id: matchedAgent?.id,
      level: matchedAgent ? numericLevelToAgentLevel(matchedAgent.level) : 'junior',
      // origin tracking — manual addition. original_task inherits from seed
      // so the "수정됨" cue still works correctly in the new worker's view.
      added_manually: true,
      original_task: seed.original_task ?? seed.task,
      // Reset execution state so the new persona starts fresh.
      status: 'pending',
      stream_text: '',
      result: null,
      human_input: null,
      error: null,
      approved: null,
      completion_note: null,
      started_at: null,
      completed_at: null,
      ai_preliminary: null,
      // Drop human-specific fields when cloning from a non-AI seed.
      contact: undefined,
      question_to_human: undefined,
      sent_at: undefined,
      response_at: undefined,
      // Drop quality/retry/plan state — those belong to a specific run.
      validation_score: undefined,
      validation_feedback: undefined,
      validation_passed: undefined,
      retry_count: undefined,
      plan: undefined,
      plan_step_results: undefined,
      delegation_depth: undefined,
      delegated_to: undefined,
      delegated_from: undefined,
    };

    const sessions = updateSession(get().sessions, currentSessionId, (s) => ({
      workers: [...s.workers, newWorker],
    }));
    persist(sessions);
    set({ sessions });
    return newId;
  },

  removeWorker: (workerId) => {
    const { currentSessionId } = get();
    if (!currentSessionId) return false;
    const session = get().currentSession();
    if (!session) return false;
    const target = session.workers.find(w => w.id === workerId);
    if (!target) return false;
    const groupId = target.task_group_id || target.id;
    const groupSize = session.workers.filter(w => (w.task_group_id || w.id) === groupId).length;
    if (groupSize <= 1) return false; // Last survivor — auto-assigned task must persist.

    const sessions = updateSession(get().sessions, currentSessionId, (s) => ({
      workers: s.workers.filter(w => w.id !== workerId),
    }));
    persist(sessions);
    set({ sessions });
    return true;
  },

  replaceWorkerPersona: (workerId, persona) => {
    const { currentSessionId } = get();
    if (!currentSessionId) return;
    const sessions = updateSession(get().sessions, currentSessionId, (s) => ({
      workers: s.workers.map(w => {
        if (w.id !== workerId) return w;
        return {
          ...w,
          persona,
          agent_id: undefined,
          // Reset execution state — new persona, fresh run.
          status: 'pending',
          stream_text: '',
          result: null,
          error: null,
          approved: null,
          completion_note: null,
          started_at: null,
          completed_at: null,
          ai_preliminary: null,
          validation_score: undefined,
          validation_feedback: undefined,
          validation_passed: undefined,
          retry_count: undefined,
        };
      }),
    }));
    persist(sessions);
    set({ sessions });
  },

  updateGroupTask: (taskGroupId, newText) => {
    const trimmed = newText.trim();
    if (!trimmed) return;
    const { currentSessionId } = get();
    if (!currentSessionId) return;
    const sessions = updateSession(get().sessions, currentSessionId, (s) => ({
      workers: s.workers.map(w =>
        (w.task_group_id || w.id) === taskGroupId ? { ...w, task: trimmed } : w,
      ),
    }));
    persist(sessions);
    set({ sessions });
  },

  // ─── Voyage chart ───

  recordCheckpoint: (stage, label) => {
    const { currentSessionId } = get();
    if (!currentSessionId) return null;
    const session = get().currentSession();
    if (!session) return null;

    // Avoid duplicate origin: if this is the very first checkpoint and
    // the session has nothing meaningful yet, still record it — that's
    // the rewindable "before anything happened" state.
    const state_snapshot: VoyageCheckpointState = {
      phase: session.phase,
      round: session.round,
      questions: session.questions.slice(),
      answers: session.answers.slice(),
      snapshots: session.snapshots.slice(),
      // Drop transient streaming text from the snapshot — it's reset to '' on
      // load anyway (migrateWorkers), so storing it per checkpoint is pure waste
      // and the biggest avoidable contributor to localStorage growth as branches
      // multiply checkpoints.
      workers: session.workers.map(w => (w.stream_text ? { ...w, stream_text: '' } : w)),
      worker_deploy_phase: session.worker_deploy_phase,
      mix: session.mix,
      dm_feedback: session.dm_feedback,
      final_deliverable: session.final_deliverable,
      final_mix: session.final_mix ?? null,
      user_notes: session.user_notes ?? null,
      decision_maker: session.decision_maker,
      lead_synthesis: session.lead_synthesis ?? null,
    };

    const checkpoint: VoyageCheckpoint = {
      id: generateId(),
      parent_id: session.active_checkpoint_id ?? null,
      stage,
      label: label || defaultCheckpointLabel(stage, session.round),
      created_at: new Date().toISOString(),
      state_snapshot,
    };

    // Chronicler — derive a ship's-log waypoint from this transition. The
    // parent checkpoint's state is the "before"; deriveWaypoint judges salience
    // deterministically and returns null for non-turns (the common case).
    const parentCp = session.active_checkpoint_id
      ? (session.checkpoints || []).find(c => c.id === session.active_checkpoint_id)
      : null;
    const waypoint = deriveWaypoint({
      newCheckpoint: checkpoint,
      prevState: parentCp?.state_snapshot ?? null,
      problemText: session.problem_text,
    });

    const sessions = updateSession(get().sessions, currentSessionId, (s) => {
      // Maintain the branch layer atomically with the checkpoint write so the
      // active branch head never drifts from active_checkpoint_id.
      const branches = s.branches ? [...s.branches] : [];
      let active_branch_id = s.active_branch_id ?? null;

      if (branches.length === 0) {
        // Origin checkpoint → birth of the trunk course-line.
        const main: VoyageBranch = {
          id: `main-${s.id}`,
          name: defaultMainBranchName(),
          head_checkpoint_id: checkpoint.id,
          forked_from_checkpoint_id: null,
          status: 'sailing',
          color: BRANCH_COLORS[0],
          created_at: checkpoint.created_at,
        };
        branches.push(main);
        active_branch_id = main.id;
      } else {
        // Advance the active branch head to the new checkpoint. Defensive: if
        // active_branch_id is stale, fall back to the branch whose head was the
        // previous active checkpoint, then re-anchor active_branch_id to it.
        let idx = branches.findIndex(b => b.id === active_branch_id);
        if (idx < 0) idx = branches.findIndex(b => b.head_checkpoint_id === s.active_checkpoint_id);
        if (idx >= 0) {
          branches[idx] = { ...branches[idx], head_checkpoint_id: checkpoint.id };
          active_branch_id = branches[idx].id;
        }
      }

      return {
        checkpoints: [...(s.checkpoints || []), checkpoint],
        active_checkpoint_id: checkpoint.id,
        branches,
        active_branch_id,
        ...(waypoint ? { waypoints: [...(s.waypoints || []), waypoint] } : {}),
      };
    });
    persist(sessions);
    set({ sessions });
    return checkpoint;
  },

  restoreCheckpoint: (checkpointId) => {
    const { currentSessionId } = get();
    if (!currentSessionId) return;
    const session = get().currentSession();
    if (!session) return;
    const target = (session.checkpoints || []).find(c => c.id === checkpointId);
    if (!target) return;
    // Replace live fields with the snapshot. The checkpoint itself stays
    // intact in the array — the previous branch is preserved as siblings
    // of any future checkpoint that gets recorded after the fork.
    const sessions = updateSession(get().sessions, currentSessionId, () => ({
      ...restoreFields(target.state_snapshot),
      active_checkpoint_id: checkpointId,
    }));
    persist(sessions);
    set({ sessions });
  },

  forkBranch: (fromCheckpointId, label) => {
    const { currentSessionId } = get();
    if (!currentSessionId) return null;
    let session = get().currentSession();
    if (!session) return null;
    const fromCp = (session.checkpoints || []).find(c => c.id === fromCheckpointId);
    if (!fromCp) return null;

    // Cap branch count — refuse to fork past the limit (callers treat null as a
    // no-op). Checked before any side effect (safety checkpoint) below.
    if ((session.branches || []).length >= MAX_BRANCHES) {
      track('voyage_fork_blocked', { reason: 'max_branches' });
      return null;
    }

    // Preserve in-progress work on the current branch before leaving it. The
    // safety checkpoint advances the *current* branch head (active_branch_id is
    // still the source branch at this point), so nothing is lost.
    if (progressAheadOfHead(session)) {
      get().recordCheckpoint(phaseToStage(session.phase));
      session = get().currentSession();
      if (!session) return null;
    }

    const branches = session.branches || [];
    const newBranchId = generateId();
    const ko = getCurrentLanguage() === 'ko';
    const newBranch: VoyageBranch = {
      id: newBranchId,
      name: label || (ko ? `분기 ${branches.length}` : `Branch ${branches.length}`),
      head_checkpoint_id: fromCheckpointId,
      forked_from_checkpoint_id: fromCheckpointId,
      status: 'sailing',
      color: BRANCH_COLORS[branches.length % BRANCH_COLORS.length],
      created_at: new Date().toISOString(),
    };

    // Atomic: restore live state to the fork point AND register + activate the
    // new branch in a single update. Subsequent recordCheckpoint calls parent
    // off fromCheckpointId, producing a real sibling lineage.
    const sessions = updateSession(get().sessions, currentSessionId, (s) => ({
      ...restoreFields(fromCp.state_snapshot),
      active_checkpoint_id: fromCheckpointId,
      branches: [...(s.branches || []), newBranch],
      active_branch_id: newBranchId,
    }));
    persist(sessions);
    set({ sessions });
    track('voyage_fork_branch', { from_stage: fromCp.stage });
    return newBranchId;
  },

  switchBranch: (branchId) => {
    const { currentSessionId } = get();
    if (!currentSessionId) return;
    let session = get().currentSession();
    if (!session) return;
    const target = (session.branches || []).find(b => b.id === branchId);
    if (!target || branchId === session.active_branch_id) return;

    // Preserve in-progress work on the current branch first (no data loss).
    if (progressAheadOfHead(session)) {
      get().recordCheckpoint(phaseToStage(session.phase));
      session = get().currentSession();
      if (!session) return;
    }

    const targetCp = (session.checkpoints || []).find(c => c.id === target.head_checkpoint_id);
    if (!targetCp) return;

    // Atomic: restore the target branch's live state AND flip active_branch_id
    // in one update so the two never momentarily disagree (stale-closure guard).
    const sessions = updateSession(get().sessions, currentSessionId, () => ({
      ...restoreFields(targetCp.state_snapshot),
      active_checkpoint_id: target.head_checkpoint_id,
      active_branch_id: branchId,
    }));
    persist(sessions);
    set({ sessions });
    track('voyage_switch_branch', {});
  },

  anchorBranch: (branchId) => {
    const { currentSessionId } = get();
    if (!currentSessionId) return;
    const session = get().currentSession();
    if (!session?.branches) return;
    if (!session.branches.some(b => b.id === branchId)) return;
    // Make the chosen course canonical first: switch to it so the live session
    // fields (and therefore the final deliverable / export) ARE this branch's
    // state. Without this, anchoring a non-active branch would leave the output
    // pointing at a different course.
    if (session.active_branch_id !== branchId) get().switchBranch(branchId);
    // Chosen branch → anchored; every other course-line → abandoned (kept in
    // the tree, still switchable, just visually retired).
    const sessions = updateSession(get().sessions, currentSessionId, (s) => ({
      branches: (s.branches || []).map(b =>
        b.id === branchId
          ? { ...b, status: 'anchored' as const }
          : { ...b, status: 'abandoned' as const },
      ),
    }));
    persist(sessions);
    set({ sessions });
    track('voyage_anchor_branch', {});
  },

  navigateToCheckpoint: (checkpointId) => {
    const session = get().currentSession();
    if (!session) return;
    if (checkpointId === session.active_checkpoint_id) return; // already here
    const checkpoints = session.checkpoints || [];
    const branches = session.branches || [];
    const active = branches.find(b => b.id === session.active_branch_id) ?? null;
    const activeIds = active
      ? new Set(getActivePathGeneric(checkpoints, active.head_checkpoint_id).map(c => c.id))
      : new Set<string>();
    // On the current course (including shared ancestry) → fork to diverge here.
    if (activeIds.has(checkpointId)) { get().forkBranch(checkpointId); return; }
    // Belongs to another existing course → switch to that branch.
    const owning = branches.find(b =>
      b.id !== session.active_branch_id &&
      getActivePathGeneric(checkpoints, b.head_checkpoint_id).some(c => c.id === checkpointId));
    if (owning) { get().switchBranch(owning.id); return; }
    // Unowned point → fork.
    get().forkBranch(checkpointId);
  },

  enrichWaypoint: (waypointId, patch) => {
    const { currentSessionId } = get();
    if (!currentSessionId) return;
    const session = get().currentSession();
    if (!session?.waypoints?.some(w => w.id === waypointId)) return;
    const sessions = updateSession(get().sessions, currentSessionId, (s) => ({
      waypoints: (s.waypoints || []).map(w => w.id === waypointId ? { ...w, ...patch } : w),
    }));
    persist(sessions);
    set({ sessions });
  },

  allWorkersDone: () => {
    const session = get().currentSession();
    if (!session || session.workers.length === 0) return true;
    // v2: Mix 가능 조건 — AI 완료 + self/human은 입력 대기 허용
    return session.workers.every(w =>
      w.status === 'done' ||
      w.status === 'waiting_response' ||      // human 응답 대기는 block 안 함
      w.status === 'sent' ||                  // human 발송됨도 block 안 함
      (w.agent_type === 'self' && w.status === 'waiting_input') ||  // self 입력 대기 (ai_scope 유무 무관)
      (w.agent_type === 'human' && w.status === 'waiting_input')    // human Phase 1 수동 입력 대기
    );
  },

  /** @deprecated Use mixableWorkerResults instead */
  approvedWorkerResults: () => {
    return get().mixableWorkerResults();
  },

  mixableWorkerResults: () => {
    const session = get().currentSession();
    if (!session) return [];
    // v2 정책:
    // - done + result + approved!==false → final (기존과 동일)
    // - ai_preliminary + waiting_input → preliminary (AI 보조 결과 참고용 포함)
    // - human waiting_response → pending_human (질문만 포함)
    // - approved=false → 제외
    return session.workers
      .filter(w => w.approved !== false)
      .map(w => {
        const agent = w.agent_id ? useAgentStore.getState().getAgent(w.agent_id) : undefined;
        const base = {
          persona: w.persona?.name ?? null,
          agentName: agent?.name ?? w.persona?.name ?? null,
          agentRole: agent?.role ?? w.persona?.role ?? null,
          // Surface group id so callers can sort/group same-task results
          // before sending to the mix prompt. Falls back to worker.id for
          // legacy sessions (each worker = its own singleton group).
          taskGroupId: w.task_group_id || w.id,
        };

        if (w.status === 'done' && w.result) {
          return { workerId: w.id, task: w.task, result: w.result, type: 'final' as const, ...base };
        }
        if (w.ai_preliminary && (w.status === 'waiting_input' || w.status === 'ai_preparing')) {
          return { workerId: w.id, task: w.task, result: w.ai_preliminary, type: 'preliminary' as const, ...base };
        }
        if (w.agent_type === 'human' && (w.status === 'waiting_response' || w.status === 'sent')) {
          const awaitingLabel = getCurrentLanguage() === 'ko' ? '[응답 대기 중]' : '[awaiting response]';
          return { workerId: w.id, task: w.task, result: `${awaitingLabel} ${w.question_to_human || w.task}`, type: 'pending_human' as const, ...base };
        }
        return null;
      })
      .filter((w): w is NonNullable<typeof w> => w !== null);
  },

  // ─── Lead Agent ───

  setLeadAgent: (agentId, agentName, domain) => {
    const { currentSessionId } = get();
    if (!currentSessionId) return;
    const sessions = updateSession(get().sessions, currentSessionId, () => ({
      lead_agent: { agent_id: agentId, agent_name: agentName, domain },
    }));
    persist(sessions);
    set({ sessions });
  },

  setLeadSynthesis: (result) => {
    const { currentSessionId } = get();
    if (!currentSessionId) return;
    const sessions = updateSession(get().sessions, currentSessionId, () => ({
      lead_synthesis: result,
    }));
    persist(sessions);
    set({ sessions });
  },

  setUserNotes: (notes) => {
    const { currentSessionId } = get();
    if (!currentSessionId) return;
    const sessions = updateSession(get().sessions, currentSessionId, () => ({
      user_notes: notes,
    }));
    persist(sessions);
    set({ sessions });
  },

  setDebateResult: (result) => {
    const { currentSessionId } = get();
    if (!currentSessionId) return;
    const sessions = updateSession(get().sessions, currentSessionId, () => ({
      debate_result: result,
    }));
    persist(sessions);
    set({ sessions });
  },

  deleteSession: (id) => {
    const sessions = get().sessions.filter(s => s.id !== id);
    persist(sessions);
    const currentSessionId = get().currentSessionId === id ? null : get().currentSessionId;
    set({ sessions, currentSessionId });
  },
}));
