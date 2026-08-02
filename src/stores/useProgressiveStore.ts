import { create } from 'zustand';
import { generateId } from '@/lib/uuid';
import { getStorage, setStorage, STORAGE_KEYS } from '@/lib/storage';
import { upsertToSupabase, loadAndMerge } from '@/lib/db';
import { track } from '@/lib/analytics';
import { useAgentStore } from '@/stores/useAgentStore';
import { agentToWorkerPersona } from '@/lib/agent-adapters';
import { XP_REWARDS } from '@/stores/agent-types';
import type { Agent } from '@/stores/agent-types';
import { numericLevelToAgentLevel } from '@/lib/agent-skills';
import { onTaskApproved, onTaskRejected } from '@/lib/observation-engine';
import { planWorkers } from '@/lib/orchestrator';
import { boundDeepExecutionPlan } from '@/lib/judgment-depth';
import { selectLeadAgent } from '@/lib/lead-agent';
import { computeQualityXP } from '@/lib/agent-quality';
import { nextChildLabel, promoteToMajor, ROOT_LABEL } from '@/lib/version-numbering';
import { getCurrentLanguage } from '@/lib/i18n';
import { getActivePath as getActivePathGeneric, overallLatest } from '@/lib/version-tree';
import { resolveCheckpointNav } from '@/lib/voyage-nav';
import { deriveWaypoint } from '@/lib/voyage-log';
import { deriveCurrentBearing } from '@/lib/current-bearing';
import type {
  ProgressiveSession,
  ProgressivePhase,
  FlowQuestion,
  FlowAnswer,
  AnalysisSnapshot,
  MixResult,
  DMFeedbackResult,
  Falsification,
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
  BearingLedgerEntry,
} from '@/stores/types';

/** Course-line colors, cycled as new branches fork off the tree. */
const BRANCH_COLORS = ['#2d4a7c', '#8b6914', '#6b4c9a', '#2d6b2d', '#9b5de5', '#b5651d'];

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
    case 'dm_feedback': case 'refining': case 'testing': return 'review';
    case 'complete': case 'iterating': return 'anchor';
    default: return 'briefing';
  }
}

/* ─── P1-4 체크포인트 다이어트: blob interning ───
 * Checkpoints used to copy every worker's full result document and the final
 * deliverable PER CHECKPOINT — the session JSON grew ~8x as branches multiplied.
 * Large strings now live ONCE in session.checkpoint_blobs (content-keyed,
 * append-only) and checkpoints store `@cpblob:<key>` refs. Restore resolves
 * refs; legacy checkpoints (full strings) pass through untouched. Consumers
 * that only truthiness-check these fields (progressSignature, deriveWaypoint)
 * are unaffected — a ref string is still truthy. */
const CP_BLOB_PREFIX = '@cpblob:';
const CP_BLOB_MIN_LEN = 200; // below this, interning costs more than it saves

/** Content key: djb2 + length (length term makes accidental collisions
 *  practically require equal-length different docs with equal hash). */
export function cpBlobKey(value: string): string {
  let h = 5381;
  for (let i = 0; i < value.length; i++) h = ((h << 5) + h + value.charCodeAt(i)) | 0;
  return `${(h >>> 0).toString(36)}-${value.length}`;
}

/** Intern a large string into the pool (mutates `blobs`), returning a ref.
 *  Small/null/already-ref values pass through unchanged. */
export function internCpString(blobs: Record<string, string>, value: string | null): string | null {
  if (!value || value.length < CP_BLOB_MIN_LEN || value.startsWith(CP_BLOB_PREFIX)) return value;
  const key = cpBlobKey(value);
  if (!(key in blobs)) blobs[key] = value;
  return CP_BLOB_PREFIX + key;
}

/** Resolve a possible ref back to its content. A missing blob (theoretical
 *  corruption) returns the ref itself — a visible marker beats silent loss. */
export function resolveCpString(blobs: Record<string, string> | undefined, value: string | null): string | null {
  if (!value || !value.startsWith(CP_BLOB_PREFIX)) return value;
  return blobs?.[value.slice(CP_BLOB_PREFIX.length)] ?? value;
}

/** The live session fields restored from a checkpoint's state snapshot. Shared
 *  by switchBranch / forkBranch so the field list lives in exactly one place
 *  (adding a field to VoyageCheckpointState updates all). */
function restoreFields(snap: VoyageCheckpointState, blobs?: Record<string, string>): Partial<ProgressiveSession> {
  return {
    phase: snap.phase,
    round: snap.round,
    questions: snap.questions,
    answers: snap.answers,
    snapshots: snap.snapshots,
    workers: snap.workers.map((w) => ({
      ...w,
      result: resolveCpString(blobs, w.result),
      completion_note: resolveCpString(blobs, w.completion_note),
    })),
    worker_deploy_phase: snap.worker_deploy_phase,
    mix: snap.mix,
    dm_feedback: snap.dm_feedback,
    final_deliverable: resolveCpString(blobs, snap.final_deliverable),
    final_mix: snap.final_mix,
    user_notes: snap.user_notes,
    decision_maker: snap.decision_maker,
    lead_synthesis: snap.lead_synthesis,
    // Absent on old checkpoints → null, never the abandoned branch's values:
    // both feed the contract seed and the bearing (measurement integrity).
    falsification: snap.falsification ?? null,
    debate_result: snap.debate_result ?? null,
  };
}

/** Compact signature of the meaningful, restorable progress in a state. Two
 *  states with the same signature restore to the same working point, so a
 *  fork/switch between them loses nothing. Covers every field a worker could
 *  advance (workers + results, mix, dm feedback, final, Q&A) — not just the
 *  phase/round/snapshot scalars, which miss in-flight team work. */
function progressSignature(s: {
  phase: ProgressivePhase;
  round: number;
  questions: FlowQuestion[];
  answers: FlowAnswer[];
  snapshots: AnalysisSnapshot[];
  workers: WorkerTask[];
  worker_deploy_phase: WorkerDeployPhase;
  mix: MixResult | null;
  dm_feedback: DMFeedbackResult | null;
  final_deliverable: string | null;
}): string {
  return [
    s.phase,
    s.round,
    (s.questions || []).length,
    (s.answers || []).length,
    (s.snapshots || []).length,
    (s.workers || []).length,
    (s.workers || []).filter(w => w.result).length,
    s.worker_deploy_phase,
    s.mix ? 1 : 0,
    s.dm_feedback ? 1 : 0,
    s.final_deliverable ? 1 : 0,
  ].join('|');
}

/** True when the live state has advanced past the active checkpoint's snapshot.
 *  Used to decide whether a fork/switch must first preserve in-progress work as
 *  a safety checkpoint — no data loss. */
function progressAheadOfHead(session: ProgressiveSession): boolean {
  const head = (session.checkpoints || []).find(c => c.id === session.active_checkpoint_id);
  if (!head) return false;
  return progressSignature(head.state_snapshot) !== progressSignature(session);
}

/** Auto-generated label per stage. Locale-aware fallback when callers
 *  don't provide their own. */
function defaultCheckpointLabel(stage: VoyageStage, round: number): string {
  const lang = getCurrentLanguage();
  const ko = lang === 'ko';
  switch (stage) {
    case 'origin':     return ko ? '출발' : 'Origin';
    case 'briefing':   return ko ? `질문 정리 ${round}` : `Question framing ${round}`;
    case 'crew_set':   return ko ? '검토 구성' : 'Review setup';
    case 'crew_done':  return ko ? '검토 완료' : 'Review complete';
    case 'mix':        return ko ? '정리' : 'Write-up';
    case 'review':     return ko ? '리뷰어 검토' : 'Review';
    case 'anchor':     return ko ? '완료' : 'Complete';
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
  /** True while the engine is streaming or workers are in flight — branch
   *  mutations (fork/switch/anchor/delete) must hold until it settles so the
   *  running work isn't stranded. Single source of truth for the UI lock. */
  isBranchingLocked: () => boolean;

  // Actions
  loadSessions: () => void;
  createSession: (projectId: string, problemText: string, reviewerAgentId?: string) => string;
  setPhase: (phase: ProgressivePhase) => void;
  setDecisionMaker: (name: string) => void;
  setJudgmentMode: (mode: 'standard' | 'deep', authorizedAt?: string, funding?: 'platform' | 'byok') => void;

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
  /** Remove the LAST answer iff it answers `questionId` — restores the question
   *  when the deepening call that consumed it failed (the answer was recorded
   *  but never analyzed; leaving it would silently skip the user to mix). */
  rollbackAnswer: (questionId: string) => void;
  advanceRound: () => void;

  // Analysis
  addSnapshot: (snapshot: AnalysisSnapshot) => void;
  updateLatestSnapshot: (partial: Partial<AnalysisSnapshot>) => void;

  // Mix & DM
  setMix: (mix: MixResult) => void;
  /** Integrity-scan patch (FIX 7): replace the mix WITHOUT touching the phase —
   *  setMix forces phase 'dm_feedback', which would yank back a user who has
   *  already moved past the draft when the async scan resolves. */
  patchMix: (mix: MixResult) => void;
  /** The user's own call on which premises would have flipped the decision.
   *  Written onto the latest snapshot's records so it survives to the seal. */
  setPremiseDecisive: (answers: Record<string, 'flips' | 'holds'>) => void;
  setDMFeedback: (feedback: DMFeedbackResult) => void;
  toggleFix: (concernIndex: number) => void;
  /** Persist the committed overreach/flinch result. Additive — never touches
   *  dm_feedback or the phase (the handler owns phase: 'testing' on entry,
   *  onFinalize on commit). The Decision Contract reads this. */
  setFalsification: (falsification: Falsification) => void;
  setSealPromptDismissed: (dismissed: boolean) => void;

  // Final
  setFinalDeliverable: (text: string, finalMix?: MixResult | null) => void;

  // Framing (Weakness A)
  replaceInitialSnapshot: (snapshot: AnalysisSnapshot) => void;
  replaceLatestQuestion: (question: FlowQuestion) => void;

  // Pipeline bridge (Weakness D)
  linkToReframe: (reframeItemId: string) => void;
  linkToRecast: (recastItemId: string) => void;

  // Workers
  initWorkers: (steps: { task: string; who?: string; agent_type?: string; output: string; agent_hint?: string; ai_scope?: string; self_scope?: string; decision?: string; question_to_human?: string; human_contact_hint?: string; depends_on?: number[] }[], signals?: InterviewSignals, userLeaning?: boolean) => WorkerTask[];
  deployWorkers: () => void;
  updateWorker: (workerId: string, partial: Partial<WorkerTask>) => void;
  setWorkerStreamText: (workerId: string, text: string) => void;
  submitHumanInput: (workerId: string, input: string) => void;
  approveWorker: (workerId: string) => void;
  rejectWorker: (workerId: string) => void;
  allWorkersDone: () => boolean;
  /** Workers that finished with a result but the captain hasn't decided on yet
   *  (approved === null). These would otherwise flow into the final draft
   *  unverified — the verification gate surfaces them before mixing. */
  unreviewedWorkers: () => WorkerTask[];
  /** Accept all still-unreviewed workers in one go (approved = true). Used by
   *  the gate's explicit "proceed without checking" override so the final
   *  state honestly records that the captain accepted them. */
  approveAllPending: () => void;
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
  /** Switch an entire task group between tracks: 'ai' (an AI teammate),
   *  'self' (the captain decides), or 'human' (ask a real person). Surfaces
   *  the human-collaboration tracks that were previously fixed by the planner.
   *  Only single-member groups can leave the AI track (one task → one person);
   *  returns true when applied, false on no-op/guard. */
  setGroupTrack: (taskGroupId: string, track: 'ai' | 'self' | 'human') => boolean;

  // ─── Voyage chart (decision checkpoints) ───
  /** Record a checkpoint at the current state. Called automatically at
   *  each stage transition. Returns the new checkpoint, or null if no
   *  active session. */
  recordCheckpoint: (stage: VoyageStage, label?: string, silent?: boolean) => VoyageCheckpoint | null;
  /** Fork a new course-line from a checkpoint: restores live state to that
   *  point, creates a sibling branch, and makes it active. Preserves any
   *  in-progress work on the current branch first. Returns the new branch id. */
  forkBranch: (fromCheckpointId: string, label?: string) => string | null;
  /** Switch the live session to another branch's head (single-active model).
   *  Preserves the current branch's in-progress work before leaving. */
  switchBranch: (branchId: string) => void;
  /** Resolve a chart checkpoint click to the right branch verb: switch to the
   *  branch that owns it, else fork a new course from it. Keeps the chart in
   *  sync with the branch model (no silent reassignment). */
  navigateToCheckpoint: (checkpointId: string) => void;
  /** Merge Chronicler's interpretive `significance` into a waypoint.
   *  It must never author the user's `why_abandoned` reason (E-B3). */
  enrichWaypoint: (waypointId: string, patch: Partial<Waypoint>) => void;
  /** @deprecated Use mixableWorkerResults instead */
  approvedWorkerResults: () => Array<{ task: string; result: string; type?: string; persona: string | null; agentName: string | null; agentRole: string | null }>;
  mixableWorkerResults: () => Array<{ workerId: string; task: string; result: string; type: 'final' | 'preliminary' | 'pending_human'; authored: 'user' | 'ai'; persona: string | null; agentName: string | null; agentRole: string | null; taskGroupId: string }>;

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
 *
 * TRAILING debounce: each new mutation resets the timer, so the upsert fires
 * once, 3s after activity SETTLES. The old leading-edge version fired every
 * ~2s for the whole active phase, uploading the full session (with its
 * checkpoint copies — easily hundreds of KB) over and over.
 */
const _pendingSyncs = new Map<string, ReturnType<typeof setTimeout>>();

/** Push one session's latest localStorage copy to Supabase right now. */
function syncSessionNow(id: string) {
  const latest = getStorage<ProgressiveSession[]>(STORAGE_KEYS.PROGRESSIVE_SESSIONS, []).find(ss => ss.id === id);
  if (!latest) return;
  // Promise.resolve: test mocks stub upsertToSupabase as a void fn, and unlike
  // the old debounced path this now runs synchronously inside store actions.
  Promise.resolve(upsertToSupabase('progressive_sessions', {
    id: latest.id,
    project_id: latest.project_id,
    data: latest,
    phase: latest.phase,
    has_pending_humans: (latest.workers || []).some(
      w => w.agent_type === 'human' && (w.status === 'sent' || w.status === 'waiting_response')
    ),
    updated_at: latest.updated_at || new Date().toISOString(),
  })).catch(() => { /* fire-and-forget — localStorage is primary */ });
}

/** Fire every debounced sync immediately (H1-B4). The 3s trailing debounce had
 *  no unload hook, so finishing a voyage and closing the tab inside the window
 *  meant the final deliverable never reached the server — while every screen
 *  still looked fine (localStorage-first hides exactly this failure). */
function flushPendingSyncs() {
  for (const [id, timer] of _pendingSyncs) {
    clearTimeout(timer);
    _pendingSyncs.delete(id);
    syncSessionNow(id);
  }
}

if (typeof window !== 'undefined') {
  // pagehide covers close/navigate (fetch is best-effort there); the
  // visibilitychange→hidden flush is the reliable one — the tab is still
  // alive, so the request completes normally.
  window.addEventListener('pagehide', flushPendingSyncs);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushPendingSyncs();
  });
}

function persist(sessions: ProgressiveSession[], opts?: { immediate?: string }) {
  setStorage(STORAGE_KEYS.PROGRESSIVE_SESSIONS, sessions);

  // Supabase async sync — find sessions that changed (heuristic: any with workers or non-input phase)
  for (const s of sessions) {
    if (s.phase === 'input' && (!s.workers || s.workers.length === 0)) continue; // Skip empty sessions

    const existing = _pendingSyncs.get(s.id);
    if (existing) clearTimeout(existing);

    // Terminal mutations (final deliverable / seal) skip the debounce — the
    // moment right after the climax is when users leave, i.e. exactly when a
    // 3s window loses data.
    if (opts?.immediate === s.id) {
      _pendingSyncs.delete(s.id);
      syncSessionNow(s.id);
      continue;
    }

    _pendingSyncs.set(s.id, setTimeout(() => {
      _pendingSyncs.delete(s.id);
      syncSessionNow(s.id);
    }, 3000));
  }
}

/** Migrate worker statuses and add v2 fields for backward compat */
function migrateWorkers(sessions: ProgressiveSession[]): ProgressiveSession[] {
  return sessions.map(s => ({
    ...s,
    // In-flight phases all land on 'conversing' after a reload. NOTE the
    // ternary chain evaluates against the ORIGINAL phase: mapping
    // lead_synthesizing → 'mixing' here used to leave the session stuck in a
    // phase with busy=false — an eternal fake "초안을 작성하고 있어요" with no
    // CTA anywhere (mixing UIs all require live state). Straight to conversing.
    phase: (s.phase === 'lead_synthesizing' && !s.lead_synthesis) ? 'conversing' as const
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
// Defensive Data Access (CLAUDE.md): a persisted/legacy/remote-merged mix may
// drop its array fields even though the type says otherwise. A bare `.map` at
// render then throws into the step ErrorBoundary ("이 단계에서 문제가 생겼어요").
// Normalize once at the hydration boundary so every downstream reader is safe.
function normMix<M>(mix: M): M {
  if (!mix || typeof mix !== 'object') return mix;
  const m = mix as { sections?: unknown; key_assumptions?: unknown; next_steps?: unknown };
  return {
    ...m,
    sections: Array.isArray(m.sections) ? m.sections : [],
    key_assumptions: Array.isArray(m.key_assumptions) ? m.key_assumptions : [],
    next_steps: Array.isArray(m.next_steps) ? m.next_steps : [],
  } as M;
}

function migrateMix(sessions: ProgressiveSession[]): ProgressiveSession[] {
  return sessions.map(s => ({
    ...s,
    mix: normMix(s.mix),
    final_mix: normMix(s.final_mix),
    drafts: s.drafts ? s.drafts.map(d => ({ ...d, final_mix: normMix(d.final_mix) })) : s.drafts,
  }));
}

function migrateSessionDrafts(sessions: ProgressiveSession[]): ProgressiveSession[] {
  return sessions.map((s) => {
    if (s.drafts && s.drafts.length > 0) return s;
    if (!s.final_deliverable) return s;
    const id = `legacy-${s.id}-0`;
    const draft: Draft = {
      id,
      parent_draft_id: null,
      version_label: 'v0.1',
      change_summary: getCurrentLanguage() === 'ko' ? '첫 정리 (에이전트 팀 분석)' : 'First write-up (agent team analysis)',
      directive: null,
      final_text: s.final_deliverable,
      final_mix: s.final_mix ?? null,
      reviewing_agent_id: null,
      created_at: s.updated_at || s.created_at || new Date().toISOString(),
    };
    const migrated: ProgressiveSession = {
      ...s,
      drafts: [draft],
      active_draft_id: s.active_draft_id ?? id,
    };
    if (migrated.bearing_entries && migrated.bearing_entries.length > 0) return migrated;
    const bearingEntry = buildBearingLedgerEntry(migrated, draft, 'finalize', `legacy-bearing-${s.id}-0`);
    return bearingEntry ? { ...migrated, bearing_entries: [bearingEntry] } : migrated;
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

function buildBearingLedgerEntry(
  session: ProgressiveSession,
  draft: Draft | null,
  source: BearingLedgerEntry['source'],
  id = generateId(),
): BearingLedgerEntry | null {
  const bearing = deriveCurrentBearing(session);
  if (!bearing) return null;
  const latestSnapshot = session.snapshots[session.snapshots.length - 1];
  return {
    id,
    created_at: new Date().toISOString(),
    source,
    draft_id: draft?.id ?? session.active_draft_id ?? null,
    version_label: draft?.version_label ?? null,
    snapshot_version: latestSnapshot?.version,
    bearing,
  };
}

function upsertBearingEntry(
  entries: BearingLedgerEntry[] | undefined,
  entry: BearingLedgerEntry,
): BearingLedgerEntry[] {
  const current = entries ?? [];
  const index = current.findIndex((existing) =>
    entry.draft_id
      ? existing.draft_id === entry.draft_id
      : existing.id === entry.id,
  );
  if (index < 0) return [...current, entry];
  const next = current.slice();
  next[index] = { ...current[index], ...entry };
  return next;
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

  isBranchingLocked: () => {
    const s = get().currentSession();
    if (!s) return false;
    const phaseBusy = s.phase === 'analyzing' || s.phase === 'mixing' || s.phase === 'lead_synthesizing';
    // Only genuinely in-flight workers lock branching. 'pending' means "not
    // started" — counting it as busy permanently locked branching on a session
    // that got stuck in deployed+pending (crash/reload), so "이 길 가보기" and
    // map forks became dead. The user explicitly forking wants to leave that
    // course anyway, so a not-yet-started worker must not block them.
    const workersBusy = s.worker_deploy_phase === 'deployed'
      && (s.workers || []).some(w => w.status === 'running' || w.status === 'ai_preparing');
    return phaseBusy || workersBusy;
  },

  loadSessions: () => {
    const local = getStorage<ProgressiveSession[]>(STORAGE_KEYS.PROGRESSIVE_SESSIONS, []);
    const migrated = migrateMix(migrateSessionDrafts(migrateBranches(migrateWorkers(local))));
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
              const merged = migrateMix(migrateSessionDrafts(migrateBranches(migrateWorkers(Array.from(localMap.values())))));
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
      judgment_mode: 'standard',
      deep_funding: null,
      deep_authorized_at: null,
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
      seal_prompt_dismissed_at: null,
      bearing_entries: [],
      final_deliverable: null,
      final_mix: null,
      created_at: now,
      updated_at: now,
    };
    const sessions = [...get().sessions, session];
    // The first server copy is the most important one: without it an anonymous
    // visitor can have a project row but no voyage row if they close the tab
    // during the old 3-second trailing-debounce window.
    persist(sessions, { immediate: id });
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
    // The initial-analysis prompt returns the STRING "null" when no decision-maker
    // is inferred; the caller's `if (r.detectedDM)` treated that non-empty string
    // as truthy and stored it, surfacing as literal "null 시점 검토" in the UI.
    // Drop junk names here so the store never holds a non-name.
    const clean = (name ?? '').trim();
    if (!clean || clean.toLowerCase() === 'null' || clean.toLowerCase() === 'undefined') return;
    const sessions = updateSession(get().sessions, currentSessionId, () => ({ decision_maker: clean }));
    persist(sessions);
    set({ sessions });
  },

  setJudgmentMode: (mode, authorizedAt, funding) => {
    const { currentSessionId } = get();
    if (!currentSessionId) return;
    const sessions = updateSession(get().sessions, currentSessionId, () => ({
      judgment_mode: mode,
      deep_funding: mode === 'deep' ? (funding ?? 'platform') : null,
      deep_authorized_at: mode === 'deep' ? (authorizedAt ?? new Date().toISOString()) : null,
    }));
    persist(sessions);
    set({ sessions });
    track('judgment_mode_changed', { mode });
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

  rollbackAnswer: (questionId) => {
    const { currentSessionId } = get();
    if (!currentSessionId) return;
    const sessions = updateSession(get().sessions, currentSessionId, (s) => {
      const last = s.answers[s.answers.length - 1];
      if (!last || last.question_id !== questionId) return {};
      return { answers: s.answers.slice(0, -1) };
    });
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

  patchMix: (mix) => {
    const { currentSessionId } = get();
    if (!currentSessionId) return;
    const sessions = updateSession(get().sessions, currentSessionId, () => ({ mix }));
    persist(sessions);
    set({ sessions });
  },

  setPremiseDecisive: (answers) => {
    const { currentSessionId, sessions: current } = get();
    if (!currentSessionId || Object.keys(answers).length === 0) return;
    const session = current.find((item) => item.id === currentSessionId);
    const snapshots = session?.snapshots ?? [];
    if (snapshots.length === 0) return;
    const last = snapshots[snapshots.length - 1];
    const patched = {
      ...last,
      premise_records: (last.premise_records ?? []).map((record) => (
        answers[record.text] ? { ...record, decisive: answers[record.text] } : record
      )),
    };
    const sessions = updateSession(current, currentSessionId, () => ({
      snapshots: [...snapshots.slice(0, -1), patched],
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

  setFalsification: (falsification) => {
    const { currentSessionId } = get();
    if (!currentSessionId) return;
    const sessions = updateSession(get().sessions, currentSessionId, () => ({
      falsification,
    }));
    persist(sessions);
    set({ sessions });
  },

  setSealPromptDismissed: (dismissed) => {
    const { currentSessionId } = get();
    if (!currentSessionId) return;
    const sessions = updateSession(get().sessions, currentSessionId, () => ({
      seal_prompt_dismissed_at: dismissed ? new Date().toISOString() : null,
    }));
    // A closing choice is terminal user intent. Sync immediately so navigating
    // away right after declining cannot resurrect the prompt on another device.
    persist(sessions, { immediate: currentSessionId });
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
          changeSummary = getCurrentLanguage() === 'ko' ? '첫 정리 (에이전트 팀 분석)' : 'First write-up (agent team analysis)';
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
        const sessionForBearing: ProgressiveSession = {
          ...current,
          final_deliverable: text,
          final_mix: finalMix ?? null,
          drafts: [...existingDrafts, newDraft],
          active_draft_id: newDraft.id,
        };
        const bearingEntry = buildBearingLedgerEntry(
          sessionForBearing,
          newDraft,
          existingDrafts.length === 0 ? 'finalize' : 'draft_revision',
        );

        sessions = updateSession(sessions, currentSessionId, (s) => ({
          drafts: [...(s.drafts || []), newDraft],
          active_draft_id: newDraft.id,
          ...(bearingEntry
            ? { bearing_entries: upsertBearingEntry(s.bearing_entries, bearingEntry) }
            : {}),
        }));
      }
    }

    persist(sessions, { immediate: currentSessionId });
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
    const sessionForBearing: ProgressiveSession = {
      ...current,
      final_deliverable: init.final_text,
      final_mix: init.final_mix ?? current.final_mix ?? null,
      drafts: [...existing, newDraft],
      active_draft_id: newId,
    };
    const bearingEntry = buildBearingLedgerEntry(sessionForBearing, newDraft, 'draft_revision');

    const sessions = updateSession(get().sessions, currentSessionId, (s) => ({
      drafts: [...(s.drafts || []), newDraft],
      active_draft_id: newId,
      // Also update the flat final_deliverable so the rest of the UI (ShareBar,
      // FinalCard, export) sees the new version without any special casing.
      final_deliverable: init.final_text,
      final_mix: init.final_mix ?? s.final_mix ?? null,
      phase: 'complete' as ProgressivePhase,
      ...(bearingEntry
        ? { bearing_entries: upsertBearingEntry(s.bearing_entries, bearingEntry) }
        : {}),
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
        bearing_entries: (s.bearing_entries || []).map((entry) =>
          entry.draft_id === draftId ? { ...entry, version_label: newLabel } : entry,
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

  initWorkers: (steps, signals?, userLeaning = false) => {
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
    const current = get().currentSession();
    if (current?.judgment_mode !== 'deep') return [];
    const boundedSteps = boundDeepExecutionPlan(
      steps,
      current.snapshots?.slice(-1)[0],
    );
    const { classification, workers: planned, stages: plannedStages, orchestrationPlan } = planWorkers(boundedSteps, signals, unlockedAgents, allObservations, userLeaning);

    // Lead Agent 선정: stakes >= important AND agentCount >= 2
    const leadConfig = selectLeadAgent(classification, unlockedAgents);
    if (leadConfig) {
      // Defer store update to after workers are set — use get().setLeadAgent
      // (called at the end of initWorkers after session update)
    }

    const latestSnapshot = get().currentSession()?.snapshots?.slice(-1)[0];
    const snapshotVersion = latestSnapshot?.version ?? 0;

    // Track every agent assigned across this plan so the fallback path doesn't
    // hand the SAME agent to two workers (the old `new Set()` ignored prior
    // picks → duplicate personas when there are more AI steps than agents).
    const assignedAgentIds = new Set<string>();
    const workers: WorkerTask[] = planned.map((pw) => {
      const si = pw.stepIndex; // Use stepIndex, not loop index — buildStages may reorder workers
      // ai 타입만 에이전트 배정. self/human은 persona 없음
      const needsAgent = pw.agentType === 'ai';
      const agent = needsAgent && pw.agentId ? agentStore.getAgent(pw.agentId) : null;
      const fallbackAgent = needsAgent
        ? (agent || agentStore.assignAgentToTask(boundedSteps[si].task, boundedSteps[si].output, assignedAgentIds))
        : null;
      if (fallbackAgent) assignedAgentIds.add(fallbackAgent.id);

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
        original_task: boundedSteps[si].task,
        step_index: si,
        task: boundedSteps[si].task,
        who,
        expected_output: boundedSteps[si].output,
        status: 'pending' as const,
        persona: fallbackAgent ? agentToWorkerPersona(fallbackAgent) : null,
        agent_id: fallbackAgent?.id,
        level: fallbackAgent ? numericLevelToAgentLevel(fallbackAgent.level) : 'junior' as const,
        framework: pw.framework || undefined,
        stage_id: pw.stageId || undefined,
        task_type: pw.taskType || undefined,
        // Why-this-agent rationale. Keep it when the *planned* agent was used
        // (correct), OR when NO agent was assigned at all (fallbackAgent null =
        // the F3 'unfilled' case — the reason is the honest "no strong fit" line,
        // which must reach the captain, especially on a sensitive/legal step).
        // Drop it ONLY when we fell back to a DIFFERENT agent (the reason would
        // mislabel that pick).
        assignment_reason: agent ? pw.assignmentReason : (fallbackAgent ? undefined : pw.assignmentReason),
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
      verify_depth: orchestrationPlan.verifyDepth,
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
      // Manual additions carry the "직접 추가" badge instead of an auto
      // rationale — clear the seed's reason/marker so neither is inherited.
      assignment_reason: undefined,
      user_assigned: undefined,
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
    // Dedup guard: swapping in a persona that another member of the same group
    // already holds would create a duplicate. The modal disables these rows,
    // but guard here too (defense in depth) — no-op rather than duplicate.
    const session = get().currentSession();
    const target = session?.workers.find(w => w.id === workerId);
    if (target) {
      const gid = target.task_group_id || target.id;
      const dup = session!.workers.some(
        w => w.id !== workerId && (w.task_group_id || w.id) === gid && w.persona?.id === persona.id,
      );
      if (dup) return;
    }
    // Preserve the XP/level wiring when the picked persona IS a real Agent
    // (same fix as addWorkerToGroup). Previously this always cleared agent_id,
    // silently severing the swapped-in worker from growth tracking.
    const matchedAgent = useAgentStore.getState().getAgent(persona.id);
    const ko = getCurrentLanguage() === 'ko';
    const sessions = updateSession(get().sessions, currentSessionId, (s) => ({
      workers: s.workers.map(w => {
        if (w.id !== workerId) return w;
        return {
          ...w,
          persona,
          agent_id: matchedAgent?.id,
          level: matchedAgent ? numericLevelToAgentLevel(matchedAgent.level) : 'junior',
          // User chose this member — replace the auto rationale with an
          // explicit "직접 지정" note so the captain's-seat reads correctly,
          // and flag it so the ship's-log 'helm' waypoint records the swap.
          assignment_reason: ko ? '직접 지정한 팀원' : 'You chose this member',
          user_assigned: true,
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
    track('worker_reassigned', { matched_agent: !!matchedAgent });
  },

  updateGroupTask: (taskGroupId, newText) => {
    const trimmed = newText.trim();
    if (!trimmed) return;
    const { currentSessionId } = get();
    if (!currentSessionId) return;
    const sessions = updateSession(get().sessions, currentSessionId, (s) => ({
      workers: s.workers.map(w =>
        // Editing the task invalidates the auto rationale (it described the
        // old task's classification). Drop it rather than show a stale claim —
        // the "수정됨" cue already signals the change.
        (w.task_group_id || w.id) === taskGroupId ? { ...w, task: trimmed, assignment_reason: undefined } : w,
      ),
    }));
    persist(sessions);
    set({ sessions });
  },

  setGroupTrack: (taskGroupId, nextTrack) => {
    const { currentSessionId } = get();
    if (!currentSessionId) return false;
    const session = get().currentSession();
    if (!session) return false;
    const members = session.workers.filter(w => (w.task_group_id || w.id) === taskGroupId);
    if (members.length === 0) return false;
    const seed = members[0];
    const current = seed.agent_type || (seed.who === 'both' ? 'ai' : seed.who === 'human' ? 'self' : 'ai');
    if (current === nextTrack) return false;
    // Leaving the AI track with multiple lenses would orphan the extras —
    // one task can't go to several people. Block it; the UI explains.
    if (current === 'ai' && nextTrack !== 'ai' && members.length > 1) return false;

    // Only resolve a fresh agent when entering the AI track. Exclude agents
    // already working other groups so we don't duplicate one across the crew.
    let aiAgent: Agent | null = null;
    if (nextTrack === 'ai') {
      const usedIds = new Set(
        session.workers
          .filter(w => (w.task_group_id || w.id) !== taskGroupId && w.agent_id)
          .map(w => w.agent_id as string),
      );
      aiAgent = useAgentStore.getState().assignAgentToTask(seed.task, seed.expected_output, usedIds);
    }

    const convert = (w: WorkerTask): WorkerTask => {
      // Track change at the captain's seat = fresh start (nothing has run).
      // Clear the scope/decision fields too: they were authored for the old
      // track's framing. Critically, a leftover ai_scope would make
      // deployWorkers() run an AI pre-pass ('ai_preparing') even after the
      // captain chose to handle the task themselves — contradicting the choice.
      // Each branch below sets only the fields its track needs.
      const base: WorkerTask = {
        ...w,
        status: 'pending', stream_text: '', result: null, human_input: null,
        error: null, approved: null, completion_note: null, started_at: null,
        completed_at: null, ai_preliminary: null, assignment_reason: undefined,
        user_assigned: undefined,
        ai_scope: undefined, self_scope: undefined, decision: undefined,
        validation_score: undefined, validation_feedback: undefined,
        validation_passed: undefined, retry_count: undefined,
      };
      if (nextTrack === 'ai') {
        return {
          ...base, agent_type: 'ai', who: 'ai',
          persona: aiAgent ? agentToWorkerPersona(aiAgent) : w.persona,
          agent_id: aiAgent?.id,
          level: aiAgent ? numericLevelToAgentLevel(aiAgent.level) : 'junior',
          contact: undefined, question_to_human: undefined, sent_at: undefined, response_at: undefined,
        };
      }
      if (nextTrack === 'self') {
        return {
          ...base, agent_type: 'self', who: 'human',
          persona: null, agent_id: undefined, level: 'junior',
          contact: undefined, question_to_human: undefined, sent_at: undefined, response_at: undefined,
        };
      }
      // human — seed the question from the task; the row's contact input fills the rest.
      return {
        ...base, agent_type: 'human', who: 'human',
        persona: null, agent_id: undefined, level: 'junior',
        question_to_human: w.question_to_human || w.task,
      };
    };

    const sessions = updateSession(get().sessions, currentSessionId, (s) => ({
      workers: s.workers.map(w => (w.task_group_id || w.id) === taskGroupId ? convert(w) : w),
    }));
    persist(sessions);
    set({ sessions });
    track('worker_track_changed', { from: current, to: nextTrack });
    return true;
  },

  // ─── Voyage chart ───

  recordCheckpoint: (stage, label, silent) => {
    const { currentSessionId } = get();
    if (!currentSessionId) return null;
    const session = get().currentSession();
    if (!session) return null;

    // React Strict Mode may replay the first-mount effect before its closure
    // sees the store update. Origin is the unique root of a voyage, so make
    // its creation idempotent at the store boundary instead of trusting UI
    // timing. This also prevents duplicate "시작" entries in the logbook.
    if (stage === 'origin') {
      const existingOrigin = (session.checkpoints || []).find(
        checkpoint => checkpoint.stage === 'origin' && checkpoint.parent_id === null,
      );
      if (existingOrigin) return existingOrigin;
    }

    // If this is the very first checkpoint, still record it — that's the
    // rewindable "before anything happened" state.
    // P1-4: intern the bulky strings into the session pool — the snapshot
    // stores refs, not copies. `blobs` accumulates into checkpoint_blobs below.
    const blobs = { ...(session.checkpoint_blobs || {}) };
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
      workers: session.workers.map(w => ({
        ...w,
        stream_text: '',
        result: internCpString(blobs, w.result),
        completion_note: internCpString(blobs, w.completion_note),
      })),
      worker_deploy_phase: session.worker_deploy_phase,
      mix: session.mix,
      dm_feedback: session.dm_feedback,
      final_deliverable: internCpString(blobs, session.final_deliverable),
      final_mix: session.final_mix ?? null,
      user_notes: session.user_notes ?? null,
      decision_maker: session.decision_maker,
      lead_synthesis: session.lead_synthesis ?? null,
      falsification: session.falsification ?? null,
      debate_result: session.debate_result ?? null,
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
    // `silent` checkpoints (the safety snapshots fork/switch take to preserve
    // in-progress work) are system events, not decision turns — they never
    // narrate, so they don't pollute the log with spurious waypoints.
    const parentCp = session.active_checkpoint_id
      ? (session.checkpoints || []).find(c => c.id === session.active_checkpoint_id)
      : null;
    const waypoint = silent ? null : deriveWaypoint({
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
          color: BRANCH_COLORS[0],
          created_at: checkpoint.created_at,
        };
        branches.push(main);
        active_branch_id = main.id;
      } else {
        // Advance the active branch head to the new checkpoint. Defensive: if
        // active_branch_id is stale, fall back to the branch whose head was the
        // previous active checkpoint; if still unresolved (corruption), advance
        // the first branch rather than silently leaving every head stale.
        let idx = branches.findIndex(b => b.id === active_branch_id);
        if (idx < 0) idx = branches.findIndex(b => b.head_checkpoint_id === s.active_checkpoint_id);
        if (idx < 0) idx = 0;
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
        // P1-4: the (append-only) blob pool the new snapshot's refs point into.
        checkpoint_blobs: blobs,
        ...(waypoint ? { waypoints: [...(s.waypoints || []), waypoint] } : {}),
      };
    });
    persist(sessions);
    set({ sessions });
    return checkpoint;
  },

  forkBranch: (fromCheckpointId, label) => {
    const { currentSessionId } = get();
    if (!currentSessionId) return null;
    let session = get().currentSession();
    if (!session) return null;
    const fromCp = (session.checkpoints || []).find(c => c.id === fromCheckpointId);
    if (!fromCp) return null;

    // No branch cap. The old MAX_BRANCHES=8 gate belonged to the named-course
    // "playground"; in the simplified model forking is a rare, deliberate
    // "go back and try differently", so an arbitrary ceiling (and the silent
    // null / toast it forced) only got in the user's way. Growth is bounded by
    // human action, and the chart already collapses sibling overflow into "+N".

    // Preserve in-progress work on the current branch before leaving it. The
    // safety checkpoint advances the *current* branch head (active_branch_id is
    // still the source branch at this point), so nothing is lost.
    if (progressAheadOfHead(session)) {
      get().recordCheckpoint(phaseToStage(session.phase), undefined, true);
      session = get().currentSession();
      if (!session) return null;
    }

    const branches = session.branches || [];
    const newBranchId = generateId();
    const ko = getCurrentLanguage() === 'ko';
    // De-duplicate the name: forking the same road-not-taken twice (or any name
    // collision) would otherwise produce two identical chips — confusing.
    let name = label || (ko ? `항로 ${branches.length}` : `Course ${branches.length}`);
    if (branches.some(b => b.name === name)) {
      let n = 2;
      while (branches.some(b => b.name === `${name} ${n}`)) n++;
      name = `${name} ${n}`;
    }
    const newBranch: VoyageBranch = {
      id: newBranchId,
      name,
      head_checkpoint_id: fromCheckpointId,
      forked_from_checkpoint_id: fromCheckpointId,
      color: BRANCH_COLORS[branches.length % BRANCH_COLORS.length],
      created_at: new Date().toISOString(),
    };

    // Atomic: restore live state to the fork point AND register + activate the
    // new branch in a single update. Subsequent recordCheckpoint calls parent
    // off fromCheckpointId, producing a real sibling lineage.
    const sessions = updateSession(get().sessions, currentSessionId, (s) => ({
      ...restoreFields(fromCp.state_snapshot, session.checkpoint_blobs),
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
      get().recordCheckpoint(phaseToStage(session.phase), undefined, true);
      session = get().currentSession();
      if (!session) return;
    }

    const targetCp = (session.checkpoints || []).find(c => c.id === target.head_checkpoint_id);
    if (!targetCp) return;

    // Atomic: restore the target branch's live state AND flip active_branch_id
    // in one update so the two never momentarily disagree (stale-closure guard).
    const sessions = updateSession(get().sessions, currentSessionId, () => ({
      ...restoreFields(targetCp.state_snapshot, session.checkpoint_blobs),
      active_checkpoint_id: target.head_checkpoint_id,
      active_branch_id: branchId,
    }));
    persist(sessions);
    set({ sessions });
    track('voyage_switch_branch', {});
  },

  navigateToCheckpoint: (checkpointId) => {
    const session = get().currentSession();
    if (!session) return;
    // Resolve fork-vs-switch through the shared pure helper so the chart's
    // confirm dialog and this action never disagree about what a tap does.
    const nav = resolveCheckpointNav(
      session.checkpoints || [], session.branches || [],
      session.active_branch_id, session.active_checkpoint_id, checkpointId,
    );
    if (nav.action === 'switch') { get().switchBranch(nav.branchId); return; }
    if (nav.action === 'fork') { get().forkBranch(nav.fromCheckpointId); return; }
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

  unreviewedWorkers: () => {
    const session = get().currentSession();
    if (!session) return [];
    // Done with a real result, but the captain hasn't accepted or excluded it.
    // (self/human submissions auto-set approved=true, so this is mostly AI work.)
    return session.workers.filter(w => w.status === 'done' && !!w.result && w.approved == null);
  },

  approveAllPending: () => {
    const { currentSessionId } = get();
    if (!currentSessionId) return;
    const pending = get().unreviewedWorkers();
    if (pending.length === 0) return;
    // Reuse approveWorker so XP/observation side-effects fire per worker,
    // exactly as if the captain had clicked 반영 on each.
    for (const w of pending) get().approveWorker(w.id);
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
          // F1: a done worker whose result IS the human's own input (submitHumanInput
          // sets result === human_input) is the USER's own decision — mark it so the
          // mix renders it as an authoritative user call, not an AI evidence bullet.
          const authored: 'user' | 'ai' = (w.human_input && w.result === w.human_input) ? 'user' : 'ai';
          return { workerId: w.id, task: w.task, result: w.result, type: 'final' as const, authored, ...base };
        }
        if (w.ai_preliminary && (w.status === 'waiting_input' || w.status === 'ai_preparing')) {
          return { workerId: w.id, task: w.task, result: w.ai_preliminary, type: 'preliminary' as const, authored: 'ai' as const, ...base };
        }
        if (w.agent_type === 'human' && (w.status === 'waiting_response' || w.status === 'sent')) {
          const awaitingLabel = getCurrentLanguage() === 'ko' ? '[응답 대기 중]' : '[awaiting response]';
          return { workerId: w.id, task: w.task, result: `${awaitingLabel} ${w.question_to_human || w.task}`, type: 'pending_human' as const, authored: 'ai' as const, ...base };
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
