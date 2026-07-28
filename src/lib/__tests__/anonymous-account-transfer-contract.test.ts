import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const migration = readFileSync(
  join(process.cwd(), 'supabase/migrations/20260726090000_anonymous_account_transfer.sql'),
  'utf8',
);
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

  it('keeps app stores behind the ownership-transfer readiness barrier', () => {
    expect(authSource).toContain('holdAuthLoadingUntilMigration');
    expect(authSource).toContain("_event === 'SIGNED_IN' || _event === 'INITIAL_SESSION'");
    expect(providersSource).toContain('isMarketing || isAuthCallback || authLoading');
    expect(providersSource).toContain('<AuthReadinessGate>{children}</AuthReadinessGate>');
  });
});
