/**
 * Context Builder Simulation — 명시적 프로젝트 문맥 + E influence gate
 *
 * context-builder.ts의 공개 함수와 격리 경계를 검증한다:
 * 1. buildEnhancedSystemPrompt — E2 gate + 같은 프로젝트 판단, 1200자 제한
 * 2. buildProjectItemsContext — 프로젝트 아이템 크로스 참조
 * 3. buildPersonaAccuracyContext — 페르소나 행동 모델 보정
 *
 * 아키타입:
 * - 빈 데이터 → 원본 prompt 그대로
 * - 프로젝트 컨텍스트 → 이전 판단 주입
 * - Coda/outcome/retro/global pattern/eval → grant 없이 주입 0
 * - 프로젝트 문맥 + locale directive → 1200자 상한
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type {
  JudgmentRecord,
  PersonaAccuracyRating,
  Project,
  OutcomeRecord,
} from '@/stores/types';

// ── Mocks ──

const mockGetStorage = vi.fn((): unknown => []);
const mockSetStorage = vi.fn();

vi.mock('@/lib/storage', () => ({
  getStorage: (...args: unknown[]) => mockGetStorage(...args),
  setStorage: (...args: unknown[]) => mockSetStorage(...args),
  STORAGE_KEYS: {
    JUDGMENTS: 'sot_judgments',
    REFRAME_LIST: 'sot_reframe_list',
    RECAST_LIST: 'sot_recast_list',
    SYNTHESIZE_LIST: 'sot_synthesize_list',
    PROJECTS: 'sot_projects',
    ACCURACY_RATINGS: 'sot_accuracy_ratings',
    OUTCOME_RECORDS: 'sot_outcome_records',
  },
}));

vi.mock('@/lib/signal-recorder', () => ({
  getSignalsByType: vi.fn(() => []),
  recordSignal: vi.fn(),
}));

vi.mock('@/lib/eval-engine', () => ({
  getEvalSummary: vi.fn(() => ({ total_sessions: 0 })),
  getStageEvalSummary: vi.fn(() => null),
}));

vi.mock('@/lib/retrospective', () => ({
  getActionableInsights: vi.fn(() => []),
}));

vi.mock('@/lib/db', () => ({
  insertToSupabase: vi.fn(),
}));

import {
  buildEnhancedSystemPrompt,
  buildProjectItemsContext,
  buildPersonaAccuracyContext,
} from '@/lib/context-builder';
import { getSignalsByType } from '@/lib/signal-recorder';
import { getEvalSummary, getStageEvalSummary } from '@/lib/eval-engine';
import { getActionableInsights } from '@/lib/retrospective';
import { setModuleLocale } from '@/lib/i18n';

// i18n default is now 'en' (en-first). These suites verify the KOREAN prompt
// output, so pin the locale. The English branch is verified in Phase 3.
beforeEach(() => setModuleLocale('ko'));

const mockGetSignals = vi.mocked(getSignalsByType);
const mockGetEvalSummary = vi.mocked(getEvalSummary);
const mockGetStageEvalSummary = vi.mocked(getStageEvalSummary);
const mockGetActionableInsights = vi.mocked(getActionableInsights);

// ── Helpers ──

function makeJudgment(overrides: Partial<JudgmentRecord> = {}): JudgmentRecord {
  return {
    id: `j-${Math.random().toString(36).slice(2)}`,
    type: 'actor_override',
    context: 'test context',
    decision: 'human',
    original_ai_suggestion: 'ai',
    user_changed: false,
    project_id: 'proj-1',
    tool: 'recast',
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

function makeProject(id: string, overrides: Partial<Project> = {}): Project {
  return {
    id,
    name: `Project ${id}`,
    description: '',
    refs: [],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

function makeOutcome(projectId: string, success: OutcomeRecord['overall_success']): OutcomeRecord {
  return {
    id: `out-${Math.random().toString(36).slice(2)}`,
    project_id: projectId,
    hypothesis_result: success === 'met' ? 'confirmed' : 'refuted',
    hypothesis_notes: '',
    materialized_risks: [],
    approval_outcomes: [],
    overall_success: success,
    key_learnings: '',
    what_would_change: '',
    created_at: new Date().toISOString(),
  };
}

function makeAccuracyRating(
  personaId: string,
  score: number,
  accurate: string[],
  inaccurate: string[],
  notes?: string,
): PersonaAccuracyRating {
  return {
    id: `ar-${Math.random().toString(36).slice(2)}`,
    persona_id: personaId,
    feedback_record_id: 'fr-1',
    accuracy_score: score,
    which_aspects_accurate: accurate,
    which_aspects_inaccurate: inaccurate,
    accuracy_notes: notes,
    created_at: new Date().toISOString(),
  };
}

/** Configure getStorage mock to return different data for different keys */
function setupStorage(data: Record<string, unknown[]>) {
  mockGetStorage.mockImplementation((key: string, fallback?: unknown) => {
    return data[key] || fallback || [];
  });
}

// ── Tests ──

describe('Context Builder Simulation', () => {
  const BASE_PROMPT = '당신은 전략 분석 전문가입니다.';

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetStorage.mockReturnValue([]);
    mockGetSignals.mockReturnValue([]);
    mockGetEvalSummary.mockReturnValue({ total_sessions: 0 } as unknown as ReturnType<typeof getEvalSummary>);
    mockGetStageEvalSummary.mockReturnValue(null);
    mockGetActionableInsights.mockReturnValue([]);
  });

  // ═══════════════════════════════════════
  // buildEnhancedSystemPrompt
  // ═══════════════════════════════════════
  describe('buildEnhancedSystemPrompt', () => {
    describe('빈 데이터 → 원본 그대로', () => {
      it('judgment 0건 → basePrompt로 시작 (locale directive 꼬리 허용)', () => {
        setupStorage({ sot_judgments: [] });
        // Locale directive is always appended at end; verify body is basePrompt unchanged.
        expect(buildEnhancedSystemPrompt(BASE_PROMPT)).toMatch(new RegExp(`^${BASE_PROMPT.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`));
      });

      it('undefined projectId → 프로젝트 섹션 없음', () => {
        setupStorage({ sot_judgments: [makeJudgment()] });
        const result = buildEnhancedSystemPrompt(BASE_PROMPT);
        expect(result).not.toContain('이 프로젝트에서의');
      });
    });

    describe('E1: 승인되지 않은 사용자 패턴 격리', () => {
      it('judgment 1건 → 패턴 분석 불가', () => {
        setupStorage({ sot_judgments: [makeJudgment()] });
        const result = buildEnhancedSystemPrompt(BASE_PROMPT);
        // Only 1 judgment, analyzePatterns returns null when < 2
        // BUT other sections might still appear (outcomes, etc.)
        expect(result).not.toContain('사용자 패턴');
      });

      it('AI→사람 변경 신호가 누적되어도 전역 성향으로 주입하지 않음', () => {
        const judgments = Array.from({ length: 3 }, () => makeJudgment());
        mockGetSignals.mockReturnValue([
          { signal_type: 'actor_override_direction', signal_data: { from_actor: 'ai', to_actor: 'human' }, created_at: '' },
          { signal_type: 'actor_override_direction', signal_data: { from_actor: 'ai', to_actor: 'human' }, created_at: '' },
          { signal_type: 'actor_override_direction', signal_data: { from_actor: 'ai', to_actor: 'human' }, created_at: '' },
        ] as unknown as ReturnType<typeof getSignalsByType>);
        setupStorage({ sot_judgments: judgments });

        const result = buildEnhancedSystemPrompt(BASE_PROMPT);
        expect(result).not.toContain('AI→사람 변경');
        expect(mockGetSignals).not.toHaveBeenCalled();
      });

      it('사람→AI 위임 신호가 누적되어도 AI 활용 성향으로 주입하지 않음', () => {
        const judgments = Array.from({ length: 3 }, () => makeJudgment());
        mockGetSignals.mockReturnValue([
          { signal_type: 'actor_override_direction', signal_data: { from_actor: 'human', to_actor: 'ai' }, created_at: '' },
          { signal_type: 'actor_override_direction', signal_data: { from_actor: 'human', to_actor: 'ai' }, created_at: '' },
          { signal_type: 'actor_override_direction', signal_data: { from_actor: 'human', to_actor: 'ai' }, created_at: '' },
        ] as unknown as ReturnType<typeof getSignalsByType>);
        setupStorage({ sot_judgments: judgments });

        const result = buildEnhancedSystemPrompt(BASE_PROMPT);
        expect(result).not.toContain('AI 활용에 적극적');
        expect(mockGetSignals).not.toHaveBeenCalled();
      });

      it('질문 수정 이력이 있어도 미래 프롬프트 정책으로 승격하지 않음', () => {
        const judgments = [
          makeJudgment({ type: 'hidden_question_selection', user_changed: true }),
          makeJudgment({ type: 'hidden_question_selection', user_changed: true }),
        ];
        setupStorage({ sot_judgments: judgments });

        const result = buildEnhancedSystemPrompt(BASE_PROMPT);
        expect(result).not.toContain('질문을 자주 직접 수정');
      });

      it('AI↔사람 균형 → 어느 쪽도 언급 안함', () => {
        const judgments = Array.from({ length: 3 }, () => makeJudgment());
        mockGetSignals.mockReturnValue([
          { signal_type: 'actor_override_direction', signal_data: { from_actor: 'ai', to_actor: 'human' }, created_at: '' },
          { signal_type: 'actor_override_direction', signal_data: { from_actor: 'human', to_actor: 'ai' }, created_at: '' },
          { signal_type: 'actor_override_direction', signal_data: { from_actor: 'ai', to_actor: 'human' }, created_at: '' },
        ] as unknown as ReturnType<typeof getSignalsByType>);
        setupStorage({ sot_judgments: judgments });

        const result = buildEnhancedSystemPrompt(BASE_PROMPT);
        // aiToHuman=2, humanToAi=1 → 2 > 1*2? No (2 > 2 false)
        expect(result).not.toContain('AI→사람 변경');
        expect(result).not.toContain('AI 활용에 적극적');
      });
    });

    describe('Section 2: 프로젝트별 컨텍스트', () => {
      it('projectId 지정 + 해당 프로젝트 judgment → 이전 판단 주입', () => {
        const judgments = [
          makeJudgment({ project_id: 'proj-A', type: 'actor_override', context: '데이터 수집', decision: 'human' }),
          makeJudgment({ project_id: 'proj-A', type: 'conflict_resolution', context: '일정 조율', decision: 'compromise' }),
        ];
        setupStorage({ sot_judgments: judgments });

        const result = buildEnhancedSystemPrompt(BASE_PROMPT, 'proj-A');
        expect(result).toContain('이 프로젝트에서의 이전 판단');
        expect(result).toContain('역할 변경');
        expect(result).toContain('데이터 수집');
        expect(result).toContain('쟁점 판단');
      });

      it('다른 프로젝트의 judgment는 프로젝트 섹션에 안 나옴', () => {
        const judgments = [
          makeJudgment({ project_id: 'proj-B', context: 'other project' }),
        ];
        setupStorage({ sot_judgments: judgments });

        const result = buildEnhancedSystemPrompt(BASE_PROMPT, 'proj-A');
        expect(result).not.toContain('other project');
      });

      it('최근 5건만 포함 (오래된 것 제외)', () => {
        const judgments = Array.from({ length: 8 }, (_, i) =>
          makeJudgment({ project_id: 'proj-A', context: `judgment-${i}` })
        );
        setupStorage({ sot_judgments: judgments });

        const result = buildEnhancedSystemPrompt(BASE_PROMPT, 'proj-A');
        expect(result).not.toContain('judgment-0');
        expect(result).not.toContain('judgment-1');
        expect(result).not.toContain('judgment-2');
        expect(result).toContain('judgment-3');
        expect(result).toContain('judgment-7');
      });
    });

    describe('E1: Coda 깨달음 격리', () => {
      it('meta_reflection이 있어도 승인 없이 다른 프롬프트에 주입하지 않음', () => {
        const projects = [
          makeProject('old-proj', {
            meta_reflection: {
              surprising_discovery: '고객이 기능보다 속도를 원했다',
              next_time_differently: '초기에 프로토타입 테스트를 먼저 하겠다',
              created_at: '2026-01-01',
            },
          }),
        ];
        setupStorage({
          sot_judgments: [makeJudgment()],
          sot_projects: projects,
        });

        const result = buildEnhancedSystemPrompt(BASE_PROMPT, 'proj-A');
        expect(result).not.toContain('이전 프로젝트에서의 깨달음');
        expect(result).not.toContain('고객이 기능보다 속도를 원했다');
        expect(result).not.toContain('프로토타입 테스트를 먼저');
      });

      it('현재 프로젝트의 reflection은 제외', () => {
        const projects = [
          makeProject('proj-A', {
            meta_reflection: {
              surprising_discovery: '내 프로젝트 깨달음',
              next_time_differently: '',
              created_at: '2026-01-01',
            },
          }),
        ];
        setupStorage({
          sot_judgments: [makeJudgment()],
          sot_projects: projects,
        });

        const result = buildEnhancedSystemPrompt(BASE_PROMPT, 'proj-A');
        expect(result).not.toContain('내 프로젝트 깨달음');
      });

      it('여러 프로젝트의 깨달음도 전부 격리', () => {
        const projects = Array.from({ length: 5 }, (_, i) =>
          makeProject(`old-${i}`, {
            meta_reflection: {
              surprising_discovery: `discovery-${i}`,
              next_time_differently: '',
              created_at: `2026-0${i + 1}-01`,
            },
          })
        );
        setupStorage({
          sot_judgments: [makeJudgment()],
          sot_projects: projects,
        });

        const result = buildEnhancedSystemPrompt(BASE_PROMPT);
        expect(result).not.toContain('discovery-4');
        expect(result).not.toContain('discovery-3');
        expect(result).not.toContain('discovery-2');
        expect(result).not.toContain('discovery-0');
      });
    });

    describe('E1: Outcome 해석 격리', () => {
      it('outcome이 누적되어도 성공률을 미래 프롬프트에 주입하지 않음', () => {
        const outcomes = [
          makeOutcome('other-1', 'met'),
          makeOutcome('other-2', 'failed'),
          makeOutcome('other-3', 'exceeded'),
        ];
        setupStorage({
          sot_judgments: [makeJudgment()],
          sot_outcome_records: outcomes,
        });

        const result = buildEnhancedSystemPrompt(BASE_PROMPT, 'proj-A');
        expect(result).not.toContain('과거 프로젝트 결과 학습');
        expect(result).not.toContain('성공률: 67%');
        expect(mockGetStorage).not.toHaveBeenCalledWith('sot_outcome_records', []);
      });

      it('현재 프로젝트의 outcome은 제외', () => {
        const outcomes = [
          makeOutcome('proj-A', 'met'), // 현재 프로젝트 → 제외
          makeOutcome('other-1', 'met'),
        ];
        setupStorage({
          sot_judgments: [makeJudgment()],
          sot_outcome_records: outcomes,
        });

        const result = buildEnhancedSystemPrompt(BASE_PROMPT, 'proj-A');
        // After filtering, only 1 outcome → < 2 → no section
        expect(result).not.toContain('과거 프로젝트 결과 학습');
      });

      it('unspoken 리스크 실현율이 높아도 승인 없이 경고를 주입하지 않음', () => {
        const outcomes = [
          {
            ...makeOutcome('o1', 'met'),
            materialized_risks: [
              { text: 'r1', category: 'unspoken' as const, actually_happened: true },
              { text: 'r2', category: 'unspoken' as const, actually_happened: true },
            ],
          },
          {
            ...makeOutcome('o2', 'failed'),
            materialized_risks: [
              { text: 'r3', category: 'unspoken' as const, actually_happened: false },
            ],
          },
        ];
        setupStorage({
          sot_judgments: [makeJudgment()],
          sot_outcome_records: outcomes,
        });

        const result = buildEnhancedSystemPrompt(BASE_PROMPT, 'proj-A');
        expect(result).not.toContain('침묵의 리스크가 자주 실현');
      });
    });

    describe('E1: Retrospective 교훈 격리', () => {
      it('actionable insight가 있어도 승인 없이 주입하지 않음', () => {
        setupStorage({ sot_judgments: [makeJudgment()] });
        mockGetActionableInsights.mockReturnValue([
          '고객 인터뷰를 먼저 했어야 했다',
          '기술 검증을 병렬로 진행할 것',
        ]);

        const result = buildEnhancedSystemPrompt(BASE_PROMPT, 'proj-A');
        expect(result).not.toContain('이전 프로젝트 성찰 교훈');
        expect(result).not.toContain('고객 인터뷰를 먼저');
        expect(result).not.toContain('기술 검증을 병렬로');
        expect(mockGetActionableInsights).not.toHaveBeenCalled();
      });
    });

    describe('E1: 적응형 프로필 격리', () => {
      it('총 세션 < 5 → 적응형 컨텍스트 없음', () => {
        mockGetEvalSummary.mockReturnValue({ total_sessions: 3 } as unknown as ReturnType<typeof getEvalSummary>);
        setupStorage({ sot_judgments: [makeJudgment(), makeJudgment()] });

        const result = buildEnhancedSystemPrompt(BASE_PROMPT);
        expect(result).not.toContain('적응형 컨텍스트');
      });

      it('축 갭 후보가 있어도 사용자 프로필로 주입하지 않음', () => {
        mockGetEvalSummary.mockReturnValue({ total_sessions: 10 } as unknown as ReturnType<typeof getEvalSummary>);
        // Build reframe items with business gap
        const reframeItems = Array.from({ length: 5 }, () => ({
          id: `rf-${Math.random()}`,
          input_text: 'test',
          selected_question: 'q',
          status: 'done',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          analysis: {
            surface_task: 'task',
            reframed_question: 'q',
            why_reframing_matters: 'w',
            reasoning_narrative: '',
            hidden_assumptions: [
              { assumption: 'a1', risk_if_false: 'r', evaluation: 'uncertain', axis: 'customer_value' },
              { assumption: 'a2', risk_if_false: 'r', evaluation: 'uncertain', axis: 'feasibility' },
              { assumption: 'a3', risk_if_false: 'r', evaluation: 'uncertain', axis: 'org_capacity' },
              // no business axis → gap
            ],
            hidden_questions: [],
            ai_limitations: [],
          },
        }));
        setupStorage({
          sot_judgments: [makeJudgment(), makeJudgment()],
          sot_reframe_list: reframeItems,
        });

        const result = buildEnhancedSystemPrompt(BASE_PROMPT);
        expect(result).not.toContain('비즈니스');
        expect(result).not.toContain('탐색되지 않았습니다');
        expect(mockGetEvalSummary).not.toHaveBeenCalled();
      });

      it('reframe 수락률이 높아도 미래 대안 정책으로 주입하지 않음', () => {
        mockGetEvalSummary.mockReturnValue({ total_sessions: 10 } as unknown as ReturnType<typeof getEvalSummary>);
        // 5+ items where selected_question === reframed_question
        const reframeItems = Array.from({ length: 6 }, () => ({
          id: `rf-${Math.random()}`,
          input_text: 'test',
          selected_question: 'same question',
          status: 'done',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          analysis: {
            surface_task: 'task',
            reframed_question: 'same question', // same = accepted
            why_reframing_matters: 'w',
            reasoning_narrative: '',
            hidden_assumptions: [],
            hidden_questions: [],
            ai_limitations: [],
          },
        }));
        setupStorage({
          sot_judgments: [makeJudgment(), makeJudgment()],
          sot_reframe_list: reframeItems,
        });

        const result = buildEnhancedSystemPrompt(BASE_PROMPT);
        expect(result).not.toContain('첫 reframe을 수락');
        expect(result).not.toContain('대안적 프레이밍');
        expect(mockGetEvalSummary).not.toHaveBeenCalled();
      });
    });

    describe('1200자 상한', () => {
      it('모든 섹션이 있어도 컨텍스트는 1200자 이내', () => {
        // Max out all sections
        const judgments = Array.from({ length: 20 }, (_, i) =>
          makeJudgment({
            project_id: 'proj-A',
            type: 'hidden_question_selection',
            user_changed: i % 2 === 0,
            context: `매우 긴 컨텍스트 문자열 ${i} - 이것은 테스트를 위한 더미 데이터입니다`,
            decision: `결정 ${i}`,
          })
        );
        const projects = Array.from({ length: 5 }, (_, i) =>
          makeProject(`old-${i}`, {
            meta_reflection: {
              surprising_discovery: `놀라운 발견 ${i}: 매우 긴 설명이 여기에 들어갑니다 테스트용`,
              next_time_differently: `다음에 다르게 ${i}: 이것도 긴 설명입니다`,
              created_at: `2026-0${i + 1}-01`,
            },
          })
        );
        const outcomes = Array.from({ length: 5 }, (_, i) => ({
          ...makeOutcome(`other-${i}`, i % 2 === 0 ? 'met' as const : 'failed' as const),
          materialized_risks: [
            { text: `risk-${i}`, category: 'unspoken' as const, actually_happened: true },
          ],
        }));

        mockGetSignals.mockReturnValue(
          Array.from({ length: 5 }, () => ({
            signal_type: 'actor_override_direction',
            signal_data: { from_actor: 'ai', to_actor: 'human' },
            created_at: '',
          })) as unknown as ReturnType<typeof getSignalsByType>
        );
        mockGetActionableInsights.mockReturnValue([
          '교훈 1: 이것은 긴 교훈입니다',
          '교훈 2: 또 다른 긴 교훈',
          '교훈 3: 세 번째 교훈',
        ]);

        setupStorage({
          sot_judgments: judgments,
          sot_projects: projects,
          sot_outcome_records: outcomes,
        });

        const result = buildEnhancedSystemPrompt(BASE_PROMPT, 'proj-A');
        // Context section = everything after "---\n\n"
        const contextStart = result.indexOf('---\n\n');
        expect(contextStart).not.toBe(-1); // 구분자가 반드시 존재해야 함
        const contextSection = result.slice(contextStart + 5);
        expect(contextSection.length).toBeLessThanOrEqual(1200);
      });
    });

    describe('basePrompt 보존', () => {
      it('원본 prompt가 앞에 보존', () => {
        setupStorage({ sot_judgments: [makeJudgment(), makeJudgment()] });
        mockGetSignals.mockReturnValue([
          { signal_type: 'actor_override_direction', signal_data: { from_actor: 'ai', to_actor: 'human' }, created_at: '' },
          { signal_type: 'actor_override_direction', signal_data: { from_actor: 'ai', to_actor: 'human' }, created_at: '' },
          { signal_type: 'actor_override_direction', signal_data: { from_actor: 'ai', to_actor: 'human' }, created_at: '' },
        ] as unknown as ReturnType<typeof getSignalsByType>);

        const result = buildEnhancedSystemPrompt(BASE_PROMPT);
        expect(result.startsWith(BASE_PROMPT)).toBe(true);
      });

      it('구분자 ---로 컨텍스트 분리', () => {
        setupStorage({ sot_judgments: [
          makeJudgment({ project_id: 'proj-A' }),
          makeJudgment({ project_id: 'proj-A' }),
        ] });
        mockGetSignals.mockReturnValue([
          { signal_type: 'actor_override_direction', signal_data: { from_actor: 'ai', to_actor: 'human' }, created_at: '' },
          { signal_type: 'actor_override_direction', signal_data: { from_actor: 'ai', to_actor: 'human' }, created_at: '' },
          { signal_type: 'actor_override_direction', signal_data: { from_actor: 'ai', to_actor: 'human' }, created_at: '' },
        ] as unknown as ReturnType<typeof getSignalsByType>);

        const result = buildEnhancedSystemPrompt(BASE_PROMPT, 'proj-A');
        expect(result).toContain('\n\n---\n\n');
      });
    });
  });

  // ═══════════════════════════════════════
  // buildProjectItemsContext
  // ═══════════════════════════════════════
  describe('buildProjectItemsContext', () => {
    it('데이터 없으면 빈 문자열', () => {
      setupStorage({});
      expect(buildProjectItemsContext('proj-A')).toBe('');
    });

    it('reframe done → 항로 재설정 섹션', () => {
      setupStorage({
        sot_reframe_list: [{
          id: 'rf-1', project_id: 'proj-A', status: 'done',
          input_text: 'test', selected_question: '핵심 질문?',
          analysis: { surface_task: 'task', reframed_question: 'q' },
          created_at: '', updated_at: '',
        }],
      });
      const result = buildProjectItemsContext('proj-A');
      expect(result).toContain('[항로 재설정]');
      expect(result).toContain('핵심 질문?');
    });

    it('selected_question 없으면 surface_task 사용', () => {
      setupStorage({
        sot_reframe_list: [{
          id: 'rf-1', project_id: 'proj-A', status: 'done',
          input_text: 'test', selected_question: '',
          analysis: { surface_task: '원래 과제' },
          created_at: '', updated_at: '',
        }],
      });
      const result = buildProjectItemsContext('proj-A');
      expect(result).toContain('원래 과제');
    });

    it('recast done → 선원 배치 섹션', () => {
      setupStorage({
        sot_recast_list: [{
          id: 'rc-1', project_id: 'proj-A', status: 'done',
          input_text: 'test', steps: [1, 2, 3], // 3 steps
          analysis: { ai_ratio: 0.4, human_ratio: 0.6 },
          created_at: '', updated_at: '',
        }],
      });
      const result = buildProjectItemsContext('proj-A');
      expect(result).toContain('[선원 배치]');
      expect(result).toContain('3단계');
      expect(result).toContain('AI 0.4%');
    });

    it('synthesize done → 합성 결론 섹션', () => {
      setupStorage({
        sot_synthesize_list: [{
          id: 's-1', project_id: 'proj-A', status: 'done',
          input_text: 'test',
          final_synthesis: '최종 결론: 이 프로젝트는 고객 중심으로 진행해야 합니다. 그 이유는...',
          created_at: '', updated_at: '',
        }],
      });
      const result = buildProjectItemsContext('proj-A');
      expect(result).toContain('[합성 결론]');
      expect(result).toContain('최종 결론');
    });

    it('합성 결론은 100자로 잘림', () => {
      const longSynthesis = '가'.repeat(200);
      setupStorage({
        sot_synthesize_list: [{
          id: 's-1', project_id: 'proj-A', status: 'done',
          input_text: 'test', final_synthesis: longSynthesis,
          created_at: '', updated_at: '',
        }],
      });
      const result = buildProjectItemsContext('proj-A');
      // The synthesis content should be truncated to 100 chars
      expect(result.length).toBeLessThan(200);
    });

    it('다른 프로젝트 데이터는 무시', () => {
      setupStorage({
        sot_reframe_list: [{
          id: 'rf-1', project_id: 'proj-B', status: 'done',
          input_text: 'test', selected_question: 'other project',
          analysis: { surface_task: 'other' },
          created_at: '', updated_at: '',
        }],
      });
      expect(buildProjectItemsContext('proj-A')).toBe('');
    });

    it('pending 상태는 무시', () => {
      setupStorage({
        sot_reframe_list: [{
          id: 'rf-1', project_id: 'proj-A', status: 'pending',
          input_text: 'test', selected_question: 'pending',
          analysis: { surface_task: 'pending' },
          created_at: '', updated_at: '',
        }],
      });
      expect(buildProjectItemsContext('proj-A')).toBe('');
    });

    it('최신 항목 사용 (여러 개 있을 때)', () => {
      setupStorage({
        sot_reframe_list: [
          {
            id: 'rf-old', project_id: 'proj-A', status: 'done',
            input_text: 'test', selected_question: 'old question',
            analysis: { surface_task: 'old' },
            created_at: '2026-01-01', updated_at: '2026-01-01',
          },
          {
            id: 'rf-new', project_id: 'proj-A', status: 'done',
            input_text: 'test', selected_question: 'new question',
            analysis: { surface_task: 'new' },
            created_at: '2026-03-01', updated_at: '2026-03-01',
          },
        ],
      });
      const result = buildProjectItemsContext('proj-A');
      expect(result).toContain('new question');
    });
  });

  // ═══════════════════════════════════════
  // buildPersonaAccuracyContext
  // ═══════════════════════════════════════
  describe('buildPersonaAccuracyContext', () => {
    it('평가 0건 → 빈 문자열', () => {
      setupStorage({ sot_accuracy_ratings: [] });
      expect(buildPersonaAccuracyContext('persona-1')).toBe('');
    });

    it('평가 1건 (< 2) → 빈 문자열', () => {
      setupStorage({
        sot_accuracy_ratings: [
          makeAccuracyRating('persona-1', 4, ['tone'], []),
        ],
      });
      expect(buildPersonaAccuracyContext('persona-1')).toBe('');
    });

    it('평균 정확도가 헤더에 포함', () => {
      setupStorage({
        sot_accuracy_ratings: [
          makeAccuracyRating('persona-1', 4, ['tone'], []),
          makeAccuracyRating('persona-1', 3, ['tone'], ['depth']),
        ],
      });
      const result = buildPersonaAccuracyContext('persona-1');
      expect(result).toContain('2회 평가');
      expect(result).toContain('정확도 3.5/5');
    });

    it('강점 측면이 올바르게 표시', () => {
      setupStorage({
        sot_accuracy_ratings: [
          makeAccuracyRating('persona-1', 4, ['tone', 'priorities'], ['depth']),
          makeAccuracyRating('persona-1', 3, ['tone'], ['depth', 'concern']),
        ],
      });
      const result = buildPersonaAccuracyContext('persona-1');
      expect(result).toContain('### 강점 (유지)');
      expect(result).toContain('tone');
      // tone: accurate=2, inaccurate=0 → 100% 정확
      expect(result).toContain('100% 정확');
    });

    it('보정 필요 측면이 올바르게 표시', () => {
      setupStorage({
        sot_accuracy_ratings: [
          makeAccuracyRating('persona-1', 2, ['tone'], ['depth', 'concern']),
          makeAccuracyRating('persona-1', 2, [], ['depth', 'concern']),
        ],
      });
      const result = buildPersonaAccuracyContext('persona-1');
      expect(result).toContain('### 보정 필요 (개선)');
      expect(result).toContain('depth');
      // depth: accurate=0, inaccurate=2 → 0% 정확
      expect(result).toContain('0% 정확');
    });

    it('평균 < 2.5 → 보수적 보정 지시', () => {
      setupStorage({
        sot_accuracy_ratings: [
          makeAccuracyRating('persona-1', 1, [], ['all']),
          makeAccuracyRating('persona-1', 2, [], ['all']),
        ],
      });
      const result = buildPersonaAccuracyContext('persona-1');
      expect(result).toContain('보정 지시');
      expect(result).toContain('더 보수적이고 현실적');
    });

    it('평균 > 4.0 → 현재 유지 지시', () => {
      setupStorage({
        sot_accuracy_ratings: [
          makeAccuracyRating('persona-1', 5, ['tone', 'depth'], []),
          makeAccuracyRating('persona-1', 4, ['tone'], []),
        ],
      });
      const result = buildPersonaAccuracyContext('persona-1');
      expect(result).toContain('보정 지시');
      expect(result).toContain('현재 접근 방식을 유지');
    });

    it('2.5 <= 평균 <= 4.0 + bad > good → 부정확 측면 집중', () => {
      setupStorage({
        sot_accuracy_ratings: [
          makeAccuracyRating('persona-1', 3, ['tone'], ['depth', 'concern', 'style']),
          makeAccuracyRating('persona-1', 3, ['tone'], ['depth', 'concern', 'style']),
        ],
      });
      const result = buildPersonaAccuracyContext('persona-1');
      expect(result).toContain('부정확한 측면');
      expect(result).toContain('depth');
    });

    it('accuracy_notes가 2건 이상 → 피드백 메모 섹션', () => {
      setupStorage({
        sot_accuracy_ratings: [
          makeAccuracyRating('persona-1', 3, ['tone'], [], '톤은 정확했지만 깊이가 부족'),
          makeAccuracyRating('persona-1', 4, ['tone'], [], '이번엔 훨씬 나아졌다'),
        ],
      });
      const result = buildPersonaAccuracyContext('persona-1');
      expect(result).toContain('사용자 피드백 메모');
      expect(result).toContain('톤은 정확했지만');
      expect(result).toContain('훨씬 나아졌다');
    });

    it('다른 persona의 평가는 무시', () => {
      setupStorage({
        sot_accuracy_ratings: [
          makeAccuracyRating('persona-1', 5, ['tone'], []),
          makeAccuracyRating('persona-2', 1, [], ['all']),
          makeAccuracyRating('persona-1', 4, ['tone'], []),
        ],
      });
      const result = buildPersonaAccuracyContext('persona-1');
      expect(result).toContain('정확도 4.5/5'); // (5+4)/2 = 4.5, not affected by persona-2
    });
  });

  // ═══════════════════════════════════════
  // Cross-scenario
  // ═══════════════════════════════════════
  describe('Cross-scenario: CLAUDE.md 가이드라인 준수', () => {
    it('승인되지 않은 파생 패턴은 참고 문구로도 주입하지 않음', () => {
      mockGetEvalSummary.mockReturnValue({ total_sessions: 10 } as unknown as ReturnType<typeof getEvalSummary>);
      const reframeItems = Array.from({ length: 5 }, () => ({
        id: `rf-${Math.random()}`,
        input_text: 'test',
        selected_question: 'same',
        status: 'done',
        created_at: '', updated_at: '',
        analysis: {
          surface_task: 'task',
          reframed_question: 'same',
          why_reframing_matters: 'w',
          reasoning_narrative: '',
          hidden_assumptions: [
            { assumption: 'a', risk_if_false: 'r', evaluation: 'uncertain', axis: 'customer_value' },
            { assumption: 'b', risk_if_false: 'r', evaluation: 'uncertain', axis: 'feasibility' },
            { assumption: 'c', risk_if_false: 'r', evaluation: 'uncertain', axis: 'org_capacity' },
          ],
          hidden_questions: [],
          ai_limitations: [],
        },
      }));

      setupStorage({
        sot_judgments: [makeJudgment(), makeJudgment()],
        sot_reframe_list: reframeItems,
      });
      mockGetSignals.mockReturnValue([
        { signal_type: 'actor_override_direction', signal_data: { from_actor: 'ai', to_actor: 'human' }, created_at: '' },
        { signal_type: 'actor_override_direction', signal_data: { from_actor: 'ai', to_actor: 'human' }, created_at: '' },
        { signal_type: 'actor_override_direction', signal_data: { from_actor: 'ai', to_actor: 'human' }, created_at: '' },
      ] as unknown as ReturnType<typeof getSignalsByType>);

      const result = buildEnhancedSystemPrompt(BASE_PROMPT);
      const insightLines = result.split('\n').filter(l => l.trimStart().startsWith('- 참고:'));
      expect(insightLines).toEqual([]);
      expect(mockGetSignals).not.toHaveBeenCalled();
      expect(mockGetEvalSummary).not.toHaveBeenCalled();
    });
  });
});
