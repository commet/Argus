'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Check, Sparkles } from 'lucide-react';
import { useLocale } from '@/hooks/useLocale';
import { useProgressiveStore } from '@/stores/useProgressiveStore';
import { voyageLogToMarkdown } from '@/lib/export';
import { getSessionDeltas } from '@/lib/agent-stats';
import type { MixResult } from '@/stores/types';
import { ShareBar } from '@/components/ui/ShareBar';
import { AttributedSection } from './AttributedSection';
import { renderInline, renderMd } from './shared/renderMd';
import { EASE } from './shared/constants';

/* ═══ Final deliverable — triumphant, widest ═══ */
export function FinalCard({
  content,
  mix,
  releasedContent,
  releasedLabel,
  sessionId,
}: {
  content: string;
  mix?: MixResult | null;
  /** When set, the Copy button copies this instead of `content`. Used when
   *  the user has promoted a draft to v1.x and is currently viewing a
   *  branch experiment — we want the "shared" text to always be the
   *  released version per Decision #5 (a). */
  releasedContent?: string | null;
  releasedLabel?: string | null;
  /** Drives the agent-growth footer. When provided, FinalCard derives the
   *  per-agent XP/level deltas accrued during this session from the
   *  activities log and renders a small celebration footer. */
  sessionId?: string | null;
}) {
  const locale = useLocale();
  const L = (ko: string, en: string) => locale === 'ko' ? ko : en;
  const logSession = useProgressiveStore(s => (sessionId ? s.sessions.find(ss => ss.id === sessionId) : null) ?? null);
  const baseTarget = releasedContent && releasedContent.length > 0 ? releasedContent : content;
  // The decision trail ("the process is the deliverable") is available, but
  // OPT-IN: most users expect Copy to give a clean document, not 2–3× the
  // length with the full history. Default to the clean doc; the toggle below
  // lets power users append the ship's log.
  const voyageLog = voyageLogToMarkdown(logSession, locale as 'ko' | 'en');
  const [withLog, setWithLog] = useState(false);
  const copyTarget = withLog && voyageLog ? `${baseTarget}\n\n---\n\n${voyageLog}\n` : baseTarget;
  const copyLabel = releasedContent && releasedContent !== content && releasedLabel
    ? L(`${releasedLabel} 복사`, `Copy ${releasedLabel}`)
    : L('복사', 'Copy');

  // When we have the structured mix, render it with attribution; fall back to flat markdown otherwise.
  const hasStructured = !!mix && mix.sections.length > 0;

  return (
    <motion.div initial={{ opacity: 0, y: 30, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.9, ease: EASE }}>
      <div className="rounded-2xl md:rounded-[2rem] p-[2px] bg-gradient-to-b from-[var(--accent)]/30 via-[var(--accent)]/10 to-transparent shadow-[var(--shadow-xl)]">
        <div className="rounded-[calc(1rem-2px)] md:rounded-[calc(2rem-2px)] bg-[var(--surface)] shadow-[inset_0_2px_4px_rgba(255,255,255,0.6)]">
          <div className="h-[3px]" style={{ background: 'var(--gradient-gold)' }} />
          <div className="px-5 md:px-7 py-4 flex items-center justify-between border-b border-[var(--border-subtle)]">
            <div className="flex items-center gap-3">
              <div className="w-7 h-7 rounded-full flex items-center justify-center" style={{ background: 'var(--gradient-gold)' }}>
                <Check size={13} className="text-white" />
              </div>
              <div>
                <span className="text-[14px] font-semibold text-[var(--text-primary)]">{L('완성된 기획안', 'Final Document')}</span>
                <span className="text-[11px] text-[var(--text-tertiary)] ml-2">{L('바로 보낼 수 있어요', 'Ready to send')}</span>
              </div>
            </div>
            <ShareBar
              getText={() => copyTarget}
              getTitle={() => mix?.title || L('Argus 기획안', 'Argus Document')}
              copyLabel={copyLabel}
            />
          </div>
          {voyageLog && (
            <div className="px-5 md:px-7 py-2 border-b border-[var(--border-subtle)] flex items-center justify-end">
              <label className="flex items-center gap-1.5 text-[11px] text-[var(--text-tertiary)] cursor-pointer hover:text-[var(--text-secondary)] transition-colors">
                <input type="checkbox" checked={withLog} onChange={(e) => setWithLog(e.target.checked)}
                  className="accent-[var(--accent)] cursor-pointer" />
                {L('복사·공유에 항해일지(결정 과정)도 포함', 'Also include the decision log when copying/sharing')}
              </label>
            </div>
          )}
          {hasStructured ? (
            <div className="p-5 md:p-8 space-y-5">
              <h2 className="text-[22px] md:text-[26px] font-bold text-[var(--text-primary)] leading-tight tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>{mix!.title}</h2>
              <blockquote className="border-l-[3px] border-[var(--accent)]/20 pl-5 text-[14px] text-[var(--text-secondary)] italic leading-relaxed">
                {renderInline(mix!.executive_summary)}
              </blockquote>
              <div className="space-y-5">
                {mix!.sections.map((s, i) => (
                  <AttributedSection key={i} section={s} index={i} />
                ))}
              </div>
              {mix!.next_steps.length > 0 && (
                <div className="pt-5 border-t border-[var(--border-subtle)]">
                  <p className="text-[9px] font-bold text-[var(--text-tertiary)] uppercase tracking-[0.2em] mb-3">{L('다음 단계', 'Next Steps')}</p>
                  {mix!.next_steps.map((step, i) => (
                    <div key={i} className="flex items-start gap-2.5 text-[13px] text-[var(--text-primary)] mb-2 leading-relaxed">
                      <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] mt-2 shrink-0" />
                      <span>{step}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="p-5 md:p-8 space-y-1">{renderMd(content)}</div>
          )}
          {/* Agent-growth footer — surfaces XP/level changes from this
              session so the user sees their team becoming more theirs. Only
              renders when at least one agent earned XP in this session. */}
          {sessionId && (() => {
            const deltas = getSessionDeltas(sessionId);
            if (deltas.length === 0) return null;
            // Surface up to 4 agents to avoid clutter; the rest summed.
            const top = deltas.slice(0, 4);
            const rest = deltas.slice(4);
            const restXp = rest.reduce((acc, d) => acc + d.xpGained, 0);
            const anyLevelUp = deltas.some(d => d.leveledUp);
            return (
              <div className="px-5 md:px-7 py-4 border-t border-[var(--border-subtle)]/60 bg-[var(--accent)]/[0.02]">
                <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--accent)] mb-2 flex items-center gap-1.5">
                  <Sparkles size={11} />
                  {anyLevelUp
                    ? L('이번 분석으로 팀이 한 단계 성장했어요', 'Your team leveled up from this run')
                    : L('이번 분석으로 팀이 더 똑똑해졌어요', 'Your team grew from this run')}
                </div>
                <div className="flex flex-wrap gap-x-3 gap-y-1.5 text-[12px] text-[var(--text-secondary)]">
                  {top.map(d => (
                    <span key={d.agentId} className="inline-flex items-baseline gap-1">
                      <span className="text-[var(--text-primary)] font-medium">{d.name}</span>
                      <span className="text-[var(--accent)] tabular-nums">+{d.xpGained}XP</span>
                      {d.leveledUp && (
                        <span className="text-[10px] font-bold text-[var(--accent)] bg-[var(--accent)]/10 px-1.5 py-0.5 rounded">
                          Lv.{d.fromLevel}→{d.toLevel}
                        </span>
                      )}
                    </span>
                  ))}
                  {rest.length > 0 && (
                    <span className="text-[var(--text-tertiary)] tabular-nums">
                      {L(`외 ${rest.length}명 +${restXp}XP`, `+${rest.length} more (+${restXp}XP)`)}
                    </span>
                  )}
                </div>
              </div>
            );
          })()}
        </div>
      </div>
    </motion.div>
  );
}
