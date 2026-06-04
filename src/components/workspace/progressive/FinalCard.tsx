'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, Sparkles, ChevronDown } from 'lucide-react';
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
            <div className="px-5 md:px-7 py-3 border-b border-[var(--border-subtle)] bg-[var(--accent)]/[0.04]">
              <label className="flex items-start gap-2.5 cursor-pointer group">
                <input type="checkbox" checked={withLog} onChange={(e) => setWithLog(e.target.checked)}
                  className="accent-[var(--accent)] cursor-pointer mt-0.5" />
                <span className="flex-1">
                  <span className="block text-[12.5px] font-medium text-[var(--text-primary)] group-hover:text-[var(--accent)] transition-colors">
                    {L('항해일지(결정 과정)도 함께 담기', 'Include the decision log (your reasoning trail)')}
                  </span>
                  <span className="block text-[11px] text-[var(--text-tertiary)] mt-0.5 leading-snug">
                    {L('“왜 이렇게 결정했는지”의 기록 — 결과 문서만으로는 남지 않는, 당신만의 판단 흔적이에요.',
                       'The record of WHY you decided this — the reasoning a finished document alone leaves behind.')}
                  </span>
                </span>
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
          {/* Agent-growth footer — the team's XP/level changes from this run.
              Deliberately understated: the deliverable is the triumphant
              moment, not the gamification. A muted one-liner carries the
              signal; the XP/Lv detail is tucked behind a tap-to-reveal so it
              never competes with the final document. */}
          {sessionId && <AgentGrowthFooter sessionId={sessionId} locale={locale} />}
        </div>
      </div>
    </motion.div>
  );
}

/* Agent-growth footer — muted by default, XP/Lv detail behind a tap-to-reveal.
   Gating the gamification keeps the final document the hero of the screen. */
function AgentGrowthFooter({ sessionId, locale }: { sessionId: string; locale: string }) {
  const L = (ko: string, en: string) => (locale === 'ko' ? ko : en);
  const [open, setOpen] = useState(false);
  const deltas = getSessionDeltas(sessionId);
  if (deltas.length === 0) return null;
  // Surface up to 4 agents to avoid clutter; the rest summed.
  const top = deltas.slice(0, 4);
  const rest = deltas.slice(4);
  const restXp = rest.reduce((acc, d) => acc + d.xpGained, 0);
  const anyLevelUp = deltas.some(d => d.leveledUp);

  return (
    <div className="px-5 md:px-7 py-2.5 border-t border-[var(--border-subtle)]/60">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        aria-controls="agent-growth-detail"
        className="inline-flex items-center gap-1.5 text-[11px] text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors cursor-pointer"
      >
        <Sparkles size={10} className="opacity-60 text-[var(--accent)]" />
        <span>
          {anyLevelUp
            ? L('팀이 이번 분석으로 한 단계 성장했어요', 'Your team leveled up from this run')
            : L('팀이 이번 분석으로 조금 더 똑똑해졌어요', 'Your team grew a little from this run')}
        </span>
        <ChevronDown size={11} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            id="agent-growth-detail"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.22, ease: EASE }}
            className="overflow-hidden"
          >
            <div className="flex flex-wrap gap-x-3 gap-y-1.5 text-[12px] text-[var(--text-secondary)] pt-2">
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
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
