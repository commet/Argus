'use client';

/**
 * ProgressiveFlow의 표시 전용 조각들 (E-1 리팩토링, 2026-07-29).
 *
 * 본문은 원본에서 **한 글자도 바꾸지 않고** 옮겼다 — 이 이동의 계약은 "동작이
 * 같다"가 아니라 "코드가 같다"이고, 그래야 4,177줄 파일을 서비스 위험 없이 줄일 수
 * 있다. 상태 기계(ProgressiveFlow 본체 3,017줄)는 건드리지 않았다.
 *
 * 원본 파일은 back-compat re-export를 유지한다 — DMFeedback/VerificationGate/
 * TeamDeployBanner/FinalCard가 이미 쓰던 그 패턴.
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight, ChevronDown, AlertTriangle, Sparkles } from 'lucide-react';
import { useLocale } from '@/hooks/useLocale';
import type { LeadSynthesisResult } from '@/stores/types';
import { EASE } from '../shared/constants';
import { parsePartialAnalysis, parsePartialDoc, parsePartialFeedback } from '@/lib/partial-analysis';

/* ═══ StreamSnippet — live preview of any in-progress JSON stream ═══
 * LLM calls during analysis/mix/DM/final all stream tokens. Rather than a
 * silent spinner, we surface one focal line (real_question / title /
 * first_reaction) plus a few compact counts. Enough signal to feel alive,
 * not so much to compete with the eventual output.
 * `kind` picks the parser so we don't mis-extract fields between response
 * shapes.
 */
export type StreamKind = 'analysis' | 'doc' | 'feedback';

export function StreamSnippet({ text, kind }: { text: string | null; kind: StreamKind }) {
  const locale = useLocale();
  const L = (ko: string, en: string) => locale === 'ko' ? ko : en;
  if (!text) return null;

  let headline = '';
  let headlineComplete = true;
  const counts: Array<{ label: string; value: number }> = [];
  let stageLabel = '';

  if (kind === 'analysis') {
    const p = parsePartialAnalysis(text);
    headline = p.real_question;
    headlineComplete = p.real_question_complete;
    if (p.hidden_assumptions.length > 0) counts.push({ label: L('확인할 가정', 'assumptions to check'), value: p.hidden_assumptions.length });
    if (p.skeleton.length > 0) counts.push({ label: L('확인할 것', 'to verify'), value: p.skeleton.length });
    stageLabel =
      // No document is being built during a conversation turn — by this field
      // the model is choosing what to ask (v2 judgment harness).
      p.stage === 'skeleton' ? L('무엇을 물어볼지 고르는 중', 'Choosing what to ask')
      : p.stage === 'assumptions' ? L('확인할 가정을 정리하는 중', 'Organizing assumptions to check')
      : p.stage === 'question' ? L('상황을 정리하는 중', 'Putting the situation together')
      : L('상황을 읽는 중', 'Reading the situation');
  } else if (kind === 'doc') {
    const p = parsePartialDoc(text);
    // Prefer the summary line once it starts; fall back to title.
    headline = p.executive_summary || p.title;
    headlineComplete = p.executive_summary ? p.summary_complete : !!p.title;
    if (p.sections_count > 0) counts.push({ label: L('섹션', 'sections'), value: p.sections_count });
    stageLabel = p.executive_summary
      ? L('요약 작성 중', 'Writing summary')
      : p.title
        ? L('제목 잡는 중', 'Finding the title')
        : L('구조 잡는 중', 'Shaping structure');
  } else {
    const p = parsePartialFeedback(text);
    headline = p.first_reaction;
    headlineComplete = p.reaction_complete;
    if (p.good_parts_count > 0) counts.push({ label: L('잘된 점', 'strengths'), value: p.good_parts_count });
    if (p.concerns_count > 0) counts.push({ label: L('우려', 'concerns'), value: p.concerns_count });
    stageLabel = p.first_reaction
      ? L('반응 쓰는 중', 'Drafting reaction')
      : L('문서 읽는 중', 'Reading the document');
  }

  const hasAny = !!headline || counts.length > 0;
  if (!hasAny) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3, ease: EASE }}
      className="mb-6 px-4 py-3 rounded-xl border border-[var(--accent)]/15 bg-[var(--accent)]/[0.04]"
    >
      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
        <motion.span
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
          className="flex"
        >
          <Sparkles size={11} className="text-[var(--accent)]" />
        </motion.span>
        <span className="text-[12.5px] font-semibold text-[var(--accent)] uppercase tracking-[0.12em]">
          {stageLabel}
        </span>
        {counts.map(c => (
          <span key={c.label} className="text-[12px] text-[var(--text-tertiary)]">
            · {c.label} {c.value}
          </span>
        ))}
      </div>
      {headline && (
        <div className="text-[13px] leading-[1.55] text-[var(--text-primary)] whitespace-pre-wrap break-words line-clamp-2">
          {headline}
          {!headlineComplete && (
            <span className="inline-block w-[2px] h-[14px] bg-[var(--accent)] ml-0.5 animate-pulse align-middle" />
          )}
        </div>
      )}
    </motion.div>
  );
}

/* ═══ LeadSynthesisCard — show lead agent's hidden synthesis ═══ */
export function LeadSynthesisCard({ synthesis }: { synthesis: LeadSynthesisResult }) {
  const locale = useLocale();
  const L = (ko: string, en: string) => locale === 'ko' ? ko : en;
  const [collapsed, setCollapsed] = useState(true);
  // Tier-1 de-wall: the integrated_analysis prose tends to run long and
  // quantitative ("매번 수학적으로 가는" — founder). It's the reasoning, not the
  // takeaway, so it hides behind its OWN nested toggle, below the value. The
  // decision-useful parts (핵심 발견 / 열린 질문) lead when the card opens.
  const [proseOpen, setProseOpen] = useState(false);
  // Collapsed-header teaser: the top finding (else the crux) shown as one line so
  // the user gets the takeaway WITHOUT expanding — value up front, wall on demand.
  const teaser = (synthesis.key_findings?.[0] || synthesis.open_question || '').trim();

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: EASE }}
      className="rounded-2xl border border-[var(--accent)]/15 bg-[var(--surface)] overflow-hidden">
      <button onClick={() => setCollapsed(!collapsed)}
        className="w-full flex items-start gap-3 px-5 py-3.5 cursor-pointer hover:bg-[var(--bg)]/50 transition-colors">
        <div className="w-7 h-7 rounded-full flex items-center justify-center bg-[var(--accent)]/10 shrink-0 mt-0.5">
          <Sparkles size={13} className="text-[var(--accent)]" />
        </div>
        <div className="flex-1 text-left min-w-0">
          <div>
            {/* Spine (F5): surface the synthesis as WORK, not as a character who
                authored an opinion — mirror MixPreview's de-personification. The
                work leads; the lead name is a quiet coverage signal (who pulled
                the lenses together), never an authorial byline. */}
            <span className="text-[13px] font-semibold text-[var(--text-primary)]">{L('검토 종합', 'Review synthesis')}</span>
          </div>
          {/* Value-first: takeaway visible while still collapsed. */}
          {collapsed && teaser && (
            <p className="mt-1 text-[12.5px] text-[var(--text-secondary)] leading-snug line-clamp-2">{teaser}</p>
          )}
        </div>
        <ChevronRight size={14} className={`text-[var(--text-tertiary)] transition-transform shrink-0 mt-0.5 ${collapsed ? '' : 'rotate-90'}`} />
      </button>
      <AnimatePresence>
        {!collapsed && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: EASE }} className="overflow-hidden">
            <div className="px-5 pb-5 space-y-4 border-t border-[var(--border-subtle)]">
              {/* ① 핵심 발견 leads — the one thing that changes the strategy. */}
              {synthesis.key_findings.length > 0 && (
                <div className="pt-4">
                  <p className="text-[12px] font-bold text-[var(--accent)] uppercase tracking-[0.15em] mb-2">{L('결정에 중요한 발견', 'Decision-shaping findings')}</p>
                  <ul className="space-y-1.5">
                    {synthesis.key_findings.map((f, i) => (
                      <li key={i} className="flex gap-2 text-[13px] text-[var(--text-primary)]">
                        <span className="text-[var(--accent)] shrink-0">·</span>
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {/* ② 열린 질문 — the crux this decision turns on. */}
              {synthesis.open_question && (
                <div className={synthesis.key_findings.length > 0 ? 'pt-1' : 'pt-4'}>
                  {/* Spine: the crux this turns on — a neutral question, not a
                      "what you'd advise" verdict (renamed from recommendation_direction). */}
                  <p className="text-[12px] font-bold text-[var(--accent)] uppercase tracking-[0.15em] mb-2">{L('아직 열려 있는 질문', 'The open question')}</p>
                  <blockquote className="rounded-lg bg-[var(--accent)]/[0.04] px-3.5 py-2.5 text-[13px] text-[var(--text-secondary)] italic leading-relaxed">
                    {synthesis.open_question}
                  </blockquote>
                  {/* Spine (F5): the asymptote disclosure CLAUDE.md mandates — we
                      surface the ONE question, and name the faint lean as a known
                      limit at the product level, rather than claiming "we don't
                      judge". Quiet, once per card. */}
                  <p className="mt-2 pl-4 text-[12.5px] text-[var(--text-tertiary)] leading-[1.5]">
                    {/* Spine F5 (CLAUDE.md): keep naming the faint lean as a known
                        limit — no-machinery-leak.test pins this. "기울기" was jargon;
                        "은근히 한쪽으로 치우칠 수 있다" is the plain-language version. */}
                    {L('이 결정이 가장 크게 걸리는 질문이에요. 이런 질문은 은근히 한쪽으로 치우칠 수 있고, 그건 저희가 못 지우는 한계예요 — 판단은 당신 몫이에요.',
                       "The one question it turns on. A question like this can subtly lean one way — a limit we can't fully remove, and the call is yours.")}
                  </p>
                </div>
              )}
              {/* ③ 미해결 쟁점. */}
              {synthesis.unresolved_tensions.length > 0 && (
                <div>
                  <p className="text-[12px] font-bold text-[var(--warning)] uppercase tracking-[0.15em] mb-2">{L('미해결 쟁점', 'Unresolved Tensions')}</p>
                  <ul className="space-y-1.5">
                    {synthesis.unresolved_tensions.map((t, i) => (
                      <li key={i} className="flex gap-2 text-[13px] text-amber-700 dark:text-amber-400">
                        <AlertTriangle size={11} className="shrink-0 mt-1" />
                        <span>{t}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {/* ④ 통합 분석 전문 — the reasoning wall, nested + collapsed by default. */}
              {synthesis.integrated_analysis?.trim() && (
                <div className="pt-1">
                  <button onClick={() => setProseOpen((o) => !o)} aria-expanded={proseOpen}
                    className="inline-flex items-center gap-1.5 text-[12px] font-medium text-[var(--text-tertiary)] hover:text-[var(--accent)] transition-colors cursor-pointer">
                    {proseOpen ? L('분석 전문 접기', 'Collapse full analysis') : L('분석 전문 보기', 'Read the full analysis')}
                    <ChevronDown size={12} className={`transition-transform ${proseOpen ? 'rotate-180' : ''}`} />
                  </button>
                  {proseOpen && (
                    <div className="mt-3 text-[13px] text-[var(--text-primary)] leading-relaxed whitespace-pre-wrap">{synthesis.integrated_analysis}</div>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
