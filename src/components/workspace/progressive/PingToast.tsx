'use client';

/**
 * PingToast — short-lived pill that confirms the user's input reached the team.
 *
 * Subscribes to `lastPingAt` / `lastPingSource` from `useAgentAttentionStore`.
 * When the store fires a ping, we show a small toast at the top-right of the
 * main column for ~2s. The toast slides right-ward (toward the sidebar) to
 * reinforce the mental model that the input is "traveling" to the agents.
 *
 * Mount once near the top of the progressive flow's main scroll area.
 */

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, ArrowDown, CheckCircle2 } from 'lucide-react';
import { useAgentAttentionStore, type PingSource } from '@/stores/useAgentAttentionStore';
import { useLocale } from '@/hooks/useLocale';
import { EASE } from './shared/constants';

const VISIBLE_MS = 2100;

type ToastKind = 'input' | 'output';

function messageFor(source: PingSource | null, locale: string): { text: string; kind: ToastKind } {
  const L = (ko: string, en: string) => locale === 'ko' ? ko : en;
  switch (source) {
    case 'answer':
      return { text: L('답변을 팀에 전달했어요', 'Sent to the team'), kind: 'input' };
    case 'chat':
      return { text: L('요청을 팀에 전달했어요', 'Request sent to the team'), kind: 'input' };
    case 'retry':
      return { text: L('다시 분석 시작', 'Re-analysis started'), kind: 'input' };
    case 'deploy':
      return { text: L('팀이 작업을 시작했어요', 'Team started working'), kind: 'input' };
    case 'workers_done':
      return { text: L('검토 결과가 준비됐어요', 'Review findings are ready'), kind: 'output' };
    case 'mix_done':
      return { text: L('정리 끝났어요', 'Write-up ready'), kind: 'output' };
    case 'dm_ready':
      return { text: L('리뷰 피드백 도착', 'Review feedback in'), kind: 'output' };
    case 'final_done':
      return { text: L('최종 문서 완성', 'Final document ready'), kind: 'output' };
    default:
      return { text: L('팀에 전달했어요', 'Sent to the team'), kind: 'input' };
  }
}

export function PingToast() {
  const locale = useLocale();
  const lastPingAt = useAgentAttentionStore(s => s.lastPingAt);
  const lastSource = useAgentAttentionStore(s => s.lastPingSource);
  const [visiblePing, setVisiblePing] = useState<{ at: number; source: PingSource | null } | null>(null);

  useEffect(() => {
    if (!lastPingAt) return;
    // Defer one microtask so setState isn't called synchronously during the subscribe callback.
    const showTimer = setTimeout(() => setVisiblePing({ at: lastPingAt, source: lastSource }), 0);
    const hideTimer = setTimeout(() => setVisiblePing(null), VISIBLE_MS);
    return () => {
      clearTimeout(showTimer);
      clearTimeout(hideTimer);
    };
  }, [lastPingAt, lastSource]);

  const msg = visiblePing ? messageFor(visiblePing.source, locale) : null;
  // Output toasts travel leftward (from sidebar back to the user) and sit a bit
  // larger/brighter so the "new content below" cue reads without motion sickness.
  const isOutput = msg?.kind === 'output';

  return (
    <div className="absolute top-4 right-4 z-20 pointer-events-none">
      <AnimatePresence>
        {visiblePing && msg && (
          <motion.div
            key={visiblePing.at}
            initial={{ opacity: 0, x: isOutput ? 12 : -12, scale: 0.94 }}
            animate={
              isOutput
                ? { opacity: [0, 1, 1, 0], x: [12, 0, -6, -18], scale: [0.94, 1, 1, 0.96] }
                : { opacity: [0, 1, 1, 0], x: [-12, 0, 18, 36], scale: [0.94, 1, 1, 0.96] }
            }
            exit={{ opacity: 0 }}
            transition={{ duration: VISIBLE_MS / 1000, ease: EASE, times: [0, 0.12, 0.78, 1] }}
            className={
              isOutput
                ? 'inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-[var(--surface)] border border-[var(--accent)]/35 shadow-[0_0_18px_-4px_rgba(180,160,100,0.55)]'
                : 'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[var(--surface)] border border-[var(--accent)]/25 shadow-[0_0_14px_-4px_rgba(180,160,100,0.4)]'
            }
          >
            <motion.span
              animate={isOutput ? { y: [0, 2, 0] } : { x: [0, 2, 0] }}
              transition={{ duration: 1, repeat: Infinity, ease: 'easeInOut' }}
              className="flex"
            >
              {isOutput
                ? (visiblePing.source === 'final_done'
                    ? <CheckCircle2 size={12} className="text-[var(--accent)]" />
                    : <ArrowDown size={12} className="text-[var(--accent)]" />)
                : <ArrowRight size={11} className="text-[var(--accent)]" />}
            </motion.span>
            <span className={`${isOutput ? 'text-[12px]' : 'text-[12.5px]'} font-semibold text-[var(--accent)] whitespace-nowrap`}>
              {msg.text}
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
