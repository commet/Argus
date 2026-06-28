/**
 * orchestrator-classify.ts — 입력 분류 (결정론적, LLM 호출 없음)
 *
 * 사용자 입력 + interview signals를 기반으로 stakes/domain/decisionType을 결정.
 * 이 분류가 에이전트 선택과 프레임워크 배정의 기준이 된다.
 */

import type { InterviewSignals } from '@/stores/types';

/* ─── Types ─── */

export type Domain = 'research' | 'strategy' | 'numbers' | 'finance' | 'marketing' | 'hr' | 'legal' | 'ux' | 'tech' | 'copy' | 'pm' | 'risk';
export type Stakes = 'routine' | 'important' | 'critical';

export interface InputClassification {
  stakes: Stakes;
  domains: Domain[];
  decisionType: string;   // signals.nature 기반
  agentCount: number;     // stakes → 배정 에이전트 수 상한
}

/* ─── Domain Keyword Map ─── */

const DOMAIN_KEYWORDS: Record<Domain, string[]> = {
  research: ['조사', '리서치', '자료', '사례', '시장 조사', '시장 현황', '트렌드', '벤치마크', '데이터', '현황', 'research', 'benchmark', 'market research', 'competitive analysis', 'survey', 'landscape'],
  strategy: ['전략', '사업계획', '사업 계획', '방향', '비전', '포지셔닝', '경쟁', '차별화', '로드맵', '진입', '피벗', 'PMF', 'strategy', 'positioning', 'pivot', 'business plan', 'competitive advantage'],
  numbers: ['숫자', '수치', '비용', '매출', '수익', 'ROI', 'BEP', '단가', '투자', 'TAM', 'revenue', 'unit economics', 'estimate', 'cost', 'burn rate', 'pricing', 'CAC', 'LTV'],
  legal: ['법률', '법적', '규제', '계약', '특허', '라이선스', '컴플라이언스', '약관', '인허가', '개인정보', 'legal', 'compliance', 'regulation', 'GDPR', 'PIPA', 'patent', 'contract', 'terms of service'],
  ux: ['UX', 'UI', '사용자', '인터페이스', '프로토타입', '사용성', '접근성', 'user experience', 'usability', 'wireframe', 'user journey', 'onboarding flow'],
  tech: ['기술', '아키텍처', '구현', '인프라', '스택', 'API', '성능', '확장', 'architecture', 'implementation', 'migration', 'microservice', 'database', 'backend', 'frontend', 'DevOps'],
  copy: ['문서', '기획안', '보고서', '카피', '메시지', '슬라이드', '발표', '제안서', '메모', 'document', 'proposal', 'memo', 'report', 'pitch deck', 'presentation'],
  pm: ['일정', '타임라인', '마일스톤', '리소스', '우선순위', '스프린트', 'OKR', 'KPI', 'timeline', 'milestone', 'priority', 'sprint', 'roadmap', '90-day plan'],
  risk: ['리스크', '위험', '실패', '장애', '취약', '대응', 'risk', 'failure', 'vulnerability', 'threat', 'mitigation'],
  finance: ['재무', '재무제표', '손익', '실적', '현금흐름', '회계', '밸류에이션', 'DCF', 'K-IFRS', '세금', '세무', '이익', 'financial', 'financial statement', 'cash flow', 'valuation', 'accounting', 'P&L', 'profit', 'earnings'],
  marketing: ['마케팅', '마케팅 예산', '캠페인', '채널', '퍼널', '그로스', '광고', 'SEO', 'SNS', 'GTM', 'marketing', 'campaign', 'growth', 'funnel', 'brand', 'go-to-market', 'referral', 'content marketing', 'acquisition'],
  hr: ['채용', '조직설계', '조직 개편', '변화관리', 'HR', '인사', '평가', '보상', '문화', '온보딩', 'hiring', 'org design', 'culture', 'talent', 'organizational change', 'retention', 'team building'],
};

/* ─── Stakes Mapping ─── */

function classifyStakes(signals?: InterviewSignals): Stakes {
  if (!signals?.stakes) return 'important'; // 기본값: important
  switch (signals.stakes) {
    case 'irreversible': return 'critical';
    case 'important': return 'important';
    case 'experiment': return 'routine';
    case 'unknown_stakes': return 'important';
    default: return 'important';
  }
}

function stakesToAgentCount(stakes: Stakes, stepCount: number): number {
  const maxByStakes = stakes === 'critical' ? 4 : stakes === 'important' ? 3 : 2;
  return Math.min(maxByStakes, stepCount);
}

/* ─── Domain Extraction ─── */

// Ambient vocabulary: words that appear in almost any product/decision text and
// therefore carry little discriminating domain signal. Counted at a low weight
// so a launch/strategy decision that merely says "사용자/user" a lot no longer
// ranks UX first — the canonical keyword false-positive ("I implemented a policy
// at work" → code agent). domains[0] feeds the synthesis focus lens, so a
// trustworthy ranking still matters even though the synthesizer is now neutral.
const AMBIENT_KEYWORDS = new Set(['사용자', 'user', '데이터', 'data', '현황']);
const AMBIENT_WEIGHT = 0.3;

function extractDomains(texts: string[]): Domain[] {
  const combined = texts.join(' ').toLowerCase();
  const scores: [Domain, number][] = [];

  for (const [domain, keywords] of Object.entries(DOMAIN_KEYWORDS) as [Domain, string[]][]) {
    let score = 0;
    for (const kw of keywords) {
      const k = kw.toLowerCase();
      // Short ASCII abbreviations (hr/ux/ui/api/pr/it...) must match on a WORD
      // BOUNDARY — plain substring gave false positives that flipped the whole
      // domain (through→hr, luxury→ux, capital→api, build→ui).
      const present = /^[a-z]{2,3}$/.test(k)
        ? new RegExp(`\\b${k}\\b`).test(combined)
        : combined.includes(k);
      if (present) score += AMBIENT_KEYWORDS.has(k) ? AMBIENT_WEIGHT : 1;
    }
    if (score > 0) scores.push([domain, score]);
  }

  scores.sort((a, b) => b[1] - a[1]);
  // 상위 3개 도메인까지만 (너무 많으면 의미 없음)
  return scores.slice(0, 3).map(s => s[0]);
}

/* ─── Decision Type ─── */

function classifyDecisionType(signals?: InterviewSignals): string {
  if (!signals?.nature) return 'needs_analysis';
  return signals.nature; // known_path | needs_analysis | no_answer | on_fire
}

/* ─── Main ─── */

export function classifyInput(
  problemText: string,
  steps: { task: string; output: string }[],
  signals?: InterviewSignals,
): InputClassification {
  const stakes = classifyStakes(signals);
  const allTexts = [problemText, ...steps.map(s => `${s.task} ${s.output}`)];
  const domains = extractDomains(allTexts);
  const decisionType = classifyDecisionType(signals);
  const agentCount = stakesToAgentCount(stakes, steps.length);

  return { stakes, domains, decisionType, agentCount };
}
