import type { LocalSearchPort } from './domain/ports';

export const RECALL_PROJECTION_VERSION = 1;
export const RECALL_RANKING_VERSION = 1;

export type RecallKind = 'judgment' | 'claim' | 'grant' | 'observation' | 'checkpoint';
export type RecallAuthority = 'user' | 'external' | 'ai_proposal' | 'imported' | 'legacy';
export type RecallSensitivity = 'normal' | 'sensitive' | 'highly_sensitive';

export interface RecallDocument {
  document_id: string;
  kind: RecallKind;
  canonical_refs: string[];
  project_id: string | null;
  authority: RecallAuthority;
  lifecycle_status: string;
  title: string;
  searchable_text: string;
  occurred_at: string;
  valid_from?: string;
  valid_to?: string;
  superseded_by?: string;
  source_hashes: string[];
  sensitivity: RecallSensitivity;
  projection_version: number;
}

export interface RecallHardFilters {
  authorities: RecallAuthority[];
  lifecycle_statuses: string[];
  kinds?: RecallKind[];
  project_ids?: string[];
  occurred_after?: string;
  occurred_before?: string;
}

export interface RecallQuery {
  text: string;
  intent: 'explicit_recall' | 'timeline' | 'checkpoint';
  filters: RecallHardFilters;
  limit: number;
}

export interface RecallSearchHit {
  document: RecallDocument;
  lexical_score: number;
  matched_terms: string[];
}

export type RecallSearchPort = LocalSearchPort<RecallDocument, RecallQuery, RecallSearchHit>;

export interface RecallQueryPlan {
  normalized_terms: string[];
  phrase: string;
  hard_filters: RecallHardFilters;
  candidate_limit: number;
  result_limit: number;
  semantic_enabled: false;
  ranking_version: number;
}

export interface RecallResult {
  document: RecallDocument;
  score: number;
  matched_terms: string[];
  group: {
    superseded_by?: string;
    related_document_ids: string[];
  };
}

export interface RecallResultReceipt {
  receipt_id: string;
  query_hash: string;
  ranking_version: number;
  projection_version: number;
  plan: RecallQueryPlan;
  returned_refs: string[];
  excluded_stale: string[];
  created_at: string;
}

export interface RecallExecution {
  results: RecallResult[];
  receipt: RecallResultReceipt;
}

export interface JudgmentCheckpoint {
  checkpoint_id: string;
  source_cursor: string;
  active_case_ids: string[];
  user_quote_refs: string[];
  changed_assertions: Array<{ before_ref: string; after_ref: string }>;
  unresolved_questions: Array<{ text: string; source_ref: string }>;
  missing_evidence: Array<{ text: string; source_ref: string }>;
  files_touched: Array<{ path: string; sha256: string }>;
  next_verification_dates: Array<{ case_id: string; at: string; source_ref: string }>;
  generated_at: string;
  generator_version: number;
  completeness: 'complete' | 'partial_invalid_source';
  provenance: 'ai_summary_projection';
  support_unit_eligible: false;
}
