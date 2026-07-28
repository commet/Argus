import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * Account deletion is destructive and irreversible, so its trust gate is the
 * whole point: the caller must present a Bearer token that resolves to a real
 * user, and only then are that user's rows deleted (the identity last). We stub
 * both Supabase clients — the anon client that resolves the token to a user, and
 * the service-role admin client that performs per-table deletes — so we can
 * assert the auth gate and the "identity kept if a delete failed" invariant
 * without a DB.
 */

let tokenUser: { id: string } | null = { id: 'user-1' };
let deleteError: { message: string } | null = null;
/** One table that answers like PostgREST does for a relation that isn't there. */
let missingTable: string | null = null;
let artifactReadError: { message: string } | null = null;
let storageRemoveError: { message: string } | null = null;
let artifactLocator = 'user-1/sha256/aa/hash';
const deletedTables: string[] = [];
const removedObjects: string[] = [];
const deleteUserSpy = vi.fn(() => Promise.resolve({ error: null }));

function authClient() {
  return {
    auth: { getUser: () => Promise.resolve({ data: { user: tokenUser }, error: tokenUser ? null : { message: 'bad token' } }) },
  };
}
function adminClient() {
  return {
    from(table: string) {
      return {
        select: () => ({
          eq: () => Promise.resolve({
            data: table === 'epistemic_artifact_descriptors'
              ? [{ object_locator: artifactLocator, staging_locator: 'user-1/staging/a/tmp' }]
              : [],
            error: artifactReadError,
          }),
        }),
        delete: () => ({
          eq: () => {
            if (deleteError) return Promise.resolve({ count: null, error: deleteError });
            if (table === missingTable) {
              return Promise.resolve({
                count: null,
                error: {
                  code: 'PGRST205',
                  message: `Could not find the table 'public.${table}' in the schema cache`,
                },
              });
            }
            deletedTables.push(table);
            return Promise.resolve({ count: 1, error: null });
          },
        }),
      };
    },
    storage: {
      from: () => ({
        remove: (paths: string[]) => {
          removedObjects.push(...paths);
          return Promise.resolve({ error: storageRemoveError });
        },
      }),
    },
    auth: { admin: { deleteUser: deleteUserSpy } },
  };
}

vi.mock('@supabase/supabase-js', () => ({
  // First createClient() in the handler is the anon auth client, second is admin.
  createClient: (_url: string, key: string) => (key === 'svc-key' ? adminClient() : authClient()),
}));
vi.mock('@/lib/server-events', () => ({ logServerEvent: vi.fn() }));

import { POST } from '../route';

function req(token?: string) {
  return new Request('https://argus.voyage/api/account/delete', {
    method: 'POST',
    headers: token ? { authorization: `Bearer ${token}` } : {},
  }) as never;
}

beforeEach(() => {
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'svc-key');
  tokenUser = { id: 'user-1' };
  deleteError = null;
  missingTable = null;
  artifactReadError = null;
  storageRemoveError = null;
  artifactLocator = 'user-1/sha256/aa/hash';
  deletedTables.length = 0;
  removedObjects.length = 0;
  deleteUserSpy.mockClear();
});
afterEach(() => vi.unstubAllEnvs());

describe('POST /api/account/delete — auth + erasure receipt', () => {
  it('401s with no Authorization header', async () => {
    const res = await POST(req());
    expect(res.status).toBe(401);
    expect(deletedTables).toHaveLength(0);
  });

  it('401s without auth even when the service role is unconfigured', async () => {
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', '');
    const res = await POST(req());
    expect(res.status).toBe(401);
  });

  it('401s when the bearer token does not resolve to a user', async () => {
    tokenUser = null;
    const res = await POST(req('bogus'));
    expect(res.status).toBe(401);
    expect(deleteUserSpy).not.toHaveBeenCalled();
  });

  it('503s when the service role key is not configured', async () => {
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', '');
    const res = await POST(req('good'));
    expect(res.status).toBe(503);
  });

  it('deletes every user-scoped table then the identity, returning a receipt', async () => {
    const res = await POST(req('good'));
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.identityDeleted).toBe(true);
    expect(deletedTables.length).toBeGreaterThan(0);
    expect(removedObjects).toEqual(['user-1/sha256/aa/hash', 'user-1/staging/a/tmp']);
    expect(deleteUserSpy).toHaveBeenCalledWith('user-1');
    expect(json.receipt['auth.users']).toBe('deleted');
  });

  it('keeps descriptor rows and identity when object erasure fails', async () => {
    storageRemoveError = { message: 'bucket unavailable' };
    const res = await POST(req('good'));
    const json = await res.json();
    expect(res.status).toBe(500);
    expect(deletedTables).toHaveLength(0);
    expect(deleteUserSpy).not.toHaveBeenCalled();
    expect(String(json.receipt['storage:epistemic-artifacts'])).toContain('bucket unavailable');
  });

  it('KEEPS the auth identity when any table delete fails (no orphaned data)', async () => {
    deleteError = { message: 'boom' };
    const res = await POST(req('good'));
    const json = await res.json();
    expect(res.status).toBe(500);
    expect(json.ok).toBe(false);
    expect(json.identityDeleted).toBe(false);
    expect(deleteUserSpy).not.toHaveBeenCalled();
    expect(String(json.receipt['auth.users'])).toContain('skipped');
  });

  /**
   * Regression — the 2026-07-27..28 production incident, reproduced exactly.
   *
   * `deep_judgment_usage` was added to USER_DATA_TABLES in the same commit as its
   * migration, but the migration was never applied. Exactly ONE table answered
   * PGRST205 while every other delete succeeded, so the receipt looked almost
   * entirely healthy — and the identity was never deleted, which ALSO silences the
   * `ON DELETE CASCADE` that is the only erasure path for tables outside the list.
   * Deletion returned 500 for every user, and both CI list-guards stayed green.
   *
   * The all-or-nothing gate asserted here is correct and must stay (skipping ahead
   * would orphan rows). What must never regress is the loudness: a schema drift has
   * to name the table in the receipt. Catching the drift itself is the job of
   * `scripts/check-erasure-coverage.mjs` — CI cannot see the live DB.
   */
  it('a single missing table (schema drift) blocks identity deletion and names itself', async () => {
    missingTable = 'deep_judgment_usage';
    const res = await POST(req('good'));
    const json = await res.json();

    expect(res.status).toBe(500);
    expect(json.ok).toBe(false);
    expect(json.identityDeleted).toBe(false);
    expect(deleteUserSpy).not.toHaveBeenCalled();

    // The tell that made this hard to spot: most tables still report success.
    expect(deletedTables.length).toBeGreaterThan(10);
    expect(String(json.receipt.deep_judgment_usage)).toContain('Could not find the table');
    expect(String(json.receipt['auth.users'])).toContain('skipped');
  });

  it('fails closed before deletion when a descriptor points outside the account prefix', async () => {
    artifactLocator = 'someone-else/sha256/aa/hash';
    const res = await POST(req('good'));
    expect(res.status).toBe(500);
    expect(removedObjects).toEqual([]);
    expect(deletedTables).toEqual([]);
    expect(deleteUserSpy).not.toHaveBeenCalled();
  });
});
