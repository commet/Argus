'use client';

import { DAILY_LIMIT } from '@/lib/quota-config';
import { hasKnownUser } from '@/lib/auth';
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { useProgressiveStore } from '@/stores/useProgressiveStore';
import {
  runDeepening,
  refineInitialFraming,
  runMix,
  runDMFeedback,
  runBossDMFeedback,
  runFinalDeliverable,
  runOverreach,
  runHighestLoad,
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
import { exportProgressiveAsReframe, exportProgressiveAsRecast } from '@/lib/progressive-handoff';
import { useAgentStore } from '@/stores/useAgentStore';
import { usePersonaStore } from '@/stores/usePersonaStore';
import { useReframeStore } from '@/stores/useReframeStore';
import { playTransitionTone, resumeAudioContext } from '@/lib/audio';
import { useRecastStore } from '@/stores/useRecastStore';
import { useProjectStore } from '@/stores/useProjectStore';
import { useAgentAttentionStore, useAttributionClickOutside } from '@/stores/useAgentAttentionStore';
import { PingToast } from './PingToast';
import { VoyagePhaseRail } from './VoyagePhaseRail';
import { runAllAIWorkers, runPipeline, type WorkerContext } from '@/lib/worker-engine';
import { withTranscript } from '@/lib/execution-transcript';
import { getCompletionNote } from '@/lib/worker-personas';
import { track } from '@/lib/analytics';
import { recordSignal } from '@/lib/signal-recorder';
import { CrisisConcernBanner } from './CrisisConcernBanner';
import type { FlowQuestion, FlowAnswer, AnalysisSnapshot, DMConcern, MixResult, WorkerTask, LeadSynthesisResult, Draft, LoadBearingClaim, Falsification as FalsificationResult } from '@/stores/types';
import { findEffectForAnswer, applySnapshotPatch } from '@/lib/question-types';
import type { StrategicForkEffect, WeaknessCheckEffect } from '@/lib/question-types';
import { WorkerReportBlock } from './WorkerCard';
import { PersonaPoolModal } from './PersonaPoolModal';
import { AvatarRow } from './WorkerAvatar';
import { useChronicler } from './useChronicler';
import { useWorkerActions } from '@/hooks/useWorkerActions';
import { useWorkerContext } from './WorkerPanel';
import { ChevronRight, ChevronDown, Loader2, Check, AlertTriangle, Sparkles, UserCheck, ArrowRight, History, GitBranch, X as XIcon, Wand2, Compass, Navigation, RefreshCw } from 'lucide-react';
import { useLocale } from '@/hooks/useLocale';
import { useT } from '@/contexts/LocaleProvider';
import { personaName, personaRole } from './shared/persona-format';
import { MixPreview, mixToMarkdown } from './MixPreview';
import { DMFeedback } from './DMFeedback';
import { VerificationGate } from './VerificationGate';
import { TeamDeployBanner } from './TeamDeployBanner';
import { FinalCard } from './FinalCard';
export { DMFeedback, VerificationGate, TeamDeployBanner, FinalCard }; // back-compat re-exports (were defined here)
import { CurrentBearingCard } from './CurrentBearingCard';
import { SealMoment } from './SealMoment';
import { TrialSail } from './TrialSail';
import { CrewAtWork } from './CrewAtWork';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { useProbeStore } from '@/stores/useProbeStore';
import { runDivergenceProbe } from '@/lib/probe-engine';
import { forksToQuestions, forkQuestionId } from '@/lib/fork-to-question';
import { QuestionDiff } from '@/components/workspace/QuestionDiff';
import { Falsification } from './Falsification';
import { Button } from '@/components/ui/Button';
import { extractPredicatesFromSession, contractStatus } from '@/lib/decision-contract';
import { deriveCurrentBearing } from '@/lib/current-bearing';
import { EASE, SPRING } from './shared/constants';
import { diffItems } from './shared/diffItems';
import { parsePartialAnalysis, parsePartialDoc, parsePartialFeedback } from '@/lib/partial-analysis';
import { AnalysisCard } from './shared/AnalysisCard';
import { UpdateSummaryChip } from './shared/UpdateSummaryChip';
import { QuestionCard } from './shared/QuestionCard';

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
    : phase === 'dm_feedback' || phase === 'refining' || phase === 'testing' || phase === 'mixing' || phase === 'lead_synthesizing'
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
// Progress indicator: the 3-phase voyage skeleton (묶기/듣기/닿기) lives in
// VoyagePhaseRail. It replaced the old flat 5-step `ProgressLine` (removed
// here) because a first-time user couldn't tell which of Argus's three
// narrative phases they were in. See VoyagePhaseRail.tsx.

/* LiveAnalysis + VersionPills → replaced by shared AnalysisCard */

/* ═══ Answered Q&A — horizontal pills with "sent to team" indicator ═══ */
/** P1-2 과거 답 수정 진입로 (B-7): a pill taps open to the full Q/A; when a
 *  pre-answer checkpoint exists, "이 답부터 다시" forks a NEW branch there —
 *  the current course is preserved (변침도 기록), the question re-presents. */
function AnsweredPills({ qaPairs, canRevisit, onRevisit }: {
  qaPairs: Array<{ question: FlowQuestion; answer: FlowAnswer | null }>;
  /** Per-ANSWER-index: is there a checkpoint to fork from? */
  canRevisit?: (answerIndex: number) => boolean;
  onRevisit?: (answerIndex: number) => void;
}) {
  const locale = useLocale();
  const [openIdx, setOpenIdx] = useState<number | null>(null);
  const answered = qaPairs.filter(qa => qa.answer);
  if (!answered.length) return null;
  const open = openIdx !== null ? answered[openIdx] : null;
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        {answered.map((qa, i) => (
          <motion.button key={i} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.05, ...SPRING }}
            onClick={() => setOpenIdx(openIdx === i ? null : i)}
            aria-expanded={openIdx === i}
            className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-full bg-[var(--surface)] border text-[12px] cursor-pointer transition-colors ${
              openIdx === i ? 'border-[var(--accent)]/50' : 'border-[var(--border-subtle)] hover:border-[var(--accent)]/30'
            }`}>
            <Check size={12} className="text-[var(--accent)]" />
            {/* Wider caps on LARGER screens (the sm: values were inverted). */}
            <span className="text-[var(--text-tertiary)] max-w-[80px] sm:max-w-[120px] truncate">{qa.question.text.split(' ').slice(0, 3).join(' ')}</span>
            <span className="text-[var(--text-primary)] font-medium max-w-[100px] sm:max-w-[160px] truncate">{qa.answer!.value}</span>
          </motion.button>
        ))}
        <motion.span initial={{ opacity: 0, x: -4 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 }}
          className="text-[11px] font-medium text-[var(--accent)]/80 flex items-center gap-1">
          <ArrowRight size={11} /> {locale === 'ko' ? '팀 분석에 반영' : 'sent to team'}
        </motion.span>
      </div>

      {open && (
        <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
          className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] p-3.5 space-y-2">
          <p className="text-[12px] text-[var(--text-secondary)] leading-[1.55]">{open.question.text}</p>
          <p className="text-[13px] text-[var(--text-primary)] font-medium leading-[1.5]">→ {open.answer!.value}</p>
          {canRevisit?.(openIdx!) && onRevisit ? (
            <div className="flex items-center justify-between gap-3 pt-1">
              <span className="text-[10.5px] text-[var(--text-tertiary)]">
                {locale === 'ko' ? '지금까지의 항로는 가지로 그대로 남아요' : 'Your current course stays preserved as a branch'}
              </span>
              <button
                onClick={() => { onRevisit(openIdx!); setOpenIdx(null); }}
                className="shrink-0 px-3 py-1.5 rounded-lg border border-[var(--accent)]/40 text-[11.5px] font-medium text-[var(--accent)] hover:bg-[var(--ai)] transition-colors cursor-pointer">
                {locale === 'ko' ? '이 답부터 다시 →' : 'Redo from this answer →'}
              </button>
            </div>
          ) : (
            <p className="text-[10.5px] text-[var(--text-tertiary)] pt-1">
              {locale === 'ko' ? '이 지점은 답 이후 흐름이 많이 진행돼 직접 수정 대신 새 질문으로 반영하는 게 안전해요.' : 'This point is past safe rewind — fold changes in via a new answer instead.'}
            </p>
          )}
        </motion.div>
      )}
    </div>
  );
}

/* QuestionCard → imported from shared/ */

/* AttributedSection + SentenceStream → extracted to ./AttributedSection */

/* MixPreview → extracted to ./MixPreview */

/* DMFeedback → extracted to ./DMFeedback (re-exported below for back-compat) */
/* FinalCard → extracted to ./FinalCard (re-exported below) */

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
      label = L('상황을 분석하고 있어요', 'Analyzing the situation');
      sub = workersRunning > 0 ? L(`에이전트 ${workersDone}/${workersTotal} 완료`, `Agents ${workersDone}/${workersTotal} done`) : '';
    } else if (phase === 'lead_synthesizing') {
      label = L(`${leadAgentName || '리드'}가 팀 결과를 통합하는 중`, `${leadAgentName || 'Lead'} is synthesizing findings`);
    } else if (phase === 'mixing') {
      label = L('초안을 작성하고 있어요', 'Drafting the document');
    } else {
      label = L('생각하는 중...', 'Thinking...');
    }
  } else if (hasQuestion) {
    mode = 'your_turn';
    label = L('당신 차례예요', 'Your turn');
    sub = L('질문에 답해주세요', 'Please answer the question');
  } else if (deployReady) {
    mode = 'your_turn';
    label = L('당신 차례예요', 'Your turn');
    sub = L('팀 구성을 확인하고 시작하세요', 'Review the team and start');
  } else if (shouldMix) {
    mode = 'your_turn';
    label = L('팀 분석이 끝났어요', 'Team analysis complete');
    sub = L('초안 작성을 시작하세요', 'Ready to create the draft');
  } else if (workersRunning > 0) {
    mode = 'ai_working';
    label = L('팀이 분석하고 있어요', 'Team is analyzing');
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
      {/* Cancel is ALWAYS reachable while the AI works — not only after the
          30s "long wait" promotion. The first half-minute used to offer no
          way out at all; now it's a quiet tertiary action that turns amber
          when the wait gets long. */}
      {mode === 'ai_working' && onCancel && (
        <motion.button
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          onClick={onCancel}
          className={`shrink-0 inline-flex items-center gap-1 px-2.5 py-1.5 min-h-[32px] rounded-full text-[11px] font-semibold transition-colors cursor-pointer ${
            showLongWait
              ? 'text-amber-700 dark:text-amber-300 border border-amber-300/50 hover:bg-amber-100/60 dark:hover:bg-amber-900/30'
              : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] border border-transparent hover:border-[var(--border)]'
          }`}
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
  // Tier-1 de-wall: the integrated_analysis prose tends to run long and
  // quantitative ("매번 수학적으로 가는" — founder). It's the reasoning, not the
  // takeaway, so it hides behind its OWN nested toggle, below the value. The
  // decision-useful parts (핵심 발견 / 갈리는 지점) lead when the card opens.
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
            <span className="text-[13px] font-semibold text-[var(--text-primary)]">{synthesis.lead_agent_name}</span>
            <span className="text-[11px] text-[var(--text-tertiary)] ml-2">{L('통합 분석', 'Integrated Analysis')}</span>
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
              {/* ② 갈리는 지점 — the crux this decision turns on. */}
              {synthesis.open_question && (
                <div className={synthesis.key_findings.length > 0 ? 'pt-1' : 'pt-4'}>
                  {/* Spine: the crux this turns on — a neutral question, not a
                      "what you'd advise" verdict (renamed from recommendation_direction). */}
                  <p className="text-[10px] font-bold text-[var(--accent)] uppercase tracking-[0.15em] mb-2">{L('이 결정이 갈리는 지점', 'The open question')}</p>
                  <blockquote className="border-l-[3px] border-[var(--accent)]/20 pl-4 text-[13px] text-[var(--text-secondary)] italic leading-relaxed">
                    {synthesis.open_question}
                  </blockquote>
                </div>
              )}
              {/* ③ 미해결 쟁점. */}
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

/* ═══ TestRecover — recovery affordance for an interrupted 'testing' step ═══
   Shown when the overreach ladder is gone (finalize failed, or tab reloaded)
   but the phase is still 'testing'. Keeps the step from ever being a dead end. */
function TestRecover({ label, cta, onClick }: { label: string; cta: string; onClick: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: EASE }}
      className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 flex flex-col items-start gap-3"
    >
      <p className="text-[13.5px] text-[var(--text-secondary)] leading-[1.55]">{label}</p>
      <Button variant="primary" size="sm" onClick={onClick}>{cta}</Button>
    </motion.div>
  );
}

/* VerificationGate → extracted to ./VerificationGate (re-exported below) */

/* TeamDeployBanner → extracted to ./TeamDeployBanner (re-exported below) */

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
          <span>✓</span>
          {L('초안 준비 완료', 'Ready to draft')}
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
          <div className="relative p-6 md:p-8">
            <h2 className="text-[20px] md:text-[24px] font-bold text-[var(--text-primary)] leading-[1.3] tracking-tight mb-5 pr-20"
              style={{ fontFamily: 'var(--font-display)' }}>
              {L('이 방향으로 초안을 만들까요?', 'Draft in this direction?')}
            </h2>

            {/* Course summary — focal sentence framed with a Compass icon
                eyebrow. Keeps the metaphor consistent without leaning on
                emoji. */}
            {/* Provenance-honest, grammar-matched eyebrow. The old "정한 방향"
                (a DECISION the user set) sat over snapshot.real_question, which is
                ALWAYS a question — so the card "ended on a question" labelled as a
                settled direction, AND presented machine text as the user's bearing
                with no tag (MirrorBeat 90 lines away tags the same data honestly).
                Fix: prefer the declarative insight as the bearing; otherwise show
                the question under a label that says it's the question the ANALYSIS
                narrowed to (not one the user decided). Escape links stay below. */}
            <div className="mb-5 pl-4 border-l-[2px] border-[var(--accent)]/45">
              <div className="text-[10px] font-bold text-[var(--accent)] uppercase tracking-[0.15em] mb-1.5 flex items-center gap-1.5">
                <Compass size={11} className="shrink-0" />
                {snapshot.insight
                  ? L('분석이 잡은 방향', 'The direction analysis landed on')
                  : L('분석이 좁힌 질문', 'The question analysis narrowed to')}
              </div>
              <p className="text-[15px] md:text-[16px] text-[var(--text-primary)] leading-relaxed font-medium">
                {snapshot.insight || snapshot.real_question}
              </p>
              {topAssumption && (
                <div className="mt-3 pt-2.5 border-t border-dashed border-[var(--border-subtle)]">
                  <p className="text-[12px] text-[var(--text-tertiary)] leading-relaxed">
                    {/* Tag provenance — this premise was filled in by the AI, not
                        stated by the user (same honesty as MirrorBeat). */}
                    <span className="text-[var(--text-secondary)] font-medium">{L('AI가 깔아둔 전제 · ', 'AI-supplied premise · ')}</span>
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
                ? <><Loader2 size={16} className="animate-spin" /> {L('초안 만드는 중...', 'Drafting...')}</>
                : (
                  <>
                    {L('이 방향으로 초안 만들기', 'Create the draft')}
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

/* ═══ MirrorBeat — the recognition moment, moved to the FRONT of the voyage
 * (North-Star B). The active mirror used to render only at phase 'testing',
 * after minutes of LLM waits + crew theater; the early hidden-premise was
 * collapsed behind the 기록 toggle. So the value moment (recognizing the blank
 * judgment the AI quietly filled in) arrived too late for first-timers.
 *
 * This surfaces ONE load-bearing premise the analysis assumed but the user
 * never stated — right after the streamed analysis, alongside the first
 * questions, before crew/mix/DM-feedback.
 *
 * Spine (CLAUDE.md zero-judgment): NEUTRAL recognition — it names the premise
 * and hands control back ("correct it in your next answer"), never a directional
 * statement and never a two-pole fork. Not phrased as a "맞나요?" question, which
 * expected a reply the card gave nowhere to make. Provenance is honest — the
 * `--ai` register + "AI가 채운 전제" tag mark it as machine-surfaced, not the
 * user's own words. It is NON-BLOCKING: the user keeps answering below and can
 * dismiss it. No answer is captured here (the deep restatement stays at the
 * single Falsification commitment) — this is recognition, not a verdict. */
export function MirrorBeat({ assumption }: { assumption: string }) {
  const locale = useLocale();
  const L = (ko: string, en: string) => locale === 'ko' ? ko : en;
  return (
    <motion.div
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.5, ease: EASE }}
      // No line, no box — grouped by whitespace alone (the one principle worth
      // taking from Reflect: dividing lines → generous spacing). Hierarchy comes
      // from type scale + serif, not a device repeated on every block. The gold
      // sits only on the small provenance label.
      className="mb-8"
    >
      {/* Provenance label — the only gold here, small-caps. */}
      <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--accent)]/80 mb-2.5">
        {L('AI가 채운 전제', 'A premise the AI filled in')}
      </p>
      {/* The surfaced premise — serif, sized BELOW the question but above the
          fine print, so scale alone places it in the hierarchy. */}
      <p className="text-[16px] md:text-[17px] text-[var(--text-primary)] leading-[1.5] max-w-[60ch]" style={{ fontFamily: 'var(--font-display)' }}>
        {assumption}
      </p>
      {/* Recognition, not a question. Hand control back; no 맞나요?, no fork. */}
      <p className="text-[12.5px] text-[var(--text-secondary)] leading-[1.6] mt-2.5">
        {L('당신이 말한 게 아니라 분석이 대신 깔아둔 거예요. 틀렸다면 아래 답에서 바로잡으면 돼요.',
           'You didn\'t say this — the analysis laid it down. If it\'s off, just correct it in your next answer.')}
      </p>
    </motion.div>
  );
}

/* ═══ TerminalRouteCard — closure + forward action for a terminal route ═══
 * R32/R60 make a non-open route (vent/validation/info/…) or a flat frame
 * TERMINAL: the inline insight (rendered by the AnalysisCard above) IS the
 * deliverable, so the fabricated follow-up question is suppressed. But the
 * suppression alone read as a frozen session — no question, no button, no
 * progress (user report: "질문을 안 하고 세션 진행이 안 됨"). This card closes
 * that gap: it names WHY the flow landed here (measurement language about the
 * INPUT's shape — never a verdict about the user, per the zero-judgment spine),
 * and returns the handle with two honest, opt-in exits:
 *   1. Draft the deliverable as-is (the natural next artifact).
 *   2. Keep digging — re-open the full Q&A flow (restraint default = off).
 * No engine-weighted fork, no directional lean — just closure + the handle. */
const TERMINAL_ROUTE_COPY: Record<string, { ko: string; en: string }> = {
  flat: {
    ko: '어느 쪽을 골라도 결과가 크게 갈리지 않는 결정이에요. 억지로 갈림길을 만들기보다, 지금 정리된 내용을 그대로 남겨둘 수 있어요.',
    en: 'This decision lands about the same whichever way you go. Rather than manufacture a fork, you can keep what\'s already laid out.',
  },
  vent: {
    ko: '지금은 무언가를 결정하기보다 상황을 정리하는 쪽에 가까워 보여요. 아래 정리를 그대로 두거나, 원하면 더 파고들 수 있어요.',
    en: 'This reads more like laying the situation out than deciding something. Keep the summary below as-is, or dig deeper if you want.',
  },
  validation: {
    ko: '방향은 이미 잡혀 있고, 확인이 필요한 상황으로 보여요. 아래 정리로 마무리하거나 더 짚어볼 수 있어요.',
    en: 'The direction already looks set — this reads as needing confirmation. Wrap up with the summary below, or press further.',
  },
  info: {
    ko: '결정이라기보다 정보를 정리하는 요청에 가까워요. 아래 정리가 그 답이에요.',
    en: 'This is closer to organizing information than making a decision — the summary below is that answer.',
  },
};

export function TerminalRouteCard({
  route, onDraft, onContinue, busy, locale,
}: {
  route: string;
  onDraft: () => void;
  onContinue: () => void;
  busy: boolean;
  locale: 'ko' | 'en';
}) {
  const L = (ko: string, en: string) => locale === 'ko' ? ko : en;
  const copy = TERMINAL_ROUTE_COPY[route] ?? {
    ko: '이 입력은 여러 갈래로 갈리지 않아서, 굳이 더 캐묻지 않고 위 내용으로 정리했어요.',
    en: 'This input doesn\'t branch into competing paths, so we summarized it above instead of probing further.',
  };
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: EASE }}
      className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 md:p-6"
    >
      <div className="flex items-center gap-2 mb-2.5">
        <Check size={13} className="text-[var(--accent)] shrink-0" />
        <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--accent)]">
          {L('여기서 마쳐도 돼요', 'You can stop here')}
        </span>
      </div>
      <p className="text-[13.5px] text-[var(--text-secondary)] leading-[1.6] mb-4 max-w-[62ch]">
        {locale === 'ko' ? copy.ko : copy.en}
      </p>
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <motion.button
          onClick={onDraft}
          disabled={busy}
          whileTap={{ scale: 0.98 }}
          className="inline-flex items-center justify-center gap-2 px-5 py-3 min-h-[44px] text-white rounded-xl text-[13.5px] font-semibold shadow-[var(--shadow-sm)] cursor-pointer disabled:opacity-50"
          style={{ background: 'var(--gradient-gold)' }}
        >
          {busy
            ? <><Loader2 size={15} className="animate-spin" /> {L('정리하는 중...', 'Wrapping up...')}</>
            : <>{L('이대로 문서로 정리하기', 'Turn this into a document')} <ArrowRight size={14} /></>}
        </motion.button>
        {!busy && (
          <button
            onClick={onContinue}
            className="text-[12.5px] text-[var(--text-secondary)] hover:text-[var(--accent)] transition-colors cursor-pointer self-center sm:self-auto"
          >
            {L('그래도 더 짚어볼래요', 'I\'d still like to dig in')}
          </button>
        )}
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
          {/* Measurement language, not a score: "확신도 N%" was verdict
              vocabulary — describe the state instead (P1 zero-verdict). */}
          <p className="text-[11px] text-[var(--text-tertiary)] mt-0.5">
            {isLowConfidence
              ? L('이 문제는 여러 방향으로 읽힐 수 있어요 — 해석이 흔들릴 여지가 있어요.', 'This problem reads in more than one way — the framing could still shift.')
              : L('분석 방향을 확인하고 다음으로 넘어가요.', 'Confirm the analysis direction to proceed.')}
          </p>
        </div>
      </div>

      {!rejectMode ? (
        <div className="flex gap-2 pl-9">
          <motion.button onClick={onConfirm} disabled={busy} whileTap={{ scale: 0.98 }}
            className="px-4 py-2 rounded-xl text-[12px] font-semibold text-white cursor-pointer disabled:opacity-50"
            style={{ background: 'var(--gradient-gold)' }}>{L('맞아요', 'Correct')}</motion.button>
          <motion.button onClick={() => setRejectMode(true)} disabled={busy} whileTap={{ scale: 0.98 }}
            className="px-4 py-2 rounded-xl text-[12px] font-medium text-[var(--text-secondary)] border border-[var(--border-subtle)] hover:border-[var(--accent)]/30 cursor-pointer">
            {L('다시 정의', 'Redefine')}</motion.button>
        </div>
      ) : (
        <div className="pl-9 space-y-2">
          <input value={reason} onChange={e => setReason(e.target.value)} maxLength={500} placeholder={L('어떤 방향이 더 맞나요? (예: 이건 투자용이 아니라 내부 보고용이야)', 'What direction fits better? (e.g., This is for internal reporting, not investors)')}
            className="w-full px-3.5 py-2.5 rounded-xl bg-[var(--surface)] border border-[var(--border-subtle)] text-base md:text-[12px] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:border-[var(--accent)]/30"
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

/* Convergence Status (명확도 게이지) removed — it surfaced an uncalibrated score
   and leaned on the model's self-confidence as a user-facing verdict. Its two
   real jobs are owned elsewhere now: "when to stop" = the standing 그만 묻고 초안
   CTA, "what the AI assumed" = the MirrorBeat. assessConvergence still runs in
   progressive-engine for internal routing only — never rendered. */

/* ═══ Pipeline Exit Buttons (Weakness D fix) ═══ */
function PipelineExitOptions({ onReframe, onRehearse }: {
  onReframe: () => void;
  onRehearse: () => void;
}) {
  const locale = useLocale();
  const L = (ko: string, en: string) => locale === 'ko' ? ko : en;
  return (
    <div className="flex flex-col gap-2.5 border-t border-dashed border-[var(--border-subtle)] pt-4 mt-2">
      <p className="text-[12px] font-semibold text-[var(--text-secondary)]">{L('다른 도구로 전환', 'Switch to another tool')}</p>
      <div className="flex gap-2.5">
        <button onClick={onReframe}
          className="flex-1 text-left px-3.5 py-2.5 rounded-xl bg-[var(--bg)]/60 hover:bg-[var(--accent)]/5 border border-[var(--border-subtle)]/60 hover:border-[var(--accent)]/30 cursor-pointer transition-colors duration-300">
          <p className="text-[13px] font-semibold text-[var(--text-primary)]">{L('→ 문제 재정의', '→ Reframe Problem')}</p>
          <p className="text-[11px] text-[var(--text-tertiary)] mt-0.5">{L('더 깊이 들어가기', 'Dig deeper')}</p>
        </button>
        <button onClick={onRehearse}
          className="flex-1 text-left px-3.5 py-2.5 rounded-xl bg-[var(--bg)]/60 hover:bg-[var(--accent)]/5 border border-[var(--border-subtle)]/60 hover:border-[var(--accent)]/30 cursor-pointer transition-colors duration-300">
          <p className="text-[13px] font-semibold text-[var(--text-primary)]">{L('→ 피드백 먼저', '→ Feedback First')}</p>
          <p className="text-[11px] text-[var(--text-tertiary)] mt-0.5">{L('이해관계자 반응 시뮬레이션', 'Simulate stakeholder reactions')}</p>
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
  const t = useT();
  const L = (ko: string, en: string) => locale === 'ko' ? ko : en;
  const store = useProgressiveStore();
  const session = store.currentSession();
  // The persisted project hosts the Decision Contract (sealed predictions +
  // grades). Subscribed reactively so the contract card re-renders the moment a
  // grade is written. The voyage always has a project (createProject precedes
  // createSession), so this resolves once the session exists.
  const contractProject = useProjectStore((s) => s.projects.find((p) => p.id === projectId));
  // Falsifiable predictions derived from this voyage's own artifacts — the
  // flinch-surfaced bet (leads) + key assumptions + DM concerns + team dissent —
  // the material for the Decision Contract sealed below the final document.
  const contractPredicates = useMemo(
    () => extractPredicatesFromSession({
      mix: session?.mix,
      final_mix: session?.final_mix,
      dm_feedback: session?.dm_feedback,
      debate_result: session?.debate_result,
      falsification: session?.falsification,
    }),
    [session?.mix, session?.final_mix, session?.dm_feedback, session?.debate_result, session?.falsification],
  );
  // §0 sealing restraint inputs from the latest analysis snapshot — lets SealMoment
  // give a routine + reversible + confident decision one light check instead of the
  // full ceremony (CLAUDE.md mirror clause). Absent fields → full ceremony (safe).
  const sealGate = useMemo(() => {
    const snaps = session?.snapshots ?? [];
    const s = snaps[snaps.length - 1];
    return { stakes: s?.stakes, reversibility: s?.reversibility, framingConfidence: s?.framing_confidence };
  }, [session?.snapshots]);
  // 귀환 재구성 (P0-6 ③): reopening a completed voyage whose contract check-in
  // has arrived is a RETURN, not a re-read — the settle question leads the
  // scene and the headline anchors on the promised DATE (a fact), never on
  // absence length ("오랜만이에요" counting is forbidden — master §4).
  const contractDue = !!(
    contractProject?.decision_contract &&
    contractStatus(contractProject.decision_contract, Date.now()).checkInDue
  );
  const contractDueDateLabel = (() => {
    const iso = contractProject?.decision_contract?.check_in_at;
    if (!iso) return null;
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return null;
    return d.toLocaleDateString(locale === 'ko' ? 'ko-KR' : 'en-US', { month: 'long', day: 'numeric' });
  })();
  // The Current Bearing — the compressed one-screen orientation that sits ABOVE
  // the final document (ARGUS-FINAL-DIRECTION §"The Surface Principle"). Derived
  // from the same session artifacts as the contract; null until there's a draft.
  const currentBearing = useMemo(
    () => deriveCurrentBearing({
      mix: session?.mix,
      final_mix: session?.final_mix,
      dm_feedback: session?.dm_feedback,
      debate_result: session?.debate_result,
      falsification: session?.falsification,
    }),
    [session?.mix, session?.final_mix, session?.dm_feedback, session?.debate_result, session?.falsification],
  );
  // Global click-outside: clears sticky attribution hover state when user taps blank space
  useAttributionClickOutside();
  // W2.3 새 아크 flag — settings 우선, URL ?arc=1 데모 오버라이드. Off = the old
  // path, pixel-identical (구 경로 무손상 — A/B 기준선).
  const newArcSetting = useSettingsStore((s) => s.settings.new_arc_enabled ?? false);
  const newArcEnabled = newArcSetting ||
    (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('arc') === '1');
  // W1.6 선실 대청소 (founder verdict, G-W1 #1): focus session is the DEFAULT.
  // Primary exposure mid-voyage = ① the current question ② the crew/theater
  // ③ a standing escape hatch. Everything else (analysis card, question diff,
  // convergence, exits, Q&A history) retreats behind one quiet "기록" toggle —
  // demoted, never deleted. classic_session=true restores the old layout.
  const classicSession = useSettingsStore((s) => s.settings.classic_session ?? false);
  const focusMode = !classicSession;
  const [recordOpen, setRecordOpen] = useState(false);
  /** A retreated block renders when: classic layout, OR the user opened 기록. */
  const showRecord = !focusMode || recordOpen;
  /** W1.6 ③: the crew-report review stepper retreats behind "열어보기" in
   *  focus mode (reports auto-apply; grading homework is opt-in, not a gate). */
  const [reportsOpen, setReportsOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  // The overreach/flinch step's in-flight ladder (strength + escalating claims).
  // Local + ephemeral: only the committed result persists (session.falsification).
  const [overreach, setOverreach] = useState<{ strength: string; claims: LoadBearingClaim[] } | null>(null);
  // Chronicler — enriches log waypoints with narration once the stream settles.
  useChronicler(session, !busy);
  const [error, setError] = useState<string | null>(null);
  // P1-C3: the last user-triggered LLM action, kept so the error banner can
  // offer an explicit "try again" handle instead of stranding the user with a
  // message. Only handlers that are SAFE to re-enter set this (onAnswer rolls
  // its answer back in its catch, so re-entry is clean; onTest self-recovers
  // by falling through to finalize, so it doesn't need one).
  const retryRef = useRef<(() => void) | null>(null);
  const [showMix, setShowMix] = useState(false);
  // R32/R60 terminal-route escape: a non-open/flat route is terminal by default
  // (the inline insight is the deliverable), so the fabricated question is
  // suppressed. But the user can opt back INTO the full Q&A flow if they feel it
  // landed too soon — this neutralizes the terminal gating on demand (restraint
  // default stays: nothing re-engages unless the user asks). Session-local.
  const [continueAnyway, setContinueAnyway] = useState(false);
  // North-Star B: the early mirror beat is shown once per session, then the
  // user dismisses it. Parent-owned so it stays gone across re-renders/rounds
  // (restraint > engagement — never re-nag the same premise).
  const [mirrorSeen, setMirrorSeen] = useState(false);
  const [streamingText, setStreamingText] = useState<string | null>(null);
  // Verification gate — open when the captain tries to sail with unreviewed work.
  const [verifyGateOpen, setVerifyGateOpen] = useState(false);
  // Manual team-assignment modal — kept on the parent so children can open
  // it with a single callback while we own the data shape it needs. Two
  // modes: `task` (add to a specific group) and `free` (auto-match a
  // persona to the best-fitting open group).
  type PoolModalState = { mode: 'task'; targetGroupId: string } | { mode: 'free' } | { mode: 'replace'; workerId: string; rerun?: boolean } | null;
  const [poolModal, setPoolModal] = useState<PoolModalState>(null);
  // Which response shape the current stream represents. Handlers set this
  // because phase alone isn't enough — e.g. onFinalize streams while
  // phase === 'refining', but the stream is a doc, not feedback.
  const [streamKind, setStreamKind] = useState<'analysis' | 'doc' | 'feedback'>('analysis');
  // Fine-grained stage inside long async pipelines (mix, final) — feeds
  // PhaseStatusBar's substage so the user sees "gathering → debate → drafting"
  // instead of 30s of "Drafting the document".
  const [substage, setSubstage] = useState<string | null>(null);
  // P1-C2: llm.ts dispatches argus:llm-retry before each backoff wait — a
  // silent 5–15s gap that used to read as a stalled spinner. Surface it in the
  // substage line. Fact-only machine state ("retrying 2/3"), no drama.
  useEffect(() => {
    const onRetry = (e: Event) => {
      const d = (e as CustomEvent).detail as { attempt?: number; max?: number } | undefined;
      if (!d?.attempt || !d?.max) return;
      setSubstage(locale === 'ko'
        ? `일시적인 오류가 있어 다시 시도하는 중 (${d.attempt}/${d.max})…`
        : `Hit a temporary error — retrying (${d.attempt}/${d.max})…`);
    };
    window.addEventListener('argus:llm-retry', onRetry);
    return () => window.removeEventListener('argus:llm-retry', onRetry);
  }, [locale]);
  const [cmReview, setCmReview] = useState<NavigatorReview | null>(null);
  const debateResult = session?.debate_result as DebateResult | null ?? null;
  // ── Post-complete draft tree UI state ──
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [previewDraftId, setPreviewDraftId] = useState<string | null>(null);
  // The "나" problem pill expands on tap (long briefs truncate to one line).
  const [problemExpanded, setProblemExpanded] = useState(false);
  // Crisis backstop: the concern + resource shows by default and the decision
  // machinery is suppressed; one conscious tap (never a hard block, decision 3)
  // lets the user re-enter the normal flow. Local state so it never re-fires.
  const [crisisOverride, setCrisisOverride] = useState(false);
  // Two-step confirm for the destructive "초안부터 다시 만들기" exit.
  const [rerunArmed, setRerunArmed] = useState(false);
  const [iterationOpen, setIterationOpen] = useState(false);
  const [iterationDirective, setIterationDirective] = useState('');
  const [isIterating, setIsIterating] = useState(false);
  const [justReactivatedFromBranch, setJustReactivatedFromBranch] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);
  const workerAbortRef = useRef<AbortController | null>(null);
  const workersRef = useRef<Promise<void> | null>(null);
  // True while a crew orchestration is in flight. Guards startWorkerExecution
  // against re-entrancy: a double-tap on the "다시 실행" resume banner (or any
  // overlapping deploy/resume/auto-resume) would otherwise abort the partial run
  // and restart it — re-billing every worker's LLM call. Cleared when the run settles.
  const workersInFlightRef = useRef(false);
  // Scroll refs for targeted navigation
  const statusBarRef = useRef<HTMLDivElement>(null);
  const questionRef = useRef<HTMLDivElement>(null);
  const workerSectionRef = useRef<HTMLDivElement>(null);
  const mixPreviewRef = useRef<HTMLDivElement>(null);
  const dmFeedbackRef = useRef<HTMLDivElement>(null);
  const finalRef = useRef<HTMLDivElement>(null);
  const answeredPillsRef = useRef<HTMLDivElement>(null);
  const analysisCardRef = useRef<HTMLDivElement>(null);
  const teamDeployRef = useRef<HTMLDivElement>(null);
  // Report step is a one-at-a-time stepper (not a long scroll of all drafts).
  const [reviewCursor, setReviewCursor] = useState(0);

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

  // Reset the report stepper when the active session changes — otherwise a
  // cursor left at e.g. 5 carries into a new session with fewer workers and
  // clamps to its LAST worker, silently skipping the others and showing a
  // false "all reviewed" count.
  useEffect(() => { setReviewCursor(0); }, [session?.id]);

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
          const newRow = payload.new as any;
          const remoteData = newRow?.data;
          // Only a genuinely newer remote row warrants the heavy full reload —
          // our own writes echo back with an equal/older timestamp and must NOT
          // trigger a reload that could stomp local in-flight state.
          const localUpdatedAt = store.currentSession()?.updated_at ?? '';
          const remoteNewer = !!newRow?.updated_at && newRow.updated_at > localUpdatedAt;
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
            // Fallback only for a real remote change we couldn't patch precisely.
            if (!patched && remoteNewer) store.loadSessions();
          } else if (remoteNewer) {
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
  // Transition tone — the settings toggle existed but nothing in the
  // progressive flow ever played it (hollow-shell audit C10). One soft tone
  // per phase transition, only when enabled.
  const audioEnabled = useSettingsStore((s) => s.settings.audio_enabled);
  const audioVolume = useSettingsStore((s) => s.settings.audio_volume);
  const prevPhaseRef = useRef<string | null>(null);
  useEffect(() => {
    if (prevPhaseRef.current !== null && prevPhaseRef.current !== phase && audioEnabled) {
      resumeAudioContext();
      playTransitionTone(audioVolume);
    }
    prevPhaseRef.current = phase;
  }, [phase, audioEnabled, audioVolume]);
  const snapshots = session?.snapshots ?? [];
  const questions = session?.questions ?? [];
  const answers = session?.answers ?? [];
  const mix = session?.mix ?? null;
  const dmFb = session?.dm_feedback ?? null;
  const final_ = session?.final_deliverable ?? null;
  const finalMix = session?.final_mix ?? null;
  const round = session?.round ?? 0;
  // W1.6 ⑤ 질문 상한: focus mode caps deepening at 3 rounds (founder: "5라운드는
  // 많다") — probe-fork questions don't count (zero-LLM turns). Classic keeps 5.
  const storedMaxR = session?.max_rounds ?? 5; // match createSession default (legacy sessions lacking the field)
  const maxR = focusMode ? Math.min(storedMaxR, 3) : storedMaxR;

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
  // Defensive: existing sessions may already hold the literal string "null"
  // (stored before setDecisionMaker filtered it) — never surface that as a name.
  const rawDm = session?.decision_maker ?? null;
  const dm = rawDm && rawDm.toLowerCase() !== 'null' && rawDm.toLowerCase() !== 'undefined' ? rawDm : null;

  // Crisis backstop (decision 3): the deterministic gate sets snapshot.crisis at
  // round 0. Read it off whichever snapshot carries it so the resource stays
  // pinned through deepening. `crisisBlocking` suppresses the decision machinery
  // until the user consciously continues — it NEVER hard-blocks.
  const crisis = snapshots.find((s) => s.crisis?.isCrisis)?.crisis ?? null;
  const crisisBlocking = !!crisis && !crisisOverride;

  // R32 — a non-open route (vent/validation/info/flat/self_profiling/resistance)
  // is TERMINAL: the inline answer (insight) is the deliverable, so suppress the
  // fabricated follow-up question. The question OBJECT stays alive (curQ truthy),
  // so `shouldMix` (which fires on !curQ) can never deploy the crew on a vent —
  // the same safety property the crisis backstop relies on. Render-suppress only.
  const nonOpenRoute = snapshots.find((s) => s.request_type && s.request_type !== 'open')?.request_type ?? null;
  // R60 — a flat frame (the reframe carries no leverage: every branch lands the same)
  // is treated like a non-open route — TERMINAL, not a trigger for crew ceremony.
  // assessFrameStatus is conservative (only flat when the reframe ≈ surface AND no
  // assumptions), so this suppresses manufactured over-fire without blocking genuine
  // decisions. The terminal analysis card (the suppressQuestion branch in render) is
  // the deliverable, so a flat decision never dead-ends.
  const frameIsFlat = snapshots.some((s) => s.frame_status === 'flat');
  // Terminal by default; `continueAnyway` (user opt-in from the terminal card)
  // re-opens the normal Q&A flow so the route is never a silent dead-end.
  const isTerminalRoute = !!nonOpenRoute || frameIsFlat;
  const suppressQuestion = isTerminalRoute && !continueAnyway;

  const qaPairs = useMemo(() => questions.map((q, i) => ({ question: q, answer: answers[i] || null })), [questions, answers]);
  const curQ = questions.length > answers.length ? questions[questions.length - 1] : null;
  const latest = snapshots[snapshots.length - 1] || null;
  // R60 — never deploy the crew on a flat decision (the highest-measured over-fire
  // harm, ~60% in the stress test). It terminates with the analysis card instead.
  // R60 — never deploy the crew on a flat decision UNLESS the user opted back in
  // via the terminal card (`continueAnyway`); otherwise it terminates with the
  // analysis card / terminal deliverable instead.
  const shouldMix = (showMix || (phase === 'conversing' && snapshots.length > 0 && !curQ && !mix && !busy)) && (!frameIsFlat || continueAnyway);
  const deployPhase = session?.worker_deploy_phase ?? 'none';
  const workers = session?.workers ?? [];
  // True when the crew is genuinely finished (or was never deployed). The
  // "팀 분석 완료" divider + the 내 생각 추가 note box must wait for this — otherwise
  // they render a FALSE "done" at 0/4 and ask the user to react to crew output that
  // isn't visible yet. (Same terminal set as the workers-done ping above.)
  const crewSettled = workers.length === 0 ||
    workers.every(w => w.status === 'done' || w.status === 'error' || w.status === 'waiting_input' || w.status === 'validation_failed' ||
      // A HUMAN worker out for an external reply sits at 'sent'/'waiting_response'
      // — possibly for days, or never. It must NOT block the AI-crew "analysis
      // done → draft" path (which would strand the user with no route to the
      // document once questions are exhausted). Count it as settled for gating.
      (w.agent_type === 'human' && (w.status === 'sent' || w.status === 'waiting_response')));

  /* W1.6 재구성 ② 팀 자동 출항 — focus mode skips the HR-approval screen.
   * The crew assembling and working is THEATER the user watches while
   * answering questions, not paperwork they sign. Classic keeps the banner.
   * (Hook zone: must sit before the `if (!session)` early return. The
   * handlers it calls are consts defined below — initialized by the time the
   * effect fires post-render.) */
  const autoDeployedRef = useRef(false);
  useEffect(() => {
    if (!focusMode || autoDeployedRef.current) return;
    if (deployPhase !== 'ready' || workers.length === 0) return;
    autoDeployedRef.current = true;
    track('focus_auto_deploy', { workers: workers.length });
    onDeployWorkers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusMode, deployPhase, workers.length]);

  /* Self-heal after a mid-run reload — the confirmed 0/N stall root.
   * migrateWorkers resets in-flight workers ('running'/'ai_preparing') back to
   * 'pending' on load, but worker_deploy_phase stays 'deployed'. The auto-deploy
   * effect above only fires on 'ready', so nobody restarts the crew: the header
   * froze at "N/M 일하고 있어요" and ONLY the manual "다시 실행" banner recovered it.
   * Auto-resume ONCE on mount when the crew is genuinely stranded — pending
   * workers, no draft yet, and no orchestration already in flight this mount. */
  const autoResumedRef = useRef(false);
  useEffect(() => {
    if (autoResumedRef.current || workersRef.current) return;
    if (deployPhase !== 'deployed' || mix || final_) return;
    if (!workers.some(w => w.status === 'pending')) return;
    autoResumedRef.current = true;
    track('worker_auto_resume', { pending: workers.filter(w => w.status === 'pending').length });
    startWorkerExecution(store.currentSession()?.workers ?? []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deployPhase, workers.length]);

  /* W1.6 재구성 ③ — focus mode still doesn't make the user grade the crew's
   * homework: the review stepper stays behind "열어보기" and unreviewed reports
   * flow into the mix as before (mixableWorkerResults keeps approved !== false).
   * But we no longer stamp captain approval on work the captain never saw
   * (spine rule 1: approved === true must mean a real click — the old
   * approveAllPending call here polluted XP/observation signals and the
   * convergence worker-quality score with fake approvals). approved stays
   * null = "선장 미판정", and AttributedSection shades those sections. */
  const workerContext = useWorkerContext();
  const workerActions = useWorkerActions(workerContext);

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
      // 'validation_failed' is user-actionable (retry / use-anyway), not
      // auto-working — count it as settled so the "team done" ping isn't
      // blocked forever.
      s === 'done' || s === 'error' || s === 'waiting_input' || s === 'validation_failed';
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
    // Re-entrancy guard (U1): never tear down an in-flight run and re-bill it.
    if (workersInFlightRef.current) return;
    workersInFlightRef.current = true;
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
      onError: (id: string, error: string) => {
        // For SELF/HUMAN workers the AI step is only an optional preliminary —
        // if it fails, still drop to 'waiting_input' so the user can enter their
        // own decision. Only pure-AI workers become a hard 'error'.
        const w = store.currentSession()?.workers.find(ww => ww.id === id);
        const isAiPrep = (w?.agent_type === 'self' || w?.agent_type === 'human') && w?.ai_scope;
        if (isAiPrep) {
          store.updateWorker(id, { status: 'waiting_input', stream_text: '', error });
        } else {
          store.updateWorker(id, { status: 'error', error, stream_text: '' });
        }
      },
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
    }).finally(() => {
      // Release the re-entrancy guard so a genuine later resume/retry can run.
      workersInFlightRef.current = false;
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
              ? { userId: hw.contact.address, title: qTitle, content: `${hw.question_to_human || hw.task}${qContext ? `\n\n${qContext}` : ''}`, sessionId: session.id, workerId: hw.id, locale }
              : { to: hw.contact!.address, subject: qTitle, question: hw.question_to_human || hw.task, context: hw.ai_preliminary || '', senderName: session.decision_maker || 'Argus', sessionId: session.id, workerId: hw.id, locale };
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

  /* Resume workers — after crash/reload, continue from where we left off.
     No "at least one done" requirement: a reload BEFORE the first worker
     finished left everyone frozen at 대기 with no way to restart (the
     auto-deploy effect doesn't re-fire once deployPhase === 'deployed'). */
  // Once the draft (mix) exists the team phase is over — its results were already
  // consumed into the draft — so a "resume workers" banner above the draft is
  // stale clutter that competes with the deliverable. Gate it on !mix too.
  // Resumable if any worker is stranded pending OR errored (R6): a reload after
  // every AI worker already failed leaves no 'pending' worker, so pending-only
  // never showed the banner and an all-error crew had no crew-level restart.
  // startWorkerExecution's filter re-picks non-done workers, so Restart re-runs them.
  const isResumable = deployPhase === 'deployed' && !final_ && !mix
    && workers.some(w => w.status === 'pending' || w.status === 'error');
  const onResumeWorkers = () => {
    const ws = store.currentSession()?.workers ?? [];
    startWorkerExecution(ws);
  };

  /* W2.3b 측정-정박 질문 (flag 뒤) — the probe's forks become the next 1–2
   * questions, injected WITHOUT an LLM round (the fork→question conversion is
   * mechanical). The deepening loop resumes on the following answer with the
   * probe Q/A already in the qa history — measurement anchors, deepening
   * continues around it (적층 not 교체). */
  const nextPendingProbeQuestion = (): FlowQuestion | null => {
    if (!newArcEnabled) return null;
    const probe = useProbeStore.getState();
    if (probe.status !== 'done' || probe.forks.length === 0) return null;
    // The probe store is global — only forks measured on THIS session's text
    // may become questions (a stale run from another session must stay inert).
    if (probe.paragraph !== session?.problem_text) return null;
    // 세션당 측정-정박 질문 ≤2 (v4.1 W2.2): per-conversion slicing isn't enough —
    // a re-probe mints fresh fork ids, so the asked-id dedup alone would let
    // up to 4 through. The store counter is memory-only while the session's
    // questions persist, so count BOTH: a reload resets the store but the
    // already-injected probe questions are right there in the session.
    const injectedSoFar = Math.max(
      probe.questionsInjected,
      questions.filter((q) => q.id.startsWith('probe-fork-')).length,
    );
    if (injectedSoFar >= 2) return null;
    const askedIds = new Set(questions.map((q) => q.id));
    const candidates = forksToQuestions(probe.forks, {
      locale: locale as 'ko' | 'en',
      includeWriteMyOwn: false, // QuestionCard renders its own free-text input
    });
    return candidates.find((q) => !askedIds.has(q.id)) ?? null;
  };

  /** 경량 재탐침 (W2.3) — after the user settles a fork, re-measure ONLY that
   * field with their answer appended as confirmed context. Background, never
   * blocks the conversation; ≤2/session enforced by the probe store. The
   * theater's fork list updates in place (갈림 3 → 1, reverse gauge). */
  const maybeReprobe = (questionId: string, value: string) => {
    if (!session) return;
    const probe = useProbeStore.getState();
    const fork = probe.forks.find((f) => forkQuestionId(f) === questionId);
    if (!fork) return;
    if (!probe.tryConsumeReprobe()) return;
    const originalText = session.problem_text;
    const confirmed = `${originalText}\n\n[사용자 확정] "${fork.cause_quote}" → ${value}`;
    // anchorText: quotes must verify against the user's OWN text, not the
    // synthetic [사용자 확정] line we just appended.
    runDivergenceProbe(confirmed, { n: 3, fields: [fork.field], anchorText: originalText })
      .then((r) => {
        // A failed re-measure must NOT erase the standing measurement: removing
        // the field's forks with nothing to replace them would render as "갈림
        // 해소" — the exact failure≠silence lie probe-honesty guards against.
        if (r.failed) return;
        const cur = useProbeStore.getState();
        // Superseded (user moved to another session) → discard, don't pollute.
        if (cur.paragraph !== originalText) return;
        cur.setForks([...cur.forks.filter((f) => f.field !== fork.field), ...r.forks]);
      })
      .catch(() => { /* re-probe is best-effort — silence on failure (P3) */ });
  };

  /** P1-3: background typed-question upgrade — swap in only while the question
   *  it replaces is still the latest AND unanswered. A late upgrade after the
   *  user moved on is silently dropped (their flow is never yanked). */
  const onTypedUpgrade = (typedQ: FlowQuestion, replacesId: string) => {
    const s = store.currentSession();
    if (!s) return;
    const last = s.questions[s.questions.length - 1];
    if (last?.id === replacesId && s.answers.length < s.questions.length) {
      store.replaceLatestQuestion(typedQ);
    }
  };

  /** P1-2: the checkpoint that captured the state RIGHT BEFORE answer i was
   *  given — answers.length === i with question i already on deck. Forking
   *  there re-presents the question with everything after preserved as a
   *  sibling branch. Returns null when no such checkpoint exists (e.g. a
   *  zero-LLM probe turn recorded none) — the pill then explains instead. */
  const checkpointBeforeAnswer = (i: number) => {
    const cps = session?.checkpoints || [];
    const matches = cps.filter(
      (c) => (c.state_snapshot?.answers?.length ?? -1) === i && (c.state_snapshot?.questions?.length ?? 0) >= i + 1,
    );
    return matches.length ? matches[matches.length - 1] : null;
  };
  const onRevisitAnswer = (i: number) => {
    // Belt: never fork while AI work is in flight — the in-flight handler
    // would write its results onto the freshly-forked state (same lock the
    // Logbook rows and the header switcher respect).
    if (busy || store.isBranchingLocked()) return;
    const cp = checkpointBeforeAnswer(i);
    if (!cp) return;
    const bid = store.forkBranch(cp.id, L(`${i + 1}번째 답 다시`, `Redo answer ${i + 1}`));
    if (bid) {
      track('answer_revisit_fork', { index: i });
      scrollToRef(questionRef);
    }
  };

  /* Handlers */
  const onAnswer = async (value: string) => {
    if (!curQ || busy || !latest) return;
    const ans: FlowAnswer = { question_id: curQ.id, value };
    // Answering dismisses the MirrorBeat — recognition needs no "got it" button;
    // reading the premise then answering IS the whole interaction.
    if (!mirrorSeen) { setMirrorSeen(true); track('mirror_seen', { round }); }

    // ── W2.3b: probe-question turns are zero-LLM ──
    if (newArcEnabled) {
      if (curQ.id.startsWith('probe-fork-')) {
        maybeReprobe(curQ.id, value);
        // Learning signal — answering a measured fork is the user resolving a
        // divergence the product surfaced. Core to the moat (2026-06-13 fix).
        recordSignal({ project_id: projectId, tool: 'voyage', signal_type: 'fork_answered', signal_data: { round } });
      }
      const probeQ = nextPendingProbeQuestion();
      if (probeQ && useProbeStore.getState().tryConsumeQuestion()) {
        store.addAnswer(ans);
        store.addQuestion(probeQ);
        track('flow_answer', { round, probe_injected: true });
        useAgentAttentionStore.getState().ping('answer');
        scrollToRef(questionRef);
        return; // deepening resumes on the next answer, qa history intact
      }
    }

    // No scroll here — the question card unmounts and the sticky status bar is
    // already in view; jumping now AND again on arrival was two jolts per turn.
    retryRef.current = () => onAnswer(value); // safe: catch rolls the answer back
    store.addAnswer(ans); store.setPhase('analyzing'); track('flow_answer', { round }); setBusy(true); setError(null);
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
      const r = await runDeepening(session.problem_text, latest, qa, round, maxR, snapshots, (text) => setStreamingText(text), abortRef.current.signal, leadCtx, personas.length > 0 ? personas : undefined, onTypedUpgrade);
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
        // If the team is already assembled, the follow-up question is an
        // OPTIONAL refinement — the user can deploy right now. Keep the 출항
        // CTA in view (scroll to the team) instead of pulling focus down to
        // the new question, which used to strand the deploy button above.
        const teamReady = (r.snapshot.execution_plan?.steps?.length ?? 0) > 0 || currentDeployPhase === 'ready';
        // Don't guard on teamDeployRef.current here — on the turn the team first
        // appears it isn't mounted yet (React hasn't re-rendered). scrollToRef
        // re-checks the ref inside its rAF, by which point it's mounted; the
        // 'top' fallback covers the rare miss.
        if (teamReady) scrollToRef(teamDeployRef, 'top');
        else scrollToRef(questionRef);
      }
      // Voyage chart checkpoint — captures the post-answer state. Recorded
      // after addSnapshot/addQuestion so the snapshot reflects the user's
      // most recent answer.
      store.recordCheckpoint('briefing');
    } catch (e) {
      setStreamingText(null);
      // The answer was consumed BEFORE the call — with it left in place,
      // answers.length === questions.length and the user lands on the mix
      // screen as if the turn succeeded. Roll it back so the question card
      // returns (the answer was never analyzed); on user-cancel this is also
      // the expected "go back to where I was".
      store.rollbackAnswer(curQ.id);
      if (!(e instanceof DOMException && e.name === 'AbortError')) {
        setError(e instanceof Error ? e.message : L('분석에 실패했어요. 다시 시도해 주세요.', 'Analysis failed. Please try again.'));
      }
      store.setPhase('conversing');
      scrollToRef(statusBarRef);
    }
    finally { setBusy(false); abortRef.current = null; }
  };

  const runMixCore = async () => {
    retryRef.current = runMixCore;
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
      // Debate is STARTED here but awaited later: it used to serially block
      // the lead-synthesis kickoff (~5–8s) though the two are independent —
      // both consume worker results, both feed mix (perf audit P1).
      let debatePromise: Promise<DebateResult | null> = Promise.resolve(null);
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

        // Critical stakes: Cross-Agent Debate (mix 전에 결과를 반영)
        const stages = session?.stages;
        if (stages && stages.length > 1) {
          setSubstage(L('미해결 긴장 점검 중', 'Checking for unresolved tensions'));
          const debateWorkers = cmWorkers.map(w => ({ ...w, framework: session!.workers.find(ww => ww.persona?.name === w.agentName)?.framework || null }));
          debatePromise = runDebate(session!.problem_text, debateWorkers).catch(() => null);
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

      // Debate ran in parallel with the lead kickoff; its result must land in
      // workerResults BEFORE runMix (mix reads it as a dissent block).
      const debateRes = await debatePromise;
      if (debateRes) {
        store.setDebateResult(debateRes);
        workerResults.push({
          workerId: '',
          name: undefined,
          task: locale === 'ko' ? `[미해결 긴장] 초안에서 가장 약한 지점` : `[Unresolved tension] The draft's weakest point`,
          result: locale === 'ko' ? `${debateRes.challenge}\n\n약점: ${debateRes.weakestClaim}\n\n대안: ${debateRes.alternativeView}` : `${debateRes.challenge}\n\nWeakness: ${debateRes.weakestClaim}\n\nAlternative: ${debateRes.alternativeView}`,
          taskGroupId: 'debate',
        });
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
    } catch (e) { setStreamingText(null); if (!(e instanceof DOMException && e.name === 'AbortError')) setError(e instanceof Error ? e.message : L('초안을 만들다 막혔어요 — 지금까지 작업은 그대로 있어요. 다시 시도해 주세요.', 'Hit a snag while drafting — your work so far is safe. Please try again.')); store.setPhase('conversing'); scrollToRef(statusBarRef); }
    finally { setBusy(false); setSubstage(null); abortRef.current = null; }
  };

  // Verification gate — the captain stays in the loop. If any worker finished
  // but hasn't been accepted/excluded, intercept the sail and surface them
  // (the central "사람이 반드시 검증" promise, made real as a junction — not a
  // hard block; an explicit override always exists).
  const onMix = () => {
    const pending = store.unreviewedWorkers().length;
    // Focus mode never saw this gate before (auto-approve pre-empted it) and
    // its whole point is that crew work is theater, not paperwork — so it keeps
    // sailing straight into the mix. The honesty fix lives in the record:
    // those workers stay approved=null and the draft shades them as unreviewed.
    if (pending > 0 && !focusMode) { track('verify_gate_shown', { pending }); setVerifyGateOpen(true); return; }
    if (pending > 0) track('focus_mix_unreviewed', { pending });
    runMixCore();
  };

  const onDM = async () => {
    if (!mix) return; retryRef.current = onDM; setBusy(true); setError(null); scrollToRef(statusBarRef);
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
    catch (e) { setStreamingText(null); if (!(e instanceof DOMException && e.name === 'AbortError')) setError(e instanceof Error ? e.message : L('피드백을 받다 막혔어요 — 지금까지 작업은 그대로 있어요. 다시 시도해 주세요.', 'Hit a snag getting feedback — your work so far is safe. Please try again.')); scrollToRef(statusBarRef); }
    finally { setBusy(false); setSubstage(null); abortRef.current = null; }
  };

  const onDeepen = async () => {
    if (!mix) return; retryRef.current = onDeepen; setBusy(true); setError(null); scrollToRef(statusBarRef);
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
    catch (e) { setStreamingText(null); if (!(e instanceof DOMException && e.name === 'AbortError')) setError(e instanceof Error ? e.message : L('심화 검토가 끝까지 가지 못했어요 — 지금까지 작업은 그대로 있어요. 다시 시도해 주세요.', "The deep review didn't finish — your work so far is safe. Please try again.")); scrollToRef(statusBarRef); }
    finally { setBusy(false); setSubstage(null); abortRef.current = null; }
  };

  const onMore = async () => {
    if (!latest) return; retryRef.current = onMore; setShowMix(false); setBusy(true); store.setPhase('analyzing'); scrollToRef(statusBarRef);
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
      const r = await runDeepening(session!.problem_text, latest, qa, round, round + 2, snapshots, (text) => setStreamingText(text), abortRef.current.signal, moreLeadCtx, personas2.length > 0 ? personas2 : undefined, onTypedUpgrade);
      setStreamingText(null);
      r.question ? (store.addQuestion(r.question), store.setPhase('conversing')) : (setShowMix(true), store.setPhase('conversing'));
    } catch (e) { setStreamingText(null); if (!(e instanceof DOMException && e.name === 'AbortError')) setError(e instanceof Error ? e.message : L('여기서 잠깐 막혔어요 — 지금까지 작업은 그대로 있어요. 다시 시도해 주세요.', 'Hit a brief snag — your work so far is safe. Please try again.')); store.setPhase('conversing'); setShowMix(true); }
    finally { setBusy(false); abortRef.current = null; scroll(); }
  };

  const onSkip = () => {
    if (!mix) return;
    const md = mixToMarkdown(mix, locale === 'ko');
    // Skip keeps the original mix intact → attribution survives for FinalCard.
    store.setFinalDeliverable(md, mix);
    store.recordCheckpoint('anchor', L('정박 (피드백 건너뜀)', 'Anchor (skipped review)'));
    setError(null);
    useAgentAttentionStore.getState().ping('final_done');
    scrollToRef(finalRef, 'top');
  };

  const onFinalize = async () => {
    // dmFb is optional: the focus path reaches finalize straight from the draft
    // (and the sealed-prediction "최종 문서 다시 만들기" recovery) with NO DM
    // feedback. Requiring it here made that button a silent no-op. Only the mix
    // (the draft) is actually required; runFinalDeliverable tolerates a null dmFb.
    if (!mix) return; retryRef.current = onFinalize; setBusy(true); setError(null); scrollToRef(statusBarRef);
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
      setOverreach(null); // doc landed — release the (now consumed) flinch ladder
      store.recordCheckpoint('anchor');
      useAgentAttentionStore.getState().ping('final_done');
      scrollToRef(finalRef, 'top');
      track('flow_done', { project_id: projectId, rounds: round });
    }
    catch (e) { setStreamingText(null); if (!(e instanceof DOMException && e.name === 'AbortError')) setError(e instanceof Error ? e.message : L('최종 문서를 만들다 막혔어요 — 팀 분석은 그대로 있으니, 다시 시도하면 이어서 만들어요.', "Hit a snag building the final document — the team's analysis is safe; try again and it picks up from there.")); scrollToRef(statusBarRef); }
    finally { setBusy(false); setSubstage(null); abortRef.current = null; }
  };

  // ── Overreach / Flinch ("시험한다") — the required step between review and the
  //    final document. Inflate the plan into escalating success-claims; the
  //    user's flinch surfaces the load-bearing bet, which the Decision Contract
  //    then seals. Degrades gracefully: any failure or a too-thin ladder skips
  //    straight to finalize so the step never dead-ends. ──
  const onTest = async () => {
    if (busy) return;
    // dmFb intentionally NOT required (W1.6 ④): the focus path reaches the
    // ladder straight from the draft; runOverreach needs only latest + mix.
    if (!mix || !latest) { onFinalize(); return; }
    setBusy(true); setError(null); setSubstage(L('계획을 시험하는 중', 'Stress-testing the plan'));
    abortRef.current = new AbortController();
    try {
      const result = await runOverreach(latest, mix, abortRef.current.signal);
      // Need a real ladder to make a flinch meaningful — otherwise skip honestly.
      if (result.claims.length < 3) { setSubstage(null); setBusy(false); abortRef.current = null; onFinalize(); return; }
      setOverreach(result);
      store.setPhase('testing');
      track('overreach_shown', { project_id: projectId, claims: result.claims.length });
      scrollToRef(statusBarRef);
    } catch (e) {
      // Cancelled → stop. Any other failure → don't trap the user; finalize.
      if (e instanceof DOMException && e.name === 'AbortError') { setBusy(false); setSubstage(null); abortRef.current = null; return; }
      setBusy(false); setSubstage(null); abortRef.current = null; onFinalize(); return;
    }
    setBusy(false); setSubstage(null); abortRef.current = null;
  };

  /** Commit the flinch result → persist it → run the real finalize. We do NOT
   *  clear `overreach` here: if finalize fails, the card must reappear so the
   *  user can retry (the success path clears it once the doc lands). */
  const onTestResolve = (f: FalsificationResult) => {
    store.setFalsification(f);
    track('overreach_resolved', { project_id: projectId, no_flinch: !!f.no_flinch_fallback });
    onFinalize();
  };

  /** No-flinch path: ask the engine for the single riskiest assumption. */
  const onRequestHighestLoad = async (): Promise<LoadBearingClaim | null> => {
    if (!latest || !overreach) return null;
    try {
      return await runHighestLoad(overreach.claims, latest, abortRef.current?.signal);
    } catch {
      return null;
    }
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
      setError(e instanceof Error ? e.message : L('수정 요청이 끝까지 가지 못했어요 — 문서는 그대로 있어요. 다시 시도해 주세요.', "The revision didn't go through — your document is unchanged. Please try again."));
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
        animate={{ maxWidth: phase === 'complete' ? '56rem' : (phase === 'mixing' || phase === 'lead_synthesizing' || phase === 'dm_feedback' || phase === 'refining' || phase === 'testing') ? '48rem' : '42rem' }}
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

          // Replace mode targets a single worker, not a group.
          const replaceWorker = poolModal.mode === 'replace'
            ? workers.find(w => w.id === poolModal.workerId)
            : undefined;
          if (poolModal.mode === 'replace' && !replaceWorker) return null;

          return (
            <PersonaPoolModal
              isOpen
              mode={poolModal.mode}
              targetGroupId={poolModal.mode === 'task' ? poolModal.targetGroupId : undefined}
              replaceInfo={replaceWorker ? {
                task: replaceWorker.task,
                aiScope: replaceWorker.ai_scope ?? null,
                expectedOutput: replaceWorker.expected_output ?? null,
                currentPersonaId: replaceWorker.persona?.id,
                siblingPersonaIds: workers
                  .filter(w => w.id !== replaceWorker.id
                    && (w.task_group_id || w.id) === (replaceWorker.task_group_id || replaceWorker.id))
                  .map(w => w.persona?.id)
                  .filter((x): x is string => !!x),
              } : undefined}
              groups={groupInfos}
              maxPerGroup={5}
              onClose={() => setPoolModal(null)}
              onSelect={(persona, matchedGroupId) => {
                if (poolModal.mode === 'replace') {
                  const { workerId, rerun } = poolModal;
                  store.replaceWorkerPersona(workerId, persona);
                  // Report-stage re-assignment: the swap resets the worker to
                  // 'pending', but nothing auto-runs post-deploy — kick off the
                  // fresh take immediately so the captain sees a new result.
                  if (rerun) workerActions.handleRetry(workerId);
                  setPoolModal(null);
                  return;
                }
                const newId = store.addWorkerToGroup(matchedGroupId, persona);
                if (newId) setPoolModal(null);
              }}
            />
          );
        })()}

        {/* Verification gate — opens when the captain tries to sail with
            unreviewed work. Reads the unreviewed set fresh each render so it
            shrinks as items are accepted/excluded inside the gate. */}
        <AnimatePresence>
          {verifyGateOpen && (
            <VerificationGate
              key="verify-gate"
              workers={store.unreviewedWorkers()}
              anyRunning={workers.some(w => w.status === 'running' || w.status === 'ai_preparing')}
              onApprove={workerActions.handleApprove}
              onReject={workerActions.handleReject}
              onRetry={workerActions.handleRetry}
              onSail={() => { setVerifyGateOpen(false); runMixCore(); }}
              onOverride={() => { track('verify_gate_override', { count: store.unreviewedWorkers().length }); store.approveAllPending(); setVerifyGateOpen(false); runMixCore(); }}
              onClose={() => setVerifyGateOpen(false)}
            />
          )}
        </AnimatePresence>
        {/* Hidden once complete — a finished stepper is dead chrome competing
            with the one-screen bearing (compression audit B-1). */}
        {phase !== 'complete' && (
          <VoyagePhaseRail phase={phase} crewDeployed={deployPhase === 'deployed' && workers.length > 0} />
        )}

        {/* PhaseStatusBar + StreamSnippet — sticky wrapper so progress info
            stays glued to the top while the user scrolls through the long
            page. Sticky lives on the wrapper, not the bar itself, so the
            wrapper provides the scroll travel room (its bottom is the body
            of the page). */}
        {/* Sticky scroll-mask. A flat bg-[var(--bg)]/85 band drew a hard-edged
            rectangle BEHIND the rounded status pill ("box on a box"); fade it to
            transparent at the bottom so it masks the nav seam up top but leaves no
            visible edge under the pill (which carries its own surface + blur). */}
        <div ref={statusBarRef} className="sticky top-16 z-30 mb-6 pt-2 pb-1 bg-gradient-to-b from-[var(--bg)] via-[var(--bg)] to-transparent">
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
          {/* Errors live HERE, inside the sticky wrapper — every failure
              handler scrolls to this bar, so the message must be where the
              scroll lands. (It used to render at the very bottom of the page:
              on long pages the user saw nothing and the turn just went quiet.) */}
          <AnimatePresence>
            {error && <motion.div key="flow-error" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mt-2">
              {error.startsWith('LOGIN_REQUIRED') ? (
                <div className="rounded-2xl border border-[var(--accent)]/20 bg-[var(--accent)]/5 p-5">
                  {/* P0-5: a returning account-holder whose session lapsed mid-voyage
                      is not an anon who "used up the trial" — knew-you flag picks
                      the honest copy. */}
                  {hasKnownUser() ? (
                    <>
                      <p className="text-[14px] font-bold text-[var(--text-primary)] mb-1">{L('로그인이 잠시 풀렸어요', 'Your sign-in lapsed')}</p>
                      <p className="text-[12.5px] text-[var(--text-secondary)] mb-3">{L('적어주신 내용은 그대로 있어요. 다시 로그인하면 하던 자리에서 이어져요.', 'What you wrote is still here. Sign in again and pick up right where you were.')}</p>
                    </>
                  ) : (
                    <>
                      <p className="text-[14px] font-bold text-[var(--text-primary)] mb-1">{L('무료 체험을 모두 사용했어요', 'Free trial limit reached')}</p>
                      <p className="text-[12.5px] text-[var(--text-secondary)] mb-3">{L(`로그인하면 하루 ${DAILY_LIMIT}회까지 무료로 사용할 수 있어요.`, `Sign in to get up to ${DAILY_LIMIT} free calls per day.`)}</p>
                    </>
                  )}
                  {/* Mid-voyage wall: a project already exists, so loadProjects()
                      auto-restores it on return — we only need to send the user back
                      to the workspace (not a blank default) after auth. */}
                  <Link href="/login?redirect=/workspace" className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-white text-[13px] font-semibold" style={{ background: 'var(--gradient-gold)' }}>{hasKnownUser() ? L('다시 로그인하고 이어가기', 'Sign in and continue') : L('로그인', 'Sign In')} <ChevronRight size={13} /></Link>
                </div>
              ) : (() => {
                const isQuota = error.includes('한도') || error.includes('rate') || error.includes('limit') || error.includes('429');
                return (
                  <div className="flex items-start gap-2 px-4 py-3 rounded-xl border border-[var(--danger)]/25 bg-[var(--danger)]/5">
                    <AlertTriangle size={14} className="text-[var(--danger)] shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="text-[12.5px] text-[var(--text-primary)] leading-[1.5]">
                        {isQuota
                          ? L('오늘의 무료 사용 한도에 닿았어요. 설정에서 본인의 API 키를 등록하면 계속 쓸 수 있어요.', "You've hit today's free allowance. Register your own API key in Settings to keep going.")
                          : error}
                      </p>
                      {isQuota && (
                        <Link href="/settings" className="inline-block mt-1 text-[12px] text-[var(--accent)] font-medium hover:underline">
                          {L('설정에서 API 키 등록하기 →', 'Register API key in Settings →')}
                        </Link>
                      )}
                      {/* P1-C3: an explicit retry handle — the failed action is
                          kept in retryRef by each safe-to-re-enter handler.
                          Quota errors route to Settings instead (retry can't fix them). */}
                      {!isQuota && retryRef.current && (
                        <button
                          onClick={() => { const r = retryRef.current; setError(null); r?.(); }}
                          className="inline-flex items-center gap-1 mt-1 text-[12px] text-[var(--accent)] font-semibold hover:underline cursor-pointer"
                        >
                          <RefreshCw size={11} /> {L('다시 시도', 'Try again')}
                        </button>
                      )}
                    </div>
                    <button onClick={() => setError(null)} aria-label={L('닫기', 'Dismiss')}
                      className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)] cursor-pointer shrink-0">
                      <XIcon size={13} />
                    </button>
                  </div>
                );
              })()}
            </motion.div>}
          </AnimatePresence>
        </div>

        <div className="space-y-8">
          {/* User input + reviewer — stacked pills. The pill is a toggle:
              a long problem statement truncates to one line, and the session
              offers no other way to re-read your own brief — tap to expand. */}
          <div className="flex flex-col gap-2 items-start">
            {/* no `layout` prop: it re-measured on every streaming re-render */}
            <motion.button
              type="button"
              onClick={() => setProblemExpanded((o) => !o)}
              title={problemExpanded ? undefined : L('눌러서 전체 보기', 'Tap to expand')}
              className="flex items-start gap-2.5 max-w-full text-left cursor-pointer group"
            >
              {/* "나" as a small label, not a chip-in-a-box — marks the user's
                  own words without another bordered pill. */}
              <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--text-tertiary)] shrink-0 mt-[3px]">{L('나', 'Me')}</span>
              {/* min-w-0: without it this flex child's min-content (the full
                  one-line problem, since `truncate` sets white-space:nowrap)
                  refuses to shrink — blowing the whole column past the viewport
                  on mobile (horizontal overflow → forced zoom-out). */}
              <p className={`min-w-0 text-[13px] text-[var(--text-secondary)] leading-[1.55] group-hover:text-[var(--text-primary)] transition-colors ${problemExpanded ? 'whitespace-pre-wrap break-words' : 'truncate'}`}>
                {session.problem_text}
              </p>
            </motion.button>
            <ReviewerBadge reviewerId={session.reviewer_agent_id || null} />
          </div>

          {/* Crisis backstop (decision 3: warn + a real resource, NEVER block).
              The deterministic gate fired on round 0 → the concern + resource
              show by default and the decision machinery below is suppressed.
              One conscious tap re-enters the flow; the resource stays pinned. */}
          {crisis && (
            <CrisisConcernBanner
              crisis={crisis}
              locale={locale}
              blocking={crisisBlocking}
              onContinue={() => setCrisisOverride(true)}
            />
          )}

          {/* PhaseDivider: Team assembled → confirm.
              W1.6 재구성: focus mode auto-deploys (no HR-approval screen) —
              the crew is theater, not paperwork. Classic keeps the gate. */}
          {!focusMode && deployPhase === 'ready' && workers.length > 0 && (
            <PhaseDivider done={L('상황 파악', 'Analysis')} next={L('팀 구성 확인', 'Confirm team')} yourTurn />
          )}

          {/* Team deploy banner — 사용자 확인 후 worker 실행 (classic only) */}
          {!focusMode && deployPhase === 'ready' && workers.length > 0 && (
            <div ref={teamDeployRef}>
            <TeamDeployBanner
              workers={workers}
              onDeploy={onDeployWorkers}
              onUpdateWorker={(id, partial) => store.updateWorker(id, partial)}
              onOpenPool={(groupId) => setPoolModal({ mode: 'task', targetGroupId: groupId })}
              onOpenFreePool={() => setPoolModal({ mode: 'free' })}
              onRemoveWorker={(id) => store.removeWorker(id)}
              onReplaceWorker={(id) => setPoolModal({ mode: 'replace', workerId: id })}
              onUpdateTask={(groupId, text) => store.updateGroupTask(groupId, text)}
              onSetGroupTrack={(groupId, track) => store.setGroupTrack(groupId, track)}
            />
            </div>
          )}

          {/* Resume banner — 크래시/새로고침 후 미완료 작업 재개 */}
          {isResumable && (
            <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="mx-4 mt-3 p-4 rounded-xl border border-amber-500/30 bg-amber-500/5">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-[13px] text-amber-600 dark:text-amber-400">
                  <span>⟳</span>
                  <span>{L('중단된 작업이 있어요', 'Interrupted tasks found')}</span>
                  <span className="text-[var(--text-tertiary)]">
                    ({workers.filter(w => w.status === 'done').length}/{workers.length} {L('완료', 'done')})
                  </span>
                </div>
                <button onClick={onResumeWorkers}
                  disabled={workers.some(w => w.status === 'running' || w.status === 'ai_preparing')}
                  className="px-3 py-2 min-h-[44px] md:min-h-0 md:py-1.5 text-[13px] font-medium rounded-lg bg-amber-500 text-white hover:bg-amber-600 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed">
                  {workers.some(w => w.status === 'running' || w.status === 'ai_preparing')
                    ? L('실행 중…', 'Running…')
                    : workers.some(w => w.status === 'done')
                      ? L('이어서 실행', 'Resume')
                      : L('다시 실행', 'Restart')}
                </button>
              </div>
            </motion.div>
          )}

          {/* 명확도(convergence) 게이지 제거 — it surfaced an uncalibrated score
              (and leaned on the model's self-confidence, which the engine is not
              supposed to trust) as a user-facing verdict. The two real jobs it
              pretended to do are owned elsewhere: "when to stop" = the standing
              "그만 묻고 초안" CTA on the question card; "what the AI assumed for
              you" = the MirrorBeat. assessConvergence stays for internal routing
              only (progressive-engine), never shown. */}

          {/* Update summary chip — surfaces "what changed" at the user's eye level
              (right above the next question). AnalysisCard lives further down,
              so without this, users miss the evolution they just triggered. */}
          {/* NOT behind the record gate: this one line IS the convergence
              feedback ("your answer changed X"). With it hidden, answers
              vanished into a black box until the end — the tightening promise
              evaporated from the default screen (meaning audit A5). */}
          {latest && snapshots.length > 1 && !final_ && phase === 'conversing' && !mix && (
            <UpdateSummaryChip
              snapshot={latest}
              prevSnapshot={snapshots[snapshots.length - 2]}
              onSeeDetail={() => { setRecordOpen(true); requestAnimationFrame(() => scrollToRef(analysisCardRef, 'top')); }}
              locale={locale}
            />
          )}

          {/* When the current question IS a fork check, its evidence — the
              trial-sail theater — must sit right above it, not a screen below:
              the question quotes executors the user otherwise never saw. */}
          {newArcEnabled && !frameIsFlat && session && !mix && !final_ && phase === 'conversing' && !busy && curQ?.id?.startsWith('probe-fork-') && (
            <TrialSail paragraph={session.problem_text} />
          )}

          {/* North-Star B — the mirror, moved to the FRONT of the voyage.
              Surfaces ONE load-bearing premise the analysis assumed but the
              user never stated, as a neutral crux question, right after the
              streamed analysis and alongside the first questions — before
              crew/mix/DM-feedback. Gated on `curQ` so it lives only in the
              early Q&A window (it disappears once questions are exhausted, where
              VoyagePrepSummary carries the premise into the draft gate). Skipped
              on probe-fork turns (those carry their own TrialSail evidence) and
              on the crisis/suppressed path (no decision chrome around safety). */}
          <AnimatePresence>
            {focusMode && phase === 'conversing' && !mix && !final_ && !busy
              && !!curQ && !curQ.id?.startsWith('probe-fork-')
              && !crisisBlocking && !suppressQuestion
              && !mirrorSeen && !!latest?.hidden_assumptions?.[0] && (
              <MirrorBeat
                key="mirror-beat"
                assumption={latest.hidden_assumptions[0]}
              />
            )}
          </AnimatePresence>

          {/* ② 산출물 = 우리가 잡은 항로. Moved ABOVE the question and OUT of the
              record gate: during Q&A it shows as a collapsed 1-line peek (the
              current heading) so the user sees what we're steering toward BEFORE
              answering, and can expand it to the full document (gaps/skeleton).
              It used to hide behind "지금까지의 기록 ▾" — the one piece the user
              called "important" was invisible by default. */}
          {latest && !final_ && !crisisBlocking && phase === 'conversing' && (
            <div ref={analysisCardRef} className="mb-7">
              <AnalysisCard
                snapshot={latest}
                prevSnapshot={snapshots.length > 1 ? snapshots[snapshots.length - 2] : null}
                isActive={!mix}
                showExecutionPlan
                locale={locale}
                // On a terminal route the insight IS the deliverable, so show it
                // in full rather than as a background peek behind the (now
                // hidden) question.
                defaultCollapsed={phase === 'conversing' && !mix && !suppressQuestion}
              />
            </div>
          )}

          {/* Terminal route closure — a non-open/flat route suppresses the
              follow-up question (R32/R60). Without this the screen froze on a
              collapsed peek with no forward action. This names why the flow
              landed here and returns the handle (draft it / dig in anyway). */}
          {suppressQuestion && !busy && !crisisBlocking && phase === 'conversing' && !mix && !final_ && latest && (
            <div className="mb-7">
              <TerminalRouteCard
                route={nonOpenRoute ?? 'flat'}
                busy={busy}
                locale={locale}
                onDraft={() => { track('terminal_route_draft', { route: nonOpenRoute ?? 'flat' }); onMix(); }}
                onContinue={() => { track('terminal_route_continue', { route: nonOpenRoute ?? 'flat' }); setContinueAnyway(true); }}
              />
            </div>
          )}

          {/* Question FIRST — user action at the top, not buried below */}
          <div ref={questionRef}>
            {/* First-time onboarding — explains *why* we're asking the user
                questions and what happens after. Shown only on the very
                first question of a session; disappears once the user has
                answered anything. */}
            {curQ && !busy && phase === 'conversing' && round === 0 && answers.length === 0 && !crisisBlocking && !suppressQuestion && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.45, ease: EASE, delay: 0.15 }}
                className="flex items-start gap-2.5 px-4 py-3 mb-4 rounded-xl bg-[var(--accent)]/[0.05] border border-[var(--accent)]/20"
              >
                <span className="text-[15px] shrink-0 leading-none mt-0.5">💬</span>
                <p className="text-[12.5px] text-[var(--text-secondary)] leading-[1.55]">
                  {locale === 'ko'
                    ? <>질문 <strong className="text-[var(--text-primary)]">두세 개</strong>만 답해주시면, 어울리는 <strong className="text-[var(--text-primary)]">팀을 꾸려서</strong> 분석을 시작해요.</>
                    : <>Just <strong className="text-[var(--text-primary)]">a couple of questions</strong> and we&apos;ll <strong className="text-[var(--text-primary)]">assemble the right team</strong> to start.</>}
                </p>
              </motion.div>
            )}
            {/* (The "팀은 이미 준비됐어요…(선택)" banner was removed: the
                question meta ("질문 N/M · 선택") and the skip chip ("건너뛰고
                팀 투입") already say optional — three voices for one fact.) */}
            {curQ && !busy && phase === 'conversing' && !crisisBlocking && !suppressQuestion && (() => {
              const teamReady = deployPhase === 'ready' && workers.length > 0;
              const isProbeQ = !!curQ.id?.startsWith('probe-fork-');
              // A denominator, not an open end — question fatigue is mostly not
              // knowing how many are left. Probe questions are zero-LLM checks
              // outside the round cap, so they carry their own label.
              const qNow = Math.min(round + 1, maxR);
              const isLast = qNow >= maxR;
              const meta = isProbeQ
                ? L('갈림 확인 · 선택', 'Fork check · optional')
                : teamReady
                  ? L(`질문 ${qNow}/${maxR} · 선택`, `Question ${qNow}/${maxR} · optional`)
                  : isLast
                    ? L(`질문 ${qNow}/${maxR} · 마지막 질문이에요`, `Question ${qNow}/${maxR} · last one`)
                    : L(`질문 ${qNow}/${maxR}`, `Question ${qNow}/${maxR}`);
              // W1.6: in focus mode EVERY question carries the way out, inside
              // the card where the user is looking — never a hidden footer link.
              const focusEscape = focusMode && snapshots.length > 0
                ? () => { track('focus_escape_to_mix', { round, from: 'question_card' }); onMix(); }
                : undefined;
              return (
                <QuestionCard
                  // Keyed by SLOT, not question id: the P1-3 typed upgrade (and
                  // the framing-reject re-ask) swap the question IN PLACE via
                  // replaceLatestQuestion — an id key would remount the card and
                  // wipe whatever the user was typing. The slot only advances
                  // when an answer lands, which is exactly when a reset is right.
                  key={`q-slot-${answers.length}`}
                  question={curQ}
                  onAnswer={onAnswer}
                  disabled={busy}
                  locale={locale}
                  meta={meta}
                  onSkip={focusEscape ?? (teamReady ? onDeployWorkers : undefined)}
                  skipLabel={focusEscape
                    ? L('그만 묻고 초안 만들기 — 지금까지 답한 것으로', 'Stop asking — draft from what I\'ve answered')
                    : (teamReady ? L('건너뛰고 팀 투입', 'Skip & start') : undefined)}
                />
              );
            })()}
          </div>

          {/* W1.6 focus mode: the standing escape hatch + the ONE record toggle.
              The user can always stop being asked ("그만 묻고 마무리로") and the
              retreated record (analysis card, question diff, convergence, Q&A
              history, exits) lives behind a single quiet line — demoted, never
              deleted. */}
          {/* The escape now lives INSIDE the question card (above); this row
              keeps only the single quiet record toggle. */}
          {/* Always mounted while conversing (busy included) — toggling its
              existence per turn made the layout jump every analysis. */}
          {focusMode && phase === 'conversing' && !mix && !final_ && snapshots.length > 0 && (
            <div className="flex justify-end -mt-3 px-1">
              <button
                onClick={() => setRecordOpen((o) => !o)}
                disabled={busy}
                className="text-[12px] text-[var(--text-tertiary)] hover:text-[var(--accent)] transition-colors cursor-pointer min-h-[44px] md:min-h-0 px-2 -mr-2 disabled:opacity-40"
              >
                {recordOpen ? L('기록 접기 ▴', 'Hide record ▴') : L('지금까지의 기록 ▾', 'Voyage record ▾')}
              </button>
            </div>
          )}

          {/* W1.6 ⑥ 팀 작업 극장 — live stream tails per crew member, not a
              progress bar. Below it, the one quiet line into the full stepper. */}
          {/* The report-stepper toggle now lives in CrewAtWork's headline —
              the standalone "선원 보고 N건 — 자동 반영됐어요" line below the
              theater said the same thing twice (compression worst-dup #2). */}
          {focusMode && deployPhase === 'deployed' && workers.length > 0 && !final_ && !mix && (
            <CrewAtWork
              workers={workers}
              onRetry={(id) => workerActions.handleRetry(id)}
              reportsOpen={reportsOpen}
              onToggleReports={() => setReportsOpen((o) => !o)}
            />
          )}

          {/* Inline worker reports — ONE-AT-A-TIME stepper. Reviewing 3 long
              drafts in a single scroll was a huge burden; instead the user
              handles one agent at a time with a finding-first card and the full
              draft one tap away. */}
          {(!focusMode || reportsOpen) && deployPhase === 'deployed' && !final_ && (() => {
            const ordered = [...workers].sort((a, b) => a.step_index - b.step_index);
            if (ordered.length === 0) return null;
            const total = ordered.length;
            const cursor = Math.min(reviewCursor, total - 1);
            const current = ordered[cursor];
            // A worker counts as "handled" once the user has acted: AI approve/
            // exclude sets `approved`, SELF submit also sets approved:true, errors
            // are terminal.
            const handled = (w: WorkerTask) => w.approved != null || w.status === 'error';
            const remainingToReview = ordered.filter(w => !handled(w) && w.status === 'done').length;
            const advance = () => setReviewCursor(c => Math.min(c + 1, total - 1));
            return (
              <div ref={workerSectionRef} className="space-y-3">
                {/* W1.6 ④: the chips finally explain themselves — what 반영/제외
                    DOES and where the rating goes. One line, always visible. */}
                <p className="text-[11.5px] text-[var(--text-tertiary)] px-1 leading-[1.5]">
                  {L(
                    '반영 = 최종 문서에 들어가요 · 제외 = 빠져요 (언제든 번복 가능) · 아래 평가는 선원 기록에 남아 다음 항해 팀 구성에 참고돼요',
                    'Apply = goes into the final doc · Exclude = left out (reversible anytime) · ratings go on the crew record for future voyages',
                  )}
                </p>
                {/* Progress — clickable dots + N/total */}
                <div className="flex items-center justify-between px-1">
                  <span className="text-[12px] font-semibold text-[var(--text-secondary)]">
                    {L('에이전트 검토', 'Review agents')}
                    {remainingToReview > 0 && (
                      <span className="font-normal text-[var(--text-tertiary)] ml-1.5">· {L(`${remainingToReview}명 남음`, `${remainingToReview} left`)}</span>
                    )}
                  </span>
                  <div className="flex items-center gap-2.5">
                    <div className="flex items-center gap-1.5">
                      {ordered.map((w, i) => (
                        <button key={w.id} onClick={() => setReviewCursor(i)}
                          aria-label={`${i + 1}/${total}`} aria-current={i === cursor}
                          className={`rounded-full transition-all cursor-pointer ${
                            i === cursor ? 'w-5 h-2 bg-[var(--accent)]'
                              : handled(w) ? 'w-2 h-2 bg-[var(--accent)]/45'
                                : 'w-2 h-2 bg-[var(--border)]'
                          }`} />
                      ))}
                    </div>
                    <span className="text-[11px] tabular-nums text-[var(--text-tertiary)]">{cursor + 1}/{total}</span>
                  </div>
                </div>
                {/* Current worker card — slides on step change */}
                <AnimatePresence mode="wait">
                  <motion.div key={current.id}
                    initial={{ opacity: 0, x: 14 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -14 }}
                    transition={{ duration: 0.26, ease: EASE }}>
                    <WorkerReportBlock
                      worker={current}
                      onSubmitInput={current.status === 'waiting_input' ? workerActions.handleSubmit : undefined}
                      onRetry={(current.status === 'error' || current.status === 'done') ? workerActions.handleRetry : undefined}
                      onApprove={current.status === 'done' ? workerActions.handleApprove : undefined}
                      onReject={current.status === 'done' ? workerActions.handleReject : undefined}
                      onReassign={current.status === 'done' && current.agent_type !== 'human' && current.agent_type !== 'self'
                        ? (id) => setPoolModal({ mode: 'replace', workerId: id, rerun: true })
                        : undefined}
                      onAdvance={cursor < total - 1 ? advance : undefined}
                    />
                  </motion.div>
                </AnimatePresence>
                {/* Step navigation — go back to revisit, or skip ahead */}
                <div className="flex items-center justify-between px-1 pt-0.5">
                  <button onClick={() => setReviewCursor(c => Math.max(0, c - 1))}
                    disabled={cursor === 0}
                    className="text-[12px] text-[var(--text-tertiary)] hover:text-[var(--text-primary)] disabled:opacity-30 cursor-pointer disabled:cursor-default transition-colors">
                    ← {L('이전', 'Prev')}
                  </button>
                  {cursor < total - 1 && (
                    <button onClick={advance}
                      className="text-[12px] text-[var(--text-tertiary)] hover:text-[var(--text-primary)] cursor-pointer transition-colors">
                      {L('나중에 보기', 'Later')} →
                    </button>
                  )}
                </div>
              </div>
            );
          })()}

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

          {/* PhaseDivider: Team analysis complete → create draft. Gated on crewSettled
              so it never claims "팀 분석 완료" while workers are still running (0/4). */}
          {shouldMix && !busy && phase === 'conversing' && !curQ && crewSettled && (
            <PhaseDivider done={L('팀 분석 완료', 'Team analysis done')} next={L('초안 작성 시작', 'Create draft')} yourTurn />
          )}

          {/* UserNotesInput — add your thoughts AFTER the crew finishes (so there's
              actually something to react to), not while they're still working. */}
          {shouldMix && !busy && phase === 'conversing' && !curQ && crewSettled && (
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

          {shouldMix && !busy && phase === 'conversing' && !curQ && crewSettled && latest && (
            <VoyagePrepSummary
              snapshot={latest}
              onMix={onMix}
              onMore={onMore}
              onRevisit={() => {
                // The pills live behind the record toggle in focus mode —
                // open it first, or this scrolls to a null ref (page bottom).
                setRecordOpen(true);
                requestAnimationFrame(() => scrollToRef(answeredPillsRef, 'bottom'));
              }}
              busy={busy}
            />
          )}

          {/* Lead Synthesis — previously hidden, now visible.
              (Drafting status already surfaced in PhaseStatusBar.) */}
          {(showRecord || phase !== 'conversing') && session?.lead_synthesis && !final_ && (
            <LeadSynthesisCard synthesis={session.lead_synthesis} />
          )}

          {/* Living Analysis — stays collapsed throughout the conversing
              phase so the user isn't buried under accumulating cards.
              VoyagePrepSummary picks up the decision-point role at the
              shouldMix moment; this card is a "tap to read the full
              breakdown" affordance, not the primary narrative. Auto-
              expands once mix begins (phase moves past 'conversing'). */}
          {/* The reframe reward — "your question changed" — surfaced the moment
              the real question diverges from what the user first typed. Sits
              above the (default-collapsed) analysis card so the shift is visible
              even before the user expands the detail. */}
          {showRecord && latest && !mix && !final_ && phase === 'conversing' && (
            <QuestionDiff
              before={session?.problem_text ?? ''}
              after={latest.real_question ?? ''}
              className="mb-3"
            />
          )}

          {/* 시험 항해 극장 (W2.3 적층, flag 뒤) — runs alongside the existing
              analysis stream during the first rounds; the deepening loop below
              is untouched (적층 not 교체). Off by default — old path is the
              A/B baseline. */}
          {newArcEnabled && !frameIsFlat && session && !mix && !final_ && (phase === 'analyzing' || phase === 'conversing')
            && !(phase === 'conversing' && !busy && curQ?.id?.startsWith('probe-fork-')) && (
            /* R60 — don't run the divergence probe (it manufactures forks) once the
               frame is known flat. During analyzing frame_status isn't computed yet,
               so the probe may still start; it unmounts as soon as round-0 lands flat.
               (TrialSail is behind newArcEnabled, off by default.) */
            <TrialSail paragraph={session.problem_text} />
          )}

          {/* 우리가 잡은 항로 — for the NON-conversing stages (draft/mix) it's
              shown in FULL here. During conversing it's rendered collapsed ABOVE
              the question instead (out of the record gate, see top of MAIN).
              Crisis blocking still suppresses the decision chrome. */}
          {(phase !== 'conversing' || mix) && latest && !final_ && !crisisBlocking && (
            <div>
              <AnalysisCard
                snapshot={latest}
                prevSnapshot={snapshots.length > 1 ? snapshots[snapshots.length - 2] : null}
                isActive={!mix}
                showExecutionPlan
                locale={locale}
                // Collapse to a compact peek once the draft (mix) exists — the
                // draft is the protagonist then, and this analysis is the
                // supporting "course we plotted" reference. During conversing the
                // course is rendered collapsed ABOVE the question instead; this
                // block only handles the non-conversing / mix stages.
                defaultCollapsed={!!mix || phase === 'conversing'}
              />
            </div>
          )}

          {/* Framing Confirmation — Round 1 후 사용자 확인 (Weakness A).
              W1.6 재구성: focus mode SKIPS this gate — the user just answered
              a question; asking them to re-approve the framing is a second
              demand on the same trust. QuestionCard's free-text input is the
              standing "방향이 다르면 직접 적기" escape. Classic keeps it. */}
          {!focusMode && latest && !latest.framing_locked && snapshots.length === 1 && phase === 'conversing' && !mix && !final_ && (
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
                } catch (e) { setStreamingText(null); setError(e instanceof Error ? e.message : L('다시 읽다 막혔어요 — 기존 분석은 그대로 있어요. 다시 시도해 주세요.', 'Hit a snag re-reading — the existing analysis is safe. Please try again.')); }
                finally { setBusy(false); scroll(); }
              }}
              busy={busy}
            />
          )}

          {/* (Convergence Status moved UP to the top as ③ 계기판 — out of the
              record gate. See the top of MAIN.) */}

          {/* Pipeline Exit — 라운드 1+ 후 4R로 분기 가능 (Weakness D) */}
          {showRecord && latest && snapshots.length >= 1 && !mix && !final_ && phase === 'conversing' && !busy && (
            <PipelineExitOptions
              onReframe={async () => {
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
                  // SPA switch (H1-B3): the old full-page navigation reloaded
                  // the app, dropping all in-memory state; its &handoff=/&itemId=
                  // params had zero consumers. addItem above already set the
                  // reframe store's currentId, so flipping the step is enough —
                  // and Next syncs pushState into useSearchParams, which flips
                  // the workspace page into legacy mode without a reload.
                  const { useWorkspaceStore } = await import('@/stores/useWorkspaceStore');
                  useWorkspaceStore.getState().setActiveStep('reframe');
                  window.history.pushState(null, '', `/${locale}/workspace?step=reframe`);
                } catch (e) { setError(e instanceof Error ? e.message : L('화면을 바꾸다 막혔어요 — 내용은 그대로예요. 한 번 더 눌러 주세요.', 'Hit a snag switching views — nothing was lost. Please tap once more.')); }
              }}
              onRehearse={async () => {
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
                  // SPA switch — see onReframe above (H1-B3).
                  const { useWorkspaceStore } = await import('@/stores/useWorkspaceStore');
                  useWorkspaceStore.getState().setActiveStep('rehearse');
                  window.history.pushState(null, '', `/${locale}/workspace?step=rehearse`);
                } catch (e) { setError(e instanceof Error ? e.message : L('화면을 바꾸다 막혔어요 — 내용은 그대로예요. 한 번 더 눌러 주세요.', 'Hit a snag switching views — nothing was lost. Please tap once more.')); }
              }}
            />
          )}

          {/* Answered Q&A history — collapsed at bottom. ref is used by
              VoyagePrepSummary's "Revisit my answers" link to scroll back
              to the Q&A history without disrupting the user's flow. */}
          {(showRecord || phase !== 'conversing') && !final_ && (
            <div ref={answeredPillsRef}>
              <AnsweredPills
                qaPairs={qaPairs}
                canRevisit={(i) => !busy && !store.isBranchingLocked() && !!checkpointBeforeAnswer(i)}
                onRevisit={onRevisitAnswer}
              />
            </div>
          )}

          {/* PhaseDivider: Draft ready → Review */}
          {mix && !dmFb && !final_ && phase !== 'mixing' && (
            <PhaseDivider done={L('초안 완성', 'Draft ready')} next={L('검토', 'Review')} yourTurn />
          )}
          <div ref={mixPreviewRef}>
            {/* W1.6 재구성 ④: focus routes the primary CTA through the flinch
                ladder (onTest) — the G0-best lever is the road, not a branch.
                Stakeholder review demotes to opt-in. Classic unchanged. */}
            {/* phase !== 'testing': once the flinch ladder is up, leaving this
                card mounted kept its live gold CTA above the ladder — pressing
                it again re-ran runOverreach (double call) and the user was
                scrolled into a stale draft (novice audit, real bug). */}
            {mix && !dmFb && !final_ && phase !== 'mixing' && phase !== 'testing' && (
              <MixPreview
                mix={mix} dm={dm} onDM={onDM}
                onSkip={focusMode ? onTest : onSkip}
                primary={focusMode ? 'wrap' : 'review'}
                busy={busy} cmReview={cmReview} debateResult={debateResult}
              />
            )}
          </div>
          <div ref={dmFeedbackRef}>
            {dmFb && !final_ && phase !== 'testing' && (
              // Stable key per review — rebuilds the baseline snapshot only
              // when a new review arrives, not when toggleFix rebuilds the
              // fb object. first_reaction is effectively unique per review.
              // "Finalize" routes through the required overreach/flinch step
              // (onTest), which finalizes after the user commits their bet.
              <DMFeedback
                key={`${dmFb.persona_name}::${dmFb.first_reaction}`}
                fb={dmFb}
                onToggle={(i) => store.toggleFix(i)}
                onFinalize={onTest}
                onDeepen={onDeepen}
                busy={busy}
              />
            )}
          </div>

          {/* Overreach / Flinch ("시험한다") — replaces the review card while the
              user stress-tests the plan. Hidden during the finalize stream (busy).
              Three render-level states keep it robust against finalize failure and
              tab reload (the claim ladder is ephemeral; the committed bet persists):
                · fresh ladder        → the flinch UI
                · bet already sealed  → just regenerate the document (no re-flinch)
                · ladder lost, no bet → re-enter the step */}
          {phase === 'testing' && !final_ && !busy && (
            overreach ? (
              <Falsification
                strength={overreach.strength}
                claims={overreach.claims}
                onResolve={onTestResolve}
                onRequestHighestLoad={onRequestHighestLoad}
              />
            ) : session?.falsification ? (
              <TestRecover
                label={L('예측은 봉인됐어요. 최종 문서만 다시 만들면 돼요.', 'Your predictions are sealed — only the document needs regenerating.')}
                cta={L('최종 문서 다시 만들기', 'Regenerate the document')}
                onClick={onFinalize}
              />
            ) : (
              <TestRecover
                label={L('시험 단계가 중단됐어요.', 'The test step was interrupted.')}
                cta={L('다시 시험하기', 'Run the test again')}
                onClick={onTest}
              />
            )
          )}

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
                      {L('에서 수정 중', ' (revision)')}
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

            {/* Completion moment — P1-A3 S6 hierarchy: doc completion is a
                waypoint, the SEAL below is the voyage's final scene. Gold and
                the stamp belong to the seal only (copy unchanged, color only). */}
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.5, ease: EASE }}
              className="flex flex-col items-center justify-center gap-2 py-6">
              <div className="w-10 h-10 rounded-full flex items-center justify-center bg-[var(--surface-2)] border border-[var(--border)]">
                <Check size={16} className="text-[var(--accent)]" />
              </div>
              <p className="text-[16px] font-semibold text-[var(--text-primary)]">
                {/* P0-6 ③: on a return day the headline is the return — a
                    date-anchored fact ("{날짜}에 물어보기로 한 게 있어요"),
                    never an absence-length greeting. */}
                {contractDue
                  ? (contractDueDateLabel
                      ? L(`돌아오셨네요 — ${contractDueDateLabel}에 물어보기로 한 게 있어요`, `You're back — there's something you asked to be asked on ${contractDueDateLabel}`)
                      : L('돌아오셨네요 — 물어보기로 한 게 있어요', "You're back — there's something you asked to be asked about"))
                  : dmFb && dmFb.concerns.filter((c: DMConcern) => c.applied).length > 0
                    ? locale === 'ko' ? `피드백 ${dmFb.concerns.filter((c: DMConcern) => c.applied).length}건이 반영된 최종 문서예요` : `Final document with ${dmFb.concerns.filter((c: DMConcern) => c.applied).length} feedback item(s) applied`
                    : L('최종 문서가 완성됐어요', 'Your document is complete')}
              </p>
            </motion.div>
            {/* P0-6 ③: on a return day the settle question outranks the
                document — the DecisionContractCard's due state (inside
                SealMoment) leads the scene instead of hiding below the fold. */}
            {contractDue && contractProject && (
              <div className="mb-4">
                <SealMoment project={contractProject} predicates={contractPredicates} gate={sealGate} />
              </div>
            )}
            {/* ① 산출물 ("가져가실 것") — the document is what the user takes
                with them; it leads the complete scene (W1.1 봉인 종막 order). */}
            <FinalCard
              content={final_}
              mix={finalMix}
              sessionId={session?.id ?? null}
              defaultCollapsed
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

            {/* ② Current Bearing — the compressed one-screen orientation, now
                sitting just under the document it summarizes (W1.1 order). */}
            <div className="mt-4">
              <CurrentBearingCard bearing={currentBearing} label={activeDraft?.version_label ?? null} />
            </div>

            {/* (The standalone dissent card was removed: the bearing's
                "가지 않은 길" + "안개·암초" rows render the SAME debate_result
                in compressed form — two surfaces, one fact. The full tension
                text remains reachable in the Logbook record.) */}

            {/* ③ 봉인 종막 — the voyage's last interaction. A standalone,
                screen-transition-grade closing question ("이 결정, …에 어떻게
                됐는지 물어봐 드릴까요?"). Accept = 1 tap (auto draft + editable
                drawer); reject = 1 tap, lossless (everything above stays). The
                surface never says 내기/predicate/반증. Renders nothing when there
                is nothing falsifiable to ask about (P3 침묵).
                Renders ABOVE the exit CTAs: the gold "새 프로젝트 시작" button
                used to sit between the bearing and this question, so users left
                before ever seeing it — the closing scene must come before the
                exits, never compete with them. */}
            {contractProject && !contractDue && (
              <SealMoment project={contractProject} predicates={contractPredicates} gate={sealGate} closing />
            )}

            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }} className="pt-10 pb-16">
              {/* (The old "복사해서 바로 사용하세요" label pointed at a copy button
                  that lives in FinalCard's header, not here — removed.) */}
              <p className="text-[11px] text-[var(--text-tertiary)]/80 text-center mb-6">{L('새 프로젝트를 시작해도 이 결과는 저장돼요 — 언제든 다시 열 수 있어요.', 'Starting a new project keeps this one saved — you can reopen it anytime.')}</p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center flex-wrap">
                <button onClick={() => {
                  useProgressiveStore.setState({ currentSessionId: null });
                  // Also clear the PERSISTED current project — without this,
                  // loadProjects restores it after the reload and reopens the
                  // very session the user just tried to leave (review P0 #2).
                  useProjectStore.getState().setCurrentProjectId(null);
                  window.location.assign('/workspace');
                }}
                  className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-2xl text-white text-[13px] font-semibold cursor-pointer"
                  style={{ background: 'var(--gradient-gold)' }}>{L('새 프로젝트 시작', 'Start New Project')} <ArrowRight size={12} /></button>
                <button onClick={() => { setIterationOpen(true); setIterationDirective(''); }}
                  className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-2xl text-[13px] font-semibold text-[var(--text-primary)] border border-[var(--accent)]/30 bg-[var(--gold-muted)]/30 hover:bg-[var(--gold-muted)]/50 cursor-pointer transition-colors">
                  <Wand2 size={13} className="text-[var(--accent)]" /> {L('항해장에게 수정 요청', 'Ask Navigator to revise')}
                </button>
              </div>
              {/* Destructive + rare → demoted to a quiet tertiary line below
                  the real exits (compression audit B-10). Two-step stays. */}
              <div className="mt-4 text-center">
                {rerunArmed ? (
                  <span className="inline-flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[11.5px] text-[var(--text-tertiary)]">
                    {L('지금 문서와 검토를 비우고 초안부터 다시 만들어요 — 이전 결과는 버전 히스토리에 남아요.', 'Clears the current document & review, regenerates from draft — previous results stay in version history.')}
                    <button onClick={() => { if (mix) { store.setFinalDeliverable(null as unknown as string); store.setDMFeedback(null as unknown as import('@/stores/types').DMFeedbackResult); store.setMix(null as unknown as MixResult); setShowMix(true); } setRerunArmed(false); }}
                      className="font-semibold text-[var(--danger)] hover:underline cursor-pointer">
                      {L('네, 다시 만들게요', 'Yes, regenerate')}
                    </button>
                    <button onClick={() => setRerunArmed(false)} className="hover:underline cursor-pointer">
                      {L('취소', 'Cancel')}
                    </button>
                  </span>
                ) : (
                  <button onClick={() => setRerunArmed(true)}
                    className="text-[11.5px] text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] underline underline-offset-2 cursor-pointer transition-colors">
                    {L('초안부터 다시 만들기', 'Regenerate from draft')}
                  </button>
                )}
              </div>
            </motion.div>
          </div>}

          {/* Errors render inside the sticky status wrapper near the top —
              the bottom-of-page banner that used to live here was invisible
              on long pages (every failure handler scrolls to the status bar).
              The bottom milestone row was likewise removed earlier; the top
              VoyagePhaseRail is the single progress indicator. */}
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
            role="dialog" aria-modal="true" aria-label={L('버전 미리보기', 'Version preview')}
            className="relative w-full max-w-2xl max-h-[85dvh] bg-[var(--bg)] rounded-xl shadow-[var(--shadow-lg)] border border-[var(--border)] flex flex-col"
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
                  <GitBranch className="w-3 h-3" /> {L('이 버전에서 수정', 'Revise from here')}
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
            role="dialog" aria-modal="true" aria-label={L('수정 요청', 'Revise request')}
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
                    {L('항해장은 팀 결과를 통합한 에이전트예요', 'The navigator integrates the whole team’s work')} · {L('현재 버전', 'Current version')} <span className="font-semibold">{activeDraft.version_label}</span>
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
                className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-2.5 text-base md:text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:border-[var(--accent)] resize-none leading-relaxed"
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
