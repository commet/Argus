/**
 * Captain's-seat store behavior — manual designation of AI crew.
 *
 * Guards the two store fixes behind the "출항 전 선원 배치" UI:
 *  1. replaceWorkerPersona PRESERVES the XP/level wiring when the picked
 *     persona is a real Agent (previously it always cleared agent_id, silently
 *     severing the swapped-in worker from growth), and stamps a "직접 지정"
 *     rationale. Custom personas (no matching agent) drop agent_id as expected.
 *  2. addWorkerToGroup does NOT inherit the seed worker's assignment_reason —
 *     a manual addition carries the "직접 추가" badge, not the auto rationale.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// ─── Mocks (before store import) ───

vi.mock('@/lib/db', () => ({ upsertToSupabase: vi.fn(), loadAndMerge: vi.fn(() => Promise.resolve([])) }));
vi.mock('@/lib/supabase', () => ({
  supabase: { from: vi.fn(), auth: { getSession: vi.fn(() => Promise.resolve({ data: { session: null } })) }, channel: vi.fn(() => ({ on: vi.fn().mockReturnThis(), subscribe: vi.fn() })), removeChannel: vi.fn() },
  getCurrentUserId: vi.fn(() => Promise.resolve(null)),
}));
vi.mock('@/lib/storage', () => {
  let store: Record<string, unknown> = {};
  return {
    getStorage: vi.fn((key: string, fallback: unknown) => store[key] ?? fallback),
    setStorage: vi.fn((key: string, value: unknown) => { store[key] = value; }),
    STORAGE_KEYS: { PROGRESSIVE_SESSIONS: 'sot_progressive_sessions', SETTINGS: 'sot_settings' },
    __resetStore: () => { store = {}; },
  };
});

let _idCounter = 0;
vi.mock('@/lib/uuid', () => ({ generateId: vi.fn(() => `gen-${++_idCounter}`) }));
vi.mock('@/lib/analytics', () => ({ track: vi.fn() }));
vi.mock('@/lib/i18n', () => ({ getCurrentLanguage: vi.fn(() => 'ko') }));

// A single real agent the persona pool can match against.
const REAL_AGENT = { id: 'real-agent', name: '소피', level: 4 };
vi.mock('@/stores/useAgentStore', () => ({
  useAgentStore: {
    getState: () => ({
      agents: [], loadAgents: vi.fn(), getUnlockedAgents: () => [],
      getAgent: (id: string) => (id === REAL_AGENT.id ? REAL_AGENT : undefined),
      assignAgentToTask: () => REAL_AGENT, recordActivity: vi.fn(),
    }),
  },
}));

vi.mock('@/lib/observation-engine', () => ({ onTaskApproved: vi.fn(), onTaskRejected: vi.fn() }));
vi.mock('@/lib/orchestrator', () => ({ planWorkers: () => ({ classification: {}, workers: [], stages: [] }) }));
vi.mock('@/lib/lead-agent', () => ({ selectLeadAgent: () => null }));
vi.mock('@/lib/agent-quality', () => ({ computeQualityXP: () => 0 }));
vi.mock('@/lib/agent-adapters', () => ({ agentToWorkerPersona: () => null }));
vi.mock('@/lib/agent-skills', () => ({ numericLevelToAgentLevel: (lv: number) => (lv >= 5 ? 'guru' : lv >= 3 ? 'senior' : 'junior') }));
vi.mock('@/stores/usePersonaStore', () => ({ usePersonaStore: { getState: () => ({ personas: [] }) } }));

// ─── Imports after mocks ───

import { useProgressiveStore } from '@/stores/useProgressiveStore';
import { __resetStore } from '@/lib/storage';
import type { WorkerTask, WorkerPersona, ProgressiveSession } from '@/stores/types';

const api = () => useProgressiveStore.getState();
const persona = (id: string, name: string): WorkerPersona => ({
  id, name, role: '역할', expertise: '전문', tone: '톤', emoji: '🧪', color: '#000', keywords: [],
} as WorkerPersona);

function seedWorker(over: Partial<WorkerTask> = {}): WorkerTask {
  return {
    id: 'w1', step_index: 0, task: '시장 조사', task_group_id: 'g1',
    added_manually: false, original_task: '시장 조사', who: 'ai',
    expected_output: '보고서', status: 'pending', persona: persona('old-persona', '기존'),
    level: 'junior', agent_id: 'old-agent', stream_text: '', result: null, human_input: null,
    error: null, approved: null, completion_note: null, started_at: null, completed_at: null,
    agent_type: 'ai', assignment_reason: '시장 분석에 가장 적합 · 다음 후보 마커스', ...over,
  } as WorkerTask;
}

/** Create a current session carrying the given workers. */
function startWith(workers: WorkerTask[]): string {
  const id = api().createSession('proj-1', '북미 진출');
  useProgressiveStore.setState({ currentSessionId: id });
  const sessions = api().sessions.map(s => s.id === id ? { ...s, workers } : s);
  useProgressiveStore.setState({ sessions });
  return id;
}
const cur = (id: string): ProgressiveSession => api().sessions.find(s => s.id === id)!;

describe("captain's-seat: replaceWorkerPersona", () => {
  beforeEach(() => {
    _idCounter = 0;
    (__resetStore as () => void)();
    useProgressiveStore.setState({ sessions: [], currentSessionId: null });
  });

  it('preserves agent_id + level when swapping in a real Agent', () => {
    const sid = startWith([seedWorker()]);
    api().replaceWorkerPersona('w1', persona('real-agent', '소피'));
    const w = cur(sid).workers.find(x => x.id === 'w1')!;
    expect(w.agent_id).toBe('real-agent');   // ← was silently cleared before the fix
    expect(w.level).toBe('senior');          // numericLevelToAgentLevel(4)
    expect(w.persona?.id).toBe('real-agent');
  });

  it('stamps a "직접 지정" rationale + user_assigned marker and resets run state', () => {
    const sid = startWith([seedWorker({ status: 'done', result: '끝', approved: true })]);
    api().replaceWorkerPersona('w1', persona('real-agent', '소피'));
    const w = cur(sid).workers.find(x => x.id === 'w1')!;
    expect(w.assignment_reason).toBe('직접 지정한 팀원');
    expect(w.user_assigned).toBe(true);   // ← drives the ship's-log 'helm' waypoint
    expect(w.status).toBe('pending');
    expect(w.result).toBeNull();
    expect(w.approved).toBeNull();
  });

  it('drops agent_id for a custom persona with no matching Agent', () => {
    const sid = startWith([seedWorker()]);
    api().replaceWorkerPersona('w1', persona('custom-x', '커스텀'));
    const w = cur(sid).workers.find(x => x.id === 'w1')!;
    expect(w.agent_id).toBeUndefined();
    expect(w.level).toBe('junior');
  });

  it('is a no-op when the picked persona is already held by a group sibling', () => {
    // Two members in group g1: w1 (기존) + w2 (소피). Swapping w1 → 소피 would
    // duplicate within the group, so the guard rejects it.
    const sid = startWith([
      seedWorker({ id: 'w1', persona: persona('old-persona', '기존') }),
      seedWorker({ id: 'w2', persona: persona('real-agent', '소피'), assignment_reason: undefined }),
    ]);
    api().replaceWorkerPersona('w1', persona('real-agent', '소피'));
    const w1 = cur(sid).workers.find(x => x.id === 'w1')!;
    expect(w1.persona?.id).toBe('old-persona'); // unchanged — swap was blocked
  });
});

describe("captain's-seat: updateGroupTask invalidates stale rationale", () => {
  beforeEach(() => {
    _idCounter = 0;
    (__resetStore as () => void)();
    useProgressiveStore.setState({ sessions: [], currentSessionId: null });
  });

  it('clears assignment_reason when the task text is edited', () => {
    const sid = startWith([seedWorker()]); // has an auto rationale
    api().updateGroupTask('g1', '재무 모델을 만든다');
    const w = cur(sid).workers.find(x => x.id === 'w1')!;
    expect(w.task).toBe('재무 모델을 만든다');
    expect(w.assignment_reason).toBeUndefined(); // no stale "시장 분석에 가장 적합"
  });
});

describe("axis ①: setGroupTrack — discoverable human collaboration", () => {
  beforeEach(() => {
    _idCounter = 0;
    (__resetStore as () => void)();
    useProgressiveStore.setState({ sessions: [], currentSessionId: null });
  });

  it('AI → self: becomes the captain\'s own call (no agent, no persona)', () => {
    const sid = startWith([seedWorker()]);
    expect(api().setGroupTrack('g1', 'self')).toBe(true);
    const w = cur(sid).workers.find(x => x.id === 'w1')!;
    expect(w.agent_type).toBe('self');
    expect(w.agent_id).toBeUndefined();
    expect(w.persona).toBeNull();
    expect(w.assignment_reason).toBeUndefined();
  });

  it('AI → human: seeds the question from the task and drops the agent', () => {
    const sid = startWith([seedWorker({ task: 'CTO에게 기술 타당성 확인' })]);
    expect(api().setGroupTrack('g1', 'human')).toBe(true);
    const w = cur(sid).workers.find(x => x.id === 'w1')!;
    expect(w.agent_type).toBe('human');
    expect(w.agent_id).toBeUndefined();
    expect(w.question_to_human).toBe('CTO에게 기술 타당성 확인');
  });

  it('self → AI: assigns a fresh agent and rewires growth', () => {
    const sid = startWith([seedWorker({ agent_type: 'self', who: 'human', persona: null, agent_id: undefined, assignment_reason: undefined })]);
    expect(api().setGroupTrack('g1', 'ai')).toBe(true);
    const w = cur(sid).workers.find(x => x.id === 'w1')!;
    expect(w.agent_type).toBe('ai');
    expect(w.agent_id).toBe('real-agent'); // from assignAgentToTask
    expect(w.level).toBe('senior');        // numericLevelToAgentLevel(4)
  });

  it('blocks leaving the AI track while multiple lenses share the task', () => {
    const sid = startWith([
      seedWorker({ id: 'w1', persona: persona('p1', 'A') }),
      seedWorker({ id: 'w2', persona: persona('p2', 'B'), assignment_reason: undefined }),
    ]);
    expect(api().setGroupTrack('g1', 'self')).toBe(false);
    expect(cur(sid).workers.every(w => w.agent_type === 'ai')).toBe(true);
  });

  it('is a no-op when the track is already current', () => {
    const sid = startWith([seedWorker()]);
    expect(api().setGroupTrack('g1', 'ai')).toBe(false);
  });

  it('clears stale ai_scope/self_scope/decision on conversion (no surprise AI pre-pass)', () => {
    const sid = startWith([seedWorker({
      ai_scope: 'AI가 초안 작성', self_scope: '톤 결정', decision: '질문: A vs B',
    })]);
    api().setGroupTrack('g1', 'self');
    const w = cur(sid).workers.find(x => x.id === 'w1')!;
    expect(w.agent_type).toBe('self');
    expect(w.ai_scope).toBeUndefined();   // ← would otherwise trigger 'ai_preparing' on deploy
    expect(w.self_scope).toBeUndefined();
    expect(w.decision).toBeUndefined();
  });
});

describe("axis ②: verification gate selectors", () => {
  beforeEach(() => {
    _idCounter = 0;
    (__resetStore as () => void)();
    useProgressiveStore.setState({ sessions: [], currentSessionId: null });
  });

  const done = (id: string, approved: boolean | null, result: string | null = '결과'): WorkerTask =>
    seedWorker({ id, task_group_id: id, status: 'done', result, approved });

  it('unreviewedWorkers = done + result + approved==null only', () => {
    startWith([
      done('a', null),          // unreviewed ✓
      done('b', true),          // accepted — excluded
      done('c', false),         // rejected — excluded
      done('d', null, null),    // no result — excluded
      seedWorker({ id: 'e', task_group_id: 'e', status: 'running', approved: null }), // not done
    ]);
    const ids = api().unreviewedWorkers().map(w => w.id);
    expect(ids).toEqual(['a']);
  });

  it('approveAllPending accepts every unreviewed worker', () => {
    const sid = startWith([done('a', null), done('b', null), done('c', false)]);
    api().approveAllPending();
    const ws = cur(sid).workers;
    expect(ws.find(w => w.id === 'a')!.approved).toBe(true);
    expect(ws.find(w => w.id === 'b')!.approved).toBe(true);
    expect(ws.find(w => w.id === 'c')!.approved).toBe(false); // rejected stays rejected
    expect(api().unreviewedWorkers()).toHaveLength(0);
  });
});

describe("captain's-seat: addWorkerToGroup", () => {
  beforeEach(() => {
    _idCounter = 0;
    (__resetStore as () => void)();
    useProgressiveStore.setState({ sessions: [], currentSessionId: null });
  });

  it('does not inherit the seed worker\'s assignment_reason', () => {
    const sid = startWith([seedWorker()]);
    const newId = api().addWorkerToGroup('g1', persona('real-agent', '소피'));
    expect(newId).toBeTruthy();
    const added = cur(sid).workers.find(x => x.id === newId)!;
    expect(added.assignment_reason).toBeUndefined();  // badge, not stale auto-reason
    expect(added.added_manually).toBe(true);
    expect(added.agent_id).toBe('real-agent');        // matched agent still wired
  });
});
