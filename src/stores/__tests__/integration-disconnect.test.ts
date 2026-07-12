import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ deleteError: null as { message: string } | null }));

function deleteChain() {
  return {
    eq: () => ({ eq: () => Promise.resolve({ error: mocks.deleteError }) }),
  };
}

vi.mock('@/lib/supabase', () => ({
  getCurrentUserId: () => Promise.resolve('user-1'),
  supabase: {
    auth: { getSession: () => Promise.resolve({ data: { session: null } }) },
    from: () => ({ delete: deleteChain }),
  },
}));

import { useSlackStore } from '../useSlackStore';
import { useTelegramStore } from '../useTelegramStore';

describe('integration disconnect state', () => {
  beforeEach(() => {
    mocks.deleteError = null;
    useSlackStore.setState({
      connections: [{ id: 'slack-1', team_id: 'T1', team_name: 'Team', created_at: '2026-01-01' }],
      channels: [], loaded: true, loadError: false,
    });
    useTelegramStore.setState({
      connections: [{ id: 'tg-1', chat_id: 'C1', chat_title: 'Chat', chat_type: 'private', created_at: '2026-01-01' }],
      loaded: true, loadError: false,
    });
  });

  it('keeps Slack connected when the server delete fails', async () => {
    mocks.deleteError = { message: 'db down' };
    expect(await useSlackStore.getState().disconnect('slack-1')).toEqual({ ok: false });
    expect(useSlackStore.getState().connections).toHaveLength(1);
  });

  it('keeps Telegram connected when the server delete fails', async () => {
    mocks.deleteError = { message: 'db down' };
    expect(await useTelegramStore.getState().disconnect('tg-1')).toEqual({ ok: false });
    expect(useTelegramStore.getState().connections).toHaveLength(1);
  });

  it('removes both connections only after confirmed deletes', async () => {
    expect(await useSlackStore.getState().disconnect('slack-1')).toEqual({ ok: true });
    expect(await useTelegramStore.getState().disconnect('tg-1')).toEqual({ ok: true });
    expect(useSlackStore.getState().connections).toHaveLength(0);
    expect(useTelegramStore.getState().connections).toHaveLength(0);
  });
});
