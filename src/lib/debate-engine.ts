/**
 * debate-engine.ts — Cross-Agent Debate (Phase 5)
 *
 * Critical stakes에서만 활성화.
 * Stage 1 결과를 Critic이 받아 반론을 생성한다.
 *
 * 구조:
 * - Round 1: 각 에이전트 독립 분석 (이미 Stage 1에서 완료)
 * - Round 2: Critic이 Stage 1 결과를 받아 "진짜 문제는 이거다" 반론
 * - Synthesis: orchestrator가 중복 제거 + 구체성 랭킹 + 최종 선택
 *
 * LLM 호출: Critic의 반론 생성에 1회만 사용.
 */

import { callLLMJson } from '@/lib/llm';
import { sanitizeForPrompt as sanitize } from '@/lib/persona-prompt';
import { getCurrentLanguage } from '@/lib/i18n';

type Locale = 'ko' | 'en';

/* ─── Types ─── */

export interface DebateInput {
  problemText: string;
  stage1Results: Array<{
    agentName: string;
    agentRole: string;
    framework: string | null;
    result: string;
  }>;
  criticName: string;
  criticExpertise: string;
  locale?: Locale;
}

export interface DebateResult {
  challenge: string;           // Critic의 핵심 반론
  targetAgent: string;         // 가장 취약한 분석을 낸 에이전트 이름
  weakestClaim: string;        // 가장 약한 주장
  alternativeView: string;     // 대안적 관점
  severity: 'critical' | 'important' | 'minor';
}

/* ─── Prompt ─── */

function buildDebatePromptKo(input: DebateInput): { system: string; user: string } {
  const system = `당신은 ${input.criticName}, ${input.criticExpertise}입니다.
팀원들이 제출한 분석 결과를 읽고 가장 위험한 맹점을 찾으세요.

규칙:
- "아무 계획에나 붙일 수 있는 말"은 금지. 이 계획만의 구체적 약점을 찾아야 합니다.
- 계획이 정말 견고하면 억지로 약점을 만들지 마세요 — 치명적 맹점이 없으면 severity를 "none"으로 두고 challenge에 "치명적 맹점 없음"이라고 정직하게 답하세요. (없는 우려·모순을 thorough해 보이려 제조하면 안 됩니다.)
- 약점이 있으면 가장 취약한 주장 1개를 골라 왜 위험한지 설명하세요.
- 대안적 관점을 제시하세요.
- severity: critical(계획 망침) | important(수정 요) | minor(개선) | none(치명적 맹점 없음).
- Always respond in Korean. 존댓말(해요체)로 간결하게, 사람을 비난하지 말고 분석의 약점만 짚으세요.

JSON으로 응답:
{
  "challenge": "핵심 반론 (3줄 이내, 맹점 없으면 그렇게)",
  "target_agent": "가장 약한 분석을 낸 팀원 이름",
  "weakest_claim": "그 팀원의 가장 약한 주장",
  "alternative_view": "대안적 관점",
  "severity": "critical | important | minor | none"
}`;

  const resultsText = input.stage1Results
    .map(r => `[${r.agentName} (${r.agentRole})${r.framework ? ` — ${r.framework}` : ''}]\n${r.result.slice(0, 800)}`)
    .join('\n\n---\n\n');

  const user = `프로젝트: <user-data>${sanitize(input.problemText)}</user-data>

팀원들의 분석 결과:

${resultsText}

이 분석들을 종합적으로 읽고, 가장 위험한 맹점을 찾아 반론을 제기하세요.`;

  return { system, user };
}

function buildDebatePromptEn(input: DebateInput): { system: string; user: string } {
  const system = `You are ${input.criticName}, ${input.criticExpertise}.
Read your teammates' analyses and find the most dangerous blind spot.

Rules:
- No generic critiques ("this could fail"). Find a specific weakness that applies ONLY to this plan.
- If the plan is genuinely solid, do NOT manufacture a weakness — set severity to "none" and say "no critical blind spot" in challenge. (Never invent a concern/contradiction to look thorough.)
- If there is a weakness, pick the single weakest claim and explain why it's dangerous.
- Offer an alternative viewpoint.
- severity: "critical" (breaks the plan) | "important" (fixable) | "minor" (cosmetic) | "none" (no critical blind spot).
- Always respond in English, concisely; critique the analysis, not the person.

Respond with JSON only:
{
  "challenge": "Core counter-argument (≤ 3 lines; if none, say so)",
  "target_agent": "Name of the teammate whose analysis is weakest",
  "weakest_claim": "Their weakest specific claim",
  "alternative_view": "An alternative view",
  "severity": "critical | important | minor | none"
}`;

  const resultsText = input.stage1Results
    .map(r => `[${r.agentName} (${r.agentRole})${r.framework ? ` — ${r.framework}` : ''}]\n${r.result.slice(0, 800)}`)
    .join('\n\n---\n\n');

  const user = `Project: <user-data>${sanitize(input.problemText)}</user-data>

Teammates' analyses:

${resultsText}

Read these together and surface the single most dangerous blind spot.`;

  return { system, user };
}

function buildDebatePrompt(input: DebateInput): { system: string; user: string } {
  const locale = input.locale || getCurrentLanguage();
  return locale === 'ko' ? buildDebatePromptKo(input) : buildDebatePromptEn(input);
}

/* ─── Main ─── */

/**
 * Critic 에이전트가 Stage 1 결과에 대해 반론을 생성한다.
 * LLM 호출 1회.
 */
export async function runDebateRound(input: DebateInput): Promise<DebateResult | null> {
  if (input.stage1Results.length === 0) return null;

  try {
    const { system, user } = buildDebatePrompt(input);

    interface LLMDebateResult {
      challenge: string;
      target_agent: string;
      weakest_claim: string;
      alternative_view: string;
      severity: string;
    }

    const result = await callLLMJson<LLMDebateResult>(
      [{ role: 'user', content: user }],
      {
        system,
        maxTokens: 600,
        shape: {
          challenge: 'string',
          target_agent: 'string',
          weakest_claim: 'string',
          alternative_view: 'string',
          severity: 'string',
        },
      },
    );

    return {
      challenge: result.challenge || '',
      targetAgent: result.target_agent || '',
      weakestClaim: result.weakest_claim || '',
      alternativeView: result.alternative_view || '',
      severity: (['critical', 'important', 'minor'].includes(result.severity) ? result.severity : 'important') as DebateResult['severity'],
    };
  } catch {
    return null;
  }
}
