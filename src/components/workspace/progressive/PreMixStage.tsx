'use client';

/**
 * PreMixStage — the draft-staging UI shown once the team has finished and the
 * user is about to create the first draft (all four blocks share the same
 * shouldMix && !busy && conversing && !curQ gate): the worker status summary,
 * the team-analysis-complete divider, the optional "add my thoughts" notes
 * input, and the VoyagePrepSummary mix CTA. Behaviour-preserving.
 */

import type { RefObject } from 'react';
import { motion } from 'framer-motion';
import { useLocale } from '@/hooks/useLocale';
import { EASE } from './shared/constants';
import { personaName } from './shared/persona-format';
import { AvatarRow } from './WorkerAvatar';
import { PhaseDivider, VoyagePrepSummary } from './ProgressiveFlowParts';
import type { WorkerTask, AnalysisSnapshot, FlowQuestion, ProgressiveSession } from '@/stores/types';
import type { ProgressiveState } from '@/stores/useProgressiveStore';

interface PreMixStageProps {
  shouldMix: boolean;
  busy: boolean;
  phase: string;
  curQ: FlowQuestion | null;
  workers: WorkerTask[];
  session: ProgressiveSession;
  store: ProgressiveState;
  latest: AnalysisSnapshot | null;
  onMix: () => void;
  onMore: () => void;
  scrollToRef: (ref: RefObject<HTMLElement | null>, fallback?: 'top' | 'bottom') => void;
  answeredPillsRef: RefObject<HTMLDivElement | null>;
}

export function PreMixStage({
  shouldMix, busy, phase, curQ, workers, session, store, latest, onMix, onMore,
  scrollToRef, answeredPillsRef,
}: PreMixStageProps) {
  const locale = useLocale();
  const L = (ko: string, en: string) => (locale === 'ko' ? ko : en);
  return (
    <>
          {/* Worker status summary before mix — with persona names */}
          {shouldMix && !busy && phase === 'conversing' && !curQ && workers.length > 0 && (() => {
            const items = workers.map(w => {
              const name = personaName(w.persona, locale) || 'AI';
              if (w.approved === true) return `${name} ✓`;
              if (w.approved === false) return `${name} ✗`;
              if (w.status === 'done') return `${name} ⏳`;
              if (w.status === 'running') return `${name} ●`;
              return null;
            }).filter(Boolean);
            return items.length > 0 ? (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[var(--bg)]/60 text-[12px] text-[var(--text-secondary)]">
                <AvatarRow personas={workers.map(w => w.persona)} maxShow={5} />
                <span>{items.join(' · ')}</span>
              </motion.div>
            ) : null;
          })()}

          {/* PhaseDivider: Team analysis complete → create draft */}
          {shouldMix && !busy && phase === 'conversing' && !curQ && (
            <PhaseDivider done={L('팀 분석 완료', 'Team analysis done')} next={L('초안 작성 시작', 'Create draft')} yourTurn />
          )}

          {/* UserNotesInput — add your thoughts before mixing */}
          {shouldMix && !busy && phase === 'conversing' && !curQ && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: EASE }}
              className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] p-4 md:p-5">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-5 h-5 rounded-full bg-[var(--text-primary)] flex items-center justify-center shrink-0">
                  <span className="text-[var(--bg)] text-[8px] font-bold">{L('나', 'Me')}</span>
                </div>
                <span className="text-[13px] font-medium text-[var(--text-primary)]">{L('내 생각 추가', 'Add my thoughts')}</span>
                <span className="text-[11px] text-[var(--text-tertiary)]">({L('선택', 'optional')})</span>
              </div>
              <textarea
                value={session?.user_notes || ''}
                onChange={(e) => store.setUserNotes(e.target.value || null)}
                placeholder={L('팀 분석에 빠진 것, 강조할 점, 방향 수정 등', 'What the team missed, what to emphasize, direction changes...')}
                rows={3} maxLength={500}
                className="w-full px-4 py-3 rounded-xl bg-[var(--bg)] border border-[var(--border-subtle)] text-base md:text-[13px] text-[var(--text-primary)] leading-relaxed resize-none focus:outline-none focus:border-[var(--accent)]/40 transition-all placeholder:text-[var(--text-tertiary)]"
              />
            </motion.div>
          )}

          {shouldMix && !busy && phase === 'conversing' && !curQ && latest && (
            <VoyagePrepSummary
              snapshot={latest}
              onMix={onMix}
              onMore={onMore}
              onRevisit={() => scrollToRef(answeredPillsRef, 'bottom')}
              busy={busy}
            />
          )}
    </>
  );
}
