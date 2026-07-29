import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const MIGRATIONS = join(process.cwd(), 'supabase/migrations');
const FN = 'CREATE OR REPLACE FUNCTION public.claim_anonymous_account_transfer';

/**
 * Read the LATEST definition of the transfer function, not the first one. The RPC
 * is redefined by later migrations (2026-07-29 added the semantic ledger), and a
 * guard pinned to the original file would keep asserting a body Postgres no longer
 * runs — the guard would pass while the live function drifted away from it.
 */
const migration = (() => {
  const files = readdirSync(MIGRATIONS).filter((f) => f.endsWith('.sql')).sort().reverse();
  for (const f of files) {
    const sql = readFileSync(join(MIGRATIONS, f), 'utf8');
    if (sql.includes(FN)) return sql;
  }
  throw new Error('no migration defines claim_anonymous_account_transfer');
})();
const authSource = readFileSync(join(process.cwd(), 'src/lib/auth.tsx'), 'utf8');
const callbackSource = readFileSync(
  join(process.cwd(), 'src/app/[locale]/auth/callback/page.tsx'),
  'utf8',
);
const providersSource = readFileSync(
  join(process.cwd(), 'src/components/layout/Providers.tsx'),
  'utf8',
);

describe('anonymous → permanent account transfer contract', () => {
  it('keeps the transfer atomic and service-role-only', () => {
    expect(migration).toContain('CREATE OR REPLACE FUNCTION public.claim_anonymous_account_transfer');
    expect(migration).toContain('SECURITY DEFINER');
    expect(migration).toContain('FOR UPDATE');
    expect(migration).toContain('REVOKE ALL ON FUNCTION');
    expect(migration).toContain('TO service_role');
    expect(migration).not.toMatch(/GRANT EXECUTE[\\s\\S]*TO (anon|authenticated)/);
  });

  it('moves the project, full voyage, and decision artifacts before consuming the ticket', () => {
    for (const table of [
      'projects',
      'progressive_sessions',
      'judgment_records',
      'decision_items',
      'review_receipts',
    ]) {
      expect(migration).toContain(`UPDATE public.${table} SET user_id = p_target_user_id`);
    }
    expect(migration.indexOf('UPDATE public.projects SET user_id'))
      .toBeLessThan(migration.indexOf('SET consumed_at = now()'));
  });

  /**
   * The half that does not depend on anyone remembering to update a hand-written
   * list (mirrors erasure-coverage.test.ts).
   *
   * `project_semantic_events` was missing from the transfer for three days: the RPC
   * carried 17 tables, and the ONE it skipped was the only one with no localStorage
   * mirror — so an anonymous user who sealed a judgment kept the project and lost
   * the sealed record inside it, at the exact moment they created an account.
   * Nothing errored; the project simply came back empty.
   *
   * So: derive the durable tables from db.ts's own sync union and require each to
   * be transferred or waived WITH A REASON. A new synced table now forces a
   * decision instead of inheriting silence.
   */
  describe('coverage derived from the client sync layer (machine-checked)', () => {
    const dbSource = readFileSync(join(process.cwd(), 'src/lib/db.ts'), 'utf8');

    /** Tables the browser syncs, parsed out of `type TableName = …`. */
    const syncedTables = (() => {
      const m = /type TableName =([\s\S]*?);/.exec(dbSource);
      if (!m) throw new Error('could not read TableName from db.ts');
      return [...m[1].matchAll(/'([a-z_]+)'/g)].map((x) => x[1]);
    })();

    /**
     * Server-only durable tables — no `TableName` entry because the browser never
     * writes them directly, which is exactly why the RPC is the ONLY thing that can
     * carry them. Add here when a new server-authoritative user table appears.
     */
    const serverOnlyDurable = ['project_semantic_events'];

    const WAIVED: Record<string, string> = {
      agents:
        'Keyed (id, user_id) with STABLE semantic ids ("hayoon", "research"), so moving them '
        + 'collides whenever the target account already has its own default set — and a unique '
        + 'violation rolls back the WHOLE transfer, losing everything else with it. The browser '
        + 're-seeds them under the new account from localStorage/defaults.',
      agent_chains: 'Same stable-id collision as `agents`; re-seeded the same way.',
      plugin_decisions:
        'Written only by /api/plugin/ingest, which requires an account-bound plugin token. '
        + 'An anonymous browser session can never own a row, so there is nothing to carry.',
      plugin_bearings: 'Same account-bound plugin token requirement as `plugin_decisions`.',
      plugin_events: 'Same account-bound plugin token requirement as `plugin_decisions`.',
    };

    it('reads a real table list (fails loudly instead of vacuously passing)', () => {
      expect(syncedTables).toContain('projects');
      expect(syncedTables).toContain('review_receipts');
      expect(syncedTables.length).toBeGreaterThan(15);
    });

    it('every durable user table is transferred or waived with a reason', () => {
      const undeclared = [...syncedTables, ...serverOnlyDurable].filter(
        (t) => !migration.includes(`UPDATE public.${t} SET user_id = p_target_user_id`) && !(t in WAIVED),
      );
      expect(
        undeclared,
        'these tables hold anonymous work that the transfer would strand under the old '
        + `anonymous user id. Carry them in the RPC, or waive each with the reason it is safe: ${undeclared.join(', ')}`,
      ).toEqual([]);
    });

    it('a waiver without a stated reason is not a waiver', () => {
      const unreasoned = Object.entries(WAIVED).filter(([, r]) => r.trim().length < 40).map(([t]) => t);
      expect(unreasoned).toEqual([]);
    });

    it('carries the canonical judgment ledger AFTER the projects it references', () => {
      const projects = migration.indexOf('UPDATE public.projects SET user_id');
      const ledger = migration.indexOf('UPDATE public.project_semantic_events SET user_id');
      expect(ledger).toBeGreaterThan(-1);
      expect(ledger).toBeGreaterThan(projects);
      expect(ledger).toBeLessThan(migration.indexOf('SET consumed_at = now()'));
    });
  });

  it('verifies anonymous source and permanent target identities', () => {
    expect(migration).toContain('TRANSFER_SOURCE_NOT_ANONYMOUS');
    expect(migration).toContain('TRANSFER_TARGET_NOT_PERMANENT');
    expect(migration).toContain('TRANSFER_TARGET_MISMATCH');
  });

  it('prepares every account-changing auth path and claims before local migration', () => {
    expect(authSource.match(/prepareAnonymousAccountTransfer\(\)/g)?.length).toBeGreaterThanOrEqual(4);
    expect(authSource.indexOf('claimAnonymousAccountTransfer()'))
      .toBeLessThan(authSource.indexOf('migrateLocalToAccount()'));
    expect(callbackSource).toContain('await claimAnonymousAccountTransfer()');
  });

  /**
   * The other end of the same asymmetry. `useAuth().user` is deliberately null for
   * an anonymous session, so Settings' erasure branched to "only this browser's
   * local data exists" — which stopped being true the day anonymous auth gave
   * logged-out voyagers a durable server identity. clearAllStorage() then threw
   * away the only token that could reach those rows, so the user's projects,
   * receipts and sealed judgments were kept without consent AND made permanently
   * un-erasable. Erasure must key on the SESSION (2026-07-29).
   */
  it('erases the server copy for an anonymous session too, not just a real account', () => {
    const settings = readFileSync(join(process.cwd(), 'src/app/[locale]/settings/page.tsx'), 'utf8');
    expect(settings).toContain('const { user, session } = useAuth();');
    expect(settings).toMatch(/if \(user \|\| session\) \{/);
    // and the branch that skipped the server must be gone
    expect(settings).not.toContain("// Anonymous — only this browser's local data exists.");
  });

  it('keeps app stores behind the ownership-transfer readiness barrier', () => {
    expect(authSource).toContain('holdAuthLoadingUntilMigration');
    expect(authSource).toContain("_event === 'SIGNED_IN' || _event === 'INITIAL_SESSION'");
    expect(providersSource).toContain('isMarketing || isAuthCallback || authLoading');
    expect(providersSource).toContain('<AuthReadinessGate>{children}</AuthReadinessGate>');
  });
});
