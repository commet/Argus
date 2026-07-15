'use client';

import { useId, useState } from 'react';
import { motion } from 'framer-motion';
import { Loader2, UserCheck, ChevronDown } from 'lucide-react';
import { useLocale } from '@/hooks/useLocale';
import type { MixResult } from '@/stores/types';
import type { NavigatorReview } from '@/lib/progressive-engine';
import type { DebateResult } from '@/lib/debate-engine';
import { AttributedSection } from './AttributedSection';
import { renderInline } from './shared/renderMd';
import { EASE } from './shared/constants';
import { Copy as CopyIcon, Check as CheckIcon, Download } from 'lucide-react';

/** Serialize a draft (MixResult) to markdown — single source shared by the draft
 *  export affordance here AND ProgressiveFlow.onSkip's finalize, so the two can't
 *  drift. */
export function mixToMarkdown(mix: MixResult, ko: boolean): string {
  // Defensive (CLAUDE.md): a `mix` rehydrated from a checkpoint restore or a
  // Supabase merge can predate migrateMix and lack these arrays — a bare
  // .flatMap/.map threw the same crash class the store normalizer fixed elsewhere.
  const sections = mix.sections || [];
  const keyAssumptions = mix.key_assumptions || [];
  const nextSteps = mix.next_steps || [];
  return [
    `# ${mix.title}`, '', `> ${mix.executive_summary}`, '',
    ...sections.flatMap((s) => [`## ${s.heading}`, '', s.content, '']),
    ...(keyAssumptions.length ? [`## ${ko ? '전제 조건' : 'Assumptions'}`, '', ...keyAssumptions.map((a) => `- ${a}`), ''] : []),
    ...(nextSteps.length ? [`## ${ko ? '다음 단계' : 'Next Steps'}`, '', ...nextSteps.map((s) => `- ${s}`), ''] : []),
  ].join('\n');
}

/* ═══ Mix Preview ═══ */
export function MixPreview({ mix, dm, onDM, onSkip, busy, cmReview, debateResult, primary = 'review' }: { mix: MixResult; dm: string | null; onDM: () => void; onSkip: () => void; busy: boolean; cmReview?: NavigatorReview | null; debateResult?: DebateResult | null;
  /** W1.6 재구성 ④: 'wrap' makes the forward path (→ the flinch ladder) the
   *  primary CTA and demotes the stakeholder review to a quiet opt-in line —
   *  the old default buried the G0-best lever behind a "skip" branch. */
  primary?: 'review' | 'wrap';
}) {
  const locale = useLocale();
  const L = (ko: string, en: string) => locale === 'ko' ? ko : en;
  const bodyId = useId();
  // P1-1 본문 아코디언: the draft body collapses by default so the forward CTA
  // is reachable WITHOUT scrolling a full document (E-23). Title + executive
  // summary stay — they ARE the preview; sections/next-steps live behind 전문.
  const [bodyOpen, setBodyOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);
  // Export is available HERE, at the draft — the user shouldn't have to pass the
  // (now optional) review/falsification step just to take the document they like.
  const draftMd = () => mixToMarkdown(mix, locale === 'ko');
  const copyDraft = async () => {
    try {
      await navigator.clipboard.writeText(draftMd());
      setCopyFailed(false);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopyFailed(true);
      setTimeout(() => setCopyFailed(false), 2500);
    }
  };
  const downloadDraft = () => {
    const blob = new Blob([draftMd()], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(mix.title || 'argus-draft').replace(/[^\w가-힣\- ]+/g, '').trim().slice(0, 60) || 'argus-draft'}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };
  // Defensive (CLAUDE.md): restore/remote-merged mix may predate migrateMix.
  const sections = mix.sections || [];
  const nextSteps = mix.next_steps || [];
  return (
    <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, ease: EASE }}>
      {/* 도착 세리머니 — 항해의 산출물이 뭍에 닿는 순간. 정산 화면의 '영수증
          완성 모먼트'와 같은 급의 도착감: 금빛 프레임이 살짝 강해지고, 도착
          스탬프 한 줄이 먼저 찍힌 뒤 문서가 자리에 앉는다 (게이미피케이션
          아님 — 축하 문구·점수 없이 도착 사실만). */}
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, ease: EASE }}
        className="mb-3 flex items-center gap-2.5"
      >
        <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-bold text-[var(--accent-fg)]" style={{ background: 'var(--gradient-gold)' }}>
          <CheckIcon size={11} strokeWidth={3} />
          {L('초안이 닿았어요', 'The draft has landed')}
        </span>
        <span className="text-[11px] text-[var(--text-tertiary)]">
          {L(`${sections.length}개 섹션 · 당신의 답 위에서 쓰였어요`, `${sections.length} sections · built on your answers`)}
        </span>
      </motion.div>
      <div className="rounded-2xl p-[1.5px] bg-gradient-to-b from-[var(--accent)]/45 via-[var(--accent)]/15 to-[var(--accent)]/5 shadow-[0_2px_16px_rgba(160,130,60,0.10)]">
        <div className="rounded-[calc(1rem-1.5px)] bg-[var(--surface)] shadow-[inset_0_1px_1px_rgba(255,255,255,0.5)]">
          <div className="p-5 md:p-7 space-y-6">
            <h2 className="text-[22px] md:text-[28px] font-bold text-[var(--text-primary)] leading-tight tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>{mix.title}</h2>
            <blockquote className="rounded-lg bg-[var(--accent)]/[0.04] px-4 py-3 text-[15px] text-[var(--text-secondary)] italic leading-relaxed">{renderInline(mix.executive_summary)}</blockquote>

            {/* Collapsed by default — the CTA must not hide below a full document. */}
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <button
                type="button"
                onClick={() => setBodyOpen((o) => !o)}
                aria-expanded={bodyOpen}
                aria-controls={bodyId}
                className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-[var(--text-secondary)] hover:text-[var(--accent)] transition-colors cursor-pointer"
              >
                {bodyOpen
                  ? L('본문 접기', 'Collapse body')
                  : L(`전문 보기 — ${sections.length}개 섹션${nextSteps.length ? ' · 다음 단계' : ''}`, `Read full draft — ${sections.length} section${sections.length === 1 ? '' : 's'}`)}
                <ChevronDown size={13} className={`transition-transform ${bodyOpen ? 'rotate-180' : ''}`} />
              </button>
              {/* Take the draft NOW — before the optional review/falsification step. */}
              <div className="flex items-center gap-1">
                <button type="button" onClick={copyDraft}
                  aria-live="polite"
                  className={`inline-flex items-center gap-1 text-[11.5px] hover:text-[var(--accent)] px-2 py-1 rounded-md transition-colors cursor-pointer ${copyFailed ? 'text-[var(--danger)]' : 'text-[var(--text-tertiary)]'}`}>
                  {copied ? <CheckIcon size={12} /> : <CopyIcon size={12} />} {copied ? L('복사됨', 'Copied') : copyFailed ? L('복사 실패 — 다시 시도', 'Copy failed — retry') : L('초안 복사', 'Copy draft')}
                </button>
                <button type="button" onClick={downloadDraft}
                  className="inline-flex items-center gap-1 text-[11.5px] text-[var(--text-tertiary)] hover:text-[var(--accent)] px-2 py-1 rounded-md transition-colors cursor-pointer">
                  <Download size={12} /> .md
                </button>
              </div>
            </div>

            {bodyOpen && (
              <div id={bodyId} role="region" aria-label={L('초안 전문', 'Full draft')} className="space-y-6">
                <div className="space-y-5">
                  {sections.map((s, i) => (
                    <AttributedSection key={i} section={s} index={i} />
                  ))}
                </div>

                {nextSteps.length > 0 && (
                  <div className="pt-5 border-t border-[var(--border-subtle)]">
                    <p className="text-[9px] font-bold text-[var(--text-tertiary)] uppercase tracking-[0.2em] mb-3">{L('다음 단계', 'Next Steps')}</p>
                    {nextSteps.map((s, i) => <div key={i} className="flex items-start gap-2.5 text-[13px] text-[var(--text-primary)] mb-2 leading-relaxed"><span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] mt-2 shrink-0" /><span>{s}</span></div>)}
                  </div>
                )}
              </div>
            )}

            {cmReview && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5, duration: 0.6 }}
                className="pt-5 border-t border-dashed border-[var(--accent)]/20">
                {/* Spine: surface the synthesis as work, not as a character. No
                    agent-persona label, no "meet the navigator" machinery intro —
                    the plugin forbids machinery-selling and the webapp must match. */}
                <p className="text-[9px] font-bold text-[var(--accent)] uppercase tracking-[0.2em] mb-3">{L('통합 검토', 'Integrated check')}</p>
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
                {/* Spine: the crux this turns on — a neutral question, not a
                    proceed/no-proceed verdict (renamed from `verdict`, 2026-07-04). */}
                {cmReview.open_question && (
                  <div className="mt-3 pt-3 border-t border-dashed border-[var(--accent)]/15">
                    <p className="text-[9px] font-bold text-[var(--accent)] uppercase tracking-[0.2em] mb-1.5">{L('아직 갈리는 지점', 'Still open')}</p>
                    <p className="text-[12.5px] text-[var(--text-secondary)] italic leading-relaxed">{cmReview.open_question}</p>
                  </div>
                )}
              </motion.div>
            )}

            {debateResult && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.7, duration: 0.6 }}
                className="pt-5 border-t border-dashed border-[var(--danger)]/20">
                {/* Spine: an unresolved tension in the draft, surfaced — NOT a
                    named agent "losing" a debate. No agent attribution, no 💀
                    weakest-claim drama; the claim stands on its own. */}
                <div className="flex items-center gap-2 mb-3">
                  <p className="text-[9px] font-bold text-[var(--danger)] uppercase tracking-[0.2em]">{L('미해결 긴장', 'Unresolved tension')}</p>
                  {/* Localized — the raw English enum used to leak into Korean UI */}
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${debateResult.severity === 'critical' ? 'bg-[var(--danger)]/10 text-[var(--danger)]' : debateResult.severity === 'important' ? 'bg-[var(--warning)]/10 text-[var(--warning)]' : 'bg-[var(--text-tertiary)]/10 text-[var(--text-tertiary)]'}`}>
                    {debateResult.severity === 'critical' ? L('필수', 'Critical') : debateResult.severity === 'important' ? L('권장', 'Important') : L('참고', 'Minor')}
                  </span>
                </div>
                <p className="text-[13px] text-[var(--text-primary)] leading-relaxed mb-2">{debateResult.challenge}</p>
                {debateResult.weakestClaim && (
                  <p className="text-[12px] text-[var(--danger)] flex items-start gap-2 mb-1">
                    <span className="shrink-0 mt-0.5">·</span>
                    <span>{L('가장 약한 지점: ', 'Weakest point: ')}{debateResult.weakestClaim}</span>
                  </p>
                )}
                {debateResult.alternativeView && (
                  <p className="text-[12px] text-[var(--text-secondary)] flex items-start gap-2 mt-2">
                    <span className="shrink-0 mt-0.5">·</span>
                    <span>{debateResult.alternativeView}</span>
                  </p>
                )}
              </motion.div>
            )}

            <div className="pt-6 border-t border-[var(--border-subtle)] space-y-3">
              <div className="flex items-end justify-between gap-3">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--accent)]">{L('다음 선택', 'Next choice')}</p>
                  <p className="mt-1 text-[12px] text-[var(--text-tertiary)]">
                    {primary === 'wrap'
                      ? L('독자의 눈으로 확인하거나, 계획의 핵심 가정을 한 번 더 시험할 수 있어요.', 'Get a reader check, or test the plan’s core bet once more.')
                      : L('검토를 거치면 수정할 항목을 고른 뒤 최종본으로 만들 수 있어요.', 'A review lets you choose fixes before creating the final document.')}
                  </p>
                </div>
                <span className="shrink-0 rounded-full bg-[var(--bg)] px-2.5 py-1 text-[10px] text-[var(--text-tertiary)]">
                  {L('초안 완료', 'Draft ready')}
                </span>
              </div>
              {primary === 'wrap' ? (
                <>
                  {/* Persona/stakeholder review is the prominent pre-finish step
                      (gold). The falsification ladder ("부풀린 시나리오") is a real but
                      OPTIONAL extra, demoted to the quiet link below — per the
                      founder's call that getting a virtual reader's review matters
                      more here, and the ladder is effectively opt-in. */}
                  <motion.button type="button" onClick={onDM} disabled={busy} aria-busy={busy} whileTap={{ scale: 0.98 }}
                    className="w-full flex items-center justify-center gap-2 px-5 py-3 text-[var(--accent-fg)] rounded-xl text-[14px] font-semibold shadow-[var(--shadow-sm)] cursor-pointer disabled:opacity-50"
                    style={{ background: 'var(--gradient-gold)' }}>
                    {busy ? <Loader2 size={16} className="animate-spin" /> : <><UserCheck size={16} /> {L(`마무리 전에 — ${dm || '이해관계자'} 시점에서 검토 받아보기 →`, `Before wrapping up — get a review as ${dm || 'a stakeholder'} →`)}</>}
                  </motion.button>
                  <button type="button" onClick={onSkip} disabled={busy} className="w-full text-center text-[12px] text-[var(--text-tertiary)] hover:text-[var(--accent)] py-1 cursor-pointer"
                    style={{ transitionProperty: 'color', transitionDuration: '300ms', transitionTimingFunction: 'cubic-bezier(0.32,0.72,0,1)' }}>
                    {L('한 번 더 — 이 계획이 기대고 있는 한 가지 짚어보기 (선택)', 'Optional: name the one bet this rests on')}
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
                    <motion.button type="button" onClick={onDM} disabled={busy} aria-busy={busy} whileTap={{ scale: 0.98 }}
                      className="w-full flex items-center justify-center gap-2 px-5 py-3 text-[var(--accent-fg)] rounded-xl text-[14px] font-semibold shadow-[var(--shadow-sm)] cursor-pointer disabled:opacity-50"
                      style={{ background: 'var(--gradient-gold)' }}>
                      {busy ? <><Loader2 size={16} className="animate-spin" /> {L(`${dm || '리뷰어'}이(가) 읽고 있어요...`, `${dm || 'Reviewer'} is reading...`)}</> : <><UserCheck size={16} /> {L('검토 받기', 'Get Review')}</>}
                    </motion.button>
                  </div>
                  <button type="button" onClick={onSkip} disabled={busy} className="w-full text-center text-[12px] text-[var(--text-tertiary)] hover:text-[var(--accent)] py-1 cursor-pointer"
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
