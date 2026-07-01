/**
 * Orchestrator Simulation — 오케스트레이터 시스템 검증
 *
 * 시나리오:
 * 1. classifyInput: stakes/domain/decisionType 분류 정확성
 * 2. selectAgents: 3-패스 에이전트 선택 + critical stakes Critic 보장
 * 3. assignFramework: 컨텍스트별 프레임워크 배정
 * 4. planWorkers: 전체 파이프라인 통합
 */

import { describe, it, expect } from 'vitest';
import { classifyInput } from '@/lib/orchestrator-classify';
import type { InputClassification, Stakes } from '@/lib/orchestrator-classify';
import { selectAgents } from '@/lib/orchestrator-select';
import { assignFramework } from '@/lib/orchestrator-framework';
import { planWorkers } from '@/lib/orchestrator';
import type { Agent, AgentObservation } from '@/stores/agent-types';

// ── Mock Agents ──

function mockAgent(overrides: Partial<Agent> & { id: string; name: string }): Agent {
  return {
    role: '테스트',
    emoji: '🧪',
    color: '#000',
    origin: 'builtin',
    capabilities: ['task_execution'],
    group: 'production',
    chain_id: null,
    unlock_condition: { type: 'always' },
    unlocked: true,
    keywords: [],
    xp: 0,
    level: 1,
    observations: [],
    is_builtin: true,
    archived: false,
    last_used_at: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  } as Agent;
}

const MOCK_AGENTS: Agent[] = [
  mockAgent({ id: 'sujin', name: '수진', role: '리서치 애널리스트', group: 'research', keywords: ['조사', '리서치', '시장', '분석', '트렌드'] }),
  mockAgent({ id: 'hyunwoo', name: '현우', role: '전략가', group: 'strategy', keywords: ['전략', '경쟁', '방향', '포지셔닝'] }),
  mockAgent({ id: 'minjae', name: '민재', role: '숫자 전문가', group: 'production', keywords: ['숫자', '재무', '비용', '매출', 'ROI'] }),
  mockAgent({ id: 'seoyeon', name: '서연', role: '카피라이터', group: 'production', keywords: ['문서', '기획안', '카피', '보고서'] }),
  mockAgent({ id: 'donghyuk', name: '동혁', role: '리스크 검토자', group: 'validation', keywords: ['리스크', '위험', '실패', '비판', '검증'] }),
  mockAgent({ id: 'jieun', name: '지은', role: 'UX 디자이너', group: 'validation', keywords: ['UX', 'UI', '사용자', '경험'] }),
  mockAgent({ id: 'taejun', name: '태준', role: '법률 검토자', group: 'validation', keywords: ['법률', '규제', '계약'] }),
  mockAgent({ id: 'junseo', name: '준서', role: '엔지니어', group: 'production', keywords: ['기술', '아키텍처', '구현', 'API'] }),
  mockAgent({ id: 'yerin', name: '예린', role: 'PM', group: 'production', keywords: ['일정', '타임라인', '우선순위'] }),
];

// ── 1. classifyInput ──

describe('classifyInput', () => {
  it('irreversible stakes → critical', () => {
    const result = classifyInput(
      '투자 유치 기획안',
      [
        { task: '시장 분석', output: '보고서' },
        { task: '재무 모델링', output: '재무제표' },
        { task: '기획안 작성', output: '기획안' },
      ],
      { stakes: 'irreversible' },
    );
    expect(result.stakes).toBe('critical');
    expect(result.agentCount).toBeGreaterThanOrEqual(3);
  });

  it('experiment stakes → routine', () => {
    const result = classifyInput(
      'A/B 테스트 설계',
      [{ task: '실험 설계', output: '테스트 플랜' }],
      { stakes: 'experiment' },
    );
    expect(result.stakes).toBe('routine');
    expect(result.agentCount).toBeLessThanOrEqual(2);
  });

  it('signals 없으면 기본 important', () => {
    const result = classifyInput(
      '사업 계획서',
      [{ task: '시장 조사', output: '보고서' }],
    );
    expect(result.stakes).toBe('important');
  });

  it('도메인 추출: 재무 키워드 → numbers 도메인', () => {
    const result = classifyInput(
      '매출 예측과 ROI 분석',
      [{ task: '비용 구조 분석', output: '단가 산출' }],
    );
    expect(result.domains).toContain('numbers');
  });

  it('도메인 추출: 전략 + 리서치 복합', () => {
    const result = classifyInput(
      '경쟁사 분석을 통한 시장 전략 수립',
      [
        { task: '시장 트렌드 조사', output: '벤치마크 보고서' },
        { task: '포지셔닝 전략', output: '차별화 방안' },
      ],
    );
    expect(result.domains).toContain('research');
    expect(result.domains).toContain('strategy');
  });

  it('decisionType: nature가 on_fire면 on_fire', () => {
    const result = classifyInput(
      '서버 장애 대응',
      [{ task: '장애 분석', output: '원인 보고서' }],
      { nature: 'on_fire' },
    );
    expect(result.decisionType).toBe('on_fire');
  });

  it('agentCount는 step 수를 초과하지 않음', () => {
    const result = classifyInput(
      '중요한 결정',
      [{ task: '분석', output: '결과' }],  // step 1개
      { stakes: 'irreversible' },  // critical → max 4
    );
    expect(result.agentCount).toBe(1);  // min(4, 1) = 1
  });
});

// ── 2. selectAgents ──

describe('selectAgents', () => {
  it('리서치 키워드 → 수진 선택', () => {
    const steps = [{ task: '시장 조사 및 트렌드 분석', output: '조사 보고서' }];
    const classification: InputClassification = { stakes: 'important', domains: ['research'], decisionType: 'needs_analysis', agentCount: 2 };

    const result = selectAgents(steps, classification, MOCK_AGENTS, []);
    const agent = result.get(0);
    expect(agent).toBeDefined();
    expect(agent!.id).toBe('sujin');
  });

  it('재무 키워드 → 민재 선택', () => {
    const steps = [{ task: '비용 구조 분석과 ROI 계산', output: '재무 보고서' }];
    const classification: InputClassification = { stakes: 'important', domains: ['numbers'], decisionType: 'needs_analysis', agentCount: 2 };

    const result = selectAgents(steps, classification, MOCK_AGENTS, []);
    const agent = result.get(0);
    expect(agent).toBeDefined();
    expect(agent!.id).toBe('minjae');
  });

  it('critical stakes → 동혁 반드시 포함', () => {
    const steps = [
      { task: '시장 조사', output: '보고서' },
      { task: '전략 수립', output: '전략 문서' },
    ];
    const classification: InputClassification = { stakes: 'critical', domains: ['research', 'strategy'], decisionType: 'needs_analysis', agentCount: 3 };

    const result = selectAgents(steps, classification, MOCK_AGENTS, []);
    const agents = Array.from(result.values());
    const hasCritic = agents.some(a => a.id === 'donghyuk');
    expect(hasCritic).toBe(true);
  });

  it('중복 배정 방지: 같은 에이전트가 2개 step에 배정되지 않음', () => {
    const steps = [
      { task: '시장 조사', output: '보고서' },
      { task: '시장 트렌드 분석', output: '트렌드 리포트' },
    ];
    const classification: InputClassification = { stakes: 'important', domains: ['research'], decisionType: 'needs_analysis', agentCount: 3 };

    const result = selectAgents(steps, classification, MOCK_AGENTS, []);
    const ids = Array.from(result.values()).map(a => a.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });

  it('agent_hint 보너스: LLM 제안이 점수에 반영', () => {
    const steps = [{ task: '문서 작성', output: '기획안', agent_hint: '서연' }];
    const classification: InputClassification = { stakes: 'routine', domains: ['copy'], decisionType: 'known_path', agentCount: 2 };

    const result = selectAgents(steps, classification, MOCK_AGENTS, []);
    expect(result.get(0)?.id).toBe('seoyeon');
  });

  it('관찰 보정: skill_gap이 있는 도메인의 에이전트 부스트', () => {
    const steps = [{ task: '사업 계획 수립', output: '사업 계획서' }];
    const classification: InputClassification = { stakes: 'important', domains: ['strategy'], decisionType: 'needs_analysis', agentCount: 2 };

    const observations: AgentObservation[] = [{
      id: 'obs1',
      category: 'skill_gap',
      observation: '이 사용자는 전략 관점을 자주 놓침. 포지셔닝이 약함.',
      confidence: 0.7,
      evidence_count: 3,
      created_at: new Date().toISOString(),
    }];

    const result = selectAgents(steps, classification, MOCK_AGENTS, observations);
    // 전략 관점 skill_gap + 사업 계획 = 전략가(hyunwoo)가 유리
    expect(['hyunwoo', 'sujin', 'seoyeon'].includes(result.get(0)?.id || '')).toBe(true);
  });
});

// ── 3. assignFramework ──

describe('assignFramework', () => {
  it('strategist + needs_analysis → WWHTBT', () => {
    const result = assignFramework('hyunwoo', '신제품 기획', {
      stakes: 'important',
      domains: ['strategy'],
      decisionType: 'needs_analysis',
      agentCount: 2,
    });
    expect(result).toBeDefined();
    expect(result!.toLowerCase()).toContain('wwhtbt');
  });

  it('critic + on_fire → Pre-mortem', () => {
    const result = assignFramework('donghyuk', '긴급 대응 리스크 분석', {
      stakes: 'critical',
      domains: ['risk'],
      decisionType: 'on_fire',
      agentCount: 3,
    });
    expect(result).toBeDefined();
    expect(result!.toLowerCase()).toContain('pre-mortem');
  });

  it('numbers + needs_analysis → Market Sizing Convergence', () => {
    const result = assignFramework('minjae', '수익 구조 분석', {
      stakes: 'important',
      domains: ['numbers'],
      decisionType: 'needs_analysis',
      agentCount: 2,
    });
    expect(result).toBeDefined();
    expect(result!.toLowerCase()).toContain('market sizing convergence');
  });

  it('알 수 없는 에이전트 → null', () => {
    const result = assignFramework('unknown_agent', '아무 작업', {
      stakes: 'routine',
      domains: [],
      decisionType: 'known_path',
      agentCount: 1,
    });
    expect(result).toBeNull();
  });

  it('copywriter + needs_analysis → SCQA', () => {
    const result = assignFramework('seoyeon', '보고서 작성', {
      stakes: 'important',
      domains: ['copy'],
      decisionType: 'needs_analysis',
      agentCount: 2,
    });
    expect(result).toBeDefined();
    expect(result!.toLowerCase()).toContain('scqa');
  });
});

// ── 4. planWorkers 통합 ──

describe('planWorkers', () => {
  it('steps를 받아 PlannedWorker[]를 반환', () => {
    const steps = [
      { task: '시장 조사', who: 'ai', output: '조사 보고서' },
      { task: '기획안 작성', who: 'ai', output: '기획안 초안' },
    ];

    const result = planWorkers(steps, undefined, MOCK_AGENTS, []);

    expect(result.classification).toBeDefined();
    expect(result.classification.stakes).toBe('important');
    expect(result.workers).toHaveLength(2);
    expect(result.workers[0].agentId).toBeTruthy();
    expect(result.workers[1].agentId).toBeTruthy();
    // 각 worker에 프레임워크가 배정됨
    expect(result.workers[0].framework).toBeDefined();
  });

  it('critical stakes → 분류가 critical', () => {
    const steps = [
      { task: '리스크 분석', who: 'ai', output: '리스크 보고서' },
    ];

    const result = planWorkers(steps, { stakes: 'irreversible' }, MOCK_AGENTS, []);
    expect(result.classification.stakes).toBe('critical');
  });

  it('on_fire 위기 → review_loop 패턴 + 2 스테이지 (irreversible 아니어도 검증 점화)', () => {
    const steps = [
      { task: '시장 조사', who: 'ai', output: '보고서' },
      { task: '비용 추정', who: 'ai', output: '수치' },
      { task: '리스크 검토', who: 'ai', output: '리스크' },
    ];
    const result = planWorkers(steps, { nature: 'on_fire' } as never, MOCK_AGENTS, []);
    expect(result.orchestrationPlan.pattern).toBe('review_loop');
    expect(result.orchestrationPlan.verifyDepth).toBe('deep');
    expect(result.stages.length).toBe(2);
  });

  it('orchestrationPlan을 항상 노출하고 검증 깊이는 비어있지 않다 (검증 상수)', () => {
    const result = planWorkers(
      [{ task: '시장 조사', who: 'ai', output: '보고서' }],
      undefined, MOCK_AGENTS, [],
    );
    expect(result.orchestrationPlan).toBeDefined();
    expect(['light', 'standard', 'deep']).toContain(result.orchestrationPlan.verifyDepth);
  });

  it('userLeaning + important → deep verify / review_loop (확증편향 가드)', () => {
    const steps = [
      { task: '시장 조사', who: 'ai', output: '보고서' },
      { task: '비용 추정', who: 'ai', output: '수치' },
      { task: '리스크 검토', who: 'ai', output: '리스크' },
    ];
    const neutral = planWorkers(steps, { stakes: 'important' } as never, MOCK_AGENTS, [], false);
    const leaning = planWorkers(steps, { stakes: 'important' } as never, MOCK_AGENTS, [], true);
    expect(neutral.orchestrationPlan.verifyDepth).toBe('standard');
    expect(leaning.orchestrationPlan.verifyDepth).toBe('deep');
    expect(leaning.orchestrationPlan.pattern).toBe('review_loop');
  });

  it('non-AI steps do NOT inflate the pattern gate (workerCount = AI count)', () => {
    // 1 AI worker + 2 human confirmation steps on a routine call must stay
    // single/light — the humans must not push it to parallel/standard.
    const steps = [
      { task: 'AI가 분석', who: 'ai', output: '보고서' },
      { task: '사람이 확인', who: 'human', output: '확인' },
      { task: '사람이 결재', who: 'human', output: '결재' },
    ];
    const r = planWorkers(steps, { stakes: 'experiment' } as never, MOCK_AGENTS, []);
    expect(r.orchestrationPlan.pattern).toBe('single');
    expect(r.orchestrationPlan.verifyDepth).toBe('light');
  });

  it('서로 다른 에이전트가 배정됨', () => {
    const steps = [
      { task: '시장 조사', who: 'ai', output: '보고서' },
      { task: '비용 분석', who: 'ai', output: '재무 보고서' },
      { task: '기획안 작성', who: 'ai', output: '기획안' },
    ];

    const result = planWorkers(steps, undefined, MOCK_AGENTS, []);
    const agentIds = result.workers.map(w => w.agentId);
    const unique = new Set(agentIds);
    expect(unique.size).toBe(agentIds.length);
  });
});
