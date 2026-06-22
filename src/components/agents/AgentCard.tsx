'use client';

import type { Agent } from '@/stores/agent-types';
import { getLevelProgress } from '@/stores/agent-types';
import { useLocale } from '@/hooks/useLocale';

type Locale = 'ko' | 'en';

interface AgentCardProps {
  agent: Agent;
  onClick?: () => void;
}

export function AgentCard({ agent, onClick }: AgentCardProps) {
  const locale = useLocale();
  const { progress } = getLevelProgress(agent.xp);
  const isNavigator = agent.id === 'navigator';
  const displayName = locale === 'en' && agent.nameEn ? agent.nameEn : agent.name;
  const displayRole = locale === 'en' && agent.roleEn ? agent.roleEn : agent.role;

  if (!agent.unlocked) {
    return <LockedAgentCard agent={agent} isNavigator={isNavigator} locale={locale} displayName={displayName} displayRole={displayRole} />;
  }

  const obsCount = agent.observations.length;
  const obsLabel = locale === 'ko'
    ? `${obsCount}개 관찰`
    : `${obsCount} observation${obsCount === 1 ? '' : 's'}`;

  return (
    <div
      className={`agent-card ${isNavigator ? 'agent-card-navigator' : ''}`}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick?.(); } }}
    >
      <div className="agent-card-emoji">{agent.emoji}</div>
      <div className="agent-card-role">{displayRole}</div>
      <div className="agent-card-name">{displayName}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span className="agent-lv" data-level={agent.level}>
          Lv.{agent.level}
        </span>
        {obsCount > 0 && (
          <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
            {obsLabel}
          </span>
        )}
      </div>
      <div className="agent-xp-bar">
        <div
          className="agent-xp-fill"
          style={{
            width: `${Math.round(progress * 100)}%`,
            background: agent.color,
          }}
        />
      </div>
    </div>
  );
}

function LockedAgentCard({ agent, isNavigator, locale, displayName, displayRole }: {
  agent: Agent;
  isNavigator: boolean;
  locale: Locale;
  displayName: string;
  displayRole: string;
}) {
  const conditionText = getUnlockText(agent, locale);

  return (
    <div className={`agent-card agent-card-locked ${isNavigator ? 'agent-card-navigator' : ''}`}>
      <div className="agent-lock">
        <div className="agent-lock-icon">🔒</div>
        <div className="agent-card-name" style={{ opacity: 0.4 }}>{displayName}</div>
        <div className="agent-card-role" style={{ opacity: 0.5 }}>{displayRole}</div>
        <div className="agent-lock-text">{conditionText}</div>
      </div>
    </div>
  );
}

function getUnlockText(agent: Agent, locale: Locale): string {
  const cond = agent.unlock_condition;
  const ko = locale === 'ko';
  switch (cond.type) {
    case 'chain_tasks':
      return ko
        ? `${cond.required}회 작업 후 해금`
        : `Unlocks after ${cond.required} task${cond.required === 1 ? '' : 's'}`;
    case 'total_tasks':
      return ko
        ? `전체 ${cond.required}회 작업 후 해금`
        : `Unlocks after ${cond.required} total task${cond.required === 1 ? '' : 's'}`;
    default:
      return '';
  }
}
