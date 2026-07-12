import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  memberInsertError: null as { message: string } | null,
  deleteError: null as { message: string } | null,
  deletedTables: [] as string[],
}));

vi.mock('@/lib/supabase', () => ({
  getCurrentUserId: () => Promise.resolve('user-1'),
  supabase: {
    auth: { getUser: () => Promise.resolve({ data: { user: { email: 'user@example.com' } } }) },
    from: (table: string) => ({
      insert: () => table === 'teams'
        ? { select: () => ({ single: () => Promise.resolve({ data: { id: 'team-1', name: 'Team', slug: 'team', owner_id: 'user-1', created_at: '2026-01-01' }, error: null }) }) }
        : Promise.resolve({ error: mocks.memberInsertError }),
      delete: () => {
        mocks.deletedTables.push(table);
        return { eq: () => ({ eq: () => Promise.resolve({ error: mocks.deleteError }) }) };
      },
    }),
  },
}));

import { useTeamStore } from '../useTeamStore';

describe('team multi-write consistency', () => {
  beforeEach(() => {
    mocks.memberInsertError = null;
    mocks.deleteError = null;
    mocks.deletedTables = [];
    useTeamStore.setState({
      teams: [], currentTeamId: null, members: [], invites: [], reviewInputs: [],
    });
  });

  it('compensates the team row when owner membership creation fails', async () => {
    mocks.memberInsertError = { message: 'membership failed' };
    const result = await useTeamStore.getState().createTeam('Team');
    expect(result).toBeNull();
    expect(mocks.deletedTables).toContain('teams');
    expect(useTeamStore.getState().teams).toHaveLength(0);
  });

  it('keeps a member visible when the server delete fails', async () => {
    mocks.deleteError = { message: 'delete failed' };
    useTeamStore.setState({
      currentTeamId: 'team-1',
      members: [{ id: 'member-1', team_id: 'team-1', user_id: 'user-2', role: 'member', created_at: '2026-01-01' }],
      _isAdminOrOwner: async () => true,
    });
    expect(await useTeamStore.getState().removeMember('member-1')).toBe(false);
    expect(useTeamStore.getState().members).toHaveLength(1);
  });
});
