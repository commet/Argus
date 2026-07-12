import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock('@supabase/supabase-js', () => ({ createClient: () => ({ rpc: mocks.rpc }) }));

import { recordAndCheckShare } from '../share-guard';

beforeEach(() => mocks.rpc.mockReset());

describe('recordAndCheckShare', () => {
  it('fails closed when the atomic limiter RPC fails', async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message: 'db down' } });
    expect(await recordAndCheckShare('user-1', 'email')).toMatchObject({ ok: false, status: 503 });
  });

  it('returns 429 when the atomic limiter rejects the share', async () => {
    mocks.rpc.mockResolvedValue({ data: false, error: null });
    expect(await recordAndCheckShare('user-1', 'email')).toMatchObject({ ok: false, status: 429 });
  });

  it('passes metadata to the atomic RPC', async () => {
    mocks.rpc.mockResolvedValue({ data: true, error: null });
    expect(await recordAndCheckShare('user-1', 'telegram', { target: 'chat', context: 'final' })).toEqual({ ok: true });
    expect(mocks.rpc).toHaveBeenCalledWith('record_share_if_allowed', {
      p_user_id: 'user-1', p_channel: 'telegram', p_target: 'chat', p_context: 'final', p_limit: 50,
      p_scope_channel: null,
    });
  });
});
