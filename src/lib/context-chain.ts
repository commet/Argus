/**
 * Context Chain — Phase 0: 타입드 맥락 파이프라인
 *
 * 각 단계의 산출물을 구조화된 데이터로 추출하여
 * 다음 단계에 정확하게 전달한다.
 * 마크다운 연결이 아닌 타입 안전 파이프라인.
 */

import type {
  ReframeItem,
  ReframeContext,
  RecastItem,
  RecastContext,
  RehearsalContext,
  FeedbackRecord,
  HiddenAssumption,
  KeyAssumption,
} from '@/stores/types';
import { getCurrentLanguage } from '@/lib/i18n';

/** Locale-aware label map for injectReframeContext / injectRecastContext */
function getContextLabels() {
  const ko = getCurrentLanguage() === 'ko';
  return ko ? {
    reframeHeader: '## 항로 재설정에서 도출된 맥락',
    originalTask: '원래 과제', reframedQuestion: '재정의된 질문',
    reframingReason: '리프레이밍 이유',
    doubtedTitle: '### 의심된 전제 (key_assumptions 최우선 — 검증 단계 필수)',
    doubtedTag: '(사용자 평가: 의심됨)', doubtedWhy: '의심 이유', ifWrong: '틀리면',
    uncertainTitle: '### 불확실한 전제 (key_assumptions에 포함 — 검증 방법 제시)',
    uncertainTag: '(사용자 평가: 불확실)', uncertainWhy: '불확실 이유',
    confirmedTitleAsBasis: '### 확인된 전제 (계획의 근거로 활용하세요)',
    confirmedTitleRef: '### 확인된 전제 (참고, 재검증 불필요)',
    confirmedTag: '(확인됨)',
    legacyAssumptionsTitle: '### 전제 (평가 미완료 — key_assumptions에 포함시키세요)',
    legacyIfFalse: '만약 아니라면',
    riskAwarenessTitle: '### 사용자 리스크 인식',
    riskAwarenessLine: '- 사용자가 전제의 절반 이상을 의심합니다. 보수적으로 설계하고, 검증 단계를 앞쪽에 배치하세요.',
    natureKnown: '이 과제는 검증된 방법이 있습니다. 실행의 구체성에 집중하세요.',
    natureAnalysis: '분석이 필요한 과제입니다. 데이터와 전문성 기반으로 접근하세요.',
    natureExplore: '탐색적 과제입니다. 작은 실험과 학습 루프를 설계하세요.',
    natureFire: '긴급 상황입니다. 즉각 대응과 근본 해결을 구분하세요.',
    goalClear: '목표가 명확합니다. 달성 경로에 집중하세요.',
    goalDirection: '방향만 있고 구체적 목표가 없습니다. 목표를 구체화하는 단계를 포함하세요.',
    goalCompeting: '목표가 충돌합니다. 이해관계자별 우선순위 정렬이 필요합니다.',
    goalUnclear: '목표가 불분명합니다. goal_summary를 특히 구체적으로 작성해주세요.',
    stakesIrreversible: '되돌리기 어려운 결정입니다. 검증 단계를 실행 전에 배치하세요.',
    historyFailed: '과거에 비슷한 시도가 실패했습니다. "이번에는 다른 점"을 명확히 하세요.',
    uncertaintyWhy: '사용자가 "왜 해야 하는지" 불확실해합니다. 목적과 가치를 명확히 해주세요.',
    uncertaintyWhat: '사용자가 "무엇을 해야 하는지" 불확실해합니다. 범위를 구체적으로 정의해주세요.',
    uncertaintyHow: '사용자가 "어떻게 해야 하는지" 불확실해합니다. 실행 방법론에 집중해주세요.',
    uncertaintyNone: '사용자는 정리가 필요한 상태입니다. 구조화에 집중해주세요.',
    successUnclear: '성공 기준이 불명확합니다. goal_summary를 특히 구체적으로 작성해주세요.',
    contextSignalsTitle: '### 사용자 맥락 신호',
    aiLimitTitle: '### AI 한계 (이 부분은 사람에게 배정하세요)',
    recastHeader: '## 선원 배치에서 설계된 실행 계획',
    governingIdea: '핵심 방향', situation: '상황', complication: '문제', resolution: '해결',
    designRationale: '설계 근거',
    executionFlowTitle: '### 실행 흐름 (⚑=체크포인트, ★=크리티컬패스)',
    actorAi: 'AI', actorHuman: '사람', actorBoth: '협업',
    keyAssumptionsTitle: '### 핵심 가정 (공격 대상)',
    userDoubtedTitle: '### 사용자가 의심한 전제 (우선 검증 대상)',
    reframeUnverifiedTitle: '### 항로 재설정에서 미확인된 전제',
    aiLimitPersonaTitle: '### AI 한계 (이 영역은 사람이 판단해야 함)',
    originalDesignHeader: '## 원래 설계 맥락 (수정 시 위반하지 마세요)',
    criticalPath: '크리티컬 패스', rootQuestion: '근본 질문', aiLimitShort: 'AI 한계',
    impactUnknown: '영향 미확인',
  } : {
    reframeHeader: '## Context from Reframe stage',
    originalTask: 'Original task', reframedQuestion: 'Reframed question',
    reframingReason: 'Why reframed',
    doubtedTitle: '### Doubted premises (top priority for key_assumptions — verification step required)',
    doubtedTag: '(user evaluation: doubted)', doubtedWhy: 'Why doubted', ifWrong: 'If wrong',
    uncertainTitle: '### Uncertain premises (include in key_assumptions — propose how to verify)',
    uncertainTag: '(user evaluation: uncertain)', uncertainWhy: 'Why uncertain',
    confirmedTitleAsBasis: '### Confirmed premises (use as basis for the plan)',
    confirmedTitleRef: '### Confirmed premises (reference only, re-verification unnecessary)',
    confirmedTag: '(confirmed)',
    legacyAssumptionsTitle: '### Premises (not evaluated — include in key_assumptions)',
    legacyIfFalse: 'If it\'s not',
    riskAwarenessTitle: '### User risk awareness',
    riskAwarenessLine: '- The user doubts more than half of the premises. Design conservatively and place verification steps early.',
    natureKnown: 'This task has a proven approach. Focus on execution specifics.',
    natureAnalysis: 'Analysis-heavy task. Lead with data and domain expertise.',
    natureExplore: 'Exploratory task. Design small experiments and learning loops.',
    natureFire: 'Urgent situation. Separate immediate response from root-cause fix.',
    goalClear: 'Goal is clear. Focus on the path to achieving it.',
    goalDirection: 'Direction only, no concrete goal. Include a step to concretize the goal.',
    goalCompeting: 'Goals conflict. Stakeholder priority alignment is needed.',
    goalUnclear: 'Goal is unclear. Be especially concrete in goal_summary.',
    stakesIrreversible: 'Irreversible decision. Place verification before execution.',
    historyFailed: 'A similar past attempt failed. Make it clear what\'s different this time.',
    uncertaintyWhy: 'User is unsure "why to do this." Clarify purpose and value.',
    uncertaintyWhat: 'User is unsure "what to do." Define scope concretely.',
    uncertaintyHow: 'User is unsure "how to do this." Focus on execution methodology.',
    uncertaintyNone: 'User needs to organize their thinking. Focus on structuring.',
    successUnclear: 'Success criteria are unclear. Be especially concrete in goal_summary.',
    contextSignalsTitle: '### User context signals',
    aiLimitTitle: '### AI limitations (assign these to humans)',
    recastHeader: '## Execution plan designed in Recast',
    governingIdea: 'Governing idea', situation: 'Situation', complication: 'Complication', resolution: 'Resolution',
    designRationale: 'Design rationale',
    executionFlowTitle: '### Execution flow (⚑=checkpoint, ★=critical path)',
    actorAi: 'AI', actorHuman: 'Human', actorBoth: 'Collab',
    keyAssumptionsTitle: '### Key assumptions (attack targets)',
    userDoubtedTitle: '### Premises user doubted (verify first)',
    reframeUnverifiedTitle: '### Unverified premises from Reframe',
    aiLimitPersonaTitle: '### AI limitations (humans must judge these areas)',
    originalDesignHeader: '## Original design context (do not violate when editing)',
    criticalPath: 'Critical path', rootQuestion: 'Root question', aiLimitShort: 'AI limits',
    impactUnknown: 'impact unknown',
  };
}

/* ────────────────────────────────────
   Reframe → typed context
   ──────────────────────────────────── */

export function buildReframeContext(item: ReframeItem): ReframeContext {
  const analysis = item.analysis;
  if (!analysis) {
    return {
      surface_task: item.input_text,
      reframed_question: '',
      why_reframing_matters: '',
      selected_direction: '',
      unverified_assumptions: [],
      verified_assumptions: [],
      ai_limitations: [],
    };
  }

  // Normalize assumptions (handle legacy string[] format)
  const assumptions: HiddenAssumption[] = (analysis.hidden_assumptions || []).map((a: HiddenAssumption | string) =>
    typeof a === 'string' ? { assumption: a, risk_if_false: '', verified: false } : a
  );

  // Phase 2C: Use structured signals first, fall back to text extraction
  const interviewSignals = item.interview_signals || extractInterviewSignals(item.input_text);

  return {
    surface_task: analysis.surface_task,
    reframed_question: analysis.reframed_question || analysis.hypothesis || '',
    why_reframing_matters: analysis.why_reframing_matters || '',
    selected_direction: item.selected_question || analysis.reframed_question || '',
    unverified_assumptions: assumptions.filter(a => !a.verified),
    verified_assumptions: assumptions.filter(a => a.verified),
    ai_limitations: analysis.ai_limitations || [],
    interview_signals: interviewSignals,
  };
}

/* ────────────────────────────────────
   Recast → typed context
   ──────────────────────────────────── */

export function buildRecastContext(item: RecastItem): RecastContext {
  const analysis = item.analysis;
  const steps = item.steps.length > 0 ? item.steps : analysis?.steps || [];

  return {
    governing_idea: analysis?.governing_idea || '',
    storyline: analysis?.storyline,
    steps,
    key_assumptions: analysis?.key_assumptions || [],
    critical_path: analysis?.critical_path || [],
    design_rationale: analysis?.design_rationale,
  };
}

/* ────────────────────────────────────
   Rehearsal → typed context
   ──────────────────────────────────── */

export function buildRehearsalContext(records: FeedbackRecord[]): RehearsalContext {
  if (records.length === 0) {
    return {
      classified_risks: [],
      untested_assumptions: [],
      approval_conditions: {},
      failure_scenarios: [],
    };
  }

  const latest = records[records.length - 1];

  const allRisks = latest.results.flatMap(r => r.classified_risks || []);
  const allUntested = latest.results.flatMap(r => r.untested_assumptions || []);
  const allFailures = latest.results
    .map(r => r.failure_scenario)
    .filter(Boolean);

  // Group approval conditions by persona
  const approvalConditions: Record<string, string[]> = {};
  for (const result of latest.results) {
    if (result.approval_conditions?.length > 0) {
      approvalConditions[result.persona_id] = result.approval_conditions;
    }
  }

  return {
    classified_risks: allRisks,
    untested_assumptions: [...new Set(allUntested)],
    approval_conditions: approvalConditions,
    failure_scenarios: allFailures,
  };
}

/* ────────────────────────────────────
   Context → Prompt Injection
   Structured context → system prompt
   ──────────────────────────────────── */

/**
 * Inject reframe context into recast's system prompt.
 * Instead of appending raw markdown, injects structured context
 * that the AI can use precisely.
 */
export function injectReframeContext(
  basePrompt: string,
  ctx: ReframeContext
): string {
  const sections: string[] = [];

  // Validate: skip injection if no meaningful content
  const question = (ctx.selected_direction || ctx.reframed_question || '').trim();
  if (!question && !ctx.surface_task?.trim()) return basePrompt;

  const L = getContextLabels();

  // Core direction from reframe
  sections.push(L.reframeHeader);
  if (ctx.surface_task?.trim()) sections.push(`- ${L.originalTask}: ${ctx.surface_task}`);
  if (question) sections.push(`- ${L.reframedQuestion}: ${question}`);

  if (ctx.why_reframing_matters) {
    sections.push(`- ${L.reframingReason}: ${ctx.why_reframing_matters}`);
  }

  // Assumptions — grouped by user's evaluation state
  const allAssumptions = [...ctx.unverified_assumptions, ...ctx.verified_assumptions];
  const doubtful = allAssumptions.filter(a => a.evaluation === 'doubtful');
  const uncertain = allAssumptions.filter(a => a.evaluation === 'uncertain');
  const confirmed = allAssumptions.filter(a => a.evaluation === 'likely_true');
  const noEval = allAssumptions.filter(a => !a.evaluation);

  if (doubtful.length > 0) {
    sections.push('');
    sections.push(L.doubtedTitle);
    doubtful.forEach((a, i) => {
      sections.push(`${i + 1}. "${a.assumption}" ${L.doubtedTag}`);
      if (a.evaluation_reason) sections.push(`   ${L.doubtedWhy}: ${a.evaluation_reason}`);
      if (a.risk_if_false) sections.push(`   ${L.ifWrong}: ${a.risk_if_false}`);
    });
  }

  if (uncertain.length > 0) {
    sections.push('');
    sections.push(L.uncertainTitle);
    uncertain.forEach((a, i) => {
      sections.push(`${i + 1}. "${a.assumption}" ${L.uncertainTag}`);
      if (a.evaluation_reason) sections.push(`   ${L.uncertainWhy}: ${a.evaluation_reason}`);
      if (a.risk_if_false) sections.push(`   ${L.ifWrong}: ${a.risk_if_false}`);
    });
  }

  if (confirmed.length > 0) {
    sections.push('');
    if (doubtful.length === 0 && uncertain.length === 0) {
      sections.push(L.confirmedTitleAsBasis);
    } else {
      sections.push(L.confirmedTitleRef);
    }
    confirmed.forEach(a => sections.push(`- ${a.assumption} ${L.confirmedTag}`));
  }

  // Legacy: unevaluated assumptions
  if (noEval.length > 0) {
    sections.push('');
    sections.push(L.legacyAssumptionsTitle);
    noEval.forEach((a, i) => {
      sections.push(`${i + 1}. "${a.assumption}"`);
      if (a.risk_if_false) sections.push(`   ${L.legacyIfFalse}: ${a.risk_if_false}`);
    });
  }

  // Assumption evaluation pattern → guide recast risk stance
  const evaluated = allAssumptions.filter(a => typeof a !== 'string' && a.evaluation);
  if (evaluated.length >= 2) {
    const doubtful = evaluated.filter(a => typeof a !== 'string' && a.evaluation === 'doubtful');
    const doubtfulRatio = doubtful.length / evaluated.length;
    if (doubtfulRatio >= 0.5) {
      sections.push('');
      sections.push(L.riskAwarenessTitle);
      sections.push(L.riskAwarenessLine);
    }
  }

  // Interview signals → guide the AI's approach
  if (ctx.interview_signals && Object.keys(ctx.interview_signals).length > 0) {
    const signals: string[] = [];
    const s = ctx.interview_signals;

    if (s.nature) {
      const natureMap: Record<string, string> = {
        known_path: L.natureKnown,
        needs_analysis: L.natureAnalysis,
        no_answer: L.natureExplore,
        on_fire: L.natureFire,
      };
      const hint = natureMap[s.nature];
      if (hint) signals.push(hint);
    }
    if (s.goal) {
      const goalMap: Record<string, string> = {
        clear_goal: L.goalClear,
        direction_only: L.goalDirection,
        competing: L.goalCompeting,
        unclear: L.goalUnclear,
      };
      const hint = goalMap[s.goal];
      if (hint) signals.push(hint);
    }
    if (s.stakes === 'irreversible') signals.push(L.stakesIrreversible);
    if (s.history === 'failed') signals.push(L.historyFailed);

    // v1 fallback
    if (!s.nature) {
      if (s.uncertainty) {
        const uncertaintyMap: Record<string, string> = {
          why: L.uncertaintyWhy, what: L.uncertaintyWhat, how: L.uncertaintyHow, none: L.uncertaintyNone,
        };
        const hint = uncertaintyMap[s.uncertainty];
        if (hint) signals.push(hint);
      }
      if (s.success === 'unclear') signals.push(L.successUnclear);
    }

    if (signals.length > 0) {
      sections.push('');
      sections.push(L.contextSignalsTitle);
      signals.forEach(sig => sections.push(`- ${sig}`));
    }
  }

  // AI limitations → pass through as constraints
  if (ctx.ai_limitations.length > 0) {
    sections.push('');
    sections.push(L.aiLimitTitle);
    ctx.ai_limitations.forEach(l => sections.push(`- ${l}`));
  }

  const contextBlock = sections.join('\n');

  return `${basePrompt}\n\n---\n\n${contextBlock}`;
}

/**
 * Inject recast + reframe context into rehearsal's prompt.
 */
export function injectRecastContext(
  basePrompt: string,
  recastCtx: RecastContext,
  reframeCtx?: ReframeContext
): string {
  const sections: string[] = [];
  const L = getContextLabels();

  sections.push(L.recastHeader);
  sections.push(`- ${L.governingIdea}: ${recastCtx.governing_idea}`);

  if (recastCtx.storyline) {
    const s = recastCtx.storyline;
    sections.push(`- ${L.situation}: ${s.situation}`);
    sections.push(`- ${L.complication}: ${s.complication}`);
    sections.push(`- ${L.resolution}: ${s.resolution}`);
  }

  if (recastCtx.design_rationale) {
    sections.push(`- ${L.designRationale}: ${recastCtx.design_rationale}`);
  }

  if (recastCtx.steps.length > 0) {
    const actorLabel: Record<string, string> = { ai: L.actorAi, human: L.actorHuman, both: L.actorBoth };
    const stepSummary = recastCtx.steps
      .map((step, i) => {
        const num = i + 1;
        const cp = step.checkpoint ? ' ⚑' : '';
        const onCriticalPath = recastCtx.critical_path?.includes(num) ? ' ★' : '';
        return `${num}. ${step.task} [${actorLabel[step.actor] || step.actor}]${cp}${onCriticalPath}`;
      })
      .join(' / ');
    sections.push('');
    sections.push(L.executionFlowTitle);
    sections.push(stepSummary);
  }

  if (recastCtx.key_assumptions.length > 0) {
    sections.push('');
    sections.push(L.keyAssumptionsTitle);
    recastCtx.key_assumptions.forEach((ka, i) => {
      sections.push(`${i + 1}. [${ka.importance}/${ka.certainty}] ${ka.assumption}`);
      if (ka.if_wrong) sections.push(`   ${L.ifWrong}: ${ka.if_wrong}`);
    });
  }

  if (reframeCtx?.unverified_assumptions?.length) {
    const doubtful = reframeCtx.unverified_assumptions.filter(a => a.evaluation === 'doubtful');
    const others = reframeCtx.unverified_assumptions.filter(a => a.evaluation !== 'doubtful');
    if (doubtful.length > 0) {
      sections.push('');
      sections.push(L.userDoubtedTitle);
      doubtful.forEach(a => sections.push(`- "${a.assumption}"`));
    }
    if (others.length > 0) {
      sections.push('');
      sections.push(L.reframeUnverifiedTitle);
      others.forEach(a => sections.push(`- "${a.assumption}"`));
    }
  }

  if (reframeCtx?.ai_limitations?.length) {
    sections.push('');
    sections.push(L.aiLimitPersonaTitle);
    reframeCtx.ai_limitations.forEach(l => sections.push(`- ${l}`));
  }

  return `${basePrompt}\n\n---\n\n${sections.join('\n')}`;
}

/**
 * Build refine-specific context from recast + reframe.
 * Gives the revision AI awareness of original design constraints.
 */
export function buildRefineContext(
  recastCtx: RecastContext,
  reframeCtx?: ReframeContext
): string {
  const sections: string[] = [];

  const L = getContextLabels();
  sections.push(L.originalDesignHeader);
  sections.push(`- ${L.governingIdea}: ${recastCtx.governing_idea}`);

  if (recastCtx.design_rationale) {
    sections.push(`- ${L.designRationale}: ${recastCtx.design_rationale}`);
  }

  // Critical path awareness
  if (recastCtx.critical_path?.length > 0 && recastCtx.steps.length > 0) {
    const cpSteps = recastCtx.critical_path
      .map(i => recastCtx.steps[i - 1]?.task)
      .filter(Boolean);
    if (cpSteps.length > 0) {
      sections.push(`- ${L.criticalPath}: ${cpSteps.join(' → ')}`);
    }
  }

  if (reframeCtx) {
    const question = reframeCtx.selected_direction || reframeCtx.reframed_question;
    if (question) {
      sections.push(`- ${L.rootQuestion}: ${question}`);
    }
    if (reframeCtx.ai_limitations?.length > 0) {
      sections.push(`- ${L.aiLimitShort}: ${reframeCtx.ai_limitations.join(', ')}`);
    }
  }

  return sections.join('\n');
}

/* ────────────────────────────────────
   Helpers
   ──────────────────────────────────── */

export function extractInterviewSignals(inputText: string): ReframeContext['interview_signals'] | undefined {
  if (!inputText.includes('[맥락]')) return undefined;

  const signals: ReframeContext['interview_signals'] = {};

  // Extract origin
  if (inputText.includes('위에서 내려온 지시')) signals.origin = 'top-down';
  else if (inputText.includes('고객/외부 요청')) signals.origin = 'external';
  else if (inputText.includes('스스로 발견한 기회')) signals.origin = 'self';
  else if (inputText.includes('갑자기 터진 문제')) signals.origin = 'fire';

  // Extract uncertainty
  if (inputText.includes('이걸 왜 해야 하는지')) signals.uncertainty = 'why';
  else if (inputText.includes('무엇을 해야 하는지')) signals.uncertainty = 'what';
  else if (inputText.includes('어떻게 해야 하는지')) signals.uncertainty = 'how';
  else if (inputText.includes('불확실한 것 없음')) signals.uncertainty = 'none';

  // Extract success criteria
  if (inputText.includes('숫자로 보이는 성과')) signals.success = 'measurable';
  else if (inputText.includes('리스크 감소')) signals.success = 'risk';
  else if (inputText.includes('새로운 가능성')) signals.success = 'opportunity';
  else if (inputText.includes('아직 모르겠음')) signals.success = 'unclear';

  return Object.keys(signals).length > 0 ? signals : undefined;
}

/**
 * Merge reframe's unverified assumptions into recast's key_assumptions.
 * Prevents duplication. Adds provenance marker.
 */
export function mergeAssumptionsIntoKeyAssumptions(
  reframeAssumptions: HiddenAssumption[],
  recastAssumptions: KeyAssumption[]
): KeyAssumption[] {
  const existing = new Set(
    recastAssumptions.map(ka => ka.assumption.toLowerCase().trim())
  );

  const inherited = reframeAssumptions
    .filter(a => !a.verified)
    .filter(a => !existing.has(a.assumption.toLowerCase().trim()))
    .map(a => ({
      assumption: a.assumption,
      importance: 'high' as const,
      certainty: 'low' as const,
      if_wrong: a.risk_if_false || (getCurrentLanguage() === 'ko' ? '영향 미확인' : 'impact unknown'),
    }));

  return [...recastAssumptions, ...inherited];
}
