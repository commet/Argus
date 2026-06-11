/**
 * Store Mutations Simulation — Zustand 스토어 mutation 함수 시뮬레이션
 *
 * 핵심 검증:
 * - localStorage-first 동기 상태 변경이 즉시 반영되는가
 * - CRUD 연산 후 상태가 정확한가 (create/update/delete)
 * - 중첩 데이터 조작 (feedback_logs, steps, refs)이 올바른가
 * - Supabase fire-and-forget 호출이 발생하는가
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// ─── Mocks (MUST be before store imports) ───

vi.mock('@/lib/db', () => ({
  insertToSupabase: vi.fn(),
  upsertToSupabase: vi.fn(),
  deleteFromSupabase: vi.fn(),
  softDeleteFromSupabase: vi.fn(),
  updateInSupabase: vi.fn(),
  loadAndMerge: vi.fn(() => Promise.resolve([])),
}));

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({ select: vi.fn(() => ({ data: [], error: null })) })),
    auth: { getSession: vi.fn(() => Promise.resolve({ data: { session: null } })) },
  },
}));

vi.mock('@/lib/storage', () => {
  let store: Record<string, unknown> = {};
  return {
    getStorage: vi.fn((key: string, fallback: unknown) => store[key] ?? fallback),
    setStorage: vi.fn((key: string, value: unknown) => { store[key] = value; }),
    removeStorage: vi.fn((key: string) => { delete store[key]; }),
    STORAGE_KEYS: {
      PERSONAS: 'sot_personas',
      FEEDBACK_HISTORY: 'sot_feedback_history',
      REFRAME_LIST: 'sot_reframe_list',
      RECAST_LIST: 'sot_recast_list',
      REFINE_LOOPS: 'sot_refine_loops',
      PROJECTS: 'sot_projects',
      JUDGMENTS: 'sot_judgments',
      SETTINGS: 'sot_settings',
    },
    __resetStore: () => { store = {}; },
  };
});

vi.mock('@/lib/uuid', () => {
  let counter = 0;
  return {
    generateId: vi.fn(() => `test-id-${++counter}`),
    __resetCounter: () => { counter = 0; },
  };
});

vi.mock('@/lib/analytics', () => ({
  track: vi.fn(),
}));

vi.mock('@/lib/convergence', () => ({
  checkLoopConvergence: vi.fn(() => ({
    converged: false,
    critical_remaining: 0,
    approval_met: 0,
    approval_total: 0,
    total_issues: 0,
    issue_trend: [],
    guidance: '',
  })),
}));

vi.mock('@/lib/auth', () => ({
  getCurrentUser: vi.fn(() => null),
}));

// ─── Store imports (after mocks) ───

import { usePersonaStore } from '@/stores/usePersonaStore';
import { useReframeStore } from '@/stores/useReframeStore';
import { useRecastStore } from '@/stores/useRecastStore';
import { useRefineStore } from '@/stores/useRefineStore';
import { useProjectStore } from '@/stores/useProjectStore';
import { upsertToSupabase, softDeleteFromSupabase } from '@/lib/db';
import { setStorage, __resetStore } from '@/lib/storage';

const mockUpsert = vi.mocked(upsertToSupabase);
const mockDelete = vi.mocked(softDeleteFromSupabase);
const mockSetStorage = vi.mocked(setStorage);
const resetStorage = __resetStore as () => void;

// ─── Helpers ───

function resetStore<T>(useStore: { setState: (state: Partial<T>) => void }, initial: Partial<T>) {
  useStore.setState(initial as T);
}

// ═══════════════════════════════════════════════════════════
// usePersonaStore
// ═══════════════════════════════════════════════════════════

describe('usePersonaStore mutations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetStorage();
    resetStore(usePersonaStore, { personas: [], feedbackHistory: [] });
  });

  it('createPersona — adds persona to state with id and timestamps', () => {
    const id = usePersonaStore.getState().createPersona({
      name: '테스트 인물',
      role: 'PM',
      influence: 'high',
    });

    const state = usePersonaStore.getState();
    expect(state.personas).toHaveLength(1);

    const persona = state.personas[0];
    expect(persona.id).toBe(id);
    expect(persona.name).toBe('테스트 인물');
    expect(persona.role).toBe('PM');
    expect(persona.influence).toBe('high');
    expect(persona.feedback_logs).toEqual([]);
    expect(persona.created_at).toBeTruthy();
    expect(persona.updated_at).toBeTruthy();

    // Supabase fire-and-forget
    expect(mockUpsert).toHaveBeenCalledWith('personas', expect.objectContaining({ id }));
    // localStorage sync
    expect(mockSetStorage).toHaveBeenCalledWith('sot_personas', expect.any(Array));
  });

  it('updatePersona — updates specific fields, preserves others', () => {
    // Freeze time for create
    const createTime = '2026-03-01T00:00:00.000Z';
    vi.spyOn(Date.prototype, 'toISOString').mockReturnValueOnce(createTime).mockReturnValueOnce(createTime);

    const id = usePersonaStore.getState().createPersona({
      name: 'Original',
      role: 'CEO',
      influence: 'high',
    });
    vi.clearAllMocks();

    // Restore real toISOString for update (will produce a different timestamp)
    vi.spyOn(Date.prototype, 'toISOString').mockRestore();

    usePersonaStore.getState().updatePersona(id, { name: 'Updated', role: 'CTO' });

    const persona = usePersonaStore.getState().personas[0];
    expect(persona.name).toBe('Updated');
    expect(persona.role).toBe('CTO');
    expect(persona.influence).toBe('high'); // preserved
    expect(persona.created_at).toBe(createTime); // preserved
    expect(persona.updated_at).not.toBe(createTime); // refreshed

    expect(mockUpsert).toHaveBeenCalledTimes(1);
  });

  it('deletePersona — removes persona from state', () => {
    const id1 = usePersonaStore.getState().createPersona({ name: 'A' });
    const id2 = usePersonaStore.getState().createPersona({ name: 'B' });
    vi.clearAllMocks();

    usePersonaStore.getState().deletePersona(id1);

    const state = usePersonaStore.getState();
    expect(state.personas).toHaveLength(1);
    expect(state.personas[0].id).toBe(id2);
    expect(mockDelete).toHaveBeenCalledWith('personas', id1);
  });

  it('addFeedbackLog — appends log to persona feedback_logs array', () => {
    const id = usePersonaStore.getState().createPersona({ name: 'Feedback Target' });
    vi.clearAllMocks();

    usePersonaStore.getState().addFeedbackLog(id, {
      date: '2026-03-27',
      context: 'Q1 리뷰',
      feedback: '숫자 근거를 더 요구함',
    });

    const persona = usePersonaStore.getState().personas[0];
    expect(persona.feedback_logs).toHaveLength(1);
    expect(persona.feedback_logs[0].context).toBe('Q1 리뷰');
    expect(persona.feedback_logs[0].feedback).toBe('숫자 근거를 더 요구함');
    expect(persona.feedback_logs[0].id).toBeTruthy();
    expect(persona.feedback_logs[0].created_at).toBeTruthy();

    expect(mockUpsert).toHaveBeenCalledWith('personas', expect.objectContaining({ id }));
  });

  it('deleteFeedbackLog — removes specific log from persona feedback_logs', () => {
    const personaId = usePersonaStore.getState().createPersona({ name: 'Log Target' });

    usePersonaStore.getState().addFeedbackLog(personaId, {
      date: '2026-03-01',
      context: 'Log A',
      feedback: 'First log',
    });
    usePersonaStore.getState().addFeedbackLog(personaId, {
      date: '2026-03-02',
      context: 'Log B',
      feedback: 'Second log',
    });

    const logs = usePersonaStore.getState().personas[0].feedback_logs;
    expect(logs).toHaveLength(2);
    const logIdToDelete = logs[0].id;
    vi.clearAllMocks();

    usePersonaStore.getState().deleteFeedbackLog(personaId, logIdToDelete);

    const updatedLogs = usePersonaStore.getState().personas[0].feedback_logs;
    expect(updatedLogs).toHaveLength(1);
    expect(updatedLogs[0].context).toBe('Log B');

    expect(mockUpsert).toHaveBeenCalledTimes(1);
  });
});

// ═══════════════════════════════════════════════════════════
// useReframeStore
// ═══════════════════════════════════════════════════════════

describe('useReframeStore mutations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetStorage();
    resetStore(useReframeStore, { items: [], currentId: null });
  });

  it('createItem — creates new item with status "input"', () => {
    const id = useReframeStore.getState().createItem('AI 전략을 어떻게 수립할 것인가?');

    const state = useReframeStore.getState();
    expect(state.items).toHaveLength(1);
    expect(state.currentId).toBe(id);

    const item = state.items[0];
    expect(item.id).toBe(id);
    expect(item.input_text).toBe('AI 전략을 어떻게 수립할 것인가?');
    expect(item.status).toBe('input');
    expect(item.analysis).toBeNull();
    expect(item.selected_question).toBe('');
    expect(item.created_at).toBeTruthy();
    expect(item.updated_at).toBeTruthy();

    expect(mockUpsert).toHaveBeenCalledWith('reframe_items', expect.objectContaining({ id }));
  });

  it('updateItem — updates item fields', () => {
    const id = useReframeStore.getState().createItem('Original question');
    vi.clearAllMocks();

    useReframeStore.getState().updateItem(id, {
      status: 'analyzing',
      selected_question: 'Refined question',
    });

    const item = useReframeStore.getState().items[0];
    expect(item.status).toBe('analyzing');
    expect(item.selected_question).toBe('Refined question');
    expect(item.input_text).toBe('Original question'); // preserved

    expect(mockUpsert).toHaveBeenCalledTimes(1);
  });

  it('deleteItem — removes item from state and clears currentId if matching', () => {
    const id = useReframeStore.getState().createItem('To be deleted');
    expect(useReframeStore.getState().currentId).toBe(id);
    vi.clearAllMocks();

    useReframeStore.getState().deleteItem(id);

    const state = useReframeStore.getState();
    expect(state.items).toHaveLength(0);
    expect(state.currentId).toBeNull();
    expect(mockDelete).toHaveBeenCalledWith('reframe_items', id);
  });

  it('setCurrentId — sets current id', () => {
    useReframeStore.getState().setCurrentId('some-id');
    expect(useReframeStore.getState().currentId).toBe('some-id');

    useReframeStore.getState().setCurrentId(null);
    expect(useReframeStore.getState().currentId).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════
// useRecastStore
// ═══════════════════════════════════════════════════════════

describe('useRecastStore mutations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetStorage();
    resetStore(useRecastStore, { items: [], currentId: null });
  });

  /** Helper: create a recast item and pre-populate with steps */
  function createItemWithSteps(stepCount: number) {
    const id = useRecastStore.getState().createItem();
    for (let i = 0; i < stepCount; i++) {
      useRecastStore.getState().addStep(id);
    }
    // Set distinguishable task names
    for (let i = 0; i < stepCount; i++) {
      useRecastStore.getState().updateStep(id, i, { task: `Step ${i}` });
    }
    return id;
  }

  it('updateStep — modifies step within recast item steps array', () => {
    const id = createItemWithSteps(2);
    vi.clearAllMocks();

    useRecastStore.getState().updateStep(id, 0, {
      task: 'Updated task',
      actor: 'human',
      checkpoint: true,
    });

    const item = useRecastStore.getState().items.find(i => i.id === id)!;
    expect(item.steps[0].task).toBe('Updated task');
    expect(item.steps[0].actor).toBe('human');
    expect(item.steps[0].checkpoint).toBe(true);
    expect(item.steps[1].task).toBe('Step 1'); // other step untouched

    expect(mockUpsert).toHaveBeenCalledTimes(1);
  });

  it('addStep — appends new step to recast item', () => {
    const id = useRecastStore.getState().createItem();
    vi.clearAllMocks();

    useRecastStore.getState().addStep(id);

    const item = useRecastStore.getState().items.find(i => i.id === id)!;
    expect(item.steps).toHaveLength(1);
    expect(item.steps[0].task).toBe('');
    expect(item.steps[0].actor).toBe('ai');
    expect(item.steps[0].checkpoint).toBe(false);
  });

  it('removeStep — removes step by index', () => {
    const id = createItemWithSteps(3);
    vi.clearAllMocks();

    useRecastStore.getState().removeStep(id, 1); // remove "Step 1"

    const item = useRecastStore.getState().items.find(i => i.id === id)!;
    expect(item.steps).toHaveLength(2);
    expect(item.steps[0].task).toBe('Step 0');
    expect(item.steps[1].task).toBe('Step 2');
  });

  it('reorderSteps — swaps step positions', () => {
    const id = createItemWithSteps(3);
    vi.clearAllMocks();

    // Move Step 0 to position 2
    useRecastStore.getState().reorderSteps(id, 0, 2);

    const item = useRecastStore.getState().items.find(i => i.id === id)!;
    expect(item.steps[0].task).toBe('Step 1');
    expect(item.steps[1].task).toBe('Step 2');
    expect(item.steps[2].task).toBe('Step 0');

    expect(mockUpsert).toHaveBeenCalledTimes(1);
  });
});

// ═══════════════════════════════════════════════════════════
// useProjectStore
// ═══════════════════════════════════════════════════════════

describe('useProjectStore mutations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetStorage();
    resetStore(useProjectStore, { projects: [], currentProjectId: null });
  });

  it('createProject — creates project with name and description', () => {
    const id = useProjectStore.getState().createProject('AI 전략 프로젝트', '2026 Q2 목표');

    const state = useProjectStore.getState();
    expect(state.projects).toHaveLength(1);
    expect(state.currentProjectId).toBe(id);

    const project = state.projects[0];
    expect(project.name).toBe('AI 전략 프로젝트');
    expect(project.description).toBe('2026 Q2 목표');
    expect(project.refs).toEqual([]);
    expect(project.created_at).toBeTruthy();

    expect(mockUpsert).toHaveBeenCalledWith('projects', expect.objectContaining({ id }));
  });

  it('addRef — adds ref to project', () => {
    const projectId = useProjectStore.getState().createProject('Test Project');
    vi.clearAllMocks();

    useProjectStore.getState().addRef(projectId, {
      tool: 'reframe',
      itemId: 'item-1',
      label: 'Reframe analysis',
    });

    const project = useProjectStore.getState().getProject(projectId)!;
    expect(project.refs).toHaveLength(1);
    expect(project.refs[0].tool).toBe('reframe');
    expect(project.refs[0].itemId).toBe('item-1');
    expect(project.refs[0].linkedAt).toBeTruthy();
  });

  it('addRef — deduplicates by itemId + tool', () => {
    const projectId = useProjectStore.getState().createProject('Dedup Test');

    const ref = { tool: 'recast' as const, itemId: 'item-dup', label: 'First' };
    useProjectStore.getState().addRef(projectId, ref);
    useProjectStore.getState().addRef(projectId, { ...ref, label: 'Second attempt' });

    const project = useProjectStore.getState().getProject(projectId)!;
    expect(project.refs).toHaveLength(1); // no duplicate
    expect(project.refs[0].label).toBe('First'); // first one kept
  });

  it('getProject — returns specific project by id', () => {
    const id1 = useProjectStore.getState().createProject('Project A');
    const id2 = useProjectStore.getState().createProject('Project B');

    const projectA = useProjectStore.getState().getProject(id1);
    const projectB = useProjectStore.getState().getProject(id2);
    const missing = useProjectStore.getState().getProject('nonexistent');

    expect(projectA?.name).toBe('Project A');
    expect(projectB?.name).toBe('Project B');
    expect(missing).toBeUndefined();
  });

  it('setCurrentProjectId — sets current project', () => {
    const id = useProjectStore.getState().createProject('Active Project');

    useProjectStore.getState().setCurrentProjectId(null);
    expect(useProjectStore.getState().currentProjectId).toBeNull();

    useProjectStore.getState().setCurrentProjectId(id);
    expect(useProjectStore.getState().currentProjectId).toBe(id);
  });
});
