/**
 * setFalsification store behavior — persists the committed overreach/flinch
 * result on the current session, additively (never disturbs dm_feedback), and
 * no-ops when there is no current session.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// ─── Mocks (before store import) — mirror the progressive-store harness ───
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
vi.mock('@/stores/useAgentStore', () => ({ useAgentStore: { getState: () => ({ agents: [], loadAgents: vi.fn(), getUnlockedAgents: () => [] }) } }));
vi.mock('@/lib/observation-engine', () => ({ onTaskApproved: vi.fn(), onTaskRejected: vi.fn() }));
vi.mock('@/lib/orchestrator', () => ({ planWorkers: () => ({ classification: {}, workers: [], stages: [] }) }));
vi.mock('@/lib/lead-agent', () => ({ selectLeadAgent: () => null }));
vi.mock('@/lib/agent-quality', () => ({ computeQualityXP: () => 0 }));
vi.mock('@/lib/agent-adapters', () => ({ agentToWorkerPersona: () => null }));
vi.mock('@/lib/agent-skills', () => ({ numericLevelToAgentLevel: (lv: number) => (lv >= 5 ? 'guru' : lv >= 3 ? 'senior' : 'junior') }));
vi.mock('@/stores/usePersonaStore', () => ({ usePersonaStore: { getState: () => ({ personas: [] }) } }));

import { useProgressiveStore } from '@/stores/useProgressiveStore';
import { __resetStore } from '@/lib/storage';
import type { Falsification, DMFeedbackResult, ProgressiveSession } from '@/stores/types';

const api = () => useProgressiveStore.getState();
const cur = (id: string): ProgressiveSession => api().sessions.find((s) => s.id === id)!;

const sampleFalsification: Falsification = {
  claims: [{ id: 'c1', text: 'plausible', overreached: true }],
  flinched_id: 'c1',
  surfaced_constraint: 'Users will actively refer',
  real_bet: 'My referral loop hinges on users wanting to share',
  no_flinch_fallback: false,
};

const sampleDM: DMFeedbackResult = {
  persona_name: 'CFO', persona_role: 'finance', first_reaction: 'hm', good_parts: [],
  concerns: [{ text: 'cost', severity: 'critical', fix_suggestion: 'trim', applied: false }],
  would_ask: [], approval_condition: 'show numbers',
};

describe('setFalsification', () => {
  beforeEach(() => {
    _idCounter = 0;
    (__resetStore as () => void)();
    useProgressiveStore.setState({ sessions: [], currentSessionId: null });
  });

  it('persists the falsification on the current session', () => {
    const id = api().createSession('proj-1', '북미 진출');
    useProgressiveStore.setState({ currentSessionId: id });
    api().setFalsification(sampleFalsification);
    expect(cur(id).falsification).toEqual(sampleFalsification);
  });

  it('does not disturb dm_feedback (additive)', () => {
    const id = api().createSession('proj-1', '북미 진출');
    useProgressiveStore.setState({ currentSessionId: id });
    api().setDMFeedback(sampleDM);
    api().setFalsification(sampleFalsification);
    expect(cur(id).dm_feedback).toEqual(sampleDM);
    expect(cur(id).falsification).toEqual(sampleFalsification);
  });

  it('no-ops when there is no current session', () => {
    expect(() => api().setFalsification(sampleFalsification)).not.toThrow();
    expect(api().sessions).toHaveLength(0);
  });
});
