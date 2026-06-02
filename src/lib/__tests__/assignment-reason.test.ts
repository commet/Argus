/**
 * assignment-reason — the why-this-agent one-liner + its passthrough from the
 * router. Guards two things that were silently broken/discarded before:
 *  1. buildAssignmentReason turns a SelectionTrace into honest, localized prose
 *     (task fit + runner-up, no invented claims, no raw scores).
 *  2. planWorkers actually surfaces a reason on auto-assigned AI workers
 *     (selectAgents used to compute traces and throw them away).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockLang } = vi.hoisted(() => ({ mockLang: vi.fn(() => 'ko') }));
vi.mock('@/lib/i18n', () => ({ getCurrentLanguage: mockLang }));

import { buildAssignmentReason } from '@/lib/assignment-reason';
import { planWorkers } from '@/lib/orchestrator';
import type { SelectionTrace } from '@/lib/orchestrator-select';
import type { TaskClassification } from '@/lib/task-classifier';
import type { Agent } from '@/stores/agent-types';

function mockAgent(id: string, name: string, overrides: Partial<Agent> = {}): Agent {
  return {
    id, name,
    role: '테스트', emoji: '🧪', color: '#000', origin: 'builtin',
    capabilities: ['task_execution'], group: 'production', chain_id: null,
    unlock_condition: { type: 'always' }, unlocked: true, keywords: [],
    xp: 0, level: 1, observations: [], is_builtin: true, archived: false,
    last_used_at: null, created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z', ...overrides,
  } as Agent;
}

const tc = (over: Partial<TaskClassification> = {}): TaskClassification => ({
  taskType: 'analysis', secondaryType: null, contextDomain: 'market',
  outputType: 'report', confidence: 0.8, ...over,
});

const trace = (over: Partial<SelectionTrace> = {}): SelectionTrace => ({
  stepIndex: 0,
  taskClassification: tc(),
  selectedAgent: 'a',
  scores: [
    { agentId: 'a', baseScore: 0.8, experienceBoost: 0.05, total: 0.85 },
    { agentId: 'b', baseScore: 0.5, experienceBoost: 0, total: 0.5 },
  ],
  ...over,
});

describe('buildAssignmentReason', () => {
  beforeEach(() => mockLang.mockReturnValue('ko'));

  it('ko: states task fit and names the runner-up', () => {
    const agents = new Map([['a', mockAgent('a', '소피')], ['b', mockAgent('b', '마커스')]]);
    expect(buildAssignmentReason(trace(), agents)).toBe('시장 분석에 가장 적합 · 다음 후보 마커스');
  });

  it('en: localized prose, no Korean leakage', () => {
    mockLang.mockReturnValue('en');
    const agents = new Map([['a', mockAgent('a', 'Sophie')], ['b', mockAgent('b', 'Marcus')]]);
    expect(buildAssignmentReason(trace(), agents)).toBe('Best fit for market analysis · runner-up Marcus');
  });

  it('omits runner-up when the next candidate did not score', () => {
    const agents = new Map([['a', mockAgent('a', '소피')]]);
    const t = trace({ scores: [{ agentId: 'a', baseScore: 0.8, experienceBoost: 0, total: 0.8 }] });
    expect(buildAssignmentReason(t, agents)).toBe('시장 분석에 가장 적합');
  });

  it('omits runner-up when the only other candidate has total 0', () => {
    const agents = new Map([['a', mockAgent('a', '소피')], ['b', mockAgent('b', '마커스')]]);
    const t = trace({ scores: [
      { agentId: 'a', baseScore: 0.8, experienceBoost: 0, total: 0.8 },
      { agentId: 'b', baseScore: 0, experienceBoost: 0, total: 0 },
    ] });
    expect(buildAssignmentReason(t, agents)).toBe('시장 분석에 가장 적합');
  });

  it('never emits raw numeric scores', () => {
    const agents = new Map([['a', mockAgent('a', '소피')], ['b', mockAgent('b', '마커스')]]);
    expect(buildAssignmentReason(trace(), agents)).not.toMatch(/0\.\d|\b\d{2,}\b/);
  });

  it('reflects domain + taskType (finance critique)', () => {
    const agents = new Map([['a', mockAgent('a', '소피')]]);
    const t = trace({
      taskClassification: tc({ taskType: 'critique', contextDomain: 'finance' }),
      scores: [{ agentId: 'a', baseScore: 0.7, experienceBoost: 0, total: 0.7 }],
    });
    expect(buildAssignmentReason(t, agents)).toBe('재무 검증에 가장 적합');
  });
});

describe('planWorkers surfaces the rationale (no longer discarded)', () => {
  beforeEach(() => mockLang.mockReturnValue('ko'));

  const AGENTS: Agent[] = [
    mockAgent('sujin', '수진', { group: 'research', keywords: ['조사', '시장', '분석'] }),
    mockAgent('minjae', '민재', { group: 'production', keywords: ['재무', '숫자', '비용'] }),
    mockAgent('donghyuk', '동혁', { group: 'validation', keywords: ['리스크', '검증'] }),
  ];

  it('attaches assignment_reason to auto-assigned AI workers', () => {
    const { workers } = planWorkers(
      [{ task: '시장 규모와 경쟁사를 조사한다', output: '시장 분석 보고서', agent_type: 'ai' }],
      undefined, AGENTS, [],
    );
    const ai = workers.find(w => w.agentType === 'ai' && w.agentId);
    expect(ai).toBeTruthy();
    expect(ai!.assignmentReason).toBeTruthy();
    expect(typeof ai!.assignmentReason).toBe('string');
  });

  it('leaves self/human steps without a rationale', () => {
    const { workers } = planWorkers(
      [{ task: '예산 우선순위를 정한다', output: '결정', agent_type: 'self' }],
      undefined, AGENTS, [],
    );
    const selfW = workers.find(w => w.agentType === 'self');
    expect(selfW).toBeTruthy();
    expect(selfW!.assignmentReason).toBeUndefined();
  });
});
