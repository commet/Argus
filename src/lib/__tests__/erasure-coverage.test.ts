import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { USER_DATA_TABLES } from '../user-data-tables';

/**
 * Machine-derived half of the guard (added 2026-07-28).
 *
 * The hand-mirror below could only ever agree with itself. `mcp_account_authorizations`
 * shipped in `20260716_mcp_account_oauth.sql` with a `user_id` column and was absent
 * from BOTH lists for 12 days — exactly the KNOWN LIMIT documented under
 * LIVE_USER_SCOPED_TABLES, and the same class as the 2026-06-30 telegram_* miss.
 *
 * So: parse `supabase/migrations/*.sql` and require every user-scoped table found
 * there to be covered. This is a SUBSET check by construction — the repo's migration
 * folder starts at 2026-04 and does not contain the original `create_core_tables`,
 * so tables like `projects`/`personas` are invisible to it. A subset check still
 * closes the recurring hole (a NEW migration that forgets user-data-tables.ts),
 * which is the only direction a new commit can break.
 */
/** `CREATE TABLE` statements across every migration, as (name, column-body) pairs. */
function eachCreateTable(): Array<{ table: string; body: string }> {
  const dir = join(process.cwd(), 'supabase/migrations');
  const out: Array<{ table: string; body: string }> = [];

  for (const file of readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()) {
    // Strip line comments so a commented-out DDL example cannot register a table.
    const sql = readFileSync(join(dir, file), 'utf8').replace(/--[^\n]*/g, '');

    for (const match of sql.matchAll(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:public\.)?"?(\w+)"?\s*\(/gi)) {
      // Walk to the matching close paren so a nested CHECK(...) cannot end the body early.
      let depth = 0;
      let end = match.index + match[0].length - 1;
      for (let i = end; i < sql.length; i++) {
        if (sql[i] === '(') depth++;
        else if (sql[i] === ')') { depth--; if (depth === 0) { end = i; break; } }
      }
      out.push({ table: match[1], body: sql.slice(match.index + match[0].length, end) });
    }
  }
  return out;
}

const hasUserIdColumn = (body: string) => /(^|[\s,(])"?user_id"?\s/i.test(body);

function deriveUserScopedTablesFromMigrations(): string[] {
  const dir = join(process.cwd(), 'supabase/migrations');
  const withUserId = new Set<string>();
  const dropped = new Set<string>();

  for (const { table, body } of eachCreateTable()) {
    if (hasUserIdColumn(body)) withUserId.add(table);
  }

  for (const file of readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()) {
    const sql = readFileSync(join(dir, file), 'utf8').replace(/--[^\n]*/g, '');
    for (const match of sql.matchAll(/ALTER\s+TABLE\s+(?:IF\s+EXISTS\s+)?(?:public\.)?"?(\w+)"?\s+ADD\s+COLUMN\s+(?:IF\s+NOT\s+EXISTS\s+)?"?(\w+)"?/gi)) {
      if (match[2].toLowerCase() === 'user_id') withUserId.add(match[1]);
    }
    for (const match of sql.matchAll(/DROP\s+TABLE\s+(?:IF\s+EXISTS\s+)?(?:public\.)?"?(\w+)"?/gi)) {
      dropped.add(match[1]);
    }
  }

  return [...withUserId].filter((t) => !dropped.has(t)).sort();
}

/**
 * The blind spot BOTH lists and the loop share: a table that references a user
 * through a column NOT named `user_id`. `USER_DATA_TABLES` is defined by that column
 * name, and both the deletion and export loops filter with `.eq('user_id', …)` — so
 * such a table can never be covered by adding it to the list; the query would error.
 *
 * These are therefore not bugs to be auto-fixed but gaps to be DECLARED. Each one
 * must be waived here with the reason it is safe, or the test fails. Silence is not
 * an option — that is what "honest gap over fabrication" means in this file.
 */
const NON_USER_ID_REFERENCES_WAIVED: Record<string, string> = {
  anonymous_account_transfer_tickets:
    'source_user_id is ON DELETE CASCADE (row dies with the source account); target_user_id is '
    + 'ON DELETE SET NULL, so a claimed ticket outlives the target account as an anonymised, '
    + 'short-lived (expires_at) hash-only row. Not exported: it is transfer plumbing, not user '
    + 'content, and holds no text the user authored.',
  teams:
    'owner_id is ON DELETE CASCADE, so an owned team is erased with the identity — but ONLY via '
    + 'identity deletion, never via the USER_DATA_TABLES loop. KNOWN EXPORT GAP: `name` is '
    + 'user-authored (1..50 chars) and is absent from /api/account/export. Small and deliberate '
    + 'for now — a team is shared, not personal, content, and exporting it would leak one '
    + "member's view of a group others co-own. Revisit if teams stop being single-owner.",
  team_invites:
    'invited_by is ON DELETE CASCADE (dies with the inviter) and team_id cascades from teams. '
    + 'Deliberately NOT exported: the only free text is `email`, which is a THIRD PARTY\'s '
    + 'address. Exporting it would hand one user another person\'s PII under the banner of '
    + '"your data".',
};

function deriveNonUserIdUserReferencesFromMigrations(): string[] {
  const tables = new Set<string>();
  for (const { table, body } of eachCreateTable()) {
    if (!/REFERENCES\s+auth\.users/i.test(body)) continue;
    // Covered by the user_id mechanism already → not a blind spot.
    if (hasUserIdColumn(body)) continue;
    tables.add(table);
  }
  return [...tables].sort();
}

/**
 * Erasure-coverage drift guard (mirrors schema-drift.test.ts's TABLE_COLUMNS contract).
 *
 * LIVE_USER_SCOPED_TABLES is a hand-mirrored copy of every public table that has a
 * `user_id` column, re-captured 2026-07-28 against the LIVE database via:
 *   SELECT table_name FROM information_schema.columns
 *   WHERE table_schema='public' AND column_name='user_id' ... (BASE TABLEs only)
 * Live count at that capture: 48, matching this list exactly (verified with
 * `node scripts/check-erasure-coverage.mjs`, 위험 0건).
 *
 * NOTE the 2026-07-27 capture said "in the migrations", not "in the live DB", and
 * that is precisely how it went wrong: `deep_judgment_usage` was read out of an
 * UNAPPLIED migration file and recorded here as live. Capture from the database.
 *
 * If a migration adds a new user-scoped table, this test fails until the table is
 * added to BOTH this list and USER_DATA_TABLES — so account deletion/export can
 * never again silently skip a table (the bug that left 13 of 29 tables un-erased).
 *
 * KNOWN LIMIT of a hand-mirror: a table missing from BOTH this list AND
 * USER_DATA_TABLES escapes the guard (the two lists agree with each other, not
 * with the DB) — exactly how telegram_decisions/telegram_sessions slipped through
 * export+deletion until 2026-06-30, and how mcp_account_authorizations did until
 * 2026-07-28. That limit is now partly closed from below by
 * `deriveUserScopedTablesFromMigrations()` (machine-checked, offline) and from
 * above by `scripts/check-erasure-coverage.mjs` (on-demand, against the live DB).
 * Neither replaces re-running the SELECT after a migration — keep the date current.
 *
 * The reverse direction — a table listed here that does NOT exist in the live DB —
 * is invisible to CI and is NOT harmless: account deletion iterates this list and
 * treats a PostgREST "relation does not exist" error as a fatal error, which
 * blocks identity deletion entirely. Only the live script can catch that.
 */
const LIVE_USER_SCOPED_TABLES = [
  'accuracy_ratings', 'agent_activities', 'agent_chains', 'agents',
  // R3-B 원격 MCP 파일럿 (2026-08-05). 파일럿 전용 테이블이지만 user_id가 있으므로
  // 계정 삭제·내보내기가 반드시 훑어야 한다 — "폐기 전제" 계약은 사용자가 지울 수
  // 있을 때만 참이다.
  'argus_belief_checks', 'argus_cases', 'argus_delegations', 'argus_events', 'argus_oauth_grants',
  // TWIN (2026-08-06) — case_bank 는 전역이라 없음
  'argus_profile_items', 'argus_returns', 'argus_shadow_predictions', 'argus_simulation_runs',
  'decision_items', 'decision_quality_scores', 'deep_judgment_usage', 'epistemic_account_policies',
  'epistemic_artifact_descriptors', 'epistemic_authority_events', 'epistemic_command_receipts', 'epistemic_context_traces', 'epistemic_erasure_receipts',
  'epistemic_projection_outbox', 'epistemic_recall_documents', 'epistemic_recall_projection_state', 'epistemic_restore_receipts', 'epistemic_use_receipts', 'feedback_records', 'human_agent_messages',
  'judgment_records', 'mcp_account_authorizations', 'outcome_records', 'personas', 'plugin_bearings',
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

  // The half that does not depend on anyone remembering to update a list by hand.
  describe('derived from supabase/migrations (machine-checked)', () => {
    const derived = deriveUserScopedTablesFromMigrations();

    it('finds the user-scoped tables the migrations actually declare', () => {
      // Sanity: if the parser silently stopped matching, every assertion below
      // would pass vacuously. Anchor it on tables known to be in the folder.
      expect(derived).toContain('progressive_sessions');
      expect(derived).toContain('mcp_account_authorizations');
      expect(derived.length).toBeGreaterThan(25);
    });

    it('every migration-declared user-scoped table is covered by USER_DATA_TABLES', () => {
      const missing = derived.filter((t) => !USER_DATA_TABLES.includes(t as never));
      expect(
        missing,
        `migrations declare these user-scoped tables but USER_DATA_TABLES omits them `
        + `(their rows would be skipped by export, and by deletion unless a CASCADE `
        + `happens to cover them): ${missing.join(', ')}`,
      ).toEqual([]);
    });

    it('every table referencing auth.users WITHOUT a user_id column is explicitly waived', () => {
      const blind = deriveNonUserIdUserReferencesFromMigrations();
      // Anchor: if the parser breaks, this assertion must not pass vacuously.
      expect(blind).toContain('anonymous_account_transfer_tickets');

      // A waiver with no stated reason is not a waiver — it is the silence this guard exists to stop.
      const unreasoned = Object.entries(NON_USER_ID_REFERENCES_WAIVED)
        .filter(([, reason]) => reason.trim().length < 40)
        .map(([table]) => table);
      expect(unreasoned, `waived without a real reason: ${unreasoned.join(', ')}`).toEqual([]);

      const undeclared = blind.filter((t) => !(t in NON_USER_ID_REFERENCES_WAIVED));
      expect(
        undeclared,
        `these tables reference auth.users through a non-\`user_id\` column, so the erasure/export `
        + `loops (\`.eq('user_id', …)\`) structurally cannot cover them. Add each to `
        + `NON_USER_ID_REFERENCES_WAIVED with the reason it is safe: ${undeclared.join(', ')}`,
      ).toEqual([]);
    });

    it('every migration-declared user-scoped table is in the live hand-mirror', () => {
      const missing = derived.filter((t) => !LIVE_USER_SCOPED_TABLES.includes(t));
      expect(
        missing,
        `migrations declare these but LIVE_USER_SCOPED_TABLES omits them — `
        + `re-run the information_schema SELECT above: ${missing.join(', ')}`,
      ).toEqual([]);
    });
  });
});
