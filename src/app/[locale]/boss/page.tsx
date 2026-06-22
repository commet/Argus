'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { BossSetup } from '@/components/boss/BossSetup';
import { BossChat } from '@/components/boss/BossChat';
import { useBossStore } from '@/stores/useBossStore';
import { useAgentStore } from '@/stores/useAgentStore';
import type { Agent } from '@/stores/agent-types';
import { useLocale } from '@/hooks/useLocale';
import { track } from '@/lib/analytics';

function SavedBossList() {
  const locale = useLocale();
  const L = (ko: string, en: string) => locale === 'ko' ? ko : en;
  const [bosses, setBosses] = useState<Agent[]>([]);
  const loadBossFromAgent = useBossStore(s => s.loadBossFromAgent);

  useEffect(() => {
    const store = useAgentStore.getState();
    if (store.agents.length === 0) store.loadAgents();
    setBosses(store.agents.filter(a => a.origin === 'boss_sim' && !a.archived));
  }, []);

  if (bosses.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3, duration: 0.4 }}
      style={{ padding: '0 24px', maxWidth: 520, margin: '0 auto 24px' }}
    >
      <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 10 }}>
        {L('저장된 팀장', 'Saved bosses')}
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {bosses.map(boss => {
          const turns = boss.chat_history?.length ?? 0;
          const obsCount = boss.observations?.length ?? 0;
          return (
            <button
              key={boss.id}
              onClick={() => {
                track('boss_loaded_from_agent', {
                  source: 'saved_list',
                  mbti: boss.personality_code,
                  prior_turns: boss.chat_history?.length ?? 0,
                  observation_count: boss.observations?.length ?? 0,
                });
                loadBossFromAgent(boss.id);
              }}
              className="agent-card"
              style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12, minWidth: 0, textAlign: 'left', width: '100%' }}
            >
              <span style={{ fontSize: 22, flexShrink: 0 }}>{boss.emoji}</span>
              <div style={{ minWidth: 0, flex: 1, display: 'flex', flexDirection: 'column', gap: 3 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {boss.name}
                  </span>
                  {boss.personality_code && (
                    <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-tertiary)', letterSpacing: '0.02em' }}>
                      {boss.personality_code}
                    </span>
                  )}
                  {boss.level >= 2 && (
                    <span className="agent-lv" data-level={boss.level} style={{ fontSize: 10 }}>
                      Lv.{boss.level}
                    </span>
                  )}
                </div>
                {(turns > 0 || obsCount > 0) && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, color: 'var(--text-tertiary)' }}>
                    {obsCount > 0 && (
                      <span>{L(`${obsCount}개 관찰로 다듬어짐`, `Refined by ${obsCount} observation${obsCount === 1 ? '' : 's'}`)}</span>
                    )}
                    {obsCount > 0 && turns > 0 && <span>·</span>}
                    {turns > 0 && (
                      <span>{L(`지난 대화 ${turns}턴`, `${turns} prior turn${turns === 1 ? '' : 's'}`)}</span>
                    )}
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </motion.div>
  );
}

function AutoLoadAgent() {
  const searchParams = useSearchParams();
  const loadBossFromAgent = useBossStore(s => s.loadBossFromAgent);
  const reset = useBossStore(s => s.reset);

  useEffect(() => {
    const agentId = searchParams?.get('agent');
    if (!agentId) return;

    const agentStore = useAgentStore.getState();
    if (agentStore.agents.length === 0) agentStore.loadAgents();

    // 약간 지연 — loadAgents가 동기여도 Supabase 머지는 비동기라 초기엔 local만 있음.
    // local에서 찾히면 바로 로드, 없으면 Supabase 머지 대기 후 재시도.
    const tryLoad = () => {
      const agent = useAgentStore.getState().getAgent(agentId);
      if (agent && agent.origin === 'boss_sim' && agent.personality_code) {
        track('boss_loaded_from_agent', {
          source: 'url_param',
          mbti: agent.personality_code,
          prior_turns: agent.chat_history?.length ?? 0,
          observation_count: agent.observations?.length ?? 0,
        });
        reset();
        loadBossFromAgent(agentId);
        return true;
      }
      return false;
    };
    if (!tryLoad()) {
      const timer = setTimeout(() => tryLoad(), 800);
      return () => clearTimeout(timer);
    }
  }, [searchParams, loadBossFromAgent, reset]);

  return null;
}

/**
 * Optional URL-driven 30-second demo path.
 *
 *   /boss?demo=1                — default demo (ENTJ + sample situation)
 *   /boss?demo=ENFP             — pick a specific MBTI archetype
 *   /boss?demo=1&lang=en        — locale honored by useLocale
 *
 * Pre-fills MBTI axes + birth year + situation, then signals BossSetup to
 * autosubmit. Lets a curious share-link visitor reach the chat without
 * configuring anything.
 */
function AutoDemo() {
  const searchParams = useSearchParams();
  const setAxis = useBossStore(s => s.setAxis);
  const setBirth = useBossStore(s => s.setBirth);
  const setGender = useBossStore(s => s.setGender);
  const setDemoSituation = useBossStore(s => s.setDemoSituation);
  const locale = useLocale();

  useEffect(() => {
    const demo = searchParams?.get('demo');
    if (!demo) return;
    // If both ?demo= and ?agent= are present, the saved-agent restore wins —
    // AutoLoadAgent's loadBossFromAgent would otherwise be silently overridden
    // by the demo's axes/birth/situation overrides.
    if (searchParams?.get('agent')) return;
    const code = (demo.length === 4 && /^[EI][SN][TF][JP]$/i.test(demo) ? demo.toUpperCase() : 'ENTJ');
    setAxis('ei', code[0]);
    setAxis('sn', code[1]);
    setAxis('tf', code[2]);
    setAxis('jp', code[3]);
    setGender('남');
    setBirth(1985, 5, 15);
    const sample = locale === 'ko'
      ? '팀장님, 다음 주에 한 번만 재택 가능할까요?'
      : "Hey — could I work from home one day next week?";
    setDemoSituation(sample);
  }, [searchParams, setAxis, setBirth, setGender, setDemoSituation, locale]);

  return null;
}

function BossPageContent() {
  const phase = useBossStore((s) => s.phase);

  return (
    <main className="boss-page">
      <AutoLoadAgent />
      <AutoDemo />
      <AnimatePresence mode="wait">
        {phase === 'setup' ? (
          <div key="setup-wrapper">
            <SavedBossList />
            <BossSetup key="setup" />
          </div>
        ) : (
          <BossChat key="chat" />
        )}
      </AnimatePresence>
    </main>
  );
}

export default function BossPage() {
  return (
    <Suspense fallback={<main className="boss-page" />}>
      <BossPageContent />
    </Suspense>
  );
}
