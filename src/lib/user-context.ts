/**
 * User Context — 사용자에 대해 알고 있는 모든 것의 단일 소스.
 *
 * 두 가지 원천을 통합:
 * 1. Explicit (설정 > 내 프로필): 이름, 역할, 경력, 자유 소개
 * 2. Observed (항해장/Navigator): 세션 수, 지배 전략, override율, DQ 추세, 티어
 *
 * 프롬프트 빌더들은 이 모듈 하나만 호출하면 됨.
 */

import { sanitizeForPrompt } from './persona-prompt';
import type { Settings, DecisionQualityScore } from '@/stores/types';
import type { NavigatorProfile } from './navigator';

// ── Types ──

export interface UserProfile {
  name?: string;
  role?: string;
  seniority?: 'junior' | 'mid' | 'senior' | 'lead';
  context?: string;
}

export interface UserObservations {
  sessionCount: number;
  tier: 1 | 2 | 3;
  overrideRate: number;
  dominantStrategy: string | null;
  dqTrend: 'improving' | 'stable' | 'declining' | 'not_enough_data';
  avgPassRate: number;
}

export interface FullUserContext {
  profile: UserProfile;
  observations: UserObservations;
}

// ── Readers ──

export function getUserProfile(): UserProfile {
  try {
    const raw = typeof window !== 'undefined' ? localStorage.getItem('sot_settings') : null;
    if (!raw) return {};
    const s: Partial<Settings> = JSON.parse(raw);
    return {
      name: s.user_name || undefined,
      role: s.user_role || undefined,
      seniority: s.user_seniority || undefined,
      context: s.user_context || undefined,
    };
  } catch {
    return {};
  }
}

/**
 * UI 전용 — 설정 페이지에서 "AI가 관찰한 패턴" 표시용.
 * 프롬프트에는 사용하지 않음 (시뮬레이션 리뷰어가 시스템 메트릭을 아는 건 부자연스러움).
 */
export function getUserObservations(): UserObservations {
  try {
    // Dynamic require: navigator chain이 무겁고 SSR에서 문제될 수 있어서 lazy load
    const { buildNavigatorProfile } = require('./navigator') as { buildNavigatorProfile: () => NavigatorProfile };
    const { analyzeDQTrend, getDQScores } = require('./decision-quality') as {
      analyzeDQTrend: (scores: DecisionQualityScore[]) => { trend: string };
      getDQScores: () => DecisionQualityScore[];
    };

    const profile = buildNavigatorProfile();
    const dq = analyzeDQTrend(getDQScores() || []);

    return {
      sessionCount: profile.sessionCount,
      tier: profile.tier,
      overrideRate: profile.overrideRate,
      dominantStrategy: profile.dominantStrategy,
      dqTrend: dq.trend as UserObservations['dqTrend'],
      avgPassRate: profile.avgPassRate,
    };
  } catch {
    return {
      sessionCount: 0,
      tier: 1,
      overrideRate: 0,
      dominantStrategy: null,
      dqTrend: 'not_enough_data',
      avgPassRate: 0,
    };
  }
}

export function getFullUserContext(): FullUserContext {
  return {
    profile: getUserProfile(),
    observations: getUserObservations(),
  };
}

// ── Prompt Builders (target-specific) ──

const SENIORITY_KO: Record<string, string> = {
  junior: '주니어 (1-3년차)',
  mid: '미들 (4-7년차)',
  senior: '시니어 (8년차+)',
  lead: '팀장/리드급',
};
const SENIORITY_EN: Record<string, string> = {
  junior: 'Junior (1-3 yrs)',
  mid: 'Mid-level (4-7 yrs)',
  senior: 'Senior (8+ yrs)',
  lead: 'Team Lead',
};

/**
 * 리뷰 프롬프트용: 명시적 프로필만.
 * 관찰 데이터는 넣지 않음 — 시뮬레이션 리뷰어가 시스템 메트릭을 아는 건 부자연스러움.
 */
export function buildUserContextForReview(locale: 'ko' | 'en'): string {
  const profile = getUserProfile();
  const s = sanitizeForPrompt;
  const seniorityMap = locale === 'ko' ? SENIORITY_KO : SENIORITY_EN;

  if (!profile.name && !profile.role && !profile.seniority && !profile.context) return '';

  const lines: string[] = [];

  if (locale === 'ko') {
    lines.push('[이 문서를 작성한 사람]');
    if (profile.name) lines.push(`- ${s(profile.name)}, ${s(profile.role || '')}${profile.seniority ? `, ${seniorityMap[profile.seniority]}` : ''}`);
    else if (profile.role) lines.push(`- ${s(profile.role)}${profile.seniority ? `, ${seniorityMap[profile.seniority]}` : ''}`);
    else if (profile.seniority) lines.push(`- ${seniorityMap[profile.seniority]}`);
    if (profile.context) lines.push(`- ${s(profile.context)}`);
    // 경력별 구체적 지시
    if (profile.seniority === 'junior') {
      lines.push('→ 전문 용어 대신 쉬운 표현으로. 기본적인 실수도 짚어주세요.');
    } else if (profile.seniority === 'lead') {
      lines.push('→ 전략적 관점에서 피드백. 실행 디테일보다 방향성과 임팩트 중심으로.');
    } else {
      lines.push('→ 이 사람의 역할에 맞는 깊이로 피드백하세요.');
    }
  } else {
    lines.push('[About the document author]');
    if (profile.name) lines.push(`- ${s(profile.name)}, ${s(profile.role || '')}${profile.seniority ? `, ${seniorityMap[profile.seniority]}` : ''}`);
    else if (profile.role) lines.push(`- ${s(profile.role)}${profile.seniority ? `, ${seniorityMap[profile.seniority]}` : ''}`);
    else if (profile.seniority) lines.push(`- ${seniorityMap[profile.seniority]}`);
    if (profile.context) lines.push(`- ${s(profile.context)}`);
    if (profile.seniority === 'junior') {
      lines.push('→ Use plain language. Point out basic mistakes too.');
    } else if (profile.seniority === 'lead') {
      lines.push('→ Focus on strategic impact, not execution details.');
    } else {
      lines.push('→ Match feedback depth to this person\'s role.');
    }
  }

  return '\n' + lines.join('\n');
}

/**
 * Boss 시뮬레이터용: 명시적 프로필만 (팀장은 시스템 메타 정보를 모름).
 * All free-text fields are sanitized before embedding (prompt-injection guard,
 * per CLAUDE.md), and the block is localized so an English boss never receives
 * a Korean instruction block.
 */
export function buildUserContextForBoss(locale: 'ko' | 'en' = 'ko'): string {
  const profile = getUserProfile();
  if (!profile.name && !profile.role && !profile.seniority && !profile.context) return '';

  const s = sanitizeForPrompt;
  const seniorityMap = locale === 'ko' ? SENIORITY_KO : SENIORITY_EN;
  const parts: string[] = [];

  if (locale === 'ko') {
    if (profile.name) parts.push(`이름: ${s(profile.name)}`);
    if (profile.role) parts.push(`역할: ${s(profile.role)}`);
    if (profile.seniority) parts.push(`경력: ${seniorityMap[profile.seniority] || profile.seniority}`);
    if (profile.context) parts.push(`특이사항: ${s(profile.context)}`);
    return `\n\n## 이 부하직원 정보\n${parts.map(p => `- ${p}`).join('\n')}\n이 사람의 경력과 역할에 맞게 대화 수준을 맞추세요.`;
  }

  if (profile.name) parts.push(`Name: ${s(profile.name)}`);
  if (profile.role) parts.push(`Role: ${s(profile.role)}`);
  if (profile.seniority) parts.push(`Seniority: ${seniorityMap[profile.seniority] || profile.seniority}`);
  if (profile.context) parts.push(`Notes: ${s(profile.context)}`);
  return `\n\n## About this direct report\n${parts.map(p => `- ${p}`).join('\n')}\nMatch the conversation level to their role and seniority.`;
}

/**
 * 설정 페이지 UI용: 관찰 데이터를 사용자가 이해할 수 있는 언어로 요약.
 * 내부 용어(DQ, override rate, tier) 대신 자연어 사용.
 */
export function getObservationsSummary(locale: 'ko' | 'en' = 'ko'): {
  items: Array<{ label: string; value: string }>;
  hasData: boolean;
} {
  const obs = getUserObservations();
  if (obs.sessionCount < 2) return { items: [], hasData: false };

  const ko = locale === 'ko';
  const items: Array<{ label: string; value: string }> = [];

  // 사용 횟수 — 단순 숫자
  items.push({
    label: ko ? '사용 횟수' : 'Sessions',
    value: ko ? `${obs.sessionCount}회` : `${obs.sessionCount}`,
  });

  // 판단 추세 — "잘하고 있다" vs "꾸준하다" (DQ 용어 제거)
  const trendText = ko
    ? { improving: '점점 나아지고 있어요', stable: '꾸준히 잘 하고 있어요', declining: '최근 좀 러프했어요', not_enough_data: '아직 데이터를 모으는 중이에요' }
    : { improving: 'Getting better', stable: 'Consistently good', declining: 'Been rough lately', not_enough_data: 'Still collecting data' };
  items.push({
    label: ko ? '최근 추세' : 'Recent trend',
    value: trendText[obs.dqTrend] || trendText.not_enough_data,
  });

  // AI 제안 수정 빈도 — 높을 때만 표시, 자연어로
  if (obs.overrideRate > 0.2) {
    items.push({
      label: ko ? 'AI 제안 반영' : 'AI suggestion usage',
      value: obs.overrideRate > 0.5
        ? (ko ? '자주 직접 수정하는 편' : 'Often edits AI suggestions')
        : (ko ? '가끔 직접 수정함' : 'Sometimes edits AI suggestions'),
    });
  }

  return { items, hasData: true };
}
