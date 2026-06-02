'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useProgressiveStore } from '@/stores/useProgressiveStore';
import {
  runDeepening,
  refineInitialFraming,
  runMix,
  runDMFeedback,
  runBossDMFeedback,
  runFinalDeliverable,
  runNavigatorReview,
  runNavigatorRevision,
  runDebate,
  runLeadSynthesis,
  type NavigatorReview,
  type DebateResult,
} from '@/lib/progressive-engine';
import { VersionHistoryDrawer, type VersionTreeItem } from '@/components/workspace/VersionHistoryDrawer';
import { getActivePath, isOnBranch } from '@/lib/version-tree';
import { buildLeadDecompositionContext, type LeadAgentConfig } from '@/lib/lead-agent';
import { assessConvergence, assessConvergenceWithWorkers } from '@/lib/progressive-convergence';
import { exportProgressiveAsReframe, exportProgressiveAsRecast } from '@/lib/progressive-handoff';
import { useAgentStore } from '@/stores/useAgentStore';
import { usePersonaStore } from '@/stores/usePersonaStore';
import { useReframeStore } from '@/stores/useReframeStore';
import { useRecastStore } from '@/stores/useRecastStore';
import { useProjectStore } from '@/stores/useProjectStore';
import { useAgentAttentionStore, useAttributionClickOutside } from '@/stores/useAgentAttentionStore';
import { PingToast } from './PingToast';
import { runAllAIWorkers, runPipeline, type WorkerContext } from '@/lib/worker-engine';
import { withTranscript } from '@/lib/execution-transcript';
import { getCompletionNote } from '@/lib/worker-personas';
import { track } from '@/lib/analytics';
import type { FlowQuestion, FlowAnswer, AnalysisSnapshot, DMConcern, MixResult, ConvergenceMetrics, WorkerTask, LeadSynthesisResult, Draft } from '@/stores/types';
import { findEffectForAnswer, applySnapshotPatch } from '@/lib/question-types';
import type { StrategicForkEffect, WeaknessCheckEffect } from '@/lib/question-types';
import { WorkerReportBlock } from './WorkerCard';
import { PersonaPoolModal } from './PersonaPoolModal';
import { WorkerAvatar, AvatarRow } from './WorkerAvatar';
import { useChronicler } from './useChronicler';
import { voyageLogToMarkdown } from '@/lib/export';
import { useWorkerActions } from '@/hooks/useWorkerActions';
import { useWorkerContext, useWorkers } from './WorkerPanel';
import { useStaggeredReveal } from '@/hooks/useStaggeredReveal';
import { ChevronRight, ChevronDown, Loader2, Check, AlertTriangle, Sparkles, UserCheck, ArrowRight, History, GitBranch, X as XIcon, Wand2, Plus, Brain, Pencil, Compass, Navigation } from 'lucide-react';
import { getAgentStats, getSessionDeltas } from '@/lib/agent-stats';
import { useLocale } from '@/hooks/useLocale';
import { t } from '@/lib/i18n';
import { localizePersona } from '@/lib/worker-personas';
import type { WorkerPersona } from '@/stores/types';

const personaName = (p: WorkerPersona | null | undefined, locale: 'ko' | 'en'): string =>
  p ? localizePersona(p, locale).name : '';
const personaRole = (p: WorkerPersona | null | undefined, locale: 'ko' | 'en'): string =>
  p ? localizePersona(p, locale).role : '';
import { EASE, SPRING } from './shared/constants';
import { diffItems } from './shared/diffItems';
import { parsePartialAnalysis, parsePartialDoc, parsePartialFeedback } from '@/lib/partial-analysis';
import { renderInline, renderMd } from './shared/renderMd';
import { AnalysisCard } from './shared/AnalysisCard';
import { UpdateSummaryChip } from './shared/UpdateSummaryChip';
import { QuestionCard } from './shared/QuestionCard';
import { ShareBar } from '@/components/ui/ShareBar';

/* Reviewer 배지 — 저장된 팀장이 있으면 세션 내내 노출 */
function ReviewerBadge({ reviewerId }: { reviewerId: string | null }) {
  const agent = useAgentStore(s => reviewerId ? s.agents.find(a => a.id === reviewerId) : undefined);
  const locale = useLocale();
  const L = (ko: string, en: string) => locale === 'ko' ? ko : en;
  if (!agent) return null;
  const code = agent.personality_code;
  return (
    <motion.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3, duration: 0.4, ease: EASE }}
      className="flex items-center gap-2 px-4 py-2 rounded-full max-w-full"
      style={{
        background: 'linear-gradient(135deg, rgba(91,33,182,0.06) 0%, rgba(30,58,138,0.06) 100%)',
        border: '1px dashed rgba(91,33,182,0.25)',
      }}
      title={agent.personality_profile?.bossVibe || L('저장된 팀장이 이 기획을 리뷰합니다', 'Your saved manager will review this plan')}
    >
      <motion.span
        className="text-[14px] leading-none"
        animate={{ scale: [1, 1.08, 1] }}
        transition={{ repeat: Infinity, duration: 3.5, ease: 'easeInOut' }}
      >
        {agent.emoji}
      </motion.span>
      <span className="text-[11px] font-semibold text-[var(--text-primary)] truncate max-w-[140px]">
        {agent.name}
      </span>
      {code && (
        <span className="text-[10px] font-bold tracking-wider text-[var(--text-tertiary)]">
          {code}
        </span>
      )}
      <span className="text-[10px] text-[var(--text-tertiary)] hidden sm:inline">
        {L('· 이 기획을 봅니다', '· will review this plan')}
      </span>
    </motion.div>
  );
}

/* Phase-aware ambient glow — the page itself tells you where you are */
function PhaseAmbient({ phase }: { phase: string }) {
  const bg = phase === 'complete'
    ? 'radial-gradient(ellipse 80% 50% at 50% 20%, rgba(184,150,62,0.08) 0%, transparent 70%)'
    : phase === 'dm_feedback' || phase === 'refining' || phase === 'mixing' || phase === 'lead_synthesizing'
      ? 'radial-gradient(ellipse 80% 50% at 50% 20%, rgba(184,150,62,0.04) 0%, transparent 70%)'
      : 'none';
  return <motion.div className="fixed inset-0 pointer-events-none z-0" animate={{ background: bg }} transition={{ duration: 1.5, ease: EASE }} />;
}

function getParticle(name: string): string {
  const c = name.charCodeAt(name.length - 1);
  if (c >= 0xAC00 && c <= 0xD7A3) return (c - 0xAC00) % 28 !== 0 ? '은' : '는';
  return '는';
}

/* ═══ Phase Header — top-of-page orientation card ═══
 * The earlier "minimal stepper" assumed PhaseStatusBar would carry the live
 * state; in practice first-time users couldn't tell what stage they were in
 * or what to do next. This card answers both questions explicitly:
 *   1. Where am I? (big stage label + N/4)
 *   2. What happens next? (one-line guide that updates per phase/state)
 */
// Voyage metaphor labels — micro injection of the new 'Argus' / 항해
// concept. Keeps the labels short so the stepper stays compact while
// reinforcing the "set sail → voyage → report → anchor" mental model.
const PHASES_KO = ['항해 준비', '항해', '보고', '정박'] as const;
const PHASES_EN = ['Briefing', 'Voyage', 'Review', 'Anchor'] as const;

function phaseIdx(phase: string, round: number, hasMix: boolean): number {
  if (phase === 'complete') return 4;
  if (phase === 'dm_feedback' || phase === 'refining') return 3;
  if (phase === 'mixing' || phase === 'lead_synthesizing' || (phase === 'conversing' && hasMix)) return 2;
  if (round >= 2 || (phase === 'analyzing' && round >= 2)) return 1;
  return 0;
}

function ProgressLine({
  phase, round, hasMix,
}: {
  phase: string; round: number; hasMix: boolean;
}) {
  const locale = useLocale();
  const PHASES = locale === 'ko' ? PHASES_KO : PHASES_EN;
  const rawIdx = phaseIdx(phase, round, hasMix);
  const idx = Math.min(rawIdx, 3);
  const isComplete = phase === 'complete';
  const pct = Math.min((rawIdx / 4) * 100, 100);
  const currentLabel = PHASES[isComplete ? 3 : idx];

  // Compact stepper with a tiny "N/4 · stage" eyebrow up top — keeps the
  // user oriented ("어디에 와있지?") without the heavy hero card the
  // first iteration had.
  return (
    <motion.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: EASE }}
      className="mb-6 px-1 mt-1"
    >
      <div className="flex items-baseline justify-between mb-2 px-0.5">
        <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--accent)] tabular-nums">
          {Math.min(rawIdx + 1, 4)}/4
          <span className="ml-1.5 text-[var(--text-primary)] normal-case tracking-normal">
            {currentLabel}
          </span>
        </span>
      </div>
      <div className="relative h-[4px] rounded-full bg-[var(--border-subtle)]/70 mb-2.5">
        <motion.div
          className="absolute inset-y-0 left-0 rounded-full"
          style={{ background: 'var(--gradient-gold)' }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.9, ease: EASE }}
        />
        {[0, 1, 2, 3].map(i => {
          const left = (i / 3) * 100;
          const done = i < idx || (isComplete && i <= 3);
          const active = !isComplete && i === idx;
          return (
            <div
              key={i}
              className={`absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full ring-[2px] transition-all duration-500 ${
                done
                  ? 'bg-[var(--accent)] ring-[var(--bg)]'
                  : active
                    ? 'bg-[var(--surface)] ring-[var(--accent)] shadow-[0_0_0_3px_rgba(180,160,100,0.28)]'
                    : 'bg-[var(--border)] ring-[var(--bg)]'
              }`}
              style={{ left: `calc(${left}% - 6px)` }}
            >
              {active && (
                <motion.div
                  className="absolute inset-0 rounded-full bg-[var(--accent)]/45"
                  animate={{ scale: [1, 2, 1], opacity: [0.75, 0, 0.75] }}
                  transition={{ duration: 1.6, repeat: Infinity, ease: 'easeOut' }}
                />
              )}
            </div>
          );
        })}
      </div>
      <div className="grid grid-cols-4">
        {PHASES.map((label, i) => {
          const done = i < idx || (isComplete && i <= 3);
          const active = !isComplete && i === idx;
          return (
            <span
              key={label}
              className={`text-[11px] truncate transition-colors duration-500 ${
                i === 0 ? 'text-left' : i === PHASES.length - 1 ? 'text-right' : 'text-center'
              } ${
                done
                  ? 'text-[var(--accent)]/80 font-medium'
                  : active
                    ? 'text-[var(--text-primary)] font-semibold'
                    : 'text-[var(--text-tertiary)]'
              }`}
            >
              {label}
            </span>
          );
        })}
      </div>
    </motion.div>
  );
}

/* LiveAnalysis + VersionPills → replaced by shared AnalysisCard */

/* ═══ Answered Q&A — horizontal pills with "sent to team" indicator ═══ */
function AnsweredPills({ qaPairs }: { qaPairs: Array<{ question: FlowQuestion; answer: FlowAnswer | null }> }) {
  const locale = useLocale();
  const answered = qaPairs.filter(qa => qa.answer);
  if (!answered.length) return null;
  return (
    <div className="flex flex-wrap items-center gap-2">
      {answered.map((qa, i) => (
        <motion.div key={i} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.05, ...SPRING }}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[var(--surface)] border border-[var(--border-subtle)] text-[11px]">
          <Check size={10} className="text-[var(--accent)]" />
          <span className="text-[var(--text-tertiary)] max-w-[100px] sm:max-w-[80px] truncate">{qa.question.text.split(' ').slice(0, 3).join(' ')}</span>
          <span className="text-[var(--text-primary)] font-medium max-w-[140px] sm:max-w-[100px] truncate">{qa.answer!.value}</span>
        </motion.div>
      ))}
      <motion.span initial={{ opacity: 0, x: -4 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 }}
        className="text-[10px] text-[var(--accent)]/60 flex items-center gap-1">
        <ArrowRight size={9} /> {locale === 'ko' ? '팀 분석에 반영' : 'sent to team'}
      </motion.span>
    </div>
  );
}

/* QuestionCard → imported from shared/ */

/* ═══ Attributed Section — draft paragraph with bidirectional hover + sentence-level attribution ═══ */
function AttributedSection({ section, index }: {
  section: MixResult['sections'][number];
  index: number;
}) {
  const locale = useLocale();
  const L = (ko: string, en: string) => locale === 'ko' ? ko : en;
  const workers = useWorkers();
  const hovered = useAgentAttentionStore(s => s.hovered);
  const setHovered = useAgentAttentionStore(s => s.setHovered);
  const clearHovered = useAgentAttentionStore(s => s.clearHovered);

  const contributorIds = section.contributor_worker_ids || [];
  const contributors = contributorIds
    .map(id => workers.find(w => w.id === id))
    .filter((w): w is NonNullable<typeof w> => !!w && !!w.persona);

  const hasSentences = Array.isArray(section.sentences) && section.sentences.length > 0;

  // Section-level highlight/dim — matches any hover kind that touches this section.
  const isHighlighted =
    (hovered?.kind === 'section' && hovered.sectionIndex === index) ||
    (hovered?.kind === 'sentence' && hovered.sectionIndex === index) ||
    (hovered?.kind === 'agent' && contributorIds.includes(hovered.workerId));
  const isDimmed = hovered != null && !isHighlighted;

  // Section-level hover handlers only fire in fallback mode (no sentences).
  // In sentence mode, each sentence publishes its own hover state.
  const onSectionHoverStart = hasSentences
    ? undefined
    : () => { if (contributorIds.length > 0) setHovered({ kind: 'section', sectionIndex: index, contributorIds }); };
  const onSectionHoverEnd = hasSentences
    ? undefined
    : () => setHovered(null);

  // Click to lock/toggle (touch-friendly; Round 2B).
  const onSectionTap = hasSentences
    ? undefined
    : () => {
        if (contributorIds.length === 0) return;
        if (hovered?.kind === 'section' && hovered.sectionIndex === index) {
          clearHovered();
        } else {
          setHovered({ kind: 'section', sectionIndex: index, contributorIds }, true);
        }
      };

  return (
    <motion.div
      data-attribution-source="section"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: isDimmed ? 0.35 : 1, y: 0 }}
      transition={{ delay: 0.1 + index * 0.08, duration: 0.5, ease: EASE }}
      onHoverStart={onSectionHoverStart}
      onHoverEnd={onSectionHoverEnd}
      onTap={onSectionTap}
      className={`relative rounded-lg transition-all duration-300 ${
        isHighlighted && contributorIds.length > 0
          ? '-mx-3 px-3 py-2 bg-[var(--accent)]/[0.05] ring-1 ring-[var(--accent)]/25'
          : ''
      }`}
    >
      <div className="flex items-center gap-2 mb-1.5">
        <h3 className="text-[14px] font-bold text-[var(--text-primary)] flex-1">{section.heading}</h3>
        {contributors.length > 0 && (
          <div className="flex -space-x-1.5 shrink-0">
            {contributors.map(w => (
              <div
                key={w.id}
                className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] border-2 border-[var(--surface)]"
                style={{ backgroundColor: (w.persona?.color || 'var(--accent)') + '25', color: w.persona?.color }}
                title={personaName(w.persona, locale)}
              >
                {w.persona?.emoji}
              </div>
            ))}
          </div>
        )}
      </div>

      {hasSentences ? (
        <SentenceStream section={section} sectionIndex={index} workers={workers} />
      ) : (
        <p className="text-[13px] text-[var(--text-primary)] leading-[1.8]">{renderInline(section.content)}</p>
      )}

      {contributors.length > 0 && (
        <p className="mt-2 text-[10px] text-[var(--text-tertiary)] flex items-center gap-1.5">
          <span className="opacity-60">{L('기여', 'By')}</span>
          <span className="truncate">
            {contributors.map(w => personaName(w.persona, locale)).filter(Boolean).join(' · ')}
          </span>
        </p>
      )}
    </motion.div>
  );
}

/* ═══ SentenceStream — renders section sentences inline with per-sentence hover + trailing contributor dots ═══ */
function SentenceStream({ section, sectionIndex, workers }: {
  section: MixResult['sections'][number];
  sectionIndex: number;
  workers: ReturnType<typeof useWorkers>;
}) {
  const locale = useLocale();
  const hovered = useAgentAttentionStore(s => s.hovered);
  const setHovered = useAgentAttentionStore(s => s.setHovered);
  const clearHovered = useAgentAttentionStore(s => s.clearHovered);
  const sentences = section.sentences || [];

  return (
    <p className="text-[13px] text-[var(--text-primary)] leading-[1.9]">
      {sentences.map((sent, sIdx) => {
        const ids = sent.contributor_worker_ids || [];
        const dots = ids
          .map(id => workers.find(w => w.id === id))
          .filter((w): w is NonNullable<typeof w> => !!w && !!w.persona);
        const isThisHovered = hovered?.kind === 'sentence'
          && hovered.sectionIndex === sectionIndex
          && hovered.sentenceIndex === sIdx;

        return (
          <motion.span
            key={sIdx}
            data-attribution-source="sentence"
            onHoverStart={() => ids.length > 0 && setHovered({ kind: 'sentence', sectionIndex, sentenceIndex: sIdx, contributorIds: ids })}
            onHoverEnd={() => setHovered(null)}
            onTap={() => {
              if (ids.length === 0) return;
              if (isThisHovered) {
                clearHovered();
              } else {
                setHovered({ kind: 'sentence', sectionIndex, sentenceIndex: sIdx, contributorIds: ids }, true);
              }
            }}
            className={`inline transition-all duration-200 ${
              isThisHovered ? 'bg-[var(--accent)]/[0.08] rounded px-0.5' : ''
            }`}
            style={{ cursor: ids.length > 0 ? 'pointer' : 'default' }}
          >
            {renderInline(sent.text)}
            {dots.length > 0 && (
              <span className="inline-flex items-center gap-[2px] ml-1 align-middle">
                {dots.map(d => (
                  <motion.span
                    key={d.id}
                    animate={{
                      scale: isThisHovered ? 1.4 : 1,
                      opacity: isThisHovered ? 1 : 0.55,
                    }}
                    transition={{ duration: 0.2, ease: EASE }}
                    className="inline-block w-[4px] h-[4px] rounded-full"
                    style={{ backgroundColor: d.persona?.color || 'var(--accent)' }}
                    title={personaName(d.persona, locale)}
                  />
                ))}
              </span>
            )}
            {' '}
          </motion.span>
        );
      })}
    </p>
  );
}

/* ═══ Mix Preview ═══ */
function MixPreview({ mix, dm, onDM, onSkip, busy, cmReview, debateResult }: { mix: MixResult; dm: string | null; onDM: () => void; onSkip: () => void; busy: boolean; cmReview?: NavigatorReview | null; debateResult?: DebateResult | null }) {
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
                <div className="flex items-center gap-2 mb-3">
                  <span style={{ fontSize: 18 }}>🧭</span>
                  <p className="text-[9px] font-bold text-[var(--accent)] uppercase tracking-[0.2em]">{L('항해장의 한마디', 'Navigator Note')}</p>
                </div>
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
                  <span className={`text-[9px] px-2 py-0.5 rounded-full font-medium ${debateResult.severity === 'critical' ? 'bg-[var(--danger)]/10 text-[var(--danger)]' : debateResult.severity === 'important' ? 'bg-[var(--warning)]/10 text-[var(--warning)]' : 'bg-[var(--text-tertiary)]/10 text-[var(--text-tertiary)]'}`}>
                    {debateResult.severity}
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
                  {busy ? <><Loader2 size={16} className="animate-spin" /> {L(`${dm || '리뷰어'}이(가) 읽고 있습니다...`, `${dm || 'Reviewer'} is reading...`)}</> : <><UserCheck size={16} /> {L('검토 받기', 'Get Review')}</>}
                </motion.button>
              </div>
              <button onClick={onSkip} disabled={busy} className="w-full text-center text-[12px] text-[var(--text-tertiary)] hover:text-[var(--accent)] py-1 cursor-pointer"
                style={{ transitionProperty: 'color', transitionDuration: '300ms', transitionTimingFunction: 'cubic-bezier(0.32,0.72,0,1)' }}>{L('건너뛰고 이대로 완성', 'Skip and finalize as is')}</button>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

/* ═══ DM Feedback ═══ */
function DMFeedback({ fb, onToggle, onFinalize, onDeepen, busy }: { fb: import('@/stores/types').DMFeedbackResult; onToggle: (i: number) => void; onFinalize: () => void; onDeepen?: () => void; busy: boolean }) {
  const locale = useLocale();
  const L = (ko: string, en: string) => locale === 'ko' ? ko : en;
  const initial = (fb.persona_name || '?').charAt(0).toUpperCase();
  // Snapshot the initial applied[] once on mount — parent remounts this
  // component via `key` when a new review arrives, so we don't need to
  // watch fb identity here. toggleFix rebuilds dm_feedback on every toggle,
  // so watching object identity would reset on each click.
  const baselineRef = useRef<boolean[] | null>(null);
  if (baselineRef.current === null) {
    baselineRef.current = fb.concerns.map(c => c.applied);
  }
  const changedCount = fb.concerns.reduce(
    (n, c, i) => n + (c.applied !== (baselineRef.current![i] ?? c.applied) ? 1 : 0),
    0,
  );
  const hasChanges = changedCount > 0;
  return (
    <div className="space-y-5">
      {/* Transition divider — personalized */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2, duration: 0.5 }}
        className="flex items-center gap-4 py-1">
        <div className="flex-1 h-px bg-[var(--accent)]/15" />
        <span className="text-[11px] text-[var(--text-secondary)] font-medium shrink-0">{fb.persona_name}{L('의 검토', "'s Review")}</span>
        <div className="flex-1 h-px bg-[var(--accent)]/15" />
      </motion.div>

    <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, ease: EASE }}>
      <div className="rounded-2xl p-[1px] bg-[var(--border-subtle)]">
        <div className="rounded-[calc(1rem-1px)] bg-[var(--surface)] shadow-[inset_0_1px_1px_rgba(255,255,255,0.5)]">
          <div className="p-5 md:p-7 space-y-6">
            {/* Reviewer — larger avatar like demo */}
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-[var(--accent)]/8 flex items-center justify-center text-[18px] font-bold text-[var(--accent)]">{initial}</div>
              <div>
                <p className="text-[17px] font-bold text-[var(--text-primary)]">{fb.persona_name}</p>
                <p className="text-[13px] text-[var(--text-tertiary)]">{fb.persona_role}</p>
              </div>
            </div>

            {/* First reaction — impactful blockquote */}
            <blockquote className="text-[17px] md:text-[18px] text-[var(--text-primary)] leading-[1.6] italic pl-5 border-l-[3px] border-[var(--accent)]/20">
              &ldquo;{fb.first_reaction}&rdquo;
            </blockquote>

            {/* Good parts — neutral palette for consistency */}
            {fb.good_parts.length > 0 && (
              <div className="rounded-xl bg-[var(--bg)]/50 px-4 py-3.5">
                <p className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-[0.15em] mb-2.5">{L('잘한 점', 'Strengths')}</p>
                {fb.good_parts.map((g, i) => <p key={i} className="text-[13px] text-[var(--text-primary)] flex items-start gap-2.5 mb-2 last:mb-0 leading-relaxed"><span className="text-[var(--accent)] shrink-0 mt-0.5 text-[12px]">&#10003;</span>{g}</p>)}
              </div>
            )}

            {/* Concerns — "이것만 고치면" */}
            {fb.concerns.length > 0 && <div>
              <p className="text-[9px] font-bold text-[var(--text-tertiary)] uppercase tracking-[0.2em] mb-3">{L('이것만 고치면', 'Fix These')}</p>
              <div className="space-y-3">
                {fb.concerns.map((c: DMConcern, i: number) => (
                  <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 + i * 0.08, duration: 0.4, ease: EASE }}
                    className={`rounded-2xl border p-4 transition-all duration-500 ${c.applied ? 'border-[var(--accent)]/20 bg-[var(--accent)]/[0.02]' : 'border-[var(--border-subtle)] bg-[var(--bg)]'}`}
                    style={{ transitionTimingFunction: 'cubic-bezier(0.32,0.72,0,1)' }}>
                    <div className="flex items-start gap-2 mb-2">
                      <span className={`inline-block text-[9px] font-bold px-2 py-0.5 rounded-full shrink-0 mt-0.5 ${c.severity === 'critical' ? 'bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-400' : c.severity === 'important' ? 'bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400' : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'}`}>
                        {c.severity === 'critical' ? L('필수', 'Required') : c.severity === 'important' ? L('권장', 'Recommended') : L('참고', 'Note')}</span>
                      <p className="text-[13px] text-[var(--text-primary)] leading-relaxed">{c.text}</p>
                    </div>
                    <p className="text-[12px] text-[var(--accent)] leading-relaxed mb-3 pl-1">→ {c.fix_suggestion}</p>
                    <div className="flex items-center justify-end gap-2">
                      <span className="text-[10px] text-[var(--text-tertiary)]">{c.applied ? L('반영', 'Applied') : L('스킵', 'Skip')}</span>
                      <button onClick={() => onToggle(i)} className={`relative w-11 h-6 rounded-full cursor-pointer ${c.applied ? 'bg-[var(--accent)]' : 'bg-[var(--border)]'}`}
                        style={{ transitionProperty: 'background', transitionDuration: '400ms', transitionTimingFunction: 'cubic-bezier(0.32,0.72,0,1)' }}>
                        <motion.div className="absolute top-1 w-4 h-4 rounded-full bg-white shadow-sm" animate={{ left: c.applied ? 24 : 4 }} transition={SPRING} />
                      </button>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>}

            {/* Approval condition */}
            <div className="pt-4 mt-2 border-t border-[var(--border-subtle)]">
              <div className="rounded-xl bg-[var(--accent)]/[0.04] border border-[var(--accent)]/10 px-4 py-3.5">
                <p className="text-[9px] font-bold text-[var(--accent)] uppercase tracking-[0.2em] mb-2">{L('통과 조건', 'Approval Condition')}</p>
                <p className="text-[15px] text-[var(--text-primary)] font-semibold leading-relaxed">{fb.approval_condition}</p>
              </div>
            </div>

            {/* Deep mode extras — would_ask (shown after deep review) */}
            {fb.would_ask.length > 0 && (
              <div className="pt-2">
                <p className="text-[9px] font-bold text-[var(--text-tertiary)] uppercase tracking-[0.2em] mb-2.5">{L('이것도 물어볼 거다', 'They Would Also Ask')}</p>
                {fb.would_ask.map((q, i) => <p key={i} className="text-[13px] text-[var(--text-secondary)] flex items-start gap-2 mb-1.5 leading-relaxed"><span className="text-[var(--accent)] shrink-0">?</span>{q}</p>)}
              </div>
            )}

            {/* Actions — primary + secondary path */}
            <div className="space-y-3">
              {hasChanges && !busy && (
                <motion.p
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, ease: EASE }}
                  className="text-center text-[12px] text-[var(--accent)] font-medium"
                >
                  {locale === 'ko'
                    ? `변경 ${changedCount}건 — 아래 버튼을 눌러 최종본에 반영하세요`
                    : `${changedCount} pending change${changedCount === 1 ? '' : 's'} — press below to apply to the final doc`}
                </motion.p>
              )}
              <motion.button
                onClick={onFinalize}
                disabled={busy}
                whileTap={{ scale: 0.98 }}
                animate={hasChanges && !busy ? { boxShadow: ['0 0 0px rgba(180,160,100,0)', '0 0 18px rgba(180,160,100,0.45)', '0 0 0px rgba(180,160,100,0)'] } : { boxShadow: '0 0 0px rgba(180,160,100,0)' }}
                transition={hasChanges && !busy ? { duration: 2.2, repeat: Infinity, ease: 'easeInOut' } : { duration: 0.4 }}
                className="w-full flex items-center justify-center gap-2 px-6 py-4 text-white rounded-2xl text-[14px] font-semibold shadow-[var(--shadow-sm)] cursor-pointer disabled:opacity-50"
                style={{ background: 'var(--gradient-gold)' }}
              >
                {busy ? <><Loader2 size={16} className="animate-spin" /> {L('최종본 작성 중...', 'Finalizing...')}</> : <>{L('반영하고 완성', 'Apply and Finalize')} <ChevronRight size={14} /></>}
              </motion.button>
              {fb.would_ask.length === 0 && onDeepen && (
                <p className="text-center text-[12px] text-[var(--text-tertiary)]">
                  {L('다른 관점이 필요하면 ', 'Need another perspective? ')}
                  <button onClick={onDeepen} disabled={busy}
                    className="text-[var(--accent)] hover:underline cursor-pointer font-medium disabled:opacity-50"
                    style={{ transitionProperty: 'color', transitionDuration: '200ms' }}>
                    {busy ? L('검토 중...', 'Reviewing...') : L('더 깊이 검토 →', 'Go deeper →')}
                  </button>
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
    </div>
  );
}

/* ═══ Final deliverable — triumphant, widest ═══ */
function FinalCard({
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
  // Append the decision trail so the exported document carries the *process*,
  // not just the conclusion ("the process is the deliverable").
  const voyageLog = voyageLogToMarkdown(logSession, locale as 'ko' | 'en');
  const copyTarget = voyageLog ? `${baseTarget}\n\n---\n\n${voyageLog}\n` : baseTarget;
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

/* renderInline, renderMd — imported from shared/ */

/* ═══ Loading ═══ */
/* ═══ PhaseStatusBar — always-visible sticky bar showing current state ═══ */
type StatusMode = 'ai_working' | 'your_turn' | 'phase_done';

function PhaseStatusBar({
  phase, busy, hasQuestion, deployReady, shouldMix, workersRunning, workersDone, workersTotal, elapsedLabel, leadAgentName, substage, isLongWait, onCancel,
}: {
  phase: string; busy: boolean; hasQuestion: boolean; deployReady: boolean; shouldMix: boolean;
  workersRunning: number; workersDone: number; workersTotal: number; elapsedLabel: string; leadAgentName?: string;
  // Optional fine-grained step for long async work (e.g. mix pipeline has 4
  // serial LLM calls — surface which one is running now, not just "Drafting…").
  substage?: string | null;
  // True once the current LLM call has been running ≥30s — triggers a softer
  // reassurance message and reveals the cancel button.
  isLongWait?: boolean;
  onCancel?: () => void;
}) {
  const locale = useLocale();
  const L = (ko: string, en: string) => locale === 'ko' ? ko : en;

  // Determine mode
  let mode: StatusMode = 'ai_working';
  let label = '';
  let sub = '';

  if (phase === 'complete') return null;

  if (busy || phase === 'analyzing' || phase === 'mixing' || phase === 'lead_synthesizing') {
    mode = 'ai_working';
    if (phase === 'analyzing') {
      label = L('상황을 분석하고 있습니다', 'Analyzing the situation');
      sub = workersRunning > 0 ? L(`에이전트 ${workersDone}/${workersTotal} 완료`, `Agents ${workersDone}/${workersTotal} done`) : '';
    } else if (phase === 'lead_synthesizing') {
      label = L(`${leadAgentName || '리드'}가 팀 결과를 통합하는 중`, `${leadAgentName || 'Lead'} is synthesizing findings`);
    } else if (phase === 'mixing') {
      label = L('초안을 작성하고 있습니다', 'Drafting the document');
    } else {
      label = L('처리 중...', 'Processing...');
    }
  } else if (hasQuestion) {
    mode = 'your_turn';
    label = L('당신 차례입니다', 'Your turn');
    sub = L('질문에 답해주세요', 'Please answer the question');
  } else if (deployReady) {
    mode = 'your_turn';
    label = L('당신 차례입니다', 'Your turn');
    sub = L('팀 구성을 확인하고 시작하세요', 'Review the team and start');
  } else if (shouldMix) {
    mode = 'your_turn';
    label = L('팀 분석이 끝났습니다', 'Team analysis complete');
    sub = L('초안 작성을 시작하세요', 'Ready to create the draft');
  } else if (workersRunning > 0) {
    mode = 'ai_working';
    label = L('팀이 분석하고 있습니다', 'Team is analyzing');
    sub = L(`${workersDone}/${workersTotal} 완료`, `${workersDone}/${workersTotal} done`);
  } else {
    return null;
  }

  // Mode-split: when it's the user's turn, the question card itself + the
  // onboarding banner are louder than this status bar would be. Showing
  // both creates the duplicate-message problem (user reported "이거 두 개
  // 기능이 중복되지 않나"). Sticky bar is reserved for ai_working states
  // (live progress / cancel) where it actually carries unique information.
  if (mode === 'your_turn') return null;

  const showLongWait = mode === 'ai_working' && isLongWait;
  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className={`mx-auto mb-3 flex items-center gap-3 px-5 py-3 rounded-2xl border backdrop-blur-sm transition-colors duration-500 ${
        mode === 'ai_working'
          ? showLongWait
            ? 'bg-amber-50/60 dark:bg-amber-900/10 border-amber-300/25'
            : 'bg-[var(--surface)]/90 border-[var(--accent)]/15'
          : 'bg-[var(--accent)]/[0.06] border-[var(--accent)]/25'
      }`}
    >
      {mode === 'ai_working' ? (
        <div className="relative w-5 h-5 flex items-center justify-center shrink-0">
          <div className={`absolute inset-0 rounded-full animate-ping ${showLongWait ? 'bg-amber-400/30' : 'bg-[var(--accent)]/20'}`} />
          <div className={`w-2.5 h-2.5 rounded-full ${showLongWait ? 'bg-amber-500' : 'bg-[var(--accent)]'}`} />
        </div>
      ) : (
        // your_turn: gentle bounce on the gold chip so the user's eye is
        // pulled toward "your move" without being noisy.
        <motion.div
          animate={{ y: [0, -1.5, 0] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
          className="w-5 h-5 rounded-full flex items-center justify-center shrink-0"
          style={{ background: 'var(--gradient-gold)' }}
        >
          <UserCheck size={11} className="text-white" />
        </motion.div>
      )}
      <div className="flex-1 min-w-0">
        <span className={`text-[13px] font-semibold ${
          showLongWait ? 'text-amber-700 dark:text-amber-300' : 'text-[var(--text-primary)]'
        }`}>
          {showLongWait ? L('오래 걸리고 있어요 — 계속 진행 중', 'Taking longer than usual — still working') : label}
        </span>
        {!showLongWait && sub && (
          <span className="ml-2 text-[12px] text-[var(--text-tertiary)]">{sub}</span>
        )}
        {mode === 'ai_working' && substage && (
          <AnimatePresence mode="wait">
            <motion.span
              key={substage}
              initial={{ opacity: 0, y: 3 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -3 }}
              transition={{ duration: 0.25, ease: EASE }}
              className="text-[11px] text-[var(--text-tertiary)] ml-2 italic"
            >
              · {substage}
            </motion.span>
          </AnimatePresence>
        )}
      </div>
      {mode === 'ai_working' && elapsedLabel && (
        <span className={`text-[11px] tabular-nums shrink-0 ${showLongWait ? 'text-amber-700 dark:text-amber-300 font-semibold' : 'text-[var(--text-tertiary)]'}`}>{elapsedLabel}</span>
      )}
      {showLongWait && onCancel && (
        <motion.button
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          onClick={onCancel}
          className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold text-amber-700 dark:text-amber-300 border border-amber-300/50 hover:bg-amber-100/60 dark:hover:bg-amber-900/30 transition-colors cursor-pointer"
          aria-label={L('취소', 'Cancel')}
        >
          <XIcon size={10} />
          {L('취소', 'Cancel')}
        </motion.button>
      )}
    </motion.div>
  );
}

/* ═══ StreamSnippet — live preview of any in-progress JSON stream ═══
 * LLM calls during analysis/mix/DM/final all stream tokens. Rather than a
 * silent spinner, we surface one focal line (real_question / title /
 * first_reaction) plus a few compact counts. Enough signal to feel alive,
 * not so much to compete with the eventual output.
 * `kind` picks the parser so we don't mis-extract fields between response
 * shapes.
 */
type StreamKind = 'analysis' | 'doc' | 'feedback';

function StreamSnippet({ text, kind }: { text: string | null; kind: StreamKind }) {
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
    if (p.hidden_assumptions.length > 0) counts.push({ label: L('가정', 'assumptions'), value: p.hidden_assumptions.length });
    if (p.skeleton.length > 0) counts.push({ label: L('뼈대', 'sections'), value: p.skeleton.length });
    stageLabel =
      p.stage === 'skeleton' ? L('뼈대를 잡는 중', 'Drafting skeleton')
      : p.stage === 'assumptions' ? L('가정을 점검하는 중', 'Checking assumptions')
      : p.stage === 'question' ? L('진짜 질문을 다듬는 중', 'Sharpening the real question')
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
        <span className="text-[11px] font-semibold text-[var(--accent)] uppercase tracking-[0.12em]">
          {stageLabel}
        </span>
        {counts.map(c => (
          <span key={c.label} className="text-[10px] text-[var(--text-tertiary)]">
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
function LeadSynthesisCard({ synthesis }: { synthesis: LeadSynthesisResult }) {
  const locale = useLocale();
  const L = (ko: string, en: string) => locale === 'ko' ? ko : en;
  const [collapsed, setCollapsed] = useState(true);

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: EASE }}
      className="rounded-2xl border border-[var(--accent)]/15 bg-[var(--surface)] overflow-hidden">
      <button onClick={() => setCollapsed(!collapsed)}
        className="w-full flex items-center gap-3 px-5 py-3.5 cursor-pointer hover:bg-[var(--bg)]/50 transition-colors">
        <div className="w-7 h-7 rounded-full flex items-center justify-center bg-[var(--accent)]/10 shrink-0">
          <Sparkles size={13} className="text-[var(--accent)]" />
        </div>
        <div className="flex-1 text-left min-w-0">
          <span className="text-[13px] font-semibold text-[var(--text-primary)]">{synthesis.lead_agent_name}</span>
          <span className="text-[11px] text-[var(--text-tertiary)] ml-2">{L('통합 분석', 'Integrated Analysis')}</span>
        </div>
        <ChevronRight size={14} className={`text-[var(--text-tertiary)] transition-transform ${collapsed ? '' : 'rotate-90'}`} />
      </button>
      <AnimatePresence>
        {!collapsed && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: EASE }} className="overflow-hidden">
            <div className="px-5 pb-5 space-y-4 border-t border-[var(--border-subtle)]">
              <div className="pt-4 text-[13px] text-[var(--text-primary)] leading-relaxed whitespace-pre-wrap">{synthesis.integrated_analysis}</div>
              {synthesis.key_findings.length > 0 && (
                <div>
                  <p className="text-[10px] font-bold text-[var(--accent)] uppercase tracking-[0.15em] mb-2">{L('핵심 발견', 'Key Findings')}</p>
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
              {synthesis.unresolved_tensions.length > 0 && (
                <div>
                  <p className="text-[10px] font-bold text-amber-600 uppercase tracking-[0.15em] mb-2">{L('미해결 쟁점', 'Unresolved Tensions')}</p>
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
              {synthesis.recommendation_direction && (
                <blockquote className="border-l-[3px] border-[var(--accent)]/20 pl-4 text-[13px] text-[var(--text-secondary)] italic leading-relaxed">
                  {synthesis.recommendation_direction}
                </blockquote>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

/* ═══ PhaseDivider — visual break at phase boundaries ═══ */
function PhaseDivider({ done, next, yourTurn }: { done: string; next: string; yourTurn?: boolean }) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5, ease: EASE }}
      className={`flex items-center gap-3 py-3 ${yourTurn ? 'px-4 rounded-xl bg-amber-50/50 dark:bg-amber-900/10 border border-amber-200/30 dark:border-amber-700/20' : ''}`}>
      <div className="flex items-center gap-1.5 text-[11px] text-[var(--text-tertiary)]">
        <Check size={10} className="text-[var(--accent)]" />
        <span>{done}</span>
      </div>
      <div className="flex-1 h-px bg-[var(--border-subtle)]" />
      <div className={`flex items-center gap-1.5 text-[12px] font-semibold ${yourTurn ? 'text-amber-600 dark:text-amber-400' : 'text-[var(--text-primary)]'}`}>
        <span>{next}</span>
        <ChevronRight size={11} />
      </div>
    </motion.div>
  );
}

/* ═══ Team Deploy Banner — 팀 구성 확인 ═══ */
const MAX_PERSONAS_PER_GROUP = 5;

function TeamDeployBanner({
  workers, onDeploy, onUpdateWorker, onOpenPool, onRemoveWorker, onUpdateTask, onOpenFreePool,
}: {
  workers: WorkerTask[];
  onDeploy: () => void;
  onUpdateWorker?: (id: string, partial: Partial<WorkerTask>) => void;
  /** Open the persona-pool modal in *task mode* for a given task group. */
  onOpenPool?: (taskGroupId: string) => void;
  /** Remove a single worker. The store enforces the "last-survivor" rule. */
  onRemoveWorker?: (workerId: string) => void;
  /** Save a new task description for the entire group. */
  onUpdateTask?: (taskGroupId: string, newText: string) => void;
  /** Open the persona-pool modal in *free mode* — no specific target. */
  onOpenFreePool?: () => void;
}) {
  const locale = useLocale();
  const L = (ko: string, en: string) => locale === 'ko' ? ko : en;
  // Inline edit state — only one group is in edit mode at a time. Captured
  // on enter, committed on blur/Enter, discarded on Escape.
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');

  // Group workers by task_group_id so users can see which personas are
  // tackling the same task. Legacy sessions without group ids fall back to
  // worker.id (each worker = its own group of 1, identical to old behavior).
  const groups = (() => {
    const map = new Map<string, WorkerTask[]>();
    const order: string[] = [];
    for (const w of workers) {
      const gid = w.task_group_id || w.id;
      const existing = map.get(gid);
      if (existing) {
        existing.push(w);
      } else {
        map.set(gid, [w]);
        order.push(gid);
      }
    }
    return order.map(gid => {
      const members = (map.get(gid) || []).slice();
      // Sort: AI first (preserve add order), then self, then human.
      members.sort((a, b) => {
        const at = (a.agent_type || 'ai') === 'ai' ? 0 : a.agent_type === 'self' ? 1 : 2;
        const bt = (b.agent_type || 'ai') === 'ai' ? 0 : b.agent_type === 'self' ? 1 : 2;
        return at - bt;
      });
      return { groupId: gid, members, seed: members[0] };
    }).sort((a, b) => a.seed.step_index - b.seed.step_index);
  })();
  const total = workers.length;
  const staggerDelay = 0.07;

  const renderRow = (w: WorkerTask, i: number, groupSize: number) => {
    const displayName = w.agent_type === 'human'
      ? (w.contact?.name || w.question_to_human?.slice(0, 15) || L('외부 확인', 'External'))
      : w.agent_type === 'self'
        ? L('내 판단', 'My decision')
        : (personaName(w.persona, locale) || 'AI');
    const roleText = w.agent_type === 'human'
      ? L('확인 요청', 'External check')
      : w.agent_type === 'self'
        ? L('세션 중 직접 답변', 'Answered in session')
        : personaRole(w.persona, locale);

    const canRemove = !!onRemoveWorker && groupSize > 1;
    return (
      <motion.div key={w.id}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 + i * staggerDelay, duration: 0.3, ease: EASE }}
        className="group/row flex items-start gap-3 py-2.5 first:pt-0 last:pb-0">
        {/* Avatar */}
        {w.agent_type === 'human'
          ? <div className="w-8 h-8 rounded-full bg-[var(--bg)] flex items-center justify-center text-[14px] shrink-0 mt-0.5 border border-[var(--border-subtle)]">👤</div>
          : w.agent_type === 'self'
            ? <div className="w-8 h-8 rounded-full bg-[var(--bg)] flex items-center justify-center text-[14px] shrink-0 mt-0.5 border border-[var(--border-subtle)]">🧠</div>
            : <WorkerAvatar persona={w.persona} size="md" />
        }
        {/* Content — two-tier hierarchy:
            Line 1 = primary identity (name + origin badge)
            Line 2 = secondary context (role · expertise · growth cue)
            Scope/contact rows only when relevant. Cleaner than the
            previous flat-wrap of 5 inline pieces. */}
        <div className="flex-1 min-w-0">
          {/* Primary line — name + manual badge only */}
          <div className="flex items-baseline gap-1.5 flex-wrap">
            <span className="text-[14px] font-semibold text-[var(--text-primary)]">
              {displayName}
            </span>
            {w.added_manually && (
              <span className="inline-flex items-center gap-0.5 text-[9px] font-bold uppercase tracking-[0.1em] text-[var(--accent)] bg-[var(--accent)]/[0.08] border border-[var(--accent)]/20 px-1.5 py-0.5 rounded-full">
                {L('직접 추가', 'Added')}
              </span>
            )}
          </div>
          {/* Secondary line — role · expertise · growth cue. Single row,
              tertiary tone so it reads as supporting metadata. */}
          {(roleText
            || ((w.agent_type || 'ai') === 'ai' && w.persona?.expertise)
            || ((w.agent_type || 'ai') === 'ai' && w.agent_id)
          ) && (
            <div className="flex items-center gap-x-1.5 text-[11px] text-[var(--text-tertiary)] mt-0.5 leading-snug">
              {roleText && <span className="truncate">{roleText}</span>}
              {(w.agent_type || 'ai') === 'ai' && w.persona?.expertise && roleText && (
                <span className="text-[var(--text-tertiary)]/60">·</span>
              )}
              {(w.agent_type || 'ai') === 'ai' && w.persona?.expertise && (
                <span className="truncate">{w.persona.expertise}</span>
              )}
              {(w.agent_type || 'ai') === 'ai' && w.agent_id && (() => {
                const stats = getAgentStats(w.agent_id);
                if (!stats) return null;
                const together = stats.totalTasks + stats.totalSyntheses;
                return (
                  <span className="shrink-0 ml-auto inline-flex items-center gap-1 tabular-nums">
                    <span className="text-[var(--accent)]/75 font-medium">Lv.{stats.agent.level}</span>
                    {together > 0
                      ? <span>· {together}{L('회', '×')}</span>
                      : <span className="text-[var(--accent)]/60">· {L('처음', 'first')}</span>}
                    {stats.observationCount >= 3 && (
                      <span className="inline-flex items-center gap-0.5 text-[var(--accent)]/70">
                        <Brain size={9} className="inline" />{stats.observationCount}
                      </span>
                    )}
                  </span>
                );
              })()}
            </div>
          )}
          {/* Scope preview — neutral tone, no color pills */}
          {(w.ai_scope || w.self_scope) && (
            <div className="mt-1.5 space-y-0.5 text-[11px] leading-[1.55]">
              {w.ai_scope && (
                <div className="flex gap-1.5">
                  <span className="text-[var(--text-tertiary)] font-medium shrink-0 min-w-[1.5rem]">AI</span>
                  <span className="text-[var(--text-secondary)]">{w.ai_scope}</span>
                </div>
              )}
              {w.self_scope && (
                <div className="flex gap-1.5">
                  <span className="text-[var(--accent)] font-medium shrink-0 min-w-[1.5rem]">{L('나', 'Me')}</span>
                  <span className="text-[var(--text-secondary)]">{w.self_scope}</span>
                </div>
              )}
            </div>
          )}
          {/* Human worker: contact input */}
          {w.agent_type === 'human' && onUpdateWorker && (
            <div className="flex items-center gap-2 mt-2">
              <select
                value={w.contact?.channel || 'email'}
                onChange={(e) => onUpdateWorker(w.id, { contact: { channel: e.target.value as 'email' | 'slack', name: w.contact?.name || '', address: w.contact?.address || '' } })}
                className="text-[11px] px-2 py-1 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface)] cursor-pointer"
                onClick={(e) => e.stopPropagation()}>
                <option value="email">Email</option>
                <option value="slack">Slack</option>
              </select>
              <input
                type="text"
                value={w.contact?.address || ''}
                onChange={(e) => onUpdateWorker(w.id, { contact: { channel: w.contact?.channel || 'email', name: w.contact?.name || '', address: e.target.value } })}
                placeholder={w.contact?.channel === 'slack' ? 'Slack User ID' : 'email@example.com'}
                className="flex-1 text-[11px] px-2.5 py-1 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:border-[var(--accent)]/30"
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          )}
        </div>
        {/* Remove button — only when there's another worker in the same group.
            Visible by default on touch (always), revealed on hover for desktop. */}
        {canRemove && (
          <button
            onClick={() => onRemoveWorker!(w.id)}
            className="shrink-0 mt-0.5 w-7 h-7 rounded-full flex items-center justify-center text-[var(--text-tertiary)] hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors cursor-pointer opacity-60 group-hover/row:opacity-100"
            aria-label={L('이 팀원 빼기', 'Remove this member')}
            title={L('이 팀원 빼기', 'Remove this member')}
          >
            <XIcon size={13} />
          </button>
        )}
      </motion.div>
    );
  };

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: EASE }}
      className="rounded-2xl bg-[var(--surface)] border border-[var(--border-subtle)] p-5 md:p-6">

      {/* Header — quiet eyebrow + count. The hint line is intentionally
          terse; the row CTAs ("+ 다른 시각" / "+ 새 팀원") communicate
          the actions themselves. */}
      <div className="flex items-baseline justify-between mb-4 gap-3">
        <div className="min-w-0">
          <div className="text-[10px] font-bold text-[var(--accent)] uppercase tracking-[0.14em] mb-1">
            {L('출항 팀', 'Voyage Crew')}
          </div>
          <p className="text-[14px] text-[var(--text-secondary)]">
            {L(`${total}명이 함께 출항할 준비가 됐어요`, `${total} crew ready to sail`)}
          </p>
        </div>
      </div>

      {/* Groups — each task gets its own block with members + add button */}
      <div className="space-y-3">
        {groups.map((g, gi) => {
          const groupSize = g.members.length;
          const canAdd = !!onOpenPool && groupSize < MAX_PERSONAS_PER_GROUP;
          const baseIndex = gi * 3; // approximate stagger across groups
          // Origin signals — drive the group's visual accent + heading badge.
          const hasManual = g.members.some(m => m.added_manually);
          const taskEdited = !!g.seed.original_task && g.seed.task !== g.seed.original_task;
          const userTouched = hasManual || taskEdited;
          return (
            <motion.div
              key={g.groupId}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: gi * staggerDelay, duration: 0.35, ease: EASE }}
              className={`rounded-xl border px-4 py-3.5 transition-colors ${
                userTouched
                  ? 'border-[var(--accent)]/30 bg-[var(--accent)]/[0.025]'
                  : 'border-[var(--border-subtle)]/70 bg-[var(--bg)]/40'
              }`}
            >
              {/* Task heading + add button */}
              <div className="flex items-start justify-between gap-3 mb-2.5">
                <div className="flex-1 min-w-0">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--text-tertiary)] mb-1 flex items-center gap-1.5 flex-wrap">
                    <span>{L(`Task ${gi + 1}`, `Task ${gi + 1}`)}</span>
                    {groupSize > 1 && (
                      <span className="text-[var(--accent)] normal-case tracking-normal">
                        · {groupSize}{L('명', '×')}
                      </span>
                    )}
                    {taskEdited && (
                      <span className="inline-flex items-center gap-0.5 text-[var(--accent)] normal-case tracking-normal font-medium">
                        <Pencil size={9} />
                        {L('수정됨', 'edited')}
                      </span>
                    )}
                  </div>
                  {editingGroupId === g.groupId && onUpdateTask ? (
                    // Inline edit mode — saves on blur or Enter, discards on Escape.
                    <textarea
                      autoFocus
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      onBlur={() => {
                        const next = editText.trim();
                        if (next && next !== g.seed.task) {
                          onUpdateTask(g.groupId, next);
                        }
                        setEditingGroupId(null);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          (e.target as HTMLTextAreaElement).blur();
                        } else if (e.key === 'Escape') {
                          setEditingGroupId(null);
                        }
                      }}
                      maxLength={280}
                      rows={2}
                      className="w-full text-[13px] text-[var(--text-primary)] leading-snug bg-[var(--surface)] border border-[var(--accent)]/40 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-[var(--accent)] resize-none"
                    />
                  ) : (
                    <p
                      onClick={() => {
                        if (!onUpdateTask) return;
                        setEditingGroupId(g.groupId);
                        setEditText(g.seed.task);
                      }}
                      className={`text-[13px] text-[var(--text-primary)] leading-snug line-clamp-2 ${onUpdateTask ? 'cursor-text hover:bg-[var(--bg)]/50 -mx-1 px-1 rounded transition-colors' : ''}`}
                      title={onUpdateTask ? L('클릭해서 수정', 'Click to edit') : undefined}
                    >
                      {g.seed.task}
                    </p>
                  )}
                </div>
                {onOpenPool && (
                  <button
                    onClick={() => canAdd && onOpenPool(g.groupId)}
                    disabled={!canAdd}
                    className={`shrink-0 inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition-all ${
                      canAdd
                        ? 'text-[var(--accent)] bg-[var(--accent)]/[0.06] hover:bg-[var(--accent)]/[0.12] border border-[var(--accent)]/25 cursor-pointer'
                        : 'text-[var(--text-tertiary)] bg-[var(--bg)] border border-[var(--border-subtle)] cursor-not-allowed opacity-60'
                    }`}
                    title={canAdd
                      ? L('이 task에 다른 시각 추가', 'Add another perspective to this task')
                      : L('최대 5명까지 추가할 수 있어요', 'Up to 5 personas per task')}
                  >
                    <Plus size={11} />
                    {canAdd ? L('다른 시각', 'Another lens') : L('가득', 'Full')}
                  </button>
                )}
              </div>
              {/* Members */}
              <div className="divide-y divide-[var(--border-subtle)]/40 border-t border-[var(--border-subtle)]/40 pt-1">
                {g.members.map((w, mi) => renderRow(w, baseIndex + mi, groupSize))}
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Free-mode "+ 새 팀원 추가" — agent-centric. The pool modal computes
          the best-matching task per persona and adds them directly. */}
      {onOpenFreePool && (() => {
        const everyGroupFull = groups.length > 0 && groups.every(g => g.members.length >= MAX_PERSONAS_PER_GROUP);
        return (
          <button
            onClick={() => !everyGroupFull && onOpenFreePool()}
            disabled={everyGroupFull}
            className={`mt-3 w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-[12px] font-medium border-dashed transition-all ${
              everyGroupFull
                ? 'border border-[var(--border-subtle)] text-[var(--text-tertiary)] cursor-not-allowed opacity-60'
                : 'border border-[var(--accent)]/25 text-[var(--accent)] hover:bg-[var(--accent)]/[0.04] hover:border-[var(--accent)]/45 cursor-pointer'
            }`}
            title={everyGroupFull
              ? L('모든 task가 5명으로 가득 찼어요', 'Every task is at 5 personas')
              : L('어울리는 task에 자동으로 배정됩니다', 'Automatically matched to the best-fitting task')}
          >
            <Plus size={12} />
            {L('새 팀원 추가', 'Add a team member')}
            <span className="text-[10px] text-[var(--text-tertiary)] font-normal">
              {everyGroupFull ? '' : L(' · 어울리는 task에 자동 배정', ' · auto-match to a task')}
            </span>
          </button>
        );
      })()}

      {/* Start button — primary CTA. "출항" carries the voyage metaphor. */}
      <motion.button onClick={onDeploy} whileTap={{ scale: 0.98 }}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 + groups.length * staggerDelay, duration: 0.4, ease: EASE }}
        className="mt-5 w-full flex items-center justify-center gap-2 px-5 py-3.5 text-white rounded-xl text-[14px] font-semibold cursor-pointer shadow-[var(--shadow-sm)] hover:shadow-[var(--shadow-lg)] transition-shadow"
        style={{ background: 'var(--gradient-gold)' }}>
        {L('출항', 'Set sail')} <ChevronRight size={14} />
      </motion.button>
    </motion.div>
  );
}

/* ═══ Mix Trigger ═══ */
/* ═══ Voyage-prep summary — stage transition between Q&A and team work
 *  Replaces the old MixTrigger. Q&A에서 도출한 방향을 한 화면에 요약해서
 *  보여주고, 사용자가 (1) 그대로 출항 (2) 한 번 더 짚어보기 (3) 답한 내용
 *  돌아보기 — 셋 중 명확히 결정하게 한다. 사용자 피드백: "과거에 내린
 *  '선택'에 대해서도 다시 뒤로 돌아가서 다시 선택하고 싶어하는 사람들이
 *  많았다"는 점을 받아 "돌아보기" CTA를 명시적으로 노출. */
/**
 * Compass rose used as a subtle watermark in VoyagePrepSummary. Inline
 * SVG kept here so we don't ship an asset for what is decorative trim.
 * Renders at very low opacity — present in peripheral vision, not
 * competing with content.
 */
function CompassRose({ size = 96 }: { size?: number }) {
  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="50" cy="50" r="42" strokeWidth="0.6" />
      <circle cx="50" cy="50" r="30" strokeWidth="0.5" />
      <circle cx="50" cy="50" r="2.4" fill="currentColor" stroke="none" />
      {/* Cardinal axes */}
      <line x1="50" y1="6" x2="50" y2="94" strokeWidth="0.6" />
      <line x1="6" y1="50" x2="94" y2="50" strokeWidth="0.6" />
      {/* Diagonal axes (shorter) */}
      <line x1="20" y1="20" x2="80" y2="80" strokeWidth="0.4" />
      <line x1="80" y1="20" x2="20" y2="80" strokeWidth="0.4" />
      {/* North fleur */}
      <path d="M50 14 L46 50 L50 44 L54 50 Z" strokeWidth="0.6" />
      {/* Cardinal letters */}
      <text x="50" y="11" fontSize="6.5" textAnchor="middle" fill="currentColor" stroke="none" fontWeight="700">N</text>
      <text x="92" y="52" fontSize="5" textAnchor="middle" fill="currentColor" stroke="none">E</text>
      <text x="50" y="97" fontSize="5" textAnchor="middle" fill="currentColor" stroke="none">S</text>
      <text x="8" y="52" fontSize="5" textAnchor="middle" fill="currentColor" stroke="none">W</text>
    </svg>
  );
}

/**
 * Wave divider — soft sine-curve line to break sections inside the
 * voyage card without using a hard rule. Pure decoration.
 */
function WaveDivider({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 200 8" className={className} preserveAspectRatio="none" fill="none" aria-hidden>
      <path
        d="M0 4 Q 12.5 0, 25 4 T 50 4 T 75 4 T 100 4 T 125 4 T 150 4 T 175 4 T 200 4"
        stroke="currentColor"
        strokeWidth="1"
        strokeLinecap="round"
      />
    </svg>
  );
}

function VoyagePrepSummary({
  snapshot, onMix, onMore, onRevisit, busy,
}: {
  snapshot: AnalysisSnapshot;
  onMix: () => void;
  onMore: () => void;
  onRevisit: () => void;
  busy: boolean;
}) {
  const locale = useLocale();
  const L = (ko: string, en: string) => locale === 'ko' ? ko : en;
  const topAssumption = (snapshot.hidden_assumptions || [])[0];
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.7, ease: EASE }}
      className="my-2"
    >
      {/* Stage marker — dashed route line "departure ⚓ destination".
          The two endpoints (filled dot ↔ Navigation arrow) read as a
          map waypoint annotation. */}
      <div className="flex items-center gap-2.5 mb-4 px-1">
        <div className="w-2 h-2 rounded-full bg-[var(--accent)]/45 shrink-0" />
        <div className="flex-1 border-t border-dashed border-[var(--accent)]/30" />
        <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--accent)] flex items-center gap-1.5 shrink-0">
          <span>⚓</span>
          {L('항해 준비 완료', 'Ready to sail')}
        </div>
        <div className="flex-1 border-t border-dashed border-[var(--accent)]/30" />
        <Navigation size={11} className="text-[var(--accent)]/65 shrink-0 -rotate-12" />
      </div>

      {/* Card with subtle nautical chrome — gradient border, compass-rose
          watermark, wave divider. Decoration sits at low opacity so the
          content stays legible. */}
      <div className="relative rounded-2xl md:rounded-[2rem] p-[1.5px] bg-gradient-to-b from-[var(--accent)]/35 via-[var(--accent)]/12 to-transparent shadow-[var(--shadow-md)]">
        <div className="relative rounded-[calc(1rem-1.5px)] md:rounded-[calc(2rem-1.5px)] bg-[var(--surface)] overflow-hidden">
          {/* Compass rose watermark — top-right corner, subtle. */}
          <div className="absolute top-3 right-3 md:top-5 md:right-5 text-[var(--accent)] opacity-[0.07] pointer-events-none select-none">
            <CompassRose size={108} />
          </div>
          {/* Bearing micro-coordinate — small detail nodding to nautical
              charts. Pure flavor; no functional meaning. */}
          <div className="absolute top-4 right-4 md:top-6 md:right-7 text-[9px] tracking-[0.18em] uppercase text-[var(--accent)]/55 font-mono pointer-events-none select-none">
            N · 새 항로
          </div>

          <div className="relative p-6 md:p-8">
            <h2 className="text-[20px] md:text-[24px] font-bold text-[var(--text-primary)] leading-[1.3] tracking-tight mb-5 pr-20"
              style={{ fontFamily: 'var(--font-display)' }}>
              {L('이 방향으로 출항해도 될까요?', 'Set sail in this direction?')}
            </h2>

            {/* Course summary — focal sentence framed with a Compass icon
                eyebrow. Keeps the metaphor consistent without leaning on
                emoji. */}
            <div className="mb-5 pl-4 border-l-[2px] border-[var(--accent)]/45">
              <div className="text-[10px] font-bold text-[var(--accent)] uppercase tracking-[0.15em] mb-1.5 flex items-center gap-1.5">
                <Compass size={11} className="shrink-0" />
                {L('잡은 항로', 'Course plotted')}
              </div>
              <p className="text-[15px] md:text-[16px] text-[var(--text-primary)] leading-relaxed font-medium">
                {snapshot.real_question}
              </p>
              {topAssumption && (
                <div className="mt-3 pt-2.5 border-t border-dashed border-[var(--border-subtle)]">
                  <p className="text-[12px] text-[var(--text-tertiary)] leading-relaxed">
                    <span className="text-[var(--text-secondary)] font-medium">{L('전제 조건  ', 'Premise · ')}</span>
                    {topAssumption}
                  </p>
                </div>
              )}
            </div>

            {/* Wave divider — section break before CTA. Soft and silent. */}
            <div className="mb-5 text-[var(--accent)]/25">
              <WaveDivider className="w-full h-2" />
            </div>

            {/* Primary CTA — gradient gold, "set sail" with Navigation
                arrow tilted like a sail. */}
            <motion.button onClick={onMix} disabled={busy} whileTap={{ scale: 0.98 }}
              className="group/sail w-full flex items-center justify-center gap-2.5 px-6 py-4 text-white rounded-xl text-[15px] font-semibold shadow-[var(--shadow-sm)] hover:shadow-[var(--shadow-md)] transition-all cursor-pointer disabled:opacity-50"
              style={{ background: 'var(--gradient-gold)' }}>
              {busy
                ? <><Loader2 size={16} className="animate-spin" /> {L('조합 중...', 'Combining...')}</>
                : (
                  <>
                    {L('이 방향으로 출항', 'Set sail this way')}
                    <Navigation
                      size={15}
                      className="-rotate-12 transition-transform duration-500 ease-out group-hover/sail:rotate-0 group-hover/sail:translate-x-0.5"
                    />
                  </>
                )}
            </motion.button>

            {/* Secondary actions — keep them link-style so the primary
                CTA stays unambiguous. */}
            {!busy && (
              <div className="flex items-center justify-center gap-4 mt-4">
                <button
                  onClick={onMore}
                  className="text-[12px] text-[var(--text-secondary)] hover:text-[var(--accent)] transition-colors cursor-pointer"
                >
                  {L('한 번 더 짚어보기', 'One more check')}
                </button>
                <span className="text-[var(--text-tertiary)]/40">·</span>
                <button
                  onClick={onRevisit}
                  className="text-[12px] text-[var(--text-secondary)] hover:text-[var(--accent)] transition-colors cursor-pointer"
                >
                  {L('답한 내용 돌아보기', 'Revisit my answers')}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

/* ═══ Framing Confirmation (Weakness A fix) ═══ */
function FramingConfirmation({ snapshot, onConfirm, onReject, busy }: {
  snapshot: AnalysisSnapshot;
  onConfirm: () => void;
  onReject: (reason: string) => void;
  busy: boolean;
}) {
  const locale = useLocale();
  const L = (ko: string, en: string) => locale === 'ko' ? ko : en;
  const [rejectMode, setRejectMode] = useState(false);
  const [reason, setReason] = useState('');
  const confidence = snapshot.framing_confidence ?? 75;
  const isLowConfidence = confidence < 70;

  if (snapshot.framing_locked) return null;

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: EASE }}
      className={`rounded-xl border p-4 md:p-5 ${isLowConfidence ? 'bg-amber-50/50 border-amber-200' : 'bg-[var(--accent)]/[0.02] border-[var(--accent)]/10'}`}>
      <div className="flex items-start gap-3 mb-3">
        <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${isLowConfidence ? 'bg-amber-100' : 'bg-[var(--accent)]/10'}`}>
          {isLowConfidence ? <AlertTriangle size={11} className="text-amber-600" /> : <Check size={11} className="text-[var(--accent)]" />}
        </div>
        <div>
          <p className="text-[13px] font-semibold text-[var(--text-primary)] leading-snug">{L('이 방향이 맞나요?', 'Is this the right direction?')}</p>
          <p className="text-[11px] text-[var(--text-tertiary)] mt-0.5">
            {isLowConfidence ? L('이 문제는 여러 방향으로 해석될 수 있습니다.', 'This problem can be interpreted in multiple ways.') : L('분석 방향을 확인하고 다음으로 넘어갑니다.', 'Confirm the analysis direction to proceed.')}
            {' '}{L('확신도', 'Confidence')} {confidence}%
          </p>
        </div>
      </div>

      {!rejectMode ? (
        <div className="flex gap-2 pl-9">
          <motion.button onClick={onConfirm} disabled={busy} whileTap={{ scale: 0.98 }}
            className="px-4 py-2 rounded-xl text-[12px] font-semibold text-white cursor-pointer disabled:opacity-50"
            style={{ background: 'var(--gradient-gold)' }}>{L('맞습니다', 'Correct')}</motion.button>
          <motion.button onClick={() => setRejectMode(true)} disabled={busy} whileTap={{ scale: 0.98 }}
            className="px-4 py-2 rounded-xl text-[12px] font-medium text-[var(--text-secondary)] border border-[var(--border-subtle)] hover:border-[var(--accent)]/30 cursor-pointer">
            {L('다시 정의', 'Redefine')}</motion.button>
        </div>
      ) : (
        <div className="pl-9 space-y-2">
          <input value={reason} onChange={e => setReason(e.target.value)} placeholder={L('어떤 방향이 더 맞나요? (예: 이건 투자용이 아니라 내부 보고용이야)', 'What direction fits better? (e.g., This is for internal reporting, not investors)')}
            className="w-full px-3.5 py-2.5 rounded-xl bg-[var(--surface)] border border-[var(--border-subtle)] text-[12px] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:border-[var(--accent)]/30"
            onKeyDown={e => { if (e.key === 'Enter' && reason.trim()) { e.preventDefault(); onReject(reason.trim()); } }} autoFocus />
          <div className="flex gap-2">
            <motion.button onClick={() => reason.trim() && onReject(reason.trim())} disabled={busy || !reason.trim()} whileTap={{ scale: 0.98 }}
              className="px-4 py-2 rounded-xl text-[12px] font-semibold text-white cursor-pointer disabled:opacity-50"
              style={{ background: 'var(--gradient-gold)' }}>{L('재분석', 'Re-analyze')}</motion.button>
            <button onClick={() => setRejectMode(false)} className="px-3 py-2 text-[11px] text-[var(--text-tertiary)] cursor-pointer">{L('취소', 'Cancel')}</button>
          </div>
        </div>
      )}
    </motion.div>
  );
}

/* ═══ Convergence Status (Weakness C fix) ═══ */
function ConvergenceStatus({ metrics }: { metrics: ConvergenceMetrics }) {
  const locale = useLocale();
  const L = (ko: string, en: string) => locale === 'ko' ? ko : en;
  const colorClass = metrics.score >= 75 ? 'text-emerald-600 bg-emerald-50' :
    metrics.score >= 50 ? 'text-amber-600 bg-amber-50' : 'text-red-500 bg-red-50';
  const barColor = metrics.score >= 75 ? 'bg-emerald-400' :
    metrics.score >= 50 ? 'bg-amber-400' : 'bg-red-400';

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5, ease: EASE }}
      className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-[var(--bg)]/60 border border-[var(--border-subtle)]">
      <div className="flex-1">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] font-medium text-[var(--text-tertiary)]">{L('명확도', 'Clarity')}</span>
          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${colorClass}`}>{metrics.score}%</span>
        </div>
        <div className="h-1 rounded-full bg-[var(--border-subtle)] overflow-hidden">
          <motion.div className={`h-full rounded-full ${barColor}`}
            initial={{ width: 0 }} animate={{ width: `${metrics.score}%` }} transition={{ duration: 0.8, ease: EASE }} />
        </div>
      </div>
      <p className="text-[10px] text-[var(--text-tertiary)] max-w-[160px] leading-tight">{metrics.guidance}</p>
    </motion.div>
  );
}

/* ═══ Pipeline Exit Buttons (Weakness D fix) ═══ */
function PipelineExitOptions({ onReframe, onRehearse }: {
  onReframe: () => void;
  onRehearse: () => void;
}) {
  const locale = useLocale();
  const L = (ko: string, en: string) => locale === 'ko' ? ko : en;
  return (
    <div className="flex flex-col gap-2 border-t border-dashed border-[var(--border-subtle)] pt-4 mt-2">
      <p className="text-[10px] font-medium text-[var(--text-tertiary)] tracking-wide">{L('다른 도구로 전환', 'Switch to another tool')}</p>
      <div className="flex gap-2">
        <button onClick={onReframe}
          className="flex-1 text-left px-3 py-2 rounded-xl bg-[var(--bg)]/60 hover:bg-[var(--accent)]/5 border border-transparent hover:border-[var(--accent)]/10 cursor-pointer transition-colors duration-300">
          <p className="text-[11px] font-medium text-[var(--text-secondary)]">{L('→ 문제 재정의', '→ Reframe Problem')}</p>
          <p className="text-[9px] text-[var(--text-tertiary)]">{L('더 깊이 들어가기', 'Dig deeper')}</p>
        </button>
        <button onClick={onRehearse}
          className="flex-1 text-left px-3 py-2 rounded-xl bg-[var(--bg)]/60 hover:bg-[var(--accent)]/5 border border-transparent hover:border-[var(--accent)]/10 cursor-pointer transition-colors duration-300">
          <p className="text-[11px] font-medium text-[var(--text-secondary)]">{L('→ 피드백 먼저', '→ Feedback First')}</p>
          <p className="text-[9px] text-[var(--text-tertiary)]">{L('이해관계자 반응 시뮬레이션', 'Simulate stakeholder reactions')}</p>
        </button>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════ */
/* ═══ MAIN                             ═══ */
/* ═══════════════════════════════════════════ */

export function ProgressiveFlow({ projectId }: { projectId: string }) {
  const locale = useLocale();
  const L = (ko: string, en: string) => locale === 'ko' ? ko : en;
  const store = useProgressiveStore();
  const session = store.currentSession();
  // Global click-outside: clears sticky attribution hover state when user taps blank space
  useAttributionClickOutside();
  const [busy, setBusy] = useState(false);
  // Chronicler — enriches log waypoints with narration once the stream settles.
  useChronicler(session, !busy);
  const [error, setError] = useState<string | null>(null);
  const [showMix, setShowMix] = useState(false);
  const [streamingText, setStreamingText] = useState<string | null>(null);
  // Manual team-assignment modal — kept on the parent so children can open
  // it with a single callback while we own the data shape it needs. Two
  // modes: `task` (add to a specific group) and `free` (auto-match a
  // persona to the best-fitting open group).
  type PoolModalState = { mode: 'task'; targetGroupId: string } | { mode: 'free' } | null;
  const [poolModal, setPoolModal] = useState<PoolModalState>(null);
  // Which response shape the current stream represents. Handlers set this
  // because phase alone isn't enough — e.g. onFinalize streams while
  // phase === 'refining', but the stream is a doc, not feedback.
  const [streamKind, setStreamKind] = useState<'analysis' | 'doc' | 'feedback'>('analysis');
  // Fine-grained stage inside long async pipelines (mix, final) — feeds
  // PhaseStatusBar's substage so the user sees "gathering → debate → drafting"
  // instead of 30s of "Drafting the document".
  const [substage, setSubstage] = useState<string | null>(null);
  const [cmReview, setCmReview] = useState<NavigatorReview | null>(null);
  const debateResult = session?.debate_result as DebateResult | null ?? null;
  // ── Post-complete draft tree UI state ──
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [previewDraftId, setPreviewDraftId] = useState<string | null>(null);
  const [iterationOpen, setIterationOpen] = useState(false);
  const [iterationDirective, setIterationDirective] = useState('');
  const [isIterating, setIsIterating] = useState(false);
  const [justReactivatedFromBranch, setJustReactivatedFromBranch] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);
  const workerAbortRef = useRef<AbortController | null>(null);
  const workersRef = useRef<Promise<void> | null>(null);
  // Scroll refs for targeted navigation
  const statusBarRef = useRef<HTMLDivElement>(null);
  const questionRef = useRef<HTMLDivElement>(null);
  const workerSectionRef = useRef<HTMLDivElement>(null);
  const mixPreviewRef = useRef<HTMLDivElement>(null);
  const dmFeedbackRef = useRef<HTMLDivElement>(null);
  const finalRef = useRef<HTMLDivElement>(null);
  const answeredPillsRef = useRef<HTMLDivElement>(null);
  const analysisCardRef = useRef<HTMLDivElement>(null);

  // Double rAF: frame 1 lets React commit pending state, frame 2 ensures the
  // new element is laid out before we scroll to it. Previous 200/250ms timers
  // lost races when the user was scrolling themselves.
  const scroll = useCallback((mode: 'bottom' | 'top' = 'bottom') => {
    requestAnimationFrame(() => requestAnimationFrame(() => {
      window.scrollTo({ top: mode === 'top' ? 0 : document.body.scrollHeight, behavior: 'smooth' });
    }));
  }, []);
  const scrollToRef = useCallback((ref: React.RefObject<HTMLElement | null>, fallback: 'top' | 'bottom' = 'bottom') => {
    requestAnimationFrame(() => requestAnimationFrame(() => {
      if (ref.current) {
        ref.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } else {
        window.scrollTo({ top: fallback === 'top' ? 0 : document.body.scrollHeight, behavior: 'smooth' });
      }
    }));
  }, []);

  // Cleanup: abort all in-flight requests on unmount
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      workerAbortRef.current?.abort();
      abortRef.current?.abort();
    };
  }, []);

  // Auto-create the origin checkpoint on first mount of an active session
  // that has at least an initial snapshot but no checkpoints yet. Lets
  // legacy (pre-checkpoint) sessions populate naturally as the user
  // continues — and gives new sessions an "origin" rewind target.
  useEffect(() => {
    if (!session) return;
    if ((session.checkpoints || []).length > 0) return;
    if (session.snapshots.length === 0) return;
    store.recordCheckpoint('origin');
    // Single fire per session — guarded by checkpoints.length === 0.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.id, session?.snapshots.length]);

  // Supabase Realtime: subscribe to session updates (human agent responses)
  useEffect(() => {
    if (!session?.id) return;
    const hasPendingHumans = (session.workers || []).some(
      w => w.agent_type === 'human' && (w.status === 'sent' || w.status === 'waiting_response')
    );
    if (!hasPendingHumans) return;

    let channel: ReturnType<typeof import('@supabase/supabase-js').SupabaseClient.prototype.channel> | null = null;
    import('@/lib/supabase').then(({ supabase }) => {
      channel = supabase.channel(`session:${session.id}`)
        .on('postgres_changes', {
          event: 'UPDATE',
          schema: 'public',
          table: 'progressive_sessions',
          filter: `id=eq.${session.id}`,
        }, (payload) => {
          // Remote update — per-worker patch instead of full session overwrite
          // Only applies human response arrivals; preserves local AI worker progress
          if (!payload.new || !mountedRef.current) return;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const remoteData = (payload.new as any)?.data;
          if (remoteData?.workers && Array.isArray(remoteData.workers)) {
            const localWorkers = store.currentSession()?.workers ?? [];
            let patched = false;
            for (const rw of remoteData.workers) {
              const lw = localWorkers.find(w => w.id === rw.id);
              if (lw && rw.status === 'done' && lw.status !== 'done' && rw.human_input) {
                store.updateWorker(rw.id, {
                  status: 'done',
                  result: rw.result,
                  human_input: rw.human_input,
                  response_at: rw.response_at,
                  completed_at: rw.completed_at,
                  approved: rw.approved ?? true,
                });
                patched = true;
              }
            }
            // Fallback: if no per-worker patch matched, reload fully (e.g., remote schema changed)
            if (!patched) store.loadSessions();
          } else {
            store.loadSessions();
          }
        })
        .subscribe();
    });

    return () => {
      if (channel) {
        import('@/lib/supabase').then(({ supabase }) => {
          supabase.removeChannel(channel!);
        });
      }
    };
  }, [session?.id, session?.workers?.filter(w => w.agent_type === 'human' && (w.status === 'sent' || w.status === 'waiting_response')).length]);

  const phase = session?.phase ?? 'input';
  const snapshots = session?.snapshots ?? [];
  const questions = session?.questions ?? [];
  const answers = session?.answers ?? [];
  const mix = session?.mix ?? null;
  const dmFb = session?.dm_feedback ?? null;
  const final_ = session?.final_deliverable ?? null;
  const finalMix = session?.final_mix ?? null;
  const round = session?.round ?? 0;
  const maxR = session?.max_rounds ?? 3;

  // Elapsed timer for PhaseStatusBar — tracks seconds rather than formatting
  // inline so the same value can derive isLongWait (30s threshold) for the
  // cancel affordance.
  const [phaseStartTime, setPhaseStartTime] = useState<number | null>(null);
  const [elapsedSec, setElapsedSec] = useState(0);
  useEffect(() => {
    if (busy || phase === 'analyzing' || phase === 'mixing' || phase === 'lead_synthesizing') {
      if (!phaseStartTime) setPhaseStartTime(Date.now());
    } else {
      setPhaseStartTime(null);
      setElapsedSec(0);
    }
  }, [busy, phase]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!phaseStartTime) return;
    const t = setInterval(() => {
      setElapsedSec(Math.floor((Date.now() - phaseStartTime) / 1000));
    }, 1000);
    return () => clearInterval(t);
  }, [phaseStartTime]);
  const elapsedLabel = phaseStartTime
    ? (elapsedSec < 60 ? `${elapsedSec}s` : `${Math.floor(elapsedSec / 60)}m ${elapsedSec % 60}s`)
    : '';
  const isLongWait = elapsedSec >= 30;

  // ── Post-complete draft tree derivations ──
  const drafts = useMemo<Draft[]>(() => session?.drafts ?? [], [session?.drafts]);
  const activeDraftId = session?.active_draft_id ?? null;
  const activeDraftPath = useMemo<Draft[]>(() => {
    if (drafts.length === 0) return [];
    const nodes = drafts.map((d) => ({
      id: d.id,
      parent_id: d.parent_draft_id,
      created_at: d.created_at,
      _full: d,
    }));
    return getActivePath(nodes, activeDraftId).map((n) => n._full);
  }, [drafts, activeDraftId]);
  const activeDraft = activeDraftPath.length > 0
    ? activeDraftPath[activeDraftPath.length - 1]
    : undefined;
  const activeDraftPathIds = useMemo(
    () => new Set(activeDraftPath.map((d) => d.id)),
    [activeDraftPath],
  );
  const draftIsOnBranch = useMemo(() => {
    if (drafts.length === 0) return false;
    const simple = drafts.map((d) => ({
      id: d.id,
      parent_id: d.parent_draft_id,
      created_at: d.created_at,
    }));
    return isOnBranch(simple, activeDraftPathIds);
  }, [drafts, activeDraftPathIds]);
  const previewDraft = previewDraftId
    ? drafts.find((d) => d.id === previewDraftId) ?? null
    : null;
  const dm = session?.decision_maker ?? null;

  const qaPairs = useMemo(() => questions.map((q, i) => ({ question: q, answer: answers[i] || null })), [questions, answers]);
  const curQ = questions.length > answers.length ? questions[questions.length - 1] : null;
  const latest = snapshots[snapshots.length - 1] || null;
  const shouldMix = showMix || (phase === 'conversing' && snapshots.length > 0 && !curQ && !mix && !busy);
  const deployPhase = session?.worker_deploy_phase ?? 'none';
  const workers = session?.workers ?? [];
  const workerContext = useWorkerContext();
  const workerActions = useWorkerActions(workerContext);

  // Workers that have completed (for inline display in flow)
  const completedWorkers = workers.filter(w => w.status === 'done' || w.status === 'waiting_input' || w.status === 'error');
  // Staggered reveal — completed workers appear with cascade delay
  const revealedIds = useStaggeredReveal(workers, session?.id ?? null);
  const revealedWorkers = completedWorkers.filter(w => revealedIds.has(w.id));

  // Ping the user when every deployed worker reaches a terminal state so they
  // notice the transition — especially on mobile where the worker drawer is
  // closed by default. We only ping if we've actually *seen* workers in a
  // non-terminal state first; otherwise a resumed session with all workers
  // already done would fire the toast on mount.
  const workersPingedRef = useRef(false);
  const sawWorkingRef = useRef(false);
  useEffect(() => {
    if (workers.length === 0 || deployPhase !== 'deployed') {
      workersPingedRef.current = false;
      sawWorkingRef.current = false;
      return;
    }
    const isTerminal = (s: WorkerTask['status']) =>
      s === 'done' || s === 'error' || s === 'waiting_input';
    const stillWorking = workers.some(w => !isTerminal(w.status));
    if (stillWorking) {
      sawWorkingRef.current = true;
      workersPingedRef.current = false;
      return;
    }
    if (sawWorkingRef.current && !workersPingedRef.current) {
      workersPingedRef.current = true;
      useAgentAttentionStore.getState().ping('workers_done');
      // Voyage chart — workers all reached terminal state.
      store.recordCheckpoint('crew_done');
    }
  }, [workers, deployPhase]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!session) return null;

  /* Shared worker execution — used by both deploy and resume */
  const startWorkerExecution = (ws: WorkerTask[]) => {
    const qa = qaPairs.filter(q => q.answer).map(q => ({ question: q.question, answer: q.answer! }));
    const ctx: WorkerContext = {
      problemText: session.problem_text,
      realQuestion: latest?.real_question ?? '',
      skeleton: latest?.skeleton ?? [],
      hiddenAssumptions: latest?.hidden_assumptions ?? [],
      qaHistory: qa.map(q => ({ q: q.question.text, a: q.answer.value })),
      sessionId: session.id,
    };
    workerAbortRef.current?.abort();
    workerAbortRef.current = new AbortController();
    const workerCallbacks = {
      onStart: (id: string) => store.updateWorker(id, { status: 'running', started_at: new Date().toISOString() }),
      onStream: (id: string, text: string) => store.setWorkerStreamText(id, text),
      onComplete: (id: string, result: string, validation?: { score: number; passed: boolean; issues: string[] }) => {
        const w = store.currentSession()?.workers.find(ww => ww.id === id);
        const persona = w?.persona;
        const note = persona
          ? getCompletionNote(persona.id, locale)
          : null;
        const validationFields = validation
          ? { validation_score: validation.score, validation_passed: validation.passed, validation_feedback: validation.issues.join('; ') }
          : {};
        // v2: Use agent_type + ai_scope to determine completion behavior (not status, which gets overwritten by onStart)
        const aType = w?.agent_type;
        const isAiPreparing = (aType === 'self' || aType === 'human') && w?.ai_scope;
        if (isAiPreparing) {
          store.updateWorker(id, { status: 'waiting_input', ai_preliminary: result, stream_text: '', ...validationFields });
        } else if (w?.who === 'both' || (aType === 'ai' && w?.self_scope)) {
          store.updateWorker(id, { status: 'waiting_input', result, stream_text: '', completion_note: note, ...validationFields });
        } else {
          store.updateWorker(id, { status: 'done', result, stream_text: '', completion_note: note, completed_at: new Date().toISOString(), ...validationFields });
        }
        scroll();
      },
      onError: (id: string, error: string) => store.updateWorker(id, { status: 'error', error, stream_text: '' }),
    };

    // Transcript wrapping — 한 번만, 최외곽에서
    const trackedCallbacks = withTranscript(session.id, workerCallbacks);

    const stages = store.currentSession()?.stages;
    const hasMultipleStages = stages && stages.length > 1;

    workersRef.current = (hasMultipleStages
      ? runPipeline(ws, stages, ctx, trackedCallbacks, workerAbortRef.current.signal)
      : runAllAIWorkers(ws, ctx, trackedCallbacks, workerAbortRef.current.signal)
    ).catch((err) => {
      console.error('[Worker orchestration error]', err);
      if (mountedRef.current) {
        setError(err instanceof Error ? err.message : L('에이전트 작업 중 오류가 발생했습니다.', 'Agent task error occurred.'));
      }
    });
  };

  /* Deploy workers — user confirmed the team */
  const onDeployWorkers = () => {
    if (deployPhase === 'deployed') return;
    const preDeployWorkers = store.currentSession()?.workers ?? [];
    if (preDeployWorkers.length === 0) return;
    // Voyage chart — capture crew composition right before they set off,
    // so the user can rewind to "before deploy" and try a different team.
    store.recordCheckpoint('crew_set');
    store.deployWorkers();
    useAgentAttentionStore.getState().ping('deploy');
    const ws = store.currentSession()?.workers ?? [];

    // Auto-send human agent questions (fire-and-forget)
    const humanWorkers = ws.filter(w => w.agent_type === 'human' && w.contact?.address && !w.sent_at);
    if (humanWorkers.length > 0) {
      import('@/lib/supabase').then(({ supabase }) => {
        supabase.auth.getSession().then(({ data: { session: authSession } }) => {
          if (!authSession?.access_token) return;
          const headers = { 'Authorization': `Bearer ${authSession.access_token}`, 'Content-Type': 'application/json' };
          for (const hw of humanWorkers) {
            const endpoint = hw.contact?.channel === 'slack' ? '/api/slack/send' : '/api/email/send-question';
            const qTitle = t('progressive.humanQTitle', { task: hw.task });
            const qContext = hw.ai_preliminary ? t('progressive.humanQContext', { ai: hw.ai_preliminary }) : '';
            const body = hw.contact?.channel === 'slack'
              ? { userId: hw.contact.address, title: qTitle, content: `${hw.question_to_human || hw.task}${qContext ? `\n\n${qContext}` : ''}`, sessionId: session.id, workerId: hw.id }
              : { to: hw.contact!.address, subject: qTitle, question: hw.question_to_human || hw.task, context: hw.ai_preliminary || '', senderName: session.decision_maker || 'Argus', sessionId: session.id, workerId: hw.id };
            fetch(endpoint, { method: 'POST', headers, body: JSON.stringify(body) })
              .then(r => r.json())
              .then(r => {
                if (r.ok) {
                  store.updateWorker(hw.id, { status: 'sent', sent_at: new Date().toISOString() });
                } else {
                  store.updateWorker(hw.id, { status: 'error', error: t('progressive.sendFailed', { reason: r.error || t('progressive.unknownError') }) });
                }
              })
              .catch(() => {
                store.updateWorker(hw.id, { status: 'error', error: t('progressive.networkError') });
              });
          }
        });
      });
    }
    startWorkerExecution(ws);
  };

  /* Resume workers — after crash/reload, continue from where we left off */
  const isResumable = deployPhase === 'deployed' && !final_
    && workers.some(w => w.status === 'pending')
    && workers.some(w => w.status === 'done' && w.result);
  const onResumeWorkers = () => {
    const ws = store.currentSession()?.workers ?? [];
    startWorkerExecution(ws);
  };

  /* Handlers */
  const onAnswer = async (value: string) => {
    if (!curQ || busy || !latest) return;
    const ans: FlowAnswer = { question_id: curQ.id, value };
    store.addAnswer(ans); store.setPhase('analyzing'); track('flow_answer', { round }); setBusy(true); setError(null); scrollToRef(statusBarRef);
    // Tell the sidebar agents "new input just landed" — triggers flash
    useAgentAttentionStore.getState().ping('answer');

    // ── Phase 1: capture typed question effect ──
    // If the question had typed metadata, pull out the effect tied to the
    // chosen option. We apply it onto the post-deepening snapshot below so
    // the LLM cannot overwrite the user's explicit fork / weakness choice.
    const typedEffect = findEffectForAnswer(curQ, value);
    let forkEffect: StrategicForkEffect | null = null;
    let weakEffect: WeaknessCheckEffect | null = null;
    if (typedEffect) {
      if ('decisionLine' in typedEffect) forkEffect = typedEffect as StrategicForkEffect;
      else if ('weakestAssumption' in typedEffect && 'nextThreeDays' in typedEffect) weakEffect = typedEffect as WeaknessCheckEffect;
    }

    try {
      const qa = qaPairs.filter(q => q.answer).map(q => ({ question: q.question, answer: q.answer! }));
      qa.push({ question: curQ, answer: ans });
      if (!dm && round === 0) {
        const v = value.toLowerCase();
        const g = value.includes('대표') || v.includes('ceo') || v.includes('founder') ? (locale === 'ko' ? '대표님' : 'CEO')
          : value.includes('팀장') || v.includes('manager') || v.includes('lead') ? (locale === 'ko' ? '팀장님' : 'Manager')
          : value.includes('투자') || v.includes('investor') || v.includes('vc') ? (locale === 'ko' ? '투자자' : 'Investor')
          : null;
        if (g) store.setDecisionMaker(g);
      }
      abortRef.current = new AbortController();
      setStreamKind('analysis');
      setStreamingText('');
      // Lead context: inject lead agent persona into deepening prompt
      let leadCtx: string | undefined;
      if (session.lead_agent) {
        const leadAgent = useAgentStore.getState().getAgent(session.lead_agent.agent_id);
        if (leadAgent) {
          const cfg: LeadAgentConfig = {
            agentId: leadAgent.id, agentName: leadAgent.name, agentNameEn: leadAgent.nameEn || leadAgent.name,
            agentRole: leadAgent.role, agentRoleEn: leadAgent.roleEn || leadAgent.role,
            expertise: leadAgent.expertise || '', tone: leadAgent.tone || '',
            domain: (session.lead_agent?.domain || 'strategy') as import('@/lib/orchestrator-classify').Domain,
          };
          leadCtx = buildLeadDecompositionContext(cfg, locale as 'ko' | 'en');
        }
      }
      const personas = usePersonaStore.getState().personas.filter(p => !p.is_example && !p.deleted_at).map(p => ({ name: p.name, role: p.role, hasContact: !!(p.contact?.email || p.contact?.slack_id) }));
      const r = await runDeepening(session.problem_text, latest, qa, round, maxR, snapshots, (text) => setStreamingText(text), abortRef.current.signal, leadCtx, personas.length > 0 ? personas : undefined);
      setStreamingText(null);
      // Phase 1: merge typed-question effects onto the fresh snapshot.
      // Strategy: if the user picked a strategic_fork option, the fork's
      // snapshotPatch (real_question/skeleton/hidden_assumptions) is what
      // the user explicitly signed up for — it takes precedence over the
      // LLM's own reinterpretation in runDeepening. decision_line is
      // stickiest: it must survive every subsequent round.
      let mergedSnapshot: AnalysisSnapshot = r.snapshot;
      if (forkEffect?.snapshotPatch) {
        mergedSnapshot = applySnapshotPatch(mergedSnapshot, forkEffect.snapshotPatch);
      }
      if (weakEffect?.snapshotPatch) {
        mergedSnapshot = applySnapshotPatch(mergedSnapshot, weakEffect.snapshotPatch);
      }
      mergedSnapshot = {
        ...mergedSnapshot,
        decision_line: forkEffect?.decisionLine ?? latest.decision_line ?? r.snapshot.decision_line,
        weakest_assumption: weakEffect?.weakestAssumption ?? latest.weakest_assumption ?? r.snapshot.weakest_assumption,
        next_three_days: weakEffect?.nextThreeDays ?? latest.next_three_days ?? r.snapshot.next_three_days,
      };
      store.addSnapshot(mergedSnapshot); store.advanceRound();
      // Prepare workers when execution_plan appears
      const existingWorkers = store.currentSession()?.workers ?? [];
      const currentDeployPhase = store.currentSession()?.worker_deploy_phase ?? 'none';
      if (r.snapshot.execution_plan && r.snapshot.execution_plan.steps.length > 0) {
        if (existingWorkers.length === 0) {
          // First time — init workers
          store.initWorkers(r.snapshot.execution_plan.steps);
        } else if (currentDeployPhase === 'ready') {
          // Plan changed before deploy — check if tasks differ
          const oldTasks = existingWorkers.map(w => w.task).sort().join('|');
          const newTasks = r.snapshot.execution_plan.steps.map(s => s.task).sort().join('|');
          if (oldTasks !== newTasks) {
            // Re-init with updated plan (workers haven't been deployed yet, safe to replace)
            store.initWorkers(r.snapshot.execution_plan.steps);
          }
        }
        // After deployed — don't touch running workers
      }
      if (r.readyForMix || !r.question) {
        setShowMix(true); store.setPhase('conversing');
        // Team analysis done — MixTrigger is mounting below. Scroll there so
        // users see the next CTA, not the phase bar above.
        scroll();
      } else {
        store.addQuestion(r.question); store.setPhase('conversing');
        scrollToRef(questionRef);
      }
      // Voyage chart checkpoint — captures the post-answer state. Recorded
      // after addSnapshot/addQuestion so the snapshot reflects the user's
      // most recent answer.
      store.recordCheckpoint('briefing');
    } catch (e) { setStreamingText(null); if (!(e instanceof DOMException && e.name === 'AbortError')) setError(e instanceof Error ? e.message : L('분석 실패', 'Analysis failed')); store.setPhase('conversing'); scrollToRef(statusBarRef); }
    finally { setBusy(false); abortRef.current = null; }
  };

  const onMix = async () => {
    setBusy(true); setError(null); store.setPhase('mixing'); scrollToRef(statusBarRef);
    setSubstage(L('팀 결과 모으는 중', 'Gathering team results'));
    abortRef.current = new AbortController();
    try {
      // Wait for any running AI workers to finish before collecting results
      if (workersRef.current) {
        await workersRef.current;
        workersRef.current = null;
      }
      const qa = qaPairs.filter(q => q.answer).map(q => ({ question: q.question, answer: q.answer! }));
      // Collect mixable worker results — final + preliminary + pending_human
      const enrichedResults = store.mixableWorkerResults();
      // Group same-task results so the LLM sees them adjacent. Group order
      // mirrors first-worker step_index from initWorkers; within a group
      // results stay in their original order.
      const groupOrder = new Map<string, number>();
      enrichedResults.forEach((w, i) => {
        if (!groupOrder.has(w.taskGroupId)) groupOrder.set(w.taskGroupId, i);
      });
      const sortedResults = enrichedResults.slice().sort((a, b) => {
        const ga = groupOrder.get(a.taskGroupId) ?? 0;
        const gb = groupOrder.get(b.taskGroupId) ?? 0;
        return ga - gb;
      });
      const workerResults = sortedResults.map(w => ({
        workerId: w.workerId,
        name: w.agentName || w.persona || undefined,
        task: w.type === 'preliminary' ? `[${L('참고', 'Ref')}] ${w.task}` : w.type === 'pending_human' ? `[${L('대기', 'Pending')}] ${w.task}` : w.task,
        result: w.result,
        // Pass taskGroupId so the Mix prompt can render same-task multi-persona
        // results as a single block with sub-bullets.
        taskGroupId: w.taskGroupId,
      }));

      // 항해장 메타 리뷰 + debate (해금 시만, 비차단)
      if (workerResults.length > 0) {
        const cmWorkers = session!.workers
          .filter(w => w.approved !== false && w.result)
          .map(w => ({
            agentName: personaName(w.persona, locale) || L('에이전트', 'Agent'),
            agentRole: personaRole(w.persona, locale),
            task: w.task,
            result: w.result || '',
            // Same-task multi-persona signal for the Navigator prompt.
            taskGroupId: w.task_group_id || w.id,
          }));
        runNavigatorReview(session!.problem_text, cmWorkers)
          .then(r => { if (r && mountedRef.current) setCmReview(r); })
          .catch(() => {});

        // Critical stakes: Cross-Agent Debate (mix 전에 실행하여 결과를 반영)
        const stages = session?.stages;
        if (stages && stages.length > 1) {
          setSubstage(L('팀 내 반론 검토 중', 'Running team-internal debate'));
          const debateWorkers = cmWorkers.map(w => ({ ...w, framework: session!.workers.find(ww => ww.persona?.name === w.agentName)?.framework || null }));
          try {
            const debateRes = await runDebate(session!.problem_text, debateWorkers);
            if (debateRes) {
              store.setDebateResult(debateRes);
              // debate 결과를 workerResults에 추가하여 mix에 반영
              workerResults.push({
                workerId: '',
                name: undefined,
                task: locale === 'ko' ? `[팀 내 반론] ${debateRes.targetAgent}의 분석에 대한 비판` : `[Team Dissent] Critique of ${debateRes.targetAgent}'s analysis`,
                result: locale === 'ko' ? `${debateRes.challenge}\n\n약점: ${debateRes.weakestClaim}\n\n대안: ${debateRes.alternativeView}` : `${debateRes.challenge}\n\nWeakness: ${debateRes.weakestClaim}\n\nAlternative: ${debateRes.alternativeView}`,
                taskGroupId: 'debate',
              });
            }
          } catch { /* debate 실패해도 mix는 진행 */ }
        }
      }

      // Lead Agent Synthesis + Mix: 병렬 실행
      // Lead synthesis는 Mix의 품질을 높이지만 필수가 아님 (null 허용).
      // Lead를 먼저 시작하고 Mix와 병렬로 진행 — Lead가 먼저 끝나면 Mix에 반영, 아니면 Mix는 Lead 없이 실행.
      let leadSynthesis: LeadSynthesisResult | null = null;
      const sessionLead = session?.lead_agent;
      let leadPromise: Promise<LeadSynthesisResult | null> = Promise.resolve(null);

      if (sessionLead && workerResults.length > 0) {
        const leadAgent = useAgentStore.getState().getAgent(sessionLead.agent_id);
        if (leadAgent) {
          store.setPhase('lead_synthesizing'); scrollToRef(statusBarRef);
          const leadConfig: LeadAgentConfig = {
            agentId: leadAgent.id, agentName: leadAgent.name, agentNameEn: leadAgent.nameEn || leadAgent.name,
            agentRole: leadAgent.role, agentRoleEn: leadAgent.roleEn || leadAgent.role,
            expertise: leadAgent.expertise || '', tone: leadAgent.tone || '',
            domain: (session?.lead_agent?.domain || 'strategy') as import('@/lib/orchestrator-classify').Domain,
          };
          const attributedResults = enrichedResults.map(w => ({
            agentName: w.agentName || L('에이전트', 'Agent'),
            agentRole: w.agentRole || '',
            task: w.task,
            result: w.result,
            // Same-task multi-persona signal for Lead synthesis.
            taskGroupId: w.taskGroupId,
          }));
          const realQ = latest?.real_question || session!.problem_text;
          // Lead synthesis를 비동기로 시작 (await 하지 않음)
          leadPromise = runLeadSynthesis(session!.problem_text, realQ, attributedResults, leadConfig, abortRef.current?.signal)
            .then(result => {
              const currentSession = store.currentSession();
              if (currentSession?.id !== session?.id) return null;
              store.setLeadSynthesis(result);
              // Record synthesis activity so the lead's growth (XP / level /
              // last_used_at) reflects the work it just did. Without this,
              // the lead never accrues XP from synthesis work.
              useAgentStore.getState().recordActivity(
                leadConfig.agentId,
                'synthesis_completed',
                session!.problem_text.slice(0, 100),
                session!.id,
              );
              return result;
            })
            .catch(() => null);
        }
      }

      // Lead synthesis 완료 대기 (짧은 타임아웃) — 끝났으면 Mix에 포함, 아니면 null로 진행
      store.setPhase('mixing'); scrollToRef(statusBarRef);
      setSubstage(L('문서 구조 잡는 중', 'Building document structure'));
      leadSynthesis = await Promise.race([
        leadPromise,
        new Promise<null>(resolve => setTimeout(() => resolve(null), 4000)),
      ]);

      setSubstage(L('초안 본문 작성 중', 'Writing draft body'));
      setStreamKind('doc');
      setStreamingText('');
      const m = await runMix(
        session!.problem_text, snapshots, qa, dm,
        workerResults.length > 0 ? workerResults : undefined,
        abortRef.current.signal, leadSynthesis, session?.user_notes,
        (text) => setStreamingText(text),
      );
      setStreamingText(null);
      // Lead가 Mix보다 늦게 끝났으면 비동기로 저장 (Mix에는 미포함이지만 UI에는 표시)
      if (!leadSynthesis) leadPromise.then(late => { if (late) store.setLeadSynthesis(late); });
      store.setMix(m); setShowMix(false); track('flow_mix', { rounds: round, has_lead: !!leadSynthesis });
      // Voyage chart — mix landed; user can rewind here to try a different
      // mix (e.g., add user_notes and re-run).
      store.recordCheckpoint('mix');

      // Phase 6: Boss reviewer가 있으면 자동 DM 피드백
      let autoDMFired = false;
      if (session?.reviewer_agent_id) {
        const reviewerAgent = useAgentStore.getState().getAgent(session.reviewer_agent_id);
        if (reviewerAgent) {
          setSubstage(L(`${reviewerAgent.name}이(가) 검토 중`, `${reviewerAgent.name} is reviewing`));
          setStreamKind('feedback');
          setStreamingText('');
          const f = await runBossDMFeedback(m, reviewerAgent, session.problem_text, abortRef.current.signal, 'quick', (text) => setStreamingText(text));
          setStreamingText(null);
          store.setDMFeedback(f);
          store.recordCheckpoint('review');
          autoDMFired = true;
          import('@/lib/observation-engine').then(({ onBossReviewCompleted }) => {
            onBossReviewCompleted(reviewerAgent.id, f);
          }).catch(() => {});
          useAgentStore.getState().recordActivity(reviewerAgent.id, 'review_given', session.problem_text.slice(0, 100));
        }
      }
      // Fire the most specific completion cue (DM > mix) and scroll to the
      // card that will actually render. MixPreview hides when dmFb is set.
      if (autoDMFired) {
        useAgentAttentionStore.getState().ping('dm_ready');
        scrollToRef(dmFeedbackRef, 'bottom');
      } else {
        useAgentAttentionStore.getState().ping('mix_done');
        scrollToRef(mixPreviewRef, 'bottom');
      }
    } catch (e) { setStreamingText(null); if (!(e instanceof DOMException && e.name === 'AbortError')) setError(e instanceof Error ? e.message : L('초안 생성 실패', 'Draft creation failed')); store.setPhase('conversing'); scrollToRef(statusBarRef); }
    finally { setBusy(false); setSubstage(null); abortRef.current = null; }
  };

  const onDM = async () => {
    if (!mix) return; setBusy(true); setError(null); scrollToRef(statusBarRef);
    abortRef.current = new AbortController();
    try {
      // Boss agent가 연결되어 있으면 Boss 성격 DM 피드백
      const reviewerAgent = session?.reviewer_agent_id
        ? useAgentStore.getState().getAgent(session.reviewer_agent_id)
        : undefined;

      setSubstage(
        reviewerAgent
          ? L(`${reviewerAgent.name}이(가) 읽는 중`, `${reviewerAgent.name} is reading`)
          : L('초안을 검토하는 중', 'Reviewing the draft')
      );
      setStreamKind('feedback');
      setStreamingText('');

      const f = reviewerAgent
        ? await runBossDMFeedback(mix, reviewerAgent, session!.problem_text, abortRef.current.signal, 'quick', (text) => setStreamingText(text))
        : await runDMFeedback(mix, dm || L('의사결정권자', 'Decision-Maker'), session!.problem_text, abortRef.current.signal, 'quick', (text) => setStreamingText(text));

      setStreamingText(null);
      store.setDMFeedback(f);
      store.recordCheckpoint('review');
      useAgentAttentionStore.getState().ping('dm_ready');
      scrollToRef(dmFeedbackRef, 'bottom');

      // Boss 리뷰 후 observation 업데이트 + XP
      if (reviewerAgent && f) {
        import('@/lib/observation-engine').then(({ onBossReviewCompleted }) => {
          onBossReviewCompleted(reviewerAgent.id, f);
        }).catch(() => {});
        useAgentStore.getState().recordActivity(reviewerAgent.id, 'review_given', session!.problem_text.slice(0, 100));
      }
    }
    catch (e) { setStreamingText(null); if (!(e instanceof DOMException && e.name === 'AbortError')) setError(e instanceof Error ? e.message : L('DM 피드백 실패', 'DM feedback failed')); scrollToRef(statusBarRef); }
    finally { setBusy(false); setSubstage(null); abortRef.current = null; }
  };

  const onDeepen = async () => {
    if (!mix) return; setBusy(true); setError(null); scrollToRef(statusBarRef);
    abortRef.current = new AbortController();
    try {
      const reviewerAgent = session?.reviewer_agent_id
        ? useAgentStore.getState().getAgent(session.reviewer_agent_id)
        : undefined;

      setSubstage(L('심화 검토 중 — 논리·근거 점검', 'Deep review — logic & evidence'));
      setStreamKind('feedback');
      setStreamingText('');

      const f = reviewerAgent
        ? await runBossDMFeedback(mix, reviewerAgent, session!.problem_text, abortRef.current.signal, 'deep', (text) => setStreamingText(text))
        : await runDMFeedback(mix, dm || L('의사결정권자', 'Decision-Maker'), session!.problem_text, abortRef.current.signal, 'deep', (text) => setStreamingText(text));

      setStreamingText(null);
      store.setDMFeedback(f);
      store.recordCheckpoint('review', L('심화 검토', 'Deep review'));
      useAgentAttentionStore.getState().ping('dm_ready');
      scrollToRef(dmFeedbackRef, 'bottom');
      track('flow_deepen', { has_boss: !!reviewerAgent });
    }
    catch (e) { setStreamingText(null); if (!(e instanceof DOMException && e.name === 'AbortError')) setError(e instanceof Error ? e.message : L('심화 검토 실패', 'Deep review failed')); scrollToRef(statusBarRef); }
    finally { setBusy(false); setSubstage(null); abortRef.current = null; }
  };

  const onMore = async () => {
    if (!latest) return; setShowMix(false); setBusy(true); store.setPhase('analyzing'); scrollToRef(statusBarRef);
    try {
      const qa = qaPairs.filter(q => q.answer).map(q => ({ question: q.question, answer: q.answer! }));
      qa.push({ question: { id: 's', text: locale === 'ko' ? '더?' : 'More?', type: 'select', engine_phase: 'recast' }, answer: { question_id: 's', value: t('progressive.oneMore') } });
      abortRef.current = new AbortController();
      setStreamKind('analysis');
      setStreamingText('');
      // Lead context for onMore deepening
      let moreLeadCtx: string | undefined;
      if (session?.lead_agent) {
        const la = useAgentStore.getState().getAgent(session.lead_agent.agent_id);
        if (la) {
          const cfg: LeadAgentConfig = {
            agentId: la.id, agentName: la.name, agentNameEn: la.nameEn || la.name,
            agentRole: la.role, agentRoleEn: la.roleEn || la.role,
            expertise: la.expertise || '', tone: la.tone || '',
            domain: (session.lead_agent?.domain || 'strategy') as import('@/lib/orchestrator-classify').Domain,
          };
          moreLeadCtx = buildLeadDecompositionContext(cfg, locale as 'ko' | 'en');
        }
      }
      const personas2 = usePersonaStore.getState().personas.filter(p => !p.is_example && !p.deleted_at).map(p => ({ name: p.name, role: p.role, hasContact: !!(p.contact?.email || p.contact?.slack_id) }));
      const r = await runDeepening(session!.problem_text, latest, qa, round, round + 2, snapshots, (text) => setStreamingText(text), abortRef.current.signal, moreLeadCtx, personas2.length > 0 ? personas2 : undefined);
      setStreamingText(null);
      r.question ? (store.addQuestion(r.question), store.setPhase('conversing')) : (setShowMix(true), store.setPhase('conversing'));
    } catch (e) { setStreamingText(null); if (!(e instanceof DOMException && e.name === 'AbortError')) setError(e instanceof Error ? e.message : L('실패', 'Failed')); store.setPhase('conversing'); setShowMix(true); }
    finally { setBusy(false); abortRef.current = null; scroll(); }
  };

  const onSkip = () => {
    if (!mix) return;
    const md = [`# ${mix.title}`, '', `> ${mix.executive_summary}`, '', ...mix.sections.flatMap(s => [`## ${s.heading}`, '', s.content, '']),
      ...(mix.key_assumptions.length ? [`## ${L('전제 조건', 'Assumptions')}`, '', ...mix.key_assumptions.map(a => `- ${a}`), ''] : []),
      ...(mix.next_steps.length ? [`## ${L('다음 단계', 'Next Steps')}`, '', ...mix.next_steps.map(s => `- ${s}`), ''] : [])].join('\n');
    // Skip keeps the original mix intact → attribution survives for FinalCard.
    store.setFinalDeliverable(md, mix);
    store.recordCheckpoint('anchor', L('정박 (피드백 건너뜀)', 'Anchor (skipped review)'));
    setError(null);
    useAgentAttentionStore.getState().ping('final_done');
    scrollToRef(finalRef, 'top');
  };

  const onFinalize = async () => {
    if (!mix || !dmFb) return; setBusy(true); setError(null); scrollToRef(statusBarRef);
    setSubstage(L('피드백 반영 + 최종본 다듬는 중', 'Applying feedback + polishing'));
    setStreamKind('doc');
    setStreamingText('');
    abortRef.current = new AbortController();
    try {
      // Carry the original mixableWorkerResults forward so unmatched sections can still resolve via heuristic.
      const enrichedResults = store.mixableWorkerResults();
      const workerSources = enrichedResults
        .filter(w => !!w.workerId && !!(w.agentName || w.persona))
        .map(w => ({ workerId: w.workerId, name: (w.agentName || w.persona)!, result: w.result }));
      const { markdown, finalMix } = await runFinalDeliverable(mix, dmFb, abortRef.current.signal, workerSources, (text) => setStreamingText(text));
      setStreamingText(null);
      store.setFinalDeliverable(markdown, finalMix);
      store.recordCheckpoint('anchor');
      useAgentAttentionStore.getState().ping('final_done');
      scrollToRef(finalRef, 'top');
      track('flow_done', { project_id: projectId, rounds: round });
    }
    catch (e) { setStreamingText(null); if (!(e instanceof DOMException && e.name === 'AbortError')) setError(e instanceof Error ? e.message : L('최종본 실패', 'Finalization failed')); scrollToRef(statusBarRef); }
    finally { setBusy(false); setSubstage(null); abortRef.current = null; }
  };

  // ─── Post-complete iteration handlers ─────────────────────────────

  /** User submitted a revision directive → call 항해장 → append a new draft. */
  const onRequestRevision = async () => {
    // Hard guard against double-submission (double click, keyboard re-entry,
    // React-18 batched click → state-lag). The `disabled` prop on the button
    // eventually catches this, but adds a belt to the suspenders.
    if (isIterating) return;
    if (!activeDraft || !session) return;
    const directive = iterationDirective.trim();
    if (directive.length === 0) return;

    setIsIterating(true);
    setError(null);
    // Intentionally do NOT flip session.phase — the session stays in 'complete'
    // during revision, and only the local `isIterating` flag drives the
    // in-modal spinner. This keeps PhaseAmbient/progress-dots stable and
    // makes tab-close-mid-revision recover cleanly.

    try {
      const { revised_text, change_summary } = await runNavigatorRevision({
        currentFinalText: activeDraft.final_text,
        directive,
        problemContext: session.problem_text,
        currentVersionLabel: activeDraft.version_label,
        priorDrafts: activeDraftPath.map((d) => ({
          version_label: d.version_label,
          change_summary: d.change_summary,
        })),
      });

      store.addDraft({
        parent_draft_id: activeDraft.id,
        directive,
        change_summary: change_summary || L('수정 반영', 'Revised'),
        final_text: revised_text,
        final_mix: null,
        reviewing_agent_id: 'navigator',
      });

      setIterationDirective('');
      setIterationOpen(false);
      setJustReactivatedFromBranch(false);
      track('progressive_revision_done', { directive_length: directive.length });
      scroll('top');
    } catch (e) {
      setError(e instanceof Error ? e.message : L('수정 요청 실패', 'Revision failed'));
      // Keep the modal open so the user can read the inline error and retry.
    } finally {
      setIsIterating(false);
    }
  };

  /** Switch to an older draft (= branch-in-progress). */
  const handleBranchToDraft = (draftId: string) => {
    if (!session) return;
    store.setActiveDraft(draftId);
    setDrawerOpen(false);
    setPreviewDraftId(null);
    // If we landed on a non-leaf branch, flag it so the modal opens primed.
    const target = drafts.find((d) => d.id === draftId);
    if (target) {
      setJustReactivatedFromBranch(true);
    }
    track('progressive_branch_to_draft', { draft_id: draftId });
  };

  const handlePromoteDraft = (draftId: string) => {
    store.promoteDraftToV1(draftId);
    track('progressive_promote_v1', { draft_id: draftId });
  };

  return (
    <>
      <PhaseAmbient phase={phase} />
      <motion.div className="relative z-10 mx-auto px-4 md:px-0"
        animate={{ maxWidth: phase === 'complete' ? '56rem' : (phase === 'mixing' || phase === 'lead_synthesizing' || phase === 'dm_feedback' || phase === 'refining') ? '48rem' : '42rem' }}
        transition={{ duration: 0.8, ease: EASE }}>

        <PingToast />
        {/* Manual team-assignment modal — derives task/group info from the
            current worker state at render time so it always reflects the
            latest store. Both modes (task / free) share the same modal
            component; mode-specific UI lives inside the modal. */}
        {(() => {
          if (!poolModal) return null;
          // Build group info list (used by both modes — task-mode uses the
          // target group's data, free-mode iterates for best-match).
          const groupBuckets = new Map<string, WorkerTask[]>();
          const groupOrder: string[] = [];
          for (const w of workers) {
            const gid = w.task_group_id || w.id;
            if (!groupBuckets.has(gid)) {
              groupBuckets.set(gid, []);
              groupOrder.push(gid);
            }
            groupBuckets.get(gid)!.push(w);
          }
          const groupInfos = groupOrder.map(gid => {
            const members = groupBuckets.get(gid)!;
            const seed = members[0];
            return {
              groupId: gid,
              task: seed.task,
              aiScope: seed.ai_scope ?? null,
              expectedOutput: seed.expected_output ?? null,
              memberCount: members.length,
              personaIds: members.map(m => m.persona?.id).filter((x): x is string => !!x),
            };
          });

          if (poolModal.mode === 'task') {
            const target = groupInfos.find(g => g.groupId === poolModal.targetGroupId);
            if (!target) return null;
          }

          return (
            <PersonaPoolModal
              isOpen
              mode={poolModal.mode}
              targetGroupId={poolModal.mode === 'task' ? poolModal.targetGroupId : undefined}
              groups={groupInfos}
              maxPerGroup={5}
              onClose={() => setPoolModal(null)}
              onSelect={(persona, matchedGroupId) => {
                const newId = store.addWorkerToGroup(matchedGroupId, persona);
                if (newId) setPoolModal(null);
              }}
            />
          );
        })()}
        <ProgressLine phase={phase} round={round} hasMix={!!mix} />

        {/* PhaseStatusBar + StreamSnippet — sticky wrapper so progress info
            stays glued to the top while the user scrolls through the long
            page. Sticky lives on the wrapper, not the bar itself, so the
            wrapper provides the scroll travel room (its bottom is the body
            of the page). */}
        <div ref={statusBarRef} className="sticky top-14 z-30 mb-6 pt-2 pb-1 bg-[var(--bg)]/85 backdrop-blur-sm">
          <PhaseStatusBar
            phase={phase} busy={busy}
            hasQuestion={!!curQ && !busy && phase === 'conversing'}
            deployReady={deployPhase === 'ready' && workers.length > 0}
            shouldMix={shouldMix && !busy && phase === 'conversing' && !curQ}
            workersRunning={workers.filter(w => w.status === 'running').length}
            workersDone={workers.filter(w => w.status === 'done').length}
            workersTotal={workers.length}
            elapsedLabel={elapsedLabel}
            leadAgentName={session?.lead_agent?.agent_name}
            substage={substage}
            isLongWait={isLongWait}
            onCancel={busy ? () => abortRef.current?.abort() : undefined}
          />
          {/* Live preview of the streaming response — makes the 15–45s LLM
              waits (analysis / mix / DM review / final) visible instead of
              silent spinners. Handlers set `streamKind` because phase alone
              doesn't disambiguate (onFinalize runs while phase='refining'). */}
          <AnimatePresence>
            {streamingText !== null && (
              <StreamSnippet key="stream" text={streamingText} kind={streamKind} />
            )}
          </AnimatePresence>
        </div>

        <div className="space-y-8">
          {/* User input + reviewer — stacked pills */}
          <div className="flex flex-col gap-2 items-start">
            <motion.div layout className="flex items-center gap-3 px-5 py-3 rounded-full bg-[var(--bg)] border border-[var(--border-subtle)] max-w-full">
              <div className="w-5 h-5 rounded-full bg-[var(--text-primary)] flex items-center justify-center shrink-0">
                <span className="text-[var(--bg)] text-[9px] font-bold">{L('나', 'Me')}</span>
              </div>
              <p className="text-[13px] text-[var(--text-secondary)] truncate">{session.problem_text}</p>
            </motion.div>
            <ReviewerBadge reviewerId={session.reviewer_agent_id || null} />
          </div>

          {/* PhaseDivider: Team assembled → confirm */}
          {deployPhase === 'ready' && workers.length > 0 && (
            <PhaseDivider done={L('상황 파악', 'Analysis')} next={L('팀 구성 확인', 'Confirm team')} yourTurn />
          )}

          {/* Team deploy banner — 사용자 확인 후 worker 실행 */}
          {deployPhase === 'ready' && workers.length > 0 && (
            <TeamDeployBanner
              workers={workers}
              onDeploy={onDeployWorkers}
              onUpdateWorker={(id, partial) => store.updateWorker(id, partial)}
              onOpenPool={(groupId) => setPoolModal({ mode: 'task', targetGroupId: groupId })}
              onOpenFreePool={() => setPoolModal({ mode: 'free' })}
              onRemoveWorker={(id) => store.removeWorker(id)}
              onUpdateTask={(groupId, text) => store.updateGroupTask(groupId, text)}
            />
          )}

          {/* Resume banner — 크래시/새로고침 후 미완료 작업 재개 */}
          {isResumable && (
            <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="mx-4 mt-3 p-4 rounded-xl border border-amber-500/30 bg-amber-500/5">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-[13px] text-amber-600 dark:text-amber-400">
                  <span>⟳</span>
                  <span>{L('중단된 작업이 있습니다', 'Interrupted tasks found')}</span>
                  <span className="text-[var(--text-tertiary)]">
                    ({workers.filter(w => w.status === 'done').length}/{workers.length} {L('완료', 'done')})
                  </span>
                </div>
                <button onClick={onResumeWorkers}
                  className="px-3 py-1.5 text-[13px] font-medium rounded-lg bg-amber-500 text-white hover:bg-amber-600 transition-colors">
                  {L('이어서 실행', 'Resume')}
                </button>
              </div>
            </motion.div>
          )}

          {/* Update summary chip — surfaces "what changed" at the user's eye level
              (right above the next question). AnalysisCard lives further down,
              so without this, users miss the evolution they just triggered. */}
          {latest && snapshots.length > 1 && !final_ && phase === 'conversing' && !mix && (
            <UpdateSummaryChip
              snapshot={latest}
              prevSnapshot={snapshots[snapshots.length - 2]}
              onSeeDetail={() => scrollToRef(analysisCardRef, 'top')}
              locale={locale}
            />
          )}

          {/* Question FIRST — user action at the top, not buried below */}
          <div ref={questionRef}>
            {/* First-time onboarding — explains *why* we're asking the user
                questions and what happens after. Shown only on the very
                first question of a session; disappears once the user has
                answered anything. */}
            {curQ && !busy && phase === 'conversing' && round === 0 && answers.length === 0 && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.45, ease: EASE, delay: 0.15 }}
                className="flex items-start gap-2.5 px-4 py-3 mb-4 rounded-xl bg-[var(--accent)]/[0.05] border border-[var(--accent)]/20"
              >
                <span className="text-[15px] shrink-0 leading-none mt-0.5">⚓</span>
                <p className="text-[12.5px] text-[var(--text-secondary)] leading-[1.55]">
                  {locale === 'ko'
                    ? <>항해 준비예요. 질문 <strong className="text-[var(--text-primary)]">두세 개</strong>만 짚어주시면, 어울리는 <strong className="text-[var(--text-primary)]">팀을 꾸려서</strong> 출항해요.</>
                    : <>Getting ready to sail. Just <strong className="text-[var(--text-primary)]">a couple of questions</strong> and we&apos;ll <strong className="text-[var(--text-primary)]">assemble your crew</strong> for the voyage.</>}
                </p>
              </motion.div>
            )}
            {curQ && !busy && phase === 'conversing' && <QuestionCard key={curQ.id} question={curQ} onAnswer={onAnswer} disabled={busy} locale={locale} />}
          </div>

          {/* Inline worker reports — staggered reveal for polished feel.
              (PhaseStatusBar already surfaces "team working" state.) */}
          {deployPhase === 'deployed' && !final_ && (
            <div ref={workerSectionRef} className="space-y-4">
              {/* Running workers — minimal: avatar + task + spinner (no streaming text) */}
              {workers.filter(w => w.status === 'running').map(w => (
                <motion.div key={w.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}
                  className="flex items-center gap-3 px-4 py-3 rounded-xl bg-[var(--bg)]/40">
                  <WorkerAvatar persona={w.persona} size="sm" pulse />
                  <span className="text-[13px] text-[var(--text-secondary)] flex-1 truncate">{personaName(w.persona, locale) || 'AI'} — {w.task}</span>
                  <Loader2 size={14} className="animate-spin text-[var(--accent)] shrink-0" />
                </motion.div>
              ))}
              {/* Revealed workers — polished report blocks with fade+slide entrance */}
              {(() => {
                const firstWaitingId = revealedWorkers.find(w => w.status === 'waiting_input')?.id;
                return revealedWorkers.map(w => (
                  <motion.div key={w.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: EASE }}>
                    <WorkerReportBlock
                      worker={w}
                      onSubmitInput={w.status === 'waiting_input' ? workerActions.handleSubmit : undefined}
                      onRetry={w.status === 'error' ? workerActions.handleRetry : undefined}
                      onApprove={w.status === 'done' ? workerActions.handleApprove : undefined}
                      onReject={w.status === 'done' ? workerActions.handleReject : undefined}
                      isFirstWaiting={w.id === firstWaitingId}
                    />
                  </motion.div>
                ));
              })()}
            </div>
          )}

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

          {/* Lead Synthesis — previously hidden, now visible.
              (Drafting status already surfaced in PhaseStatusBar.) */}
          {session?.lead_synthesis && !final_ && (
            <LeadSynthesisCard synthesis={session.lead_synthesis} />
          )}

          {/* Living Analysis — stays collapsed throughout the conversing
              phase so the user isn't buried under accumulating cards.
              VoyagePrepSummary picks up the decision-point role at the
              shouldMix moment; this card is a "tap to read the full
              breakdown" affordance, not the primary narrative. Auto-
              expands once mix begins (phase moves past 'conversing'). */}
          {latest && !final_ && (
            <div ref={analysisCardRef}>
              <AnalysisCard
                snapshot={latest}
                prevSnapshot={snapshots.length > 1 ? snapshots[snapshots.length - 2] : null}
                isActive={!mix}
                showExecutionPlan
                locale={locale}
                defaultCollapsed={phase === 'conversing' && !mix}
              />
            </div>
          )}

          {/* Framing Confirmation — Round 1 후 사용자 확인 (Weakness A) */}
          {latest && !latest.framing_locked && snapshots.length === 1 && phase === 'conversing' && !mix && !final_ && (
            <FramingConfirmation
              snapshot={latest}
              onConfirm={() => {
                store.updateLatestSnapshot({ framing_locked: true });
                track('framing_confirmed', { confidence: latest.framing_confidence });
              }}
              onReject={async (reason) => {
                setBusy(true); setError(null);
                try {
                  setStreamKind('analysis');
                  setStreamingText('');
                  const r = await refineInitialFraming(
                    session.problem_text, latest.real_question, reason,
                    (text) => setStreamingText(text),
                  );
                  setStreamingText(null);
                  store.replaceInitialSnapshot(r.snapshot);
                  if (r.detectedDM) store.setDecisionMaker(r.detectedDM);
                  store.replaceLatestQuestion(r.question);
                  track('framing_rejected', { reason });
                } catch (e) { setStreamingText(null); setError(e instanceof Error ? e.message : L('재분석 실패', 'Re-analysis failed')); }
                finally { setBusy(false); scroll(); }
              }}
              busy={busy}
            />
          )}

          {/* Convergence Status — 라운드 2+ (Weakness C) */}
          {snapshots.length >= 2 && !mix && !final_ && phase === 'conversing' && (
            <ConvergenceStatus metrics={
              workers.length > 0
                ? assessConvergenceWithWorkers(snapshots, workers.map(w => ({ validationScore: w.validation_score, approved: w.approved })))
                : assessConvergence(snapshots)
            } />
          )}

          {/* Pipeline Exit — 라운드 1+ 후 4R로 분기 가능 (Weakness D) */}
          {latest && snapshots.length >= 1 && !mix && !final_ && phase === 'conversing' && !busy && (
            <PipelineExitOptions
              onReframe={() => {
                try {
                  const item = exportProgressiveAsReframe(session);
                  // 실제 store에 저장 + 프로젝트 연결
                  useReframeStore.getState().addItem(item);
                  store.linkToReframe(item.id);
                  if (session.project_id) {
                    useProjectStore.getState().addRef(session.project_id, {
                      tool: 'reframe', itemId: item.id, label: session.problem_text.slice(0, 30),
                    });
                  }
                  track('progressive_exit_to_reframe', { round });
                  window.location.href = `/workspace?step=reframe&handoff=progressive&itemId=${item.id}`;
                } catch (e) { setError(e instanceof Error ? e.message : L('전환 실패', 'Switch failed')); }
              }}
              onRehearse={() => {
                try {
                  const item = exportProgressiveAsRecast(session);
                  // 실제 store에 저장 + 프로젝트 연결
                  useRecastStore.getState().addItem(item);
                  store.linkToRecast(item.id);
                  if (session.project_id) {
                    useProjectStore.getState().addRef(session.project_id, {
                      tool: 'recast', itemId: item.id, label: session.problem_text.slice(0, 30),
                    });
                  }
                  track('progressive_exit_to_rehearse', { round });
                  window.location.href = `/workspace?step=rehearse&handoff=progressive&itemId=${item.id}`;
                } catch (e) { setError(e instanceof Error ? e.message : L('전환 실패', 'Switch failed')); }
              }}
            />
          )}

          {/* Answered Q&A history — collapsed at bottom. ref is used by
              VoyagePrepSummary's "Revisit my answers" link to scroll back
              to the Q&A history without disrupting the user's flow. */}
          {!final_ && (
            <div ref={answeredPillsRef}>
              <AnsweredPills qaPairs={qaPairs} />
            </div>
          )}

          {/* PhaseDivider: Draft ready → Review */}
          {mix && !dmFb && !final_ && phase !== 'mixing' && (
            <PhaseDivider done={L('초안 완성', 'Draft ready')} next={L('검토', 'Review')} yourTurn />
          )}
          <div ref={mixPreviewRef}>
            {mix && !dmFb && !final_ && phase !== 'mixing' && <MixPreview mix={mix} dm={dm} onDM={onDM} onSkip={onSkip} busy={busy} cmReview={cmReview} debateResult={debateResult} />}
          </div>
          <div ref={dmFeedbackRef}>
            {dmFb && !final_ && (
              // Stable key per review — rebuilds the baseline snapshot only
              // when a new review arrives, not when toggleFix rebuilds the
              // fb object. first_reaction is effectively unique per review.
              <DMFeedback
                key={`${dmFb.persona_name}::${dmFb.first_reaction}`}
                fb={dmFb}
                onToggle={(i) => store.toggleFix(i)}
                onFinalize={onFinalize}
                onDeepen={onDeepen}
                busy={busy}
              />
            )}
          </div>

          {final_ && <div ref={finalRef}>
            {/* Version chip + history toggle — subtle header */}
            {activeDraft && (
              <div className="flex items-center justify-end gap-2 pb-2">
                <button
                  onClick={() => setDrawerOpen(true)}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[11px] text-[var(--text-secondary)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors"
                  title={L('버전 히스토리 열기', 'Open version history')}
                >
                  <History className="w-3 h-3" />
                  <span className="font-semibold">{activeDraft.version_label}</span>
                  <span className="text-[var(--text-tertiary)]">· {drafts.length}{L('개', '')}</span>
                </button>
              </div>
            )}

            {/* Branch-in-progress banner */}
            {draftIsOnBranch && activeDraft && (
              <div className="flex items-start justify-between gap-2 px-3 py-2 mb-2 rounded-lg bg-[var(--gold-muted)]/30 border border-[var(--accent-light)]/30">
                <div className="flex items-start gap-2 text-[12px] text-[var(--text-primary)]">
                  <GitBranch className="w-3.5 h-3.5 text-[var(--accent)] mt-0.5" />
                  <div>
                    <div>
                      {L('현재', 'Currently on')}{' '}
                      <span className="font-semibold">{activeDraft.version_label}</span>
                      {L('에서 분기 작업 중', ' (branch)')}
                    </div>
                    {justReactivatedFromBranch && (
                      <div className="text-[11px] text-[var(--text-secondary)] mt-0.5">
                        {L('이전 결과는 버전 히스토리에 그대로 남아있습니다.', 'Previous results remain in version history.')}
                      </div>
                    )}
                  </div>
                </div>
                {drafts.length > 0 && (() => {
                  // "Latest main line" = draft whose version_label has the fewest dots
                  // (shallowest branch level), then latest created among those.
                  const mainLineCandidates = [...drafts].sort((a, b) => {
                    const aDots = (a.version_label.match(/\./g) || []).length;
                    const bDots = (b.version_label.match(/\./g) || []).length;
                    if (aDots !== bDots) return aDots - bDots;
                    return (b.created_at || '').localeCompare(a.created_at || '');
                  });
                  const latestMain = mainLineCandidates[0];
                  if (!latestMain || latestMain.id === activeDraft.id) return null;
                  return (
                    <button
                      onClick={() => {
                        store.setActiveDraft(latestMain.id);
                        setJustReactivatedFromBranch(false);
                      }}
                      className="text-[11px] text-[var(--accent)] hover:underline shrink-0"
                    >
                      {L('최신으로 돌아가기', 'Back to latest')}
                    </button>
                  );
                })()}
              </div>
            )}

            {/* Completion moment */}
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.5, ease: EASE }}
              className="flex flex-col items-center justify-center gap-2 py-6">
              <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: 'var(--gradient-gold)' }}>
                <Check size={16} className="text-white" />
              </div>
              <p className="text-[16px] font-semibold text-[var(--text-primary)]">
                {dmFb && dmFb.concerns.filter((c: DMConcern) => c.applied).length > 0
                  ? locale === 'ko' ? `피드백 ${dmFb.concerns.filter((c: DMConcern) => c.applied).length}건이 반영된 최종 문서입니다` : `Final document with ${dmFb.concerns.filter((c: DMConcern) => c.applied).length} feedback item(s) applied`
                  : L('최종 문서가 완성되었습니다', 'Your document is complete')}
              </p>
              <p className="text-[13px] text-[var(--text-tertiary)]">
                {L('아래에서 복사하거나, 새 프로젝트를 시작할 수 있어요', 'Copy below or start a new project')}
              </p>
            </motion.div>
            <FinalCard
              content={final_}
              mix={finalMix}
              sessionId={session?.id ?? null}
              releasedContent={(() => {
                const rid = session?.released_draft_id;
                if (!rid) return null;
                const r = drafts.find((d) => d.id === rid);
                if (!r || r.id === activeDraftId) return null;
                return r.final_text;
              })()}
              releasedLabel={(() => {
                const rid = session?.released_draft_id;
                if (!rid) return null;
                const r = drafts.find((d) => d.id === rid);
                if (!r || r.id === activeDraftId) return null;
                return r.version_label;
              })()}
            />

            {/* Debate result — persisted, collapsible */}
            {debateResult && (
              <motion.details initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}
                className="mt-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] group">
                <summary className="flex items-center gap-2 px-4 py-3 cursor-pointer text-[12px] font-semibold text-[var(--text-secondary)] select-none">
                  <span className="text-[14px]">{'⚔️'}</span>
                  {L('팀 내 반론', 'Team Dissent')}
                  <span className={`ml-auto text-[9px] px-2 py-0.5 rounded-full font-medium ${
                    debateResult.severity === 'critical' ? 'bg-red-100 text-red-600' : debateResult.severity === 'important' ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-500'
                  }`}>{debateResult.severity}</span>
                </summary>
                <div className="px-4 pb-4 space-y-2 text-[13px] text-[var(--text-primary)] leading-relaxed">
                  <p>{debateResult.challenge}</p>
                  {debateResult.weakestClaim && <p className="text-[var(--text-secondary)]"><strong>{debateResult.targetAgent}</strong>{L('의 약점: ', "'s weakness: ")}{debateResult.weakestClaim}</p>}
                  {debateResult.alternativeView && <p className="text-[var(--text-secondary)] italic">{debateResult.alternativeView}</p>}
                </div>
              </motion.details>
            )}

            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }} className="pt-8 pb-16">
              <p className="text-[13px] text-[var(--text-tertiary)] text-center mb-6">{L('복사해서 바로 사용하세요.', 'Copy and use it right away.')}</p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center flex-wrap">
                <button onClick={() => { useProgressiveStore.setState({ currentSessionId: null }); window.location.reload(); }}
                  className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-2xl text-white text-[13px] font-semibold cursor-pointer"
                  style={{ background: 'var(--gradient-gold)' }}>{L('새 프로젝트 시작', 'Start New Project')} <ArrowRight size={12} /></button>
                <button onClick={() => { setIterationOpen(true); setIterationDirective(''); }}
                  className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-2xl text-[13px] font-semibold text-[var(--text-primary)] border border-[var(--accent)]/30 bg-[var(--gold-muted)]/30 hover:bg-[var(--gold-muted)]/50 cursor-pointer transition-colors">
                  <Wand2 size={13} className="text-[var(--accent)]" /> {L('항해장에게 수정 요청', 'Ask Navigator to revise')}
                </button>
                <button onClick={() => { if (mix) { store.setFinalDeliverable(null as unknown as string); store.setDMFeedback(null as unknown as import('@/stores/types').DMFeedbackResult); store.setMix(null as unknown as MixResult); setShowMix(true); } }}
                  className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-2xl text-[13px] font-medium text-[var(--text-secondary)] border border-[var(--border-subtle)] hover:border-[var(--accent)]/30 cursor-pointer transition-colors">
                  {L('이해관계자 검증 다시 하기', 'Re-run stakeholder review')}
                </button>
              </div>
            </motion.div>
          </div>}

          <AnimatePresence>
            {error && <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              {error.startsWith('LOGIN_REQUIRED') ? (
                <div className="rounded-2xl border border-[var(--accent)]/20 bg-[var(--accent)]/5 p-6">
                  <p className="text-[15px] font-bold text-[var(--text-primary)] mb-1">{L('무료 체험을 모두 사용했어요', 'Free trial limit reached')}</p>
                  <p className="text-[13px] text-[var(--text-secondary)] mb-4">{L('로그인하면 하루 10회까지 무료로 사용할 수 있습니다.', 'Sign in to get up to 10 free uses per day.')}</p>
                  <a href="/login" className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl text-white text-[14px] font-semibold" style={{ background: 'var(--gradient-gold)' }}>{L('로그인', 'Sign In')} <ChevronRight size={14} /></a>
                </div>
              ) : (
                <div className="flex items-start gap-2.5 px-5 py-4 rounded-2xl bg-red-50 border border-red-200 text-[13px] text-red-700">
                  <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                  <div>
                    <span>{error?.includes('한도') || error?.includes('rate') ? L('무료 체험 한도에 도달했습니다. Settings에서 본인의 API 키를 등록하면 무제한 사용이 가능합니다.', 'Free trial limit reached. Register your own API key in Settings for unlimited use.') : error}</span>
                    {(error?.includes('한도') || error?.includes('rate')) && (
                      <a href="/settings" className="block mt-1.5 text-[12px] text-red-600 font-medium hover:underline">{L('Settings에서 API 키 등록하기 →', 'Register API key in Settings →')}</a>
                    )}
                  </div>
                </div>
              )}
            </motion.div>}
          </AnimatePresence>

          {/* Phase progress dots — bottom milestone indicator */}
          <div className="pt-8 pb-4">
            <div className="flex items-center justify-center gap-2">
              {(locale === 'ko'
                ? ['상황 파악', '질문', '팀 작업', '피드백', '완성']
                : ['Analysis', 'Questions', 'Team Work', 'Feedback', 'Done']
              ).map((label, i) => {
                const milestonePhases = ['analyzing', 'conversing', 'mixing', 'dm_feedback', 'complete'];
                const milestoneIdx = milestonePhases.indexOf(phase);
                const reached = i <= milestoneIdx;
                const current = i === milestoneIdx;
                return (
                  <div key={i} className="flex items-center gap-2">
                    {i > 0 && <div className={`w-5 h-[1.5px] transition-colors duration-500 ${reached ? 'bg-[var(--accent)]/50' : 'bg-[var(--border-subtle)]'}`} />}
                    <div className={`flex items-center gap-1.5 px-2 py-1 rounded-full transition-all duration-300 ${
                      current ? 'bg-[var(--accent)]/10' : ''
                    } ${current ? 'opacity-100' : reached ? 'opacity-70' : 'opacity-35'}`}>
                      <div className={`relative w-2 h-2 rounded-full transition-colors duration-500 ${reached ? 'bg-[var(--accent)]' : 'bg-[var(--text-tertiary)]'}`}>
                        {current && <div className="absolute inset-0 rounded-full bg-[var(--accent)] animate-ping opacity-40" />}
                      </div>
                      <span className={`text-[12px] ${current ? 'text-[var(--accent)] font-semibold' : reached ? 'text-[var(--text-secondary)]' : 'text-[var(--text-tertiary)]'}`}>{label}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </motion.div>

      {/* ═══ Version History Drawer ═══ */}
      {drawerOpen && drafts.length > 0 && (
        <VersionHistoryDrawer
          nodes={drafts.map<VersionTreeItem>((d) => ({
            id: d.id,
            parent_id: d.parent_draft_id,
            created_at: d.created_at,
            label: d.version_label,
            summary: d.change_summary,
            is_released: session?.released_draft_id === d.id,
          }))}
          activeLeafId={activeDraftId}
          activePathIds={activeDraftPathIds}
          previewNodeId={previewDraftId}
          rootLabel={L('v0 (초기 분석)', 'v0 (initial analysis)')}
          rootSummary={L('에이전트 팀의 첫 합성', 'First team synthesis')}
          onClose={() => setDrawerOpen(false)}
          onPreview={(id) => setPreviewDraftId(id)}
          onBranch={handleBranchToDraft}
          onPromote={handlePromoteDraft}
        />
      )}

      {/* ═══ Draft Preview Modal ═══ */}
      {previewDraft && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
          onClick={() => setPreviewDraftId(null)}
        >
          <div
            className="relative w-full max-w-2xl max-h-[85vh] bg-[var(--bg)] rounded-xl shadow-[var(--shadow-lg)] border border-[var(--border)] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <header className="flex items-center justify-between px-5 py-3 border-b border-[var(--border)]">
              <div>
                <p className="text-[11px] text-[var(--text-tertiary)]">{L('미리보기 · 읽기 전용', 'Preview · read-only')}</p>
                <h3 className="text-[14px] font-semibold text-[var(--text-primary)]">{previewDraft.version_label}</h3>
                {previewDraft.change_summary && (
                  <p className="text-[12px] text-[var(--text-secondary)] mt-0.5">{previewDraft.change_summary}</p>
                )}
              </div>
              <button
                className="p-1.5 rounded-lg hover:bg-[var(--surface)]"
                onClick={() => setPreviewDraftId(null)}
                aria-label={L('닫기', 'Close')}
              >
                <XIcon className="w-4 h-4" />
              </button>
            </header>
            <div className="flex-1 overflow-y-auto px-5 py-4">
              <pre className="text-[12px] text-[var(--text-primary)] whitespace-pre-wrap leading-relaxed">
                {previewDraft.final_text}
              </pre>
            </div>
            <footer className="flex items-center justify-end gap-2 px-5 py-3 border-t border-[var(--border)]">
              <button
                className="px-4 py-2 rounded-lg text-[12px] text-[var(--text-secondary)] border border-[var(--border)] hover:bg-[var(--surface)] transition-colors"
                onClick={() => setPreviewDraftId(null)}
              >
                {L('닫기', 'Close')}
              </button>
              {previewDraft.id !== activeDraftId && (
                <button
                  className="inline-flex items-center gap-1 px-4 py-2 rounded-lg text-[12px] font-semibold text-white bg-[var(--accent)] hover:opacity-90 transition-opacity"
                  onClick={() => handleBranchToDraft(previewDraft.id)}
                >
                  <GitBranch className="w-3 h-3" /> {L('여기서 분기', 'Branch from here')}
                </button>
              )}
            </footer>
          </div>
        </div>
      )}

      {/* ═══ Revision Directive Modal ═══ */}
      {iterationOpen && activeDraft && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
          onClick={() => { if (!isIterating) { setIterationOpen(false); setIterationDirective(''); } }}
        >
          <div
            className="relative w-full max-w-xl bg-[var(--bg)] rounded-xl shadow-[var(--shadow-lg)] border border-[var(--border)] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <header className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
              <div className="flex items-center gap-2">
                <Wand2 className="w-4 h-4 text-[var(--accent)]" />
                <div>
                  <h3 className="text-[14px] font-semibold text-[var(--text-primary)]">
                    {L('항해장에게 수정 요청', 'Ask Navigator to revise')}
                  </h3>
                  <p className="text-[11px] text-[var(--text-tertiary)] mt-0.5">
                    {L('현재 버전', 'Current version')}: <span className="font-semibold">{activeDraft.version_label}</span>
                  </p>
                </div>
              </div>
              {!isIterating && (
                <button
                  className="p-1.5 rounded-lg hover:bg-[var(--surface)]"
                  onClick={() => { setIterationOpen(false); setIterationDirective(''); }}
                  aria-label={L('닫기', 'Close')}
                >
                  <XIcon className="w-4 h-4" />
                </button>
              )}
            </header>
            <div className="flex-1 px-5 py-4">
              <p className="text-[12px] text-[var(--text-secondary)] mb-2">
                {L('어떻게 고치면 좋을까? 구체적인 지시일수록 좋아요.', 'How should it change? More specific is better.')}
              </p>
              <textarea
                value={iterationDirective}
                onChange={(e) => setIterationDirective(e.target.value)}
                placeholder={L('예: 재무 섹션의 가정을 더 보수적으로. 낙관/기본/비관 3가지 시나리오 추가.', 'e.g. Make financial assumptions more conservative. Add 3 scenarios.')}
                className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-2.5 text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:border-[var(--accent)] resize-none leading-relaxed"
                rows={5}
                maxLength={500}
                disabled={isIterating}
                autoFocus
              />
              <div className="text-[10px] text-[var(--text-tertiary)] mt-1 text-right">
                {iterationDirective.length} / 500
              </div>
              {isIterating && (
                <div className="mt-3 flex items-center gap-2 text-[12px] text-[var(--accent)]">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>{L('항해장이 편집 중입니다...', 'Navigator is editing...')}</span>
                </div>
              )}
              {!isIterating && error && (
                <div className="mt-3 flex items-start gap-2 px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-[12px] text-red-700">
                  <AlertTriangle size={13} className="shrink-0 mt-0.5" />
                  <span className="flex-1">{error}</span>
                  <button
                    className="text-[11px] text-red-600 hover:underline shrink-0"
                    onClick={() => setError(null)}
                    aria-label={L('에러 닫기', 'Dismiss error')}
                  >
                    {L('닫기', 'Dismiss')}
                  </button>
                </div>
              )}
            </div>
            <footer className="flex items-center justify-end gap-2 px-5 py-3 border-t border-[var(--border)]">
              <button
                className="px-4 py-2 rounded-lg text-[12px] text-[var(--text-secondary)] border border-[var(--border)] hover:bg-[var(--surface)] transition-colors disabled:opacity-50"
                onClick={() => { setIterationOpen(false); setIterationDirective(''); }}
                disabled={isIterating}
              >
                {L('취소', 'Cancel')}
              </button>
              <button
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-[12px] font-semibold text-white bg-[var(--accent)] hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
                onClick={onRequestRevision}
                disabled={isIterating || iterationDirective.trim().length === 0}
              >
                {isIterating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wand2 className="w-3 h-3" />}
                {isIterating ? L('생성 중...', 'Generating...') : L('수정본 생성', 'Generate revision')}
              </button>
            </footer>
          </div>
        </div>
      )}
    </>
  );
}
