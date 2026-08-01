import type { Agent } from '@/stores/agent-types';

const BUILTIN_LABELS: Record<Agent['group'], { ko: string; en: string }> = {
  research: { ko: '근거 확인', en: 'Evidence check' },
  strategy: { ko: '결정 구조', en: 'Decision structure' },
  production: { ko: '전문 검토', en: 'Specialist review' },
  validation: { ko: '위험 검토', en: 'Risk review' },
  special: { ko: '종합 정리', en: 'Synthesis' },
  people: { ko: '이해관계자 관점', en: 'Stakeholder view' },
};

export function publicAgentLabel(agent: Agent, locale: 'ko' | 'en'): string {
  if (agent.origin !== 'builtin') {
    return locale === 'en' && agent.nameEn ? agent.nameEn : agent.name;
  }
  return BUILTIN_LABELS[agent.group][locale];
}

export function isBuiltinReviewRole(agent: Agent): boolean {
  return agent.origin === 'builtin';
}
