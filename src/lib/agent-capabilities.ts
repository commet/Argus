/**
 * agent-capabilities.ts — 14명 에이전트 역량 프로필
 *
 * 각 에이전트가 "할 수 있는 것"을 구조화된 스키마로 선언.
 * 순서가 곧 숙련도: 배열의 앞일수록 해당 에이전트의 핵심 역량.
 *
 * 이 데이터는 결정론적 매칭의 기반이 되며,
 * hit-rate 데이터가 쌓이면 가중치가 자동 조정된다 (자기개선).
 */

import type { TaskType, ContextDomain, OutputType } from './task-classifier';
import { getCapabilityDelta } from './capability-tuner';

/* ─── Types ─── */

export interface AgentCapabilityProfile {
  agentId: string;
  taskTypes: TaskType[];         // 순서 = 숙련도 (첫번째가 핵심)
  domains: ContextDomain[];      // 순서 = 친화도
  outputTypes: OutputType[];     // 순서 = 생산 능력
  antiPatterns: TaskType[];      // 이 에이전트가 하면 안 되는 것
}

/* ─── Scoring Constants ─── */

// 배열에서의 위치 → 점수. 첫번째 = 1.0, 두번째 = 0.8, ...
const RANK_SCORES = [1.0, 0.8, 0.6, 0.45, 0.3, 0.2];
const DEFAULT_SCORE = 0.05;      // 목록에 없는 항목
const ANTI_PATTERN_PENALTY = -0.4;

// 매칭 차원별 가중치
const WEIGHTS = {
  taskType: 0.50,   // task type이 가장 중요 (무엇을 하는가)
  domain: 0.30,     // domain이 두번째 (어떤 영역인가)
  output: 0.20,     // output이 세번째 (무엇을 만드는가)
} as const;

/* ─── 17 Agent Profiles ─── */

export const AGENT_CAPABILITIES: AgentCapabilityProfile[] = [
  // ━━━ Research Chain ━━━
  {
    agentId: 'hayoon',  // 인턴
    taskTypes: ['research'],
    domains: ['market', 'product'],
    outputTypes: ['comparison', 'report'],
    antiPatterns: ['strategy', 'legal_review', 'calculation'],
  },
  {
    agentId: 'sujin',  // 리서치 애널리스트
    taskTypes: ['research', 'analysis', 'synthesis'],
    domains: ['market', 'product', 'tech'],
    outputTypes: ['report', 'comparison', 'document'],
    antiPatterns: ['legal_review', 'design'],
  },
  {
    agentId: 'research_director',  // 리서치 디렉터 (도윤)
    taskTypes: ['analysis', 'synthesis', 'research'],
    domains: ['market', 'product', 'finance'],
    outputTypes: ['report', 'document', 'comparison'],
    antiPatterns: ['design', 'legal_review'],
  },

  // ━━━ Strategy Chain ━━━
  {
    agentId: 'strategy_jr',  // 전략 주니어 (지호)
    taskTypes: ['research', 'analysis'],
    domains: ['market', 'product'],
    outputTypes: ['comparison', 'report'],
    antiPatterns: ['legal_review', 'calculation', 'design'],
  },
  {
    agentId: 'hyunwoo',  // 전략가
    taskTypes: ['strategy', 'analysis', 'synthesis'],
    domains: ['market', 'product', 'brand'],
    outputTypes: ['document', 'report', 'plan'],
    antiPatterns: ['calculation', 'legal_review', 'design'],
  },
  {
    agentId: 'chief_strategist',  // 전략 총괄 (승현)
    taskTypes: ['strategy', 'synthesis', 'critique'],
    domains: ['market', 'product', 'finance'],
    outputTypes: ['document', 'plan', 'risk_assessment'],
    antiPatterns: ['research', 'design', 'legal_review'],
  },

  // ━━━ Production ━━━
  {
    agentId: 'minjae',  // 숫자 전문가
    taskTypes: ['calculation', 'analysis'],
    domains: ['finance', 'market', 'ops'],
    outputTypes: ['numbers', 'report', 'comparison'],
    antiPatterns: ['writing', 'design', 'legal_review'],
  },
  {
    agentId: 'seoyeon',  // 카피라이터
    taskTypes: ['writing', 'synthesis'],
    domains: ['brand', 'product', 'market'],
    outputTypes: ['document', 'report', 'plan'],
    antiPatterns: ['calculation', 'legal_review', 'design'],
  },
  {
    agentId: 'junseo',  // 엔지니어
    taskTypes: ['analysis', 'planning', 'design'],
    domains: ['tech', 'product', 'ops'],
    outputTypes: ['plan', 'document', 'checklist'],
    antiPatterns: ['writing', 'legal_review', 'calculation'],
  },
  {
    agentId: 'yerin',  // PM
    taskTypes: ['planning', 'synthesis', 'analysis'],
    domains: ['ops', 'product', 'tech'],
    outputTypes: ['plan', 'checklist', 'document'],
    antiPatterns: ['calculation', 'legal_review', 'design'],
  },

  // ━━━ Validation ━━━
  {
    agentId: 'donghyuk',  // 리스크 검토자
    taskTypes: ['critique', 'analysis'],
    domains: ['market', 'finance', 'product', 'tech'],
    outputTypes: ['risk_assessment', 'report', 'checklist'],
    antiPatterns: ['writing', 'design', 'planning'],
  },
  {
    agentId: 'jieun',  // UX 디자이너
    taskTypes: ['design', 'analysis', 'critique'],
    domains: ['ux', 'product', 'brand'],
    outputTypes: ['report', 'checklist', 'document'],
    antiPatterns: ['calculation', 'legal_review', 'planning'],
  },
  {
    agentId: 'taejun',  // 법률 검토자
    taskTypes: ['legal_review', 'critique', 'analysis'],
    domains: ['legal', 'ops', 'product'],
    outputTypes: ['risk_assessment', 'checklist', 'report'],
    antiPatterns: ['writing', 'design', 'calculation'],
  },

  // ━━━ New: Finance, Marketing, HR ━━━
  {
    agentId: 'hyeyeon',  // 재무·회계
    taskTypes: ['calculation', 'analysis', 'critique'],
    domains: ['finance', 'market', 'ops'],
    outputTypes: ['numbers', 'report', 'risk_assessment'],
    antiPatterns: ['design', 'writing'],
  },
  {
    agentId: 'minseo',  // 마케팅·그로스
    taskTypes: ['strategy', 'writing', 'analysis', 'planning'],
    domains: ['brand', 'market', 'product'],
    outputTypes: ['plan', 'document', 'report'],
    antiPatterns: ['legal_review', 'calculation'],
  },
  {
    agentId: 'sujin_hr',  // 사람·문화
    taskTypes: ['planning', 'writing', 'analysis', 'synthesis'],
    domains: ['ops', 'product'],
    outputTypes: ['plan', 'document', 'checklist'],
    antiPatterns: ['calculation', 'legal_review', 'design'],
  },

  // ━━━ Special ━━━
  {
    agentId: 'navigator',
    taskTypes: ['synthesis', 'critique', 'analysis'],
    domains: ['product', 'market', 'ops'],
    outputTypes: ['report', 'document', 'risk_assessment'],
    antiPatterns: [],
  },
];

/* ─── Capability Lookup ─── */

const capabilityMap = new Map<string, AgentCapabilityProfile>();
for (const cap of AGENT_CAPABILITIES) {
  capabilityMap.set(cap.agentId, cap);
}

export function getCapability(agentId: string): AgentCapabilityProfile | undefined {
  return capabilityMap.get(agentId);
}

/* ─── Scoring Engine ─── */

function rankScore(item: string, ranked: string[]): number {
  const idx = ranked.indexOf(item);
  if (idx === -1) return DEFAULT_SCORE;
  return RANK_SCORES[idx] ?? RANK_SCORES[RANK_SCORES.length - 1];
}

/**
 * 에이전트의 task 적합도 점수를 계산.
 *
 * score = taskType_score * 0.5 + domain_score * 0.3 + output_score * 0.2
 *       + anti_pattern_penalty
 *
 * 범위: -0.4 ~ 1.0
 */
export function scoreAgentForTask(
  agentId: string,
  taskType: TaskType,
  secondaryType: TaskType | null,
  contextDomain: ContextDomain,
  outputType: OutputType,
): number {
  const cap = capabilityMap.get(agentId);
  if (!cap) return DEFAULT_SCORE;

  // Anti-pattern 체크
  if (cap.antiPatterns.includes(taskType)) return ANTI_PATTERN_PENALTY;

  // 주요 타입 매칭
  let taskScore = rankScore(taskType, cap.taskTypes);

  // secondary type 보너스 (약한 가산)
  if (secondaryType && cap.taskTypes.includes(secondaryType)) {
    taskScore += 0.1;
  }

  const domainScore = rankScore(contextDomain, cap.domains);
  const outputScore = rankScore(outputType, cap.outputTypes);

  const baseScore =
    taskScore * WEIGHTS.taskType +
    domainScore * WEIGHTS.domain +
    outputScore * WEIGHTS.output;

  // 자동 튜닝 보정치 적용 (AutoAgent 패턴)
  // hit-rate 데이터가 쌓이면 capability-tuner가 이 값을 조정
  const tuningDelta = getCapabilityDelta(agentId, taskType);

  return baseScore + tuningDelta;
}
