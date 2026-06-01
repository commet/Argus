/**
 * Auto-Persona Extraction — 맥락 기반 자동 페르소나 생성
 *
 * 항로 재설정 + 선원 배치에서 축적된 데이터를 분석하여
 * 리허설에 필요한 이해관계자 2-3명을 자동 식별합니다.
 */

import { callLLMJson } from './llm';
import type { ReframeItem, RecastItem, Persona, SuggestedReviewer } from '@/stores/types';
import { generateId } from './uuid';

import { sanitizeForPrompt } from './persona-prompt';

export interface AutoPersona {
  name: string;
  role: string;
  influence: 'high' | 'medium' | 'low';
  priorities: string;
  communication_style: string;
  known_concerns: string;
  why_relevant: string;
}

/**
 * Extract 2-3 relevant personas from accumulated project context.
 * Uses LLM to analyze decompose + recast data.
 */
export async function extractPersonasFromContext(
  reframe: ReframeItem | null,
  recast: RecastItem,
): Promise<AutoPersona[]> {
  const analysis = recast.analysis;
  if (!analysis) return [];

  // Build rich context from all available data (sanitize user inputs)
  const s = sanitizeForPrompt;
  const contextParts: string[] = [];

  // From reframe
  if (reframe) {
    contextParts.push(`[원래 과제]\n${s(reframe.input_text)}`);
    if (reframe.analysis) {
      contextParts.push(`[재정의된 질문]\n${s(reframe.analysis.reframed_question || reframe.analysis.surface_task)}`);
    }
  }

  // From recast
  contextParts.push(`[핵심 방향]\n${s(analysis.governing_idea)}`);
  contextParts.push(`[최종 목표]\n${s(analysis.goal_summary)}`);

  if (analysis.steps) {
    const stepsSummary = analysis.steps.map((s, i) =>
      `${i + 1}. [${s.actor}] ${s.task}${s.checkpoint ? ' (체크포인트)' : ''}${s.judgment ? ` — 판단: ${s.judgment}` : ''}`
    ).join('\n');
    contextParts.push(`[실행 계획]\n${stepsSummary}`);
  }

  if (analysis.key_assumptions) {
    const assumptions = analysis.key_assumptions
      .map(a => `- ${a.assumption} (중요도: ${a.importance})`)
      .join('\n');
    contextParts.push(`[핵심 가정]\n${assumptions}`);
  }

  contextParts.push(`[선원 배치 입력 맥락]\n${s(recast.input_text)}`);

  const context = contextParts.join('\n\n');

  const system = `당신은 조직 분석 전문가입니다. 프로젝트 맥락을 분석하여, 이 계획을 검증할 때 반드시 고려해야 할 이해관계자 2-3명을 식별하세요.

이해관계자 선정 기준:
1. 이 결과물을 직접 받아볼 사람 (보고 대상, 의사결정자)
2. 이 계획의 성공에 자원·권한으로 영향을 미치는 사람
3. 이 계획의 현실성을 검증할 수 있는 현장 전문가

각 페르소나를 구체적이고 현실적으로 작성하세요:
- name: 한국식 성+직함 (예: "김 부장", "박 대표")
- role: 구체적 역할 (예: "영업본부장", "CFO", "현장 PM")
- influence: "high" (이 사람이 반대하면 계획이 무산) | "medium" (의견이 중요하지만 결정권은 없음) | "low" (참고 의견)
- priorities: 이 사람이 가장 중요하게 여기는 것 1-2개
- communication_style: 보고를 받을 때의 성향 (예: "숫자 중심, 결론부터", "맥락을 먼저 이해하고 싶어함")
- known_concerns: 이 프로젝트에 대해 우려할 가능성이 높은 것
- why_relevant: 이 사람에게 리허설을 받아야 하는 이유 한 문장

JSON 배열로만 응답하세요.`;

  try {
    const personas = await callLLMJson<AutoPersona[]>(
      [{ role: 'user', content: context }],
      { system, maxTokens: 1500 }
    );
    return Array.isArray(personas) ? personas.slice(0, 3) : [];
  } catch {
    return [];
  }
}

/* ────────────────────────────────────
   Blind Spot Persona Recommendation
   Phase 3: Active Adaptation — Axis Fingerprint 기반
   ──────────────────────────────────── */

import { getStorage, STORAGE_KEYS } from '@/lib/storage';

/** Persona archetypes mapped to assumption axes they naturally cover */
const AXIS_PERSONA_MAP: Record<string, { name: string; role: string; why: string }[]> = {
  customer_value: [
    { name: '고객 경험 담당자', role: 'CX 팀장', why: '고객 관점이 아직 충분히 탐색되지 않았습니다. 고객 가치 축을 검증할 수 있습니다.' },
    { name: '서비스 기획자', role: '프로덕트 매니저', why: '사용자 니즈를 대변하여 고객 가치 관점의 맹점을 보완합니다.' },
  ],
  feasibility: [
    { name: '기술 리드', role: 'CTO / 개발팀장', why: '실현 가능성 관점이 아직 충분히 탐색되지 않았습니다. 기술적 제약을 검증합니다.' },
    { name: '운영 담당자', role: 'COO / 운영팀장', why: '실행 가능성과 운영 복잡도를 현실적으로 평가합니다.' },
  ],
  business: [
    { name: '사업 전략가', role: 'CSO / 전략기획', why: '비즈니스 모델 관점이 아직 충분히 탐색되지 않았습니다. 수익성과 시장성을 검증합니다.' },
    { name: '재무 담당자', role: 'CFO / 재무팀장', why: '재무적 타당성과 투자 회수를 냉정하게 평가합니다.' },
  ],
  org_capacity: [
    { name: '조직문화 담당자', role: 'CHRO / 인사팀장', why: '조직 역량 관점이 아직 충분히 탐색되지 않았습니다. 인력과 문화적 준비도를 검증합니다.' },
    { name: '변화관리 전문가', role: '조직개발 매니저', why: '조직의 변화 수용력과 실행 역량을 현실적으로 평가합니다.' },
  ],
};

export interface BlindSpotRecommendation {
  name: string;
  role: string;
  why: string;
  axis: string;
  axis_label: string;
}

/**
 * Recommend a persona to cover the user's blind spot axis.
 * Returns null if no significant gap exists or insufficient data.
 *
 * Uses Sliding Window (last 10 decisions) per T6 principle.
 */
export function recommendBlindSpotPersona(
  existingPersonaRoles: string[],
): BlindSpotRecommendation | null {
  const reframeItems = getStorage<ReframeItem[]>(STORAGE_KEYS.REFRAME_LIST, []);
  const doneItems = reframeItems.filter(d => d.status === 'done' && d.analysis);
  const recentItems = doneItems.slice(-10);

  if (recentItems.length < 3) return null; // Not enough data

  const axisCounts: Record<string, number> = {
    customer_value: 0, feasibility: 0, business: 0, org_capacity: 0,
  };
  let total = 0;

  for (const item of recentItems) {
    for (const a of item.analysis!.hidden_assumptions || []) {
      if (a.axis && a.axis in axisCounts) {
        axisCounts[a.axis]++;
        total++;
      }
    }
  }

  if (total < 8) return null; // 최소 8개 가정이 있어야 축 분포를 신뢰 (과잉 해석 방지, buildLearningCurve와 통일)

  const axisLabels: Record<string, string> = {
    customer_value: '고객 가치', feasibility: '실현 가능성',
    business: '비즈니스', org_capacity: '조직 역량',
  };

  // Find weakest axis (significantly below average)
  const avgPct = 100 / Object.keys(axisCounts).length; // 25%
  let weakestAxis: string | null = null;
  let weakestPct = Infinity;

  for (const [axis, count] of Object.entries(axisCounts)) {
    const pct = (count / total) * 100;
    if (pct < avgPct * 0.5 && pct < weakestPct) {
      weakestPct = pct;
      weakestAxis = axis;
    }
  }

  if (!weakestAxis) return null;

  // Pick a persona archetype that doesn't overlap with existing personas
  const candidates = AXIS_PERSONA_MAP[weakestAxis] || [];
  const existingLower = existingPersonaRoles.map(r => r.toLowerCase());
  const pick = candidates.find(
    c => !existingLower.some(r => r.includes(c.role.toLowerCase().split('/')[0].trim()))
  ) || candidates[0];

  if (!pick) return null;

  return {
    ...pick,
    axis: weakestAxis,
    axis_label: axisLabels[weakestAxis] || weakestAxis,
  };
}

/**
 * Convert AutoPersona to a full Persona object for the store.
 */
export function autoPersonaToFull(auto: AutoPersona | SuggestedReviewer): Persona {
  const isSuggested = 'decision_style' in auto;
  return {
    id: generateId(),
    name: auto.name,
    role: auto.role,
    organization: '',
    priorities: auto.priorities,
    communication_style: auto.communication_style,
    known_concerns: auto.known_concerns,
    relationship_notes: auto.why_relevant,
    influence: auto.influence,
    decision_style: isSuggested ? (auto as SuggestedReviewer).decision_style : undefined,
    risk_tolerance: isSuggested ? (auto as SuggestedReviewer).risk_tolerance : undefined,
    success_metric: isSuggested ? (auto as SuggestedReviewer).success_metric : undefined,
    extracted_traits: isSuggested
      ? [
          { analytical: '데이터 중심', intuitive: '직관적', consensus: '합의 중시', directive: '결단력' }[(auto as SuggestedReviewer).decision_style] || '',
          { low: '리스크 회피', medium: '균형적', high: '도전적' }[(auto as SuggestedReviewer).risk_tolerance] || '',
          ...(auto.priorities || '').split(/[,、·]/).map(t => t.trim()).filter(Boolean).slice(0, 1),
        ].filter(Boolean)
      : (auto.priorities || '').split(/[,、·]/).map(t => t.trim()).filter(Boolean).slice(0, 3),
    user_description: undefined,
    feedback_logs: [],
    is_example: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}
