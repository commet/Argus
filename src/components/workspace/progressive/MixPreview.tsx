'use client';

import { motion } from 'framer-motion';
import { Loader2, UserCheck } from 'lucide-react';
import { useLocale } from '@/hooks/useLocale';
import type { MixResult } from '@/stores/types';
import type { NavigatorReview } from '@/lib/progressive-engine';
import type { DebateResult } from '@/lib/debate-engine';
import { AttributedSection } from './AttributedSection';
import { renderInline } from './shared/renderMd';
import { EASE } from './shared/constants';

/* ═══ Mix Preview ═══ */
export function MixPreview({ mix, dm, onDM, onSkip, busy, cmReview, debateResult, primary = 'review' }: { mix: MixResult; dm: string | null; onDM: () => void; onSkip: () => void; busy: boolean; cmReview?: NavigatorReview | null; debateResult?: DebateResult | null;
  /** W1.6 재구성 ④: 'wrap' makes the forward path (→ the flinch ladder) the
   *  primary CTA and demotes the stakeholder review to a quiet opt-in line —
   *  the old default buried the G0-best lever behind a "skip" branch. */
  primary?: 'review' | 'wrap';
}) {
  const locale = useLocale();
  const L = (ko: string, en: string) => locale === 'ko' ? ko : en;
  return (
    <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, ease: EASE }}>
      <div className="rounded-2xl p-[1px] bg-gradient-to-b from-[var(--accent)]/20 to-[var(--accent)]/5">
        <div className="rounded-[calc(1rem-1px)] bg-[var(--surface)] shadow-[inset_0_1px_1px_rgba(255,255,255,0.5)]">
          <div className="p-5 md:p-7 space-y-6">
            {/* Eyebrow — text-only, matches AnalysisCard */}
            <div className="text-[10px] font-bold text-[var(--accent)] uppercase tracking-[0.15em]">{L('초안', 'Draft')}</div>
            <h2 className="text-[22px] md:text-[28px] font-bold text-[var(--text-primary)] leading-tight tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>{mix.title}</h2>
            <blockquote className="border-l-[3px] border-[var(--accent)]/20 pl-5 text-[15px] text-[var(--text-secondary)] italic leading-relaxed">{renderInline(mix.executive_summary)}</blockquote>

            <div className="space-y-5">
              {mix.sections.map((s, i) => (
                <AttributedSection key={i} section={s} index={i} />
              ))}
            </div>

            {mix.next_steps.length > 0 && (
              <div className="pt-5 border-t border-[var(--border-subtle)]">
                <p className="text-[9px] font-bold text-[var(--text-tertiary)] uppercase tracking-[0.2em] mb-3">{L('다음 단계', 'Next Steps')}</p>
                {mix.next_steps.map((s, i) => <div key={i} className="flex items-start gap-2.5 text-[13px] text-[var(--text-primary)] mb-2 leading-relaxed"><span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] mt-2 shrink-0" /><span>{s}</span></div>)}
              </div>
            )}

            {cmReview && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5, duration: 0.6 }}
                className="pt-5 border-t border-dashed border-[var(--accent)]/20">
                <div className="flex items-center gap-2 mb-1">
                  <span style={{ fontSize: 18 }}>🧭</span>
                  <p className="text-[9px] font-bold text-[var(--accent)] uppercase tracking-[0.2em]">{L('항해장의 한마디', 'Navigator Note')}</p>
                </div>
                {/* One-line intro — the navigator shows up only here/at revision,
                    so say who they are the first time the user meets them. */}
                <p className="text-[11px] text-[var(--text-tertiary)] mb-3 leading-snug">
                  {L('항해장은 팀 전체의 결과를 통합해 검토하는 에이전트예요.', 'The navigator is the agent who reviews the whole team’s work.')}
                </p>
                <p className="text-[13px] text-[var(--text-primary)] leading-relaxed mb-2">{cmReview.overall}</p>
                {cmReview.contradictions.length > 0 && (
                  <div className="mb-2">
                    {cmReview.contradictions.map((c, i) => <p key={i} className="text-[12px] text-[var(--danger)] flex items-start gap-2 mb-1"><span className="shrink-0 mt-0.5">⚡</span>{c}</p>)}
                  </div>
                )}
                {cmReview.blind_spots.length > 0 && (
                  <div className="mb-2">
                    {cmReview.blind_spots.map((b, i) => <p key={i} className="text-[12px] text-[var(--text-secondary)] flex items-start gap-2 mb-1"><span className="shrink-0 mt-0.5">👁</span>{b}</p>)}
                  </div>
                )}
                <p className="text-[12px] text-[var(--text-tertiary)] italic mt-2">{cmReview.verdict}</p>
              </motion.div>
            )}

            {debateResult && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.7, duration: 0.6 }}
                className="pt-5 border-t border-dashed border-[var(--danger)]/20">
                <div className="flex items-center gap-2 mb-3">
                  <span style={{ fontSize: 18 }}>⚔️</span>
                  <p className="text-[9px] font-bold text-[var(--danger)] uppercase tracking-[0.2em]">{L('팀 내 반론', 'Team Dissent')}</p>
                  {/* Localized — the raw English enum used to leak into Korean UI */}
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${debateResult.severity === 'critical' ? 'bg-[var(--danger)]/10 text-[var(--danger)]' : debateResult.severity === 'important' ? 'bg-[var(--warning)]/10 text-[var(--warning)]' : 'bg-[var(--text-tertiary)]/10 text-[var(--text-tertiary)]'}`}>
                    {debateResult.severity === 'critical' ? L('필수', 'Critical') : debateResult.severity === 'important' ? L('권장', 'Important') : L('참고', 'Minor')}
                  </span>
                </div>
                <p className="text-[13px] text-[var(--text-primary)] leading-relaxed mb-2">{debateResult.challenge}</p>
                {debateResult.weakestClaim && (
                  <p className="text-[12px] text-[var(--danger)] flex items-start gap-2 mb-1">
                    <span className="shrink-0 mt-0.5">💀</span>
                    <span><strong>{debateResult.targetAgent}</strong>{L('의 약점: ', "'s weakness: ")}{debateResult.weakestClaim}</span>
                  </p>
                )}
                {debateResult.alternativeView && (
                  <p className="text-[12px] text-[var(--text-secondary)] flex items-start gap-2 mt-2">
                    <span className="shrink-0 mt-0.5">💡</span>
                    <span>{debateResult.alternativeView}</span>
                  </p>
                )}
              </motion.div>
            )}

            <div className="pt-6 border-t border-[var(--border-subtle)] space-y-3">
              {primary === 'wrap' ? (
                <>
                  {/* Forward is primary: 마무리(→ 사다리). Review is the quiet opt-in. */}
                  <motion.button onClick={onSkip} disabled={busy} whileTap={{ scale: 0.98 }}
                    className="w-full flex items-center justify-center gap-2 px-5 py-3 text-white rounded-xl text-[14px] font-semibold shadow-[var(--shadow-sm)] cursor-pointer disabled:opacity-50"
                    style={{ background: 'var(--gradient-gold)' }}>
                    {/* Honest preview of what's next: one last shake of the plan,
                        not an instant finish (expectation break drove drop-offs). */}
                    {busy ? <Loader2 size={16} className="animate-spin" /> : L('마무리 전에 한 번 흔들어보기 →', 'One last shake, then wrap up →')}
                  </motion.button>
                  <button onClick={onDM} disabled={busy} className="w-full text-center text-[12px] text-[var(--text-tertiary)] hover:text-[var(--accent)] py-1 cursor-pointer"
                    style={{ transitionProperty: 'color', transitionDuration: '300ms', transitionTimingFunction: 'cubic-bezier(0.32,0.72,0,1)' }}>
                    {L(`${dm || '이해관계자'} 시점 검토 한번 받아보기 (선택)`, `Optional: review as ${dm || 'a stakeholder'}`)}
                  </button>
                </>
              ) : (
                <>
                  {/* Reviewer suggestion card */}
                  <div className="rounded-xl border border-[var(--accent)]/10 bg-[var(--accent)]/[0.03] p-4">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-9 h-9 rounded-full bg-[var(--accent)]/10 flex items-center justify-center text-[14px] font-bold text-[var(--accent)]">
                        {(dm || '?').charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-[14px] font-semibold text-[var(--text-primary)]">{dm || L('의사결정권자', 'Decision-Maker')}</p>
                        <p className="text-[11px] text-[var(--text-tertiary)]">{L('올리기 전에 한번 검토 받아보세요', 'Get a review before you submit')}</p>
                      </div>
                    </div>
                    <motion.button onClick={onDM} disabled={busy} whileTap={{ scale: 0.98 }}
                      className="w-full flex items-center justify-center gap-2 px-5 py-3 text-white rounded-xl text-[14px] font-semibold shadow-[var(--shadow-sm)] cursor-pointer disabled:opacity-50"
                      style={{ background: 'var(--gradient-gold)' }}>
                      {busy ? <><Loader2 size={16} className="animate-spin" /> {L(`${dm || '리뷰어'}이(가) 읽고 있어요...`, `${dm || 'Reviewer'} is reading...`)}</> : <><UserCheck size={16} /> {L('검토 받기', 'Get Review')}</>}
                    </motion.button>
                  </div>
                  <button onClick={onSkip} disabled={busy} className="w-full text-center text-[12px] text-[var(--text-tertiary)] hover:text-[var(--accent)] py-1 cursor-pointer"
                    style={{ transitionProperty: 'color', transitionDuration: '300ms', transitionTimingFunction: 'cubic-bezier(0.32,0.72,0,1)' }}>{L('검토 건너뛰고 이대로 완성', 'Skip the review & finalize')}</button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
