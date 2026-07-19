'use client';

import { useEffect, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { LocaleLink } from '@/components/ui/LocaleLink';
import { useAgentStore } from '@/stores/useAgentStore';
import type { Agent, AgentChain } from '@/stores/agent-types';
import { AgentCard } from './AgentCard';
import { AgentProfile } from './AgentProfile';
import { useLocale } from '@/hooks/useLocale';

type Locale = 'ko' | 'en';

function getGroupMeta(locale: Locale): Record<string, { label: string; emoji: string }> {
  if (locale === 'ko') {
    return {
      research: { label: '리서치', emoji: '🔍' },
      strategy: { label: '전략', emoji: '🎯' },
      production: { label: '실행', emoji: '⚡' },
      validation: { label: '검증', emoji: '🛡️' },
      people: { label: '사람들', emoji: '👥' },
      special: { label: '총괄', emoji: '🧭' },
    };
  }
  return {
    research: { label: 'Research', emoji: '🔍' },
    strategy: { label: 'Strategy', emoji: '🎯' },
    production: { label: 'Execution', emoji: '⚡' },
    validation: { label: 'Validation', emoji: '🛡️' },
    people: { label: 'People', emoji: '👥' },
    special: { label: 'Lead', emoji: '🧭' },
  };
}

export function AgentHub() {
  const locale = useLocale();
  const L = (ko: string, en: string) => locale === 'ko' ? ko : en;
  const GROUP_META = getGroupMeta(locale);
  const agents = useAgentStore(s => s.agents);
  const chains = useAgentStore(s => s.chains);
  const loadAgents = useAgentStore(s => s.loadAgents);

  useEffect(() => {
    if (agents.length === 0) loadAgents();
  }, [agents.length, loadAgents]);

  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);

  if (agents.length === 0) {
    return (
      <div className="agent-hub" aria-busy="true" aria-live="polite">
        <h1 className="agent-hub-title">{L('AI 검토자', 'AI reviewers')}</h1>
        <p className="agent-hub-subtitle">{L('결정을 서로 다른 관점에서 살펴보는 AI 역할들이에요.', 'These AI roles review decisions from different perspectives.')}</p>
        <div className="mt-6 space-y-8">
          {[0, 1, 2].map((sectionIdx) => (
            <section key={sectionIdx} className="space-y-3">
              <div className="h-4 w-32 rounded bg-[var(--surface)] animate-pulse" />
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {[0, 1, 2, 3].map((cardIdx) => (
                  <div
                    key={cardIdx}
                    className="h-28 rounded-xl bg-[var(--surface)] border border-[var(--border-subtle)] animate-pulse"
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
        <span className="sr-only">{L('에이전트 불러오는 중', 'Loading agents')}</span>
      </div>
    );
  }

  // 체인 에이전트
  const researchChain = chains.find(c => c.id === 'research');
  const strategyChain = chains.find(c => c.id === 'strategy');
  const researchAgents = getChainAgents('research', agents, researchChain);
  const strategyAgents = getChainAgents('strategy', agents, strategyChain);

  // 독립 에이전트
  const productionAgents = agents.filter(a => a.group === 'production' && !a.archived);
  const validationAgents = agents.filter(a => a.group === 'validation' && !a.archived);

  // 사람들 (Boss, Stakeholder)
  const peopleAgents = agents.filter(a => a.group === 'people' && !a.archived);

  // 항해장
  const navigator = agents.find(a => a.id === 'navigator');

  return (
    <div className="agent-hub">
      {/* W1.5④ 선원 명부 — a roster you BROWSE, not a page you manage. All
          crew sail from the first voyage; XP/level is progression flavor. */}
      <h1 className="agent-hub-title">{L('AI 검토자', 'AI reviewers')}</h1>
      <p className="agent-hub-subtitle">
        {L('결정을 서로 다른 관점에서 살펴보는 AI 역할들이에요. 실제 사람 팀은 사람 팀 메뉴에서 따로 관리합니다.', 'These AI roles review decisions from different perspectives. Manage real collaborators separately under People teams.')}
      </p>

      {/* 체인 에이전트: 리서치 */}
      {researchChain && (
        <ChainSection
          chain={researchChain}
          agents={researchAgents}
          meta={GROUP_META.research}
          onSelect={setSelectedAgent}
        />
      )}

      {/* 체인 에이전트: 전략 */}
      {strategyChain && (
        <ChainSection
          chain={strategyChain}
          agents={strategyAgents}
          meta={GROUP_META.strategy}
          onSelect={setSelectedAgent}
        />
      )}

      {/* 독립: 실행 */}
      <GroupSection
        agents={productionAgents}
        meta={GROUP_META.production}
        onSelect={setSelectedAgent}
      />

      {/* 독립: 검증 */}
      <GroupSection
        agents={validationAgents}
        meta={GROUP_META.validation}
        onSelect={setSelectedAgent}
      />

      {/* 사람들 + 팀장 시뮬레이터 진입 */}
      <section className="agent-section">
        <SectionHeader meta={GROUP_META.people} />
        <div className="agent-grid">
          {peopleAgents.map(agent => (
            <AgentCard key={agent.id} agent={agent} onClick={() => agent.unlocked && setSelectedAgent(agent)} />
          ))}
          <LocaleLink href="/boss" className="agent-card agent-card-boss-cta" style={{ textDecoration: 'none' }}>
            <div className="agent-card-emoji">👔</div>
            <div className="agent-card-role">{L('팀장 시뮬레이터', 'Boss Simulator')}</div>
            <div className="agent-card-name">{L('내 팀장은 뭐라고 할까?', 'What would my boss say?')}</div>
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              fontSize: 11, fontWeight: 600, color: 'var(--accent)',
              marginTop: 6,
            }}>
              {L('시작하기 →', 'Start →')}
            </span>
          </LocaleLink>
        </div>
      </section>

      {/* 항해장 */}
      {navigator && (
        <section className="agent-section">
          <SectionHeader meta={GROUP_META.special} />
          <div className="agent-grid">
            <AgentCard agent={navigator} onClick={() => navigator.unlocked && setSelectedAgent(navigator)} />
          </div>
        </section>
      )}

      {/* Agent Profile Modal */}
      <AnimatePresence>
        {selectedAgent && (
          <AgentProfile agent={selectedAgent} onClose={() => setSelectedAgent(null)} />
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Sub-components ───

function SectionHeader({ meta, extra }: { meta: { label: string; emoji: string }; extra?: React.ReactNode }) {
  return (
    <div className="agent-section-header">
      <span style={{ fontSize: 14 }}>{meta.emoji}</span>
      <span className="agent-section-name">{meta.label}</span>
      {extra}
    </div>
  );
}

function ChainSection({ chain, agents, meta, onSelect }: {
  chain: AgentChain;
  agents: Agent[];
  meta: { label: string; emoji: string };
  onSelect: (agent: Agent) => void;
}) {
  const locale = useLocale();
  const nextThreshold = agents.find(a => !a.unlocked)
    ? agents.find(a => !a.unlocked)!.unlock_condition.required
    : chain.total_tasks;
  const progress = nextThreshold > 0
    ? Math.min(1, chain.total_tasks / nextThreshold)
    : 1;
  const badge = locale === 'ko'
    ? `${chain.total_tasks}회 작업`
    : `${chain.total_tasks} task${chain.total_tasks === 1 ? '' : 's'}`;

  return (
    <section className="agent-section">
      <SectionHeader
        meta={meta}
        extra={
          <>
            <div className="chain-progress">
              <div className="chain-progress-fill" style={{ width: `${Math.round(progress * 100)}%` }} />
            </div>
            <span className="agent-section-badge">
              {badge}
            </span>
          </>
        }
      />
      <div className="agent-grid">
        {agents.map(agent => (
          <AgentCard key={agent.id} agent={agent} onClick={() => agent.unlocked && onSelect(agent)} />
        ))}
      </div>
    </section>
  );
}

function GroupSection({ agents, meta, onSelect }: {
  agents: Agent[];
  meta: { label: string; emoji: string };
  onSelect: (agent: Agent) => void;
}) {
  return (
    <section className="agent-section">
      <SectionHeader meta={meta} />
      <div className="agent-grid">
        {agents.map(agent => (
          <AgentCard key={agent.id} agent={agent} onClick={() => agent.unlocked && onSelect(agent)} />
        ))}
      </div>
    </section>
  );
}

// ─── Helpers ───

function getChainAgents(chainId: string, agents: Agent[], chain?: AgentChain): Agent[] {
  if (!chain) return [];
  return chain.agent_ids
    .map(id => agents.find(a => a.id === id))
    .filter((a): a is Agent => !!a);
}
