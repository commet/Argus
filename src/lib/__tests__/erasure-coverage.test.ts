import { describe, it, expect } from 'vitest';
import { USER_DATA_TABLES } from '../user-data-tables';

/**
 * Erasure-coverage drift guard (mirrors schema-drift.test.ts's TABLE_COLUMNS contract).
 *
 * LIVE_USER_SCOPED_TABLES is a hand-mirrored copy of every public table that has a
 * `user_id` column on the live DB, re-captured 2026-07-03 via:
 *   SELECT table_name FROM information_schema.columns
 *   WHERE table_schema='public' AND column_name='user_id' ... (BASE TABLEs only)
 *
 * If a migration adds a new user-scoped table, this test fails until the table is
 * added to BOTH this list and USER_DATA_TABLES — so account deletion/export can
 * never again silently skip a table (the bug that left 13 of 29 tables un-erased).
 *
 * KNOWN LIMIT of a hand-mirror: a table missing from BOTH this list AND
 * USER_DATA_TABLES escapes the guard (the two lists agree with each other, not
 * with the DB) — exactly how telegram_decisions/telegram_sessions slipped through
 * export+deletion until 2026-06-30. Defence: whenever a migration adds a table
 * with a `user_id` column, re-run the SELECT above and reconcile BOTH lists, and
 * keep the re-capture date current so a stale snapshot is visible at a glance.
 */
const LIVE_USER_SCOPED_TABLES = [
  'accuracy_ratings', 'agent_activities', 'agent_chains', 'agents',
  'decision_items', 'decision_quality_scores', 'epistemic_account_policies',
  'epistemic_artifact_descriptors', 'epistemic_authority_events', 'epistemic_command_receipts',
  'epistemic_projection_outbox', 'epistemic_use_receipts', 'feedback_records', 'human_agent_messages',
  'judgment_records', 'outcome_records', 'personas', 'plugin_bearings',
  'plugin_decisions', 'plugin_events', 'plugin_tokens', 'progressive_sessions', 'project_semantic_events', 'projects',
  'quality_signals', 'rate_limits', 'recast_items', 'reframe_items',
  'retrospective_answers', 'review_receipts', 'share_log', 'shared_links', 'slack_connections',
  'synthesize_items', 'team_members', 'team_review_inputs',
  'telegram_connect_codes', 'telegram_connections', 'telegram_decisions',
  'telegram_sessions', 'user_events',
].sort();

describe('account erasure / export coverage (drift guard)', () => {
  it('USER_DATA_TABLES covers every live user-scoped table', () => {
    const covered = [...USER_DATA_TABLES].sort();
    // Anything live but not covered = a table whose user data would survive deletion.
    const missing = LIVE_USER_SCOPED_TABLES.filter((t) => !covered.includes(t));
    expect(missing, `user-scoped tables missing from USER_DATA_TABLES (would NOT be erased): ${missing.join(', ')}`).toEqual([]);
  });

  it('USER_DATA_TABLES has no stale entries (every covered table is live)', () => {
    const stale = [...USER_DATA_TABLES].filter((t) => !LIVE_USER_SCOPED_TABLES.includes(t));
    expect(stale, `tables in USER_DATA_TABLES no longer in the live schema: ${stale.join(', ')}`).toEqual([]);
  });

  it('has no duplicates', () => {
    expect(new Set(USER_DATA_TABLES).size).toBe(USER_DATA_TABLES.length);
  });
});
