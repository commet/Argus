/**
 * Agent Registry — 에이전트 ID 매핑의 단일 소스.
 *
 * 에이전트는 코드베이스에서 3가지 ID 체계를 사용한다:
 * - agentId:     canonical key ('sujin', 'minjae', ...) — stores, capabilities
 * - personaId:   skill/persona key ('researcher', 'numbers', ...) — agent-skills-data, worker-personas
 * - frameworkKey: FRAMEWORK_PRIORITY 키 — 대부분 personaId와 동일
 *
 * 이전에는 agent-skills.ts, orchestrator-framework.ts, worker-personas.ts에
 * 각각 별도 매핑 테이블이 있었고 3개 에이전트(hyeyeon, minseo, sujin_hr)가 누락되어 있었다.
 * 이 모듈이 유일한 진실의 원천이다.
 */

// ─── Types ───

export interface AgentIdentity {
  agentId: string;       // canonical — stores, capabilities에서 사용
  personaId: string;     // skills, personas, completion notes 키
  frameworkKey: string;   // FRAMEWORK_PRIORITY 키
  name: string;          // Korean display name
  nameEn: string;        // English display name
}

// ─── Registry ───

export const AGENT_REGISTRY = [
  // Research chain
  { agentId: 'hayoon',             personaId: 'intern',              frameworkKey: 'intern',              name: '하윤',  nameEn: 'Riley' },
  { agentId: 'sujin',              personaId: 'researcher',          frameworkKey: 'researcher',          name: '다은',  nameEn: 'Sophie' },
  { agentId: 'research_director',  personaId: 'research_director',   frameworkKey: 'research_director',   name: '도윤',  nameEn: 'Marcus' },
  // Strategy chain
  { agentId: 'strategy_jr',        personaId: 'strategy_jr',         frameworkKey: 'strategy_jr',         name: '정민',  nameEn: 'Alex' },
  { agentId: 'hyunwoo',            personaId: 'strategist',          frameworkKey: 'strategist',          name: '현우',  nameEn: 'Nathan' },
  { agentId: 'chief_strategist',   personaId: 'chief_strategist',    frameworkKey: 'chief_strategist',    name: '승현',  nameEn: 'Victor' },
  // Production
  { agentId: 'seoyeon',            personaId: 'copywriter',          frameworkKey: 'copywriter',          name: '서연',  nameEn: 'Claire' },
  { agentId: 'minjae',             personaId: 'numbers',             frameworkKey: 'numbers',             name: '규민',  nameEn: 'Ethan' },
  { agentId: 'hyeyeon',            personaId: 'finance',             frameworkKey: 'finance',             name: '혜연',  nameEn: 'Diana' },
  { agentId: 'minseo',             personaId: 'marketing',           frameworkKey: 'marketing',           name: '민서',  nameEn: 'Stella' },
  { agentId: 'sujin_hr',           personaId: 'people_culture',      frameworkKey: 'people_culture',      name: '수진',  nameEn: 'Harper' },
  { agentId: 'junseo',             personaId: 'engineer',            frameworkKey: 'engineer',            name: '준서',  nameEn: 'Leo' },
  { agentId: 'yerin',              personaId: 'pm',                  frameworkKey: 'pm',                  name: '예린',  nameEn: 'Grace' },
  // Validation
  { agentId: 'donghyuk',           personaId: 'critic',              frameworkKey: 'critic',              name: '동혁',  nameEn: 'Blake' },
  { agentId: 'jieun',              personaId: 'ux',                  frameworkKey: 'ux',                  name: '지은',  nameEn: 'Maya' },
  { agentId: 'taejun',             personaId: 'legal',               frameworkKey: 'legal',               name: '윤석',  nameEn: 'Arthur' },
  // Special
  { agentId: 'navigator',      personaId: 'navigator',       frameworkKey: 'navigator',       name: '항해장',  nameEn: 'Navigator' },
] as const satisfies readonly AgentIdentity[];

/**
 * 정본에서 도출한 에이전트 ID 유니온. 다른 "공책"(lens/capabilities/BUILTIN)이
 * 이 타입으로 키잉되면, 등록 에이전트가 한 명이라도 빠질 때 *테스트가 아니라
 * 컴파일이* 거부한다 — minseo 누락이 구조적으로 불가능해진다.
 */
export type AgentId = typeof AGENT_REGISTRY[number]['agentId'];

/** 정본에서 도출한 personaId 유니온 (skills/personas/completion notes 키). */
export type PersonaId = typeof AGENT_REGISTRY[number]['personaId'];

// ─── Lookup Maps (lazy-init) ───

let _byAgentId: Map<string, AgentIdentity> | null = null;
let _byPersonaId: Map<string, AgentIdentity> | null = null;

function byAgentId(): Map<string, AgentIdentity> {
  if (!_byAgentId) {
    _byAgentId = new Map(AGENT_REGISTRY.map(a => [a.agentId, a]));
  }
  return _byAgentId;
}

function byPersonaId(): Map<string, AgentIdentity> {
  if (!_byPersonaId) {
    _byPersonaId = new Map(AGENT_REGISTRY.map(a => [a.personaId, a]));
  }
  return _byPersonaId;
}

// ─── Public API ───

/** agentId → personaId (skills, personas 키). 미등록 시 agentId 그대로 반환 (폴백). */
export function agentIdToPersonaId(agentId: string): string {
  return byAgentId().get(agentId)?.personaId ?? agentId;
}

/** agentId → frameworkKey (FRAMEWORK_PRIORITY 키). 미등록 시 agentId 그대로 반환. */
export function agentIdToFrameworkKey(agentId: string): string {
  return byAgentId().get(agentId)?.frameworkKey ?? agentId;
}

/** personaId → agentId. 미등록 시 personaId 그대로 반환. */
export function personaIdToAgentId(personaId: string): string {
  return byPersonaId().get(personaId)?.agentId ?? personaId;
}

/** agentId가 registry에 등록되어 있는지 확인. */
export function isRegisteredAgent(agentId: string): boolean {
  return byAgentId().has(agentId);
}

/** 전체 등록 에이전트 ID 목록. */
export function getAllAgentIds(): string[] {
  return AGENT_REGISTRY.map(a => a.agentId);
}
