import { create } from 'zustand';
import type { Team, TeamMember, TeamInvite, TeamReviewInput } from '@/stores/types';
import { supabase, getCurrentUserId } from '@/lib/supabase';

interface TeamState {
  teams: Team[];
  currentTeamId: string | null;
  members: TeamMember[];
  invites: TeamInvite[];
  reviewInputs: TeamReviewInput[];
  loadError: boolean;

  // Team management
  loadTeams: () => Promise<void>;
  createTeam: (name: string) => Promise<Team | null>;
  setCurrentTeam: (teamId: string | null) => void;

  // Members
  loadMembers: (teamId: string) => Promise<void>;
  inviteMember: (teamId: string, email: string, role?: 'admin' | 'member') => Promise<boolean>;
  removeMember: (memberId: string) => Promise<boolean>;

  // Invites
  loadInvites: (teamId: string) => Promise<void>;
  acceptInvite: (inviteId: string) => Promise<boolean>;
  declineInvite: (inviteId: string) => Promise<boolean>;
  loadMyInvites: () => Promise<TeamInvite[]>;

  // Review inputs (structured team feedback)
  loadReviewInputs: (projectId: string) => Promise<void>;
  submitReviewInput: (input: Omit<TeamReviewInput, 'id' | 'created_at' | 'visible'>) => Promise<void>;
  revealInputs: (projectId: string, phase: string) => Promise<void>;

  // Helpers
  getCurrentTeam: () => Team | undefined;
  isTeamOwner: () => boolean;
  _isAdminOrOwner: (teamId?: string) => Promise<boolean>;
}

export const useTeamStore = create<TeamState>((set, get) => ({
  teams: [],
  currentTeamId: null,
  members: [],
  invites: [],
  reviewInputs: [],
  loadError: false,

  loadTeams: async () => {
    const userId = await getCurrentUserId();
    if (!userId) {
      // 로그아웃/무인증 상태 → 이전 사용자 데이터 정리
      set({ teams: [], currentTeamId: null, members: [], invites: [], reviewInputs: [], loadError: false });
      return;
    }

    // Load only teams where user is a member (defense-in-depth; RLS also enforces)
    const { data: memberRows, error: membershipError } = await supabase
      .from('team_members')
      .select('team_id')
      .eq('user_id', userId);
    if (membershipError) { set({ loadError: true }); return; }

    const teamIds = (memberRows || []).map(r => r.team_id);
    if (teamIds.length === 0) { set({ teams: [], loadError: false }); return; }

    const { data, error: teamsError } = await supabase
      .from('teams')
      .select('*')
      .in('id', teamIds)
      .order('created_at', { ascending: false });

    if (teamsError) { set({ loadError: true }); return; }
    if (data) set({ teams: data, loadError: false });
  },

  createTeam: async (name: string) => {
    const userId = await getCurrentUserId();
    if (!userId) return null;


    const slug = name.toLowerCase().replace(/[^a-z0-9가-힣]/g, '-').replace(/-+/g, '-').slice(0, 30);

    const { data: team, error } = await supabase
      .from('teams')
      .insert({ name, slug, owner_id: userId })
      .select()
      .single();

    if (error || !team) return null;

    // Add creator as owner member
    const { error: memberError } = await supabase
      .from('team_members')
      .insert({ team_id: team.id, user_id: userId, role: 'owner' });

    if (memberError) {
      await supabase.from('teams').delete().eq('id', team.id).eq('owner_id', userId);
      return null;
    }

    set({ teams: [team, ...get().teams], currentTeamId: team.id, loadError: false });
    return team;
  },

  setCurrentTeam: (teamId) => set({ currentTeamId: teamId }),

  loadMembers: async (teamId: string) => {
    const userId = await getCurrentUserId();
    if (!userId) return;

    // Verify user is a member of this team before loading (defense-in-depth; RLS also enforces)
    const { data: self } = await supabase
      .from('team_members')
      .select('id')
      .eq('team_id', teamId)
      .eq('user_id', userId)
      .limit(1)
      .single();

    if (!self) { set({ members: [] }); return; }

    const { data } = await supabase
      .from('team_members')
      .select('*')
      .eq('team_id', teamId)
      .order('created_at');

    // 응답 역전 방지: 요청한 teamId와 현재 선택 팀이 일치할 때만 반영
    if (data && get().currentTeamId === teamId) set({ members: data });
  },

  inviteMember: async (teamId: string, email: string, role = 'member') => {
    const userId = await getCurrentUserId();
    if (!userId) return false;

    // Client-side permission guard (RLS is the real enforcer)
    if (!await get()._isAdminOrOwner(teamId)) return false;

    // Validate role to prevent privilege escalation
    const ALLOWED_INVITE_ROLES = ['member', 'admin'] as const;
    const safeRole = ALLOWED_INVITE_ROLES.includes(role as typeof ALLOWED_INVITE_ROLES[number]) ? role : 'member';

    const { error } = await supabase
      .from('team_invites')
      .insert({ team_id: teamId, email: email.toLowerCase().trim(), role: safeRole, invited_by: userId });

    if (error) return false;

    // Reload invites
    await get().loadInvites(teamId);
    return true;
  },

  removeMember: async (memberId: string) => {
    // Client-side permission guard (RLS is the real enforcer)
    if (!await get()._isAdminOrOwner()) return false;

    const { currentTeamId } = get();
    if (!currentTeamId) return false;

    // Scope deletion to current team to prevent IDOR across teams
    const { error } = await supabase.from('team_members').delete().eq('id', memberId).eq('team_id', currentTeamId);
    if (error) return false;
    set({ members: get().members.filter(m => m.id !== memberId) });
    return true;
  },

  loadInvites: async (teamId: string) => {
    // Only admin/owner should see invites — client guard (RLS also enforces)
    if (!await get()._isAdminOrOwner()) { set({ invites: [] }); return; }

    const { data } = await supabase
      .from('team_invites')
      .select('*')
      .eq('team_id', teamId)
      .order('created_at', { ascending: false });

    if (data) set({ invites: data });
  },

  acceptInvite: async (inviteId: string) => {
    const userId = await getCurrentUserId();
    if (!userId) return false;

    // Get the invite
    const { data: invite } = await supabase
      .from('team_invites')
      .select('*')
      .eq('id', inviteId)
      .single();

    if (!invite) return false;

    // Verify invite is addressed to current user's email (defense-in-depth; RLS also checks)
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.email || invite.email.toLowerCase() !== user.email.toLowerCase()) {
      return false;
    }

    // Add as team member
    const { error: memberError } = await supabase
      .from('team_members')
      .insert({ team_id: invite.team_id, user_id: userId, role: invite.role });

    if (memberError) return false;

    // Update invite status
    const { error: inviteUpdateError } = await supabase
      .from('team_invites')
      .update({ status: 'accepted' })
      .eq('id', inviteId);

    if (inviteUpdateError) {
      await supabase
        .from('team_members')
        .delete()
        .eq('team_id', invite.team_id)
        .eq('user_id', userId);
      return false;
    }

    // Reload teams
    await get().loadTeams();
    return true;
  },

  declineInvite: async (inviteId: string) => {
    const { error } = await supabase
      .from('team_invites')
      .update({ status: 'declined' })
      .eq('id', inviteId);
    return !error;
  },

  loadMyInvites: async () => {
    // Only load invites addressed to current user's email
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.email) return [];

    const { data } = await supabase
      .from('team_invites')
      .select('*')
      .eq('status', 'pending')
      .eq('email', user.email.toLowerCase())
      .order('created_at', { ascending: false });

    return data || [];
  },

  // ── Review Inputs (Structured Team Feedback) ──

  loadReviewInputs: async (projectId: string) => {
    const userId = await getCurrentUserId();
    if (!userId) return;

    const { data } = await supabase
      .from('team_review_inputs')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at');

    if (data) set({ reviewInputs: data });
  },

  submitReviewInput: async (input) => {
    const userId = await getCurrentUserId();
    if (!userId) return;

    // Strip client-controlled fields; force user_id from auth, visible always starts false
    const { user_id: _uid, visible: _vis, created_at: _ca, ...safeInput } = input as Record<string, unknown>;

    const { data, error } = await supabase
      .from('team_review_inputs')
      .insert({ ...safeInput, user_id: userId, visible: false })
      .select()
      .single();

    if (data && !error) {
      set({ reviewInputs: [...get().reviewInputs, data] });
    }
  },

  revealInputs: async (projectId: string, phase: string) => {
    // Client-side permission guard (RLS is the real enforcer)
    if (!await get()._isAdminOrOwner()) return;

    await supabase
      .from('team_review_inputs')
      .update({ visible: true })
      .eq('project_id', projectId)
      .eq('phase', phase);

    // Reload to get all visible inputs
    await get().loadReviewInputs(projectId);
  },

  // ── Helpers ──

  getCurrentTeam: () => {
    const { teams, currentTeamId } = get();
    return teams.find(t => t.id === currentTeamId);
  },

  isTeamOwner: () => {
    const { members, currentTeamId } = get();
    if (!currentTeamId) return false;
    return members.some(m => m.team_id === currentTeamId && m.role === 'owner');
  },

  /** Check if current user is admin or owner of the specified (or current) team. */
  _isAdminOrOwner: async (teamId?: string) => {
    const userId = await getCurrentUserId();
    const { members, currentTeamId } = get();
    const targetTeamId = teamId || currentTeamId;
    if (!userId || !targetTeamId) return false;
    return members.some(
      m => m.team_id === targetTeamId && m.user_id === userId && (m.role === 'owner' || m.role === 'admin')
    );
  },
}));
