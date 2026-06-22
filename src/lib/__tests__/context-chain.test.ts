import type { ReframeItem, ReframeContext, HiddenAssumption, KeyAssumption } from '@/stores/types';
import {
  buildReframeContext,
  injectReframeContext,
  extractInterviewSignals,
  mergeAssumptionsIntoKeyAssumptions,
} from '@/lib/context-chain';
import { setModuleLocale } from '@/lib/i18n';

// i18n default is now 'en' (en-first). These suites verify the KOREAN prompt
// output, so pin the locale. The English branch is verified in Phase 3.
beforeEach(() => setModuleLocale('ko'));

/* ────────────────────────────────────
   buildReframeContext
   ──────────────────────────────────── */

describe('buildReframeContext', () => {
  const baseItem: ReframeItem = {
    id: 'test-1',
    input_text: '테스트 과제입니다',
    analysis: null,
    selected_question: '',
    status: 'input',
    created_at: '2024-01-01',
    updated_at: '2024-01-01',
  };

  it('returns empty context when analysis is null', () => {
    const ctx = buildReframeContext(baseItem);
    expect(ctx.surface_task).toBe('테스트 과제입니다');
    expect(ctx.reframed_question).toBe('');
    expect(ctx.why_reframing_matters).toBe('');
    expect(ctx.selected_direction).toBe('');
    expect(ctx.unverified_assumptions).toEqual([]);
    expect(ctx.verified_assumptions).toEqual([]);
    expect(ctx.ai_limitations).toEqual([]);
  });

  it('normalizes legacy string[] assumptions to HiddenAssumption objects', () => {
    const item: ReframeItem = {
      ...baseItem,
      analysis: {
        surface_task: '표면 과제',
        reframed_question: '재정의된 질문',
        why_reframing_matters: '이유',
        reasoning_narrative: '',
        hidden_assumptions: [
          '레거시 문자열 가정' as unknown as HiddenAssumption,
          { assumption: '객체 가정', risk_if_false: '위험', verified: false },
        ],
        hidden_questions: [],
        ai_limitations: [],
      },
    };

    const ctx = buildReframeContext(item);
    expect(ctx.unverified_assumptions).toHaveLength(2);
    expect(ctx.unverified_assumptions[0]).toEqual({
      assumption: '레거시 문자열 가정',
      risk_if_false: '',
      verified: false,
    });
    expect(ctx.unverified_assumptions[1]).toEqual({
      assumption: '객체 가정',
      risk_if_false: '위험',
      verified: false,
    });
  });

  it('extracts interview signals from input_text', () => {
    const item: ReframeItem = {
      ...baseItem,
      input_text: '[맥락] 위에서 내려온 지시, 이걸 왜 해야 하는지 모르겠음, 아직 모르겠음',
      analysis: {
        surface_task: '과제',
        reframed_question: '질문',
        why_reframing_matters: '',
        reasoning_narrative: '',
        hidden_assumptions: [],
        hidden_questions: [],
        ai_limitations: [],
      },
    };

    const ctx = buildReframeContext(item);
    expect(ctx.interview_signals).toBeDefined();
    expect(ctx.interview_signals?.origin).toBe('top-down');
    expect(ctx.interview_signals?.uncertainty).toBe('why');
    expect(ctx.interview_signals?.success).toBe('unclear');
  });

  it('properly splits verified vs unverified assumptions', () => {
    const item: ReframeItem = {
      ...baseItem,
      analysis: {
        surface_task: '과제',
        reframed_question: '질문',
        why_reframing_matters: '',
        reasoning_narrative: '',
        hidden_assumptions: [
          { assumption: '확인됨', risk_if_false: '', verified: true },
          { assumption: '미확인1', risk_if_false: '위험1', verified: false },
          { assumption: '미확인2', risk_if_false: '위험2', verified: false },
        ],
        hidden_questions: [],
        ai_limitations: [],
      },
    };

    const ctx = buildReframeContext(item);
    expect(ctx.verified_assumptions).toHaveLength(1);
    expect(ctx.verified_assumptions[0].assumption).toBe('확인됨');
    expect(ctx.unverified_assumptions).toHaveLength(2);
    expect(ctx.unverified_assumptions[0].assumption).toBe('미확인1');
    expect(ctx.unverified_assumptions[1].assumption).toBe('미확인2');
  });

  it('uses hypothesis as fallback for reframed_question', () => {
    const item: ReframeItem = {
      ...baseItem,
      analysis: {
        surface_task: '과제',
        reframed_question: '',
        why_reframing_matters: '',
        reasoning_narrative: '',
        hidden_assumptions: [],
        hidden_questions: [],
        ai_limitations: [],
        hypothesis: '대안 가설',
      },
    };

    const ctx = buildReframeContext(item);
    expect(ctx.reframed_question).toBe('대안 가설');
  });
});

/* ────────────────────────────────────
   injectReframeContext
   ──────────────────────────────────── */

describe('injectReframeContext', () => {
  const basePrompt = '기본 시스템 프롬프트';

  it('returns basePrompt unchanged when no meaningful content', () => {
    const emptyCtx: ReframeContext = {
      surface_task: '',
      reframed_question: '',
      why_reframing_matters: '',
      selected_direction: '',
      unverified_assumptions: [],
      verified_assumptions: [],
      ai_limitations: [],
    };

    const result = injectReframeContext(basePrompt, emptyCtx);
    expect(result).toBe(basePrompt);
  });

  it('includes surface_task and reframed_question', () => {
    const ctx: ReframeContext = {
      surface_task: '원래 과제',
      reframed_question: '재정의된 질문',
      why_reframing_matters: '',
      selected_direction: '선택된 방향',
      unverified_assumptions: [],
      verified_assumptions: [],
      ai_limitations: [],
    };

    const result = injectReframeContext(basePrompt, ctx);
    expect(result).toContain('원래 과제');
    expect(result).toContain('선택된 방향');
  });

  it('includes unverified assumptions section', () => {
    const ctx: ReframeContext = {
      surface_task: '과제',
      reframed_question: '질문',
      why_reframing_matters: '',
      selected_direction: '',
      unverified_assumptions: [
        { assumption: '가정1', risk_if_false: '위험1', verified: false },
        { assumption: '가정2', risk_if_false: '', verified: false },
      ],
      verified_assumptions: [],
      ai_limitations: [],
    };

    const result = injectReframeContext(basePrompt, ctx);
    // No evaluation field → lands in "전제 (평가 미완료)" bucket
    expect(result).toContain('전제');
    expect(result).toContain('가정1');
    expect(result).toContain('만약 아니라면: 위험1');
    expect(result).toContain('가정2');
  });

  it('includes interview signals section', () => {
    const ctx: ReframeContext = {
      surface_task: '과제',
      reframed_question: '질문',
      why_reframing_matters: '',
      selected_direction: '',
      unverified_assumptions: [],
      verified_assumptions: [],
      ai_limitations: [],
      interview_signals: {
        uncertainty: 'why',
        success: 'unclear',
      },
    };

    const result = injectReframeContext(basePrompt, ctx);
    expect(result).toContain('사용자 맥락 신호');
    expect(result).toContain('왜 해야 하는지');
    expect(result).toContain('성공 기준이 불명확');
  });

  it('includes AI limitations section', () => {
    const ctx: ReframeContext = {
      surface_task: '과제',
      reframed_question: '질문',
      why_reframing_matters: '',
      selected_direction: '',
      unverified_assumptions: [],
      verified_assumptions: [],
      ai_limitations: ['최신 데이터 없음', '도메인 지식 부족'],
    };

    const result = injectReframeContext(basePrompt, ctx);
    expect(result).toContain('AI 한계');
    expect(result).toContain('최신 데이터 없음');
    expect(result).toContain('도메인 지식 부족');
  });
});

/* ────────────────────────────────────
   extractInterviewSignals
   ──────────────────────────────────── */

describe('extractInterviewSignals', () => {
  it('returns undefined for text without [맥락]', () => {
    expect(extractInterviewSignals('일반 텍스트')).toBeUndefined();
  });

  it('extracts origin: top-down', () => {
    const result = extractInterviewSignals('[맥락] 위에서 내려온 지시');
    expect(result?.origin).toBe('top-down');
  });

  it('extracts origin: external', () => {
    const result = extractInterviewSignals('[맥락] 고객/외부 요청으로 진행');
    expect(result?.origin).toBe('external');
  });

  it('extracts origin: self', () => {
    const result = extractInterviewSignals('[맥락] 스스로 발견한 기회를 활용');
    expect(result?.origin).toBe('self');
  });

  it('extracts origin: fire', () => {
    const result = extractInterviewSignals('[맥락] 갑자기 터진 문제 대응');
    expect(result?.origin).toBe('fire');
  });

  it('extracts uncertainty: why', () => {
    const result = extractInterviewSignals('[맥락] 이걸 왜 해야 하는지 모르겠음');
    expect(result?.uncertainty).toBe('why');
  });

  it('extracts uncertainty: what', () => {
    const result = extractInterviewSignals('[맥락] 무엇을 해야 하는지 불확실');
    expect(result?.uncertainty).toBe('what');
  });

  it('extracts uncertainty: how', () => {
    const result = extractInterviewSignals('[맥락] 어떻게 해야 하는지 고민 중');
    expect(result?.uncertainty).toBe('how');
  });

  it('extracts success criteria', () => {
    const result = extractInterviewSignals('[맥락] 아직 모르겠음');
    expect(result?.success).toBe('unclear');
  });

  it('returns undefined when [맥락] present but no matching signals', () => {
    const result = extractInterviewSignals('[맥락] 특별한 정보 없음');
    expect(result).toBeUndefined();
  });
});

/* ────────────────────────────────────
   mergeAssumptionsIntoKeyAssumptions
   ──────────────────────────────────── */

describe('mergeAssumptionsIntoKeyAssumptions', () => {
  it('does not add verified assumptions', () => {
    const reframeAssumptions: HiddenAssumption[] = [
      { assumption: '확인된 가정', risk_if_false: '위험', verified: true },
    ];
    const recast: KeyAssumption[] = [];

    const result = mergeAssumptionsIntoKeyAssumptions(reframeAssumptions, recast);
    expect(result).toHaveLength(0);
  });

  it('deduplicates by assumption text (case-insensitive)', () => {
    const reframeAssumptions: HiddenAssumption[] = [
      { assumption: '중복 가정', risk_if_false: '위험', verified: false },
    ];
    const recast: KeyAssumption[] = [
      { assumption: '중복 가정', importance: 'medium', certainty: 'medium', if_wrong: '기존' },
    ];

    const result = mergeAssumptionsIntoKeyAssumptions(reframeAssumptions, recast);
    expect(result).toHaveLength(1);
    expect(result[0].if_wrong).toBe('기존');
  });

  it('maps risk_if_false to if_wrong', () => {
    const reframeAssumptions: HiddenAssumption[] = [
      { assumption: '새 가정', risk_if_false: '큰 위험', verified: false },
    ];
    const recast: KeyAssumption[] = [];

    const result = mergeAssumptionsIntoKeyAssumptions(reframeAssumptions, recast);
    expect(result).toHaveLength(1);
    expect(result[0].if_wrong).toBe('큰 위험');
  });

  it('sets importance:high, certainty:low for inherited assumptions', () => {
    const reframeAssumptions: HiddenAssumption[] = [
      { assumption: '새 가정', risk_if_false: '위험', verified: false },
    ];
    const recast: KeyAssumption[] = [];

    const result = mergeAssumptionsIntoKeyAssumptions(reframeAssumptions, recast);
    expect(result[0].importance).toBe('high');
    expect(result[0].certainty).toBe('low');
  });

  it('uses fallback text when risk_if_false is empty', () => {
    const reframeAssumptions: HiddenAssumption[] = [
      { assumption: '가정', risk_if_false: '', verified: false },
    ];
    const recast: KeyAssumption[] = [];

    const result = mergeAssumptionsIntoKeyAssumptions(reframeAssumptions, recast);
    expect(result[0].if_wrong).toBe('영향 미확인');
  });

  it('preserves existing recast assumptions and appends new ones', () => {
    const reframeAssumptions: HiddenAssumption[] = [
      { assumption: '새 가정', risk_if_false: '위험', verified: false },
    ];
    const recast: KeyAssumption[] = [
      { assumption: '기존 가정', importance: 'medium', certainty: 'high', if_wrong: '기존 위험' },
    ];

    const result = mergeAssumptionsIntoKeyAssumptions(reframeAssumptions, recast);
    expect(result).toHaveLength(2);
    expect(result[0].assumption).toBe('기존 가정');
    expect(result[1].assumption).toBe('새 가정');
  });
});
