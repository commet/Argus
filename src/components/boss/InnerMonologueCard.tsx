'use client';

import { useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Lock, Sparkles } from 'lucide-react';
import { useBossStore } from '@/stores/useBossStore';
import { useAgentStore } from '@/stores/useAgentStore';
import { callLLMStream } from '@/lib/llm';
import {
  buildInnerMonologuePrompt,
  buildInnerMonologuePromptFromAgent,
} from '@/lib/boss/boss-prompt';
import { computeDailyMood } from '@/lib/boss/daily-energy';
import type { InnerMonologueArchiveEntry } from '@/stores/agent-types';
import { useT } from '@/contexts/LocaleProvider';
import { track } from '@/lib/analytics';
import { useLocale } from '@/hooks/useLocale';

interface InnerMonologueCardProps {
  verdict: { verdict: string; reason: string; tip?: string };
}

/**
 * 이면(裏面) 공개 카드.
 * 판정 직후 등장. 잠긴 상태에서 tap 시 팀장 속마음을 스트리밍으로 공개.
 * "표면 vs 이면"의 간극이 감정적 피크를 만드는 장치.
 */
export function InnerMonologueCard({ verdict }: InnerMonologueCardProps) {
  const t = useT();
  const locale = useLocale();
  const {
    innerMonologue,
    innerStreamingText,
    innerLoading,
    startInnerMonologue,
    updateInnerStreamingText,
    commitInnerMonologue,
    getPersonalityType,
    sajuProfile,
    yearMonthProfile,
    zodiacProfile,
    gender,
    loadedAgentId,
  } = useBossStore();

  const typeData = getPersonalityType();
  const abortRef = useRef<AbortController | null>(null);

  const revealed = !!innerMonologue || innerLoading || !!innerStreamingText;
  // "Hidden layer" = saju for Korean, zodiac for English.
  const hasHiddenLayer = !!sajuProfile || !!yearMonthProfile || !!zodiacProfile;

  const handleReveal = useCallback(async () => {
    if (!typeData || innerLoading || innerMonologue) return;
    track('boss_inner_revealed', { mbti: typeData.code, verdict });

    const agent = loadedAgentId ? useAgentStore.getState().getAgent(loadedAgentId) : undefined;
    const system = agent?.personality_profile
      ? buildInnerMonologuePromptFromAgent(agent, verdict)
      : buildInnerMonologuePrompt(
          {
            type: typeData,
            saju: sajuProfile,
            yearMonth: yearMonthProfile,
            zodiac: zodiacProfile,
            gender,
            locale,
          },
          verdict,
        );

    startInnerMonologue();
    abortRef.current = new AbortController();

    await callLLMStream(
      [{ role: 'user', content: t('boss.innerMonologuePrompt') }],
      { system, maxTokens: 300, signal: abortRef.current.signal },
      {
        onToken: (text) => updateInnerStreamingText(text),
        onComplete: (fullText) => {
          commitInnerMonologue();
          // 저장된 팀장이면 archive에 기록 push
          const text = (fullText || '').trim();
          if (loadedAgentId && text) {
            const agentStore = useAgentStore.getState();
            const currentAgent = agentStore.getAgent(loadedAgentId);
            if (currentAgent) {
              const daily = yearMonthProfile ? computeDailyMood(yearMonthProfile) : null;
              const entry: InnerMonologueArchiveEntry = {
                id: `ima-${Date.now()}`,
                created_at: new Date().toISOString(),
                text,
                verdict: verdict.verdict,
                verdict_reason: verdict.reason,
                situation: useBossStore.getState().lastSituation || '',
                daily_mood: daily?.mood,
                daily_mood_label: daily?.label,
                daily_name: daily?.breakdown.today.name,
              };
              const existing = currentAgent.inner_monologue_archive || [];
              // 가장 최근 20개만 유지
              const updated = [...existing, entry].slice(-20);
              agentStore.updateAgent(loadedAgentId, { inner_monologue_archive: updated });
            }
          }
        },
        onError: () => {
          updateInnerStreamingText(t('boss.innerStreamError'));
          commitInnerMonologue();
        },
      },
    );
  }, [t, typeData, sajuProfile, yearMonthProfile, zodiacProfile, gender, locale, loadedAgentId, verdict,
      innerLoading, innerMonologue, startInnerMonologue, updateInnerStreamingText, commitInnerMonologue]);

  // ─── Locked state ───
  if (!revealed) {
    return (
      <motion.button
        type="button"
        onClick={handleReveal}
        className="bc-inner bc-inner-locked"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.8, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        whileHover={{ scale: 1.01 }}
        whileTap={{ scale: 0.99 }}
      >
        <div className="bc-inner-locked-glow" />
        <div className="bc-inner-locked-row">
          {/* A4 retheme: the wiggling lock + pulsing sparkle were divination
              theater; the sealed memo sits still (hover/tap feedback remains). */}
          <div className="bc-inner-locked-icon">
            <Lock size={18} strokeWidth={2} />
          </div>
          <div className="bc-inner-locked-copy">
            <span className="bc-inner-locked-title">
              {t('boss.insideReveal', { name: typeData?.name || '' })}
            </span>
            <span className="bc-inner-locked-sub">
              {hasHiddenLayer
                ? t('boss.insideHint1')
                : t('boss.innerLockedNoHidden')}
            </span>
          </div>
          <span className="bc-inner-locked-sparkle">
            <Sparkles size={14} />
          </span>
        </div>
      </motion.button>
    );
  }

  // ─── Revealed / Streaming state ───
  const text = innerMonologue || innerStreamingText;
  const isStreaming = innerLoading && !innerMonologue;

  return (
    <motion.div
      className="bc-inner bc-inner-revealed"
      initial={{ opacity: 0, y: 12, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="bc-inner-revealed-header">
        <span className="bc-inner-revealed-emoji">{typeData?.emoji || '👔'}</span>
        <div className="bc-inner-revealed-meta">
          <span className="bc-inner-revealed-label">{t('boss.innerReveledLabel')}</span>
          <span className="bc-inner-revealed-sub">{t('boss.innerRevealedSub', { name: typeData?.name || '' })}</span>
        </div>
        {hasHiddenLayer && (
          <span className="bc-inner-revealed-saju" title={t('boss.innerSajuTooltip')}>
            <Sparkles size={12} />
          </span>
        )}
      </div>
      {/* Honest-provenance: the "just for fun" caveat was tooltip-only (invisible
          on touch). Surface it as a visible, quiet line so no one mistakes the
          saju flavor for a real read on someone's nature. */}
      {hasHiddenLayer && (
        <p style={{ margin: '2px 0 0', fontSize: 10.5, lineHeight: 1.5, opacity: 0.72, fontStyle: 'italic' }}>
          {t('boss.innerSajuTooltip')}
        </p>
      )}
      <AnimatePresence mode="wait">
        <motion.p
          key={isStreaming ? 'streaming' : 'final'}
          className="bc-inner-text"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4 }}
        >
          {text || (
            <motion.span
              animate={{ opacity: [0.3, 0.8, 0.3] }}
              transition={{ repeat: Infinity, duration: 1.6 }}
              style={{ color: 'var(--text-tertiary)', fontStyle: 'italic' }}
            >
              {t('boss.returningToSeat')}
            </motion.span>
          )}
          {isStreaming && text && (
            <motion.span
              className="bc-inner-caret"
              animate={{ opacity: [1, 0, 1] }}
              transition={{ repeat: Infinity, duration: 0.9 }}
            />
          )}
        </motion.p>
      </AnimatePresence>
    </motion.div>
  );
}
