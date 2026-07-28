import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { USER_DATA_TABLES } from '@/lib/user-data-tables';
import { logServerEvent } from '@/lib/server-events';

/**
 * Account deletion — PROVABLE, complete erasure with a receipt.
 *
 * Replaces the old client-side loop that (a) covered only 16 of 29 user-scoped
 * tables, (b) swallowed errors so a failed delete reported success, and (c) never
 * removed the auth identity. We delete each table explicitly with the service role,
 * THEN delete the identity, and return a per-table receipt so the client can show
 * what was actually removed.
 *
 * Why explicit deletion, correctly stated (2026-07-28 — the previous "none of the
 * tables cascade on auth.users delete" was false; live, 49 of 51 FKs to auth.users
 * ARE cascade):
 *   1. `user_events.user_id` is ON DELETE SET NULL — a cascade leaves those rows.
 *   2. A cascade erases silently and cannot produce the per-table receipt.
 *
 * The `hadError` gate below is deliberately all-or-nothing, and that has a sharp
 * edge worth knowing: because identity deletion IS a real cascade trigger for the
 * tables not in USER_DATA_TABLES, any error in the loop blocks that cascade too.
 * A single table listed here but absent from the live DB therefore stops the whole
 * erasure (it happened: `deep_judgment_usage`, 2026-07-27..28). Guard against it
 * with `node scripts/check-erasure-coverage.mjs` after every migration — CI cannot
 * see the live schema.
 */
export async function POST(req: NextRequest) {
  // Reject anonymous callers before exposing deployment configuration state.
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !serviceKey || !anonKey) {
    return NextResponse.json({ error: 'Service unavailable.' }, { status: 503 });
  }

  // Verify the caller owns the account they're deleting (bearer token).
  const token = authHeader.slice(7);
  const authClient = createClient(url, anonKey);
  const { data: { user }, error: authErr } = await authClient.auth.getUser(token);
  if (authErr || !user) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }
  const userId = user.id;

  // Service-role client bypasses RLS so we can guarantee complete erasure.
  const admin = createClient(url, serviceKey);

  const receipt: Record<string, number | string> = {};
  let hadError = false;

  // Object bytes are outside Postgres and do not cascade with auth.users.
  // Resolve canonical and staging locators while descriptor rows still exist.
  // On failure keep all rows and identity so the erasure can be retried.
  const { data: artifactRows, error: artifactReadError } = await admin
    .from('epistemic_artifact_descriptors')
    .select('object_locator, staging_locator')
    .eq('user_id', userId);
  if (artifactReadError) {
    hadError = true;
    receipt['storage:epistemic-artifacts'] = `error: ${artifactReadError.message}`;
  } else {
    const allLocators = (artifactRows ?? []).flatMap((row: {
      object_locator?: unknown;
      staging_locator?: unknown;
    }) => [row.object_locator, row.staging_locator]
      .filter((value): value is string => typeof value === 'string' && value.length > 0));
    const invalidLocator = allLocators.find((value: string) => !value.startsWith(`${userId}/`));
    const locators = [...new Set(allLocators.filter((value: string) => value.startsWith(`${userId}/`)))];
    let removed = 0;
    if (invalidLocator) {
      hadError = true;
      receipt['storage:epistemic-artifacts'] = 'error: invalid cross-account artifact locator';
    }
    for (let index = 0; !hadError && index < locators.length; index += 100) {
      const chunk = locators.slice(index, index + 100);
      const { error: removeError } = await admin.storage.from('epistemic-artifacts').remove(chunk);
      if (removeError) {
        hadError = true;
        receipt['storage:epistemic-artifacts'] = `error: ${removeError.message}`;
        break;
      }
      removed += chunk.length;
    }
    if (!hadError) receipt['storage:epistemic-artifacts'] = removed;
  }

  if (!hadError) {
    for (const table of USER_DATA_TABLES) {
      const { count, error } = await admin
        .from(table)
        .delete({ count: 'exact' })
        .eq('user_id', userId);
      if (error) {
        hadError = true;
        receipt[table] = `error: ${error.message}`;
      } else {
        receipt[table] = count ?? 0;
      }
    }
  } else {
    for (const table of USER_DATA_TABLES) receipt[table] = 'skipped (object erasure incomplete)';
  }

  // Only remove the auth identity once every row is gone — otherwise a partial
  // failure would orphan data under a deleted identity (unrecoverable).
  let identityDeleted = false;
  if (!hadError) {
    const { error: delErr } = await admin.auth.admin.deleteUser(userId);
    if (delErr) {
      hadError = true;
      receipt['auth.users'] = `error: ${delErr.message}`;
    } else {
      identityDeleted = true;
      receipt['auth.users'] = 'deleted';
    }
  } else {
    receipt['auth.users'] = 'skipped (row deletion incomplete — identity kept so nothing is orphaned)';
  }

  logServerEvent('account_deleted', { ok: !hadError, identityDeleted }, { userId, path: '/api/account/delete' });

  return NextResponse.json(
    { ok: !hadError, identityDeleted, receipt },
    { status: hadError ? 500 : 200 },
  );
}
