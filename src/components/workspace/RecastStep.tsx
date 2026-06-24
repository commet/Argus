'use client';

import { DAILY_LIMIT } from '@/lib/quota-config';
import { useEffect, useState } from 'react';
import { track, trackError } from '@/lib/analytics';
import { LocaleLink } from '@/components/ui/LocaleLink';
import { useRecastStore } from '@/stores/useRecastStore';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { ShareBar } from '@/components/ui/ShareBar';
import { recastToMarkdown } from '@/lib/export';
import { callLLMJson, callLLMStream, parseJSON } from '@/lib/llm';
import { toDisplayError, isAuthError } from '@/lib/error-display';
import type { RecastAnalysis, RecastItem, ReframeItem, Persona, ActorRelationship } from '@/stores/types';
import { StepEntry } from '@/components/ui/StepEntry';
import { useHandoffStore } from '@/stores/useHandoffStore';
import { useProjectStore } from '@/stores/useProjectStore';
import { useJudgmentStore } from '@/stores/useJudgmentStore';
import { buildEnhancedSystemPrompt } from '@/lib/context-builder';
import { NextStepGuide } from '@/components/ui/NextStepGuide';
import { FileText, Trash2, Check, Plus, AlertTriangle, ArrowRight, RotateCcw, Send } from 'lucide-react';
import { WorkflowGraph } from './WorkflowGraph';
import { useReframeStore } from '@/stores/useReframeStore';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { playSuccessTone, resumeAudioContext } from '@/lib/audio';
import { buildReframeContext, injectReframeContext, mergeAssumptionsIntoKeyAssumptions } from '@/lib/context-chain';
import type { ReframeContext } from '@/stores/types';
import { ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import { NavigatorInline } from '@/components/workspace/NavigatorInline';
import { useT } from '@/contexts/LocaleProvider';
import { recordSignal, getSignals } from '@/lib/signal-recorder';
import { autoPersonaToFull } from '@/lib/auto-persona';
const lazyEvalEngine = () => import('@/lib/eval-engine');
import { usePersonaStore } from '@/stores/usePersonaStore';
import { Users } from 'lucide-react';
import { useLocale } from '@/hooks/useLocale';
import { getCurrentLanguage } from '@/lib/i18n';

const SYSTEM_PROMPT_KO = `당신은 전략기획 전문가입니다. 단순 작업 목록이 아니라, 의사결정자를 설득할 수 있는 실행 설계를 만드세요.

[사고 방식]
- 결론 먼저: "그래서 뭘 하자는 건데?"에 한 문장으로 답할 수 있어야 합니다.
- 스토리라인: 왜 이 접근인지를 상황→문제→해결 구조로 설명하세요.
- 기대 산출물: 각 단계가 "뭘 만드는지" 구체적으로 명시하세요. ("시장 조사"가 아니라 "TAM/SAM 분석 1장 + 경쟁사 맵")
- 판단 포인트: 사람이 결정해야 하는 단계에서는 무엇을 결정하는지, 어떤 선택지가 있는지 보여주세요.
- 가정 명시: 이 계획이 성립하려면 참이어야 하는 핵심 가정을 밝히세요.
- 병목 식별: 지연되면 전체가 밀리는 크리티컬 패스를 파악하세요.

[actor 배정 — 각 스텝마다 아래 4가지를 판단하세요]
1. 필요한 정보: 공개 데이터/일반 지식 → ai 유리 | 내부 정보/경험/관계 → human 필요
2. 판단 성격: 정량 분석/패턴 매칭 → ai 유리 | 전략 해석/정치적 판단/프레이밍 → human 필요
3. 실패 비용: 재실행 가능(저비용) → ai 가능 | 되돌릴 수 없음(고비용) → human 또는 both
4. 책임 소재: 프로세스/시스템 → ai 가능 | 특정 의사결정자 → human 또는 both

결과:
- "ai": 4가지 모두 ai 쪽 → AI 단독 실행
- "human": 2번 또는 4번이 human → 사람이 직접 실행
- "both": AI가 분석/옵션을 만들고, 사람이 해석/선택/검증. 이 경우 반드시 ai_scope(AI가 하는 것)와 human_scope(사람이 하는 것)를 구체적으로 작성

[맥락에 따른 조정]
- AI 위임 수준이 "초안 생성만"이면 AI 단독 스텝을 줄이세요
- 중요도가 "경영진 보고" 이상이면 핵심 판단 스텝은 반드시 "human"

아래 JSON 구조로 응답하세요.

1. governing_idea: 의사결정자에게 "그래서?" 하고 물었을 때의 답. 전체 실행의 핵심 방향을 담은 한 문장.
2. storyline: 접근 방향의 논리를 설명하는 서사 구조.
   - situation: 현재 상황 (합의된 사실)
   - complication: 문제 또는 기회 (긴장감을 만드는 것)
   - resolution: 우리의 접근 방향 (governing_idea를 뒷받침하는 논리)
3. goal_summary: 최종 목표를 명확한 한 문장으로 정리
4. steps: 3~5개의 단계 (최대 5개. 더 많으면 합치세요). 각 단계에 대해:
   - task: 할 일 (구체적으로)
   - actor: "ai" | "human" | "human→ai" | "ai→human"
     * "human→ai": 사람이 방향/판단을 먼저 잡고, AI가 실행/생산 (예: 전략 방향 결정 → AI가 초안 작성)
     * "ai→human": AI가 생성/분석한 후, 사람이 결정/수정 (예: AI가 옵션 3개 제시 → 사람이 선택)
     * "human": 사람만 (이해관계자 미팅, 최종 의사결정 등)
     * "ai": AI만 (데이터 수집, 분석 자동화 등)
   - actor_reasoning: 왜 이 담당인지. 위 4가지 판단 근거를 포함하여 1-2문장
   - expected_output: 이 단계의 구체적 기대 산출물 (예: "3개년 매출 시나리오 3개 + 민감도 분석")
   - judgment: actor가 "human", "human→ai", "ai→human"일 때, 사람이 결정할 사항을 "질문: 선택지A vs 선택지B vs 선택지C" 형태로 작성. actor가 "ai"면 빈 문자열
   - checkpoint: true/false (사람이 반드시 확인해야 하는 단계인지)
   - checkpoint_reason: checkpoint가 true일 때 이유
   - estimated_time: 예상 소요시간 (예: "30분", "2시간", "1일")
   - ai_direction_options: actor가 "ai", "human→ai", "ai→human"일 때, 사용자가 AI에게 줄 수 있는 방향 옵션 2-4개. actor가 "human"이면 빈 배열
   - ai_scope: actor가 "human→ai" 또는 "ai→human"일 때, AI가 구체적으로 하는 것. 그 외엔 빈 문자열
   - human_scope: actor가 "human→ai" 또는 "ai→human"일 때, 사람이 구체적으로 하는 것. 그 외엔 빈 문자열
5. key_assumptions: 이 계획이 성립하려면 참이어야 하는 핵심 가정 2~4개. 각 가정에 대해:
   - assumption: 가정 내용
   - importance: "high" | "medium" | "low"
   - certainty: "high" | "medium" | "low" (현재 확신도)
   - if_wrong: 이 가정이 틀리면 계획에 미치는 영향
6. critical_path: 지연 시 전체 일정에 영향을 주는 단계 번호 배열 (예: [1, 3, 5])
7. total_estimated_time: 전체 예상 소요시간
8. ai_ratio: AI 담당 비율 (0~100 정수)
9. human_ratio: 사람 담당 비율 (0~100 정수)
10. design_rationale: 이 워크플로우 순서와 역할 배정의 근거를 2-3문장으로 설명. 왜 이 순서인지, 왜 이 역할 배정인지.
11. suggested_reviewers: 이 계획을 실행 전에 검증해야 할 이해관계자 정확히 3명. 다음을 고려:
    - 이 결과물을 받아볼 사람 (보고 대상, 의사결정자)
    - 이 계획의 자원·권한에 영향을 미치는 사람
    - 이 계획의 현실성을 검증할 현장 전문가
    각 이해관계자에 대해:
    - name: 한국식 성+직함 (예: "김 본부장", "이 팀장")
    - role: 구체적 역할 (예: "영업본부장", "재무팀장")
    - influence: "high" (반대하면 무산) | "medium" (의견 중요) | "low" (참고)
    - decision_style: "analytical" (데이터와 숫자로 판단) | "intuitive" (경험과 직관) | "consensus" (합의와 동의 중시) | "directive" (빠른 결정, 지시형)
    - risk_tolerance: "low" (안전 우선, 실패 회피) | "medium" (균형) | "high" (기회 포착 우선)
    - priorities: 이 프로젝트에서 이 사람이 가장 먼저 확인할 것 (일반적 역할 설명이 아닌 이 맥락의 구체적 관심사)
    - communication_style: 보고 받을 때 구체적 습관 (예: "3분 안에 결론", "데이터 없으면 논의 거부", "비유와 사례로 설명해야 수긍")
    - known_concerns: 이 프로젝트에서 우려할 구체적 사항 (과거 경험이나 현재 상황 기반)
    - success_metric: 이 사람이 OK하려면 보여줘야 할 것 (예: "ROI 3년 시뮬레이션", "경쟁사 대비 차별점 3개")
    - why_relevant: 검증이 필요한 이유 한 문장

반드시 JSON만 응답하세요.`;

const SYSTEM_PROMPT_EN = `You are a strategy expert. Don't produce a plain task list — design an execution plan that can persuade a decision-maker.

[Mindset]
- Conclusion first: you must be able to answer "so what are we doing?" in one sentence.
- Storyline: explain why this approach, in a situation → problem → solution structure.
- Expected output: specify concretely what each step "produces." (Not "market research" but "1 page of TAM/SAM analysis + a competitor map")
- Judgment points: at steps a human must decide, show what is being decided and what the options are.
- State assumptions: surface the key assumptions that must be true for this plan to hold.
- Identify bottlenecks: pin down the critical path that delays everything if it slips.

[actor assignment — judge the following 4 for each step]
1. Information needed: public data / general knowledge → ai favored | internal info / experience / relationships → human required
2. Nature of judgment: quantitative analysis / pattern matching → ai favored | strategic interpretation / political judgment / framing → human required
3. Cost of failure: re-runnable (low cost) → ai possible | irreversible (high cost) → human or both
4. Accountability: process / system → ai possible | a specific decision-maker → human or both

Result:
- "ai": all 4 lean ai → AI executes alone
- "human": item 2 or 4 is human → a human executes directly
- "both": AI produces analysis/options and a human interprets/chooses/verifies. In this case you MUST write ai_scope (what AI does) and human_scope (what the human does) concretely

[Adjust for context]
- If the AI-delegation level is "drafts only," reduce AI-solo steps
- If importance is "executive briefing" or above, the key judgment steps must be "human"

Respond in the JSON structure below.

1. governing_idea: The answer when a decision-maker asks "so?". One sentence capturing the core direction of the whole execution.
2. storyline: The narrative structure explaining the logic of the approach.
   - situation: The current situation (agreed facts)
   - complication: The problem or opportunity (what creates tension)
   - resolution: Our approach (the logic that supports governing_idea)
3. goal_summary: The final goal stated in one clear sentence
4. steps: 3-5 steps (max 5. Merge if there would be more). For each step:
   - task: What to do (concretely)
   - actor: "ai" | "human" | "human→ai" | "ai→human"
     * "human→ai": a human sets the direction/judgment first, then AI executes/produces (e.g. decide strategic direction → AI writes the draft)
     * "ai→human": AI generates/analyzes, then a human decides/edits (e.g. AI proposes 3 options → human picks)
     * "human": human only (stakeholder meetings, final decisions, etc.)
     * "ai": AI only (data collection, analysis automation, etc.)
   - actor_reasoning: Why this owner. 1-2 sentences including the 4 judgment criteria above
   - expected_output: The concrete expected output of this step (e.g. "3 three-year revenue scenarios + sensitivity analysis")
   - judgment: When actor is "human", "human→ai", or "ai→human", write what the human decides as "question: option A vs option B vs option C". If actor is "ai", an empty string
   - checkpoint: true/false (whether a human must verify this step)
   - checkpoint_reason: The reason when checkpoint is true
   - estimated_time: Estimated time (e.g. "30 min", "2 hours", "1 day")
   - ai_direction_options: When actor is "ai", "human→ai", or "ai→human", 2-4 direction options the user can give the AI. If actor is "human", an empty array
   - ai_scope: When actor is "human→ai" or "ai→human", what AI does concretely. Otherwise an empty string
   - human_scope: When actor is "human→ai" or "ai→human", what the human does concretely. Otherwise an empty string
5. key_assumptions: 2-4 key assumptions that must be true for this plan to hold. For each:
   - assumption: The assumption
   - importance: "high" | "medium" | "low"
   - certainty: "high" | "medium" | "low" (current confidence)
   - if_wrong: The impact on the plan if this assumption is wrong
6. critical_path: Array of step numbers that affect the whole schedule if delayed (e.g. [1, 3, 5])
7. total_estimated_time: Total estimated time
8. ai_ratio: Share owned by AI (integer 0-100)
9. human_ratio: Share owned by humans (integer 0-100)
10. design_rationale: Explain in 2-3 sentences the rationale for this workflow order and role assignment. Why this order, why this assignment.
11. suggested_reviewers: Exactly 3 stakeholders who should verify this plan before execution. Consider:
    - The people who will receive this output (reporting audience, decision-makers)
    - The people who affect this plan's resources/authority
    - The field experts who can verify this plan's feasibility
    For each stakeholder:
    - name: Name + title (e.g. "Director Kim", "Team Lead Lee")
    - role: Concrete role (e.g. "VP of Sales", "Finance Team Lead")
    - influence: "high" (their opposition kills it) | "medium" (their opinion matters) | "low" (for reference)
    - decision_style: "analytical" (judges by data and numbers) | "intuitive" (experience and instinct) | "consensus" (values agreement) | "directive" (fast decisions, directive)
    - risk_tolerance: "low" (safety first, failure-averse) | "medium" (balanced) | "high" (prioritizes seizing opportunity)
    - priorities: What this person checks first in this project (a concrete interest in this context, not a generic role description)
    - communication_style: Concrete habits when receiving a report (e.g. "conclusion within 3 minutes", "refuses to discuss without data", "needs analogies and examples to be convinced")
    - known_concerns: Concrete things they'll worry about in this project (based on past experience or the current situation)
    - success_metric: What you must show for this person to say OK (e.g. "3-year ROI simulation", "3 points of differentiation vs competitors")
    - why_relevant: One sentence on why their verification is needed

Respond with JSON only.`;

function getSystemPrompt(): string {
  return getCurrentLanguage() === 'ko' ? SYSTEM_PROMPT_KO : SYSTEM_PROMPT_EN;
}

const buildRecastEntrySteps = (L: (ko: string, en: string) => string) => [
  {
    key: 'outputType',
    question: L('어떤 결과물을 만드나요?', 'What are you making?'),
    options: [
      { value: 'report', emoji: '📝', label: L('보고서/기획서', 'Report/proposal'), description: L('의사결정용 문서', 'Document for decisions') },
      { value: 'product', emoji: '💻', label: L('제품/기능 개발', 'Product/feature dev'), description: L('소프트웨어 빌드', 'Software build') },
      { value: 'research', emoji: '🔬', label: L('리서치/분석', 'Research/analysis'), description: L('조사와 인사이트 도출', 'Investigation and insight') },
      { value: 'campaign', emoji: '📢', label: L('마케팅/캠페인', 'Marketing/campaign'), description: L('고객 대상 활동', 'Customer-facing activity') },
    ],
  },
  {
    key: 'timeline',
    question: L('기한이 어떻게 되나요?', 'What is the deadline?'),
    options: [
      { value: 'urgent', emoji: '🔥', label: L('1주 이내', 'Within 1 week'), description: L('급한 요청, 속도 우선', 'Urgent — speed first') },
      { value: 'normal', emoji: '📅', label: L('2~3주', '2–3 weeks'), description: L('일반적인 프로젝트 기한', 'Typical project timeline') },
      { value: 'relaxed', emoji: '🗓️', label: L('한 달 이상', 'Over a month'), description: L('충분한 검토 시간', 'Plenty of review time') },
      { value: 'undefined', emoji: '❓', label: L('아직 미정', 'Not set yet'), description: L('기한 없이 진행', 'Proceed without a deadline') },
    ],
  },
  {
    key: 'teamSize',
    question: L('누구와 함께 하나요?', 'Who are you working with?'),
    options: [
      { value: 'solo', emoji: '🧑', label: L('혼자', 'Solo'), description: L('1인 작업', 'Solo work') },
      { value: 'small', emoji: '👥', label: L('2~3명', '2–3 people'), description: L('소규모 협업', 'Small-team collaboration') },
      { value: 'team', emoji: '👨‍👩‍👧‍👦', label: L('5명 이상 팀', '5+ team'), description: L('역할 분담 필요', 'Need role division') },
      { value: 'cross', emoji: '🏢', label: L('외부 협력 포함', 'Includes external partners'), description: L('타 부서·외주·파트너', 'Cross-dept, vendors, partners') },
    ],
  },
  {
    key: 'aiComfort',
    question: L('AI에게 어디까지 맡기시겠어요?', 'How much will you delegate to AI?'),
    options: [
      { value: 'draft', emoji: '✏️', label: L('초안 생성만', 'Drafts only'), description: L('사람이 대부분 판단', 'Humans make most decisions') },
      { value: 'analysis', emoji: '📊', label: L('분석과 초안', 'Analysis and drafts'), description: L('AI가 자료 수집·분석', 'AI gathers and analyzes') },
      { value: 'decision-support', emoji: '🧭', label: L('판단 지원까지', 'Decision support'), description: L('AI가 선택지와 근거 제시', 'AI proposes options with reasoning') },
      { value: 'full', emoji: '🚀', label: L('실행까지 위임', 'Full delegation'), description: L('사람은 최종 확인만', 'Human only does final check') },
    ],
  },
  {
    key: 'stakes',
    question: L('이 결과물의 중요도는?', 'How important is the output?'),
    options: [
      { value: 'low', emoji: '📋', label: L('내부 참고용', 'Internal reference'), description: L('부담 없는 내부 문서', 'Low-stakes internal doc') },
      { value: 'medium', emoji: '👔', label: L('팀/부서 발표', 'Team/dept. presentation'), description: L('동료·팀장이 볼 자료', 'Materials for peers/leads') },
      { value: 'high', emoji: '🏛️', label: L('경영진 보고', 'Executive briefing'), description: L('의사결정권자에게 전달', 'Goes to decision-makers') },
      { value: 'critical', emoji: '⚡', label: L('외부 고객/투자자', 'External clients/investors'), description: L('실패 시 비용이 큰 상황', 'High cost if it fails') },
    ],
  },
];

/* ── Recasting Loader ── */
function RecastLoader() {
  const locale = useLocale();
  const L = (ko: string, en: string) => locale === 'ko' ? ko : en;
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setPhase((p) => (p + 1) % 3), 2800);
    return () => clearInterval(timer);
  }, []);

  const messages = [
    L('역할을 배분하고 있습니다', 'Assigning roles'),
    L('실행 순서를 조율합니다', 'Sequencing execution'),
    L('검증 포인트를 설계합니다', 'Designing checkpoints'),
  ];

  const bars = [
    { w: '72%', c: '#3b6dcc' },
    { w: '45%', c: '#2d6b2d' },
    { w: '58%', c: '#b8860b' },
    { w: '84%', c: '#3b6dcc' },
    { w: '36%', c: '#2d6b2d' },
  ];

  return (
    <div className="py-10">
      <div className="max-w-xs mx-auto mb-8 space-y-1.5">
        {bars.map((bar, i) => (
          <div
            key={i}
            className="h-3 rounded-sm"
            style={{
              width: bar.w,
              backgroundColor: bar.c,
              animation: `assemble-bar 2.4s ease-in-out ${i * 0.4}s infinite`,
            }}
          />
        ))}
      </div>
      <p className="text-center text-[14px] text-[var(--text-primary)] font-medium">
        {messages[phase]}
      </p>
      <div className="flex justify-center gap-1.5 mt-3">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className={`h-1 rounded-full transition-all duration-500 ${
              i === phase ? 'w-5 bg-[var(--accent)]' : 'w-1.5 bg-[var(--border)]'
            }`}
          />
        ))}
      </div>
    </div>
  );
}

interface RecastStepProps {
  onNavigate: (step: string) => void;
}

export function RecastStep({ onNavigate }: RecastStepProps) {
  const locale = useLocale();
  const t = useT();
  const L = (ko: string, en: string) => locale === 'ko' ? ko : en;
  const RECAST_ENTRY_STEPS = buildRecastEntrySteps(L);
  const store = useRecastStore();
  const { items, currentId, loadItems, createItem, updateItem, deleteItem, setCurrentId, getCurrentItem, updateStep, removeStep, addStep, reorderSteps } = store;
  const { judgments, addJudgment, loadJudgments } = useJudgmentStore();
  const { handoff, clearHandoff, setHandoff } = useHandoffStore();
  const { addRef } = useProjectStore();
  const { items: reframeItems, loadItems: loadReframe } = useReframeStore();
  const { settings } = useSettingsStore();
  const [inputText, setInputText] = useState('');
  const [error, setError] = useState('');
  const [pendingProjectId, setPendingProjectId] = useState<string | undefined>();
  const [reframeCtx, setReframeCtx] = useState<ReframeContext | null>(null);
  // multi-lens review removed — auto-persona + rehearsal replaces it
  const [streamingText, setStreamingText] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);

  useEffect(() => {
    loadItems();
    loadJudgments();
    loadReframe();
  }, [loadItems, loadJudgments, loadReframe]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (handoff && handoff.from === 'reframe') {
      setInputText(handoff.content || '');
      setPendingProjectId(handoff.projectId);
      // Capture typed context from decompose (Phase 0)
      if (handoff.contextData && 'reframed_question' in handoff.contextData) {
        setReframeCtx(handoff.contextData as ReframeContext);
      }
      clearHandoff();
    }
  }, []);  // Run once on mount

  // Recover items stuck in 'analyzing'
  useEffect(() => {
    items.forEach((item) => {
      if (item.status === 'analyzing') {
        updateItem(item.id, { status: 'input' });
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const current = getCurrentItem();

  // Find latest related decompose item for context chain (not first/oldest)
  const relatedReframe = current?.project_id
    ? reframeItems
        .filter(d => d.project_id === current.project_id && d.status === 'done' && d.analysis)
        .sort((a, b) => (b.updated_at || '').localeCompare(a.updated_at || ''))
        [0] || null
    : null;

  const handleAnalyze = async (prompt?: string) => {
    const finalPrompt = prompt || inputText;
    if (!finalPrompt.trim()) return;
    setError('');
    const id = createItem();
    updateItem(id, {
      input_text: finalPrompt,
      status: 'analyzing',
      ...(pendingProjectId ? { project_id: pendingProjectId } : {}),
    });
    if (pendingProjectId) {
      addRef(pendingProjectId, { tool: 'recast', itemId: id, label: L('워크플로우 설계', 'Workflow design') });
      setPendingProjectId(undefined);
    }

    // Build system prompt: base + user patterns + typed decompose context
    let systemPrompt = buildEnhancedSystemPrompt(getSystemPrompt(), current?.project_id || pendingProjectId);

    // Inject typed context from decompose (Phase 0 pipeline)
    const ctx = reframeCtx || (relatedReframe ? buildReframeContext(relatedReframe) : null);
    if (ctx) {
      systemPrompt = injectReframeContext(systemPrompt, ctx);
    }

    // Note: multi-lens review was removed — replaced by auto-persona + rehearsal
    if (false) { // dead code path kept for reference
    }

    // Start streaming for preview
    setIsStreaming(true);
    setStreamingText('');

    try {
      const fullText = await new Promise<string>((resolve, reject) => {
        callLLMStream(
          [{ role: 'user', content: finalPrompt }],
          { system: systemPrompt, maxTokens: 3500 },
          {
            onToken: (text) => setStreamingText(text),
            onComplete: (text) => resolve(text),
            onError: (err) => reject(err),
          }
        );
      });

      setIsStreaming(false);
      setStreamingText('');

      // Try to parse JSON from the streamed text
      let analysis: RecastAnalysis;
      try {
        analysis = parseJSON<RecastAnalysis>(fullText);
      } catch {
        // JSON parse failed — fall back to non-streaming call
        analysis = await callLLMJson<RecastAnalysis>(
          [{ role: 'user', content: finalPrompt }],
          { system: systemPrompt, maxTokens: 3500, shape: { governing_idea: 'string', steps: 'array', key_assumptions: 'array', critical_path: 'array' } }
        );
      }

      // Code-level guarantee: cap steps at 5
      if (analysis.steps && analysis.steps.length > 5) {
        analysis.steps = analysis.steps.slice(0, 5);
      }

      // Code-level guarantee: merge decompose assumptions into key_assumptions
      const reframeAssumptions = (ctx as ReframeContext | null)?.unverified_assumptions || [];
      if (reframeAssumptions.length > 0 && analysis.key_assumptions) {
        analysis.key_assumptions = mergeAssumptionsIntoKeyAssumptions(
          reframeAssumptions,
          analysis.key_assumptions
        );
      }

      // Code-level validation: flag AI limitation conflicts
      const aiLimitations = (ctx as ReframeContext | null)?.ai_limitations || [];
      if (aiLimitations.length > 0 && analysis.steps) {
        const aiSteps = analysis.steps.filter(s => s.actor === 'ai');
        const warnings: string[] = [];
        for (const limitation of aiLimitations) {
          const limitWords = limitation.toLowerCase().split(/\s+/).filter(w => w.length > 2);
          for (const step of aiSteps) {
            const stepText = `${step.task} ${step.expected_output || ''}`.toLowerCase();
            const overlap = limitWords.filter(w => stepText.includes(w));
            if (overlap.length >= 2) {
              warnings.push(L(`"${step.task}" → AI 한계와 충돌 가능: "${limitation}"`, `"${step.task}" → may conflict with AI limitation: "${limitation}"`));
            }
          }
        }
        if (warnings.length > 0) {
          analysis.ai_limitation_warnings = warnings;
        }
      }

      // Phase 2B: Preserve existing reviews when re-analyzing
      const existingReviews = current?.analysis?.reviews;
      if (existingReviews && existingReviews.length > 0) {
        analysis.previous_reviews = existingReviews;
      }
      updateItem(id, { analysis, steps: analysis.steps, status: 'review' });
    } catch (err) {
      setIsStreaming(false);
      setStreamingText('');
      trackError('recast_analyze', err);
      const de = toDisplayError(err);
      if (isAuthError(err)) {
        setError('LOGIN_REQUIRED');
      } else {
        setError(de.message || L('항로를 잡을 수 없었습니다. 다시 시도하거나 더 구체적으로 입력해보세요.', 'Could not assign the crew. Try again or be more specific.'));
      }
      updateItem(id, { status: 'input' });
    }
  };

  const handleConfirm = () => {
    if (!currentId) return;
    updateItem(currentId, { status: 'done' });
    track('recast_complete', {
      steps: steps.length,
      checkpoints: steps.filter(s => s.checkpoint).length,
      ai_steps: steps.filter(s => s.actor === 'ai').length,
      human_steps: steps.filter(s => s.actor === 'human').length,
      both_steps: steps.filter(s => s.actor === 'both').length,
      has_reviews: !!(current?.analysis?.reviews?.length),
      ai_limitation_warnings: current?.analysis?.ai_limitation_warnings?.length || 0,
    });
    if (current) { const oc = useJudgmentStore.getState().judgments.filter(j => j.type === 'actor_override' && j.project_id === current.project_id).length; lazyEvalEngine().then(m => m.recordRecastEval(current, oc)); }
    if (settings.audio_enabled) {
      resumeAudioContext();
      playSuccessTone(settings.audio_volume);
    }
  };

  const steps = current?.steps || [];

  const handleStepActorChange = (stepIndex: number, newActor: ActorRelationship) => {
    if (!currentId) return;
    const step = steps[stepIndex];
    if (step && step.actor !== newActor) {
      track('actor_changed', { from: step.actor, to: newActor, step_task: step.task.slice(0, 50) });
      addJudgment({
        type: 'actor_override',
        context: step.task,
        decision: newActor,
        original_ai_suggestion: step.actor,
        user_changed: true,
        project_id: current?.project_id,
        tool: 'recast',
      });
      recordSignal({
        project_id: current?.project_id,
        tool: 'recast',
        signal_type: 'actor_override_direction',
        signal_data: { from_actor: step.actor, to_actor: newActor, step_task: step.task?.slice(0, 100) },
      });
    }
    updateStep(currentId, stepIndex, { actor: newActor });
  };
  const stats = steps.length > 0 ? {
    ai: steps.filter((s) => s.actor === 'ai').length,
    human: steps.filter((s) => s.actor === 'human').length,
    both: steps.filter((s) => s.actor === 'both').length,
    checkpoints: steps.filter((s) => s.checkpoint).length,
    humanPercent: Math.round(((steps.filter((s) => s.actor === 'human' || s.actor === 'both').length) / steps.length) * 100),
  } : null;

  const handleDragStart = (e: React.DragEvent, index: number) => {
    e.dataTransfer.setData('text/plain', String(index));
  };

  const handleDrop = (e: React.DragEvent, toIndex: number) => {
    e.preventDefault();
    const fromIndex = parseInt(e.dataTransfer.getData('text/plain'));
    if (currentId && fromIndex !== toIndex) reorderSteps(currentId, fromIndex, toIndex);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[22px] font-bold text-[var(--text-primary)]" style={{ fontFamily: 'var(--font-display)' }}>{t('tool.recast')} <span className="text-[16px] font-normal text-[var(--text-secondary)]">| {t('tool.recast.subtitle')}</span></h1>
          <p className="text-[13px] text-[var(--text-secondary)] mt-1">
            {L('AI와 사람의 역할을 나누고, 실행 단계를 설계합니다.', 'Divide roles between AI and humans, and design execution steps.')}
          </p>
          {(() => {
            const signals = getSignals({ tool: 'recast' });
            return signals.length > 0 ? (
              <p className="text-[11px] text-[var(--text-tertiary)] mt-1.5">
                {L(`이전 ${signals.length}건의 선원 배치 이력이 학습에 반영되고 있습니다`, `${signals.length} prior recast sessions are informing the analysis`)}
              </p>
            ) : null;
          })()}
          <div className="mt-2">
            <NavigatorInline step="recast" />
          </div>
        </div>
      </div>

      {/* History */}
      {items.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-2">
          {items.map((item) => (
            <button
              key={item.id}
              onClick={() => { setCurrentId(item.id); setInputText(''); }}
              className={`shrink-0 flex items-center gap-2 px-3 py-2 rounded-lg text-[13px] border transition-colors cursor-pointer ${
                currentId === item.id
                  ? 'border-[var(--accent)] bg-[var(--ai)] text-[var(--text-primary)]'
                  : 'border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--accent)]'
              }`}
            >
              <FileText size={14} />
              {(item.analysis?.goal_summary || item.input_text || L('맵', 'Map')).slice(0, 25)}
              <span onClick={(e) => { e.stopPropagation(); deleteItem(item.id); }} className="ml-1 p-0.5 hover:text-red-500 cursor-pointer">
                <Trash2 size={12} />
              </span>
            </button>
          ))}
        </div>
      )}

      {/* ─── STEP 1: Input ─── */}
      {(!current || current.status === 'input') && !currentId && (
        <Card>
          {reframeCtx && (
            <div className="flex items-center gap-1.5 text-[11px] text-[var(--accent)] mb-3">
              <Check size={12} /> {L('항로 재설정 맥락이 반영되고 있습니다', 'Reframe context is being applied')}
            </div>
          )}
          <StepEntry
            steps={RECAST_ENTRY_STEPS}
            textLabel={L('추가로 알려줄 맥락이 있나요?', 'Any extra context to share?')}
            textPlaceholder={L("예: 지난 분기 실적 데이터를 반드시 포함해야 함 / 마케팅팀과 병렬 진행 중 / 대표가 '고객 관점'을 강조했음", "e.g., Must include last quarter's results / running in parallel with marketing / CEO emphasized 'customer perspective'")}
            animatedPlaceholders={[
              L('예: 지난 분기 실적 데이터를 반드시 포함해야 함', "e.g., Must include last quarter's results"),
              L('예: 마케팅팀과 병렬 진행 중이라 일정 조율 필요', 'e.g., Running in parallel with marketing — schedule coordination needed'),
              L('예: 대표가 "고객 관점"을 강조했음', 'e.g., CEO emphasized "customer perspective"'),
              L('예: 3주 내 경영회의 발표 예정, 실행안 수준 필요', 'e.g., Exec meeting in 3 weeks — needs execution-level plan'),
              L('예: 기술팀 리소스 2명만 투입 가능, 외주 고려 중', 'e.g., Only 2 engineers available — considering outsourcing'),
            ]}
            textHint={L('위에서 선택한 내용만으로도 충분합니다. 특수한 조건이나 배경이 있다면 자유롭게 적어주세요.', 'The selections above are enough. Feel free to add any unique conditions or background.')}
            submitLabel={L('워크플로우 설계', 'Design workflow')}
            initialText={inputText}
            contextPanel={reframeCtx ? (
              <div className="rounded-xl bg-[var(--bg)] border border-[var(--border-subtle)] px-4 py-3">
                <p className="text-[11px] font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-1.5">{L('항로 재설정에서 도출된 맥락', 'Context from reframe')}</p>
                <p className="text-[14px] font-semibold text-[var(--text-primary)] leading-snug">
                  {reframeCtx.reframed_question || reframeCtx.surface_task}
                </p>
                {reframeCtx.unverified_assumptions && reframeCtx.unverified_assumptions.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {reframeCtx.unverified_assumptions.slice(0, 3).map((a, i) => (
                      <span key={i} className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 text-[10px] font-medium border border-amber-200">
                        {L('미확인', 'Unverified')}: {typeof a === 'string' ? a : a.assumption}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ) : undefined}
            onSubmit={(selections, text) => {
              const context = Object.entries(selections)
                .map(([k, v]) => {
                  const step = RECAST_ENTRY_STEPS.find(s => s.key === k);
                  const opt = step?.options.find(o => o.value === v);
                  return opt ? `${step?.question.replace('?', '')}: ${opt.label}` : '';
                })
                .filter(Boolean)
                .join('\n');
              const contextHeader = L('맥락', 'Context');
              const extraHeader = L('추가 맥락', 'Additional context');
              const fullPrompt = context
                ? (text.trim() ? `[${contextHeader}]\n${context}\n\n[${extraHeader}]\n${text}` : `[${contextHeader}]\n${context}`)
                : text;
              handleAnalyze(fullPrompt);
            }}
          />
          {error && (
            error === 'LOGIN_REQUIRED' ? (
              <div className="rounded-xl border border-[var(--accent)]/30 bg-[var(--accent)]/5 px-4 py-4 mt-3">
                <p className="text-[14px] font-bold text-[var(--text-primary)] mb-1">{L('무료 체험을 모두 사용했어요', 'Your free trial is used up')}</p>
                <p className="text-[13px] text-[var(--text-secondary)] mb-3">{L(`로그인하면 하루 ${DAILY_LIMIT}회까지 무료로 계속 사용할 수 있습니다.`, `Sign in to keep using it free — up to ${DAILY_LIMIT} calls a day.`)}</p>
                <LocaleLink href="/login" className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--accent)] text-[var(--bg)] text-[13px] font-semibold hover:shadow-[var(--shadow-sm)] hover:-translate-y-[1px] active:translate-y-0 transition-all">
                  {L('로그인 / 회원가입', 'Sign in / Sign up')}
                </LocaleLink>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-2 text-red-600 text-[13px] bg-red-50 rounded-lg px-3 py-2 mt-3">
                <div className="flex items-center gap-2">
                  <AlertTriangle size={14} /> <span>{error}</span>
                </div>
                <button onClick={() => { setError(''); handleAnalyze(); }} className="shrink-0 px-2.5 py-1 rounded-lg text-[11px] font-medium border border-red-200 text-red-600 hover:bg-red-100 cursor-pointer transition-colors">
                  {L('다시 시도', 'Retry')}
                </button>
              </div>
            )
          )}
        </Card>
      )}

      {/* ─── Loading / Streaming Preview ─── */}
      {current?.status === 'analyzing' && (
        <Card>
          <RecastLoader />
        </Card>
      )}

      {/* ─── STEP 2: Review & Edit ─── */}
      {(current?.status === 'review' || current?.status === 'done') && (
        <div className="space-y-6 animate-fade-in">
          {/* ── Strategic Context: question → direction (integrated flow) ── */}
          {/* Strategic context — clean, compact */}
          {current.analysis && (
            <div className="space-y-3">
              {/* 재정의된 질문 (from 항로 재설정) — compact reference */}
              {relatedReframe?.analysis && (
                <div className="rounded-xl bg-[var(--bg)] px-4 py-3">
                  <p className="text-[11px] font-medium text-[var(--text-secondary)] mb-1">{L('항로 재설정에서 재정의된 질문', 'Reframed question from Reframe')}</p>
                  <p className="text-[14px] font-bold text-[var(--text-primary)] leading-snug">
                    {relatedReframe.selected_question || relatedReframe.analysis.reframed_question || relatedReframe.analysis.surface_task}
                  </p>
                </div>
              )}

              {/* 핵심 방향 */}
              <div className="rounded-xl bg-[var(--primary)] text-[var(--bg)] px-5 py-4 shadow-md">
                <p className="text-[11px] font-medium text-white/50 mb-1">{t('recast.governingIdea')}</p>
                <p className="text-[16px] font-bold leading-snug" style={{ fontFamily: 'var(--font-display)' }}>
                  {current.analysis.governing_idea}
                </p>
                {/* Honest provenance: governing_idea is AI-drafted, not the user's settled call. */}
                <p className="text-[10px] text-white/45 mt-2">
                  {locale === 'ko' ? 'AI가 정리한 방향 — 당신이 손볼 수 있어요' : 'AI-drafted direction — yours to adjust'}
                </p>
              </div>

              {/* Storyline removed — governing_idea already captures the direction */}
            </div>
          )}

          {/* Timeline — parallel track visualization */}
          <WorkflowGraph
            steps={steps}
            analysis={current.analysis}
            editable={current.status === 'review'}
            onUpdateActor={(idx, actor) => handleStepActorChange(idx, actor)}
            onToggleCheckpoint={(idx) => { if (currentId) updateStep(currentId, idx, { checkpoint: !steps[idx].checkpoint }); }}
            onRemoveStep={(idx) => { if (currentId) { const removedStep = steps[idx]; removeStep(currentId, idx); recordSignal({ project_id: current?.project_id, tool: 'recast', signal_type: 'step_structural_change', signal_data: { action: 'delete', step_actor: removedStep?.actor, step_task: removedStep?.task?.slice(0, 100) } }); } }}
            onUpdateField={(idx, updates) => { if (currentId) updateStep(currentId, idx, updates); }}
          />

          {current.status === 'review' && (
            <Button variant="ghost" onClick={() => { if (currentId) { addStep(currentId); recordSignal({ project_id: current?.project_id, tool: 'recast', signal_type: 'step_structural_change', signal_data: { action: 'add' } }); } }}>
              <Plus size={14} /> {L('단계 추가', 'Add step')}
            </Button>
          )}

          {/* Design rationale — if exists */}
          {current.analysis?.design_rationale && (
            <p className="text-[13px] text-[var(--text-secondary)] italic leading-relaxed">
              {current.analysis.design_rationale}
            </p>
          )}

          {/* AI limitation warnings — code-level validation */}
          {current.analysis?.ai_limitation_warnings && current.analysis.ai_limitation_warnings.length > 0 && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
              <p className="text-[12px] font-semibold text-amber-800 mb-1.5">
                <AlertTriangle size={12} className="inline mr-1 -mt-0.5" />
                {L('AI 한계 주의', 'AI limitation warning')}
              </p>
              {current.analysis.ai_limitation_warnings.map((w, i) => (
                <p key={i} className="text-[12px] text-amber-700 leading-relaxed">- {w}</p>
              ))}
            </div>
          )}

          {error && (
            <div className="flex items-center justify-between gap-2 text-red-600 text-[13px] bg-red-50 rounded-lg px-3 py-2">
              <div className="flex items-center gap-2">
                <AlertTriangle size={14} /> <span>{error}</span>
              </div>
              <button onClick={() => { setError(''); handleAnalyze(); }} className="shrink-0 px-2.5 py-1 rounded-lg text-[11px] font-medium border border-red-200 text-red-600 hover:bg-red-100 cursor-pointer transition-colors">
                {L('다시 시도', 'Retry')}
              </button>
            </div>
          )}

          <div className="flex items-center justify-between pt-2">
            {current.status === 'review' ? (
              <>
                <Button variant="secondary" size="sm" onClick={() => { setCurrentId(null); setInputText(''); setPendingProjectId(undefined); }}>
                  <RotateCcw size={14} /> {t('common.newStart')}
                </Button>
                <div className="flex gap-2">
                  <ShareBar getText={() => recastToMarkdown(current)} getTitle={() => L('선원 배치 | ', 'Recast | ') + (current.analysis?.goal_summary || '')} />
                  <Button onClick={handleConfirm}>
                    <Check size={14} /> {t('common.confirm')}
                  </Button>
                </div>
              </>
            ) : (
              <>
                <Button variant="secondary" size="sm" onClick={() => { setCurrentId(null); setInputText(''); setPendingProjectId(undefined); }}>
                  <ArrowRight size={14} /> {L('새 맵', 'New map')}
                </Button>
                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      const content = recastToMarkdown(current!);
                      setHandoff({
                        from: 'recast',
                        fromItemId: current!.id,
                        content,
                        projectId: current!.project_id,
                      });
                      onNavigate('rehearse');
                    }}
                  >
                    <Send size={14} /> {L('리허설 받기', 'Run rehearsal')}
                  </Button>
                  <ShareBar getText={() => recastToMarkdown(current)} getTitle={() => L('선원 배치 | ', 'Recast | ') + (current.analysis?.goal_summary || '')} />
                </div>
              </>
            )}
          </div>
          {/* ── Reward: 실행 설계 요약 ── */}
          {current.status === 'done' && current.analysis && (() => {
            const a = current.analysis;
            const checkpoints = steps.filter(s => s.checkpoint).length;
            const humanDecisions = steps.filter(s => s.actor === 'human' || s.actor === 'both').length;
            const aiAuto = steps.filter(s => s.actor === 'ai').length;
            const keyAssumptions = a.key_assumptions?.length || 0;
            return (
              <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] p-4 reward-entrance">
                <p className="text-[12px] font-bold text-[var(--text-primary)] mb-1">
                  {humanDecisions > 0
                    ? L(`${steps.length}단계 중 ${humanDecisions}곳에서 당신의 판단이 필요합니다`, `${humanDecisions} of ${steps.length} steps need your judgment`)
                    : L(`${steps.length}단계 중 AI가 전체를 실행합니다`, `AI will run all ${steps.length} steps`)}
                </p>
                {aiAuto > 0 && (
                  <p className="text-[11px] text-[var(--text-secondary)] mb-2.5">
                    {L(`나머지 ${aiAuto}단계는 AI가 실행합니다${checkpoints > 0 ? ` · 체크포인트 ${checkpoints}곳` : ''}`, `The other ${aiAuto} steps run on AI${checkpoints > 0 ? ` · ${checkpoints} checkpoints` : ''}`)}
                  </p>
                )}
                {keyAssumptions > 0 && (
                  <p className="text-[11px] text-[var(--accent)]">
                    {L(`핵심 가정 ${keyAssumptions}건 — 리허설에서 이해관계자들이 검증합니다`, `${keyAssumptions} key assumptions — stakeholders will verify them in rehearsal`)}
                  </p>
                )}
              </div>
            );
          })()}

          {current.status === 'done' && current.analysis && (
            <QuickRehearsalCard
              recast={current}
              reframe={relatedReframe || null}
              onStartRehearsal={(personas) => {
                if (!current) return;
                const content = recastToMarkdown(current);
                setHandoff({
                  from: 'recast',
                  fromItemId: current.id,
                  content,
                  projectId: current.project_id,
                  autoPersonaIds: personas.map(p => p.id),
                });
                onNavigate('rehearse');
              }}
            />
          )}
          {current.status === 'done' && (
            <NextStepGuide
              currentTool="recast"
              projectId={current?.project_id}
              onSendTo={(href) => {
                if (!current) return;
                const content = recastToMarkdown(current);
                setHandoff({ from: 'recast', fromItemId: current.id, content, projectId: current.project_id });
                onNavigate(href.replace('/tools/', ''));
              }}
            />
          )}
        </div>
      )}
    </div>
  );
}

// ── Quick Rehearsal Card — reads from analysis.suggested_reviewers (no extra LLM call) ──
function QuickRehearsalCard({
  recast,
  onStartRehearsal,
}: {
  recast: RecastItem;
  reframe: ReframeItem | null;
  onStartRehearsal: (personas: Persona[]) => void;
}) {
  const locale = useLocale();
  const L = (ko: string, en: string) => locale === 'ko' ? ko : en;
  const reviewers = recast.analysis?.suggested_reviewers || [];
  const [selected, setSelected] = useState<Set<number>>(new Set(reviewers.map((_, i) => i)));
  const [started, setStarted] = useState(false);
  const { createPersona, personas } = usePersonaStore();

  if (reviewers.length === 0) return null;

  const handleStart = () => {
    if (started) return; // prevent duplicate persona creation
    setStarted(true);
    const selectedPersonas = reviewers
      .filter((_, i) => selected.has(i))
      .map(r => {
        const full = autoPersonaToFull(r);
        // Check if persona with same name+role already exists (dedup)
        const existing = personas.find(p => p.name === full.name && p.role === full.role);
        if (!existing) {
          createPersona(full);
        }
        return existing || full;
      });
    if (selectedPersonas.length > 0) {
      onStartRehearsal(selectedPersonas);
    }
  };

  const influenceColors: Record<string, string> = {
    high: 'bg-red-100 text-red-700',
    medium: 'bg-amber-100 text-amber-700',
    low: 'bg-gray-100 text-gray-600',
  };
  const influenceLabels: Record<string, string> = { high: L('높음', 'High'), medium: L('중간', 'Medium'), low: L('낮음', 'Low') };

  return (
    <Card className="!bg-[var(--checkpoint)] !border-amber-200">
      <div className="flex items-center gap-2 mb-2">
        <Users size={16} className="text-amber-700" />
        <p className="text-[14px] font-bold text-[var(--text-primary)]">{L('이 계획을 검증할 이해관계자', 'Stakeholders to verify this plan')}</p>
      </div>
      <p className="text-[12px] text-[var(--text-secondary)] mb-3">
        {L('프로젝트 맥락에서 이해관계자를 도출했습니다. 선택 후 바로 리허설을 시작하세요.', 'Stakeholders derived from project context. Pick any and start a rehearsal.')}
      </p>

      <div className="space-y-2.5">
        {reviewers.map((reviewer, i) => (
          <label
            key={i}
            className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
              selected.has(i)
                ? 'border-[var(--accent)] bg-[var(--surface)] shadow-sm'
                : 'border-[var(--border-subtle)] bg-[var(--surface)]/50 opacity-60'
            }`}
          >
            <input
              type="checkbox"
              checked={selected.has(i)}
              onChange={() => {
                setSelected(prev => {
                  const next = new Set(prev);
                  next.has(i) ? next.delete(i) : next.add(i);
                  return next;
                });
              }}
              className="mt-1 w-4 h-4 accent-[var(--accent)] cursor-pointer"
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-0.5">
                <span className="text-[14px] font-bold text-[var(--text-primary)]">{reviewer.name}</span>
                <span className="text-[12px] text-[var(--text-secondary)]">{reviewer.role}</span>
                <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${influenceColors[reviewer.influence]}`}>
                  {influenceLabels[reviewer.influence]}
                </span>
              </div>
              <p className="text-[12px] text-[var(--text-secondary)] leading-relaxed mb-1.5">{reviewer.why_relevant}</p>
              <div className="flex flex-wrap gap-1.5">
                {reviewer.decision_style && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--ai)] text-[#2d4a7c] font-medium">
                    {{ analytical: L('데이터 중심', 'Data-driven'), intuitive: L('직관 중심', 'Intuitive'), consensus: L('합의 중시', 'Consensus-driven'), directive: L('빠른 결정', 'Decisive') }[reviewer.decision_style]}
                  </span>
                )}
                {reviewer.risk_tolerance && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--bg)] text-[var(--text-secondary)] font-medium">
                    {L('리스크', 'Risk')} {{ low: L('회피', 'averse'), medium: L('균형', 'balanced'), high: L('수용', 'tolerant') }[reviewer.risk_tolerance]}
                  </span>
                )}
                {reviewer.success_metric && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--collab)] text-[#2d6b2d] font-medium">
                    OK: {reviewer.success_metric.slice(0, 30)}{reviewer.success_metric.length > 30 ? '...' : ''}
                  </span>
                )}
              </div>
            </div>
          </label>
        ))}

        <Button onClick={handleStart} disabled={selected.size === 0}>
          <Users size={14} /> {L(`${selected.size}명에게 리허설 받기`, `Run rehearsal with ${selected.size}`)}
        </Button>
      </div>
    </Card>
  );
}
