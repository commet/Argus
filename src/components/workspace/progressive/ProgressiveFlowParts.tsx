'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight, Loader2, Check, AlertTriangle, Sparkles, UserCheck, ArrowRight, X as XIcon, Compass, Navigation, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { useAgentStore } from '@/stores/useAgentStore';
import { useLocale } from '@/hooks/useLocale';
import { EASE, SPRING } from './shared/constants';
import { parsePartialAnalysis, parsePartialDoc, parsePartialFeedback } from '@/lib/partial-analysis';
import type { FlowQuestion, FlowAnswer, AnalysisSnapshot, ConvergenceMetrics, LeadSynthesisResult } from '@/stores/types';

/* Reviewer 배지 — 저장된 팀장이 있으면 세션 내내 노출 */
export function ReviewerBadge({ reviewerId }: { reviewerId: string | null }) {
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
export function PhaseAmbient({ phase }: { phase: string }) {
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
// Single top stepper — unified to plain functional stage names so it speaks
// the same language as the rest of the flow (the old voyage labels
// "항해 준비/항해/보고/정박" diverged from the bottom milestone row, which
// already used these words). One source of truth for stage order + labels.
const STAGE_PHASES = ['analyzing', 'conversing', 'mixing', 'dm_feedback', 'complete'] as const;
const STAGES_KO = ['분석', '질문', '팀 작업', '검토', '완성'] as const;
const STAGES_EN = ['Analysis', 'Questions', 'Team work', 'Review', 'Done'] as const;

function stageIdx(phase: string): number {
  // refining belongs to the review stage; lead_synthesizing to team work —
  // neither is in STAGE_PHASES, so map them explicitly before the lookup.
  if (phase === 'refining') return 3;
  if (phase === 'lead_synthesizing') return 2;
  const i = STAGE_PHASES.indexOf(phase as typeof STAGE_PHASES[number]);
  return i < 0 ? 0 : i;
}

export function ProgressLine({ phase }: { phase: string }) {
  const locale = useLocale();
  const STAGES = locale === 'ko' ? STAGES_KO : STAGES_EN;
  const N = STAGES.length;
  const idx = stageIdx(phase);
  const isComplete = phase === 'complete';
  const pct = (idx / (N - 1)) * 100;
  const currentLabel = STAGES[idx];

  // Compact stepper with a tiny "N/5 · stage" eyebrow up top — keeps the
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
          {idx + 1}/{N}
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
        {STAGES.map((_, i) => {
          const left = (i / (N - 1)) * 100;
          const done = i < idx || (isComplete && i <= N - 1);
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
      <div className="grid grid-cols-5">
        {STAGES.map((label, i) => {
          const done = i < idx || (isComplete && i <= N - 1);
          const active = !isComplete && i === idx;
          return (
            <span
              key={label}
              className={`text-[11px] truncate transition-colors duration-500 ${
                i === 0 ? 'text-left' : i === N - 1 ? 'text-right' : 'text-center'
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
export function AnsweredPills({ qaPairs }: { qaPairs: Array<{ question: FlowQuestion; answer: FlowAnswer | null }> }) {
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

/* AttributedSection + SentenceStream → extracted to ./AttributedSection */

/* MixPreview → extracted to ./MixPreview */

/* DMFeedback → extracted to ./DMFeedback (re-exported below for back-compat) */
/* FinalCard → extracted to ./FinalCard (re-exported below) */

/* ═══ Loading ═══ */
/* ═══ PhaseStatusBar — always-visible sticky bar showing current state ═══ */
type StatusMode = 'ai_working' | 'your_turn' | 'phase_done';

export function PhaseStatusBar({
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
export function LeadSynthesisCard({ synthesis }: { synthesis: LeadSynthesisResult }) {
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
export function PhaseDivider({ done, next, yourTurn }: { done: string; next: string; yourTurn?: boolean }) {
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

export function VoyagePrepSummary({
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
          {/* Bearing micro-coordinate — small detail nodding to nautical
              charts. Pure flavor; no functional meaning. */}
          <div className="absolute top-4 right-4 md:top-6 md:right-7 text-[9px] tracking-[0.18em] uppercase text-[var(--accent)]/55 font-mono pointer-events-none select-none">
            N · {L('새 방향', 'New direction')}
          </div>

          <div className="relative p-6 md:p-8">
            <h2 className="text-[20px] md:text-[24px] font-bold text-[var(--text-primary)] leading-[1.3] tracking-tight mb-5 pr-20"
              style={{ fontFamily: 'var(--font-display)' }}>
              {L('이 방향으로 초안을 만들까요?', 'Draft in this direction?')}
            </h2>

            {/* Course summary — focal sentence framed with a Compass icon
                eyebrow. Keeps the metaphor consistent without leaning on
                emoji. */}
            <div className="mb-5 pl-4 border-l-[2px] border-[var(--accent)]/45">
              <div className="text-[10px] font-bold text-[var(--accent)] uppercase tracking-[0.15em] mb-1.5 flex items-center gap-1.5">
                <Compass size={11} className="shrink-0" />
                {L('정한 방향', 'Direction set')}
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

/* ═══ Framing Confirmation (Weakness A fix) ═══ */
export function FramingConfirmation({ snapshot, onConfirm, onReject, busy }: {
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
          <input value={reason} onChange={e => setReason(e.target.value)} aria-label={L('재정의 방향', 'Redefinition direction')}
          placeholder={L('어떤 방향이 더 맞나요? (예: 이건 투자용이 아니라 내부 보고용이야)', 'What direction fits better? (e.g., This is for internal reporting, not investors)')}
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
export function ConvergenceStatus({ metrics }: { metrics: ConvergenceMetrics }) {
  const locale = useLocale();
  const L = (ko: string, en: string) => locale === 'ko' ? ko : en;
  const colorClass = metrics.score >= 75 ? 'text-emerald-600 bg-emerald-50' :
    metrics.score >= 50 ? 'text-amber-600 bg-amber-50' : 'text-red-500 bg-red-50';
  const barColor = metrics.score >= 75 ? 'bg-emerald-400' :
    metrics.score >= 50 ? 'bg-amber-400' : 'bg-red-400';

  // Trend — answers "is this getting clearer?"
  const trend = metrics.trend === 'improving'
    ? { icon: <TrendingUp size={11} className="text-emerald-500" />, label: L('좋아지는 중', 'improving') }
    : metrics.trend === 'declining'
      ? { icon: <TrendingDown size={11} className="text-red-500" />, label: L('흔들리는 중', 'unsettled') }
      : metrics.trend === 'stable'
        ? { icon: <Minus size={11} className="text-[var(--text-tertiary)]" />, label: L('안정적', 'stable') }
        : null;

  // "When do I stop?" — rounds left / ready
  const roundsLabel = metrics.is_converged
    ? L('준비됨 — 다음 단계로 넘어가도 좋아요', 'Ready — good to move on')
    : metrics.estimated_rounds_left <= 1
      ? L('약 한 라운드 더', '~1 more round')
      : L(`약 ${metrics.estimated_rounds_left}라운드 더`, `~${metrics.estimated_rounds_left} more rounds`);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5, ease: EASE }}
      className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-[var(--bg)]/60 border border-[var(--border-subtle)]">
      <div className="flex-1">
        <div className="flex items-center justify-between mb-1">
          <span className="flex items-center gap-1.5 text-[10px] font-medium text-[var(--text-tertiary)]">
            {L('명확도', 'Clarity')}
            {trend && <span className="flex items-center gap-0.5">{trend.icon}<span className="text-[9px]">{trend.label}</span></span>}
          </span>
          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${colorClass}`}>{metrics.score}%</span>
        </div>
        {/* progress bar with a 75% "ready to move on" threshold marker */}
        <div className="relative h-1.5 rounded-full bg-[var(--border-subtle)]">
          <div className="absolute inset-0 rounded-full overflow-hidden">
            <motion.div className={`h-full rounded-full ${barColor}`}
              initial={{ width: 0 }} animate={{ width: `${metrics.score}%` }} transition={{ duration: 0.8, ease: EASE }} />
          </div>
          <div className="absolute top-1/2 -translate-y-1/2 w-[2px] h-[7px] rounded-full bg-[var(--text-tertiary)]/55"
            style={{ left: '75%' }} title={L('75%면 다음 단계로 넘어가도 좋아요', 'At 75% you can move on')} />
        </div>
        <div className="mt-1 flex items-center gap-1">
          {metrics.is_converged && <Check size={10} className="shrink-0 text-emerald-500" />}
          <span className={`text-[9px] font-medium ${metrics.is_converged ? 'text-emerald-600' : 'text-[var(--text-tertiary)]'}`}>{roundsLabel}</span>
        </div>
      </div>
      <p className="text-[10px] text-[var(--text-tertiary)] max-w-[160px] leading-tight">{metrics.guidance}</p>
    </motion.div>
  );
}

/* ═══ Pipeline Exit Buttons (Weakness D fix) ═══ */
export function PipelineExitOptions({ onReframe, onRehearse }: {
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
