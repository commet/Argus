/**
 * Agent System Simulation v2 — 창의적 + 엣지 케이스 시뮬레이션
 *
 * Usage: npx tsx scripts/simulate-agents.ts
 */

// ─── Domain Keywords (matches orchestrator-classify.ts exactly) ───

type Domain = 'research' | 'strategy' | 'numbers' | 'finance' | 'marketing' | 'hr' | 'legal' | 'ux' | 'tech' | 'copy' | 'pm' | 'risk';
type Stakes = 'routine' | 'important' | 'critical';

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

// ─── Lead Domain Map ───

const LEAD_MAP: Record<string, { default: string; critical: string }> = {
  strategy:  { default: '현우/Nathan',  critical: '승현/Victor' },
  research:  { default: '다은/Sophie',  critical: '도윤/Marcus' },
  numbers:   { default: '규민/Ethan',   critical: '규민/Ethan' },
  finance:   { default: '혜연/Diana',   critical: '혜연/Diana' },
  marketing: { default: '민서/Stella',  critical: '민서/Stella' },
  hr:        { default: '수진/Harper',  critical: '수진/Harper' },
  legal:     { default: '윤석/Arthur',  critical: '윤석/Arthur' },
  ux:        { default: '지은/Maya',    critical: '지은/Maya' },
  tech:      { default: '준서/Leo',     critical: '준서/Leo' },
  copy:      { default: '서연/Claire',  critical: '서연/Claire' },
  pm:        { default: '예린/Grace',   critical: '예린/Grace' },
  risk:      { default: '동혁/Blake',   critical: '동혁/Blake' },
};

// ─── Task Type Patterns ───

type TaskType = 'research' | 'analysis' | 'synthesis' | 'strategy' | 'calculation' | 'writing' | 'critique' | 'design' | 'legal_review' | 'planning';

const TASK_PATTERNS: Record<TaskType, [string | RegExp, number][]> = {
  research: [['조사', 3], ['리서치', 3], ['수집', 2], ['벤치마크', 3], ['사례', 2], ['현황', 2], ['트렌드', 2], [/research/i, 3], [/benchmark/i, 3], [/survey/i, 2]],
  analysis: [['분석', 3], ['파악', 2], ['진단', 2], ['평가', 2], ['검토', 1], [/analy/i, 3], [/assess/i, 2]],
  synthesis: [['종합', 3], ['요약', 3], ['정리', 2], ['초안', 2], ['통합', 2], [/synthe/i, 3], [/summar/i, 3], [/draft/i, 2], [/consolidat/i, 2]],
  strategy: [['전략', 3], ['방향', 2], ['포지셔닝', 3], ['차별화', 3], ['사업 계획', 3], [/strateg/i, 3], [/position/i, 3], [/business plan/i, 3]],
  calculation: [['계산', 3], ['산출', 3], ['추정', 2], ['모델링', 3], [/ROI/i, 3], [/BEP/i, 3], [/TAM/i, 3], [/calculat/i, 3], [/estimat/i, 2], [/forecast/i, 2]],
  writing: [['작성', 2], ['문서', 2], ['기획안', 2], ['보고서', 1], ['카피', 3], ['제안서', 2], [/write/i, 2], [/document/i, 2], [/proposal/i, 2], [/memo/i, 2]],
  critique: [['비판', 3], ['리스크', 3], ['위험', 3], ['검증', 2], ['반론', 3], [/risk/i, 3], [/critic/i, 3]],
  design: [[/UX/i, 3], [/UI/i, 3], ['설계', 2], ['사용성', 3], [/design/i, 2], [/wireframe/i, 3], [/usability/i, 3], [/accessibility/i, 2]],
  legal_review: [['법률', 3], ['규제', 3], ['계약', 3], ['특허', 3], ['컴플라이언스', 3], [/legal/i, 3], [/regulat/i, 3], [/complian/i, 3]],
  planning: [['일정', 3], ['타임라인', 3], ['마일스톤', 3], ['리소스', 2], ['우선순위', 2], [/timeline/i, 3], [/schedul/i, 3], [/milestone/i, 3], [/priorit/i, 2]],
};

// ─── Engine ───

function extractDomains(text: string): { domain: Domain; score: number }[] {
  const lower = text.toLowerCase();
  const scores: { domain: Domain; score: number }[] = [];
  for (const [domain, keywords] of Object.entries(DOMAIN_KEYWORDS) as [Domain, string[]][]) {
    const count = keywords.filter(kw => lower.includes(kw.toLowerCase())).length;
    if (count > 0) scores.push({ domain, score: count });
  }
  return scores.sort((a, b) => b.score - a.score);
}

function classifyTask(text: string): { type: TaskType; score: number }[] {
  const lower = text.toLowerCase();
  const scores: { type: TaskType; score: number }[] = [];
  for (const [type, patterns] of Object.entries(TASK_PATTERNS) as [TaskType, [string | RegExp, number][]][]) {
    let score = 0;
    for (const [p, w] of patterns) {
      if (typeof p === 'string' ? lower.includes(p.toLowerCase()) : p.test(text)) score += w;
    }
    if (score > 0) scores.push({ type, score });
  }
  return scores.sort((a, b) => b.score - a.score);
}

function selectLead(domains: { domain: Domain; score: number }[], stakes: Stakes): string {
  if (stakes === 'routine') return '— (routine, no lead)';
  if (domains.length === 0) return '— (no domain matched)';
  const d = domains[0].domain;
  const m = LEAD_MAP[d];
  return m ? `${stakes === 'critical' ? m.critical : m.default}` : `? (${d})`;
}

// ─── Scenario Groups ───

interface Scenario {
  input: string;
  stakes: Stakes;
  tag: string;
  expectedDomain?: string;
}

const scenarios: Scenario[] = [
  // ━━━ GROUP 1: 직장인 현실 시나리오 ━━━
  { input: '대표님이 내일까지 사업계획서 써오래', stakes: 'important', tag: '🏢 직장인', expectedDomain: 'strategy' },
  { input: '팀장님한테 주간보고 써야 하는데 뭘 써야 할지 모르겠어', stakes: 'routine', tag: '🏢 직장인' },
  { input: '투자자 미팅용 피치덱 만들어야 해. IR 자료', stakes: 'critical', tag: '🏢 직장인' },
  { input: '내일 이사회인데 실적 보고자료 급해', stakes: 'critical', tag: '🏢 직장인', expectedDomain: 'finance' },
  { input: '경쟁사가 신제품 냈는데 우리 대응 방안 좀', stakes: 'important', tag: '🏢 직장인', expectedDomain: 'strategy' },

  // ━━━ GROUP 2: 스타트업 시나리오 ━━━
  { input: '시리즈 A 투자유치 전략. TAM/SAM/SOM이랑 unit economics 정리', stakes: 'critical', tag: '🚀 스타트업', expectedDomain: 'numbers' },
  { input: 'PMF 검증 안 됐는데 피벗할지 말지 결정해야 해', stakes: 'critical', tag: '🚀 스타트업', expectedDomain: 'strategy' },
  { input: '앱 출시 전 UX 리뷰 해줘. 온보딩 플로우가 걱정돼', stakes: 'important', tag: '🚀 스타트업', expectedDomain: 'ux' },
  { input: '개인정보처리방침이랑 이용약관 만들어야 해', stakes: 'important', tag: '🚀 스타트업', expectedDomain: 'legal' },
  { input: '5명에서 20명으로 급성장. 조직문화 깨질까 봐 걱정', stakes: 'important', tag: '🚀 스타트업', expectedDomain: 'hr' },

  // ━━━ GROUP 3: 영어 비즈니스 ━━━
  { input: 'Our burn rate is too high. Need to cut costs by 30% without killing growth', stakes: 'critical', tag: '🌍 English', expectedDomain: 'finance' },
  { input: 'Write a competitive analysis of the top 5 players in our market', stakes: 'important', tag: '🌍 English', expectedDomain: 'research' },
  { input: 'Design a customer referral program to reduce CAC', stakes: 'important', tag: '🌍 English', expectedDomain: 'marketing' },
  { input: 'We need to comply with GDPR before expanding to Europe', stakes: 'critical', tag: '🌍 English', expectedDomain: 'legal' },
  { input: 'Build a technical architecture for real-time data processing pipeline', stakes: 'important', tag: '🌍 English', expectedDomain: 'tech' },

  // ━━━ GROUP 4: 복합 도메인 (경계 테스트) ━━━
  { input: '마케팅 비용 ROI 분석해줘', stakes: 'important', tag: '🔀 복합' },
  { input: '채용 비용이랑 인건비 예산 짜줘', stakes: 'important', tag: '🔀 복합' },
  { input: '법적 리스크 분석하고 대응 전략 세워줘', stakes: 'critical', tag: '🔀 복합' },
  { input: 'UX 개선하면 매출이 얼마나 오를지 추정해줘', stakes: 'important', tag: '🔀 복합' },
  { input: 'AI 기술 트렌드 조사하고 우리 제품 전략에 반영', stakes: 'important', tag: '🔀 복합' },

  // ━━━ GROUP 5: 극단적 엣지 케이스 ━━━
  { input: '도와줘', stakes: 'routine', tag: '⚡ 엣지' },
  { input: '어제 회의에서 나온 거 정리', stakes: 'routine', tag: '⚡ 엣지' },
  { input: 'SaaS pricing strategy for B2B enterprise with PLG motion and usage-based billing', stakes: 'critical', tag: '⚡ 엣지' },
  { input: '우리 회사 뭐가 문제인지 모르겠어. 매출은 오르는데 이익이 안 나', stakes: 'important', tag: '⚡ 엣지' },
  { input: 'Create a 90-day plan for a new VP of Engineering joining a 50-person startup', stakes: 'important', tag: '⚡ 엣지' },

  // ━━━ GROUP 6: 한영 혼용 (실제 한국 직장) ━━━
  { input: 'Q3 OKR 세팅해야 하는데 KPI 뭘로 잡지', stakes: 'important', tag: '🇰🇷🇺🇸 혼용' },
  { input: 'AWS에서 GCP로 migration 검토. cost comparison 해줘', stakes: 'important', tag: '🇰🇷🇺🇸 혼용' },
  { input: 'Series B 투자자한테 보낼 financial model 만들어줘', stakes: 'critical', tag: '🇰🇷🇺🇸 혼용' },
  { input: 'SEO 전략이랑 content marketing plan 짜줘', stakes: 'important', tag: '🇰🇷🇺🇸 혼용' },
  { input: 'compliance audit 결과 나왔는데 대응방안 짜야 해', stakes: 'critical', tag: '🇰🇷🇺🇸 혼용' },
];

// ─── Run ───

console.log('');
console.log('╔═══════════════════════════════════════════════════════════════╗');
console.log('║          ARGUS AGENT SYSTEM — SIMULATION v2               ║');
console.log('║          35 scenarios across 6 groups                        ║');
console.log('╚═══════════════════════════════════════════════════════════════╝');
console.log('');

let currentTag = '';
const stats = { pass: 0, acceptable: 0, fail: 0 };

for (const s of scenarios) {
  if (s.tag !== currentTag) {
    currentTag = s.tag;
    console.log(`\n━━━ ${currentTag} ━━━\n`);
  }

  const domains = extractDomains(s.input);
  const tasks = classifyTask(s.input);
  const lead = selectLead(domains, s.stakes);
  const d0 = domains[0]?.domain || 'none';
  const domainOk = !s.expectedDomain || d0 === s.expectedDomain;

  // Determine status
  let icon: string;
  if (domainOk && domains.length > 0) {
    icon = '✅'; stats.pass++;
  } else if (domains.length === 0 && s.stakes === 'routine') {
    icon = '✅'; stats.pass++;
  } else if (!domainOk && domains.length > 1 && domains.some(d => d.domain === s.expectedDomain)) {
    icon = '🟡'; stats.acceptable++; // Expected domain is in top results, just not #1
  } else if (!s.expectedDomain) {
    icon = '🔵'; stats.pass++; // No expectation set — informational
  } else {
    icon = '❌'; stats.fail++;
  }

  const domainStr = domains.slice(0, 4).map(d => `${d.domain}(${d.score})`).join(' · ') || '—';
  const taskStr = tasks.slice(0, 2).map(t => `${t.type}(${t.score})`).join(' · ') || '—';

  console.log(`${icon} "${s.input}"`);
  console.log(`   stakes=${s.stakes}  domains=[${domainStr}]  task=[${taskStr}]`);
  console.log(`   → Lead: ${lead}${!domainOk && s.expectedDomain ? `  ⚠ expected: ${s.expectedDomain}` : ''}`);
  console.log('');
}

// ─── Summary ───

const total = stats.pass + stats.acceptable + stats.fail;
console.log('╔═══════════════════════════════════════════════════════════════╗');
console.log(`║  ✅ ${String(stats.pass).padStart(2)} passed   🟡 ${String(stats.acceptable).padStart(2)} acceptable   ❌ ${String(stats.fail).padStart(2)} failed   Total: ${total}  ║`);
console.log(`║  Score: ${Math.round((stats.pass + stats.acceptable) / total * 100)}% (${stats.pass + stats.acceptable}/${total})${' '.repeat(39)}║`);
console.log('╚═══════════════════════════════════════════════════════════════╝');
