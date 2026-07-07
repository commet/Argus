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
import type { AgentId } from './agent-registry';
import { getCapabilityDelta } from './capability-tuner';

/* ─── Types ─── */

export interface AgentCapabilityProfile {
  agentId: AgentId;                       // 정본 타입 — 오타/유령 id는 컴파일이 거부
  readonly taskTypes: readonly TaskType[];      // 순서 = 숙련도 (첫번째가 핵심)
  readonly domains: readonly ContextDomain[];   // 순서 = 친화도
  readonly outputTypes: readonly OutputType[];  // 순서 = 생산 능력
  readonly antiPatterns: readonly TaskType[];   // 이 에이전트가 하면 안 되는 것
}

/* ─── Scoring Constants ─── */

// 배열에서의 위치 → 점수. 첫번째 = 1.0, 두번째 = 0.8, ...
const RANK_SCORES = [1.0, 0.8, 0.6, 0.45, 0.3, 0.2];
const DEFAULT_SCORE = 0.05;      // 목록에 없는 항목
const ANTI_PATTERN_PENALTY = -0.4;

/** F3 — task types where an anti-pattern makes an agent HARD-ineligible (not just
 *  penalized): a wrong fit here carries real downside (legal/regulatory exposure).
 *  Kept deliberately minimal (start with legal only) — a broad hard-filter over a
 *  sparse roster would make 'unfilled' escalations routine instead of rare. */
const SENSITIVE_TASK_TYPES: ReadonlySet<TaskType> = new Set<TaskType>(['legal_review']);

// 매칭 차원별 가중치
const WEIGHTS = {
  taskType: 0.50,   // task type이 가장 중요 (무엇을 하는가)
  domain: 0.30,     // domain이 두번째 (어떤 영역인가)
  output: 0.20,     // output이 세번째 (무엇을 만드는가)
} as const;

/* ─── 17 Agent Profiles ─── */

export const AGENT_CAPABILITIES = [
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
    agentId: 'research_director',  // 리서치 디렉터 (도윤) — 종합(synthesis) 전담: 여러 결과를 한 결론으로
    taskTypes: ['synthesis', 'analysis', 'research'],  // synthesis-first: fills the synthesis gap; analysis now sole-owned by junseo
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
    agentId: 'minjae',  // 숫자 전문가 — 추정·시장규모·유닛이코노믹스·시나리오 (vs 혜연=재무제표·밸류에이션)
    taskTypes: ['calculation', 'analysis'],
    domains: ['market', 'finance', 'ops'],   // market-first (sizing); finance still 2nd so minjae stays the general calc agent
    outputTypes: ['numbers', 'comparison', 'report'],  // comparison-first: scenario/sensitivity tables
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
    agentId: 'hyeyeon',  // 재무·회계 — 재무제표 분석·밸류에이션·감사 (vs 규민=추정·시장)
    taskTypes: ['calculation', 'analysis', 'critique'],
    domains: ['finance', 'ops', 'market'],   // finance-only-first; wins finance via domain, not by demoting minjae's calc
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
    agentId: 'sujin_hr',  // 사람·문화 — people 도메인 전담 (PM 예린의 ops와 분리)
    taskTypes: ['planning', 'writing', 'analysis', 'synthesis'],
    domains: ['people', 'ops', 'product'],
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
] as const satisfies readonly AgentCapabilityProfile[];

/**
 * 완전성 컴파일 가드: AGENT_REGISTRY의 모든 AgentId가 위 배열에 존재해야 한다.
 * 한 명이라도 빠지면 _CapMissing이 never가 아니게 되어 아래 줄이 컴파일 에러(TS2322)다.
 * = lens의 Record<AgentId>와 동급의 "누락이 빌드를 멈춘다"를, 배열 형태 그대로 강제.
 * (양방향 테스트 가드보다 한 단계 근본 — 검사를 돌리기 전에 빌드가 거부한다.)
 */
type _CapMissing = Exclude<AgentId, typeof AGENT_CAPABILITIES[number]['agentId']>;
const _capComplete: [_CapMissing] extends [never] ? true : ['MISSING agentId in AGENT_CAPABILITIES', _CapMissing] = true;
void _capComplete;

/* ─── Capability Lookup ─── */

const capabilityMap = new Map<string, AgentCapabilityProfile>();
for (const cap of AGENT_CAPABILITIES) {
  capabilityMap.set(cap.agentId, cap);
}

export function getCapability(agentId: string): AgentCapabilityProfile | undefined {
  return capabilityMap.get(agentId);
}

/** Single source of truth for "is this the critic agent" — its primary task type
 *  is critique. Used by selectAgents (critic guarantee), buildStages (stage-2
 *  critic), and runDebate, so all three pick the SAME agent instead of three
 *  different keyword/capability heuristics that could disagree. */
export function isCriticAgentId(agentId: string): boolean {
  const cap = capabilityMap.get(agentId);
  return !!cap && cap.taskTypes[0] === 'critique';
}

/* ─── Scoring Engine ─── */

function rankScore(item: string, ranked: readonly string[]): number {
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

  // Anti-pattern 체크. F3: for a SENSITIVE task type, an anti-pattern is a HARD
  // ineligibility (-Infinity), not a soft -0.4 — so a junior/ill-suited agent can
  // NEVER win a legal step even on a sparse roster (CNP anti-capability gate). The
  // caller (selectAgents) treats a non-finite best as unfilled → escalate, never
  // force a wrong fit onto a high-stakes task.
  if (cap.antiPatterns.includes(taskType)) {
    return SENSITIVE_TASK_TYPES.has(taskType) ? -Infinity : ANTI_PATTERN_PENALTY;
  }

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

/* ─── F3-spectrum: absolute fit tier ─── */

/**
 * The absolute capability-fit boundary. A `scoreAgentForTask` baseScore AT or
 * ABOVE this is a real specialist fit ('strong'); a positive score BELOW it is a
 * 'stretch' — the closest available agent, but not a specialist in this task.
 *
 * Why a spectrum matters (the F3 root gap): the router used to treat fit as
 * binary — assigned (any positive score) or 'unfilled' (no positive score). But
 * a 0.05 "nothing really matched" score was *assigned and described as a
 * confident best fit*, so a weak fit masqueraded as a fit (the honest-structure
 * failure mode). Surfacing the middle — "closest fit, not a specialist" — is the
 * spine-safe root fix. It is NOT dynamic role fabrication: inventing an ad-hoc
 * "expert" to fill the gap would be the model standing in for an absent
 * qualified agent (forbidden — CLAUDE.md "Honest gap over fabrication"). We name
 * the stretch honestly instead of faking a specialist.
 *
 * Threshold rationale (baseScore = taskType·0.5 + domain·0.3 + output·0.2):
 * a primary/secondary taskType match (≥0.4) OR a primary-domain match (~0.33)
 * clears it; only-output (~0.24), a minor rank-4+ taskType (~0.13), or a
 * nothing-matched agent (~0.05) do not.
 */
export const STRONG_FIT_THRESHOLD = 0.30;

/** Classify a baseScore into an absolute fit tier. `none` = no positive fit
 *  (the caller surfaces it as 'unfilled'); 'strong'/'stretch' split the awarded
 *  range at STRONG_FIT_THRESHOLD. */
export function fitTier(baseScore: number): 'strong' | 'stretch' | 'none' {
  if (!(baseScore > 0)) return 'none';
  return baseScore >= STRONG_FIT_THRESHOLD ? 'strong' : 'stretch';
}
