/**
 * Observation Engine — 에이전트가 사용자에 대해 학습하는 시스템
 *
 * 작업 승인/거부 패턴에서 규칙 기반으로 observation 생성.
 * 에이전트당 5회째 작업마다 LLM 배치 분석.
 *
 * Observation이 쌓이면 Lv.2+ 프롬프트에 주입되어
 * 에이전트가 사용자에게 맞춤화된 결과물을 생산.
 */

import { useAgentStore } from '@/stores/useAgentStore';
import { callLLMJson } from '@/lib/llm';
import { getCurrentLanguage } from '@/lib/i18n';
import type { AgentObservation } from '@/stores/agent-types';

// ─── 규칙 기반: 승인 시 ───

export function onTaskApproved(agentId: string, task: string, result: string): void {
  const store = useAgentStore.getState();
  const agent = store.getAgent(agentId);
  if (!agent) return;

  // 승인 횟수 세기
  const approvals = store.activities.filter(
    a => a.agent_id === agentId && a.type === 'task_approved',
  ).length;

  // 3회째 승인: 선호도 observation 생성
  if (approvals === 3) {
    const ko = getCurrentLanguage() === 'ko';
    store.addObservation(agentId, {
      category: 'preference',
      observation: ko
        ? `이 사용자는 ${agent.role} 관점의 결과물에 만족하는 경향이 있다`
        : `This user tends to be satisfied with output from the ${agent.role} perspective`,
    });
  }

  // 작업 내용에서 패턴 추출
  const domainObs = extractDomainPattern(agentId, task);
  if (domainObs) {
    store.addObservation(agentId, domainObs);
  }

  // 5회마다 LLM 배치 분석 (비동기, 비차단)
  if (approvals > 0 && approvals % 5 === 0) {
    runBatchAnalysis(agentId).catch(() => {});
  }
}

// ─── 규칙 기반: 거부 시 ───

export function onTaskRejected(agentId: string, task: string): void {
  const store = useAgentStore.getState();
  const agent = store.getAgent(agentId);
  if (!agent) return;

  // 거부 시 기존 선호도 observation 약화 (match both Korean and English phrasing)
  const prefObs = agent.observations.find(
    o => o.category === 'preference' && (o.observation.includes('만족하는 경향') || o.observation.includes('tends to be satisfied')),
  );
  if (prefObs) {
    // confidence 감소 (-0.2)
    const updated = agent.observations.map(o =>
      o.id === prefObs.id
        ? { ...o, confidence: Math.max(0, o.confidence - 0.2) }
        : o,
    ).filter(o => o.confidence >= 0.1);
    store.updateAgent(agentId, { observations: updated });
  }

  // 거부 패턴 기록
  const rejections = store.activities.filter(
    a => a.agent_id === agentId && a.type === 'task_rejected',
  ).length;

  if (rejections === 2) {
    const ko = getCurrentLanguage() === 'ko';
    store.addObservation(agentId, {
      category: 'communication_style',
      observation: ko
        ? `이 사용자는 ${agent.role}의 결과물 톤이나 깊이를 조정해야 할 수 있다`
        : `This user may need the ${agent.role}'s output tone or depth adjusted`,
    });
  }
}

// ─── 도메인 패턴 추출 (규칙 기반) ───

function getDomainKeywords(): Record<string, string> {
  const ko = getCurrentLanguage() === 'ko';
  return ko ? {
    'B2B': 'B2B 비즈니스',
    'SaaS': 'SaaS 제품',
    '스타트업': '스타트업',
    '투자': '투자/펀딩',
    '마케팅': '마케팅',
    '앱': '모바일 앱',
    'AI': 'AI/ML',
    '커머스': '이커머스',
    '교육': '교육/에듀테크',
    '헬스': '헬스케어',
    '핀테크': '핀테크/금융',
    '콘텐츠': '콘텐츠/미디어',
    'startup': '스타트업',
    'investment': '투자/펀딩',
    'marketing': '마케팅',
    'commerce': '이커머스',
    'education': '교육/에듀테크',
    'health': '헬스케어',
    'fintech': '핀테크/금융',
    'content': '콘텐츠/미디어',
  } : {
    'B2B': 'B2B business',
    'SaaS': 'SaaS product',
    '스타트업': 'startup',
    '투자': 'investment/funding',
    '마케팅': 'marketing',
    '앱': 'mobile app',
    'AI': 'AI/ML',
    '커머스': 'e-commerce',
    '교육': 'education/edtech',
    '헬스': 'healthcare',
    '핀테크': 'fintech',
    '콘텐츠': 'content/media',
    'startup': 'startup',
    'investment': 'investment/funding',
    'marketing': 'marketing',
    'commerce': 'e-commerce',
    'education': 'education/edtech',
    'health': 'healthcare',
    'fintech': 'fintech',
    'content': 'content/media',
  };
}

function extractDomainPattern(
  agentId: string,
  task: string,
): Pick<AgentObservation, 'category' | 'observation'> | null {
  const store = useAgentStore.getState();
  const agent = store.getAgent(agentId);
  if (!agent) return null;

  // 이미 도메인 observation이 있으면 스킵 (match both Korean and English phrasing)
  if (agent.observations.some(o => o.category === 'work_pattern' && (o.observation.includes('분야') || o.observation.includes('domain')))) {
    return null;
  }

  const ko = getCurrentLanguage() === 'ko';
  const text = task.toLowerCase();
  for (const [keyword, domain] of Object.entries(getDomainKeywords())) {
    if (text.includes(keyword.toLowerCase())) {
      return {
        category: 'work_pattern',
        observation: ko
          ? `이 사용자의 프로젝트는 ${domain} 분야와 관련이 있다`
          : `This user's project is related to the ${domain} domain`,
      };
    }
  }

  return null;
}

// ─── LLM 배치 분석 (5회마다, 비동기) ───

async function runBatchAnalysis(agentId: string): Promise<void> {
  const store = useAgentStore.getState();
  const agent = store.getAgent(agentId);
  if (!agent) return;

  // 최근 5개 활동 수집
  const recent = store.activities
    .filter(a => a.agent_id === agentId && (a.type === 'task_completed' || a.type === 'task_approved' || a.type === 'task_rejected'))
    .slice(-5);

  if (recent.length < 3) return;

  const locale = getCurrentLanguage();
  const agentName = (locale === 'en' && agent.nameEn) ? agent.nameEn : agent.name;
  const agentRole = (locale === 'en' && agent.roleEn) ? agent.roleEn : agent.role;

  const taskSummary = recent.map(a => {
    const status = a.type === 'task_rejected'
      ? (locale === 'ko' ? '거부됨' : 'rejected')
      : (locale === 'ko' ? '승인됨' : 'approved');
    return `- ${a.context.slice(0, 80)} → ${status}`;
  }).join('\n');

  const existingObs = agent.observations
    .map(o => o.observation)
    .join(', ');

  const noneLabel = locale === 'ko' ? '없음' : 'none';

  try {
    const userPrompt = locale === 'ko'
      ? `이 에이전트(${agentName}, ${agentRole})의 최근 작업 기록:
${taskSummary}

기존 관찰: ${existingObs || noneLabel}

이 사용자에 대해 새로 파악할 수 있는 구체적인 것이 하나 있다면?
기존 관찰과 중복되지 않는 새로운 인사이트만.
없으면 observation: null.

JSON: { "observation": "한 줄 관찰 또는 null", "category": "preference|skill_gap|communication_style|work_pattern" }`
      : `This agent's (${agentName}, ${agentRole}) recent task history:
${taskSummary}

Existing observations: ${existingObs || noneLabel}

Is there one new, specific thing we can learn about this user?
Only surface insights that don't duplicate existing observations.
If nothing new, return observation: null.

JSON: { "observation": "one-line observation or null", "category": "preference|skill_gap|communication_style|work_pattern" }`;

    const systemPrompt = locale === 'ko'
      ? '사용자의 업무 패턴을 분석하는 관찰자. 구체적이고 실용적인 관찰만. Always respond in Korean.'
      : "You are an observer analyzing the user's work patterns. Only surface concrete, practical observations. Always respond in English.";

    const result = await callLLMJson<{
      observation: string | null;
      category: 'preference' | 'skill_gap' | 'communication_style' | 'work_pattern';
    }>(
      [{ role: 'user', content: userPrompt }],
      {
        system: systemPrompt,
        maxTokens: 150,
        shape: { observation: 'string', category: 'string' },
      },
    );

    if (result.observation && result.observation !== 'null') {
      store.addObservation(agentId, {
        category: result.category || 'preference',
        observation: result.observation,
      });
    }
  } catch {
    // LLM 실패 시 무시 — observation은 보조 기능
  }
}

// ─── Phase 3: Boss Chat 메타 관찰 추출 ───

// Boss chat is Korean-domain by design; topic keywords stay Korean.
const TOPIC_KEYWORDS: Record<string, string> = {
  'B2B': 'B2B 비즈니스', 'SaaS': 'SaaS 제품', '스타트업': '스타트업',
  '투자': '투자/펀딩', '마케팅': '마케팅', '앱': '모바일 앱', 'AI': 'AI/ML',
  '커머스': '이커머스', '교육': '교육/에듀테크', '헬스': '헬스케어',
  '핀테크': '핀테크/금융', '콘텐츠': '콘텐츠/미디어',
  '연봉': '연봉/보상', '협상': '협상', '승진': '승진/경력',
  '퇴사': '이직/퇴사', '피드백': '피드백', '평가': '성과 평가',
  '보고': '보고/발표', '기획': '기획안', '제안': '제안서',
  '일정': '일정/마감', '지연': '프로젝트 지연', '갈등': '팀 갈등',
  '재택': '재택근무', '회의': '회의 문화', '리더': '리더십',
};

/**
 * 규칙 기반: Boss 대화에서 토픽 키워드만 추출 (프라이버시 경계).
 * 원본 문장 절대 포함 안 함. 카테고리 라벨만 반환.
 */
export function summarizeBossChatTopic(
  messages: Array<{ role: string; content: string }>,
): string {
  const allText = messages.map(m => m.content).join(' ').toLowerCase();
  const matched: string[] = [];

  for (const [keyword, label] of Object.entries(TOPIC_KEYWORDS)) {
    if (allText.includes(keyword.toLowerCase()) && !matched.includes(label)) {
      matched.push(label);
    }
  }

  return matched.slice(0, 3).join(', ') || '';
}

/**
 * 토픽 요약으로 boss agent에 observation 생성.
 * 반복 토픽이면 기존 observation reinforce.
 */
export function extractBossChatObservation(agentId: string, topic: string): void {
  const store = useAgentStore.getState();
  const agent = store.getAgent(agentId);
  if (!agent || !topic) return;

  // 기존에 비슷한 토픽 observation이 있으면 reinforce
  const existing = agent.observations.find(
    o => o.category === 'work_pattern' && o.observation.includes(topic.split(',')[0]),
  );
  if (existing) {
    store.reinforceObservation(agentId, existing.id);
    return;
  }

  store.addObservation(agentId, {
    category: 'work_pattern',
    observation: `이 사용자가 ${topic} 관련 대화를 상사와 나눴다`,
  });
}

// ─── Phase 4: Workspace → Boss 업데이트 ───

import type { DMFeedbackResult } from '@/stores/types';

/**
 * Boss 리뷰 완료 후 boss agent observation 업데이트.
 * DM 피드백의 핵심 우려와 승인 조건을 관찰로 축적.
 */
export function onBossReviewCompleted(agentId: string, feedback: DMFeedbackResult): void {
  const store = useAgentStore.getState();
  const agent = store.getAgent(agentId);
  if (!agent) return;

  // Critical 우려 → boss_feedback_theme observation
  const criticalConcerns = (feedback.concerns || []).filter(c => c.severity === 'critical');
  for (const concern of criticalConcerns.slice(0, 2)) {
    const summary = concern.text.slice(0, 70);
    // 기존에 비슷한 관찰 있으면 reinforce
    const existing = agent.observations.find(
      o => o.category === 'preference' && o.observation.includes(summary.slice(0, 20)),
    );
    if (existing) {
      store.reinforceObservation(agentId, existing.id);
    } else {
      store.addObservation(agentId, {
        category: 'preference',
        observation: `이 팀장은 "${summary}"에 민감하다`,
      });
    }
  }

  // 승인 조건 → observation
  if (feedback.approval_condition) {
    const condSummary = feedback.approval_condition.slice(0, 70);
    const existing = agent.observations.find(
      o => o.category === 'preference' && o.observation.includes('승인 조건'),
    );
    if (existing) {
      // 기존 승인 조건 업데이트 (replace)
      const updated = agent.observations.map(o =>
        o.id === existing.id
          ? { ...o, observation: `이 팀장의 승인 조건: ${condSummary}`, confidence: Math.min(0.95, o.confidence + 0.15) }
          : o,
      );
      store.updateAgent(agentId, { observations: updated });
    } else {
      store.addObservation(agentId, {
        category: 'preference',
        observation: `이 팀장의 승인 조건: ${condSummary}`,
      });
    }
  }
}

// ─── Boss 패시브 교정 — 유저 반응 패턴 분석 ───

type ReactionType = 'accept' | 'pushback' | 'amused' | 'disengage' | 'neutral';

const REACTION_PATTERNS: Array<{ type: ReactionType; keywords: string[] }> = [
  { type: 'accept', keywords: ['네', '알겠', '그렇죠', '맞습니다', '이해했', '그럴게요', '감사합니다', '확인했', 'ㅇㅇ', '넵', '네네'] },
  { type: 'pushback', keywords: ['너무', '좀 그건', '아닌데', '아닌 것 같', '너무하', '심한', '과하', '좀 다른', '그건 아닌', '동의 못', '에이', '아니'] },
  { type: 'amused', keywords: ['ㅋㅋ', 'ㅋ', 'ㅎㅎ', 'ㅎ', '진짜요', '소름', '맞아', '딱 그래', '실화', '대박', '웃기', '찐이', '와'] },
  { type: 'disengage', keywords: ['그건 그렇고', '다른 얘기', '아무튼', '넘어가', '됐고', '그냥'] },
];

/**
 * 유저 메시지에서 boss에 대한 반응 분류.
 * 짧은 메시지(20자 이하)일수록 반응 신호가 강함.
 */
export function classifyUserReaction(userMessage: string): ReactionType {
  const text = userMessage.toLowerCase().trim();

  for (const pattern of REACTION_PATTERNS) {
    if (pattern.keywords.some(kw => text.includes(kw))) {
      return pattern.type;
    }
  }
  return 'neutral';
}

/**
 * 대화 전체의 반응 패턴 요약.
 * Boss 교정에 사용: 어떤 톤이 잘 맞고 어떤 톤이 반발을 사는지.
 */
export function analyzeBossCalibration(
  messages: Array<{ role: string; content: string }>,
): { dominant: ReactionType; counts: Record<ReactionType, number> } {
  const counts: Record<ReactionType, number> = {
    accept: 0, pushback: 0, amused: 0, disengage: 0, neutral: 0,
  };

  // 유저 메시지만 분석 (assistant 메시지 제외)
  for (const msg of messages) {
    if (msg.role !== 'user') continue;
    const reaction = classifyUserReaction(msg.content);
    counts[reaction]++;
  }

  // 가장 빈번한 반응
  const dominant = (Object.entries(counts) as Array<[ReactionType, number]>)
    .filter(([type]) => type !== 'neutral')
    .sort((a, b) => b[1] - a[1])[0]?.[0] || 'neutral';

  return { dominant, counts };
}

/**
 * 대화 종료 시 반응 패턴을 boss agent observation으로 저장.
 * 사용자가 아무것도 안 해도 자동 실행.
 */
export function applyBossCalibration(agentId: string, messages: Array<{ role: string; content: string }>): void {
  const store = useAgentStore.getState();
  const agent = store.getAgent(agentId);
  if (!agent || messages.length < 4) return; // 최소 2회 교환 필요

  const { dominant, counts } = analyzeBossCalibration(messages);

  // 반응 기반 교정 observation
  if (dominant === 'pushback' && counts.pushback >= 2) {
    const existing = agent.observations.find(o => o.observation.includes('톤을 조절'));
    if (existing) {
      store.reinforceObservation(agentId, existing.id);
    } else {
      store.addObservation(agentId, {
        category: 'communication_style',
        observation: '이 팀장의 톤을 조절해야 한다 — 사용자가 반발하는 경향',
      });
    }
  }

  if (dominant === 'amused' && counts.amused >= 2) {
    const existing = agent.observations.find(o => o.observation.includes('톤이 잘 맞'));
    if (existing) {
      store.reinforceObservation(agentId, existing.id);
    } else {
      store.addObservation(agentId, {
        category: 'communication_style',
        observation: '이 팀장의 현재 톤이 잘 맞는다 — 사용자가 공감하는 경향',
      });
    }
  }

  if (dominant === 'accept' && counts.accept >= 3) {
    const existing = agent.observations.find(o => o.observation.includes('현재 강도가 적절'));
    if (existing) {
      store.reinforceObservation(agentId, existing.id);
    } else {
      store.addObservation(agentId, {
        category: 'communication_style',
        observation: '이 팀장의 현재 강도가 적절하다 — 사용자가 자연스럽게 수용',
      });
    }
  }

  if (counts.disengage >= 2) {
    store.addObservation(agentId, {
      category: 'communication_style',
      observation: '이 팀장이 주제를 벗어나거나 관심 밖의 반응을 할 때가 있다',
    });
  }
}

/**
 * 저장 시 캘리브레이션 — "좀 다름" 선택 시 세부 교정.
 */
export function applyExplicitCalibration(
  agentId: string,
  calibration: 'more_direct' | 'more_soft' | 'different_tone',
): void {
  const store = useAgentStore.getState();
  const agent = store.getAgent(agentId);
  if (!agent) return;

  const calibrationMap: Record<string, string> = {
    more_direct: '실제 팀장은 이 프로필보다 더 직설적이고 단호하다',
    more_soft: '실제 팀장은 이 프로필보다 더 부드럽고 우회적이다',
    different_tone: '실제 팀장의 말투는 이 프로필과 다소 다르다',
  };

  // 기존 캘리브레이션 observation 교체
  const existing = agent.observations.find(o => o.source === 'calibration' || o.observation.includes('실제 팀장은'));
  if (existing) {
    const updated = agent.observations.map(o =>
      o.id === existing.id
        ? { ...o, observation: calibrationMap[calibration], confidence: 0.6, source: 'calibration' as const }
        : o,
    );
    store.updateAgent(agentId, { observations: updated });
  } else {
    // source: 'calibration' → 자동으로 confidence 0.6 할당됨
    store.addObservation(agentId, {
      category: 'communication_style',
      observation: calibrationMap[calibration],
      source: 'calibration',
    });
  }
}
