'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Sparkles } from 'lucide-react';
import { useAgentStore } from '@/stores/useAgentStore';
import { useT } from '@/contexts/LocaleProvider';

interface PastVerdictRecapProps {
  agentId: string;
}

const VERDICT_META: Record<string, { labelKey: Parameters<ReturnType<typeof useT>>[0]; icon: string; color: string }> = {
  approved: { labelKey: 'boss.verdict.approved', icon: '✅', color: 'rgb(29, 125, 63)' },
  conditional: { labelKey: 'boss.verdict.conditionalShort', icon: '🤔', color: 'rgb(184, 150, 62)' },
  rejected: { labelKey: 'boss.verdict.rejected', icon: '❌', color: 'rgb(220, 53, 69)' },
};

/**
 * 저장된 boss를 로드했을 때, 복원된 대화 스레드 뒤에 표시.
 * 현재 세션의 verdict는 local state라 복원되지 않는데,
 * agent.inner_monologue_archive의 마지막 entry를 "이전 결론" 카드로 복구한다.
 * 감정 완결성 + 지난 이면 재열람 루프 동시 달성.
 */
export function PastVerdictRecap({ agentId }: PastVerdictRecapProps) {
  const t = useT();
  const agent = useAgentStore(s => s.agents.find(a => a.id === agentId));
  const [openInner, setOpenInner] = useState(false);

  if (!agent || !agent.inner_monologue_archive || agent.inner_monologue_archive.length === 0) {
    return null;
  }

  const latest = agent.inner_monologue_archive[agent.inner_monologue_archive.length - 1];
  const total = agent.inner_monologue_archive.length;
  const verdictMeta = VERDICT_META[latest.verdict] || VERDICT_META.conditional;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className="bc-recap"
    >
      <div className="bc-recap-header">
        <span className="bc-recap-icon">{verdictMeta.icon}</span>
        <div className="bc-recap-meta">
          <span className="bc-recap-label">{t('boss.lastVerdict')}</span>
          <span className="bc-recap-verdict" style={{ color: verdictMeta.color }}>
            {t(verdictMeta.labelKey)}
          </span>
          {latest.situation && (
            <span className="bc-recap-situation">— {latest.situation}</span>
          )}
        </div>
      </div>
      {latest.verdict_reason && (
        <p className="bc-recap-reason">{latest.verdict_reason}</p>
      )}
      <button
        type="button"
        onClick={() => setOpenInner(!openInner)}
        className="bc-recap-toggle"
      >
        <Sparkles size={11} />
        <span>{openInner ? t('boss.innerCollapse') : t('boss.innerView')}</span>
        {total > 1 && !openInner && (
          <span className="bc-recap-count">{t('boss.totalEntries', { n: total })}</span>
        )}
        <ChevronDown
          size={12}
          style={{
            transform: openInner ? 'rotate(180deg)' : 'rotate(0)',
            transition: 'transform 0.25s',
            marginLeft: 'auto',
          }}
        />
      </button>
      <AnimatePresence>
        {openInner && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            style={{ overflow: 'hidden' }}
          >
            <div className="bc-recap-inner">
              <p className="bc-recap-inner-text">{latest.text}</p>
              {latest.daily_mood_label && (
                <p className="bc-recap-inner-meta">
                  {t('boss.dailyMood', { label: latest.daily_mood_label })}
                  {latest.daily_name ? t('boss.dailyName', { name: latest.daily_name }) : ''}
                </p>
              )}
              {total > 1 && (
                <p className="bc-recap-inner-hint">
                  {t('boss.allInProfile', { n: total })}
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
