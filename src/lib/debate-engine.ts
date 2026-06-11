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
- 가장 취약한 주장 1개를 골라서 왜 위험한지 설명하세요.
- 대안적 관점을 제시하세요.
- severity: 이 문제가 계획을 망칠 수 있으면 critical, 수정하면 되면 important, 개선 수준이면 minor.
- Always respond in Korean. 간결하게.

JSON으로 응답:
{
  "challenge": "핵심 반론 (3줄 이내)",
  "target_agent": "가장 약한 분석을 낸 팀원 이름",
  "weakest_claim": "그 팀원의 가장 약한 주장",
  "alternative_view": "대안적 관점",
  "severity": "critical | important | minor"
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
- Pick the single weakest claim and explain why it's dangerous.
- Offer an alternative viewpoint.
- severity: "critical" if this would break the plan, "important" if fixable, "minor" if cosmetic.
- Always respond in English, concisely.

Respond with JSON only:
{
  "challenge": "Core counter-argument (≤ 3 lines)",
  "target_agent": "Name of the teammate whose analysis is weakest",
  "weakest_claim": "Their weakest specific claim",
  "alternative_view": "An alternative view",
  "severity": "critical | important | minor"
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
