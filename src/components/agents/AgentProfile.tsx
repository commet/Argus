'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, MessageCircle, PenSquare, ArrowRight, ChevronDown, Sparkles } from 'lucide-react';
import { LocaleLink } from '@/components/ui/LocaleLink';
import type { Agent, InnerMonologueArchiveEntry } from '@/stores/agent-types';
import { getLevelProgress, AGENT_LEVELS } from '@/stores/agent-types';
import { PersonaRefinementSection } from './PersonaRefinementSection';
import { useLocale } from '@/hooks/useLocale';

const EASE = [0.32, 0.72, 0, 1] as const;

function getGroupLabels(locale: 'ko' | 'en'): Record<string, string> {
  return locale === 'ko' ? {
    research: '리서치',
    strategy: '전략',
    production: '실행',
    validation: '검증',
    special: '총괄',
    people: '사람들',
  } : {
    research: 'Research',
    strategy: 'Strategy',
    production: 'Execution',
    validation: 'Validation',
    special: 'Lead',
    people: 'People',
  };
}

function getObsCategoryLabels(locale: 'ko' | 'en'): Record<string, string> {
  return locale === 'ko' ? {
    preference: '선호',
    skill_gap: '약점',
    communication_style: '소통 방식',
    work_pattern: '업무 패턴',
  } : {
    preference: 'Preference',
    skill_gap: 'Skill gap',
    communication_style: 'Comms style',
    work_pattern: 'Work pattern',
  };
}

interface AgentProfileProps {
  agent: Agent;
  onClose: () => void;
}

export function AgentProfile({ agent, onClose }: AgentProfileProps) {
  const locale = useLocale();
  const L = (ko: string, en: string) => locale === 'ko' ? ko : en;
  const GROUP_LABELS = getGroupLabels(locale);
  const OBS_CATEGORY_LABELS = getObsCategoryLabels(locale);
  const displayName = (locale === 'en' && agent.nameEn) ? agent.nameEn : agent.name;
  const displayRole = (locale === 'en' && agent.roleEn) ? agent.roleEn : agent.role;
  const displayExpertise = (locale === 'en' && agent.expertiseEn) ? agent.expertiseEn : agent.expertise;
  const displayTone = (locale === 'en' && agent.toneEn) ? agent.toneEn : agent.tone;
  const { current, next, progress } = getLevelProgress(agent.xp);
  const levelData = AGENT_LEVELS.find(l => l.level === agent.level);
  const isMaxLevel = agent.level >= AGENT_LEVELS[AGENT_LEVELS.length - 1].level;

  // Modal a11y (§3 Batch 2): Esc to close, focus the dialog on open, a simple
  // Tab focus-trap, and return focus to the trigger on close — so keyboard /
  // switch users aren't stranded behind the overlay.
  const dialogRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const prevFocus = document.activeElement as HTMLElement | null;
    dialogRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopPropagation(); onClose(); return; }
      if (e.key !== 'Tab' || !dialogRef.current) return;
      const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])',
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('keydown', onKey); prevFocus?.focus?.(); };
  }, [onClose]);

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center sm:p-4"
    >
      <div className="absolute inset-0 bg-black/45" onClick={onClose} aria-hidden="true" />
      <motion.div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="agent-profile-title"
        tabIndex={-1}
        initial={{ opacity: 0, y: 24, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 12 }}
        transition={{ duration: 0.35, ease: EASE }}
        className="relative w-full sm:max-w-md max-h-[85dvh] sm:max-h-[80dvh] rounded-t-2xl sm:rounded-2xl bg-[var(--surface)] shadow-[var(--shadow-xl)] overflow-hidden flex flex-col focus:outline-none"
      >
        {/* Header */}
        <div className="relative px-6 pt-6 pb-4 shrink-0" style={{ borderBottom: `3px solid ${agent.color}` }}>
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2.5 min-w-[44px] min-h-[44px] inline-flex items-center justify-center hover:bg-[var(--bg)] rounded-lg cursor-pointer transition-colors"
            aria-label={L('닫기', 'Close')}
          >
            <X size={18} className="text-[var(--text-tertiary)]" />
          </button>

          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
            {/* Avatar */}
            <div
              style={{
                width: 56, height: 56, borderRadius: 16,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 28, background: `${agent.color}14`,
                border: `2px solid ${agent.color}30`,
              }}
            >
              {agent.emoji}
            </div>

            {/* Identity */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <p id="agent-profile-title" style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>
                {displayName}
              </p>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>
                {displayRole}
                <span style={{ color: 'var(--text-tertiary)', marginLeft: 8 }}>
                  {GROUP_LABELS[agent.group] || agent.group}
                </span>
              </p>

              {/* Level + XP */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10 }}>
                <span className="agent-lv" data-level={agent.level} style={{ fontSize: 11 }}>
                  Lv.{agent.level}
                </span>
                <div style={{ flex: 1, maxWidth: 120 }}>
                  <div className="agent-xp-bar" style={{ height: 4 }}>
                    <div
                      className="agent-xp-fill"
                      style={{ width: `${Math.round(progress * 100)}%`, background: agent.color }}
                    />
                  </div>
                </div>
                <span style={{ fontSize: 10, color: 'var(--text-tertiary)', fontVariantNumeric: 'tabular-nums' }}>
                  {isMaxLevel ? 'MAX' : `${current}/${next}`}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">

          {/* Expertise & Tone */}
          {(displayExpertise || displayTone) && (
            <section>
              {displayExpertise && (
                <p style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.7, marginBottom: 6 }}>
                  {displayExpertise}
                </p>
              )}
              {displayTone && (
                <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6, fontStyle: 'italic' }}>
                  {displayTone}
                </p>
              )}
            </section>
          )}

          {/* Stakeholder info (for people agents) */}
          {agent.group === 'people' && agent.organization && (
            <section>
              <SectionLabel>{L('프로필', 'Profile')}</SectionLabel>
              <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr', gap: '4px 12px', fontSize: 12 }}>
                {agent.organization && <><span style={{ color: 'var(--text-tertiary)' }}>{L('소속', 'Org')}</span><span style={{ color: 'var(--text-primary)' }}>{agent.organization}</span></>}
                {agent.priorities && <><span style={{ color: 'var(--text-tertiary)' }}>{L('우선', 'Priorities')}</span><span style={{ color: 'var(--text-primary)' }}>{agent.priorities}</span></>}
                {agent.known_concerns && <><span style={{ color: 'var(--text-tertiary)' }}>{L('우려', 'Concerns')}</span><span style={{ color: 'var(--text-primary)' }}>{agent.known_concerns}</span></>}
              </div>
            </section>
          )}

          {/* Boss personality (for boss agents) */}
          {agent.personality_code && (
            <section>
              <SectionLabel>{L('성격 프로필', 'Personality Profile')}</SectionLabel>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <InfoPill label={L('유형', 'Type')} value={agent.personality_code} />
                {agent.personality_profile?.bossVibe && (
                  <InfoPill label={L('분위기', 'Vibe')} value={agent.personality_profile.bossVibe} />
                )}
              </div>
            </section>
          )}

          {/* Inner Monologue Archive — 이 팀장이 당신을 본 기록 */}
          {agent.origin === 'boss_sim' && agent.inner_monologue_archive && agent.inner_monologue_archive.length > 0 && (
            <section>
              <SectionLabel>{L(`이 팀장이 당신을 본 기록 (${agent.inner_monologue_archive.length})`, `How this boss sees you (${agent.inner_monologue_archive.length})`)}</SectionLabel>
              <InnerMonologueArchiveList entries={agent.inner_monologue_archive} color={agent.color} />
            </section>
          )}

          {/* Boss CTAs — 대화 이어가기 + 워크스페이스에서 리뷰받기 */}
          {agent.origin === 'boss_sim' && (
            <section>
              <SectionLabel>{L('이 팀장과 계속', 'Continue with this boss')}</SectionLabel>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <LocaleLink
                  href={`/boss?agent=${agent.id}`}
                  onClick={onClose}
                  className="agent-boss-cta"
                  style={{ textDecoration: 'none' }}
                >
                  <MessageCircle size={14} style={{ color: agent.color, flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
                      {L('대화 이어가기', 'Continue the conversation')}
                    </p>
                    <p style={{ fontSize: 11, color: 'var(--text-tertiary)', margin: '2px 0 0' }}>
                      {agent.chat_history && agent.chat_history.length > 0
                        ? L(`지난 대화 ${agent.chat_history.length}턴이 이어집니다`, `Resumes ${agent.chat_history.length} prior turn${agent.chat_history.length === 1 ? '' : 's'}`)
                        : L('새 대화를 시작합니다', 'Start a new conversation')}
                    </p>
                  </div>
                  <ArrowRight size={12} style={{ color: 'var(--text-tertiary)' }} />
                </LocaleLink>
                <LocaleLink
                  href={`/workspace?reviewer=${agent.id}`}
                  onClick={onClose}
                  className="agent-boss-cta"
                  style={{ textDecoration: 'none' }}
                >
                  <PenSquare size={14} style={{ color: agent.color, flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
                      {L('워크스페이스에서 리뷰받기', 'Get reviewed in workspace')}
                    </p>
                    <p style={{ fontSize: 11, color: 'var(--text-tertiary)', margin: '2px 0 0' }}>
                      {L('이 팀장이 워크스페이스에서 피드백을 줘요', 'This boss reviews your work in the workspace')}
                    </p>
                  </div>
                  <ArrowRight size={12} style={{ color: 'var(--text-tertiary)' }} />
                </LocaleLink>
              </div>
            </section>
          )}

          {/* Persona Refinement — boss_sim은 PersonaRefinementSection, 그 외는 기존 리스트 유지 */}
          {agent.origin === 'boss_sim' ? (
            <PersonaRefinementSection agent={agent} />
          ) : agent.observations.length > 0 ? (
            <section>
              <SectionLabel>{L(`관찰 (${agent.observations.length})`, `Observations (${agent.observations.length})`)}</SectionLabel>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {[...agent.observations]
                  .sort((a, b) => b.confidence - a.confidence)
                  .map(obs => (
                    <div
                      key={obs.id}
                      style={{
                        fontSize: 12, lineHeight: 1.6, padding: '8px 12px',
                        borderRadius: 10, background: 'var(--bg)',
                        color: 'var(--text-primary)',
                      }}
                    >
                      <span style={{
                        fontSize: 10, fontWeight: 600, color: 'var(--text-tertiary)',
                        marginRight: 6,
                      }}>
                        {OBS_CATEGORY_LABELS[obs.category] || obs.category}
                      </span>
                      {obs.observation}
                      <span style={{
                        fontSize: 10, color: 'var(--text-tertiary)',
                        marginLeft: 8, fontVariantNumeric: 'tabular-nums',
                      }}>
                        {Math.round(obs.confidence * 100)}%
                      </span>
                    </div>
                  ))}
              </div>
            </section>
          ) : (
            <section>
              <SectionLabel>{L('관찰', 'Observations')}</SectionLabel>
              <p style={{ fontSize: 12, color: 'var(--text-tertiary)', lineHeight: 1.6 }}>
                {L('아직 쌓인 관찰이 없어요. 같이 일할수록 점점 더 잘 알게 돼요.', 'No observations yet — it gets to know you as you work together.')}
              </p>
            </section>
          )}

          {/* Stats */}
          <section>
            <SectionLabel>{L('통계', 'Stats')}</SectionLabel>
            <div style={{ display: 'flex', gap: 16 }}>
              <Stat label="XP" value={agent.xp.toString()} />
              <Stat label={L('관찰', 'Obs')} value={agent.observations.length.toString()} />
              {agent.last_used_at && (
                <Stat label={L('마지막 사용', 'Last used')} value={formatRelativeDate(agent.last_used_at, locale)} />
              )}
            </div>
          </section>
        </div>
      </motion.div>
    </motion.div>
  );
}

function InnerMonologueArchiveList({ entries, color }: { entries: InnerMonologueArchiveEntry[]; color: string }) {
  const locale = useLocale();
  const L = (ko: string, en: string) => (locale === 'ko' ? ko : en);
  const [expanded, setExpanded] = useState<string | null>(
    entries.length > 0 ? entries[entries.length - 1].id : null,
  );
  // 최신이 위로 오도록 역순
  const sorted = [...entries].reverse();

  const VERDICT_META: Record<string, { label: string; icon: string; color: string }> = {
    approved: { label: L('승인', 'Approved'), icon: '✅', color: 'rgb(29, 125, 63)' },
    conditional: { label: L('조건부', 'Conditional'), icon: '🤔', color: 'rgb(184, 150, 62)' },
    rejected: { label: L('반려', 'Rejected'), icon: '❌', color: 'rgb(220, 53, 69)' },
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {sorted.map(entry => {
        const isOpen = expanded === entry.id;
        const verdictMeta = VERDICT_META[entry.verdict] || { label: entry.verdict, icon: '•', color: 'var(--text-secondary)' };
        const date = new Date(entry.created_at);
        const dateStr = formatRelativeDate(entry.created_at, locale);
        return (
          <div
            key={entry.id}
            style={{
              borderRadius: 12,
              background: isOpen
                ? 'linear-gradient(155deg, rgba(91,33,182,0.04) 0%, rgba(15,23,42,0.06) 100%)'
                : 'var(--bg)',
              border: `1px solid ${isOpen ? 'rgba(91,33,182,0.25)' : 'var(--border-subtle)'}`,
              transition: 'background 0.2s, border-color 0.2s',
              overflow: 'hidden',
            }}
          >
            <button
              type="button"
              onClick={() => setExpanded(isOpen ? null : entry.id)}
              style={{
                width: '100%',
                padding: '10px 12px',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                textAlign: 'left',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
              }}
            >
              <span style={{ fontSize: 14, lineHeight: 1, flexShrink: 0 }}>{verdictMeta.icon}</span>
              <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: verdictMeta.color }}>
                    {verdictMeta.label}
                  </span>
                  {entry.situation && (
                    <span
                      style={{
                        fontSize: 11,
                        color: 'var(--text-primary)',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        maxWidth: 180,
                      }}
                    >
                      — {entry.situation}
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>{dateStr}</span>
                  {entry.daily_mood_label && (
                    <>
                      <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>·</span>
                      <span style={{ fontSize: 10, color: 'var(--text-tertiary)', fontWeight: 600 }}>
                        {L('그날', 'That day')} {entry.daily_mood_label}
                      </span>
                    </>
                  )}
                </div>
              </div>
              <ChevronDown
                size={14}
                style={{
                  color: 'var(--text-tertiary)',
                  flexShrink: 0,
                  transform: isOpen ? 'rotate(180deg)' : 'rotate(0)',
                  transition: 'transform 0.25s',
                }}
              />
            </button>
            <AnimatePresence>
              {isOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                  style={{ overflow: 'hidden' }}
                >
                  <div
                    style={{
                      padding: '4px 14px 14px',
                      borderTop: '1px dashed rgba(91,33,182,0.18)',
                      marginTop: 4,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 8, marginTop: 8 }}>
                      <Sparkles size={10} style={{ color: 'rgb(139,92,246)' }} />
                      <span
                        style={{
                          fontSize: 9,
                          fontWeight: 800,
                          letterSpacing: '0.1em',
                          textTransform: 'uppercase',
                          color: 'rgb(109,40,217)',
                        }}
                      >
                        {L('속마음', 'Inner monologue')}
                      </span>
                    </div>
                    <p
                      style={{
                        fontSize: 12.5,
                        lineHeight: 1.75,
                        color: 'var(--text-primary)',
                        fontStyle: 'italic',
                        margin: 0,
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'keep-all',
                      }}
                    >
                      {entry.text}
                    </p>
                    {entry.verdict_reason && (
                      <p
                        style={{
                          fontSize: 10,
                          color: 'var(--text-tertiary)',
                          marginTop: 8,
                          marginBottom: 0,
                          paddingTop: 6,
                          borderTop: '1px dotted var(--border-subtle)',
                        }}
                      >
                        {L('그때 판정 이유:', 'Why it ruled that way:')} {entry.verdict_reason}
                      </p>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p style={{
      fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)',
      letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 8,
    }}>
      {children}
    </p>
  );
}

function InfoPill({ label, value }: { label: string; value: string }) {
  return (
    <span style={{
      fontSize: 11, padding: '3px 10px', borderRadius: 99,
      background: 'var(--bg)', color: 'var(--text-primary)',
    }}>
      <span style={{ color: 'var(--text-tertiary)', marginRight: 4 }}>{label}</span>
      {value}
    </span>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>
        {value}
      </p>
      <p style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>{label}</p>
    </div>
  );
}

function formatRelativeDate(iso: string, locale: 'ko' | 'en' = 'ko'): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  const ko = locale === 'ko';
  if (mins < 1) return ko ? '방금' : 'just now';
  if (mins < 60) return ko ? `${mins}분 전` : `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return ko ? `${hours}시간 전` : `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return ko ? `${days}일 전` : `${days}d ago`;
  return new Date(iso).toLocaleDateString(ko ? 'ko-KR' : 'en-US', { month: 'short', day: 'numeric' });
}
