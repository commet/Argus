/**
 * SINGLE SOURCE OF TRUTH: every public table that holds user-scoped rows
 * (has a `user_id` column). Account deletion AND export must cover ALL of these.
 *
 * Why this file exists: `deleteAllUserData` used to hardcode ~16 tables while the
 * live DB has 29 — so 13 tables of a user's data (plugin history, integrations,
 * analytics) silently SURVIVED an account deletion. The server must therefore
 * delete each table explicitly, then delete the identity.
 *
 * CORRECTION (2026-07-28, re-verified against the live schema via `pg_constraint`):
 * an earlier version of this comment claimed "none of these tables have an
 * `ON DELETE CASCADE` FK to `auth.users`". That was never true — CASCADE has been
 * in the migrations since `20260409_progressive_sessions.sql`, and live today 49 of
 * the 51 FKs to `auth.users` are CASCADE. The explicit loop is still required, for
 * two reasons that do NOT depend on the false claim:
 *   1. `user_events.user_id` (and `anonymous_account_transfer_tickets.target_user_id`)
 *      are `ON DELETE SET NULL` — a cascade would leave those rows behind.
 *   2. Deletion must return a per-table receipt; a cascade erases silently and
 *      cannot prove what was removed.
 * The practical consequence of the correction: identity deletion is a real second
 * erasure mechanism, so anything that BLOCKS identity deletion (see the route's
 * `hadError` gate) also silently blocks the cascade for tables not listed here.
 *
 * Guarded by `src/lib/__tests__/erasure-coverage.test.ts`, in two directions:
 *   - every user-scoped table DERIVED FROM THE MIGRATIONS must appear here
 *     (offline, machine-checked — catches a new migration that forgets this file);
 *   - the hand-mirrored live list must agree with this one.
 * Neither can see the live DB. For that, run after every migration:
 *   node scripts/check-erasure-coverage.mjs <execute_sql-result.json>
 */
export const USER_DATA_TABLES = [
  'accuracy_ratings',
  'agent_activities',
  'agent_chains',
  'agents',
  'decision_items',
  'decision_quality_scores',
  'deep_judgment_usage',
  'epistemic_account_policies',
  'epistemic_artifact_descriptors',
  'epistemic_authority_events',
  'epistemic_command_receipts',
  'epistemic_context_traces',
  'epistemic_erasure_receipts',
  'epistemic_projection_outbox',
  'epistemic_recall_documents',
  'epistemic_recall_projection_state',
  'epistemic_restore_receipts',
  'epistemic_use_receipts',
  'feedback_records',
  'human_agent_messages',
  'judgment_records',
  // Short-lived hashed OAuth/device codes for MCP account connection. Has a
  // `user_id`, so it is user-scoped by this file's own rule — it was live from
  // 20260716 but missing here until 2026-07-28, i.e. absent from every export.
  // R3-B 원격 MCP 파일럿 원장 (2026-08-05). 파일럿 전용이지만 user_id가 있으므로
  // 계정 삭제·내보내기에 반드시 포함된다 — 파일럿이라는 이유로 빠뜨리면
  // "폐기 전제" 계약이 지켜지지 않는다.
  'argus_cases',
  'argus_events',
  // 원격 커넥터 OAuth 인가 코드 (2026-08-05). 1회용·단명이지만 user_id가 있으므로
  // 같은 규칙이 적용된다. 짝인 argus_oauth_clients 는 user_id가 없어 여기 없다.
  'argus_oauth_grants',
  'argus_returns',
  'mcp_account_authorizations',
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
