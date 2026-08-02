// Type-only import: crisis-gate.ts is the single source of truth for the crisis
// taxonomy (its CRISIS_CATEGORIES const + CrisisSignal); referencing the type
// here is erased at compile time, so this adds no runtime dependency or cycle.
import type { CrisisSignal } from '@/lib/crisis-gate';
import type { CurrentBearing } from '@/lib/current-bearing';

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

export type StakeholderRealityCheckStatus = 'pending' | 'confirmed' | 'contradicted';

export interface StakeholderRealityCheck {
  id: string;
  statement_id: string;
  claim_id?: string;
  statement: string;
  question: string;
  status: StakeholderRealityCheckStatus;
  note?: string;
  created_at: string;
  checked_at?: string;
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
  /** Real-world follow-through for simulated reactions. Stored inside the
   * existing results JSON column so local-first and cloud sync stay aligned. */
  reality_checks?: StakeholderRealityCheck[];
}

export interface DiscussionMessage {
  persona_id: string;
  message: string;
  reacting_to?: string;
  type: 'agreement' | 'disagreement' | 'elaboration' | 'question';
}

/** Preserved read shape for Rehearse records written before E4/J2. Never rewrite in place. */
export interface LegacyStructuredSynthesis {
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

export interface SyntheticModelLineage {
  provider: string;
  model_family: string;
  model_id: string;
  prompt_version: string;
  source_input_cluster_ids: string[];
}

export interface SyntheticPerspectiveSet {
  artifact_kind: 'synthetic_perspective_set';
  schema_version: 2;
  set_id: string;
  source_case_id: string;
  generator_lineage: SyntheticModelLineage;
  prompt_version: string;
  /** Any number of agents/personas over the same source is one independence unit. */
  independence_units: 1;
  perspectives: Array<{
    perspective_id: string;
    seat: { owns: string; goals: string[]; authority: string };
    model_lineage: SyntheticModelLineage;
    concerns: string[];
    source_claim_refs: string[];
  }>;
  convergent_simulated_concerns: Array<{
    statement: string;
    perspective_ids: string[];
    source_refs: string[];
  }>;
  team_contradictions: Array<{
    topic: string;
    positions: Array<{ perspective_id: string; stance: string }>;
  }>;
  strongest_dissent: {
    kind: 'observed' | 'elicited_counter_lens' | 'none_found';
    statement: string;
    source_refs: string[];
    search_method: string;
  };
  unknowns_that_block_judgment: string[];
  reality_check_questions: string[];
}

export type StructuredSynthesis = LegacyStructuredSynthesis | SyntheticPerspectiveSet;

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
  /** 사후 정산: 결정의 실제 결과. confidence_at_completion과 비교해 판단 보정도 산출.
   *  기록되면 항해가 '입항' → '검증된 항해'로 전환된다. (see lib/voyage-state.ts) */
  outcome?: {
    verdict: 'right' | 'wrong' | 'mixed' | 'pending';
    note?: string;
    recorded_at: string;
  };
  /** The falsifiable closed loop (§0 KICK). Generated at voyage end; graded on
   *  return. Embedded here so it rides project sync and deletes cleanly. */
  decision_contract?: DecisionContract;
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
  /** 'voyage' = the progressive flow (the main product path). The 4-step tool
   *  values are legacy. 2026-06-13: the new flow recorded ZERO signals because
   *  this union (and every recordSignal call site) predated the progressive
   *  migration — the learning loop was wired only into the retired flow. */
  tool: 'voyage' | 'reframe' | 'recast' | 'rehearse' | 'refine';
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
  /** Current user's membership role, enriched by the team API. */
  my_role?: 'owner' | 'admin' | 'member';
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
  /** Team name is included for invitations addressed to the current user. */
  team_name?: string | null;
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

/** A project shared with a human team, enriched with its owner and latest review session. */
export interface TeamSharedProject extends Project {
  user_id: string;
  owner_email?: string | null;
  owner_name?: string | null;
  session?: ProgressiveSession | null;
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

// ─── Decision Contract — the falsifiable closed loop (§0 KICK) ───
//
// A voyage doesn't end in dead markdown — it ends in 3–6 SPECIFIC,
// falsifiable predictions the user made, each with a STABLE id so a grade
// later can join to the exact prediction (never free text). The user picks a
// check-in date; on that day the project resurfaces "예측 N개 채점 대기".
// Graded predicates are how Argus learns whether its judgment was right.
//
// Stored embedded on Project (rides existing project sync), reversibly: drop
// `Project.decision_contract` and the feature is gone with no orphaned rows.

/** Where a predicate was derived from. `user_lean` = the user's own pre-AI lean,
 *  sealed at project-OPEN before any generation (Phase 1 BIND, "tie the rope
 *  before you hear the Sirens"). Always authored:'user' — it is the user's own
 *  prediction, the anchor the later AI output is checked against, never overwritten. */
export type PredicateSource = 'risk' | 'actor' | 'governing_idea' | 'user_lean';

/** The user's later verdict on whether the prediction held.
 *  `unknown` = "결과를 아직 모름" — resolves the predicate (so the contract can
 *  complete and the nudge clears) but is NOT scored as a hit or miss. Without
 *  it, a decision whose outcome isn't yet knowable would trap the contract
 *  open forever. `pending` = not yet answered. */
/** `missed` (checkpoints v2 §7.2) = the JUDGMENT layer's "my read was wrong",
 *  distinct from the event layer's happened/avoided. The event enum had no home
 *  for "I expected X and X didn't go as I judged" (an event not happening and a
 *  judgment being wrong are different facts), so the 4-tap return screen's
 *  "빗나갔다" maps here. Legacy contracts never carry it; consumers treat it as a
 *  non-held outcome (grouped with a miss, never a held bet). */
export type PredicateVerdict = 'happened' | 'avoided' | 'partial' | 'unknown' | 'pending' | 'missed';

/** The user's OWN read of WHY a good outcome went the way it did — held bet or
 *  avoided risk. A held bet on luck is NOT a held bet on judgment (R17: the one
 *  settle failure was a reckless no-prep gamble that got lucky, logged as a clean
 *  "held", cementing winging-it as a validated win). This is the user's
 *  self-report, NOT Argus grading them (reality is still the only judge); it just
 *  keeps a lucky outcome from compounding into the record as a skill-win. Optional
 *  — absent when the user doesn't answer the light second tap. Single source of
 *  truth shared with the plugin settle event's `basis` (parity-guarded). */
export const PREDICATE_BASES = ['reasoned', 'luck', 'external', 'mixed'] as const;
export type PredicateBasis = typeof PREDICATE_BASES[number];

export interface Predicate {
  /** Deterministic, stable across re-generation (hash of source+text). The grade join key. */
  id: string;
  /** The falsifiable statement, e.g. "CFO가 가격 단계에서 비용에 반대한다". */
  text: string;
  source: PredicateSource;
  /** For risk-sourced predicates. */
  category?: ClassifiedRisk['category'];
  /** Carried from the premise this came from. 'standard' is never graded —
   *  reality does not settle a person's own weighting. Absent = 'premise'. */
  premise_kind?: PremiseKind;
  /** What the user said would show it, carried to the return so the check-in
   *  can ask about the thing itself instead of "실제로 어떻게 됐나요?". */
  observable?: string;
  /** The user's own call on whether being wrong here would have changed the
   *  choice. Only 'flips' premises are worth bringing back — the rest are
   *  background, and returning them is noise dressed as diligence. */
  decisive?: 'flips' | 'holds';
  /** The persona the prediction is about, when known (risk source) — drives specificity. */
  persona_id?: string;
  /** User's later grade. Absent/`pending` until they return to score it. */
  verdict?: PredicateVerdict;
  graded_at?: string;
  /** User's optional read of WHY a good outcome happened (held bet / avoided
   *  risk): reasoned vs luck/external. Separates judgment-wins from luck-wins in
   *  the track record. Cleared when the verdict returns to pending. */
  basis?: PredicateBasis;
  /** How sure the USER said they were, in their own words, at the moment they
   *  sealed. Not a probability and never Argus's estimate.
   *
   *  Without it a settled record says only "맞았다 / 틀렸다", which teaches
   *  almost nothing: being wrong about a coin-flip and being wrong about
   *  something you were sure of are different events, and only the second is
   *  worth noticing. Pairing what they SAID with what happened is the whole
   *  mechanism by which judgment improves (Tetlock: feedback on stated
   *  confidence, not on outcomes alone).
   *
   *  Recorded, paired, and shown back as their own two sentences. It is never
   *  scored, averaged into a tier, or used to route anything — that would make
   *  it a verdict about the person (CLAUDE.md rule 2). */
  stated_confidence?: 'even' | 'likely' | 'near_certain';
  /** Authorship of a governing-bet predicate sourced from the flinch step
   *  (`Falsification.real_bet_authored`). 'ai_surfaced' = the machine-surfaced
   *  belief stood in as the bet via the no-friction skip, NOT a prediction the
   *  user made. A held 'ai_surfaced' bet is not the user's judgment held — the
   *  track record separates it, same principle as luck-vs-judgment basis (R17).
   *  Absent (typed/adopted bet, or non-bet predicate) = the user's own. */
  authored?: 'user' | 'ai_surfaced';
  /** Field-level influence record. `authored` remains as the compact legacy
   *  compatibility bit; this object keeps three facts separate:
   *  who phrased the sentence, whether the user adopted it as their own call,
   *  and where/when Argus received it. A tap that merely keeps an AI draft does
   *  not rewrite `wording_source` to user. */
  attribution?: JudgmentAttribution;
}

export interface JudgmentAttribution {
  wording_source: 'user_direct' | 'user_reworded' | 'ai_surfaced' | 'imported' | 'legacy_unknown';
  authority: 'user_asserted' | 'user_adopted' | 'ai_suggested' | 'unconfirmed' | 'legacy_unknown';
  surface: 'web' | 'mcp' | 'plugin' | 'telegram' | 'document_import' | 'legacy_unknown';
  recorded_at: string;
  source_ref?: string;
}

export type CheckInInterval = '1d' | '3d' | '1w' | '2w' | '1m';

/** One superseded check-in, kept when the user says "아직" and extends the
 *  date (W1.2 amend principle: 변침도 기록이다 — never silently overwrite).
 *  Mirrors the watch ledger's amend event history entries. */
export interface ContractAmendment {
  check_in_at?: string;
  check_in_interval?: CheckInInterval;
  amended_at: string;
}

/** One-object artifact that spans seal → settle.
 *  Created at seal; patched at settle. The diff between human_judgment and
 *  what_happened is the learning — and the moat. */
export interface JudgmentReceipt {
  real_question: string;
  unverified_assumption: string;
  human_only: string;
  /** The user's pre-review baseline. It is deliberately not scored: settlement
   *  grades the final human_judgment, while this line makes any change in view
   *  legible instead of pretending the two capture moments were the same seal. */
  baseline_judgment?: string;
  human_judgment: string;
  /** Explicit provenance for the final line. Optional on legacy receipts. */
  judgment_attribution?: JudgmentAttribution;
  what_happened?: string;
  assumption_held?: boolean | null;
  settled_at?: string;
}

// ─── Judgment Checkpoints v2 (checkpoints-v2 §3.1) ───
// The user-facing "판단 체크포인트" is a SKIN over the existing DecisionContract,
// not a new object/table. Exactly two structural extensions, both jsonb-nested
// (no migration): a non-date ReturnHandle and a PrimaryCheckpoint pointer.

/** A non-date return handle — the upward-compatible superset of CheckInInterval.
 *  `auto_due` is true only for `date` (the rest are user/host-reported + a
 *  silence cap, so "never due" is structurally impossible; §9.2). */
export interface ReturnHandle {
  kind: 'date' | 'event' | 'metric' | 'reaction' | 'evidence' | 'manual';
  /** kind-specific: date=ISO, event="이사회 미팅 후", metric="전환율 확인 가능해지면"… */
  value: string;
  auto_due: boolean;
  /** Silence cap for a non-date handle (ISO): past this, a soft-nudge replaces
   *  the (impossible) auto-due so it can't sleep forever (§9.2). */
  silence_until?: string;
}

/** The decision's representative checkpoint — the return loop focuses here
 *  (MAX→1). Points at an existing Predicate.id; it is NOT a new scored object. */
export interface PrimaryCheckpoint {
  predicate_id: string;
  check_prompt: string;
  expected_signal?: string;
  negative_signal?: string;
  return_handle: ReturnHandle;
  /** premises-core premise_ids this checkpoint leans on (evidence type). */
  linked_premise_ids: string[];
  authorship: 'ai_suggested' | 'user_edited' | 'user_authored';
  /** Internal routing only — never shown to the user (§4). */
  type: 'outcome' | 'reaction' | 'evidence' | 'standard' | 'drift';
  /** The key that makes the 4-tap→verdict mapping deterministic (§7.2). Seal
   *  fills it; the user sees expected_signal, not this field. Legacy contracts
   *  without it are read as 'occur' (Defensive Data Access). */
  expectation: 'occur' | 'not_occur';
}

/** "아직 판단하기 어렵다" is a first-class path, not a dead end (§7.3). */
export interface AmbiguityRecord {
  reason: 'insufficient_data' | 'mixed_signals' | 'low_confidence_interpretation'
        | 'changed_context' | 'wrong_checkpoint' | 'not_enough_time';
  note?: string;
  /** unclear → a lighter next checkpoint, never a dead end. */
  next_handle?: ReturnHandle;
}

/** Post-record structural feedback — grounded in the record just written, never
 *  a personality verdict (§10). */
export interface GrowthNote {
  scope: 'single_check' | 'emerging_pattern' | 'established_pattern';
  widened_view: string;
  future_attention: string;
  evidence_count: number;
}

/** First settlement (checkpoints v2 §8) — the thought↔thought check that holds
 *  BEFORE reality arrives: the user's own read of whether their view has shifted
 *  since sealing. No AI verdict, no outcome required — it is the return on-ramp
 *  ("1차 정산이 2차 정산을 판다"). `shifted` is not worse than `same`; a moved
 *  view is itself judgment data. */
export interface LeanAfter {
  view: 'same' | 'shifted' | 'unknown';
  note?: string;
  recorded_at: string;
}

/** The speech act the sealed sentence performs. Legacy records without this
 * field are read as `prediction`; every new seal writes it explicitly. */
export type DecisionKind = 'prediction' | 'commitment' | 'declaration' | 'witness';

/** Why the sealing surface derived a kind. This is evidence of the capture
 * path, not a model confidence score. The user's correction always wins. */
export interface DecisionKindEvidence {
  source: 'wording_rule' | 'elicitation_answer' | 'user_override' | 'legacy_default';
  rule: string;
  question?: string;
  answer?: string;
  recorded_at: string;
}

/** A pre-seal chip correction. It remains append-only evidence of how the
 * machine read the sentence and how the user corrected that read. */
export interface DecisionKindCorrection {
  event: 'kind_corrected';
  from_kind: DecisionKind;
  to_kind: DecisionKind;
  corrected_at: string;
  evidence: DecisionKindEvidence;
}

/** A user-authored post-seal revision. The previous wording remains
 * addressable; the latest revision is only the current projection. */
export interface DecisionStatementRevision {
  event: 'statement_revised';
  from_statement: string;
  to_statement: string;
  reason?: string;
  recorded_at: string;
}

export type ReviewConditionStatus = 'answered' | 'skipped' | 'not_asked';

/** Genealogy of an adopted machine proposal. Adoption transfers authority for
 * a purpose; it never rewrites who originally phrased the proposal. */
export interface AdoptionLineage {
  source_proposal_ref: string;
  adopted_as: 'basis' | 'check' | 'wording';
}

export type ObservationSourceKind = 'user_report' | 'system_receipt' | 'ai_analysis';

export interface SettlementAxes {
  reality?: 'met' | 'not_met' | 'partial' | 'unknown' | 'not_observable';
  commitment?: 'enacted' | 'maintained' | 'revised' | 'withdrawn' | 'superseded';
  question: 'valid' | 'narrowed' | 'reframed' | 'moot' | 'indeterminate';
}

/** One return in the user's own words. The selected label is canonical;
 * `axes` is a deterministic projection and is never combined into a score. */
export interface ContractSettlement {
  option_id: string;
  response_text: string;
  recorded_at: string;
  axes: SettlementAxes;
  /** Receipt for the exact user act that authorized this return. Optional only
   * on legacy history; every current web/Telegram writer supplies it. The
   * stable reference also makes redelivered callbacks idempotent. */
  authorization?: {
    authorized_by: 'human';
    authorization_mode: 'explicit_confirmation' | 'direct_command';
    surface: 'web' | 'telegram' | 'plugin' | 'mcp';
    authorization_ref: string;
    authorized_at: string;
  };
  /** Optional recall captured before the sealed statement was revealed.
   * Absent by default; persisted only after an explicit user opt-in. */
  memory_before_reveal?: {
    text: string;
    saved_at: string;
  };
  present_standard?: {
    status: 'same' | 'changed' | 'withdrawn' | 'skipped';
    response_text?: string;
    recorded_at: string;
  };
  observation_source_kind?: ObservationSourceKind;
}

/** One unverified fact the honesty scan (loop-17) flagged in the analysis, carried
 *  into the contract at seal so the settle screen can ask "did you check it?".
 *  This is the mirror-not-oracle move: Argus doesn't answer the fact, it remembers
 *  to ask you later — turning honest gaps into a revisit driver. Settings (founder,
 *  2026-07-10): only world_fact WITH a source (`where`), cap 2, auto-carried with
 *  one-tap drop; a fact that `broke` leaves a light learning note (never a verdict).
 *  jsonb-nested inside the contract — no migration. */
export interface OpenCheck {
  /** Stable id (hash of text) — the settle-verdict join key. */
  id: string;
  /** The unverified world-fact, verbatim from the analysis (`ai_surfaced`, not the user's). */
  text: string;
  /** Where to verify it (실거래가 / 청약홈 / IR / 근로계약서 …), when the scan named one. */
  where?: string;
  /** Settled at check-in: 'held' = turned out true · 'broke' = turned out false ·
   *  'skipped' = user didn't check. Absent = not yet settled. */
  status?: 'held' | 'broke' | 'skipped';
  /** Light learning note recorded when it `broke` (founder setting: wrong → note). */
  note?: string;
  settled_at?: string;
}

export interface DecisionContract {
  id: string;
  project_id: string;
  predicates: Predicate[];
  /** Internal persistence guard. Version 2 requires exact AI-adoption lineage
   * and a verbatim present-standard response on every new settlement. */
  integrity_version?: 2;
  /** Counts history that existed before a legacy contract first opted into the
   * v2 guard. The database fixes this value at upgrade time; it is never a
   * client-controlled escape hatch for new records. */
  integrity_baseline?: {
    settlement_count: number;
  };
  /** New writes always set these fields. Optional only for legacy JSON. */
  kind?: DecisionKind;
  /** The exact first statement authorized at seal. Later wording changes live
   * only in statement_revisions; predicate/check edits never redefine this. */
  sealed_statement?: string;
  kind_evidence?: DecisionKindEvidence;
  kind_corrections?: DecisionKindCorrection[];
  statement_revisions?: DecisionStatementRevision[];
  origin_utterance?: string;
  review_condition_status?: ReviewConditionStatus;
  review_condition?: string;
  /** Optional event that can bring the record back before the fallback date. */
  return_event?: string;
  /** Proposal genealogy when the sealed wording/basis/check began as AI output. */
  adoption_lineage?: AdoptionLineage[];
  /** Append-only settlement records; legacy predicate verdicts remain read-only. */
  settlements?: ContractSettlement[];
  /** loop-17 B — unverified facts to check, surfaced at settle. Absent on legacy /
   *  when the scan found nothing carriable. Auto-derived at seal (deriveOpenChecks). */
  open_checks?: OpenCheck[];
  created_at: string;
  /** checkpoints v2 §3.1 — the representative checkpoint (jsonb-nested, no
   *  migration). Absent on legacy/never-designated contracts. */
  primary_checkpoint?: PrimaryCheckpoint;
  /** Recorded when the user taps "아직 판단하기 어렵다" (§7.3). */
  ambiguity?: AmbiguityRecord;
  /** The one-line structural feedback shown right after a settle (§10). */
  growth_note?: GrowthNote;
  /** First settlement — the thought↔thought check recorded before the due date
   *  (§8). Absent until the user reflects once; re-recordable. */
  lean_after?: LeanAfter;
  /** T4 first-settlement invitation was sent once. Jsonb-internal, no migration. */
  first_settlement_invited_at?: string;
  /** User muted T4 thought↔thought invitations for this decision. */
  first_settlement_muted?: boolean;
  /** Self-commitment: when the user promised to return and grade. */
  check_in_interval?: CheckInInterval;
  /** ISO timestamp derived from check_in_interval at commit time. */
  check_in_at?: string;
  /** Explicit opt-in for outbound email reminders. */
  email_reminder?: boolean;
  /** Last email reminder send timestamp, used for cron dedupe. */
  reminder_sent_at?: string;
  /** Last Telegram reminder send timestamp, used for cron dedupe. */
  telegram_reminder_sent_at?: string;
  /** Reminder waves sent so far (jsonb-internal, no migration). Capped at
   *  REMINDER_MAX_SENDS — after that the cron goes quiet and the decision waits
   *  on the web due surfaces only. "그만 물어봐 주세요" sets this to the cap. */
  reminder_count?: number;
  /** Set once every predicate carries a non-pending verdict. */
  graded_at?: string;
  /** Stamped when the CLOSING seal ceremony runs at the arrive phase (닫는 봉인).
   *  An early rope (Phase-1 BIND) creates a contract at OPEN; without this flag
   *  the closing SealMoment would short-circuit straight to the plain contract
   *  card and never play the stamp→certificate ceremony — the engaged user (who
   *  bound early) lost the emotional close. `closing && !closed_at` plays the
   *  ceremony once; once stamped, reloads show the calm card. Absent on legacy /
   *  never-closed contracts — always read as `contract.closed_at ?? undefined`. */
  closed_at?: string;
  /** Date-only / freeform check-in outcome when no predicates were generated. */
  outcome_note?: string;
  /** Superseded check-ins, oldest first. Absent on legacy contracts — always
   *  read as `contract.history || []`. */
  history?: ContractAmendment[];
  /** Generating conditions stamped at seal time (dim8). The engine churns weekly
   *  (R-rounds); a contract sealed under one prompt version is a different
   *  instrument than another, so a miss graded later can be attributed to
   *  judgment vs a since-changed generator. Absent on legacy contracts. */
  provenance?: ContractProvenance;
  /** Judgment Receipt — seal과 settle을 하나의 오브젝트로 묶는다.
   *  Absent on legacy contracts — read as contract.judgment_receipt ?? undefined. */
  judgment_receipt?: JudgmentReceipt;
  /** Retrospective-seal marker (베팅③ 회고 봉인 온보딩). When 'retro' the contract
   *  is a PRACTICE loop closed on an already-known past outcome — a first-session
   *  taste of seal→settle, not a real prediction made blind. It is fully EXCLUDED
   *  from `summarizeRecord` (the 자차표's only aggregation source) so a practice
   *  loop can never inflate loops/betsHeld/risksAvoided (goalpost-guard invariant,
   *  hindsight bias is native to retro accuracy). Absent = a normal, real contract.
   *  Lives inside the single `decision_contract` jsonb column — no migration,
   *  schema-drift unaffected. */
  origin?: 'retro';

  /**
   * A legacy display contract may carry the v3 judgment id, but its events do
   * not live in this mutable jsonb projection. `project_semantic_events` is the
   * account/project canonical ledger; this field only lets old UI routes find
   * the new record without rewriting historical contracts.
   */
  semantic_judgment_id?: string;
}

/** Run provenance for a sealed contract (dim8) — auditable reproducibility, not
 *  bit-identical determinism (the LLM floor is disclosed, not chased). The
 *  authoritative per-call model id is recorded server-side (api/llm logs
 *  llm_usage); this client stamp pins the engine version at seal time. */
export interface ContractProvenance {
  app_version: string;     // app release tag / git short sha
  prompt_version: string;  // engine prompt/skill version (R-round) — instrument identity
  sealed_at: string;       // ISO timestamp of the seal
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

// ─── Plugin Bridge (Claude Code plugin → webapp) ───
// Landing zone for content the Argus plugin saves to local disk
// (.argus/ledger/ledger.jsonl + .argus/sessions/.../current_bearing.json), so a
// logged-in user can open it in the webapp. Columns mirror
// supabase/migrations/20260618_plugin_bridge_tables.sql exactly.

export interface PluginAmendment {
  predicate?: string;
  falsified_if?: string;
  check_by?: string;
  amended_at: string;
}

export interface PluginDecision {
  id: string;
  source: 'import' | 'push';
  ledger_id: string;            // plugin's sha256(session|quote)[:8]
  project?: string;
  session?: string;
  decided_at?: string;
  harvested_at?: string;
  quote?: string;
  decision?: string;
  type?: string;
  stakes?: string;              // high | medium | low
  status?: 'candidate' | 'sealed' | 'settled' | 'dismissed';
  predicate?: string;
  falsified_if?: string;
  check_by?: string;            // verbatim YYYY-MM-DD
  sealed_at?: string;
  /** Provenance carried from the plugin ledger's seal event. The MCP surface has
   *  always recorded whether the sealed line was the user's own or an Argus
   *  draft; the bridge used to drop it, so an unconfirmed draft arrived in the
   *  webapp indistinguishable from a line the user dictated. Absent = unknown
   *  (pre-2026-07 ledgers) and MUST be rendered as unknown, never as the user's. */
  predicate_owner?: 'user' | 'ai_surfaced';
  outcome?: 'happened' | 'avoided' | 'partial' | 'pending';
  settled_at?: string;
  settle_note?: string;
  dismissed_at?: string;
  dismiss_reason?: string;
  history?: PluginAmendment[];
  raw?: unknown;
  imported_at?: string;
  created_at: string;
  updated_at: string;
}

export interface PluginEvent {
  id: string;
  plugin_decision_id?: string | null;
  ledger_id: string;
  event_id: string;
  event: 'amend' | 'settle' | 'dismiss' | 'semantic_v3';
  payload: Record<string, unknown>;
  source: 'webapp';
  applied_at?: string | null;
  created_at: string;
}

export interface PluginBearing {
  id: string;
  source: 'import' | 'push';
  session?: string;
  version_label?: string;
  label?: string;
  current_course?: { status?: string; summary?: string } | null;
  why_this_course?: Array<{ point?: string; source?: string }>;
  fog_or_reef?: { issue?: string; why_it_matters?: string; required_check?: string } | null;
  road_not_taken?: Array<{ option?: string; why_not_now?: string }>;
  next_helm?: string;
  contract_seed?: { predicate?: string; check_by?: string; pass_condition?: string; fail_condition?: string } | null;
  blocked?: boolean;
  generated_at?: string;
  raw?: unknown;
  imported_at?: string;
  created_at: string;
  updated_at: string;
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
  anthropic_model: string;
  openai_model: string;
  gemini_model: string;
  llm_mode: LLMMode;
  local_endpoint: string;
  language: 'ko' | 'en';
  audio_enabled: boolean;
  audio_volume: number;
  /** W1.4 산출물 압축: default exposure is ONE format (판단 근거서). The other
   *  format generators are preserved behind this flag — never deleted. Optional
   *  so legacy localStorage settings load safely (read as `?? false`). */
  all_output_formats?: boolean;
  /** W2.3 적층 배선: the new session arc (trial-sail theater + measurement-
   *  anchored questions). Default OFF — the old path is the A/B baseline and
   *  regression safety net (구 경로 무손상). URL `?arc=1` overrides for demos. */
  new_arc_enabled?: boolean;
  /** W1.6 선실 대청소 (founder verdict, G-W1 contact #1): focus session IS the
   *  default — one question, collapsed records, standing escape hatch. `true`
   *  restores the old per-step confirmation screens (rollback/AB). NOTE: this no
   *  longer governs the side rail — the Voyage Map rail is now always available
   *  on the left (collapsible), see `voyage_map_collapsed`. */
  classic_session?: boolean;
  /** Voyage Map rail (left): the inline branch-graph + decision trail + agent
   *  activity. Always available during a voyage; this remembers whether the user
   *  collapsed it to its spine. Default OFF (expanded). localStorage-only. */
  voyage_map_collapsed?: boolean;
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
  | 'testing'         // 시험한다 — 과주장→멈칫→진짜 베팅 (overreach/flinch)
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

/** One AI-surfaced premise, with the lineage that let it into the state.
 *
 *  The runtime already validates all of this before admitting a premise
 *  (judgment-state-contract.ts) and then threw it away, flattening to
 *  `hidden_assumptions: string[]`. Keeping it is what lets the product SHOW its
 *  work — the user's own sentence underneath, and what changes if the premise
 *  turns out wrong. That last field is also the reality check, already grounded,
 *  so the closing record never has to invent one. ADR-2026-07-31 H1. */
/**
 * What KIND of thing this is — chosen by what can be done with it later, which
 * is the only distinction that earns its keep:
 *
 *   fact          the user told us; reality already fixed it   → quote, never check
 *   premise       has to hold for the decision to work         → verify
 *   prediction    truth-apt about the future                   → settle on a date
 *   standard      the user's OWN weighting ("돈보다 성장")      → record, NEVER judge
 *   open_question nobody has answered it yet                   → ask
 *
 * `standard` is the one the old single bucket handled worst. A person's values
 * are usually what actually decides the call, and they are exactly what Argus
 * must never grade — filing them as premises meant later asking "그거 맞았어요?"
 * about someone's values. Separating them is what lets the return skip them.
 */
export type PremiseKind = 'fact' | 'premise' | 'prediction' | 'standard' | 'open_question';

/** One proposal that the admission contract did not take at face value. */
export interface PremiseVerdict {
  text: string;
  /** What the model called it. */
  declared: PremiseKind;
  /** What it was actually filed as. Absent when the proposal was refused. */
  recorded?: PremiseKind;
  /** The contract's machine reason, e.g. 'restates_anchor_recorded_as_fact'. */
  reason: string;
}

export interface PremiseRecord {
  /** The proposition that has to hold for the decision to work. */
  text: string;
  /** Defaults to 'premise' on records written before 2026-08-01. */
  kind?: PremiseKind;
  /** What you would OBSERVE that settles it, in the user's world ("승진 공문",
   *  "다음 라운드 발표"). `if_false_changes` says what would change if it were
   *  false; this says how you would ever know. Without it a return can only ask
   *  "실제로 어떻게 됐나요?" — with it, it can ask about the thing itself. */
  observable?: string;
  /** Would being wrong about this have changed the choice?
   *
   *  This is the whole reason a premise is worth anything. A premise that is
   *  equally true whichever way you go is background, not a premise — it does
   *  not bear on the decision at all. And "being wrong here would send me the
   *  other way" IS what it means for a premise to belong to a branch, so this
   *  one answer closes both the ranking question and the alternatives question
   *  at once.
   *
   *  ONLY THE USER MAY SET THIS. The model writes `if_false_changes` — its own
   *  read of the consequence — but whether that consequence would actually move
   *  this person is a fact about them, and inferring it would be Argus deciding
   *  what matters to someone. The runtime strips it from model output. */
  decisive?: 'flips' | 'holds';
  /** Verbatim from the user — verified by substring match, never paraphrased. */
  anchor_quote: string;
  /** What changes if it turns out false. The reality check, written in advance. */
  if_false_changes: string;
  support_kind: 'explicit_reason' | 'explicit_condition' | 'explicit_expectation';
}

export interface AnalysisSnapshot {
  version: number;
  real_question: string;
  /** User-authored view captured before Argus revealed its first analysis.
   *  It remains evidence on later turns and is never treated as an AI verdict. */
  pre_review_baseline?: string;
  hidden_assumptions: string[];
  /** The typed form of `hidden_assumptions` — same items, same order, with
   *  lineage. Optional: absent on snapshots written before 2026-08-01 and on
   *  non-open routes. Lives inside the progressive_sessions JSONB blob, so
   *  adding it is not a schema drift. */
  premise_records?: PremiseRecord[];
  /**
   * What the admission contract DID with the model's last proposals, when it
   * did something other than accept them as offered.
   *
   * The contract already computes a precise verdict for every proposal —
   * "this repeats its own anchor", "this attributes a weighting the quote does
   * not carry" — and until now it threw that verdict away. The model then made
   * the same move on the next turn, having never been told. Carrying it into
   * the next prompt is the deterministic half of the loop teaching the
   * probabilistic half, inside a single session.
   *
   * Only demotions and refusals are kept. A clean acceptance is silence.
   */
  premise_verdicts?: PremiseVerdict[];
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
      /** F4 — the step indices (into this steps[] array) whose output this step
       *  needs BEFORE it can run. Declared by the planner LLM when it understands
       *  a real producer→consumer chain (e.g. "size the market" before "model the
       *  unit economics"). Absent/[] = independent (runs in the parallel wave).
       *  Drives N-stage DAG layering in buildStages + the Layer-0 ready-gate. */
      depends_on?: number[];
    }[];
    key_assumptions: string[];
  };
  insight?: string;              // 이번 업데이트의 핵심 인사이트

  /** Post-generation honesty scan (loop-17, non-blocking): spans of the analysis
   *  the model asserted as settled world-fact or fabricated specifics the user
   *  never gave. Populated ASYNC after render (scanHonesty), shaded "확인 필요" in
   *  the UI. Optional + lives inside the progressive_sessions JSONB blob, so adding
   *  it is NOT a schema-drift (no per-column). Absent = not scanned / nothing found. */
  honesty_flags?: import('@/lib/honesty-scan').HonestyFlag[];

  /** High-precision post-generation verdicts removed from the first OPEN
   * analysis. Stored for auditability; rendered text contains neutral rewrites. */
  lean_flags?: import('@/lib/lean-scan').LeanFlag[];

  // Framing validation (Weakness A fix)
  framing_confidence?: number;      // 0-100: LLM의 자기 평가
  framing_locked?: boolean;         // Round 1 질문을 사용자가 확인했는지
  framing_override_reason?: string; // 사용자가 거부한 이유

  // Decision weight — feeds the §0 sealing restraint gate (shouldSealContract) so a
  // routine + reversible + confident decision gets a single light check, not the full
  // sealing ceremony (CLAUDE.md mirror clause). Safe-default to the heavier path.
  stakes?: 'routine' | 'important' | 'critical';
  reversibility?: 'reversible' | 'partial' | 'irreversible';

  // Convergence tracking (Weakness C fix)       // 0-100: 질문 안정성 + 가정 감소 종합

  // ── Under-fire judgment gates (ported from plugin v2.6) ──
  /** step-0: the model's own STEP-0 classification (R31/R32 — now WIRED: set by
   *  runInitialAnalysis from the LLM output, read by ProgressiveFlow to make a
   *  non-open route terminal — no fabricated follow-up question). Only `open`
   *  flows the full engine; every other value is a terminal inline answer. */
  request_type?: 'open' | 'flat' | 'vent' | 'validation' | 'info' | 'resistance' | 'self_profiling' | 'crisis';
  /** open_decision only: ready (default) vs resistance (long-pending, no new info). */
  readiness?: 'ready' | 'resistance';
  /** Whether real_question meaningfully differs from the surface question (rule 1b).
   *  flat → do not manufacture a reframe/fork (the over-fire mirror clause). */
  frame_status?: 'flat' | 'load_bearing';
  /** Cognitive weight the decision deserves; low → a 1-line directive, not a scaffold. */
  decision_density?: 'low' | 'medium' | 'high';
  decision_density_reasoning?: string;

  /** Deterministic crisis backstop result (crisis-gate.ts), set ONLY at round 0
   *  when the high-precision classifier fires. Absence = no deterministic hit
   *  (the LLM's STEP-0 GATE A still covers the subtler misses). Drives a
   *  non-blocking concern + resource in the UI (decision 3: warn, never block).
   *  Stores the category (not a frozen string) so the concern re-localizes on
   *  reload via formatConcernMessage. */
  crisis?: CrisisSignal;

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

export type WorkerStatus = 'pending' | 'running' | 'done' | 'error' | 'waiting_input' | 'ai_preparing' | 'sent' | 'waiting_response' | 'validation_failed' | 'blocked';

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
  /** 의존성 게이트(Layer 0): 이 워커가 대기 중인 상류 워커 id[]. status==='blocked'일 때만
   *  채워짐 — 사람/자기 단계의 human_input이 아직 없어 AI가 빈 입력으로 지어내지 않도록 막은 상태.
   *  상류가 입력을 채우면 재실행 시 해제된다(transient status detail, 동기화 컬럼 아님). */
  blocked_on?: string[];
  /**
   * "왜 이 에이전트가 배치됐는지" 한 줄 — 라우터의 SelectionTrace에서 도출.
   * ai 타입 자동 배정에만 존재. 사용자가 직접 교체하면 비워진다(직접 지정으로
   * 표시). 출항 전 선원 배치(TeamDeployBanner)에서 소환 근거로 노출.
   */
  assignment_reason?: string;
  /**
   * True when the captain hand-picked this agent via swap (replaceWorkerPersona)
   * rather than accepting the auto-cast. Locale-independent marker that lets the
   * ship's-log 'helm' waypoint record the captain's hand on the crew.
   */
  user_assigned?: boolean;

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
  /** Both feed extractPredicatesFromSession/deriveCurrentBearing — without
   *  them in the rewind tape, a fork carried the ABANDONED branch's real_bet
   *  and dissent into the new branch's contract (measurement integrity).
   *  Optional: old checkpoints lack them (restore treats absent as null). */
  falsification?: Falsification | null;
  debate_result?: { challenge: string; targetAgent: string; weakestClaim: string; alternativeView: string; severity: string } | null;
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
  | 'course_change' // ↻ 항로 변경 — the real question / framing turned
  | 'reef'          // ⚠ 암초 — a hidden assumption surfaced (confirmed or killed)
  | 'sighting'      // 👁 관측 — a worker/finding surfaced material intelligence
  | 'headwind'      // 🜨 역풍 — a stakeholder concern / risk forced an adjustment
  | 'helm'          // 🖐 선장의 키 — the captain took the helm (hand-built crew / human-handled work)
  | 'anchorage';    // ⚑ 정박 — convergence / final commitment

/**
 * An alternative weighed but not taken at a course-change — the "road not
 * taken". Captured at the fork so the chart can offer it as a ghost branch the
 * user can later sail. `taken=true` marks the single path actually pursued.
 */
export interface WaypointAlternative {
  label: string;          // short name of the path
  /** Reason text retained for backward compatibility. It is user-authored only
   *  when `why_abandoned_source === 'user'`; an absent source is legacy_unknown
   *  and must not be rendered or exported as the user's reason (E-B3). */
  why_abandoned: string;
  why_abandoned_source?: 'user' | 'legacy_unknown';
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

// ── Falsification / Overreach ("시험한다") ──
// The app deliberately over-inflates the plan into escalating success-claims and
// asks the user to stop where they stop believing. The flinch point reveals the
// load-bearing assumption they were unconsciously betting on. The surfaced bet
// feeds the Decision Contract (NOT a second sealing mechanism).

export interface LoadBearingClaim {
  id: string;
  /** One escalating success-claim chip (or, when `highest_load`, the riskiest assumption). */
  text: string;
  /** The single belief THIS rung newly requires that the previous rung didn't —
   *  i.e. the load-bearing assumption a flinch here isolates. This is what the
   *  flinch surfaces (NOT the claim text), so "the assumption underneath" is real. */
  assumption?: string;
  /** True for the inflated success-claim chips; the no-flinch pick is not an overclaim. */
  overreached: boolean;
  /** Marks the single riskiest assumption surfaced on the no-flinch path. */
  highest_load?: boolean;
}

export interface Falsification {
  claims: LoadBearingClaim[];
  /** Id of the chip the user flinched at; null until a flinch / no-flinch is resolved. */
  flinched_id: string | null;
  /** The load-bearing assumption isolated at the flinch point. */
  surfaced_constraint?: string;
  /** The user's own re-statement of the real bet (active write). */
  real_bet?: string;
  /** Provenance of `real_bet` — honest authorship, never silent (CLAUDE.md A1).
   *  'user' = the user typed it (or affirmatively adopted it via "use as-is" then
   *  locked in). 'ai_surfaced' = the friction-skip path stood the machine-surfaced
   *  belief in as the bet without the user authoring it. Downstream calibration
   *  must NOT count an 'ai_surfaced' bet as the user's own judgment (it is the
   *  machine's assumption, not the user's prediction) — same separation as
   *  luck-vs-judgment basis. Absent (legacy) is treated as 'user'. */
  real_bet_authored?: 'user' | 'ai_surfaced';
  /** True when the constraint was surfaced via the highest-load pick, not a flinch. */
  no_flinch_fallback?: boolean;
}

export interface MixResult {
  title: string;
  /** The one-line "read first" — action + the one reason, plain, no hedging.
   *  Feeds current_course.summary (the shared bearing's "one sentence" contract).
   *  Optional: old sessions predate it and fall back to executive_summary. */
  decision_read?: string;
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
  /** Post-generation honesty scan over the DOCUMENT (title / decision_read /
   *  executive_summary / sections) — same machinery as
   *  AnalysisSnapshot.honesty_flags ("확인 필요" shade). undefined = not yet
   *  scanned (the non-blocking mix integrity effect fires); [] = scanned clean.
   *  Lean flags are not stored: detected verdicts are NEUTRALIZED into the text
   *  itself (mirror clause — a lean cannot be laundered by labeling it). */
  honesty_flags?: import('@/lib/honesty-scan').HonestyFlag[];
}

export interface LeadSynthesisResult {
  lead_agent_id: string;
  lead_agent_name: string;
  integrated_analysis: string;
  key_findings: string[];
  unresolved_tensions: string[];
  /** The single open question the decision turns on — a neutral crux, NOT a
   *  recommendation/verdict (spine: never surface a directional lean to the user).
   *  Renamed from `recommendation_direction` (2026-06-24 spine pass). */
  open_question: string;
}

export interface BearingLedgerEntry {
  id: string;
  created_at: string;
  source: 'finalize' | 'draft_revision' | 'branch_switch' | 'manual';
  draft_id?: string | null;
  version_label?: string | null;
  snapshot_version?: number;
  bearing: CurrentBearing;
}

export interface ProgressiveSession {
  id: string;
  project_id: string;
  problem_text: string;
  decision_maker: string | null;
  /**
   * Standard is the judgment harness: analysis, user questions, one synthesis.
   * Deep explicitly opts into the bounded specialist/critic execution path.
   * Optional for backward compatibility; missing always means standard.
   */
  judgment_mode?: 'standard' | 'deep';
  /** Pinned at authorization so a later provider switch cannot silently move
   * a BYOK run onto Argus-funded infrastructure. */
  deep_funding?: 'platform' | 'byok' | null;
  /** When the platform-funded daily deep pass was reserved, or when a BYOK
   * user explicitly enabled it. Kept on the session so reload resumes the same
   * authorized loop instead of consuming/asking for another pass. */
  deep_authorized_at?: string | null;

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
  /** The overreach/flinch step's result. New field — never replaces dm_feedback.
   *  Optional + backward-compat: legacy sessions read undefined. */
  falsification?: Falsification | null;
  /** Persisted opt-out for the closing follow-up prompt. Without this, a user
   *  who explicitly said "No, thanks" was asked again on every revisit. */
  seal_prompt_dismissed_at?: string | null;

  /** P1-4 체크포인트 다이어트: session-level pool for large strings (worker
   *  results, final documents) referenced by checkpoints as `@cpblob:<key>`
   *  instead of full copies — checkpoints used to multiply the session ~8x.
   *  Append-only; resolved on restore. Absent on legacy sessions (their
   *  checkpoints carry full strings and restore unchanged). */
  checkpoint_blobs?: Record<string, string>;

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
  /** Ledger of current-bearing summaries across draft revisions. */
  bearing_entries?: BearingLedgerEntry[];

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
