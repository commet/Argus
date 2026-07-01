/**
 * Argus Document Judgment Review — Phase 0 Schema Lock.
 *
 * Single source of truth for the intermediate objects that the review
 * pipeline produces. Per the design doc
 * (docs/strategy/argus-product-loop-ux-subtask-b-2026-07-01.md → "구현 순서 /
 * Phase 0: Schema Lock"): fix the objects BEFORE the pipeline and the UI, so
 * the same `JudgmentReceipt` can be produced by the webapp and the MCP/plugin.
 *
 * Design invariants encoded here (do not weaken without revisiting the doc):
 *  - Every high-confidence finding MUST be able to carry a `source_anchor`.
 *    A finding with no anchor cannot be `high` confidence (enforced in the
 *    pipeline, typed as optional here so degraded reviews can still exist).
 *  - Provenance (schema/lens/model versions) rides on every receipt, so we can
 *    later prove "Argus got better" instead of asserting it.
 *  - Ownership fields (lean, pass/fail, settlement outcome) are user-owned.
 *    The pipeline never fills them — see the Zero-Judgment spine in CLAUDE.md.
 */

export const REVIEW_SCHEMA_VERSION = '1' as const;

// ---------------------------------------------------------------------------
// 1. Canonical Artifact — every input normalizes into this before analysis.
// ---------------------------------------------------------------------------

export type SourceKind =
  | 'paste'
  | 'markdown'
  | 'txt'
  | 'pdf'
  | 'docx'
  | 'pptx'
  | 'transcript'
  | 'mcp_file'
  | 'pr_diff'
  | 'llm_answer';

export type ExtractionQuality = 'high' | 'medium' | 'low' | 'unsupported';

export type PrivacyMode = 'receipt_only' | 'store_source' | 'local_only';

export type UnitKind =
  | 'heading'
  | 'paragraph'
  | 'bullet'
  | 'table'
  | 'quote'
  | 'slide_title'
  | 'slide_body'
  | 'speaker_note'
  | 'shape_text'
  | 'chart_label'
  | 'diff_hunk'
  | 'transcript_turn';

/**
 * Where a unit lives in the original document. This is what lets a finding say
 * "slide 4's market-size claim" and take the user back to the source. Without
 * it, Argus is just a long AI answer.
 */
export interface SourceAnchor {
  page?: number;
  slide?: number;
  shape_id?: string;
  section_path?: string[];
  paragraph_index?: number;
  line_start?: number;
  line_end?: number;
  char_start?: number;
  char_end?: number;
}

export interface ArtifactUnit {
  unit_id: string;
  kind: UnitKind;
  text: string;
  source_anchor: SourceAnchor;
  /** 0–1 extraction confidence for this specific unit. */
  confidence: number;
}

export interface ArtifactStructure {
  /** page / slide / section count, whichever the format has. */
  page_count?: number;
  slide_count?: number;
  section_count?: number;
  heading_count?: number;
  table_count?: number;
  /** true when the format is inherently ordered persuasion (deck). */
  is_deck: boolean;
}

export interface CanonicalArtifact {
  artifact_id: string;
  source_kind: SourceKind;
  source_title: string;
  /** stable hash of the normalized text — used for caching + version drift. */
  source_fingerprint: string;
  extraction_quality: ExtractionQuality;
  privacy_mode: PrivacyMode;
  units: ArtifactUnit[];
  detected_structure: ArtifactStructure;
  detected_profile?: DocumentProfile;
  /** honest notes surfaced to the user, e.g. "표/이미지 일부는 빠질 수 있습니다." */
  extraction_notes: string[];
}

// ---------------------------------------------------------------------------
// 2. Document Profile — decides how strictly to review.
// ---------------------------------------------------------------------------

export type ArtifactMaturity =
  | 'idea'
  | 'rough_draft'
  | 'working_draft'
  | 'near_final'
  | 'final'
  | 'raw_notes';

export type DocumentType =
  | 'strategy_memo'
  | 'prd'
  | 'rfc'
  | 'adr'
  | 'strategy_deck'
  | 'pitch_deck'
  | 'board_deck'
  | 'sales_deck'
  | 'investor_update'
  | 'research_report'
  | 'meeting_notes'
  | 'llm_answer'
  | 'proposal'
  | 'unknown';

export type DocumentIntent =
  | 'decide'
  | 'persuade'
  | 'inform'
  | 'align'
  | 'pitch'
  | 'request_approval'
  | 'explore'
  | 'record';

export type DocumentAudience =
  | 'self'
  | 'team'
  | 'executive'
  | 'customer'
  | 'investor'
  | 'technical_review'
  | 'unknown';

export type Stakes = 'low' | 'medium' | 'high';

export interface DocumentProfile {
  artifact_maturity: ArtifactMaturity;
  document_type: DocumentType;
  intent: DocumentIntent;
  audience: DocumentAudience;
  stakes: Stakes;
  /** 0–1 how confident the profiler is. Low → surface as `inferred`. */
  source_confidence: number;
  /** true when the user supplied the field vs Argus inferred it. */
  inferred: {
    document_type: boolean;
    intent: boolean;
    audience: boolean;
    stakes: boolean;
  };
}

/** The 3 minimal context questions the import screen may ask (all optional). */
export interface UserReviewContext {
  audience_hint?: string;
  decision_wanted?: string;
  biggest_worry?: string;
  /** 0–3 concern chips the user selected (maps to lens preferences). */
  concerns?: ReviewConcern[];
}

export type ReviewConcern =
  | 'strategic_fit'
  | 'evidence'
  | 'stakeholder_objection'
  | 'execution_risk'
  | 'ai_answer_trust'
  | 'full_judgment_review';

// ---------------------------------------------------------------------------
// 3. Reviewability — can this document be reviewed at all, and how well?
// ---------------------------------------------------------------------------

export interface ReviewabilityScore {
  /** 0–100 overall. Bands: 80+ normal, 60–79 caveats, 40–59 limited, <40 no full receipt. */
  score: number;
  extraction: number;
  structure: number;
  decision_clarity: number;
  evidence_availability: number;
  anchor_coverage: number;
  reasons: string[];
}

export type ReviewabilityBand = 'normal' | 'caveated' | 'limited' | 'insufficient';

// ---------------------------------------------------------------------------
// 4. Document Judgment Map — the judgeable intermediate object.
//    Lenses operate on THIS (anchored), never on raw text.
// ---------------------------------------------------------------------------

export type ClaimStatus =
  | 'supported'
  | 'weak'
  | 'unsupported'
  | 'human_check'
  | 'contradicted';

export interface Claim {
  claim_id: string;
  text: string;
  status: ClaimStatus;
  anchors: SourceAnchor[];
  /** why this status — must reference the document, not generic advice. */
  rationale: string;
}

export interface EvidenceItem {
  evidence_id: string;
  text: string;
  anchors: SourceAnchor[];
  supports_claim_ids: string[];
  /** 'internal' = present in the doc, 'asserted' = claimed but not shown. */
  kind: 'internal' | 'external_cited' | 'asserted';
}

export interface Assumption {
  assumption_id: string;
  text: string;
  anchors: SourceAnchor[];
  /** the load-bearing part: what breaks if this is false. */
  if_false: string;
}

export interface Tradeoff {
  tradeoff_id: string;
  text: string;
  anchors: SourceAnchor[];
}

export interface Stakeholder {
  role: string;
  likely_objection: string;
  anchors: SourceAnchor[];
}

export interface OpenQuestion {
  text: string;
  anchors: SourceAnchor[];
}

export interface DecisionPoint {
  text: string;
  /** true when only a human should own this call. */
  human_only: boolean;
  anchors: SourceAnchor[];
}

export interface MissingSection {
  label: string;
  why_it_matters: string;
}

export interface DocumentJudgmentMap {
  core_question: string;
  explicit_recommendation?: string;
  implicit_recommendation?: string;
  main_claims: Claim[];
  evidence_items: EvidenceItem[];
  assumptions: Assumption[];
  tradeoffs: Tradeoff[];
  stakeholders: Stakeholder[];
  open_questions: OpenQuestion[];
  decision_points: DecisionPoint[];
  missing_sections: MissingSection[];
}

// ---------------------------------------------------------------------------
// 5. Lens library + routing.
// ---------------------------------------------------------------------------

export type LensId =
  | 'core_question'
  | 'claim_evidence'
  | 'hidden_assumption'
  | 'human_judgment'
  | 'stakeholder_objection'
  | 'execution_risk'
  | 'reversibility'
  | 'falsifiable_followup'
  | 'deck_narrative';

export interface DocumentProfileFilter {
  document_type?: DocumentType[];
  artifact_maturity?: ArtifactMaturity[];
  intent?: DocumentIntent[];
  audience?: DocumentAudience[];
  min_stakes?: Stakes;
  /** only run when the artifact is a deck. */
  deck_only?: boolean;
}

export interface JudgmentLens {
  id: LensId;
  version: string;
  label: string;
  applies_to: DocumentProfileFilter;
  purpose: string;
  input_requirements: string[];
  review_questions: string[];
  /** sentences that count as failure output for this lens (generic advice). */
  failure_modes: string[];
}

export interface LensRoutingResult {
  selected: LensId[];
  skipped: { id: LensId; reason: string }[];
  /** user-facing one-liner: which lenses + why (disclosure, never hidden). */
  disclosure: string;
}

// ---------------------------------------------------------------------------
// 6. Findings — a lens's output. Feeds the receipt directly.
// ---------------------------------------------------------------------------

export type Severity = 'minor' | 'caution' | 'critical';
export type FindingConfidence = 'low' | 'medium' | 'high';

export interface Finding {
  finding_id: string;
  lens_id: LensId;
  /** short claim-anchored title, e.g. "slide 4 market-size claim has no source". */
  title: string;
  detail: string;
  severity: Severity;
  confidence: FindingConfidence;
  /** the concrete next check — "무엇을 확인", never "더 검토하세요". */
  suggested_action?: string;
  anchors: SourceAnchor[];
  /** provenance tag on the phrasing (spine: honest authorship). */
  provenance: 'ai_surfaced' | 'user';
}

// ---------------------------------------------------------------------------
// 7. Judgment Receipt — the core artifact. Same object in webapp + MCP.
// ---------------------------------------------------------------------------

export type ReceiptState =
  | 'draft'
  | 'reviewed'
  | 'owned'
  | 'sealed'
  | 'active'
  | 'due'
  | 'settled'
  | 'reopened'
  | 'archived';

/**
 * An item only a human should decide. This field is the product's core
 * differentiator (design doc §Judgment Receipt.3).
 */
export interface JudgmentObligation {
  obligation_id: string;
  statement: string;
  owner: string;
  why_human: string;
  decision_needed_by?: string;
  evidence_needed?: string;
  anchors: SourceAnchor[];
  /** set true when the user clicks "이 판단을 내가 소유하기". */
  owned_by_user: boolean;
}

export type FollowupOutcome = 'happened' | 'avoided' | 'partial' | 'unclear';

/** A falsifiable prediction reality can settle. Owned by the user once sealed. */
export interface FalsifiableFollowup {
  followup_id: string;
  predicate: string;
  /** provenance: never forge. ai_surfaced = drafted, unconfirmed. */
  predicate_owner: 'user' | 'ai_surfaced';
  pass_condition: string;
  fail_condition: string;
  check_by: string; // YYYY-MM-DD
  sealed_at?: string;
  // --- settlement (user-owned, pipeline never fills these) ---
  settled_at?: string;
  outcome?: FollowupOutcome;
  what_happened?: string;
}

export interface Fork {
  fork_id: string;
  /** neutral crux question, NEVER a directional statement (spine). */
  question: string;
  options: string[];
  anchors: SourceAnchor[];
}

export interface CompanionNote {
  note_id: string;
  created_at: string;
  role: 'argus' | 'user';
  text: string;
}

export interface ReviewProvenance {
  schema_version: string;
  extraction_tool: string;
  extraction_version: string;
  lens_versions: Record<string, string>;
  model_provider: 'anthropic' | 'openai' | 'local' | 'unknown';
  model_name: string;
  prompt_hash: string;
  created_at: string;
}

export interface JudgmentReceipt {
  receipt_id: string;
  /** which entry mode produced it — Create vs Review stay distinct. */
  root_mode: 'create' | 'review';
  state: ReceiptState;

  // source
  artifact_id: string;
  source_kind: SourceKind;
  source_title: string;
  source_fingerprint: string;

  // profile + reviewability (surfaced on the first screen)
  profile: DocumentProfile;
  reviewability: ReviewabilityScore;
  routing: LensRoutingResult;

  // the review body
  core_question: string;
  judgment_obligations: JudgmentObligation[];
  claim_ledger: Claim[];
  hidden_assumptions: Assumption[];
  forks: Fork[];
  findings: Finding[];
  /** neutral orientation line, never a "proceed" verdict. */
  current_heading: string;
  falsifiable_followups: FalsifiableFollowup[];

  // liveness
  companion_thread: CompanionNote[];

  provenance: ReviewProvenance;
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// 8. Async job + analysis budget.
// ---------------------------------------------------------------------------

export type ReviewJobStatus =
  | 'queued'
  | 'extracting'
  | 'profiling'
  | 'mapping'
  | 'routing'
  | 'reviewing'
  | 'synthesizing'
  | 'ready'
  | 'needs_context'
  | 'failed';

export type ReviewFailureKind =
  | 'extraction_low'
  | 'no_decision_found'
  | 'no_source_anchors'
  | 'lens_conflict'
  | 'generic_result'
  | 'model_error'
  | 'unsupported_format';

export interface ReviewFailure {
  kind: ReviewFailureKind;
  message: string;
  /** what the user can do next. */
  recovery: string;
}

export interface AnalysisBudget {
  max_units: number;
  max_tokens: number;
  max_lens_calls: number;
  depth: 'quick' | 'standard' | 'deep';
}

export interface ReviewJob {
  job_id: string;
  artifact_id: string;
  status: ReviewJobStatus;
  progress_label: string;
  partial_receipt?: Partial<JudgmentReceipt>;
  error?: ReviewFailure;
}

export const DEFAULT_BUDGET: Record<AnalysisBudget['depth'], AnalysisBudget> = {
  quick: { max_units: 60, max_tokens: 8000, max_lens_calls: 4, depth: 'quick' },
  standard: { max_units: 160, max_tokens: 16000, max_lens_calls: 7, depth: 'standard' },
  deep: { max_units: 400, max_tokens: 32000, max_lens_calls: 9, depth: 'deep' },
};

// ---------------------------------------------------------------------------
// Reviewability banding helper (pure — safe to import anywhere).
// ---------------------------------------------------------------------------

export function reviewabilityBand(score: number): ReviewabilityBand {
  if (score >= 80) return 'normal';
  if (score >= 60) return 'caveated';
  if (score >= 40) return 'limited';
  return 'insufficient';
}
