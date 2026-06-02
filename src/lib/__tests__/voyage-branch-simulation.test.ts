/**
 * Voyage Branch Layer Simulation — store-level exercise of the first-class
 * branch layer built over the checkpoint tree (Phase 1).
 *
 * Validates:
 * - recordCheckpoint at origin births the trunk "main course" branch
 * - subsequent recordCheckpoint advances the active branch head, kept in sync
 *   with active_checkpoint_id (no drift)
 * - migrateBranches synthesizes a main branch on load for legacy sessions that
 *   have checkpoints but no branches[]
 * - migration is idempotent (deterministic id, no duplication across reloads)
 * - sessions with no checkpoints are left untouched (lazy branch creation)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// ─── Mocks (must be before store imports) ───

vi.mock('@/lib/db', () => ({
  upsertToSupabase: vi.fn(),
  loadAndMerge: vi.fn(() => Promise.resolve([])),
}));

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
    __seedStore: (key: string, value: unknown) => { store[key] = value; },
    __resetStore: () => { store = {}; },
  };
});

let _idCounter = 0;
vi.mock('@/lib/uuid', () => ({
  generateId: vi.fn(() => `gen-${++_idCounter}`),
}));

vi.mock('@/lib/analytics', () => ({ track: vi.fn() }));

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

vi.mock('@/lib/observation-engine', () => ({ onTaskApproved: vi.fn(), onTaskRejected: vi.fn() }));
vi.mock('@/lib/orchestrator', () => ({ planWorkers: () => ({ classification: {}, workers: [], stages: [] }) }));
vi.mock('@/lib/lead-agent', () => ({ selectLeadAgent: () => null }));
vi.mock('@/lib/agent-quality', () => ({ computeQualityXP: () => 0 }));
vi.mock('@/lib/agent-adapters', () => ({ agentToWorkerPersona: () => null }));
vi.mock('@/lib/agent-skills', () => ({ numericLevelToAgentLevel: () => 'junior' }));
vi.mock('@/stores/usePersonaStore', () => ({ usePersonaStore: { getState: () => ({ personas: [] }) } }));

// ─── Imports after mocks ───

import { useProgressiveStore } from '@/stores/useProgressiveStore';
import { __resetStore, __seedStore, STORAGE_KEYS } from '@/lib/storage';
import type { ProgressiveSession, VoyageCheckpoint, WorkerTask } from '@/stores/types';

const api = () => useProgressiveStore.getState();

/** Create a session and make it current (recordCheckpoint reads currentSessionId). */
const startSession = (): string => {
  const id = api().createSession('proj-1', '북미 시장 진출 전략');
  useProgressiveStore.setState({ currentSessionId: id });
  return id;
};

const session = (id: string): ProgressiveSession => api().sessions.find((s) => s.id === id)!;

/** Minimal legacy session: has a checkpoint chain but no branches[]. */
const legacyCheckpoint = (id: string, parent: string | null): VoyageCheckpoint => ({
  id,
  parent_id: parent,
  stage: 'origin',
  label: id,
  created_at: `2026-01-01T00:00:0${id.length}.000Z`,
  state_snapshot: {
    phase: 'conversing', round: 0, questions: [], answers: [], snapshots: [],
    workers: [], worker_deploy_phase: 'none', mix: null, dm_feedback: null,
    final_deliverable: null, final_mix: null, user_notes: null,
    decision_maker: null, lead_synthesis: null,
  },
});

describe('Voyage branch layer', () => {
  beforeEach(() => {
    _idCounter = 0;
    (__resetStore as () => void)();
    useProgressiveStore.setState({ sessions: [], currentSessionId: null });
  });

  describe('recordCheckpoint branch maintenance', () => {
    it('births the trunk "main course" branch at the origin checkpoint', () => {
      const sid = startSession();
      const cp = api().recordCheckpoint('origin');
      expect(cp).not.toBeNull();

      const s = session(sid);
      expect(s.branches).toHaveLength(1);
      const main = s.branches![0];
      expect(main.forked_from_checkpoint_id).toBeNull();
      expect(main.status).toBe('sailing');
      expect(main.head_checkpoint_id).toBe(cp!.id);
      expect(s.active_branch_id).toBe(main.id);
      expect(s.active_checkpoint_id).toBe(cp!.id);
    });

    it('advances the active branch head on each subsequent checkpoint, in sync with active_checkpoint_id', () => {
      const sid = startSession();
      api().recordCheckpoint('origin');
      const cp2 = api().recordCheckpoint('briefing');
      const cp3 = api().recordCheckpoint('crew_set');

      const s = session(sid);
      expect(s.branches).toHaveLength(1); // still one course-line — no fork yet
      expect(s.branches![0].head_checkpoint_id).toBe(cp3!.id);
      expect(s.active_checkpoint_id).toBe(cp3!.id);
      // Tree linkage intact: cp3.parent = cp2, cp2.parent = cp1
      const cps = s.checkpoints!;
      expect(cps).toHaveLength(3);
      expect(cps[2].parent_id).toBe(cp2!.id);
    });
  });

  describe('Chronicler wiring (recordCheckpoint → waypoints)', () => {
    it('appends a departure waypoint at the origin checkpoint', () => {
      const sid = startSession();
      const cp = api().recordCheckpoint('origin');
      const s = session(sid);
      expect(s.waypoints).toHaveLength(1);
      expect(s.waypoints![0].type).toBe('departure');
      expect(s.waypoints![0].checkpoint_id).toBe(cp!.id);
    });

    it('does not append a waypoint for a non-salient process stage (crew_set)', () => {
      const sid = startSession();
      api().recordCheckpoint('origin');       // 1 waypoint (departure)
      api().recordCheckpoint('crew_set');     // suppressed
      const s = session(sid);
      expect(s.waypoints).toHaveLength(1);
    });
  });

  describe('fork / switch / anchor actions', () => {
    it('forkBranch creates a sibling course-line from a checkpoint, preserving the source branch', () => {
      const sid = startSession();
      const c1 = api().recordCheckpoint('origin')!;
      const c2 = api().recordCheckpoint('briefing')!;
      const mainId = session(sid).active_branch_id!;

      const forkId = api().forkBranch(c1.id, 'Chatbot path');
      expect(forkId).not.toBeNull();

      const s = session(sid);
      expect(s.branches).toHaveLength(2);
      const fork = s.branches!.find(b => b.id === forkId)!;
      expect(fork.forked_from_checkpoint_id).toBe(c1.id);
      expect(fork.head_checkpoint_id).toBe(c1.id);    // sits at the fork point until it sails
      expect(s.active_branch_id).toBe(forkId);         // fork is now active
      expect(s.active_checkpoint_id).toBe(c1.id);      // live state restored to fork point

      // Source branch is untouched — still points at its own leaf (c2).
      const main = s.branches!.find(b => b.id === mainId)!;
      expect(main.head_checkpoint_id).toBe(c2.id);
    });

    it('sailing a fork attaches new checkpoints as siblings (real divergence)', () => {
      const sid = startSession();
      const c1 = api().recordCheckpoint('origin')!;
      api().recordCheckpoint('briefing'); // main continues to c2
      const forkId = api().forkBranch(c1.id)!;
      const c3 = api().recordCheckpoint('briefing')!; // sails the fork

      const s = session(sid);
      expect(c3.parent_id).toBe(c1.id);                       // sibling of c2 under c1
      expect(s.branches!.find(b => b.id === forkId)!.head_checkpoint_id).toBe(c3.id);
      expect(s.active_checkpoint_id).toBe(c3.id);
    });

    it('switchBranch flips active state atomically and is reversible', () => {
      const sid = startSession();
      const c1 = api().recordCheckpoint('origin')!;
      const c2 = api().recordCheckpoint('briefing')!;
      const mainId = session(sid).active_branch_id!;
      const forkId = api().forkBranch(c1.id)!;

      // back to main
      api().switchBranch(mainId);
      let s = session(sid);
      expect(s.active_branch_id).toBe(mainId);
      expect(s.active_checkpoint_id).toBe(c2.id); // restored to main's head

      // and back to the fork
      api().switchBranch(forkId);
      s = session(sid);
      expect(s.active_branch_id).toBe(forkId);
      expect(s.active_checkpoint_id).toBe(c1.id);
    });

    it('switchBranch to the active branch or an unknown id is a no-op', () => {
      const sid = startSession();
      api().recordCheckpoint('origin');
      const activeId = session(sid).active_branch_id!;
      api().switchBranch(activeId);          // same branch
      api().switchBranch('does-not-exist');  // unknown
      expect(session(sid).active_branch_id).toBe(activeId);
    });

    it('anchorBranch marks the chosen course anchored and retires the rest (preserved)', () => {
      const sid = startSession();
      const c1 = api().recordCheckpoint('origin')!;
      api().recordCheckpoint('briefing');
      const mainId = session(sid).active_branch_id!;
      const forkId = api().forkBranch(c1.id)!;

      api().anchorBranch(forkId);
      const s = session(sid);
      expect(s.branches!.find(b => b.id === forkId)!.status).toBe('anchored');
      expect(s.branches!.find(b => b.id === mainId)!.status).toBe('abandoned');
      expect(s.branches).toHaveLength(2); // nothing deleted
    });
  });

  describe('quota guards (Phase 6)', () => {
    it('caps branches per session at 8 and refuses further forks', () => {
      const sid = startSession();
      const c1 = api().recordCheckpoint('origin')!; // main = 1 branch
      const results = Array.from({ length: 10 }, () => api().forkBranch(c1.id));
      const s = session(sid);
      expect(s.branches!.length).toBe(8);                       // capped
      expect(results.filter(Boolean).length).toBe(7);          // 1 main + 7 forks = 8
      expect(results[7]).toBeNull();                            // the 8th fork is blocked
    });

    it('strips transient stream_text from checkpoint snapshots', () => {
      const sid = startSession();
      // Seed a worker carrying heavy streaming text directly (initWorkers needs
      // the full agent stack; we only exercise recordCheckpoint's strip here).
      const worker = { id: 'w1', stream_text: '아주 긴 스트리밍 텍스트'.repeat(50) } as unknown as WorkerTask;
      useProgressiveStore.setState(st => ({
        sessions: st.sessions.map(s => (s.id === sid ? { ...s, workers: [worker] } : s)),
      }));
      const cp = api().recordCheckpoint('crew_done')!;
      expect(cp.state_snapshot.workers[0].id).toBe('w1');
      expect(cp.state_snapshot.workers[0].stream_text).toBe('');
    });
  });

  describe('navigateToCheckpoint (chart node resolution)', () => {
    it('switches to the branch that owns a checkpoint off the active course', () => {
      const sid = startSession();
      const c1 = api().recordCheckpoint('origin')!;
      const c2 = api().recordCheckpoint('briefing')!;   // main → c2
      const mainId = session(sid).active_branch_id!;
      api().forkBranch(c1.id);                            // now on fork (lineage [c1])

      api().navigateToCheckpoint(c2.id);                 // c2 belongs to main
      expect(session(sid).active_branch_id).toBe(mainId);
      expect(session(sid).active_checkpoint_id).toBe(c2.id);
    });

    it('forks from a point on the active course (go back & diverge)', () => {
      const sid = startSession();
      const c1 = api().recordCheckpoint('origin')!;
      api().recordCheckpoint('briefing'); // main → c2, active = main, lineage [c1,c2]
      const before = session(sid).branches!.length;

      api().navigateToCheckpoint(c1.id);  // c1 is on the active course → fork
      const s = session(sid);
      expect(s.branches!.length).toBe(before + 1);
      expect(s.active_checkpoint_id).toBe(c1.id);
      expect(s.active_branch_id).not.toBe(s.branches![0].id); // moved onto the new fork
    });

    it('is a no-op when navigating to the current position', () => {
      const sid = startSession();
      const c1 = api().recordCheckpoint('origin')!;
      const branchesBefore = session(sid).branches!.length;
      api().navigateToCheckpoint(c1.id); // already active
      expect(session(sid).branches!.length).toBe(branchesBefore);
    });
  });

  describe('migrateBranches on load', () => {
    it('synthesizes a main branch for a legacy session with checkpoints but no branches', () => {
      const legacy: ProgressiveSession = {
        ...session(startSession()),
        checkpoints: [legacyCheckpoint('c1', null), legacyCheckpoint('c2', 'c1')],
        active_checkpoint_id: 'c2',
        branches: undefined,
        active_branch_id: undefined,
      };
      __seedStore(STORAGE_KEYS.PROGRESSIVE_SESSIONS, [legacy]);
      useProgressiveStore.setState({ sessions: [], currentSessionId: null });

      api().loadSessions();
      const s = api().sessions.find((x) => x.id === legacy.id)!;
      expect(s.branches).toHaveLength(1);
      expect(s.branches![0].id).toBe(`main-${legacy.id}`);
      expect(s.branches![0].head_checkpoint_id).toBe('c2'); // = active_checkpoint_id
      expect(s.active_branch_id).toBe(`main-${legacy.id}`);
    });

    it('is idempotent — reloading does not duplicate or move the branch', () => {
      const legacy: ProgressiveSession = {
        ...session(startSession()),
        checkpoints: [legacyCheckpoint('c1', null)],
        active_checkpoint_id: 'c1',
        branches: undefined,
        active_branch_id: undefined,
      };
      __seedStore(STORAGE_KEYS.PROGRESSIVE_SESSIONS, [legacy]);
      useProgressiveStore.setState({ sessions: [], currentSessionId: null });

      api().loadSessions();
      const first = api().sessions.find((x) => x.id === legacy.id)!.branches!;
      // Persist current state back and reload
      __seedStore(STORAGE_KEYS.PROGRESSIVE_SESSIONS, api().sessions);
      api().loadSessions();
      const second = api().sessions.find((x) => x.id === legacy.id)!.branches!;
      expect(second).toHaveLength(1);
      expect(second[0].id).toBe(first[0].id);
      expect(second[0].head_checkpoint_id).toBe(first[0].head_checkpoint_id);
    });

    it('leaves a checkpoint-less session untouched (branch created lazily later)', () => {
      const fresh: ProgressiveSession = {
        ...session(startSession()),
        checkpoints: [],
        branches: undefined,
        active_branch_id: undefined,
      };
      __seedStore(STORAGE_KEYS.PROGRESSIVE_SESSIONS, [fresh]);
      useProgressiveStore.setState({ sessions: [], currentSessionId: null });

      api().loadSessions();
      const s = api().sessions.find((x) => x.id === fresh.id)!;
      expect(s.branches).toBeUndefined();
      expect(s.active_branch_id).toBeUndefined();
    });
  });
});
