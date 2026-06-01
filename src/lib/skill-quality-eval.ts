/**
 * Skill Quality Eval v2 — 핵심 기준 + Exemplar 기반 LLM Judge
 *
 * v1 (69개 기준) → v2 (33개: structural 8 + content 20 + chaining 5)
 *
 * 설계 원칙:
 * - 기준은 적고 날카롭게 (단계당 5개 content eval)
 * - 각 기준에 PASS/FAIL exemplar → LLM judge 정확도 향상
 * - 1 eval = 1 prompt (한 프롬프트에 여러 기준 넣지 않음)
 * - Structural은 파이프라인 무결성에 필수인 것만
 *
 * 사용법:
 *   const result = evaluateSkillOutput('reframe', output);  // structural만 (즉시)
 *   const judge = buildContentJudge('reframe', output);      // LLM judge 프롬프트 배열
 */

export type SkillName = 'reframe' | 'recast' | 'rehearse' | 'refine' | 'argus';

/* ════════════════════════════════════
   1. Structural Evals (자동, 즉시)
   ════════════════════════════════════
   파이프라인이 깨지는 것만 잡는다.
   "있느냐 없느냐"가 아니라 "이것 없으면 다음 단계가 불가능한가?"
*/

export interface StructuralEval {
  id: string;
  description: string;
  check: (output: string) => boolean;
}

/** 저장 파일 vs 카드 출력 감지 */
function isSavedFormat(output: string): boolean {
  return /^#\s+[🎯📋👥🔧]/.test(output.trim());
}

/** build/decide context 감지 */
function detectContext(output: string): 'build' | 'decide' | 'unknown' {
  if (/context:\s*build|product\s*thesis|P0|MVP|user\s*story/i.test(output)) return 'build';
  if (/context:\s*decide|governing\s*idea|워크플로우/i.test(output)) return 'decide';
  return 'unknown';
}

const STRUCTURAL_EVALS: Record<SkillName, StructuralEval[]> = {
  reframe: [
    {
      id: 'has_context_contract',
      description: 'Context Contract 존재 (다음 단계로의 데이터 전달)',
      check: (o) => /Context Contract/i.test(o),
    },
    {
      id: 'has_assumptions_3plus',
      description: '가정이 3개 이상 (파이프라인 핵심 입력)',
      check: (o) => {
        const lines = o.split('\n').filter(l => /^[\s]*[-•·✓✗?]\s/.test(l));
        return lines.length >= 3;
      },
    },
  ],
  recast: [
    {
      id: 'has_context_contract',
      description: 'Context Contract 존재',
      check: (o) => /Context Contract/i.test(o),
    },
    {
      id: 'has_execution_structure',
      description: '실행 구조 존재 (decide: steps + actors, build: features + scope)',
      check: (o) => {
        if (detectContext(o) === 'build') return /P0|features|기능/i.test(o) && /scope|cut|✂|제외/i.test(o);
        return /Step\s*\d|🧑|🤖|actor/i.test(o);
      },
    },
  ],
  rehearse: [
    {
      id: 'has_context_contract',
      description: 'Context Contract 존재',
      check: (o) => /Context Contract/i.test(o),
    },
    {
      id: 'has_unspoken_risk',
      description: '침묵의 리스크가 1개 이상 — Argus 핵심 가치',
      check: (o) => /🔇|unspoken|침묵|\[unspoken\]/i.test(o),
    },
  ],
  refine: [
    {
      id: 'has_context_contract',
      description: 'Context Contract 존재',
      check: (o) => /Context Contract/i.test(o),
    },
    {
      id: 'has_convergence_status',
      description: '수렴 상태 명시 (converged: true/false)',
      check: (o) => /converged|수렴|Critical.*→/i.test(o),
    },
  ],
  argus: [
    {
      id: 'has_all_phases',
      description: '4단계 모두 실행됨',
      check: (o) => ['reframe', 'recast', 'rehearse', 'refine'].every(p => new RegExp(p, 'i').test(o)),
    },
    {
      id: 'has_dq_score',
      description: 'DQ 스코어 포함',
      check: (o) => /DQ\s*\d|Decision\s*Quality/i.test(o),
    },
  ],
};

/* ════════════════════════════════════
   2. Content Evals (LLM Judge)
   ════════════════════════════════════
   단계당 5개. 각 eval은 독립 프롬프트.
   Exemplar 포함 — judge 정확도의 핵심.
*/

export interface ContentEval {
  id: string;
  /** 한 문장 질문 — binary yes/no */
  question: string;
  /** 판정 기준선: 이 테스트로 PASS/FAIL을 가른다 */
  decision_line: string;
  /** PASS 예시 (다른 도메인에서) */
  pass_example: string;
  /** FAIL 예시 */
  fail_example: string;
}

const REFRAME_EVALS: ContentEval[] = [
  {
    id: 'frame_shift',
    question: '재정의된 질문이 원래 문제의 프레임(보는 각도)을 바꿨는가?',
    decision_line: '원래 질문에 동의하는 사람이 재정의된 질문을 보고 "그건 다른 질문인데?"라고 반응할 것인가?',
    pass_example: '원래: "AI 도입 전략" → 재정의: "AI 도입에 가장 저항이 큰 곳은 어디인가?" — 각도가 "도입"에서 "저항"으로 전환됨',
    fail_example: '원래: "AI 도입 전략" → 재정의: "효과적인 AI 도입 전략은 무엇인가?" — 같은 질문을 정중하게 다시 말한 것',
  },
  {
    id: 'assumptions_non_generic',
    question: '각 가정을 다른 프로젝트에 그대로 붙여넣어도 말이 되는가?',
    decision_line: '이 가정에서 프로젝트 이름/도메인을 지우면 의미가 사라지는가?',
    pass_example: '"CTO가 리뷰 시간 절약에 월 구독료를 낼 것이다" — AI 코드 리뷰 SaaS에만 해당',
    fail_example: '"시장에 수요가 있을 것이다" — 어떤 프로젝트든 해당됨',
  },
  {
    id: 'blind_spot_uncomfortable',
    question: '블라인드 스팟이 사용자에게 "그건 생각 안 해봤는데..."라는 반응을 유발하는가?',
    decision_line: '사용자가 이미 알고 있는 것인가, 아니면 처음 들어보는 관점인가?',
    pass_example: '"자동화의 경쟁자는 다른 도구가 아니라 멘토링 욕구다" — 기술 문제로 본 사용자에게 인간 관계 문제라고 지적',
    fail_example: '"경쟁이 치열할 수 있다" — 누구나 이미 아는 것',
  },
  {
    id: 'check_first_executable',
    question: '"먼저 답해야 할 질문"이 이번 주 안에 실행 가능한 구체적 행동인가?',
    decision_line: '이 항목을 내일 아침 할 일 목록에 넣을 수 있는가?',
    pass_example: '"CodeRabbit 사용자 리뷰에서 반복되는 불만 Top 3 조사" — 2시간이면 가능',
    fail_example: '"시장 조사를 해보세요" — 언제, 어떻게, 무엇을?',
  },
  {
    id: 'korean_natural',
    question: '한국어가 자연스럽고 번역체가 아닌가?',
    decision_line: '한국 회사 슬랙에서 팀장이 쓸 법한 문체인가?',
    pass_example: '"진출 전에 현지 파트너부터 만나봐야 하는 거 아닌가요?" — 구어체에 가까운 자연스러운 한국어',
    fail_example: '"~에 대하여 고려하시겠습니까", "~할 것을 추천드립니다" — 번역투, 과잉 존칭',
  },
];

const RECAST_EVALS: ContentEval[] = [
  {
    id: 'adds_value',
    question: '사용자가 직접 생각 못했을 구조/시퀀스/관점이 있는가?',
    decision_line: '사용자가 말한 것을 정리만 했는가, 아니면 새로운 순서/스텝/분리를 제안했는가?',
    pass_example: '사용자: "앱 만들고 싶어" → 계획: "고객 인터뷰 먼저, 프로토타입은 검증 후" — 순서를 바꿈',
    fail_example: '사용자: "앱 만들고 싶어" → 계획: "1. 기획 2. 디자인 3. 개발 4. 출시" — 누구나 아는 순서',
  },
  {
    id: 'governing_idea_falsifiable',
    question: '핵심 방향(governing idea)에 누군가 반대할 수 있는가?',
    decision_line: '"이 방향 아닌데?"라고 말할 수 있는 사람이 있는가?',
    pass_example: '"고객 검증 없이 개발하지 않는다" — 반대 가능: "MVP는 만들면서 검증해야지"',
    fail_example: '"좋은 제품을 만들자" — 반대 불가능',
  },
  {
    id: 'actor_assignment_justified',
    question: 'AI/Human 배정에 합리적 이유가 있고, ai_limitations에 해당하는 것이 AI에 배정되지 않았는가?',
    decision_line: '"왜 이게 AI 작업이지?"라고 물었을 때 답이 있는가?',
    pass_example: '"현지 파트너 인터뷰 = Human (관계 구축 + 비언어 신호)", "경쟁사 데이터 수집 = AI (공개 데이터 분석)"',
    fail_example: '모든 스텝이 AI, 또는 이유 없이 "Both"로 통일',
  },
  {
    id: 'reframe_context_used',
    question: '/reframe의 가정과 블라인드 스팟이 실행 계획에 반영되었는가?',
    decision_line: 'reframe 결과를 안 읽고도 이 계획을 만들 수 있었는가? (그렇다면 FAIL)',
    pass_example: 'reframe "멘토링 욕구" 블라인드 스팟 → recast에서 "시니어 온보딩 단계" 추가',
    fail_example: 'reframe에서 3개 가정을 의심했는데, recast에서 그 가정을 전제로 계획 수립',
  },
  {
    id: 'deliverables_concrete',
    question: '각 스텝/기능의 산출물이 구체적 artifact인가?',
    decision_line: '산출물을 보고 "이거 완료됐는지" 즉시 판단할 수 있는가?',
    pass_example: '"파트너십 가능성 평가표 (3곳 비교, Go/No-Go 기준 포함)"',
    fail_example: '"분석 결과", "보고서", "문서"',
  },
];

const REHEARSE_EVALS: ContentEval[] = [
  {
    id: 'personas_distinct_axes',
    question: '각 페르소나가 서로 다른 축(역할/이해관계/관점)에서 비판하는가?',
    decision_line: '모든 페르소나의 피드백을 섞어놓으면 누가 말했는지 구분이 되는가?',
    pass_example: '준호(사용자): "false positive가 많으면 끈다" vs 수진(구매자): "기존 도구 대비 차별점이 뭔데?"',
    fail_example: '두 명 다: "비용이 높다", "리스크가 있다" — 역할이 달라도 같은 말',
  },
  {
    id: 'critique_cites_plan',
    question: '비판이 /recast의 구체적 요소(기능명, 스텝, 가정, 수치)를 인용하는가?',
    decision_line: '이 비판에서 계획 내용을 지우면 빈 말이 되는가?',
    pass_example: '"P0 학습 엔진이 실제로는 ESLint 규칙 뽑아내는 수준이면 차별화 불가" — P0 기능명 직접 인용',
    fail_example: '"기술적 리스크가 있을 수 있습니다" — 어떤 계획에든 붙이는 말',
  },
  {
    id: 'unspoken_truly_political',
    question: '침묵의 리스크가 진짜 말하기 어려운 정치적/감정적/인센티브 문제인가?',
    decision_line: '이걸 회의에서 큰 소리로 말하면 어색해지는가?',
    pass_example: '"시니어에게 코드 리뷰는 비용이 아니라 영향력 행사 시간이다" — 권력/정체성 문제',
    fail_example: '"보안에 문제가 있을 수 있다" — 기술적 리스크를 unspoken이라 부른 것',
  },
  {
    id: 'makes_uncomfortable',
    question: '이 피드백 중 사용자를 불편하게 만드는 것이 하나라도 있는가?',
    decision_line: '사용자가 읽고 "그건 좀..." 하며 멈칫하는 순간이 있는가?',
    pass_example: '"셀프 디스럽션을 자발적으로 하는 사람은 없다 — 당신이 만드는 도구가 당신의 역할을 없앤다"',
    fail_example: '전부 건설적이고 정중. "좋은 방향이지만 몇 가지 보완하면..." — 리허설이 아니라 칭찬',
  },
  {
    id: 'devils_advocate_three_lenses',
    question: "Devil's Advocate가 3가지 관점(현실적 실패 / 침묵의 문제 / 1년 후 후회)을 다루는가?",
    decision_line: '3가지 중 빠진 것이 있는가?',
    pass_example: '"실패: 파일럿 2주 후 이탈 / 침묵: 구매자-사용자 인센티브 충돌 / 후회: Copilot이 내일 출시"',
    fail_example: '리스크 3개를 나열했지만 전부 "실패 시나리오" — 침묵의 문제와 후회 관점 누락',
  },
];

const REFINE_EVALS: ContentEval[] = [
  {
    id: 'substantive_change',
    question: '변경이 실질적인가? (표현이 아닌 구조/방향/기능이 바뀌었는가)',
    decision_line: 'diff를 보면 실제로 뭔가 달라졌는가, 아니면 같은 내용을 다른 말로 쓴 건가?',
    pass_example: '"시간 절약 → 영향력 확장"으로 thesis 자체가 바뀜, "컨벤션 학습 → 판단 학습"으로 core feature 재정의',
    fail_example: '"우려 사항을 반영하겠습니다", "모니터링하겠습니다" — 어떤 것도 실제로 바뀌지 않음',
  },
  {
    id: 'critique_addressed_not_dismissed',
    question: '/rehearse의 sharpest critique가 구체적으로 대응되었는가? ("검토했습니다"가 아닌)',
    decision_line: 'critique를 한 페르소나가 수정된 계획을 보면 "내 말이 반영됐네"라고 느끼는가?',
    pass_example: '수진: "Codacy랑 뭐가 달라?" → 대응: 포지셔닝을 linting에서 "판단 학습"으로 이동, 비교 자체를 회피',
    fail_example: '수진: "Codacy랑 뭐가 달라?" → 대응: "차별점을 더 명확히 하겠습니다" — 어떻게?',
  },
  {
    id: 'no_monitor_as_fix',
    question: '"모니터링하겠다", "지켜보겠다"를 해결책으로 사용하지 않았는가?',
    decision_line: '해결책에 구체적 메커니즘(수치 목표, 자동 차단, 구조 변경)이 있는가?',
    pass_example: '"false positive 방어: confidence threshold 85%+ only, dismiss 학습, 목표 <15%"',
    fail_example: '"이 리스크를 지속적으로 모니터링하겠습니다" — 방어 메커니즘 없음',
  },
  {
    id: 'convergence_justified',
    question: '수렴 판정에 정량적 근거가 있는가?',
    decision_line: '"왜 수렴했다고 판단했어?"라고 물었을 때 숫자로 답할 수 있는가?',
    pass_example: '"Critical 3 → 1, 준호: 파일럿 의향 (met), 수진: 조건부 (evidence 요구)" — 정량 근거',
    fail_example: '"충분히 논의했으므로 수렴합니다" — 근거 없는 선언',
  },
  {
    id: 'root_question_preserved',
    question: '수정된 계획이 여전히 /reframe의 근본 질문에 답하고 있는가?',
    decision_line: '피드백 반영하다가 원래 질문과 무관한 방향으로 변질되지 않았는가?',
    pass_example: 'reframe "틈새 SaaS 가능성" → refine 후에도 "독립 SaaS의 차별화 지점" 추구',
    fail_example: 'reframe "틈새가 있는가?" → refine에서 "어떻게 마케팅할까?"로 질문 자체가 변경됨',
  },
];

const CONTENT_EVALS: Record<SkillName, ContentEval[]> = {
  reframe: REFRAME_EVALS,
  recast: RECAST_EVALS,
  rehearse: REHEARSE_EVALS,
  refine: REFINE_EVALS,
  argus: [...REFRAME_EVALS.slice(0, 2), ...RECAST_EVALS.slice(0, 2), ...REHEARSE_EVALS.slice(0, 2), ...REFINE_EVALS.slice(0, 2)],
};

/* ════════════════════════════════════
   3. Pipeline Chaining Evals (자동)
   ════════════════════════════════════
*/

export interface ChainingEval {
  id: string;
  description: string;
  passed: boolean;
}

export function evaluatePipelineChaining(files: {
  reframe?: string;
  recast?: string;
  rehearse?: string;
  refine?: string;
}): ChainingEval[] {
  const evals: ChainingEval[] = [];

  // 1. Context Contract 존재 (모든 파일)
  for (const [stage, content] of Object.entries(files)) {
    if (content) {
      evals.push({
        id: `${stage}_contract`,
        description: `/${stage}: Context Contract 존재`,
        passed: /Context Contract/i.test(content),
      });
    }
  }

  // 2. 가정 체이닝 (reframe → recast)
  if (files.reframe && files.recast) {
    evals.push({
      id: 'assumptions_inherited',
      description: 'reframe 가정이 recast에 inherited로 전달',
      passed: /inherited|from reframe|\[from reframe\]|source:\s*reframe/i.test(files.recast),
    });
  }

  // 3. 페르소나 연속성 (recast → rehearse)
  if (files.recast && files.rehearse) {
    const names = files.recast.match(/name:\s*(\S+)/g)?.map(m => m.replace('name: ', '')) || [];
    const rehearseHasPersonas = names.some(n => n.length >= 2 && files.rehearse!.includes(n));
    evals.push({
      id: 'persona_continuity',
      description: 'recast 페르소나가 rehearse에서 동일 인물로 등장',
      passed: rehearseHasPersonas,
    });
  }

  // 4. 블라인드 스팟 추적 (reframe → rehearse)
  if (files.reframe && files.rehearse) {
    const blindSpot = files.reframe.match(/💡\s*(.+)/)?.[1] || '';
    const keywords = blindSpot.split(/[\s,]+/).filter(w => w.length >= 3).slice(0, 5);
    const semanticPairs: [string, string[]][] = [
      ['멘토링', ['영향력', '가르치', '역할', '코칭']],
      ['자동화', ['대체', '디스럽션', '위협']],
      ['경쟁', ['대안', '대체재', '기존']],
    ];
    const keywordMatch = keywords.some(k => files.rehearse!.toLowerCase().includes(k.toLowerCase()));
    const semanticMatch = semanticPairs.some(([key, eqs]) =>
      blindSpot.includes(key) && eqs.some(eq => files.rehearse!.toLowerCase().includes(eq))
    );
    evals.push({
      id: 'blind_spot_tracked',
      description: 'reframe 블라인드 스팟이 rehearse에서 반영 (키워드 또는 의미)',
      passed: keywordMatch || semanticMatch,
    });
  }

  // 5. Sharpest critique 해결 추적 (rehearse → refine)
  if (files.rehearse && files.refine) {
    evals.push({
      id: 'critique_resolved',
      description: 'rehearse sharpest critique가 refine에서 대응됨',
      passed: /sharpest.*critique|critique.*resolved/i.test(files.refine),
    });
  }

  return evals;
}

/* ════════════════════════════════════
   4. Evaluation Engine
   ════════════════════════════════════
*/

export interface EvalResult {
  skill: SkillName;
  structural: { id: string; passed: boolean }[];
  structural_pass_rate: number;
  content_evals: ContentEval[];
}

export function evaluateSkillOutput(skill: SkillName, output: string): EvalResult {
  const structuralDefs = STRUCTURAL_EVALS[skill] || [];
  const structural = structuralDefs.map(e => ({ id: e.id, passed: e.check(output) }));
  const passCount = structural.filter(s => s.passed).length;

  return {
    skill,
    structural,
    structural_pass_rate: structuralDefs.length > 0 ? Math.round((passCount / structuralDefs.length) * 100) / 100 : 1,
    content_evals: CONTENT_EVALS[skill] || [],
  };
}

/* ════════════════════════════════════
   5. LLM Judge Prompt Builder
   ════════════════════════════════════
   1 eval = 1 prompt. 한 프롬프트에 여러 기준 넣지 않음.
   → judge 정확도 극대화 (Zheng et al., "Judging LLM-as-a-Judge")
*/

export interface JudgePrompt {
  eval_id: string;
  system: string;
  user: string;
}

/**
 * 각 content eval에 대해 독립 LLM judge 프롬프트를 생성.
 * 1 eval = 1 prompt — multi-aspect 판정보다 single-aspect가 정확.
 */
export function buildContentJudgePrompts(skill: SkillName, output: string): JudgePrompt[] {
  const evals = CONTENT_EVALS[skill] || [];

  return evals.map(e => ({
    eval_id: e.id,
    system: `당신은 Argus /${skill} 출력물의 품질 심사관입니다.
하나의 기준만 판정합니다. PASS 또는 FAIL만 답하세요.

## 기준
${e.question}

## 판정 기준선
${e.decision_line}

## PASS 예시
${e.pass_example}

## FAIL 예시
${e.fail_example}

## 응답 형식
한 줄만: PASS 또는 FAIL, 그리고 한 문장 이유.
예: "PASS — 원래 '도입'에서 '저항'으로 관점이 전환됨"
예: "FAIL — 원래 질문을 정중하게 반복한 것에 불과"`,
    user: `아래 출력물을 위 기준으로 판정하세요.

<output>
${output.slice(0, 6000)}
</output>`,
  }));
}

/**
 * 모든 eval을 하나의 프롬프트로 합친 버전 (비용 절약용).
 * single-aspect보다 정확도 낮지만 API 호출 1회로 해결.
 */
export function buildBatchJudgePrompt(skill: SkillName, output: string): string {
  const evals = CONTENT_EVALS[skill] || [];

  const criteriaBlock = evals.map((e, i) => `### ${i + 1}. ${e.id}
**질문:** ${e.question}
**판정선:** ${e.decision_line}
**PASS 예시:** ${e.pass_example}
**FAIL 예시:** ${e.fail_example}`).join('\n\n');

  return `당신은 Argus /${skill} 출력물의 품질 심사관입니다.
아래 ${evals.length}개 기준을 각각 독립적으로 판정하세요.

${criteriaBlock}

## 평가 대상
<output>
${output.slice(0, 6000)}
</output>

## 응답 (JSON)
{ "results": [
${evals.map(e => `  { "id": "${e.id}", "pass": true/false, "reason": "한 문장" }`).join(',\n')}
] }`;
}

/* ════════════════════════════════════
   6. Test Scenarios
   ════════════════════════════════════
*/

export interface TestScenario {
  id: string;
  name: string;
  context: 'build' | 'decide';
  input: string;
}

export const TEST_SCENARIOS: TestScenario[] = [
  { id: 'sea_expansion', name: '동남아 시장 진출', context: 'decide', input: '우리 B2B SaaS를 동남아 시장으로 확장해야 할까?' },
  { id: 'freelancer_tool', name: '프리랜서 정산 도구', context: 'build', input: '프리랜서를 위한 클라이언트별 정산 추적 도구를 만들고 싶다' },
  { id: 'leadership_program', name: '리더십 교육', context: 'decide', input: '신임 팀장 대상 리더십 교육 프로그램을 도입해야 할지' },
  { id: 'ai_code_review', name: 'AI 코드 리뷰 SaaS', context: 'build', input: '개발자를 위한 AI 코드 리뷰 자동화 SaaS' },
  { id: 'org_restructure', name: '조직 개편', context: 'decide', input: '엔지니어링 조직을 기능별에서 프로덕트별로 전환해야 할까' },
];

/* ════════════════════════════════════
   7. Report Formatter
   ════════════════════════════════════
*/

export function formatEvalReport(result: EvalResult, chainingResults?: ChainingEval[]): string {
  const lines: string[] = [];
  const passed = result.structural.filter(s => s.passed).length;
  const total = result.structural.length;

  lines.push(`# /${result.skill} Eval`);
  lines.push('');
  lines.push(`## Structural (${passed}/${total})`);
  for (const s of result.structural) {
    lines.push(`${s.passed ? '✓' : '✗'} ${s.id}`);
  }

  lines.push('');
  lines.push(`## Content (${result.content_evals.length}개 — LLM judge)`);
  for (const e of result.content_evals) {
    lines.push(`? ${e.id}: ${e.question}`);
  }

  if (chainingResults?.length) {
    const cp = chainingResults.filter(e => e.passed).length;
    lines.push('');
    lines.push(`## Pipeline (${cp}/${chainingResults.length})`);
    for (const e of chainingResults) {
      lines.push(`${e.passed ? '✓' : '✗'} ${e.id}`);
    }
  }

  return lines.join('\n');
}
