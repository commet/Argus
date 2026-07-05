/**
 * F4 — plan-declared dependencies → N-stage DAG execution.
 *  - layerWorkersByDeps: topological layering (Kahn longest-path); cycle → null.
 *  - topoSortStages: stages run after their parent; cycle-safe (no infinite loop).
 *  - planWorkers integration: a declared producer→consumer chain yields N stages,
 *    and (behavior-neutral) NO declared deps yields the unchanged single/2-stage shape.
 */

import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/hit-rate', () => ({ getAgentHitRate: () => ({ total: 0, rate: 0.5 }) }));

import { layerWorkersByDeps, planWorkers } from '@/lib/orchestrator';
import { topoSortStages } from '@/lib/worker-engine';
import type { PlannedWorker } from '@/lib/orchestrator';
import type { PipelineStage } from '@/stores/types';
import type { Agent } from '@/stores/agent-types';

const w = (stepIndex: number, dependsOn?: number[]): PlannedWorker =>
  ({ stepIndex, dependsOn, agentType: 'ai', agentId: `a${stepIndex}` } as unknown as PlannedWorker);

const stage = (id: string, dependsOnStageId?: string): PipelineStage =>
  ({ id, dependsOnStageId, label: id, workerIds: [], status: 'pending' } as PipelineStage);

describe('layerWorkersByDeps', () => {
  it('a linear chain 0←1←2 becomes 3 ordered stages, each depending on the prior', () => {
    const out = layerWorkersByDeps([w(0), w(1, [0]), w(2, [1])])!;
    expect(out).not.toBeNull();
    expect(out.stages.map(s => s.id)).toEqual(['stage_1', 'stage_2', 'stage_3']);
    expect(out.stages[0].dependsOnStageId).toBeUndefined();
    expect(out.stages[1].dependsOnStageId).toBe('stage_1');
    expect(out.stages[2].dependsOnStageId).toBe('stage_2');
    // worker-level deps are preserved (runPipeline / Layer-0 gate read them)
    expect(out.workers.find(x => x.stepIndex === 2)!.dependsOn).toEqual([1]);
  });

  it('a diamond (2 and 3 both depend on 0; 4 depends on 2,3) lays out in correct layers', () => {
    const out = layerWorkersByDeps([w(0), w(1), w(2, [0]), w(3, [0]), w(4, [2, 3])])!;
    // layer0: {0,1}  layer1: {2,3}  layer2: {4}  → 3 stages
    expect(out.stages.map(s => s.id)).toEqual(['stage_1', 'stage_2', 'stage_3']);
    const byStage = (id: string) => out.workers.filter(x => x.stageId === id).map(x => x.stepIndex).sort();
    expect(byStage('stage_1')).toEqual([0, 1]);
    expect(byStage('stage_2')).toEqual([2, 3]);
    expect(byStage('stage_3')).toEqual([4]);
  });

  it('rejects a dependency cycle (returns null → caller falls back safely)', () => {
    expect(layerWorkersByDeps([w(0, [2]), w(1, [0]), w(2, [1])])).toBeNull();
  });
});

describe('topoSortStages', () => {
  it('orders a stage after its parent (2-stage: behavior-neutral)', () => {
    const sorted = topoSortStages([stage('stage_2', 'stage_1'), stage('stage_1')]);
    expect(sorted.map(s => s.id)).toEqual(['stage_1', 'stage_2']);
  });
  it('orders an N-stage chain regardless of input order', () => {
    const sorted = topoSortStages([stage('stage_3', 'stage_2'), stage('stage_1'), stage('stage_2', 'stage_1')]);
    expect(sorted.map(s => s.id)).toEqual(['stage_1', 'stage_2', 'stage_3']);
  });
  it('does not infinite-loop on a cyclic dependsOnStageId', () => {
    const sorted = topoSortStages([stage('a', 'b'), stage('b', 'a')]);
    expect(sorted.length).toBe(2); // returns a best-effort order, no hang
  });
});

// ── Integration through the public planWorkers ──
function mockAgent(id: string, name: string): Agent {
  return {
    id, name, role: 't', emoji: '🧪', color: '#000', origin: 'builtin',
    capabilities: ['task_execution'], group: 'production', chain_id: null,
    unlock_condition: { type: 'always' }, unlocked: true, keywords: [], xp: 0, level: 1,
    observations: [], is_builtin: true, archived: false, last_used_at: null,
    created_at: '', updated_at: '',
  } as Agent;
}
const AGENTS = [
  mockAgent('sujin', '수진'), mockAgent('minjae', '민재'), mockAgent('hyunwoo', '현우'),
  mockAgent('seoyeon', '서연'), mockAgent('junseo', '준서'),
];

describe('planWorkers — F4 wiring + behavior-neutrality', () => {
  it('a plan with NO declared deps keeps the unchanged single-stage shape', () => {
    const steps = [
      { task: 'research the market', output: 'report', agent_type: 'ai' },
      { task: 'size the numbers', output: 'numbers', agent_type: 'ai' },
    ];
    const r = planWorkers(steps, undefined, AGENTS, []);
    // no deps → not the DAG path; a routine 2-AI plan is single-stage (parallel)
    expect(r.stages.length).toBe(1);
    // planWorkers returns PlannedWorker (camelCase dependsOn), pre-initWorkers.
    expect(r.workers.every(wk => (wk.dependsOn?.length ?? 0) === 0)).toBe(true);
  });

  it('a declared producer→consumer chain yields multiple ordered stages', () => {
    const steps = [
      { task: 'research the market landscape', output: 'report', agent_type: 'ai' },
      { task: 'model the unit economics using the research', output: 'numbers', agent_type: 'ai', depends_on: [0] },
      { task: 'write the positioning using the model', output: 'document', agent_type: 'ai', depends_on: [1] },
    ];
    const r = planWorkers(steps, undefined, AGENTS, []);
    expect(r.stages.length).toBeGreaterThan(1);
    // the consumer worker carries its declared dep (stepIndex form, pre-initWorkers)
    const consumer = r.workers.find(wk => wk.stepIndex === 2)!;
    expect(consumer.dependsOn && consumer.dependsOn.length).toBeGreaterThan(0);
  });

  it('drops an out-of-range / self dependency (bad LLM emission is sanitized)', () => {
    const steps = [
      { task: 'a', output: 'o', agent_type: 'ai' },
      { task: 'b', output: 'o', agent_type: 'ai', depends_on: [0, 9, 1] }, // 9 oob, 1 self
    ];
    const r = planWorkers(steps, undefined, AGENTS, []);
    const b = r.workers.find(wk => wk.stepIndex === 1)!;
    // only the valid dep (0) survives; 9 (out-of-range) and 1 (self) are dropped
    expect(b.dependsOn).toEqual([0]);
  });
});
