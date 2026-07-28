'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  Check,
  ChevronDown,
  ChevronUp,
  Mail,
  Plus,
  Copy,
  RefreshCw,
  Send,
  Trash2,
  UserRound,
  UsersRound,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { LocaleLink } from '@/components/ui/LocaleLink';
import { Modal } from '@/components/ui/Modal';
import { useLocale } from '@/hooks/useLocale';
import { deriveCurrentBearing } from '@/lib/current-bearing';
import { useProjectStore } from '@/stores/useProjectStore';
import type { TeamInvite, TeamSharedProject } from '@/stores/types';
import { useTeamStore } from '@/stores/useTeamStore';

type ReviewKind = 'concern' | 'endorsement' | 'alternative';

export default function TeamsPage() {
  const locale = useLocale();
  const L = (ko: string, en: string) => locale === 'ko' ? ko : en;
  const projects = useProjectStore((state) => state.projects);
  const loadProjects = useProjectStore((state) => state.loadProjects);
  const {
    teams,
    currentTeamId,
    members,
    invites,
    teamProjects,
    reviewInputs,
    reviewHiddenCount,
    loadError,
    busy,
    loadTeams,
    createTeam,
    setCurrentTeam,
    loadMembers,
    inviteMember,
    removeMember,
    loadMyInvites,
    acceptInvite,
    declineInvite,
    loadTeamProjects,
    shareProject,
    unshareProject,
    loadReviewInputs,
    submitReviewInput,
    revealInputs,
    isTeamManager,
  } = useTeamStore();

  const [myInvites, setMyInvites] = useState<TeamInvite[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [teamName, setTeamName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'member' | 'admin'>('member');
  const [shareProjectId, setShareProjectId] = useState('');
  const [expandedProjectId, setExpandedProjectId] = useState<string | null>(null);
  const [reviewKind, setReviewKind] = useState<ReviewKind>('concern');
  const [reviewRating, setReviewRating] = useState<number | null>(null);
  const [reviewComment, setReviewComment] = useState('');
  const [notice, setNotice] = useState('');
  const [initialLoading, setInitialLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [inviteLink, setInviteLink] = useState('');

  useEffect(() => {
    let active = true;
    loadProjects();
    setInitialLoading(true);
    void (async () => {
      try {
        // Keep reads ordered so a later successful request cannot erase an
        // earlier failure while the page still shows incomplete data.
        await loadTeams();
        const pending = await loadMyInvites();
        if (active) setMyInvites(pending);
      } finally {
        if (active) setInitialLoading(false);
      }
    })();
    return () => { active = false; };
  }, [loadMyInvites, loadProjects, loadTeams]);

  useEffect(() => {
    if (!currentTeamId) {
      setDetailLoading(false);
      return;
    }
    let active = true;
    setDetailLoading(true);
    void Promise.all([loadMembers(currentTeamId), loadTeamProjects(currentTeamId)])
      .finally(() => { if (active) setDetailLoading(false); });
    setExpandedProjectId(null);
    return () => { active = false; };
  }, [currentTeamId, loadMembers, loadTeamProjects]);

  const currentTeam = teams.find((team) => team.id === currentTeamId);
  const manager = isTeamManager();
  const ownProjectIds = useMemo(() => new Set(projects.map((project) => project.id)), [projects]);
  const shareCandidates = projects.filter((project) => !project.team_id && !teamProjects.some((shared) => shared.id === project.id));

  async function retryTeamData() {
    setInitialLoading(true);
    try {
      await loadTeams();
      const pending = await loadMyInvites();
      setMyInvites(pending);
      const selected = useTeamStore.getState().currentTeamId;
      if (selected) {
        setDetailLoading(true);
        await Promise.all([loadMembers(selected), loadTeamProjects(selected)]);
      }
    } finally {
      setDetailLoading(false);
      setInitialLoading(false);
    }
  }

  async function copyInviteLink(url: string) {
    try {
      if (!navigator.clipboard?.writeText) throw new Error('clipboard unavailable');
      await navigator.clipboard.writeText(url);
      setInviteLink('');
      setNotice(L('초대 링크를 복사했어요.', 'Invitation link copied.'));
      return true;
    } catch {
      setInviteLink(url);
      setNotice(L('초대는 저장했지만 링크를 자동으로 복사하지 못했어요.', 'The invitation was saved, but the link could not be copied automatically.'));
      return false;
    }
  }

  async function handleCreate() {
    if (!teamName.trim()) return;
    const team = await createTeam(teamName.trim());
    if (!team) return;
    setTeamName('');
    setCreateOpen(false);
    setNotice(L('팀을 만들었어요.', 'Team created.'));
  }

  async function handleInvite() {
    if (!currentTeamId || !inviteEmail.trim()) return;
    setInviteLink('');
    const result = await inviteMember(currentTeamId, inviteEmail, inviteRole, locale);
    if (!result) return;
    setInviteEmail('');
    if (result.delivery === 'email') {
      setNotice(L('초대 메일을 보냈어요.', 'Invitation email sent.'));
    } else {
      await copyInviteLink(result.inviteUrl);
    }
  }

  async function handleShare() {
    if (!currentTeamId || !shareProjectId) return;
    if (await shareProject(currentTeamId, shareProjectId)) {
      setShareProjectId('');
      setNotice(L('결정을 팀에 공유했어요.', 'Decision shared with the team.'));
    }
  }

  async function toggleProject(project: TeamSharedProject) {
    const next = expandedProjectId === project.id ? null : project.id;
    setExpandedProjectId(next);
    if (next && currentTeamId) await loadReviewInputs(currentTeamId, project.id);
  }

  async function handleReview(projectId: string) {
    if (!currentTeamId || (!reviewRating && !reviewComment.trim())) return;
    const ok = await submitReviewInput({
      teamId: currentTeamId,
      projectId,
      inputType: reviewKind,
      rating: reviewRating,
      comment: reviewComment,
    });
    if (!ok) return;
    setReviewRating(null);
    setReviewComment('');
    setNotice(L('의견을 따로 보관했어요. 관리자가 공개하기 전까지 다른 팀원에게 보이지 않아요.', 'Feedback saved privately. Other teammates cannot see it until a manager publishes the round.'));
  }

  return (
    <div className="mx-auto w-full min-w-0 max-w-5xl pb-16">
      <LocaleLink href="/workspace" className="inline-flex min-h-11 items-center gap-1.5 text-[13px] font-medium text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]">
        <ArrowLeft size={14} aria-hidden="true" />
        {L('워크스페이스로', 'Back to workspace')}
      </LocaleLink>

      <header className="mt-5 max-w-2xl">
        <p className="text-[12.5px] font-semibold tracking-[0.12em] text-[var(--accent)]">{L('사람과 함께 검토', 'REVIEW WITH PEOPLE')}</p>
        <h1 className="mt-2 text-[28px] font-bold tracking-[-0.035em] text-[var(--text-primary)]">{L('팀의 시선을 한곳에 모으세요', 'Bring the team’s perspectives together')}</h1>
        <p className="mt-2 text-[14px] leading-7 text-[var(--text-secondary)]">
          {L('결정을 공유하고, 서로의 답을 보기 전에 각자 의견을 남긴 뒤 한꺼번에 공개할 수 있어요. AI 검토자와 달리 이곳의 팀은 초대한 실제 사람들입니다.', 'Share a decision, let each person respond independently, then publish the round together. Unlike AI reviewers, these teams are made of people you invite.')}
        </p>
      </header>

      {notice && (
        <div className="mt-6 flex items-start justify-between gap-3 border-y border-[var(--border-subtle)] py-3 text-[13px] text-[var(--text-secondary)]" role="status">
          <span className="flex min-w-0 items-start gap-2 break-words"><Check size={14} className="mt-0.5 shrink-0 text-[var(--success)]" aria-hidden="true" />{notice}</span>
          <button type="button" onClick={() => setNotice('')} className="min-h-8 min-w-8 text-[var(--text-tertiary)]" aria-label={L('알림 닫기', 'Dismiss notice')}><X size={14} /></button>
        </div>
      )}
      {inviteLink && (
        <div className="mt-3 rounded-xl border border-[var(--warning)]/30 bg-[var(--warning)]/10 p-3" role="status">
          <label htmlFor="team-invite-link" className="text-[12px] font-semibold text-[var(--text-primary)]">{L('직접 복사할 초대 링크', 'Invitation link to copy manually')}</label>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row">
            <input id="team-invite-link" readOnly value={inviteLink} onFocus={(event) => event.currentTarget.select()} className="min-h-11 min-w-0 flex-1 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 text-[12px] text-[var(--text-secondary)]" />
            <Button size="sm" variant="secondary" onClick={() => void copyInviteLink(inviteLink)}><Copy size={13} aria-hidden="true" />{L('다시 복사', 'Copy again')}</Button>
          </div>
        </div>
      )}
      {loadError && (
        <div className="mt-4 flex flex-col items-start justify-between gap-3 border-y border-[var(--danger)]/25 py-3 text-[13px] text-[var(--danger)] sm:flex-row sm:items-center" role="alert">
          <p className="min-w-0 break-words">{L('요청을 처리하지 못했어요. 연결을 확인하고 다시 시도해 주세요.', 'The request could not be completed. Check your connection and try again.')}</p>
          <Button size="sm" variant="secondary" disabled={initialLoading} onClick={() => void retryTeamData()}><RefreshCw size={13} className={initialLoading ? 'animate-spin motion-reduce:animate-none' : ''} aria-hidden="true" />{L('다시 불러오기', 'Try again')}</Button>
        </div>
      )}

      {myInvites.length > 0 && (
        <section className="mt-8 border-y border-[var(--border)] py-4" aria-labelledby="incoming-heading">
          <div className="flex items-baseline justify-between gap-4">
            <h2 id="incoming-heading" className="text-[14px] font-bold text-[var(--text-primary)]">{L('받은 초대', 'Invitations')}</h2>
            <span className="text-[12px] text-[var(--text-tertiary)]">{myInvites.length}</span>
          </div>
          <div className="mt-2 divide-y divide-[var(--border-subtle)]">
            {myInvites.map((invite) => (
              <div key={invite.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <p className="[overflow-wrap:anywhere] text-[14px] font-semibold text-[var(--text-primary)]">{invite.team_name || L('이름 없는 팀', 'Unnamed team')}</p>
                  <p className="mt-0.5 text-[12px] text-[var(--text-tertiary)]">{invite.role === 'admin' ? L('관리자로 초대됨', 'Invited as manager') : L('멤버로 초대됨', 'Invited as member')}</p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={async () => {
                    if (await acceptInvite(invite.id)) setMyInvites((list) => list.filter((item) => item.id !== invite.id));
                  }}>{L('참여', 'Join')}</Button>
                  <Button size="sm" variant="ghost" onClick={async () => {
                    if (await declineInvite(invite.id)) setMyInvites((list) => list.filter((item) => item.id !== invite.id));
                  }}>{L('거절', 'Decline')}</Button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="mt-10" aria-labelledby="team-list-heading">
        <div className="flex items-center justify-between gap-4">
          <h2 id="team-list-heading" className="text-[13px] font-bold text-[var(--text-primary)]">{L('내 팀', 'My teams')}</h2>
          <button type="button" onClick={() => setCreateOpen(true)} className="inline-flex min-h-11 items-center gap-1.5 text-[13px] font-semibold text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]">
            <Plus size={14} aria-hidden="true" /> {L('새 팀', 'New team')}
          </button>
        </div>

        {initialLoading ? (
          <div className="mt-3 border-y border-[var(--border)] py-8" role="status" aria-live="polite" aria-label={L('팀을 불러오는 중', 'Loading teams')}>
            <div className="mx-auto max-w-md space-y-3" aria-hidden="true">
              <div className="h-4 w-2/5 animate-pulse motion-reduce:animate-none rounded bg-[var(--border-subtle)]" />
              <div className="h-12 animate-pulse motion-reduce:animate-none rounded-xl bg-[var(--surface)]" />
              <div className="h-12 animate-pulse motion-reduce:animate-none rounded-xl bg-[var(--surface)]" />
            </div>
          </div>
        ) : teams.length === 0 && !loadError ? (
          <div className="mt-3 border-y border-[var(--border)] py-10 text-center">
            <UsersRound size={26} className="mx-auto text-[var(--text-tertiary)]" aria-hidden="true" />
            <p className="mt-3 text-[15px] font-semibold text-[var(--text-primary)]">{L('아직 만든 팀이 없어요', 'No team yet')}</p>
            <p className="mx-auto mt-1 max-w-md text-[13px] leading-6 text-[var(--text-secondary)]">{L('함께 결정을 검토할 사람을 초대해 보세요. 팀을 만든 뒤 기존 결정을 선택해 공유할 수 있어요.', 'Invite people who should review decisions with you. Once the team exists, choose an existing decision to share.')}</p>
            <Button className="mt-5" onClick={() => setCreateOpen(true)}><Plus size={14} />{L('첫 팀 만들기', 'Create first team')}</Button>
          </div>
        ) : teams.length > 0 ? (
          <div className="mt-2 flex gap-1 overflow-x-auto border-b border-[var(--border)]" role="tablist" aria-label={L('팀 선택', 'Choose team')}>
            {teams.map((team) => (
              <button
                key={team.id}
                type="button"
                role="tab"
                aria-selected={team.id === currentTeamId}
                onClick={() => setCurrentTeam(team.id)}
                title={team.name}
                className={`relative min-h-12 max-w-[min(18rem,75vw)] shrink-0 truncate px-4 text-[13px] font-semibold transition-colors ${team.id === currentTeamId ? 'text-[var(--text-primary)]' : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'}`}
              >
                {team.name}
                {team.id === currentTeamId && <span className="absolute inset-x-3 bottom-0 h-0.5 bg-[var(--accent)]" aria-hidden="true" />}
              </button>
            ))}
          </div>
        ) : null}
      </section>

      {currentTeam && currentTeamId && (
        <div className="mt-9 grid min-w-0 gap-12 lg:grid-cols-[minmax(0,1fr)_250px]">
          <div className="min-w-0">
            <section aria-labelledby="shared-heading">
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <h2 id="shared-heading" className="text-[18px] font-bold tracking-[-0.02em] text-[var(--text-primary)]">{L('함께 보는 결정', 'Shared decisions')}</h2>
                  <p className="mt-1 text-[13px] text-[var(--text-secondary)]">{L('팀에는 결정 요약과 검토에 필요한 근거만 보여요.', 'The team sees the decision summary and the evidence needed for review.')}</p>
                </div>
                <span className="text-[12px] text-[var(--text-tertiary)]">{teamProjects.length}{L('건', '')}</span>
              </div>

              <div className="mt-5 flex flex-col gap-2 border-y border-[var(--border)] py-4 sm:flex-row">
                <label className="sr-only" htmlFor="share-project">{L('공유할 결정', 'Decision to share')}</label>
                <select id="share-project" value={shareProjectId} onChange={(event) => setShareProjectId(event.target.value)} className="min-h-11 flex-1 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 text-[13px] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/25">
                  <option value="">{shareCandidates.length ? L('공유할 결정을 선택하세요', 'Choose a decision to share') : L('공유할 수 있는 결정이 없어요', 'No decisions available to share')}</option>
                  {shareCandidates.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
                </select>
                <Button size="sm" disabled={!shareProjectId} onClick={handleShare}>{L('팀에 공유', 'Share with team')}</Button>
              </div>

              {detailLoading ? (
                <div className="space-y-3 py-8" role="status" aria-live="polite" aria-label={L('공유된 결정을 불러오는 중', 'Loading shared decisions')}>
                  {[0, 1].map((item) => <div key={item} aria-hidden="true" className="h-16 animate-pulse motion-reduce:animate-none rounded-xl bg-[var(--surface)]" />)}
                </div>
              ) : teamProjects.length === 0 ? (
                <div className="py-12 text-center">
                  <p className="text-[14px] font-semibold text-[var(--text-primary)]">{L('아직 공유된 결정이 없어요', 'Nothing shared yet')}</p>
                  <p className="mt-1 text-[13px] text-[var(--text-secondary)]">{L('위에서 기존 결정을 고르면 바로 함께 검토할 수 있어요.', 'Choose an existing decision above to start a team review.')}</p>
                </div>
              ) : (
                <div className="divide-y divide-[var(--border)]">
                  {teamProjects.map((project) => (
                    <SharedDecision
                      key={project.id}
                      project={project}
                      expanded={expandedProjectId === project.id}
                      locale={locale}
                      canUnshare={manager || ownProjectIds.has(project.id)}
                      manager={manager}
                      reviewInputs={expandedProjectId === project.id ? reviewInputs : []}
                      hiddenCount={expandedProjectId === project.id ? reviewHiddenCount : 0}
                      reviewKind={reviewKind}
                      reviewRating={reviewRating}
                      reviewComment={reviewComment}
                      onToggle={() => void toggleProject(project)}
                      onUnshare={async () => {
                        if (await unshareProject(currentTeamId, project.id)) setNotice(L('팀 공유를 해제했어요.', 'Decision removed from the team.'));
                      }}
                      onKind={setReviewKind}
                      onRating={setReviewRating}
                      onComment={setReviewComment}
                      onSubmit={() => void handleReview(project.id)}
                      onReveal={async () => {
                        if (await revealInputs(currentTeamId, project.id)) setNotice(L('이번 검토 의견을 팀에 공개했어요.', 'This review round is now visible to the team.'));
                      }}
                    />
                  ))}
                </div>
              )}
            </section>
          </div>

          <aside className="min-w-0 border-t border-[var(--border)] pt-5 lg:border-t-0 lg:border-l lg:pl-7 lg:pt-0" aria-labelledby="people-heading">
            <div className="flex items-baseline justify-between">
              <h2 id="people-heading" className="text-[15px] font-bold text-[var(--text-primary)]">{L('사람', 'People')}</h2>
              <span className="text-[12px] text-[var(--text-tertiary)]">{members.length}</span>
            </div>
            <div className="mt-3 divide-y divide-[var(--border-subtle)]" aria-busy={detailLoading}>
              {detailLoading ? [0, 1].map((item) => (
                <div key={item} aria-hidden="true" className="h-14 animate-pulse motion-reduce:animate-none border-b border-[var(--border-subtle)] bg-[var(--surface)]/50" />
              )) : members.map((member) => (
                <div key={member.id} className="group flex items-center justify-between gap-2 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-semibold text-[var(--text-primary)]">{member.display_name || member.email || L('팀원', 'Teammate')}</p>
                    <p className="mt-0.5 truncate text-[12.5px] text-[var(--text-tertiary)]">{roleLabel(member.role, locale)}{member.display_name && member.email ? ` · ${member.email}` : ''}</p>
                  </div>
                  {manager && member.role !== 'owner' && (
                    <button type="button" onClick={() => void removeMember(member.id)} className="flex min-h-10 min-w-10 items-center justify-center text-[var(--text-tertiary)] opacity-70 transition-colors hover:text-[var(--danger)] sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100" aria-label={L(`${member.display_name || member.email || '팀원'} 내보내기`, `Remove ${member.display_name || member.email || 'teammate'}`)}>
                      <Trash2 size={14} aria-hidden="true" />
                    </button>
                  )}
                </div>
              ))}
            </div>

            {manager && (
              <div className="mt-7 border-t border-[var(--border)] pt-5">
                <h3 className="text-[13px] font-bold text-[var(--text-primary)]">{L('사람 초대', 'Invite a person')}</h3>
                <p className="mt-1 text-[12.5px] leading-5 text-[var(--text-tertiary)]">{L('메일 전송이 안 되면 링크를 복사하고, 복사가 막히면 직접 선택할 수 있게 보여드려요.', 'If email delivery is unavailable, we copy a link or show it for manual selection.')}</p>
                <label htmlFor="team-invite-email" className="sr-only">{L('초대할 이메일 주소', 'Email address to invite')}</label>
                <input id="team-invite-email" type="email" inputMode="email" autoComplete="email" maxLength={254} value={inviteEmail} onChange={(event) => setInviteEmail(event.target.value)} placeholder="name@company.com" className="mt-3 min-h-11 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 text-[13px] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/25" />
                <div className="mt-2 flex gap-2">
                  <select aria-label={L('초대할 역할', 'Role to invite')} value={inviteRole} onChange={(event) => setInviteRole(event.target.value as 'member' | 'admin')} className="min-h-11 min-w-0 flex-1 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2 text-[12px] text-[var(--text-primary)]">
                    <option value="member">{L('멤버', 'Member')}</option>
                    <option value="admin">{L('관리자', 'Manager')}</option>
                  </select>
                  <Button size="sm" onClick={handleInvite} disabled={busy || !inviteEmail.trim()} aria-label={L('초대 보내기', 'Send invitation')}><Mail size={13} /></Button>
                </div>
                {invites.length > 0 && (
                  <div className="mt-5">
                    <p className="text-[12.5px] font-semibold text-[var(--text-tertiary)]">{L('응답 대기', 'Awaiting response')} · {invites.length}</p>
                    <ul className="mt-1 divide-y divide-[var(--border-subtle)]">
                      {invites.map((invite) => <li key={invite.id} className="truncate py-2 text-[12.5px] text-[var(--text-secondary)]">{invite.email}</li>)}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </aside>
        </div>
      )}

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title={L('팀 만들기', 'Create a team')} closeLabel={L('닫기', 'Close')}>
        <label htmlFor="team-name" className="block text-[12px] font-semibold text-[var(--text-secondary)]">{L('팀 이름', 'Team name')}</label>
        <input id="team-name" value={teamName} onChange={(event) => setTeamName(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && void handleCreate()} maxLength={50} autoFocus placeholder={L('예: 제품 전략팀', 'e.g. Product strategy')} className="mt-2 min-h-11 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 text-[14px] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/25" />
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setCreateOpen(false)}>{L('취소', 'Cancel')}</Button>
          <Button onClick={handleCreate} disabled={busy || !teamName.trim()}>{L('만들기', 'Create')}</Button>
        </div>
      </Modal>
    </div>
  );
}

function SharedDecision({
  project,
  expanded,
  locale,
  canUnshare,
  manager,
  reviewInputs,
  hiddenCount,
  reviewKind,
  reviewRating,
  reviewComment,
  onToggle,
  onUnshare,
  onKind,
  onRating,
  onComment,
  onSubmit,
  onReveal,
}: {
  project: TeamSharedProject;
  expanded: boolean;
  locale: 'ko' | 'en';
  canUnshare: boolean;
  manager: boolean;
  reviewInputs: ReturnType<typeof useTeamStore.getState>['reviewInputs'];
  hiddenCount: number;
  reviewKind: ReviewKind;
  reviewRating: number | null;
  reviewComment: string;
  onToggle: () => void;
  onUnshare: () => void;
  onKind: (kind: ReviewKind) => void;
  onRating: (rating: number | null) => void;
  onComment: (value: string) => void;
  onSubmit: () => void;
  onReveal: () => void;
}) {
  const L = (ko: string, en: string) => locale === 'ko' ? ko : en;
  const bearing = project.session ? deriveCurrentBearing(project.session) : null;
  const publicInputs = reviewInputs.filter((input) => input.visible);
  const privateInputs = reviewInputs.filter((input) => !input.visible);

  return (
    <article>
      <button type="button" onClick={onToggle} className="flex w-full items-start justify-between gap-5 py-5 text-left">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <h3 className="[overflow-wrap:anywhere] text-[15px] font-bold text-[var(--text-primary)]">{project.name}</h3>
            <span className="[overflow-wrap:anywhere] text-[12.5px] text-[var(--text-tertiary)]">{project.owner_name || project.owner_email || L('팀원', 'Teammate')}</span>
          </div>
          <p className="mt-1 line-clamp-2 text-[13px] leading-6 text-[var(--text-secondary)]">{bearing?.current_course.summary || project.description || L('결정 요약이 아직 준비되지 않았어요.', 'The decision summary is not ready yet.')}</p>
        </div>
        {expanded ? <ChevronUp size={16} className="mt-1 shrink-0 text-[var(--text-tertiary)]" /> : <ChevronDown size={16} className="mt-1 shrink-0 text-[var(--text-tertiary)]" />}
      </button>

      {expanded && (
        <div className="pb-8 pl-0 sm:pl-5">
          {bearing && (
            <div className="grid gap-x-8 gap-y-5 border-y border-[var(--border-subtle)] py-5 sm:grid-cols-2">
              <SummaryField label={L('정리한 방향', 'Clarified direction')} value={bearing.current_course.summary} />
              <SummaryField label={L('다음 행동', 'Next action')} value={bearing.next_helm || L('아직 정하지 않았어요.', 'Not set yet.')} />
              <SummaryField label={L('주요 근거', 'Key reasons')} value={bearing.why_this_course.map((reason) => reason.point).join(' · ') || L('표시할 근거가 없어요.', 'No reasons surfaced.')} />
              <SummaryField label={L('확인할 위험', 'Risk to check')} value={bearing.fog_or_reef?.issue || L('별도로 표시된 위험이 없어요.', 'No specific risk surfaced.')} />
            </div>
          )}

          {project.session?.final_deliverable && (
            <details className="border-b border-[var(--border-subtle)] py-4">
              <summary className="cursor-pointer text-[12px] font-semibold text-[var(--text-secondary)]">{L('최종 문서 펼쳐보기', 'View final document')}</summary>
              <div className="mt-4 max-h-80 overflow-y-auto whitespace-pre-wrap text-[12px] leading-6 text-[var(--text-secondary)]">{project.session.final_deliverable}</div>
            </details>
          )}

          <div className="mt-6">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <div>
                <h4 className="text-[14px] font-bold text-[var(--text-primary)]">{L('내 의견 먼저 남기기', 'Respond independently')}</h4>
                <p className="mt-1 text-[12px] leading-5 text-[var(--text-tertiary)]">{L('공개 전에는 다른 사람의 미공개 의견을 볼 수 없어요.', 'Unpublished responses stay hidden from other reviewers.')}</p>
              </div>
              {hiddenCount > 0 && <span className="text-[12.5px] font-semibold text-[var(--accent)]">{manager ? L(`공개 대기 ${hiddenCount}건`, `${hiddenCount} awaiting publication`) : L('내 의견 공개 대기', 'Your response is private')}</span>}
            </div>

            <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label={L('의견 유형', 'Feedback type')}>
              {([
                ['concern', L('우려', 'Concern')],
                ['endorsement', L('동의', 'Support')],
                ['alternative', L('다른 선택', 'Alternative')],
              ] as Array<[ReviewKind, string]>).map(([kind, label]) => (
                <button key={kind} type="button" onClick={() => onKind(kind)} className={`min-h-9 rounded-full border px-3 text-[12px] font-semibold ${reviewKind === kind ? 'border-[var(--accent)] text-[var(--text-primary)]' : 'border-[var(--border)] text-[var(--text-tertiary)]'}`}>{label}</button>
              ))}
            </div>
            <div className="mt-3 flex items-center gap-1" aria-label={L('확신 점수', 'Confidence rating')}>
              <span className="mr-2 text-[12.5px] text-[var(--text-tertiary)]">{L('확신', 'Confidence')}</span>
              {[1, 2, 3, 4, 5].map((rating) => (
                <button key={rating} type="button" onClick={() => onRating(reviewRating === rating ? null : rating)} aria-pressed={reviewRating === rating} className={`h-8 w-8 rounded-full text-[12px] font-semibold ${reviewRating === rating ? 'bg-[var(--primary)] text-[var(--bg)]' : 'border border-[var(--border)] text-[var(--text-tertiary)]'}`}>{rating}</button>
              ))}
            </div>
            <label htmlFor={`team-review-${project.id}`} className="sr-only">{L(`${project.name}에 대한 검토 의견`, `Review comment for ${project.name}`)}</label>
            <textarea id={`team-review-${project.id}`} value={reviewComment} onChange={(event) => onComment(event.target.value)} maxLength={2000} rows={3} placeholder={L('어떤 점을 확인하거나 다르게 보고 있나요?', 'What should the team check, or what do you see differently?')} className="mt-3 w-full resize-y rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-[13px] leading-6 text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/25" />
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
              <span className="text-[12.5px] text-[var(--text-tertiary)]">{L('제출 직후에는 나만 볼 수 있어요.', 'Only you can see it immediately after submitting.')} · {reviewComment.length}/2000</span>
              <Button size="sm" onClick={onSubmit} disabled={!reviewRating && !reviewComment.trim()}><Send size={13} />{L('의견 보관', 'Save response')}</Button>
            </div>
          </div>

          {(publicInputs.length > 0 || privateInputs.length > 0) && (
            <div className="mt-7 border-t border-[var(--border)] pt-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h4 className="text-[13px] font-bold text-[var(--text-primary)]">{L('모인 의견', 'Collected feedback')}</h4>
                {manager && hiddenCount > 0 && <Button size="sm" variant="secondary" onClick={onReveal}>{L(`이번 의견 ${hiddenCount}건 공개`, `Publish ${hiddenCount} response${hiddenCount === 1 ? '' : 's'}`)}</Button>}
              </div>
              <div className="mt-2 divide-y divide-[var(--border-subtle)]">
                {[...publicInputs, ...privateInputs].map((input) => (
                  <div key={input.id} className="py-3">
                    <div className="flex flex-wrap items-center gap-2 text-[12.5px] text-[var(--text-tertiary)]">
                      <UserRound size={12} aria-hidden="true" />
                      <span>{input.user_name || L('팀원', 'Teammate')}</span>
                      <span>·</span>
                      <span>{reviewTypeLabel(input.input_type, locale)}</span>
                      {input.rating && <span>· {L(`확신 ${input.rating}/5`, `Confidence ${input.rating}/5`)}</span>}
                      {!input.visible && <span className="font-semibold text-[var(--accent)]">{L('나에게만 보임', 'Private to you')}</span>}
                    </div>
                    {input.comment && <p className="mt-1.5 [overflow-wrap:anywhere] whitespace-pre-wrap text-[13px] leading-6 text-[var(--text-secondary)]">{input.comment}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {canUnshare && (
            <div className="mt-7 flex justify-end border-t border-[var(--border-subtle)] pt-3">
              <button type="button" onClick={onUnshare} className="inline-flex min-h-10 items-center gap-1.5 text-[12.5px] text-[var(--text-tertiary)] transition-colors hover:text-[var(--danger)]"><Trash2 size={12} />{L('팀 공유 해제', 'Remove from team')}</button>
            </div>
          )}
        </div>
      )}
    </article>
  );
}

function SummaryField({ label, value }: { label: string; value: string }) {
  return <div className="min-w-0"><p className="text-[12px] font-bold tracking-[0.08em] text-[var(--accent)]">{label}</p><p className="mt-1.5 [overflow-wrap:anywhere] whitespace-pre-wrap text-[13px] leading-6 text-[var(--text-secondary)]">{value}</p></div>;
}

function roleLabel(role: 'owner' | 'admin' | 'member', locale: 'ko' | 'en') {
  if (locale === 'ko') return role === 'owner' ? '소유자' : role === 'admin' ? '관리자' : '멤버';
  return role === 'owner' ? 'Owner' : role === 'admin' ? 'Manager' : 'Member';
}

function reviewTypeLabel(type: string, locale: 'ko' | 'en') {
  const labels = locale === 'ko'
    ? { concern: '우려', endorsement: '동의', alternative: '다른 선택', rating: '점수' }
    : { concern: 'Concern', endorsement: 'Support', alternative: 'Alternative', rating: 'Rating' };
  return labels[type as keyof typeof labels] || type;
}
