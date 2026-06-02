// ─── Reframe (항로 재설정 | 문제 재정의) ───

export interface ReframeHiddenQuestion {
  question: string;
  reasoning: string;
  selected?: boolean;
  edited?: string;
  source_assumption?: string;
}

export interface HiddenAssumption {
  assumption: string;
  risk_if_false: string;
  verified?: boolean;
  evaluation?: 'likely_true' | 'uncertain' | 'doubtful';
  evaluation_reason?: string;
  axis?: 'customer_value' | 'feasibility' | 'business' | 'org_capacity';
}

/** @deprecated Kept for backward compatibility with old localStorage data */
export interface ReframeSubtask {
  task: string;
  actor: 'ai' | 'human' | 'both';
  actor_reasoning: string;
}

export interface ReframeAnalysis {
  surface_task: string;
  reframed_question: string;
  why_reframing_matters: string;
  reasoning_narrative: string;
  hidden_assumptions: HiddenAssumption[];
  hidden_questions: ReframeHiddenQuestion[];
  ai_limitations: string[];
  // Legacy fields — kept for backward compat with old data
  hypothesis?: string;
  alternative_framings?: string[];
  decomposition?: ReframeSubtask[];
}

export interface InterviewSignals {
  // v1 fields (legacy, backward compat)
  origin?: 'top-down' | 'external' | 'self' | 'fire';
  uncertainty?: 'why' | 'what' | 'how' | 'none';
  success?: 'measurable' | 'risk' | 'opportunity' | 'unclear';
  // v2 fields (Cynefin/Thompson-Tuden based)
  version?: 1 | 2;
  nature?: 'known_path' | 'needs_analysis' | 'no_answer' | 'on_fire';
  goal?: 'clear_goal' | 'direction_only' | 'competing' | 'unclear';
  stakes?: 'irreversible' | 'important' | 'experiment' | 'unknown_stakes';
  // v2 adaptive fields (conditional on core answers)
  trigger?: 'external_pressure' | 'internal_request' | 'opportunity' | 'recurring';
  history?: 'failed' | 'partial' | 'first' | 'unknown';
  stakeholder?: 'executive' | 'team' | 'client' | 'self';
}

export interface ReframeItem {
  id: string;
  project_id?: string;
  loop_id?: string;
  iteration_number?: number;
  input_text: string;
  analysis: ReframeAnalysis | null;
  selected_question: string;
  final_decomposition?: ReframeSubtask[];
  status: 'input' | 'analyzing' | 'review' | 'done';
  user_edited_question?: boolean;
  reanalysis_count?: number;
  interview_signals?: InterviewSignals;
  deleted_at?: string | null;
  created_at: string;
  updated_at: string;
}

// ─── Synthesize (조율 — excluded from main flow) ───

export interface SynthesizeSource {
  name: string;
  content: string;
  extracted_claim?: string;
}

export interface SynthesizeConflict {
  id: string;
  topic: string;
  side_a: { source: string; position: string };
  side_b: { source: string; position: string };
  analysis: string;
  user_judgment?: string;
  user_reasoning?: string;
}

export interface SynthesizeAnalysis {
  sources_summary: { name: string; core_claim: string }[];
  agreements: string[];
  conflicts: SynthesizeConflict[];
  questions_for_user: string[];
}

export interface SynthesizeItem {
  id: string;
  project_id?: string;
  loop_id?: string;
  iteration_number?: number;
  raw_input: string;
  sources: SynthesizeSource[];
  analysis: SynthesizeAnalysis | null;
  final_synthesis: string;
  status: 'input' | 'analyzing' | 'review' | 'done';
  created_at: string;
  updated_at: string;
}

// ─── Recast (선원 배치 | 실행 설계) ───

/** Actor relationship: who initiates → who completes */
export type ActorRelationship = 'human' | 'ai' | 'human→ai' | 'ai→human' | 'both';

export interface RecastStep {
  task: string;
  actor: ActorRelationship;
  actor_reasoning: string;
  expected_output: string;
  judgment?: string;
  checkpoint: boolean;
  checkpoint_reason: string;
  estimated_time?: string;
  parallel_with?: number;
  user_ai_guide?: string;
  user_decision?: string;
  ai_direction_options?: string[];
  ai_scope?: string;
  human_scope?: string;
}

export interface KeyAssumption {
  assumption: string;
  importance: 'high' | 'medium' | 'low';
  certainty: 'high' | 'medium' | 'low';
  if_wrong: string;
}

export interface ReviewFinding {
  type: 'gap' | 'suggestion' | 'risk' | 'opportunity';
  severity: 'high' | 'medium' | 'low';
  text: string;
  affected_steps?: number[];
}

export interface WorkflowReview {
  lens: string;
  lens_label: string;
  findings: ReviewFinding[];
  reviewed_at: string;
}

export interface RecastAnalysis {
  governing_idea: string;
  storyline: {
    situation: string;
    complication: string;
    resolution: string;
  };
  goal_summary: string;
  steps: RecastStep[];
  key_assumptions: KeyAssumption[];
  critical_path: number[];
  total_estimated_time: string;
  ai_ratio: number;
  human_ratio: number;
  design_rationale?: string;
  suggested_reviewers?: SuggestedReviewer[];
  reviews?: WorkflowReview[];
  previous_reviews?: WorkflowReview[];
  ai_limitation_warnings?: string[];
}

export interface SuggestedReviewer {
  name: string;
  role: string;
  influence: 'high' | 'medium' | 'low';
  decision_style: 'analytical' | 'intuitive' | 'consensus' | 'directive';
  risk_tolerance: 'low' | 'medium' | 'high';
  priorities: string;
  communication_style: string;
  known_concerns: string;
  success_metric: string;
  why_relevant: string;
}

export interface RecastItem {
  id: string;
  project_id?: string;
  loop_id?: string;
  iteration_number?: number;
  input_text: string;
  analysis: RecastAnalysis | null;
  steps: RecastStep[];
  status: 'input' | 'analyzing' | 'review' | 'done';
  deleted_at?: string | null;
  created_at: string;
  updated_at: string;
}

// ─── Persona ───

export interface FeedbackLog {
  id: string;
  date: string;
  context: string;
  feedback: string;
  created_at: string;
}

export interface PersonaContact {
  email?: string;
  slack_id?: string;
}

export interface Persona {
  id: string;
  name: string;
  role: string;
  organization: string;
  priorities: string;
  communication_style: string;
  known_concerns: string;
  relationship_notes: string;
  influence: 'high' | 'medium' | 'low';
  decision_style?: 'analytical' | 'intuitive' | 'consensus' | 'directive';
  risk_tolerance?: 'low' | 'medium' | 'high';
  success_metric?: string;
  extracted_traits: string[];
  /** 사용자가 자연어로 서술한 원본 설명. 프롬프트에 그대로 주입하여 시뮬레이션 정확도 높임. */
  user_description?: string;
  /** 실제 연락처 — human agent로 질문 발송 시 사용 */
  contact?: PersonaContact;
  feedback_logs: FeedbackLog[];
  is_example?: boolean;
  deleted_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface ClassifiedRisk {
  text: string;
  category: 'critical' | 'manageable' | 'unspoken';
}

export interface RehearsalResult {
  persona_id: string;
  overall_reaction: string;
  failure_scenario: string;
  untested_assumptions: string[];
  classified_risks: ClassifiedRisk[];
  first_questions: string[];
  praise: string[];
  concerns: string[];
  wants_more: string[];
  approval_conditions: string[];
  /** Phase 1: step-level translation of approval conditions */
  translated_approvals?: TranslatedApproval[];
}

export interface DiscussionMessage {
  persona_id: string;
  message: string;
  reacting_to?: string;
  type: 'agreement' | 'disagreement' | 'elaboration' | 'question';
}

export interface StructuredSynthesis {
  common_agreements: string[];
  key_conflicts: Array<{
    topic: string;
    positions: Array<{ persona_id: string; stance: string }>;
  }>;
  priority_actions: Array<{
    action: string;
    requested_by: string;
    priority: 'high' | 'medium';
  }>;
}

export interface FeedbackRecord {
  id: string;
  project_id?: string;
  loop_id?: string;
  iteration_number?: number;
  document_title: string;
  document_text: string;
  persona_ids: string[];
  feedback_perspective: string;
  feedback_intensity: string;
  results: RehearsalResult[];
  synthesis: string;
  structured_synthesis?: StructuredSynthesis;
  discussion?: DiscussionMessage[];
  discussion_takeaway?: string;
  created_at: string;
}

// ─── Project ───

export interface ProjectRef {
  tool: 'reframe' | 'synthesize' | 'recast' | 'rehearse';
  itemId: string;
  label: string;
  linkedAt: string;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  refs: ProjectRef[];
  meta_reflection?: MetaReflection;
  /** Validation Chain: 완료 시 확신도 (1-5). outcome과 비교하여 보정 곡선 생성. */
  confidence_at_completion?: number;
  team_id?: string;
  deleted_at?: string | null;
  created_at: string;
  updated_at: string;
}

// ─── Logbook (Coda): 항해 후 성찰 ───

export interface MetaReflection {
  understanding_change?: string;
  surprising_discovery?: string;
  next_time_differently?: string;
  created_at: string;
}

// ─── Context Chain (Phase 0: 타입드 맥락 파이프라인) ───

export interface ReframeContext {
  surface_task: string;
  reframed_question: string;
  why_reframing_matters: string;
  selected_direction: string;
  unverified_assumptions: HiddenAssumption[];
  verified_assumptions: HiddenAssumption[];
  ai_limitations: string[];
  interview_signals?: InterviewSignals;
}

export interface RecastContext {
  governing_idea: string;
  storyline?: {
    situation: string;
    complication: string;
    resolution: string;
  };
  steps: RecastStep[];
  key_assumptions: KeyAssumption[];
  critical_path: number[];
  design_rationale?: string;
}

export interface RehearsalContext {
  classified_risks: ClassifiedRisk[];
  untested_assumptions: string[];
  approval_conditions: Record<string, string[]>;
  failure_scenarios: string[];
}

export type PhaseContext = ReframeContext | RecastContext | RehearsalContext;

// ─── Handoff (transient, not persisted) ───

export interface Handoff {
  from: 'reframe' | 'synthesize' | 'recast' | 'rehearse' | 'refine' | 'workspace';
  fromItemId?: string;
  content?: string;
  projectId?: string;
  contextData?: PhaseContext;
  autoPersonaIds?: string[];
  data?: Record<string, unknown>;
}

// ─── Judgment Record ───

export interface JudgmentRecord {
  id: string;
  type: 'hidden_question_selection' | 'conflict_resolution' | 'actor_override' | 'feedback_accuracy';
  context: string;
  decision: string;
  reasoning?: string;
  original_ai_suggestion: string;
  user_changed: boolean;
  project_id?: string;
  tool: string;
  created_at: string;
}

// ─── Persona Accuracy ───

export interface PersonaAccuracyRating {
  id: string;
  feedback_record_id: string;
  persona_id: string;
  accuracy_score: number;
  accuracy_notes?: string;
  which_aspects_accurate: string[];
  which_aspects_inaccurate: string[];
  created_at: string;
}

// ─── Quality Signals (Navigator's Journal) ───

export interface QualitySignal {
  id: string;
  project_id?: string;
  tool: 'reframe' | 'recast' | 'rehearse' | 'refine';
  signal_type: string;
  signal_data: Record<string, unknown>;
  created_at: string;
}

export interface LearningHealth {
  signal_count: number;
  eval_coverage: number;
  override_trend: 'improving' | 'stable' | 'not_enough_data';
  convergence_trend: 'improving' | 'stable' | 'not_enough_data';
  learning_tier: 1 | 2 | 3;
  recommendations: string[];
}

export interface RetrospectiveQuestion {
  id: string;
  category: 'process' | 'judgment' | 'learning';
  question: string;
  data_basis: string;
}

// ─── Team Collaboration ───

export interface Team {
  id: string;
  name: string;
  slug: string | null;
  owner_id: string;
  created_at: string;
  updated_at: string;
}

export interface TeamMember {
  id: string;
  team_id: string;
  user_id: string;
  role: 'owner' | 'admin' | 'member';
  created_at: string;
  // Joined from auth (client-side only)
  email?: string;
  display_name?: string;
}

export interface TeamInvite {
  id: string;
  team_id: string;
  email: string;
  role: 'admin' | 'member';
  invited_by: string;
  status: 'pending' | 'accepted' | 'declined';
  created_at: string;
}

export interface TeamReviewInput {
  id: string;
  project_id: string;
  user_id: string;
  phase: 'reframe' | 'recast' | 'rehearse';
  target_type: 'assumption' | 'step' | 'risk' | 'direction' | 'general';
  target_id: string | null;
  input_type: 'rating' | 'concern' | 'endorsement' | 'alternative';
  rating: number | null;
  comment: string | null;
  visible: boolean;
  created_at: string;
  // Client-side only
  user_name?: string;
}

// ─── Outcome Tracking (Phase 1) ───

export interface MaterializedRisk {
  risk_text: string;
  persona_id: string;
  category: 'critical' | 'manageable' | 'unspoken';
  actually_happened: boolean;
  impact_description?: string;
}

export interface ApprovalOutcome {
  condition: string;
  persona_id: string;
  met_in_reality: boolean;
  notes?: string;
}

export interface OutcomeRecord {
  id: string;
  project_id: string;
  hypothesis_result: 'confirmed' | 'partially_confirmed' | 'refuted' | 'not_testable';
  hypothesis_notes: string;
  materialized_risks: MaterializedRisk[];
  approval_outcomes: ApprovalOutcome[];
  overall_success: 'exceeded' | 'met' | 'partial' | 'failed';
  key_learnings: string;
  what_would_change: string;
  created_at: string;
}

// ─── Retrospective Answers (Phase 2) ───

export interface RetrospectiveAnswer {
  id: string;
  project_id: string;
  question_id: string;
  question_text: string;
  category: 'process' | 'judgment' | 'learning';
  answer: string;
  data_basis: string;
  created_at: string;
}

// ─── Decision Quality Score (Phase 3) ───

export interface DecisionQualityScore {
  id: string;
  project_id: string;
  appropriate_frame: number;
  creative_alternatives: number;
  relevant_information: number;
  clear_values: number;
  sound_reasoning: number;
  commitment_to_action: number;
  initial_framing_challenged: boolean;
  blind_spots_surfaced: number;
  user_changed_mind: boolean;
  overall_dq: number;
  created_at: string;
}

// ─── Settings ───

export type LLMMode = 'proxy' | 'direct' | 'local';
export type LLMProvider = 'anthropic' | 'openai' | 'gemini';

export interface Settings {
  // User profile
  user_name?: string;
  user_role?: string;
  user_seniority?: 'junior' | 'mid' | 'senior' | 'lead';
  user_context?: string;
  // LLM
  anthropic_api_key: string;
  openai_api_key: string;
  gemini_api_key: string;
  llm_provider: LLMProvider;
  openai_model: string;
  gemini_model: string;
  llm_mode: LLMMode;
  local_endpoint: string;
  language: 'ko' | 'en';
  audio_enabled: boolean;
  audio_volume: number;
}

// ─── Judgment Vitality Engine ───
// "서로를 지탱함을 통해서 얻은 안정감과 체계화 때문에 이들은 경직되어 간다"
// Monitors whether the judgment process is alive (producing genuine novelty) or dead (performing compliance).

/** Tracks where an insight originated and how far it traveled */
export interface ProvenanceTag {
  phase: 'reframe' | 'recast' | 'rehearse' | 'refine';
  source_id: string;
  source_field: string;
  created_at: string;
}

/** Approval condition translated to specific plan elements */
export interface TranslatedApproval {
  persona_id: string;
  persona_name: string;
  influence: 'high' | 'medium' | 'low';
  condition: string;
  translated_to_plan: string | null;
  affected_steps: number[];
  met: boolean;
  met_at_iteration?: number;
}

/** Structural snapshot of a stage's output — used to measure γ (genuine novelty) */
export interface StageFingerprint {
  phase: 'reframe' | 'recast' | 'rehearse' | 'refine';
  item_id: string;
  timestamp: string;
  fingerprint: {
    // Reframe
    assumption_count?: number;
    assumption_axes?: string[];
    reframed_vs_surface_different?: boolean;
    // Recast
    step_count?: number;
    step_actors?: ActorRelationship[];
    checkpoint_count?: number;
    critical_path_length?: number;
    // Rehearsal
    risk_count?: number;
    critical_risk_count?: number;
    unspoken_risk_count?: number;
    approval_condition_count?: number;
    unique_concern_ratio?: number;
    // Refine
    iteration_count?: number;
    issues_resolved?: number;
    conditions_met_ratio?: number;
  };
}

export type RigidityCategory = 'user_ai' | 'user_persona' | 'user_system' | 'system_self';

export interface RigiditySignal {
  id: string;
  category: RigidityCategory;
  signal_type: string;
  severity: number;
  evidence: string;
  recommendation?: string;
}

/** Vitality = γ × (1 - rigidity). Alive or dead? */
export interface VitalityAssessment {
  id: string;
  project_id?: string;
  gamma: number;
  rigidity_score: number;
  vitality_score: number;
  signals: RigiditySignal[];
  fingerprints: StageFingerprint[];
  tier: 'alive' | 'coasting' | 'performing' | 'dead';
  created_at: string;
}

// ─── Progressive Flow (단일 프로그레시브 플로우) ───

export type ProgressivePhase =
  | 'input'           // 고민 입력 대기
  | 'analyzing'       // LLM 분석 중
  | 'conversing'      // Q&A 루프 (질문→답변→업데이트)
  | 'lead_synthesizing' // 리드 에이전트가 워커 결과 통합 중
  | 'mixing'          // 최종 초안 조합 중
  | 'dm_feedback'     // 판단자 피드백 생성/표시
  | 'refining'        // 이슈 반영 선택
  | 'complete'        // 최종 산출물 완성
  | 'iterating';      // Post-complete: 항해장에게 수정 요청 진행 중

export interface FlowQuestion {
  id: string;
  text: string;
  subtext?: string;
  options?: string[];           // 선택형일 때
  type: 'select' | 'short';    // 선택 or 짧은 입력
  engine_phase: 'reframe' | 'recast';  // 어떤 엔진을 위한 질문인지
  /**
   * Typed question metadata (Phase 1 — Q 타입 시스템).
   * Present when the engine generated this via a typed prompt
   * (strategic_fork / weakness_check / frame_clarify).
   * See `src/lib/question-types.ts`. JSON-safe; persisted.
   */
  typed?: import('@/lib/question-types').TypedQuestionMeta;
}

export interface FlowAnswer {
  question_id: string;
  value: string;
}

export interface AnalysisSnapshot {
  version: number;
  real_question: string;
  hidden_assumptions: string[];
  skeleton: string[];
  execution_plan?: {
    steps: {
      task: string;
      who?: 'ai' | 'human' | 'both';                 // legacy — agent_type 우선
      agent_type?: AgentTaskType;                      // 'ai' | 'self' | 'human'
      output: string;
      ai_scope?: string;
      self_scope?: string;
      decision?: string;
      agent_hint?: string;
      question_to_human?: string;
      human_contact_hint?: string;
    }[];
    key_assumptions: string[];
  };
  insight?: string;              // 이번 업데이트의 핵심 인사이트

  // Framing validation (Weakness A fix)
  framing_confidence?: number;      // 0-100: LLM의 자기 평가
  framing_locked?: boolean;         // Round 1 질문을 사용자가 확인했는지
  framing_override_reason?: string; // 사용자가 거부한 이유

  // Convergence tracking (Weakness C fix)
  convergence_score?: number;       // 0-100: 질문 안정성 + 가정 감소 종합
  convergence_trend?: 'improving' | 'stable' | 'declining' | 'unclear';

  // ── Typed-question effects captured into analysis (Phase 1) ──
  /** 상사가 사인할 수 있는 1줄 결정문 — strategic_fork 답에서 흘러옴 */
  decision_line?: string;
  /** 가장 위험한 가정 — weakness_check 답에서 흘러옴 */
  weakest_assumption?: { assumption: string; explanation: string };
  /** 다음 3일 우선순위 작업 — weakness_check 답에서 흘러옴 */
  next_three_days?: string[];
}

// ─── Agent Workers ───

export interface WorkerPersona {
  id: string;
  name: string;           // Display name (Korean by default)
  nameEn?: string;        // English override — used when locale='en'
  role: string;           // Role label (Korean by default)
  roleEn?: string;        // English override
  emoji: string;          // Avatar emoji
  expertise: string;      // Expertise summary (injected into LLM prompt)
  expertiseEn?: string;   // English override
  tone: string;           // Tone characterization (injected into LLM prompt)
  toneEn?: string;        // English override
  color: string;          // UI accent hex
}

export type WorkerStatus = 'pending' | 'running' | 'done' | 'error' | 'waiting_input' | 'ai_preparing' | 'sent' | 'waiting_response' | 'validation_failed';

export type AgentTaskType = 'ai' | 'self' | 'human';

export interface HumanContact {
  name: string;
  channel: 'email' | 'slack';
  address: string;
}

export type AgentLevel = 'junior' | 'senior' | 'guru';

export interface WorkerTask {
  id: string;
  step_index: number;
  task: string;
  /**
   * Identifies which "task group" this worker belongs to. Workers that share
   * the same task_group_id are working on the same task with different
   * personas (Manual team-assignment feature). When undefined (legacy
   * sessions), each worker is treated as its own group via worker.id.
   */
  task_group_id?: string;
  /**
   * True when this worker was added by the user via the persona-pool modal
   * (vs. being part of the auto-assigned execution plan). Drives the "직접
   * 추가" badge in TeamDeployBanner so users can see their own intent
   * reflected in the team. Undefined on legacy sessions = treated as auto.
   */
  added_manually?: boolean;
  /**
   * The task description as it stood when initWorkers (or the manual
   * addition) created this worker. Compared against `task` to detect that
   * the user has edited the task heading — drives the "✏ 수정됨" cue.
   * Undefined on legacy sessions = treated as never edited.
   */
  original_task?: string;
  /** @deprecated Use agent_type instead. Kept for backward compatibility with persisted sessions. */
  who: 'ai' | 'human' | 'both';
  expected_output: string;
  status: WorkerStatus;
  persona: WorkerPersona | null;
  level: AgentLevel;
  agent_id?: string;             // Agent 참조. 있으면 persona 대신 agent 사용
  stream_text: string;           // 스트리밍 중 텍스트 (비영속, 메모리만)
  result: string | null;
  human_input: string | null;
  error: string | null;
  approved: boolean | null;      // null=미확인, true=반영, false=제외
  completion_note: string | null; // 페르소나 음성의 완료 멘트
  started_at: string | null;
  completed_at: string | null;

  // ─── Agent Type + Scope (Unified Agent System v2) ───
  agent_type?: AgentTaskType;       // 'ai' | 'self' | 'human' — undefined면 who에서 역산
  ai_scope?: string;                // AI가 하는 것
  self_scope?: string;              // 사용자가 판단하는 것
  decision?: string;                // "질문: A vs B vs C" — UI가 선택지로 변환
  ai_preliminary?: string | null;   // self/human task에서 AI 보조 분석 결과
  contact?: HumanContact;           // human agent 연락처
  question_to_human?: string;       // 외부 사람에게 보낼 질문
  sent_at?: string;                 // human에게 발송된 시각
  response_at?: string;             // human 응답 수신 시각
  snapshot_version?: number;        // 어떤 snapshot에서 생성됐는지

  // Orchestrator-assigned (Phase 0-3)
  framework?: string;               // 배정된 프레임워크 이름 (null이면 전체 스킬셋)
  stage_id?: string;                // 소속 스테이지 ID
  task_type?: string;               // task-classifier의 TaskType (context 전략 결정)
  depends_on?: string[];            // 의존하는 WorkerTask.id[] (선택적 peerResults 주입)

  // Quality gate (Weakness E fix)
  validation_score?: number;        // 0-100: 결과물 품질
  validation_feedback?: string;     // 검증 실패 시 피드백
  validation_passed?: boolean;      // true if score >= 70
  retry_count?: number;             // 재시도 횟수

  // Agent autonomous planning (Feature 1)
  plan?: AgentPlan;
  plan_step_results?: Array<{ step_number: number; result: string }>;

  // Agent delegation (Feature 2)
  delegation_depth?: number;        // 0=원본, 1=위임받은 task (재위임 불가)
  delegated_to?: { agent_id: string; agent_name: string };
  delegated_from?: { agent_id: string; agent_name: string };
}

/** Resolve agent_type from legacy who field for backward compat */
export function resolveAgentType(w: Pick<WorkerTask, 'agent_type' | 'who'>): AgentTaskType {
  if (w.agent_type) return w.agent_type;
  if (w.who === 'both') return 'ai';   // old 'both' → ai with self_scope
  if (w.who === 'human') return 'self'; // old 'human' was "사용자 본인"
  return 'ai';
}

// ─── Agent Autonomous Planning ───

export interface AgentPlanStep {
  step_number: number;
  task: string;
  expected_output: string;
  is_delegation?: boolean;
  delegate_capability?: string;
}

export interface AgentPlan {
  steps: AgentPlanStep[];
  reasoning: string;
  estimated_quality_gain: string;
}

// Pipeline stages (Phase 3)
export interface PipelineStage {
  id: string;
  label: string;                     // Korean label ("분석", "검증")
  labelEn?: string;                  // English label
  workerIds: string[];               // WorkerTask.id[] belonging to this stage
  status: 'pending' | 'running' | 'done' | 'failed';
  dependsOnStageId?: string;         // Prior stage id (feeds results forward)
}

// Workers 배치 단계
export type WorkerDeployPhase = 'none' | 'ready' | 'deployed';

// ─── Voyage Chart — decision checkpoints ───

/**
 * Stage of the voyage at which a checkpoint was captured. Each transition
 * between stages auto-records a checkpoint so users can step back later.
 *
 *   origin     — session start (initial analysis just landed)
 *   briefing   — after each Q&A round; the team's understanding sharpens
 *   crew_set   — team has been assembled, awaiting deploy
 *   crew_done  — every worker reached a terminal state
 *   mix        — the draft is assembled
 *   review     — DM/reviewer feedback received
 *   anchor     — final deliverable produced (voyage end)
 */
export type VoyageStage =
  | 'origin'
  | 'briefing'
  | 'crew_set'
  | 'crew_done'
  | 'mix'
  | 'review'
  | 'anchor';

/**
 * Full snapshot of session state at the moment a checkpoint was recorded.
 * Restoring a checkpoint replaces the live session fields with these
 * values; the snapshot is therefore the "rewind tape" for the voyage.
 *
 * Stored as a complete copy (not a delta) per design decision — keeps
 * the implementation simple and avoids cascading corruption when the
 * data model evolves. Sessions are small enough that the storage cost
 * is acceptable for v1.
 */
export interface VoyageCheckpointState {
  phase: ProgressivePhase;
  round: number;
  questions: FlowQuestion[];
  answers: FlowAnswer[];
  snapshots: AnalysisSnapshot[];
  workers: WorkerTask[];
  worker_deploy_phase: WorkerDeployPhase;
  mix: MixResult | null;
  dm_feedback: DMFeedbackResult | null;
  final_deliverable: string | null;
  final_mix: MixResult | null;
  user_notes: string | null;
  decision_maker: string | null;
  lead_synthesis: LeadSynthesisResult | null;
}

export interface VoyageCheckpoint {
  id: string;
  /** Tree linkage: parent waypoint on the same branch. null only for the
   *  origin checkpoint. */
  parent_id: string | null;
  stage: VoyageStage;
  /** Human-readable label for the chart UI. Auto-generated from stage +
   *  round, but callers may override (e.g. "다른 답으로 분기"). */
  label: string;
  created_at: string;
  state_snapshot: VoyageCheckpointState;
}

// ─── Voyage branches (first-class course-lines over the checkpoint tree) ───

/** Lifecycle of a branch (course-line) within a voyage. */
export type BranchStatus =
  | 'sailing'    // open — active, or paused-but-resumable
  | 'anchored'   // chosen as the final course
  | 'abandoned'; // a road not taken / superseded — preserved, never deleted

/**
 * A named, first-class course-line layered over the checkpoint tree.
 *
 * A branch is *metadata only*: its actual lineage (the root→head path of
 * checkpoints) is derived on demand via `getActivePath(checkpoints,
 * head_checkpoint_id)` from the shape-agnostic helpers in `lib/version-tree.ts`.
 * We deliberately do NOT stamp a `branch_id` onto checkpoints — checkpoints
 * before a fork are shared by multiple branches' lineages, so a single owner id
 * would be a lie and a future consistency bug. Lineage is computed, not stored.
 */
export interface VoyageBranch {
  id: string;
  name: string;                              // "본 항로" | "분기: 챗봇 직접 제작" ...
  head_checkpoint_id: string;                // leaf of this branch's lineage
  forked_from_checkpoint_id: string | null;  // null only for the main branch
  status: BranchStatus;
  color: string;                             // course-line color on the chart
  created_at: string;
}

// ─── Ship's log (항해일지) — narrated waypoints over the voyage ───

/**
 * The six waypoint types the Chronicler may record. A closed set by design: it
 * bounds the narrator (it classifies into one of these, never freeform) and
 * keeps the log legible. Every type is a *turn* in the thinking, never a raw
 * step — that is what makes the log a higher layer than the transcript.
 */
export type WaypointType =
  | 'departure'     // ⚓ 출항 — the original ask, as given
  | 'course_change' // ↻ 침로 변경 — the real question / framing turned
  | 'reef'          // ⚠ 암초 — a hidden assumption surfaced (confirmed or killed)
  | 'sighting'      // 👁 관측 — a worker/finding surfaced material intelligence
  | 'headwind'      // 🜨 역풍 — a stakeholder concern / risk forced an adjustment
  | 'anchorage';    // ⚑ 정박 — convergence / final commitment

/**
 * An alternative weighed but not taken at a course-change — the "road not
 * taken". Captured at the fork so the chart can offer it as a ghost branch the
 * user can later sail. `taken=true` marks the single path actually pursued.
 */
export interface WaypointAlternative {
  label: string;          // short name of the path
  why_abandoned: string;  // the captured reason it was set aside
  taken: boolean;         // the branch actually sailed
}

/**
 * One entry in the ship's log. Anchored to the checkpoint whose transition it
 * narrates. Branch membership is *derived* (a waypoint belongs to a branch when
 * its checkpoint is on that branch's path), never stored — same rationale as
 * VoyageBranch not stamping checkpoints.
 */
export interface Waypoint {
  id: string;
  checkpoint_id: string;                 // the checkpoint this waypoint narrates
  type: WaypointType;
  headline: string;                      // high-altitude one-liner (always present)
  significance?: string;                 // "why it mattered" — Chronicler narration
  trigger?: string;                      // the handed cause — never guessed/fabricated
  alternatives?: WaypointAlternative[];  // course_change only: roads not taken
  created_at: string;
}

// ── Unified Review types (shared by web app + plugin) ──

export interface ReviewConcern {
  text: string;
  severity: 'critical' | 'important' | 'minor';
  fix_suggestion: string;
  applied: boolean;
}

export interface ReviewFeedback {
  reviewer: {
    name: string;
    role: string;
    influence: 'high' | 'medium' | 'low';
    persona_id?: string;
  };
  first_reaction: string;
  good_parts: string[];
  concerns: ReviewConcern[];
  approval_condition: string;
  // Deep mode (Level 2+)
  would_ask?: string[];
  failure_scenario?: string;
  untested_assumptions?: string[];
}

// ── Legacy aliases (backward compat) ──

export type DMConcern = ReviewConcern;

export interface DMFeedbackResult {
  persona_name: string;
  persona_role: string;
  first_reaction: string;
  good_parts: string[];
  concerns: DMConcern[];
  would_ask: string[];
  approval_condition: string;
}

export interface MixResult {
  title: string;
  executive_summary: string;
  sections: {
    heading: string;
    content: string;
    /**
     * Names of worker personas whose research backed this section — as returned
     * by the LLM synthesis. Used to map back to `contributor_worker_ids` via a
     * name lookup at runMix time.
     */
    contributor_names?: string[];
    /**
     * Resolved worker IDs that contributed to this section. Post-processed by
     * runMix from contributor_names + the worker list. Used by the UI to draw
     * attribution avatars + the hover-traceability highlight.
     *
     * Always a union of sentence-level contributors when `sentences` exists.
     */
    contributor_worker_ids?: string[];
    /**
     * Fine-grained sentence-level attribution. When present, the UI renders
     * each sentence as an individually hoverable span with its own contributor
     * badges, falling back to section-level rendering otherwise.
     */
    sentences?: Array<{
      text: string;
      contributor_names?: string[];
      contributor_worker_ids?: string[];
    }>;
  }[];
  key_assumptions: string[];
  next_steps: string[];
}

export interface LeadSynthesisResult {
  lead_agent_id: string;
  lead_agent_name: string;
  integrated_analysis: string;
  key_findings: string[];
  unresolved_tensions: string[];
  recommendation_direction: string;
}

export interface ProgressiveSession {
  id: string;
  project_id: string;
  problem_text: string;
  decision_maker: string | null;

  // Flow state
  phase: ProgressivePhase;
  round: number;                // 현재 Q&A 라운드 (0-based)
  max_rounds: number;           // 최대 라운드 (기본 3)

  // Accumulated data
  questions: FlowQuestion[];
  answers: FlowAnswer[];
  snapshots: AnalysisSnapshot[];  // version 0 = 초기, 1+ = 업데이트
  workers: WorkerTask[];          // 병렬 에이전트 작업자
  worker_deploy_phase: WorkerDeployPhase;
  stages?: PipelineStage[];       // 스테이지 파이프라인 (Phase 3)
  lead_agent?: { agent_id: string; agent_name: string; domain: string } | null;
  lead_synthesis?: LeadSynthesisResult | null;
  user_notes?: string | null;           // 사용자가 mix 전에 추가한 의견
  debate_result?: { challenge: string; targetAgent: string; weakestClaim: string; alternativeView: string; severity: string } | null;
  mix: MixResult | null;
  dm_feedback: DMFeedbackResult | null;

  // Final
  final_deliverable: string | null;
  /**
   * Structured form of the final deliverable — kept in parallel with
   * `final_deliverable` (markdown string). Used by the renderer to preserve
   * sentence-level traceability through DM-feedback application. Null when the
   * final pass wasn't structured (e.g., legacy sessions).
   */
  final_mix?: MixResult | null;

  // ─── Post-complete iteration tree ───
  /**
   * Versioned drafts of the final deliverable. drafts[0] is auto-created when
   * the session first reaches `complete`. Subsequent drafts are appended when
   * the user either re-runs DM review or asks 항해장(Navigator) to revise.
   * Forms a tree via `parent_draft_id`; branching/promotion supported.
   * Optional + backward-compat: legacy sessions without drafts are migrated
   * on load via `migrateSessionDrafts`.
   */
  drafts?: Draft[];
  /** Currently-focused draft. null/undefined = latest by created_at. */
  active_draft_id?: string | null;
  /** Draft marked as the released v1.0+. Used by ShareBar/export preference. */
  released_draft_id?: string | null;

  // ─── Voyage chart (pre-anchor decision checkpoints) ───
  /**
   * Tree of decision checkpoints captured at every stage transition. Lets
   * users walk back to any waypoint and pick a different course; the old
   * route is preserved as a sibling branch. Distinct from `drafts` (which
   * tracks the post-anchor final-doc iteration tree) — checkpoints span
   * the entire voyage from origin to anchor.
   * Optional + backward-compat: legacy sessions default to empty array.
   */
  checkpoints?: VoyageCheckpoint[];
  /** Latest waypoint on the active branch. New checkpoints attach here as
   *  parent. When the user forks, this pointer moves to the chosen
   *  ancestor — subsequent recordCheckpoint calls naturally produce a
   *  new branch off that point. */
  active_checkpoint_id?: string | null;

  // ─── Voyage branches + ship's log (built over the checkpoint tree) ───
  /**
   * First-class named course-lines over the checkpoint tree. Optional +
   * backward-compat: synthesized on load for sessions that have checkpoints
   * but no branches (see `migrateBranches`), and created lazily at the origin
   * checkpoint for fresh sessions. The active branch's head is kept in sync
   * with `active_checkpoint_id` (single-active model).
   */
  branches?: VoyageBranch[];
  /** The branch whose working state currently occupies the live session
   *  fields. Exactly one branch is active at a time. */
  active_branch_id?: string | null;
  /**
   * Ship's log — narrated waypoints recorded by the Chronicler at salient
   * transitions. Keyed by `checkpoint_id`; the per-branch view is derived via
   * the active path. Optional + backward-compat (legacy = empty/undefined).
   */
  waypoints?: Waypoint[];

  // Boss/Reviewer 연결
  reviewer_agent_id?: string;   // Boss agent가 DM 리뷰어로 연결

  // Engine refs (기존 store에도 저장)
  reframe_item_id?: string;
  recast_item_id?: string;
  feedback_record_id?: string;

  // Pipeline bridge (Weakness D fix)
  exited_at_phase?: ProgressivePhase;
  exited_at_round?: number;
  re_entry_point?: ProgressivePhase;

  created_at: string;
  updated_at: string;
}

// ─── Draft (Post-finalize iteration node) ───

/**
 * A versioned snapshot of the final deliverable. Each Draft is a node in the
 * iteration tree: drafts[0] is the root (parent=null, produced by the normal
 * ProgressiveFlow pipeline), subsequent drafts are children produced by either
 * (a) the 항해장 revision loop with a user directive, or
 * (b) a re-run of the DM stakeholder review ("이해관계자 검증 다시 하기").
 *
 * The tree shape allows users to return to an older draft and branch from it.
 * Version labels follow `lib/version-numbering.ts` (v0.1, v0.1.1, v1.0, ...).
 */
export interface Draft {
  id: string;
  parent_draft_id: string | null;          // null = first draft off ProgressiveFlow
  version_label: string;                    // "v0.1" | "v0.1.1" | "v1.0" ...
  change_summary: string;                   // ≤ 40 chars — what changed in this version
  directive: string | null;                 // user revision request (null for the initial draft)
  final_text: string;                       // rendered markdown
  final_mix?: MixResult | null;             // structured form for attribution (optional)
  /**
   * Which agent produced this draft:
   * - null          → initial draft from the ProgressiveFlow pipeline
   * - 'navigator' → directive-driven 항해장 revision
   * - 'dm_reroll'   → re-run of DM stakeholder review (legacy button)
   */
  reviewing_agent_id: string | null;
  created_at: string;
}

// ─── Convergence Metrics ───

export interface ConvergenceMetrics {
  score: number;                    // 0-100
  trend: 'improving' | 'stable' | 'declining' | 'unclear';
  is_converged: boolean;            // true if score >= 75
  estimated_rounds_left: number;    // 0 = ready
  guidance: string;                 // 사용자에게 보여줄 한 줄 안내
}
