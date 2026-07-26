import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const state = vi.hoisted(() => ({
  user: { id: 'anon-1', is_anonymous: true } as { id: string; is_anonymous: boolean } | null,
  inserted: [] as Array<Record<string, unknown>>,
  rpcError: null as { message: string } | null,
  rpcArgs: null as Record<string, unknown> | null,
}));

function authClient() {
  return {
    auth: {
      getUser: () => Promise.resolve({
        data: { user: state.user },
        error: state.user ? null : { message: 'bad token' },
      }),
    },
  };
}

function adminClient() {
  return {
    from: () => ({
      insert: (row: Record<string, unknown>) => {
        state.inserted.push(row);
        return Promise.resolve({ error: null });
      },
    }),
    rpc: (_name: string, args: Record<string, unknown>) => {
      state.rpcArgs = args;
      return Promise.resolve({
        data: state.rpcError ? null : { ok: true, counts: { projects: 1 } },
        error: state.rpcError,
      });
    },
  };
}

vi.mock('@supabase/supabase-js', () => ({
  createClient: (_url: string, key: string) => key === 'svc-key' ? adminClient() : authClient(),
}));

import { POST as prepare } from '../prepare/route';
import { POST as claim } from '../claim/route';

function request(path: 'prepare' | 'claim', withCookie = false) {
  return new NextRequest(`https://argus.voyage/api/account/anonymous-transfer/${path}`, {
    method: 'POST',
    headers: {
      authorization: 'Bearer verified-token',
      ...(withCookie ? { cookie: 'argus_anon_transfer=raw-ticket' } : {}),
    },
  });
}

beforeEach(() => {
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://example.supabase.co');
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'anon-key');
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'svc-key');
  state.user = { id: 'anon-1', is_anonymous: true };
  state.inserted.length = 0;
  state.rpcError = null;
  state.rpcArgs = null;
});

afterEach(() => vi.unstubAllEnvs());

describe('anonymous account transfer routes', () => {
  it('issues an HttpOnly one-time ticket only for an anonymous bearer', async () => {
    const response = await prepare(request('prepare'));
    expect(response.status).toBe(200);
    expect(state.inserted).toHaveLength(1);
    expect(state.inserted[0]).toMatchObject({ source_user_id: 'anon-1' });
    expect(String(state.inserted[0].token_hash)).toMatch(/^[a-f0-9]{64}$/);
    const cookie = response.headers.get('set-cookie') || '';
    expect(cookie).toContain('argus_anon_transfer=');
    expect(cookie.toLowerCase()).toContain('httponly');
    expect(cookie.toLowerCase()).toContain('samesite=lax');
  });

  it('rejects ticket preparation for a permanent account', async () => {
    state.user = { id: 'real-1', is_anonymous: false };
    const response = await prepare(request('prepare'));
    expect(response.status).toBe(403);
    expect(state.inserted).toHaveLength(0);
  });

  it('claims the ticket for the verified permanent user and then clears it', async () => {
    state.user = { id: 'real-1', is_anonymous: false };
    const response = await claim(request('claim', true));
    expect(response.status).toBe(200);
    expect(state.rpcArgs).toMatchObject({ p_target_user_id: 'real-1' });
    expect(String(state.rpcArgs?.p_token_hash)).toMatch(/^[a-f0-9]{64}$/);
    expect(response.headers.get('set-cookie')).toContain('Max-Age=0');
  });

  it('keeps the ticket on an atomic transfer failure so the same account can retry', async () => {
    state.user = { id: 'real-1', is_anonymous: false };
    state.rpcError = { message: 'unique conflict' };
    const response = await claim(request('claim', true));
    expect(response.status).toBe(409);
    expect(response.headers.get('set-cookie')).toBeNull();
  });

  it('does not invoke the transfer RPC without a prepared cookie', async () => {
    state.user = { id: 'real-1', is_anonymous: false };
    const response = await claim(request('claim'));
    expect(response.status).toBe(204);
    expect(state.rpcArgs).toBeNull();
  });
});
