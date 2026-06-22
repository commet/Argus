'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RefreshCw, MessageSquare, Share2 } from 'lucide-react';
import { useBossStore } from '@/stores/useBossStore';
import { pickScenarios, detectCategory, getDifficultyLabel, type Scenario } from '@/lib/boss/scenarios';
import { CollectionProgress } from './CollectionProgress';
import { InnerMonologueCard } from './InnerMonologueCard';
import { useT } from '@/contexts/LocaleProvider';
import { useLocale } from '@/hooks/useLocale';

interface PostVerdictPanelProps {
  verdict: { verdict: string; reason: string; tip?: string };
  onShare: () => void;
}

export function PostVerdictPanel({ verdict, onShare }: PostVerdictPanelProps) {
  const t = useT();
  const locale = useLocale();
  const L = (ko: string, en: string) => (locale === 'ko' ? ko : en);
  const { lastSituation, reset, resetForNewSituation, addUserMessage, startChat } = useBossStore();

  const [showScenarios, setShowScenarios] = useState(false);

  // 시나리오 추천
  const currentCategory = detectCategory(lastSituation);
  const scenarios = pickScenarios(null, currentCategory);

  // §2.4-4: "다른 유형" used to slot-machine a RANDOM next personality
  // (resetForNewType picked a random MBTI). That random pull + the collect-all
  // grid was the gamification the thesis forbids. Now it returns to setup so the
  // user DELIBERATELY chooses which boss to rehearse next — a choice, not a pull.
  const handleNewType = () => {
    reset();
  };

  const handleScenario = (scenario: Scenario) => {
    resetForNewSituation();
    addUserMessage(locale === 'en' ? scenario.textEn : scenario.text);
    startChat();
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.5, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      style={{ margin: '12px 0', display: 'flex', flexDirection: 'column', gap: 12 }}
    >
      {/* ── Hero: 이면 공개 (판정 직후 감정의 피크) ── */}
      <InnerMonologueCard verdict={verdict} />

      {/* ── Secondary actions: shown right after the verdict, no longer gated
          behind the optional inner-monologue reveal (a user who just wants to
          share or try another type could previously never reach these). ── */}
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      >
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <button
                onClick={handleNewType}
                className="bc-post-btn"
                title={L('다른 팀장 유형을 직접 골라 리허설해요', 'Pick a different boss type to rehearse')}
              >
                <RefreshCw size={12} />
                <span>{L('다른 팀장', 'Another boss')}</span>
              </button>
              <button
                onClick={() => setShowScenarios(!showScenarios)}
                className="bc-post-btn"
              >
                <MessageSquare size={12} />
                <span>{t('boss.otherSituation')}</span>
              </button>
              <button
                onClick={onShare}
                className="bc-post-btn"
              >
                <Share2 size={12} />
                <span>{t('boss.share')}</span>
              </button>
            </div>

            {/* Scenario suggestions (expandable) */}
            <AnimatePresence>
              {showScenarios && (
                <motion.div
                  initial={{ opacity: 0, height: 0, marginTop: 0 }}
                  animate={{ opacity: 1, height: 'auto', marginTop: 10 }}
                  exit={{ opacity: 0, height: 0, marginTop: 0 }}
                  transition={{ duration: 0.25 }}
                  style={{ overflow: 'hidden' }}
                >
                  <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-tertiary)', letterSpacing: '0.05em', textTransform: 'uppercase', margin: '0 0 6px' }}>
                    {t('boss.trySituations')}
                  </p>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {scenarios.map(s => {
                      const diff = getDifficultyLabel(s.difficulty, locale);
                      return (
                        <button
                          key={s.id}
                          onClick={() => handleScenario(s)}
                          style={{
                            flex: 1, padding: '10px 8px', borderRadius: 12,
                            background: 'var(--bg)', border: '1px solid var(--border-subtle)',
                            cursor: 'pointer', textAlign: 'center',
                            transition: 'border-color 0.15s, transform 0.1s',
                          }}
                          onMouseOver={e => (e.currentTarget.style.borderColor = 'var(--accent)')}
                          onMouseOut={e => (e.currentTarget.style.borderColor = 'var(--border-subtle)')}
                        >
                          <span style={{ fontSize: 20, display: 'block', marginBottom: 4 }}>{s.emoji}</span>
                          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', display: 'block' }}>{locale === 'en' ? s.displayTextEn : s.displayText}</span>
                          <span style={{ fontSize: 10, color: diff.color, fontWeight: 500 }}>{diff.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div style={{ marginTop: 10 }}>
              <CollectionProgress />
            </div>
      </motion.div>
    </motion.div>
  );
}
