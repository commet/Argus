'use client';

/* ═══ VoyagePhaseRail — the 3-phase voyage skeleton ═══
 *
 * Replaces the old flat 5-step `ProgressLine`. A first-time user staring at
 * the busy workspace couldn't tell which of Argus's THREE narrative phases
 * they were in — the stepper only spoke in operational substages (분석/질문/
 * 팀 작업/검토/완성). This rail makes the three voyage phases the PRIMARY
 * skeleton, with the operational substage kept as a quiet secondary label.
 *
 * The three phases (canonical narrative — see
 * docs/MYTH-SIRENS-design-grounding-2026-06-23.md → "The Three-Phase Voyage"):
 *
 *   묶기 / Bind   — the user concretizes their OWN judgment before the AI runs.
 *                   "당신의 판단을 먼저 정합니다."
 *   듣기 / Listen — the agents generate maximally but are *deaf rowers*: they
 *                   cannot seize the decision. Invariant line surfaced here:
 *                   "AI가 대신 정할 수 없어요 — 당신이 확인합니다."
 *   닿기 / Land   — the sealed judgment is settled against reality on the day
 *                   the user chose. "정한 날, 현실에 대고 정산합니다."
 *
 * Operational → voyage mapping (preserves the old `stageIdx` crew special-case
 * where `conversing && crewDeployed` already counted as team-work / Listen):
 *
 *   bind   ⊃ { idle, assembling, analyzing, conversing(pre-crew) }   subs: 준비·분석·질문
 *   listen ⊃ { conversing(crewDeployed), mixing, lead_synthesizing,
 *              dm_feedback, refining, testing }                      subs: 팀 작업·검토
 *   land   ⊃ { complete }                                           sub:  정산
 *
 * SPINE: zero judgment. Every caption describes STATE + what the USER does —
 * no verdict, no recommendation, no score. (See CLAUDE.md → Zero-Judgment Gate.)
 */

import { motion, AnimatePresence } from 'framer-motion';
import { Check } from 'lucide-react';
import { useLocale } from '@/hooks/useLocale';
import { EASE } from './shared/constants';

export type VoyagePhaseKey = 'bind' | 'listen' | 'land';

/** Group an operational `phase` (+ crew state) into one of the 3 voyage phases. */
export function voyagePhaseOf(phase: string, crewDeployed = false): VoyagePhaseKey {
  if (phase === 'complete') return 'land';
  // The crew theater (CrewAtWork) runs DURING 'conversing': once workers are
  // deployed the user is watching the agents row (Listen), not still framing
  // their own question (Bind). Mirror the old stageIdx crew special-case.
  if (phase === 'conversing' && crewDeployed) return 'listen';
  if (
    phase === 'mixing' ||
    phase === 'lead_synthesizing' ||
    phase === 'dm_feedback' ||
    phase === 'refining' ||
    phase === 'testing'
  ) {
    return 'listen';
  }
  // idle, assembling, analyzing, conversing(pre-crew) → Bind
  return 'bind';
}

/** The fine operational substage label shown inside the active voyage phase. */
function subLabelOf(phase: string, crewDeployed: boolean, locale: string): string {
  const L = (ko: string, en: string) => (locale === 'ko' ? ko : en);
  if (phase === 'assembling') return L('준비', 'Setup');
  if (phase === 'analyzing') return L('분석', 'Analysis');
  if (phase === 'conversing' && !crewDeployed) return L('질문', 'Questions');
  if (phase === 'conversing' || phase === 'mixing' || phase === 'lead_synthesizing') {
    return L('팀 작업', 'Team work');
  }
  if (phase === 'dm_feedback' || phase === 'refining' || phase === 'testing') {
    return L('검토', 'Review');
  }
  if (phase === 'complete') return L('정산', 'Settle');
  return L('준비', 'Setup'); // idle / pre-start
}

type PhaseMeta = {
  key: VoyagePhaseKey;
  ko: string; en: string;
  /** One quiet line: the state + what the USER does (never a verdict). */
  koLine: string; enLine: string;
};

const PHASES: readonly PhaseMeta[] = [
  {
    key: 'bind', ko: '묶기', en: 'Bind',
    koLine: '당신의 판단을 먼저 정합니다.',
    enLine: 'You set your own read first.',
  },
  {
    // The deaf-rower invariant — the product's strongest message, kept quiet.
    key: 'listen', ko: '듣기', en: 'Listen',
    koLine: 'AI가 대신 정할 수 없어요 — 당신이 확인합니다.',
    enLine: "AI can't decide for you — you confirm.",
  },
  {
    key: 'land', ko: '닿기', en: 'Land',
    koLine: '정한 날, 현실에 대고 정산합니다.',
    enLine: 'On the day you chose, you settle it against reality.',
  },
] as const;

/**
 * Calm 3-phase rail. Same call signature as the old `ProgressLine`
 * (`{ phase, crewDeployed }`) so the render site is a drop-in swap.
 *
 * Footprint stays compact (eyebrow + rail + names + one caption line) — the
 * drama lives in Bind and Land; Listen is the quiet middle.
 */
export function VoyagePhaseRail({ phase, crewDeployed = false }: { phase: string; crewDeployed?: boolean }) {
  const locale = useLocale();
  const L = (ko: string, en: string) => (locale === 'ko' ? ko : en);

  const activeKey = voyagePhaseOf(phase, crewDeployed);
  const activeIdx = PHASES.findIndex(p => p.key === activeKey);
  const active = PHASES[activeIdx];
  const sub = subLabelOf(phase, crewDeployed, locale);

  return (
    <motion.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: EASE }}
      className="mb-6 px-1 mt-1"
      role="group"
      aria-label={L(
        `항해 ${activeIdx + 1}/3단계: ${active.ko} · ${sub}`,
        `Voyage phase ${activeIdx + 1}/3: ${active.en} · ${sub}`,
      )}
    >
      {/* Eyebrow — the accessible, always-readable current-state line
          ("어디에 와있지?"): N/3 · voyage · substage. */}
      <div className="flex items-baseline justify-between mb-2 px-0.5">
        <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--accent)] tabular-nums">
          {activeIdx + 1}/3
          <span className="ml-1.5 text-[var(--text-primary)] normal-case tracking-normal">
            {L(active.ko, active.en)}
          </span>
          <span className="ml-1.5 normal-case tracking-normal text-[var(--text-tertiary)]">
            · {sub}
          </span>
        </span>
      </div>

      {/* Three-segment rail — completed phases fill solid accent, the active
          phase fills with the gold gradient (+ one subtle breathing pulse),
          future phases stay faint. */}
      <div className="flex items-center gap-1.5 mb-2.5">
        {PHASES.map((p, i) => {
          const done = i < activeIdx;
          const isActive = i === activeIdx;
          return (
            <div
              key={p.key}
              className="relative flex-1 h-[5px] rounded-full overflow-hidden"
              style={{ background: 'var(--border-subtle)' }}
            >
              {(done || isActive) && (
                <motion.div
                  className="absolute inset-y-0 left-0 rounded-full"
                  style={{ background: done ? 'var(--accent)' : 'var(--gradient-gold)' }}
                  initial={{ width: isActive ? '18%' : '100%' }}
                  animate={{ width: '100%' }}
                  transition={{ duration: 0.9, ease: EASE }}
                />
              )}
              {isActive && (
                // Single, slow breathing glow — the calm cousin of the old
                // node ping; reduced-motion users lose only a soft opacity wash.
                <motion.div
                  className="absolute inset-0 rounded-full"
                  style={{ background: 'var(--gradient-gold)', filter: 'blur(3px)' }}
                  animate={{ opacity: [0, 0.45, 0] }}
                  transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Voyage names — active bold, completed checked + muted, future faint. */}
      <div className="grid grid-cols-3 mb-2.5">
        {PHASES.map((p, i) => {
          const done = i < activeIdx;
          const isActive = i === activeIdx;
          return (
            <div
              key={p.key}
              className={`flex items-center gap-1 ${i === 0 ? 'justify-start' : i === 2 ? 'justify-end' : 'justify-center'}`}
            >
              {done && <Check className="w-3 h-3 text-[var(--accent)]/80" strokeWidth={3} aria-hidden />}
              <span
                className={`text-[12px] tracking-wide transition-colors duration-500 ${
                  isActive
                    ? 'text-[var(--text-primary)] font-bold'
                    : done
                      ? 'text-[var(--accent)]/80 font-medium'
                      : 'text-[var(--text-tertiary)]'
                }`}
              >
                {L(p.ko, p.en)}
              </span>
            </div>
          );
        })}
      </div>

      {/* Active-phase caption — substage + the one quiet line of what the user
          does. On Listen, the deaf-rower invariant gets a faint --ai tint. */}
      <div className="min-h-[18px] px-0.5">
        <AnimatePresence mode="wait">
          <motion.p
            key={active.key}
            initial={{ opacity: 0, y: 3 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -3 }}
            transition={{ duration: 0.35, ease: EASE }}
            className="text-[11.5px] leading-relaxed text-[var(--text-secondary)]"
          >
            <span className="font-semibold text-[var(--text-primary)]">{sub}</span>
            <span className="mx-1.5 text-[var(--text-tertiary)]">·</span>
            {/* The deaf-rower invariant on Listen is the product's strongest
                message — give it the gold accent so it reads, never a pale tint. */}
            <span className={active.key === 'listen' ? 'text-[var(--accent)] font-medium' : undefined}>
              {L(active.koLine, active.enLine)}
            </span>
          </motion.p>
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
