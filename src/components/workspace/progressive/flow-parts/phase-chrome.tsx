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

import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight, Check, X as XIcon } from 'lucide-react';
import { useLocale } from '@/hooks/useLocale';
import { Button } from '@/components/ui/Button';
import { EASE } from '../shared/constants';

/* Phase-aware ambient glow — the page itself tells you where you are */
export function PhaseAmbient({ phase }: { phase: string }) {
  const bg = phase === 'complete'
    ? 'radial-gradient(ellipse 80% 50% at 50% 20%, rgba(184,150,62,0.08) 0%, transparent 70%)'
    : phase === 'dm_feedback' || phase === 'refining' || phase === 'testing' || phase === 'mixing' || phase === 'lead_synthesizing'
      ? 'radial-gradient(ellipse 80% 50% at 50% 20%, rgba(184,150,62,0.04) 0%, transparent 70%)'
      : 'none';
  return <motion.div className="fixed inset-0 pointer-events-none z-0" animate={{ background: bg }} transition={{ duration: 1.5, ease: EASE }} />;
}

/* ═══ Phase Header — top-of-page orientation card ═══
 * The earlier "minimal stepper" assumed PhaseStatusBar would carry the live
 * state; in practice first-time users couldn't tell what stage they were in
 * or what to do next. This card answers both questions explicitly:
 *   1. Where am I? (big stage label + N/4)
 *   2. What happens next? (one-line guide that updates per phase/state)
 */
// Progress indicator: CheckpointRail — 사용자가 실제로 선택하는 정거장들
// (상황·밧줄·질문N·초안·검토·확인·봉인)이 노드로 보이고 지나온 노드는
// 클릭 회항. 은유 3분할(VoyagePhaseRail)의 교체품 — "뭉뚱그린 바는 예쁜
// 것에 불과하다"(창업자 3차 지적). See CheckpointRail.tsx.

/* LiveAnalysis + VersionPills → replaced by shared AnalysisCard */

/* ═══ Answered Q&A — horizontal pills with "sent to team" indicator ═══ */

/* ═══ PhaseStatusBar — always-visible sticky bar showing current state ═══ */
export type StatusMode = 'ai_working' | 'your_turn' | 'phase_done';

export function PhaseStatusBar({
  phase, busy, hasQuestion, deployReady, shouldMix, workersRunning, workersDone, workersTotal, elapsedLabel, leadAgentName, substage, isLongWait, onCancel,
}: {
  phase: string; busy: boolean; hasQuestion: boolean; deployReady: boolean; shouldMix: boolean;
  workersRunning: number; workersDone: number; workersTotal: number; elapsedLabel: string; leadAgentName?: string;
  // Optional fine-grained step for long async work (e.g. mix pipeline has 4
  // serial LLM calls — surface which one is running now, not just "Drafting…").
  substage?: string | null;
  // True once the current LLM call has been running ≥75s — triggers a softer
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
      label = L('지금 답할 질문을 정리하고 있어요', 'Organizing the question to answer');
      sub = workersRunning > 0 ? L(`AI 검토 ${workersDone}/${workersTotal} 완료`, `${workersDone}/${workersTotal} AI reviewers finished`) : '';
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
  // Everything below is the ai_working bar (your_turn returned null above).
  return (
    <motion.div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      // This status belongs to the page rather than floating above it: two
      // quiet rules, stable typography, and one thin activity line.
      className="relative mx-auto mb-3 border-y border-[var(--border-subtle)] px-1 py-3 overflow-hidden"
    >
      {/* Row 1 — which stage is under way · elapsed time · cancel */}
      <div className="flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <span className="text-[13px] font-semibold text-[var(--text-primary)]">
            {showLongWait ? L('계속 확인하고 있어요', 'Still working through it') : label}
          </span>
          {sub && (
            <span className="ml-2 text-[12px] text-[var(--text-tertiary)]">{sub}</span>
          )}
          {showLongWait && (
            <span className="ml-2 text-[12.5px] text-[var(--text-tertiary)]">{L('지금까지 내용은 저장됐어요', 'Your work so far is saved')}</span>
          )}
          {substage && (
            <AnimatePresence mode="wait">
              <motion.span
                key={substage}
                initial={{ opacity: 0, y: 3 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -3 }}
                transition={{ duration: 0.25, ease: EASE }}
                className="text-[12.5px] text-[var(--text-tertiary)] ml-2 italic"
              >
                · {substage}
              </motion.span>
            </AnimatePresence>
          )}
        </div>
        {elapsedLabel && (
          <span className="text-[12.5px] tabular-nums shrink-0 text-[var(--text-tertiary)]">{elapsedLabel}</span>
        )}
        {/* Cancel is always reachable while the AI works. */}
        {onCancel && (
          <motion.button
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            onClick={onCancel}
            className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1.5 min-h-[44px] md:min-h-[32px] rounded-full text-[12.5px] font-semibold text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] border border-transparent hover:border-[var(--border)] transition-colors cursor-pointer"
            aria-label={L('취소', 'Cancel')}
          >
            <XIcon size={10} />
            {L('취소', 'Cancel')}
          </motion.button>
        )}
      </div>

      {/* Decorative activity line. It communicates motion without creating a
          second visual theme or pretending to know percentage completion. */}
      <div className="relative mt-2 h-px overflow-hidden bg-[var(--border-subtle)]" aria-hidden>
        <motion.div
          className="absolute inset-y-0 w-1/4 bg-[var(--accent)]/65"
          initial={{ x: '-110%' }}
          animate={{ x: ['-110%', '410%'] }}
          transition={{ duration: showLongWait ? 3.8 : 2.8, repeat: Infinity, ease: 'linear' }}
        />
      </div>
    </motion.div>
  );
}

/* ═══ PhaseDivider — visual break at phase boundaries ═══ */
export function PhaseDivider({ done, next, yourTurn }: { done: string; next: string; yourTurn?: boolean }) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5, ease: EASE }}
      className={`flex items-center gap-3 py-3 ${yourTurn ? 'px-4 rounded-xl bg-amber-50/50 dark:bg-amber-900/10 border border-amber-200/30 dark:border-amber-700/20' : ''}`}>
      <div className="flex items-center gap-1.5 text-[12.5px] text-[var(--text-tertiary)]">
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
export function TestRecover({ label, cta, onClick }: { label: string; cta: string; onClick: () => void }) {
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
export function CompassRose({ size = 96 }: { size?: number }) {
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
export function WaveDivider({ className = '' }: { className?: string }) {
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
