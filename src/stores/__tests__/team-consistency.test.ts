import { beforeEach, describe, expect, it, vi } from 'vitest';

const fetchMock = vi.fn();

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: () => Promise.resolve({ data: { session: { access_token: 'test-token' } } }),
    },
  },
}));

vi.mock('@/stores/useProjectStore', () => ({
  useProjectStore: {
    getState: () => ({ updateProject: vi.fn() }),
  },
}));

import { useTeamStore } from '../useTeamStore';

function response(status: number, body: Record<string, unknown>) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  });
}

describe('team API state consistency', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
    useTeamStore.setState({
      teams: [],
      currentTeamId: null,
      members: [],
      invites: [],
      reviewInputs: [],
      reviewHiddenCount: 0,
      teamProjects: [],
      loadError: null,
      busy: false,
    });
  });

  it('does not mutate the team list when atomic creation fails', async () => {
    fetchMock.mockReturnValue(response(500, { error: 'membership failed' }));
    const result = await useTeamStore.getState().createTeam('Team');
    expect(result).toBeNull();
    expect(useTeamStore.getState().teams).toHaveLength(0);
  });

  it('keeps a member visible when deletion fails', async () => {
    fetchMock.mockReturnValue(response(500, { error: 'delete failed' }));
    useTeamStore.setState({
      currentTeamId: 'team-1',
      members: [{ id: 'member-1', team_id: 'team-1', user_id: 'user-2', role: 'member', created_at: '2026-01-01' }],
    });
    expect(await useTeamStore.getState().removeMember('member-1')).toBe(false);
    expect(useTeamStore.getState().members).toHaveLength(1);
  });

  it('keeps hidden team feedback private while exposing the aggregate count', async () => {
    fetchMock.mockReturnValue(response(200, {
      inputs: [{
        id: 'review-1',
        project_id: 'project-1',
        user_id: 'user-1',
        phase: 'rehearse',
        target_type: 'general',
        target_id: null,
        input_type: 'concern',
        rating: 3,
        comment: 'Need evidence',
        visible: false,
        created_at: '2026-01-01',
        user_name: 'Me',
      }],
      hiddenCount: 4,
    }));
    await useTeamStore.getState().loadReviewInputs('team-1', 'project-1');
    expect(useTeamStore.getState().reviewInputs).toHaveLength(1);
    expect(useTeamStore.getState().reviewHiddenCount).toBe(4);
  });
});
