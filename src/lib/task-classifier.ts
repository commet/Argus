/**
 * task-classifier.ts — 구조화된 Task 분류 엔진
 *
 * 키워드 카운팅이 아닌, 패턴 기반 다차원 분류.
 * 각 step을 { taskType, contextDomain, outputType }으로 분류하되,
 * 주변 step 문맥을 고려하여 모호한 분류를 해소한다.
 *
 * 설계 원칙 (OpenClaw):
 * - LLM 호출 없음. 결정론적.
 * - 같은 입력 → 항상 같은 출력.
 */

/* ─── Types ─── */

export type TaskType =
  | 'research'      // 조사, 데이터 수집, 벤치마크
  | 'analysis'      // 분석, 패턴 파악, 인사이트 도출
  | 'synthesis'     // 종합, 요약, 결론 도출 (다른 작업의 결과를 정리)
  | 'strategy'      // 전략 수립, 포지셔닝, 방향 설정
  | 'calculation'   // 수치 계산, 재무 모델링, 추정
  | 'writing'       // 문서 작성, 카피라이팅 (독립적 창작)
  | 'critique'      // 비판, 검증, 리스크 분석
  | 'design'        // UX/UI 설계, 사용자 경험 분석
  | 'legal_review'  // 법적 검토, 규제 확인
  | 'planning';     // 일정, 리소스, 프로젝트 관리

export type ContextDomain =
  | 'market'        // 시장, 경쟁사, 고객
  | 'finance'       // 재무, 비용, 매출, 투자
  | 'tech'          // 기술, 아키텍처, 구현
  | 'legal'         // 법률, 규제, 계약
  | 'ux'            // 사용자 경험, 인터페이스
  | 'ops'           // 운영, 프로세스, 효율 (사람 관련은 people)
  | 'people'        // 채용, 조직, 문화, 평가·보상 (HR 전담 — PM의 ops와 분리)
  | 'product'       // 제품, 기능, 로드맵
  | 'brand';        // 브랜드, 마케팅, 커뮤니케이션

export type OutputType =
  | 'report'        // 조사/분석 보고서
  | 'document'      // 기획서, 제안서, 메모
  | 'numbers'       // 수치, 표, 재무 모델
  | 'checklist'     // 체크리스트, 액션 아이템
  | 'risk_assessment' // 리스크 분석, 실패 시나리오
  | 'comparison'    // 비교 분석, 매트릭스
  | 'plan';         // 실행 계획, 일정, 로드맵

export interface TaskClassification {
  taskType: TaskType;
  secondaryType: TaskType | null;
  contextDomain: ContextDomain;
  outputType: OutputType;
  confidence: number;  // 0-1
}

/* ─── Pattern Rules ─── */

// 각 패턴은 [정규식 or 문자열, 가중치] 쌍. 가중치가 높을수록 강한 신호.
type PatternRule = [string | RegExp, number];

const TASK_TYPE_PATTERNS: Record<TaskType, PatternRule[]> = {
  research: [
    ['조사', 3], ['리서치', 3], ['수집', 2], ['탐색', 2], ['벤치마크', 3],
    ['사례', 2], ['현황', 2], ['트렌드', 2], ['데이터', 1],
    [/research/i, 3], [/benchmark/i, 3], [/survey/i, 2],
    [/explor/i, 2], [/investigat/i, 2], [/discover/i, 2], [/trend/i, 2],
    [/case\s+stud/i, 2], [/data\s+collect/i, 2],
  ],
  analysis: [
    ['분석', 3], ['파악', 2], ['진단', 2], ['평가', 2], ['검토', 1],
    ['비교 분석', 3], ['심층', 2], ['인사이트', 2],
    [/analy/i, 3], [/assess/i, 2],
    [/review/i, 1], [/evaluat/i, 2], [/diagnos/i, 2], [/examin/i, 2], [/insight/i, 2],
    [/deep\s+dive/i, 2],
  ],
  synthesis: [
    ['종합', 3], ['요약', 3], ['정리', 2], ['초안', 2], ['통합', 2],
    ['구성', 1], ['조합', 2], ['결론', 2],
    [/synthe/i, 3], [/summar/i, 3], [/consolidat/i, 2], [/draft/i, 2], [/conclusion/i, 2],
  ],
  strategy: [
    ['전략', 3], ['방향', 2], ['포지셔닝', 3], ['차별화', 3],
    ['비전', 2], ['로드맵', 2], ['진입', 2], ['성장', 1],
    ['사업 계획', 3], ['사업 전략', 3], ['비즈니스', 2], ['수립', 2],
    [/strateg/i, 3], [/position/i, 3], [/business plan/i, 3],
    [/vision/i, 2], [/differentiat/i, 3], [/go-to-market/i, 3], [/\bGTM\b/i, 3],
    [/growth/i, 1], [/market entry/i, 3],
  ],
  calculation: [
    ['계산', 3], ['산출', 3], ['추정', 2], ['모델링', 3], ['예측', 2],
    ['시뮬레이션', 3], [/\bROI\b/i, 3], [/\bBEP\b/i, 3], [/\bTAM\b/i, 3],
    ['손익', 3], ['단가', 2], ['원가', 2],
    [/calculat/i, 3], [/estimat/i, 2], [/model/i, 2], [/forecast/i, 2], [/simulat/i, 3],
  ],
  writing: [
    ['작성', 2], ['문서', 2], ['기획안', 2], ['보고서', 1], ['카피', 3],
    ['슬라이드', 2], ['제안서', 2], ['발표', 2], ['메모', 2],
    [/write/i, 2], [/document/i, 2], [/proposal/i, 2], [/report/i, 1], [/copy/i, 3],
    [/slide/i, 2], [/presentation/i, 2], [/memo/i, 2],
  ],
  critique: [
    ['비판', 3], ['리스크', 3], ['위험', 3], ['검증', 2], ['반론', 3],
    ['취약', 2], ['실패', 2], ['문제점', 2], ['약점', 2],
    [/risk/i, 3], [/critic/i, 3],
    [/weakness/i, 2], [/failure/i, 2], [/vulnerab/i, 2], [/flaw/i, 2],
    [/counterargument/i, 3], [/concern/i, 2], [/red\s+team/i, 3],
    [/pushback/i, 2],
  ],
  design: [
    [/\bUX\b/i, 3], [/\bUI\b/i, 3], ['설계', 2], ['프로토', 3], ['와이어', 3],
    ['사용성', 3], ['접근성', 2], ['인터페이스', 2], ['사용자 경험', 3],
    [/design/i, 2], [/proto/i, 3], [/wireframe/i, 3], [/usability/i, 3], [/accessibility/i, 2],
  ],
  legal_review: [
    ['법률', 3], ['규제', 3], ['계약', 3], ['특허', 3], ['라이선스', 3],
    ['컴플라이언스', 3], ['약관', 2], ['인허가', 3],
    [/legal/i, 3], [/regulat/i, 3], [/complian/i, 3],
    [/contract/i, 3], [/patent/i, 3], [/license/i, 3], [/terms\s+of/i, 2],
  ],
  planning: [
    ['일정', 3], ['타임라인', 3], ['마일스톤', 3], ['리소스', 2],
    ['우선순위', 2], ['스프린트', 3], ['배포', 2], ['출시', 1],
    [/timeline/i, 3], [/milestone/i, 3], [/schedul/i, 3], [/resource/i, 2],
    [/priorit/i, 2], [/sprint/i, 3], [/deploy/i, 2], [/launch/i, 1],
  ],
};

const DOMAIN_PATTERNS: Record<ContextDomain, PatternRule[]> = {
  market: [
    ['시장', 3], ['경쟁', 3], ['고객', 2], ['소비자', 2], ['점유율', 3],
    ['수요', 2], ['공급', 2], ['타겟', 2], [/market/i, 3], [/competitor/i, 3],
    [/customer/i, 2], [/consumer/i, 2], [/demand/i, 2], [/supply/i, 2], [/target/i, 2],
  ],
  finance: [
    ['재무', 3], ['비용', 2], ['매출', 3], ['수익', 3], ['투자', 3],
    ['예산', 2], ['자금', 2], ['가격', 2], [/financ/i, 3], [/revenue/i, 3],
    [/cost/i, 2], [/profit/i, 3], [/invest/i, 3], [/budget/i, 2], [/pricing/i, 2],
  ],
  tech: [
    ['기술', 2], ['아키텍처', 3], ['구현', 2], ['인프라', 3], ['스택', 2],
    [/\bAPI\b/i, 3], ['서버', 2], ['데이터베이스', 2], [/tech/i, 2],
    [/architecture/i, 3], [/infrastructure/i, 3], [/server/i, 2], [/database/i, 2],
    [/implementation/i, 2], [/stack/i, 2], [/engineer/i, 2], [/codebase/i, 2],
  ],
  legal: [
    ['법률', 3], ['규제', 3], ['계약', 3], ['특허', 3], ['개인정보', 3],
    [/legal/i, 3], [/regulat/i, 3], [/contract/i, 3], [/patent/i, 3], [/privacy/i, 3],
    [/\bGDPR\b/i, 3],
  ],
  ux: [
    [/\bUX\b/i, 3], [/\bUI\b/i, 3], ['사용자', 2], ['경험', 1], ['인터페이스', 2],
    ['프로토타입', 3], ['사용성', 3],
    [/user/i, 2], [/experience/i, 1], [/interface/i, 2], [/prototype/i, 3], [/usability/i, 3],
  ],
  ops: [
    ['운영', 2], ['프로세스', 2], ['효율', 1], ['자동화', 2], ['공급망', 2], ['물류', 2],
    [/operation/i, 2], [/process/i, 2],
    [/automation/i, 2], [/efficien/i, 1], [/workflow/i, 2], [/supply\s*chain/i, 2], [/logistics/i, 2],
  ],
  people: [
    ['채용', 3], ['인사', 3], ['조직', 2], ['인력', 2], ['문화', 2], ['온보딩', 3],
    ['변화관리', 3], ['보상', 2], ['평가 체계', 3], ['퇴사', 2], ['리더십', 2], ['팀워크', 2],
    [/\bHR\b/, 3], [/hiring/i, 3], [/recruit/i, 3], [/headcount/i, 3], [/staff(ing)?/i, 2],
    [/onboarding/i, 3], [/culture/i, 2], [/retention/i, 2], [/compensation/i, 2],
    [/performance\s+review/i, 3], [/org(anization)?\s+design/i, 3], [/leadership/i, 2], [/morale/i, 2],
  ],
  product: [
    ['제품', 2], ['기능', 1], ['서비스', 1], ['출시', 2],
    ['로드맵', 2], ['피처', 2],
    [/product/i, 2], [/feature/i, 1], [/service/i, 1], [/roadmap/i, 2],
    [/\bMVP\b/i, 3], [/launch/i, 2], [/release/i, 2],
  ],
  brand: [
    ['브랜드', 3], ['마케팅', 3], ['홍보', 2], ['캠페인', 3],
    ['메시지', 2], ['광고', 2], ['커뮤니케이션', 2],
    [/brand/i, 3], [/marketing/i, 3], [/campaign/i, 3], [/messaging/i, 2],
    [/advertis/i, 2], [/communication/i, 2],
    [/\bPR\b/, 3], [/announce/i, 2],
  ],
};

const OUTPUT_PATTERNS: Record<OutputType, PatternRule[]> = {
  report: [
    ['보고서', 3], ['리포트', 3], ['조사 결과', 3], ['분석 결과', 3], [/report/i, 3],
    [/findings/i, 3], [/analysis\s+result/i, 3],
  ],
  document: [
    ['기획안', 3], ['제안서', 3], ['기획서', 3], ['문서', 2], ['메모', 2],
    ['슬라이드', 2], ['발표', 2],
    [/proposal/i, 3], [/document/i, 2], [/memo/i, 2], [/slide/i, 2], [/deck/i, 3],
    [/presentation/i, 2],
  ],
  numbers: [
    ['재무', 2], ['수치', 3], ['모델', 2], ['표', 1], ['스프레드시트', 3],
    ['산출', 2], [/excel/i, 2],
    [/spreadsheet/i, 3], [/financial\s+model/i, 3], [/figures/i, 2], [/table/i, 1],
    [/metrics/i, 2], [/dashboard/i, 2], [/numbers/i, 2], [/financials/i, 2],
  ],
  checklist: [
    ['체크리스트', 3], ['액션', 2], ['할 일', 2], ['TODO', 3], ['점검', 2],
    [/checklist/i, 3], [/action\s+item/i, 2], [/to-?do/i, 2],
  ],
  risk_assessment: [
    ['리스크', 3], ['위험', 2], ['실패', 2], ['시나리오', 2], ['대응', 2],
    [/risk/i, 3], [/failure/i, 2], [/scenario/i, 2], [/mitigation/i, 2],
  ],
  comparison: [
    ['비교', 3], ['매트릭스', 3], ['대조', 2], ['벤치마크', 2], ['순위', 2],
    [/comparison/i, 3], [/matrix/i, 3], [/benchmark/i, 2], [/ranking/i, 2],
  ],
  plan: [
    ['계획', 2], ['일정', 3], ['로드맵', 3], ['타임라인', 3], ['실행', 1],
    ['마일스톤', 3],
    [/plan/i, 2], [/schedule/i, 3], [/roadmap/i, 3], [/timeline/i, 3], [/milestone/i, 3],
  ],
};

/* ─── Pattern Matching Engine ─── */

function matchPatterns<T extends string>(
  text: string,
  patterns: Record<T, PatternRule[]>,
): { best: T; scores: Map<T, number> } {
  const lower = text.toLowerCase();
  const scores = new Map<T, number>();

  for (const [type, rules] of Object.entries(patterns) as [T, PatternRule[]][]) {
    let score = 0;
    for (const [pattern, weight] of rules) {
      if (typeof pattern === 'string') {
        if (lower.includes(pattern.toLowerCase())) score += weight;
      } else {
        if (pattern.test(text)) score += weight;
      }
    }
    if (score > 0) scores.set(type, score);
  }

  // 최고 점수 타입 찾기
  let best: T | undefined;
  let bestScore = 0;
  for (const [type, score] of scores) {
    if (score > bestScore) { best = type; bestScore = score; }
  }

  return { best: best!, scores };
}

/* ─── Context-Aware Disambiguation ─── */

/**
 * 모호한 분류를 주변 step 문맥으로 해소.
 *
 * 핵심 규칙:
 * - "기획안 작성" 자체는 writing이지만, 앞 step이 research면 → synthesis
 * - "비용 분석"은 analysis이지만, 앞 step이 calculation이면 → calculation
 * - step이 프로젝트의 후반부에 있으면 synthesis/writing 확률 증가
 */
function disambiguateWithContext(
  classification: TaskClassification,
  stepIndex: number,
  siblingClassifications: (TaskClassification | null)[],
): TaskClassification {
  // 확신도가 높으면 그대로 유지
  if (classification.confidence >= 0.8) return classification;

  // 이전 step들의 주요 타입
  const prevTypes = siblingClassifications
    .slice(0, stepIndex)
    .filter(Boolean)
    .map(c => c!.taskType);

  // 규칙 1: 이전이 research/analysis고, 현재가 writing → synthesis로 보정
  if (
    classification.taskType === 'writing' &&
    prevTypes.some(t => t === 'research' || t === 'analysis')
  ) {
    return { ...classification, taskType: 'synthesis', secondaryType: 'writing', confidence: classification.confidence + 0.1 };
  }

  // 규칙 2: 이전이 calculation이고, 현재가 analysis → calculation으로 보정
  if (
    classification.taskType === 'analysis' &&
    prevTypes.includes('calculation')
  ) {
    return { ...classification, secondaryType: 'calculation', confidence: classification.confidence + 0.05 };
  }

  // 규칙 3: 마지막 step이고 writing → synthesis로 보정 (최종 정리 역할)
  if (
    classification.taskType === 'writing' &&
    stepIndex === siblingClassifications.length - 1 &&
    siblingClassifications.length > 1
  ) {
    return { ...classification, taskType: 'synthesis', secondaryType: 'writing', confidence: classification.confidence + 0.05 };
  }

  // 규칙 4: 이전 step에서 추출된 도메인이 현재 도메인보다 강하면 도메인 보정
  const prevDomains = siblingClassifications
    .slice(0, stepIndex)
    .filter(Boolean)
    .map(c => c!.contextDomain);

  if (prevDomains.length > 0) {
    // 가장 빈번한 이전 도메인
    const domainCounts = new Map<ContextDomain, number>();
    for (const d of prevDomains) domainCounts.set(d, (domainCounts.get(d) || 0) + 1);
    let dominantDomain: ContextDomain | undefined;
    let maxCount = 0;
    for (const [d, c] of domainCounts) {
      if (c > maxCount) { dominantDomain = d; maxCount = c; }
    }

    // 현재 도메인 confidence가 낮고, 이전 dominant가 뚜렷하면 보정
    if (dominantDomain && classification.confidence < 0.6) {
      return { ...classification, contextDomain: dominantDomain, confidence: classification.confidence + 0.05 };
    }
  }

  return classification;
}

/* ─── Single Step Classification ─── */

function classifySingleStep(
  taskText: string,
  expectedOutput: string,
): TaskClassification {
  const combined = `${taskText} ${expectedOutput}`;

  const taskResult = matchPatterns(combined, TASK_TYPE_PATTERNS);
  const domainResult = matchPatterns(combined, DOMAIN_PATTERNS);
  const outputResult = matchPatterns(combined, OUTPUT_PATTERNS);

  // confidence: 최고 점수 vs 차점 비율로 계산 (차이가 클수록 확실)
  const taskScores = [...taskResult.scores.values()].sort((a, b) => b - a);
  const taskConfidence = taskScores.length >= 2
    ? Math.min(1, (taskScores[0] - taskScores[1]) / taskScores[0] + 0.3)
    : taskScores.length === 1 ? 0.7 : 0.2;

  // secondary type
  const sortedTypes = [...taskResult.scores.entries()].sort((a, b) => b[1] - a[1]);
  const secondaryType = sortedTypes.length >= 2 ? sortedTypes[1][0] : null;

  return {
    taskType: taskResult.best || 'analysis',
    secondaryType,
    contextDomain: domainResult.best || 'product',
    outputType: outputResult.best || 'document',
    confidence: Math.min(1, taskConfidence),
  };
}

/* ─── Main: Batch Classification with Context ─── */

/**
 * 모든 step을 한 번에 분류. 2-pass:
 * 1. 각 step 독립 분류
 * 2. 문맥 기반 보정 (sibling step 참조)
 */
export function classifySteps(
  steps: { task: string; output: string }[],
  problemText?: string,
): TaskClassification[] {
  // Pass 1: 독립 분류
  const raw = steps.map(s => classifySingleStep(s.task, s.output));

  // problem text가 있으면 전체 도메인 힌트로 사용
  if (problemText) {
    const problemDomain = matchPatterns(problemText, DOMAIN_PATTERNS);
    if (problemDomain.best) {
      for (let i = 0; i < raw.length; i++) {
        if (raw[i].confidence < 0.5) {
          raw[i] = { ...raw[i], contextDomain: problemDomain.best };
        }
      }
    }
  }

  // Pass 2: 문맥 보정
  const refined = raw.map((cls, i) => disambiguateWithContext(cls, i, raw));

  return refined;
}
