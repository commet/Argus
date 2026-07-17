/**
 * SINGLE SOURCE OF TRUTH: every public table that holds user-scoped rows
 * (has a `user_id` column). Account deletion AND export must cover ALL of these.
 *
 * Why this file exists: `deleteAllUserData` used to hardcode ~16 tables while the
 * live DB has 29 — so 13 tables of a user's data (plugin history, integrations,
 * analytics) silently SURVIVED an account deletion. None of these tables have an
 * `ON DELETE CASCADE` FK to `auth.users` (verified against the live schema
 * 2026-06-23), so deleting the auth identity alone does NOT remove the rows; the
 * server must delete each table explicitly, then delete the identity.
 *
 * Guarded by `src/lib/__tests__/erasure-coverage.test.ts`: if a new user-scoped
 * table is added to the schema and not added here, CI fails — a table can never
 * again silently escape erasure/export.
 */
export const USER_DATA_TABLES = [
  'accuracy_ratings',
  'agent_activities',
  'agent_chains',
  'agents',
  'decision_items',
  'decision_quality_scores',
  'epistemic_account_policies',
  'epistemic_artifact_descriptors',
  'epistemic_authority_events',
  'epistemic_command_receipts',
  'epistemic_context_traces',
  'epistemic_projection_outbox',
  'epistemic_recall_documents',
  'epistemic_recall_projection_state',
  'epistemic_use_receipts',
  'feedback_records',
  'human_agent_messages',
  'judgment_records',
  'outcome_records',
  'personas',
  'plugin_bearings',
  'plugin_decisions',
  'plugin_events',
  'project_semantic_events',
  'plugin_tokens',
  'progressive_sessions',
  'projects',
  'quality_signals',
  'rate_limits',
  'recast_items',
  'reframe_items',
  'retrospective_answers',
  'review_receipts',
  'share_log',
  'shared_links',
  'slack_connections',
  'synthesize_items',
  'team_members',
  'team_review_inputs',
  'telegram_connect_codes',
  'telegram_connections',
  'telegram_decisions',
  'telegram_sessions',
  'user_events',
] as const;

export type UserDataTable = (typeof USER_DATA_TABLES)[number];
