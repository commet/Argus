// @vitest-environment jsdom
/**
 * Orchestration render test (MASTER-DIRECTION-v4 L2 prerequisite).
 *
 * The other progressive tests render LEAF components in isolation. This one
 * mounts the DEFAULT export — the `ProgressiveFlow` orchestrator itself — and
 * proves the decomposed pieces (scroll/draft hooks + the extracted section
 * components) wire together and render a coherent tree for a given session
 * phase. It is the safety net for the remaining L2 hook extractions
 * (WorkerRuntime): if the deploy wiring breaks, the deploy-CTA assertion fails.
 *
 * Deliberately a mount/smoke + one orchestration-path assertion, not a deep
 * interaction test — the leaf behaviors are covered in flow-interactions.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type { ProgressiveSession, WorkerTask, WorkerPersona } from '@/stores/types';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// ── Mocks (the orchestrator's import graph) ──
vi.mock('@/lib/supabase', () => ({
  supabase: { from: vi.fn(), auth: { getSession: vi.fn(() => Promise.resolve({ data: { session: null } })) }, channel: vi.fn(() => ({ on: vi.fn().mockReturnThis(), subscribe: vi.fn() })), removeChannel: vi.fn() },
  getCurrentUserId: vi.fn(() => Promise.resolve(null)),
}));
vi.mock('@/hooks/useLocale', () => ({ useLocale: () => 'ko' }));
vi.mock('@/components/workspace/progressive/WorkerAvatar', () => ({ WorkerAvatar: () => null, AvatarRow: () => null }));
vi.mock('@/components/workspace/progressive/useChronicler', () => ({ useChronicler: () => {} }));
vi.mock('@/components/workspace/progressive/WorkerPanel', () => ({ useWorkerContext: () => null }));
vi.mock('@/hooks/useWorkerActions', () => ({
  useWorkerActions: () => ({ handleSubmit: vi.fn(), handleRetry: vi.fn(), handleApprove: vi.fn(), handleReject: vi.fn() }),
}));

// Mutable session holder shared with the store mock (hoisted so the factory can read it).
const h = vi.hoisted(() => ({ session: null as ProgressiveSession | null }));
vi.mock('@/stores/useProgressiveStore', () => {
  // Any store method access returns a no-op fn; currentSession returns the seeded session.
  const store = new Proxy(
    { currentSession: () => h.session },
    { get: (t: Record<string, unknown>, p: string) => (p in t ? t[p] : () => undefined) },
  );
  return { useProgressiveStore: () => store };
});

import { ProgressiveFlow } from '@/components/workspace/progressive/ProgressiveFlow';

// ── jsdom harness ──
let container: HTMLDivElement;
let root: Root;
beforeEach(() => { container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container); });
afterEach(() => { act(() => root.unmount()); container.remove(); h.session = null; });
const render = () => act(() => { root.render(<ProgressiveFlow projectId="p1" />); });

const persona = (id: string, name: string): WorkerPersona => ({
  id, name, role: '역할', expertise: '전문', tone: '톤', emoji: '🧪', color: '#000', keywords: [],
} as WorkerPersona);
const worker = (o: Partial<WorkerTask>): WorkerTask => ({
  id: 'w1', step_index: 0, task: '시장 조사', task_group_id: 'g1', added_manually: false, original_task: '시장 조사',
  who: 'ai', expected_output: '보고서', status: 'pending', persona: persona('p1', '애널리스트'), level: 'junior',
  stream_text: '', result: null, human_input: null, error: null, approved: null, completion_note: null,
  started_at: null, completed_at: null, agent_type: 'ai', ...o,
} as WorkerTask);
const session = (o: Partial<ProgressiveSession>): ProgressiveSession => ({
  id: 's1', problem_text: '신제품을 낼까?', phase: 'conversing', snapshots: [], questions: [], answers: [],
  mix: null, dm_feedback: null, final_deliverable: null, final_mix: null, round: 0, max_rounds: 5,
  workers: [], worker_deploy_phase: 'none', decision_maker: null, drafts: [], active_draft_id: null,
  checkpoints: [], ...o,
} as unknown as ProgressiveSession);

describe('ProgressiveFlow orchestrator — mount + wiring', () => {
  it('mounts the default export and renders a non-empty tree for a conversing session', () => {
    h.session = session({ phase: 'conversing' });
    render();
    expect(container.textContent && container.textContent.length).toBeTruthy();
  });

  it('renders nothing (null) when there is no active session', () => {
    h.session = null;
    render();
    expect(container.textContent).toBe('');
  });

  it('wires the deploy path: a ready team surfaces the 팀 투입 deploy CTA', () => {
    h.session = session({
      phase: 'conversing',
      worker_deploy_phase: 'ready',
      workers: [worker({ id: 'w1', persona: persona('p1', '애널리스트') })],
    });
    render();
    // The TeamDeployBanner (rendered via DeployResumeBanners) carries the deploy CTA.
    expect(container.textContent).toContain('팀 투입');
  });
});
