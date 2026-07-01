/**
 * ProgressiveStore Draft Tree Simulation — end-to-end exercise of the
 * post-finalize iteration loop at the store level.
 *
 * Validates:
 * - Initial draft auto-creation on setFinalDeliverable(markdown)
 * - Null-text path does NOT create a draft (reset flow)
 * - addDraft with navigator lineage appends with correct parent + label
 * - addDraft label computation for main line vs branch
 * - setActiveDraft updates the surface final_deliverable
 * - getActiveDraftPath walks the tree correctly
 * - promoteDraftToV1 relabels + sets released_draft_id
 * - migrateSessionDrafts backfills drafts[0] for legacy sessions
 * - "이해관계자 검증 다시 하기" re-run produces a dm_reroll draft
 * - Cross-device merge: drafts persist through full session replacement
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// ─── Mocks (must be before store imports) ───

vi.mock('@/lib/db', () => ({
  upsertToSupabase: vi.fn(),
  loadAndMerge: vi.fn(() => Promise.resolve([])),
}));

// getCurrentUserId returns null → loadSessions short-circuits before the
// Supabase query chain runs, so we only need to stub the shape, not behavior.
vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
    auth: { getSession: vi.fn(() => Promise.resolve({ data: { session: null } })) },
    channel: vi.fn(() => ({ on: vi.fn().mockReturnThis(), subscribe: vi.fn() })),
    removeChannel: vi.fn(),
  },
  getCurrentUserId: vi.fn(() => Promise.resolve(null)),
}));

vi.mock('@/lib/storage', () => {
  let store: Record<string, unknown> = {};
  return {
    getStorage: vi.fn((key: string, fallback: unknown) => store[key] ?? fallback),
    setStorage: vi.fn((key: string, value: unknown) => { store[key] = value; }),
    STORAGE_KEYS: {
      PROGRESSIVE_SESSIONS: 'sot_progressive_sessions',
      SETTINGS: 'sot_settings',
    },
    __resetStore: () => { store = {}; },
  };
});

let _idCounter = 0;
vi.mock('@/lib/uuid', () => ({
  generateId: vi.fn(() => `gen-${++_idCounter}`),
}));

vi.mock('@/lib/analytics', () => ({
  track: vi.fn(),
}));

vi.mock('@/stores/useAgentStore', () => ({
  useAgentStore: {
    getState: () => ({
      agents: [],
      loadAgents: vi.fn(),
      getUnlockedAgents: () => [],
      getAgent: () => undefined,
      assignAgentToTask: () => null,
      recordActivity: vi.fn(),
    }),
  },
}));

vi.mock('@/lib/observation-engine', () => ({
  onTaskApproved: vi.fn(),
  onTaskRejected: vi.fn(),
}));

vi.mock('@/lib/orchestrator', () => ({
  planWorkers: () => ({ classification: {}, workers: [], stages: [] }),
}));

vi.mock('@/lib/lead-agent', () => ({
  selectLeadAgent: () => null,
}));

vi.mock('@/lib/agent-quality', () => ({
  computeQualityXP: () => 0,
}));

vi.mock('@/lib/agent-adapters', () => ({
  agentToWorkerPersona: () => null,
}));

vi.mock('@/lib/agent-skills', () => ({
  numericLevelToAgentLevel: () => 'junior',
}));

vi.mock('@/stores/usePersonaStore', () => ({
  usePersonaStore: {
    getState: () => ({ personas: [] }),
  },
}));

// ─── Imports after mocks ───

import { useProgressiveStore } from '@/stores/useProgressiveStore';
import { setStorage, __resetStore } from '@/lib/storage';
import type { ProgressiveSession, MixResult, WorkerTask, VoyageCheckpointState } from '@/stores/types';
import { setModuleLocale } from '@/lib/i18n';

// i18n default is now 'en' (en-first). These suites verify the KOREAN prompt
// output, so pin the locale. The English branch is verified in Phase 3.
beforeEach(() => setModuleLocale('ko'));

// ─── Helpers ───

/**
 * Zustand's `getState()` returns a snapshot, so binding `const store = ...`
 * once captures stale `sessions`. Every mutation is accessed through
 * `api()` which fetches fresh state each call.
 */
const api = () => useProgressiveStore.getState();

const createProgressiveSession = () => api().createSession('proj-1', '북미 시장 진출 전략');

const currentSession = (id: string): ProgressiveSession =>
  api().sessions.find((s) => s.id === id)!;

const stubMix = (title: string): MixResult => ({
  title,
  executive_summary: 'summary',
  sections: [{ heading: 'overview', content: title + ' body' }],
  key_assumptions: [],
  next_steps: [],
});

// ─── Tests ───

describe('ProgressiveStore Draft Tree', () => {
  beforeEach(() => {
    _idCounter = 0;
    (__resetStore as () => void)();
    useProgressiveStore.setState({ sessions: [], currentSessionId: null });
  });

  // ────────────────────────────────────────────
  // Initial draft auto-creation
  // ────────────────────────────────────────────

  describe('setFinalDeliverable auto-draft', () => {
    it('creates drafts[0] with v0.1 label when first called with non-empty text', () => {
      const sid = createProgressiveSession();
      useProgressiveStore.getState().setFinalDeliverable(
        '# Plan v1\nBody.',
        stubMix('Plan v1'),
      );
      const session = useProgressiveStore.getState().sessions.find(s => s.id === sid)!;
      expect(session.drafts).toBeDefined();
      expect(session.drafts).toHaveLength(1);
      const d0 = session.drafts![0];
      expect(d0.parent_draft_id).toBeNull();
      expect(d0.version_label).toBe('v0.1');
      expect(d0.reviewing_agent_id).toBeNull();
      expect(d0.change_summary).toContain('첫 초안');
      expect(d0.final_text).toBe('# Plan v1\nBody.');
      expect(session.active_draft_id).toBe(d0.id);
      expect(session.phase).toBe('complete');
      expect(session.bearing_entries).toHaveLength(1);
      expect(session.bearing_entries![0].draft_id).toBe(d0.id);
      expect(session.bearing_entries![0].version_label).toBe('v0.1');
      expect(session.bearing_entries![0].bearing.current_course.summary).toContain('summary');
    });

    it('does NOT create a draft when text is null (reset flow from "이해관계자 검증 다시 하기")', () => {
      const sid = createProgressiveSession();
      // Simulate a first completion then a reset.
      useProgressiveStore.getState().setFinalDeliverable('first', stubMix('first'));
      const afterFirst = useProgressiveStore.getState().sessions.find(s => s.id === sid)!;
      expect(afterFirst.drafts).toHaveLength(1);
      expect(afterFirst.bearing_entries).toHaveLength(1);

      // The reset path: code calls setFinalDeliverable with null text hack.
      useProgressiveStore.getState().setFinalDeliverable(null as unknown as string, null);
      const afterReset = useProgressiveStore.getState().sessions.find(s => s.id === sid)!;
      expect(afterReset.drafts).toHaveLength(1); // unchanged
      expect(afterReset.final_deliverable).toBeNull();
      // active_draft_id is preserved across the reset
      expect(afterReset.active_draft_id).toBe(afterFirst.drafts![0].id);
      expect(afterReset.bearing_entries).toHaveLength(1);
    });

    it('appends a dm_reroll draft on second non-null completion (re-run flow)', () => {
      const sid = createProgressiveSession();
      useProgressiveStore.getState().setFinalDeliverable('first', stubMix('first'));
      useProgressiveStore.getState().setFinalDeliverable(
        null as unknown as string,
        null,
      );
      // User goes through DM feedback again, then runFinalDeliverable fires:
      useProgressiveStore.getState().setFinalDeliverable(
        '# Plan v2 (reviewer reroll)',
        stubMix('Plan v2'),
      );
      const session = useProgressiveStore.getState().sessions.find(s => s.id === sid)!;
      expect(session.drafts).toHaveLength(2);
      const d1 = session.drafts![1];
      expect(d1.parent_draft_id).toBe(session.drafts![0].id);
      expect(d1.version_label).toBe('v0.2'); // main line continues
      expect(d1.reviewing_agent_id).toBe('dm_reroll');
      expect(d1.change_summary).toContain('이해관계자');
      expect(session.active_draft_id).toBe(d1.id);
      expect(session.bearing_entries).toHaveLength(2);
      expect(session.bearing_entries![1].draft_id).toBe(d1.id);
      expect(session.bearing_entries![1].source).toBe('draft_revision');
    });
  });

  // ────────────────────────────────────────────
  // addDraft (Navigator revision flow)
  // ────────────────────────────────────────────

  describe('addDraft', () => {
    it('appends a child draft with auto-computed main-line label', () => {
      const sid = createProgressiveSession();
      useProgressiveStore.getState().setFinalDeliverable('root', stubMix('root'));
      const root = useProgressiveStore.getState().sessions.find(s => s.id === sid)!.drafts![0];

      useProgressiveStore.getState().addDraft({
        parent_draft_id: root.id,
        directive: 'tighten the financial section',
        change_summary: '재무 섹션 보수화',
        final_text: 'root + tighter finances',
        final_mix: null,
        reviewing_agent_id: 'navigator',
      });

      const session = useProgressiveStore.getState().sessions.find(s => s.id === sid)!;
      expect(session.drafts).toHaveLength(2);
      const child = session.drafts![1];
      expect(child.parent_draft_id).toBe(root.id);
      expect(child.version_label).toBe('v0.2');
      expect(child.reviewing_agent_id).toBe('navigator');
      expect(child.directive).toBe('tighten the financial section');
      expect(session.active_draft_id).toBe(child.id);
      // final_deliverable is updated so FinalCard renders the new draft
      expect(session.final_deliverable).toBe('root + tighter finances');
      expect(session.bearing_entries).toHaveLength(2);
      expect(session.bearing_entries![1].draft_id).toBe(child.id);
      expect(session.bearing_entries![1].source).toBe('draft_revision');
    });

    it('computes branch label (v0.1.1) when parent already has a main-line child', () => {
      const sid = createProgressiveSession();
      api().setFinalDeliverable('root', stubMix('root'));
      const root = currentSession(sid).drafts![0];

      // Main line: v0.1 → v0.2
      api().addDraft({
        parent_draft_id: root.id,
        directive: 'first revision',
        change_summary: 's1',
        final_text: 'v0.2 body',
        final_mix: null,
        reviewing_agent_id: 'navigator',
      });

      // User branches back to root
      api().setActiveDraft(root.id);

      // Second revision off root → must become v0.1.1 (not v0.3)
      api().addDraft({
        parent_draft_id: root.id,
        directive: 'alt direction',
        change_summary: 's2',
        final_text: 'v0.1.1 body',
        final_mix: null,
        reviewing_agent_id: 'navigator',
      });

      const session = currentSession(sid);
      expect(session.drafts).toHaveLength(3);
      const branch = session.drafts![2];
      expect(branch.version_label).toBe('v0.1.1');
      expect(branch.parent_draft_id).toBe(root.id);
      expect(session.active_draft_id).toBe(branch.id);
    });

    it('returns null when no current session', () => {
      useProgressiveStore.setState({ currentSessionId: null });
      const result = useProgressiveStore.getState().addDraft({
        parent_draft_id: null,
        directive: null,
        change_summary: 'x',
        final_text: 'x',
        final_mix: null,
        reviewing_agent_id: null,
      });
      expect(result).toBeNull();
    });
  });

  // ────────────────────────────────────────────
  // setActiveDraft
  // ────────────────────────────────────────────

  describe('setActiveDraft', () => {
    it('switches active pointer AND updates surface final_deliverable', () => {
      const sid = createProgressiveSession();
      api().setFinalDeliverable('root content', stubMix('root'));
      const root = currentSession(sid).drafts![0];

      api().addDraft({
        parent_draft_id: root.id,
        directive: null,
        change_summary: 'x',
        final_text: 'v0.2 content',
        final_mix: null,
        reviewing_agent_id: 'navigator',
      });

      // Now on v0.2. Switch back to root.
      api().setActiveDraft(root.id);

      const session = currentSession(sid);
      expect(session.active_draft_id).toBe(root.id);
      // FinalCard must see root content, not v0.2
      expect(session.final_deliverable).toBe('root content');
    });
  });

  // ────────────────────────────────────────────
  // promoteDraftToV1
  // ────────────────────────────────────────────

  describe('promoteDraftToV1', () => {
    it('relabels active draft to v1.0 and sets released_draft_id', () => {
      const sid = createProgressiveSession();
      api().setFinalDeliverable('r', stubMix('r'));
      const root = currentSession(sid).drafts![0];

      api().addDraft({
        parent_draft_id: root.id,
        directive: null,
        change_summary: 'x',
        final_text: 'v2',
        final_mix: null,
        reviewing_agent_id: 'navigator',
      });
      const v02 = currentSession(sid).drafts![1];
      expect(v02.version_label).toBe('v0.2');

      api().promoteDraftToV1(v02.id);

      const session = currentSession(sid);
      const promoted = session.drafts!.find((d) => d.id === v02.id)!;
      expect(promoted.version_label).toBe('v1.0');
      expect(session.released_draft_id).toBe(v02.id);
      expect(session.bearing_entries!.find((entry) => entry.draft_id === v02.id)?.version_label).toBe('v1.0');
    });

    it('next main-line child after promotion becomes v1.1', () => {
      const sid = createProgressiveSession();
      api().setFinalDeliverable('r', stubMix('r'));
      const root = currentSession(sid).drafts![0];
      api().addDraft({
        parent_draft_id: root.id,
        directive: null,
        change_summary: 'x',
        final_text: 'v2',
        final_mix: null,
        reviewing_agent_id: 'navigator',
      });
      const v02 = currentSession(sid).drafts![1];

      api().promoteDraftToV1(v02.id); // v0.2 → v1.0

      // Revise on top of promoted node
      api().addDraft({
        parent_draft_id: v02.id,
        directive: null,
        change_summary: 'y',
        final_text: 'v11',
        final_mix: null,
        reviewing_agent_id: 'navigator',
      });
      const child = currentSession(sid).drafts![2];
      expect(child.version_label).toBe('v1.1');
    });
  });

  // ────────────────────────────────────────────
  // getActiveDraftPath
  // ────────────────────────────────────────────

  describe('getActiveDraftPath', () => {
    it('walks main-line chain root → v0.2 → v0.3', () => {
      const sid = createProgressiveSession();
      api().setFinalDeliverable('r', stubMix('r'));
      const root = currentSession(sid).drafts![0];

      api().addDraft({
        parent_draft_id: root.id,
        directive: null,
        change_summary: 'x',
        final_text: 'v2',
        final_mix: null,
        reviewing_agent_id: 'navigator',
      });
      const v02 = currentSession(sid).drafts![1];
      api().addDraft({
        parent_draft_id: v02.id,
        directive: null,
        change_summary: 'y',
        final_text: 'v3',
        final_mix: null,
        reviewing_agent_id: 'navigator',
      });

      const path = api().getActiveDraftPath();
      expect(path.map((d) => d.version_label)).toEqual(['v0.1', 'v0.2', 'v0.3']);
    });

    it('returns only the branch path when switched to an older node', () => {
      const sid = createProgressiveSession();
      api().setFinalDeliverable('r', stubMix('r'));
      const root = currentSession(sid).drafts![0];
      api().addDraft({
        parent_draft_id: root.id,
        directive: null,
        change_summary: 'x',
        final_text: 'v2',
        final_mix: null,
        reviewing_agent_id: 'navigator',
      });
      api().setActiveDraft(root.id);

      const path = api().getActiveDraftPath();
      expect(path.map((d) => d.version_label)).toEqual(['v0.1']);
    });
  });

  // ────────────────────────────────────────────
  // Legacy migration
  // ────────────────────────────────────────────

  describe('migrateSessionDrafts', () => {
    it('synthesizes drafts[0] from legacy final_deliverable on loadSessions', () => {
      const legacy: ProgressiveSession = {
        id: 'legacy-session-1',
        project_id: 'p1',
        problem_text: 'x',
        decision_maker: null,
        phase: 'complete',
        round: 0,
        max_rounds: 3,
        questions: [],
        answers: [],
        snapshots: [],
        workers: [],
        worker_deploy_phase: 'deployed',
        mix: null,
        dm_feedback: null,
        final_deliverable: '# Legacy final',
        final_mix: null,
        created_at: '2026-04-01T00:00:00Z',
        updated_at: '2026-04-02T00:00:00Z',
        // Note: no drafts, no active_draft_id
      };

      // Seed storage mock directly with legacy data
      setStorage('sot_progressive_sessions', [legacy]);

      api().loadSessions();
      const loaded = api().sessions.find((s) => s.id === 'legacy-session-1')!;
      expect(loaded.drafts).toHaveLength(1);
      const migrated = loaded.drafts![0];
      expect(migrated.id).toBe('legacy-legacy-session-1-0');
      expect(migrated.version_label).toBe('v0.1');
      expect(migrated.parent_draft_id).toBeNull();
      expect(migrated.final_text).toBe('# Legacy final');
      expect(loaded.active_draft_id).toBe(migrated.id);
    });

    it('is deterministic across reloads — same ids every time', () => {
      const legacy: ProgressiveSession = {
        id: 'det-1',
        project_id: 'p1',
        problem_text: 'x',
        decision_maker: null,
        phase: 'complete',
        round: 0,
        max_rounds: 3,
        questions: [],
        answers: [],
        snapshots: [],
        workers: [],
        worker_deploy_phase: 'deployed',
        mix: null,
        dm_feedback: null,
        final_deliverable: 'body',
        final_mix: null,
        created_at: '2026-04-01T00:00:00Z',
        updated_at: '2026-04-02T00:00:00Z',
      };
      setStorage('sot_progressive_sessions', [legacy]);

      api().loadSessions();
      const firstLoad = api().sessions[0].drafts![0].id;

      useProgressiveStore.setState({ sessions: [] });
      api().loadSessions();
      const secondLoad = api().sessions[0].drafts![0].id;

      expect(firstLoad).toBe(secondLoad);
    });

    it('skips migration when drafts already exist (idempotent)', () => {
      const sid = createProgressiveSession();
      api().setFinalDeliverable('r', stubMix('r'));
      const firstDraftId = currentSession(sid).drafts![0].id;

      // Simulate a reload by dumping current sessions to storage then reloading.
      setStorage('sot_progressive_sessions', api().sessions);

      useProgressiveStore.setState({ sessions: [] });
      api().loadSessions();

      const afterReload = currentSession(sid).drafts![0].id;
      expect(afterReload).toBe(firstDraftId); // not clobbered by migration
    });
  });

  // ────────────────────────────────────────────
  // Full composite scenario
  // ────────────────────────────────────────────

  describe('full scenario — linear → branch → promote', () => {
    it('builds the expected tree end-to-end', () => {
      const sid = createProgressiveSession();

      // Phase A — first complete
      api().setFinalDeliverable('# draft v1', stubMix('v1'));
      expect(currentSession(sid).drafts).toHaveLength(1);
      expect(currentSession(sid).drafts![0].version_label).toBe('v0.1');

      // Phase B — main-line revision → v0.2
      const v01Id = currentSession(sid).drafts![0].id;
      api().addDraft({
        parent_draft_id: v01Id,
        directive: 'expand ROI',
        change_summary: 'ROI 상세화',
        final_text: '# draft v2',
        final_mix: null,
        reviewing_agent_id: 'navigator',
      });
      expect(currentSession(sid).drafts![1].version_label).toBe('v0.2');

      // Phase C — another main-line revision → v0.3
      const v02Id = currentSession(sid).drafts![1].id;
      api().addDraft({
        parent_draft_id: v02Id,
        directive: 'tighten tone',
        change_summary: '톤 조정',
        final_text: '# draft v3',
        final_mix: null,
        reviewing_agent_id: 'navigator',
      });
      expect(currentSession(sid).drafts![2].version_label).toBe('v0.3');

      // Phase D — branch from v0.1 → v0.1.1
      api().setActiveDraft(v01Id);
      expect(currentSession(sid).final_deliverable).toBe('# draft v1');

      api().addDraft({
        parent_draft_id: v01Id,
        directive: 'alternate angle',
        change_summary: '대안 각도',
        final_text: '# draft alt',
        final_mix: null,
        reviewing_agent_id: 'navigator',
      });
      expect(currentSession(sid).drafts![3].version_label).toBe('v0.1.1');

      // Phase E — promote v0.1.1 → v1.0
      const v011Id = currentSession(sid).drafts![3].id;
      api().promoteDraftToV1(v011Id);
      expect(currentSession(sid).drafts![3].version_label).toBe('v1.0');
      expect(currentSession(sid).released_draft_id).toBe(v011Id);

      // Phase F — next main-line child off v1.0 → v1.1
      api().addDraft({
        parent_draft_id: v011Id,
        directive: 'expand alt',
        change_summary: '확장',
        final_text: '# draft v1.1',
        final_mix: null,
        reviewing_agent_id: 'navigator',
      });
      expect(currentSession(sid).drafts![4].version_label).toBe('v1.1');

      // Final tree shape
      const labels = currentSession(sid).drafts!.map((d) => d.version_label);
      expect(labels).toEqual(['v0.1', 'v0.2', 'v0.3', 'v1.0', 'v1.1']);

      // Active path from v1.1 should be [v0.1, v1.0, v1.1] (skipping v0.2/v0.3)
      const path = api().getActiveDraftPath();
      expect(path.map((d) => d.version_label)).toEqual(['v0.1', 'v1.0', 'v1.1']);
    });
  });
});

// A session can get stuck in worker_deploy_phase='deployed' with workers frozen
// at 'pending' (crash/reload). Counting 'pending' as busy permanently locked
// branching, so "이 길 가보기" and map forks went dead. Only genuinely in-flight
// workers ('running'/'ai_preparing') should lock.
describe('isBranchingLocked — pending workers must not lock branching (fix #2)', () => {
  const mkWorker = (status: string): WorkerTask => ({
    id: `w-${status}`, task: 't', who: 'ai', expected_output: 'o', status,
    persona: null, level: 'junior', stream_text: '', result: null, human_input: null,
    error: null, approved: null, completion_note: null, started_at: null, completed_at: null,
  } as WorkerTask);

  const setWorkers = (sid: string, deployPhase: string, statuses: string[]) =>
    useProgressiveStore.setState({
      sessions: api().sessions.map((s) => s.id === sid
        ? { ...s, phase: 'conversing', worker_deploy_phase: deployPhase, workers: statuses.map(mkWorker) }
        : s),
    } as never);

  it('does NOT lock when deployed workers are only pending (stuck/crash-reset session)', () => {
    const sid = createProgressiveSession();
    setWorkers(sid, 'deployed', ['pending', 'pending']);
    expect(api().isBranchingLocked()).toBe(false);
  });

  it('still locks while a worker is genuinely in-flight', () => {
    const sid = createProgressiveSession();
    setWorkers(sid, 'deployed', ['pending', 'running']);
    expect(api().isBranchingLocked()).toBe(true);
  });

  it('does not lock before deploy', () => {
    const sid = createProgressiveSession();
    setWorkers(sid, 'none', ['pending']);
    expect(api().isBranchingLocked()).toBe(false);
  });
});

// #3 reproduction: picking a node in the full 해도 → "이 지점에서 항해" calls
// navigateToCheckpoint. This proves the FORK MECHANISM itself works (state forks +
// rewinds) — so the user-visible "연결이 안 됨" was purely that VoyageChart could
// not close its enclosing Modal (now fixed via onNavigated), NOT a broken fork.
describe('navigateToCheckpoint forks + rewinds (chart fork mechanism)', () => {
  const cpState = (): VoyageCheckpointState => ({
    phase: 'conversing', round: 0, questions: [], answers: [], snapshots: [],
    workers: [], worker_deploy_phase: 'none', mix: null, dm_feedback: null,
    final_deliverable: null, final_mix: null, user_notes: null, decision_maker: null, lead_synthesis: null,
  });
  const seed = (): ProgressiveSession => ({
    id: 'voy-1', project_id: 'p1', problem_text: 'x', decision_maker: null,
    phase: 'conversing', round: 1, max_rounds: 3, questions: [], answers: [],
    snapshots: [], workers: [], worker_deploy_phase: 'none', mix: null, dm_feedback: null,
    final_deliverable: null, final_mix: null, created_at: 'a', updated_at: 'b',
    checkpoints: [
      { id: 'c1', parent_id: null, stage: 'origin', label: '출발', created_at: '2026-01-01T00:00:01.000Z', state_snapshot: cpState() },
      { id: 'c2', parent_id: 'c1', stage: 'briefing', label: '준비', created_at: '2026-01-01T00:00:02.000Z', state_snapshot: cpState() },
    ],
    active_checkpoint_id: 'c2',
    branches: [{ id: 'b1', name: '본 항로', head_checkpoint_id: 'c2', forked_from_checkpoint_id: null, color: '#2d4a7c', created_at: 'a' }],
    active_branch_id: 'b1',
  });

  it('picking an ancestor checkpoint forks a new course and rewinds the active checkpoint', () => {
    setStorage('sot_progressive_sessions', [seed()]);
    api().loadSessions();
    useProgressiveStore.setState({ currentSessionId: 'voy-1' });

    const before = api().sessions.find((s) => s.id === 'voy-1')!;
    expect(before.branches!.length).toBe(1);

    api().navigateToCheckpoint('c1'); // c1 is on the active path (ancestor) → fork

    const after = api().sessions.find((s) => s.id === 'voy-1')!;
    expect(after.branches!.length).toBe(2);          // a new course was created
    expect(after.active_checkpoint_id).toBe('c1');   // live state rewound to the pick
  });
});
