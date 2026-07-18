import { create } from 'zustand';
import { supabase } from '@/lib/supabase';
import { useProjectStore } from '@/stores/useProjectStore';
import type {
  Team,
  TeamInvite,
  TeamMember,
  TeamReviewInput,
  TeamSharedProject,
} from '@/stores/types';

export interface InviteDelivery {
  delivery: 'email' | 'link';
  inviteUrl: string;
  warning: string | null;
}

interface SubmitReview {
  teamId: string;
  projectId: string;
  inputType: 'rating' | 'concern' | 'endorsement' | 'alternative';
  rating?: number | null;
  comment?: string;
}

interface TeamState {
  teams: Team[];
  currentTeamId: string | null;
  members: TeamMember[];
  invites: TeamInvite[];
  reviewInputs: TeamReviewInput[];
  reviewHiddenCount: number;
  teamProjects: TeamSharedProject[];
  loadError: string | null;
  busy: boolean;

  loadTeams: () => Promise<void>;
  createTeam: (name: string) => Promise<Team | null>;
  setCurrentTeam: (teamId: string | null) => void;
  loadMembers: (teamId: string) => Promise<void>;
  inviteMember: (teamId: string, email: string, role?: 'admin' | 'member', locale?: 'ko' | 'en') => Promise<InviteDelivery | null>;
  removeMember: (memberId: string) => Promise<boolean>;
  loadInvites: (teamId: string) => Promise<void>;
  acceptInvite: (inviteId: string) => Promise<boolean>;
  declineInvite: (inviteId: string) => Promise<boolean>;
  loadMyInvites: () => Promise<TeamInvite[]>;
  loadTeamProjects: (teamId: string) => Promise<void>;
  shareProject: (teamId: string, projectId: string) => Promise<boolean>;
  unshareProject: (teamId: string, projectId: string) => Promise<boolean>;
  loadReviewInputs: (teamId: string, projectId: string) => Promise<void>;
  submitReviewInput: (input: SubmitReview) => Promise<boolean>;
  revealInputs: (teamId: string, projectId: string) => Promise<boolean>;
  getCurrentTeam: () => Team | undefined;
  isTeamOwner: () => boolean;
  isTeamManager: () => boolean;
}

class TeamApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

async function teamApi<T>(path: string, init: RequestInit = {}): Promise<T> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new TeamApiError('Sign in is required.', 401);
  const response = await fetch(path, {
    ...init,
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...init.headers,
    },
  });
  const payload = await response.json().catch(() => ({})) as { error?: string };
  if (!response.ok) throw new TeamApiError(payload.error || 'Team request failed.', response.status);
  return payload as T;
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : 'Team request failed.';
}

export const useTeamStore = create<TeamState>((set, get) => ({
  teams: [],
  currentTeamId: null,
  members: [],
  invites: [],
  reviewInputs: [],
  reviewHiddenCount: 0,
  teamProjects: [],
  loadError: null,
  busy: false,

  loadTeams: async () => {
    try {
      const { teams } = await teamApi<{ teams: Team[] }>('/api/teams');
      const selected = get().currentTeamId;
      set({
        teams,
        currentTeamId: selected && teams.some((team) => team.id === selected)
          ? selected
          : teams[0]?.id || null,
        loadError: null,
      });
    } catch (error) {
      if (error instanceof TeamApiError && error.status === 401) {
        set({ teams: [], currentTeamId: null, members: [], invites: [], teamProjects: [], loadError: null });
      } else {
        set({ loadError: message(error) });
      }
    }
  },

  createTeam: async (name) => {
    set({ busy: true, loadError: null });
    try {
      const { team } = await teamApi<{ team: Team }>('/api/teams', {
        method: 'POST',
        body: JSON.stringify({ name }),
      });
      set({ teams: [team, ...get().teams], currentTeamId: team.id });
      return team;
    } catch (error) {
      set({ loadError: message(error) });
      return null;
    } finally {
      set({ busy: false });
    }
  },

  setCurrentTeam: (teamId) => set({
    currentTeamId: teamId,
    members: [],
    invites: [],
    teamProjects: [],
    reviewInputs: [],
    reviewHiddenCount: 0,
    loadError: null,
  }),

  loadMembers: async (teamId) => {
    try {
      const result = await teamApi<{ team: Team; members: TeamMember[]; invites: TeamInvite[] }>(`/api/teams/${teamId}`);
      if (get().currentTeamId !== teamId) return;
      set({
        teams: get().teams.map((team) => team.id === teamId ? result.team : team),
        members: result.members,
        invites: result.invites,
        loadError: null,
      });
    } catch (error) {
      if (get().currentTeamId === teamId) set({ members: [], invites: [], loadError: message(error) });
    }
  },

  inviteMember: async (teamId, email, role = 'member', locale = 'en') => {
    set({ busy: true, loadError: null });
    try {
      const result = await teamApi<InviteDelivery>(`/api/teams/${teamId}/invites`, {
        method: 'POST',
        body: JSON.stringify({ email, role, locale }),
      });
      await get().loadMembers(teamId);
      return result;
    } catch (error) {
      set({ loadError: message(error) });
      return null;
    } finally {
      set({ busy: false });
    }
  },

  removeMember: async (memberId) => {
    const teamId = get().currentTeamId;
    if (!teamId) return false;
    try {
      await teamApi(`/api/teams/${teamId}/members/${memberId}`, { method: 'DELETE' });
      set({ members: get().members.filter((member) => member.id !== memberId), loadError: null });
      return true;
    } catch (error) {
      set({ loadError: message(error) });
      return false;
    }
  },

  loadInvites: async (teamId) => get().loadMembers(teamId),

  acceptInvite: async (inviteId) => {
    try {
      await teamApi('/api/teams/invites', {
        method: 'PATCH',
        body: JSON.stringify({ inviteId, action: 'accept' }),
      });
      await get().loadTeams();
      return true;
    } catch (error) {
      set({ loadError: message(error) });
      return false;
    }
  },

  declineInvite: async (inviteId) => {
    try {
      await teamApi('/api/teams/invites', {
        method: 'PATCH',
        body: JSON.stringify({ inviteId, action: 'decline' }),
      });
      return true;
    } catch (error) {
      set({ loadError: message(error) });
      return false;
    }
  },

  loadMyInvites: async () => {
    try {
      const { invites } = await teamApi<{ invites: TeamInvite[] }>('/api/teams/invites');
      return invites;
    } catch (error) {
      if (!(error instanceof TeamApiError && error.status === 401)) set({ loadError: message(error) });
      return [];
    }
  },

  loadTeamProjects: async (teamId) => {
    try {
      const { projects } = await teamApi<{ projects: TeamSharedProject[] }>(`/api/teams/${teamId}/projects`);
      if (get().currentTeamId === teamId) set({ teamProjects: projects, loadError: null });
    } catch (error) {
      if (get().currentTeamId === teamId) set({ teamProjects: [], loadError: message(error) });
    }
  },

  shareProject: async (teamId, projectId) => {
    try {
      await teamApi(`/api/teams/${teamId}/projects`, {
        method: 'POST',
        body: JSON.stringify({ projectId }),
      });
      useProjectStore.getState().updateProject(projectId, { team_id: teamId });
      await get().loadTeamProjects(teamId);
      return true;
    } catch (error) {
      set({ loadError: message(error) });
      return false;
    }
  },

  unshareProject: async (teamId, projectId) => {
    try {
      await teamApi(`/api/teams/${teamId}/projects`, {
        method: 'DELETE',
        body: JSON.stringify({ projectId }),
      });
      useProjectStore.getState().updateProject(projectId, { team_id: undefined });
      set({ teamProjects: get().teamProjects.filter((project) => project.id !== projectId), loadError: null });
      return true;
    } catch (error) {
      set({ loadError: message(error) });
      return false;
    }
  },

  loadReviewInputs: async (teamId, projectId) => {
    try {
      const result = await teamApi<{ inputs: TeamReviewInput[]; hiddenCount: number }>(
        `/api/teams/${teamId}/reviews?projectId=${encodeURIComponent(projectId)}`,
      );
      set({ reviewInputs: result.inputs, reviewHiddenCount: result.hiddenCount, loadError: null });
    } catch (error) {
      set({ reviewInputs: [], reviewHiddenCount: 0, loadError: message(error) });
    }
  },

  submitReviewInput: async ({ teamId, projectId, inputType, rating, comment }) => {
    try {
      const { input } = await teamApi<{ input: TeamReviewInput }>(`/api/teams/${teamId}/reviews`, {
        method: 'POST',
        body: JSON.stringify({ projectId, inputType, rating, comment }),
      });
      set({
        reviewInputs: [...get().reviewInputs, input],
        reviewHiddenCount: get().reviewHiddenCount + 1,
        loadError: null,
      });
      return true;
    } catch (error) {
      set({ loadError: message(error) });
      return false;
    }
  },

  revealInputs: async (teamId, projectId) => {
    try {
      await teamApi(`/api/teams/${teamId}/reviews`, {
        method: 'PATCH',
        body: JSON.stringify({ projectId }),
      });
      await get().loadReviewInputs(teamId, projectId);
      return true;
    } catch (error) {
      set({ loadError: message(error) });
      return false;
    }
  },

  getCurrentTeam: () => get().teams.find((team) => team.id === get().currentTeamId),
  isTeamOwner: () => get().getCurrentTeam()?.my_role === 'owner',
  isTeamManager: () => ['owner', 'admin'].includes(get().getCurrentTeam()?.my_role || ''),
}));
