'use client';

import { useEffect, useState } from 'react';
import type { TeamInvite } from '@/stores/types';
import { useTeamStore } from '@/stores/useTeamStore';
import { ChartPlate } from '@/components/ui/ChartPlate';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Plus, Users, Mail, Check, X, Crown, Shield, User, Trash2 } from 'lucide-react';
import { useLocale } from '@/hooks/useLocale';

export default function TeamsPage() {
  const locale = useLocale();
  const L = (ko: string, en: string) => locale === 'ko' ? ko : en;
  const {
    teams, members, invites, currentTeamId,
    loadTeams, createTeam, setCurrentTeam,
    loadMembers, inviteMember, removeMember,
    loadInvites, loadMyInvites, acceptInvite, declineInvite,
  } = useTeamStore();

  const [showCreate, setShowCreate] = useState(false);
  const [newTeamName, setNewTeamName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'member' | 'admin'>('member');
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteSuccess, setInviteSuccess] = useState('');
  const [inviteError, setInviteError] = useState('');
  const [myInvites, setMyInvites] = useState<TeamInvite[]>([]);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    loadTeams();
    loadMyInvites().then(setMyInvites);
  }, [loadTeams, loadMyInvites]);

  useEffect(() => {
    if (currentTeamId) {
      // loadInvites checks admin/owner against the members list — load members
      // first, or the check runs against an empty list on first selection.
      loadMembers(currentTeamId).then(() => loadInvites(currentTeamId));
    }
  }, [currentTeamId, loadMembers, loadInvites]);

  const currentTeam = teams.find(t => t.id === currentTeamId);

  const handleCreateTeam = async () => {
    if (!newTeamName.trim()) return;
    setCreating(true);
    await createTeam(newTeamName.trim());
    setNewTeamName('');
    setShowCreate(false);
    setCreating(false);
  };

  const handleInvite = async () => {
    if (!inviteEmail.trim() || !currentTeamId) return;
    setInviteLoading(true);
    const ok = await inviteMember(currentTeamId, inviteEmail.trim(), inviteRole);
    setInviteLoading(false);
    if (ok) {
      setInviteSuccess(inviteEmail.trim());
      setInviteError('');
      setInviteEmail('');
      setTimeout(() => setInviteSuccess(''), 3000);
    } else {
      setInviteError(L('초대를 보내지 못했어요. 이메일을 확인해 주세요.', "Couldn't send the invite. Please check the email address."));
      setTimeout(() => setInviteError(''), 4000);
    }
  };

  const handleAcceptInvite = async (inviteId: string) => {
    const ok = await acceptInvite(inviteId);
    if (ok) {
      setMyInvites(prev => prev.filter(i => i.id !== inviteId));
    }
  };

  const roleIcon = (role: string) => {
    if (role === 'owner') return <Crown size={12} className="text-[var(--gold)]" />;
    if (role === 'admin') return <Shield size={12} className="text-[var(--accent)]" />;
    return <User size={12} className="text-[var(--text-tertiary)]" />;
  };

  const roleLabel = (role: string) => {
    if (role === 'owner') return 'Owner';
    if (role === 'admin') return 'Admin';
    return 'Member';
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-8">
      <div>
        <h1 className="text-[22px] font-bold tracking-tight text-[var(--text-primary)]">{L('팀', 'Teams')}</h1>
        <p className="text-[13px] text-[var(--text-secondary)] mt-1">
          {L('팀원과 함께 결정을 내려요.', 'Make decisions together with your team.')}
        </p>
      </div>

      {/* ── Incoming invites ── */}
      {myInvites.length > 0 && (
        <div className="space-y-2">
          <p className="text-[12px] font-semibold text-[var(--accent)]">
            {L(`받은 초대 ${myInvites.length}건`, `${myInvites.length} invite${myInvites.length === 1 ? '' : 's'}`)}
          </p>
          {myInvites.map((invite) => (
            <div key={invite.id} className="flex items-center justify-between p-3 rounded-xl border border-[var(--accent)] bg-[var(--ai)]">
              <div>
                <p className="text-[13px] font-medium text-[var(--text-primary)]">
                  {L('팀 초대', 'Team invite')}
                </p>
                <p className="text-[12px] text-[var(--text-secondary)]">
                  {L(`${invite.role === 'admin' ? 'Admin' : 'Member'}으로 초대됨`, `Invited as ${invite.role === 'admin' ? 'Admin' : 'Member'}`)}
                </p>
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={() => handleAcceptInvite(invite.id)}>
                  <Check size={12} /> {L('수락', 'Accept')}
                </Button>
                <Button variant="secondary" size="sm" onClick={async () => {
                  const ok = await declineInvite(invite.id);
                  if (ok) setMyInvites(prev => prev.filter(i => i.id !== invite.id));
                }}>
                  <X size={12} />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Team list ── */}
      <div className="space-y-3">
        {teams.length === 0 && !showCreate ? (
          <ChartPlate label={L('정박지 없음 · NO PORT', 'NO PORT')}>
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center bg-[var(--bp-ink)]/[0.06] border border-[var(--bp-ink)]/15">
              <Users size={22} className="text-[var(--bp-ink-soft)]" />
            </div>
            <div className="w-20 h-px bg-[var(--bp-ink)]/20 my-5" />
            <p className="text-[19px] md:text-[20px] font-bold text-[var(--bp-ink)] tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>{L('아직 팀이 없어요', 'No teams yet')}</p>
            <p className="mt-2 text-[13px] leading-[1.7] text-[var(--bp-ink-soft)] max-w-xs">
              {L('팀을 만들면 프로젝트를 공유하고, 팀원들의 피드백을 받을 수 있어요.', 'Make a team to share projects and get your teammates’ feedback.')}
            </p>
            <div className="mt-6">
              <Button variant="accent" onClick={() => setShowCreate(true)}>
                <Plus size={14} /> {L('첫 팀 만들기', 'Create your first team')}
              </Button>
            </div>
          </ChartPlate>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <p className="text-[12px] font-semibold text-[var(--text-secondary)]">{L('내 팀', 'My teams')}</p>
              <Button variant="secondary" size="sm" onClick={() => setShowCreate(true)}>
                <Plus size={12} /> {L('새 팀', 'New team')}
              </Button>
            </div>
            {teams.map((team) => (
              <div
                key={team.id}
                onClick={() => setCurrentTeam(team.id)}
                className={`p-4 rounded-xl border cursor-pointer transition-all duration-200 ${
                  currentTeamId === team.id
                    ? 'border-[var(--accent)] bg-[var(--ai)] shadow-sm'
                    : 'border-[var(--border-subtle)] hover:border-[var(--border)]'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-[var(--accent)] flex items-center justify-center text-white text-[14px] font-bold">
                      {team.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-[14px] font-semibold text-[var(--text-primary)]">{team.name}</p>
                      <p className="text-[11px] text-[var(--text-tertiary)]">
                        {team.slug}
                      </p>
                    </div>
                  </div>
                  {currentTeamId === team.id && (
                    <Badge variant="ai">{L('선택됨', 'Selected')}</Badge>
                  )}
                </div>
              </div>
            ))}
          </>
        )}
      </div>

      {/* ── Team create modal ── */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title={L('새 팀 만들기', 'Create a new team')}>
        <div className="space-y-4">
          <div>
            <label className="block text-[12px] font-medium text-[var(--text-secondary)] mb-1.5">{L('팀 이름', 'Team name')}</label>
            <input
              type="text"
              value={newTeamName}
              onChange={(e) => setNewTeamName(e.target.value)}
              placeholder={L('전략기획팀', 'Strategy team')}
              maxLength={50}
              className="w-full px-3 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[14px] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:border-[var(--accent)]"
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && handleCreateTeam()}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setShowCreate(false)}>{L('취소', 'Cancel')}</Button>
            <Button onClick={handleCreateTeam} disabled={!newTeamName.trim() || creating}>
              {creating ? L('생성 중...', 'Creating...') : L('팀 만들기', 'Create team')}
            </Button>
          </div>
        </div>
      </Modal>

      {/* ── Selected team detail ── */}
      {currentTeam && (
        <div className="space-y-6 animate-fade-in">
          {/* Members */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-[14px] font-bold text-[var(--text-primary)]">{L('멤버', 'Members')}</p>
              <span className="text-[12px] text-[var(--text-tertiary)]">
                {L(`${members.length}명`, `${members.length} member${members.length === 1 ? '' : 's'}`)}
              </span>
            </div>
            <div className="space-y-1.5">
              {members.map((member) => (
                <div key={member.id} className="flex items-center justify-between px-3 py-2.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)]">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-full bg-[var(--bg)] flex items-center justify-center">
                      {roleIcon(member.role)}
                    </div>
                    <div>
                      <p className="text-[13px] font-medium text-[var(--text-primary)]">
                        {member.email || L('멤버 (초대됨)', 'Member (invited)')}
                      </p>
                      <p className="text-[11px] text-[var(--text-tertiary)]">{roleLabel(member.role)}</p>
                    </div>
                  </div>
                  {member.role !== 'owner' && (
                    <button
                      onClick={() => removeMember(member.id)}
                      className="p-1.5 rounded-lg text-[var(--text-tertiary)] hover:text-red-500 hover:bg-red-50 transition-colors cursor-pointer"
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Invite */}
          <div>
            <p className="text-[14px] font-bold text-[var(--text-primary)] mb-3">{L('팀원 초대', 'Invite teammates')}</p>
            <div className="flex gap-2">
              <input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="teammate@company.com"
                maxLength={254}
                className="flex-1 px-3 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:border-[var(--accent)]"
                onKeyDown={(e) => e.key === 'Enter' && handleInvite()}
              />
              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value as 'member' | 'admin')}
                className="px-3 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[13px] text-[var(--text-primary)] focus:outline-none"
              >
                <option value="member">Member</option>
                <option value="admin">Admin</option>
              </select>
              <Button onClick={handleInvite} disabled={inviteLoading || !inviteEmail.trim()}>
                <Mail size={14} /> {L('초대', 'Invite')}
              </Button>
            </div>
            {inviteSuccess && (
              <p className="text-[12px] text-[var(--success)] mt-2 flex items-center gap-1">
                <Check size={12} /> {L(`${inviteSuccess}님의 초대를 기록했어요 — 상대에게 이 페이지 링크를 직접 전달해 주세요.`, `Invite recorded for ${inviteSuccess} — share this page's link with them directly.`)}
              </p>
            )}
            {inviteError && (
              <p className="text-[12px] text-red-500 mt-2 flex items-center gap-1">
                <X size={12} /> {inviteError}
              </p>
            )}
          </div>

          {/* Pending invites */}
          {invites.filter(i => i.status === 'pending').length > 0 && (
            <div>
              <p className="text-[12px] font-semibold text-[var(--text-secondary)] mb-2">{L('대기 중인 초대', 'Pending invites')}</p>
              <div className="space-y-1.5">
                {invites.filter(i => i.status === 'pending').map((invite) => (
                  <div key={invite.id} className="flex items-center justify-between px-3 py-2 rounded-lg border border-dashed border-[var(--border)] text-[12px]">
                    <div className="flex items-center gap-2">
                      <Mail size={12} className="text-[var(--text-tertiary)]" />
                      <span className="text-[var(--text-primary)]">{invite.email}</span>
                      <Badge variant="default">{invite.role}</Badge>
                    </div>
                    <span className="text-[var(--text-tertiary)]">{L('대기 중', 'Pending')}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
