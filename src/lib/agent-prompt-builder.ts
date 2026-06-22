/**
 * Agent Prompt Builder — 레벨 기반 프롬프트 컨텍스트 생성
 *
 * Lv.1: 빈 문자열 (기본 expertise + tone만 사용)
 * Lv.2: observation 3개 주입
 * Lv.3: observation 5개 + 크로스 컨텍스트
 * Lv.4: 전체 observation + 트랙레코드
 * Lv.5: 전체 + 자기개선 제안
 *
 * 프롬프트 차별화 상세 (전문 방법론 주입 등)는 별도 세션에서 연구.
 * 이번엔 observation 기반 개인화만.
 */

import type { Agent } from '@/stores/agent-types';

/**
 * 에이전트 레벨에 따라 프롬프트에 주입할 경험 컨텍스트.
 * Lv.1은 빈 문자열. Lv.2+부터 observation 주입.
 * 최대 600자 제한.
 */
export function buildAgentContext(agent: Agent): string {
  if (agent.level < 2) return '';

  const observations = Array.isArray(agent.observations) ? agent.observations : [];
  const maxObs = agent.level >= 4 ? observations.length
    : agent.level >= 3 ? 5
    : 3;

  const obs = observations
    .filter(o => o.confidence >= 0.3)
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, maxObs);

  if (obs.length === 0) return '';

  const lines = ['## Insights from previous work'];
  for (const o of obs) {
    lines.push(`- ${o.observation}`);
  }

  // Boss agent는 풍부한 연속성이 필요 → 더 긴 컨텍스트
  const maxChars = agent.origin === 'boss_sim' ? 900 : 600;
  return lines.join('\n').slice(0, maxChars);
}

/**
 * 웹 검색 결과를 프롬프트에 주입하기 위한 포맷.
 * 검색 결과가 있을 때만 호출.
 */
export function buildSearchContext(searchResults: SearchResult[]): string {
  if (searchResults.length === 0) return '';

  const lines = ['## Reference: Web search results'];
  for (const r of searchResults.slice(0, 5)) {
    lines.push(`- **${r.title}**: ${r.snippet}`);
    if (r.url) lines.push(`  Source: ${r.url}`);
  }

  return lines.join('\n').slice(0, 1200);
}

export interface SearchResult {
  title: string;
  snippet: string;
  url?: string;
}
