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

import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { Check } from 'lucide-react';
import { useLocale } from '@/hooks/useLocale';
import { EASE } from './shared/constants';

export type VoyagePhaseKey = 'bind' | 'listen' | 'land';

/* ═══ Per-phase mini glyphs ═══
 * Minimal line icons (stroke 1.5, currentColor, no fill) drawn on a 24 viewBox
 * so they stay crisp at 16px and sit at the same weight as the lucide `Check`.
 *   bind   → an interlocking rope loop (a knot / cleat hitch)
 *   listen → an oar dipped across a small wave (the deaf rowers' stroke)
 *   land   → an anchor
 */
function PhaseGlyph({ glyph, size = 16 }: { glyph: VoyagePhaseKey; size?: number }) {
  const common = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.5,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  };
  if (glyph === 'bind') {
    // Two interlocking loops with two free tails — reads as a tied knot.
    return (
      <svg {...common}>
        <circle cx="9.4" cy="10.4" r="3.1" />
        <circle cx="14.6" cy="13.6" r="3.1" />
        <path d="M7.2 8.2 5 6" />
        <path d="M16.8 15.8 19 18" />
      </svg>
    );
  }
  if (glyph === 'listen') {
    // An oar (shaft + blade) crossing a calm two-bump wave.
    return (
      <svg {...common}>
        <path d="M16.5 5.5 10.4 12.6" />
        <ellipse cx="9.2" cy="13.9" rx="1.8" ry="1.8" />
        <path d="M4 18c1.4 0 1.4-1.4 2.8-1.4S8.2 18 9.6 18s1.4-1.4 2.8-1.4S13.8 18 15.2 18s1.4-1.4 2.8-1.4" />
      </svg>
    );
  }
  // land — a classic anchor (matches the lucide Anchor silhouette).
  return (
    <svg {...common}>
      <circle cx="12" cy="5.5" r="2.4" />
      <path d="M12 7.9V20" />
      <path d="M5.5 12.5H3a9 9 0 0 0 18 0h-2.5" />
    </svg>
  );
}

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

/** Where each phase's mooring sits on the sea lane (aligned with the
 *  start/center/end-justified name columns below). The ship sails to — and
 *  bobs at — the active phase's mooring. */
const SHIP_POS: Record<VoyagePhaseKey, string> = { bind: '4%', listen: '50%', land: '96%' };

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
export function VoyagePhaseRail({ phase, crewDeployed = false, progress, onPhaseClick }: {
  phase: string;
  crewDeployed?: boolean;
  /** 0..1 progress WITHIN the active phase — the ship advances continuously
   *  between moorings instead of parking at one for 80% of the session
   *  (창업자 지적: "바가 거의 안 움직여 멈춘 것처럼 보인다"). Omit → moored. */
  progress?: number;
  /** Completed-phase names become handles: click sails the view back to that
   *  phase's artifact (scroll, not state rewind — 회항은 보는 것부터). */
  onPhaseClick?: (key: VoyagePhaseKey) => void;
}) {
  const locale = useLocale();
  const L = (ko: string, en: string) => (locale === 'ko' ? ko : en);
  const reduce = useReducedMotion();

  const activeKey = voyagePhaseOf(phase, crewDeployed);
  const activeIdx = PHASES.findIndex(p => p.key === activeKey);
  const active = PHASES[activeIdx];
  const sub = subLabelOf(phase, crewDeployed, locale);

  // Ship position: the active mooring, plus fractional headway toward the next
  // one when the caller reports within-phase progress. Land is the last mooring.
  const clamped = Math.max(0, Math.min(1, progress ?? 0));
  const pct = (s: string) => parseFloat(s);
  const here = pct(SHIP_POS[active.key]);
  const next = activeIdx + 1 < PHASES.length ? pct(SHIP_POS[PHASES[activeIdx + 1].key]) : here;
  const shipLeft = `${(here + (next - here) * clamped * 0.9).toFixed(1)}%`;

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

      {/* The sea lane — the rail IS a voyage: a small hull sails to the
          current phase's mooring and bobs there at anchor; sailed water fills
          gold behind it, water ahead stays faint. Phase change = the ship
          casts off and sails to the next mooring (slow ease, no teleport).
          Decorative motion only — the eyebrow above carries the state for
          screen readers, so the lane is aria-hidden. */}
      <div className="relative mb-2.5 h-[22px]" aria-hidden>
        {/* waterline */}
        <div className="absolute inset-x-0 bottom-[5px] h-[3px] rounded-full" style={{ background: 'var(--border-subtle)' }} />
        {/* sailed water — gold fill up to the ship. style carries the SSR
            position (no pre-hydration flash at 0); framer tweens changes. */}
        <motion.div
          className="absolute left-0 bottom-[5px] h-[3px] rounded-full"
          style={{ background: 'var(--gradient-gold)', width: shipLeft }}
          initial={false}
          animate={{ width: shipLeft }}
          transition={{ duration: reduce ? 0 : 1.6, ease: EASE }}
        />
        {/* mooring ticks — one small buoy per phase (start / mid / end) */}
        {PHASES.map((p, i) => (
          <div
            key={p.key}
            className="absolute bottom-[3px] w-[7px] h-[7px] rounded-full border-2 transition-colors duration-500"
            style={{
              left: SHIP_POS[p.key],
              transform: 'translateX(-50%)',
              borderColor: i <= activeIdx ? 'var(--accent)' : 'var(--border-subtle)',
              background: 'var(--surface)',
            }}
          />
        ))}
        {/* the hull — sails to the active mooring, then bobs gently at anchor */}
        <motion.div
          className="absolute bottom-[6px]"
          style={{ translateX: '-50%', left: shipLeft }}
          initial={false}
          animate={{ left: shipLeft }}
          transition={{ duration: reduce ? 0 : 1.6, ease: EASE }}
        >
          <motion.div
            animate={reduce ? undefined : { y: [0, -1.5, 0, -1, 0], rotate: [-2, 1.5, -2] }}
            transition={reduce ? undefined : {
              y: { duration: 2.2, repeat: Infinity, ease: 'easeInOut' },
              rotate: { duration: 3, repeat: Infinity, ease: 'easeInOut' },
            }}
            className="text-[var(--accent)]"
          >
            <svg width="20" height="17" viewBox="0 0 20 17" fill="none">
              <path d="M10 1 L10 10 L3 10 Z" fill="currentColor" opacity="0.9" />
              <path d="M10.8 3.5 L10.8 10 L16 10 Z" fill="currentColor" opacity="0.5" />
              <path d="M2 11 L18 11 L15.5 15 L4.5 15 Z" fill="currentColor" />
            </svg>
          </motion.div>
        </motion.div>
      </div>

      {/* Voyage names + per-phase glyph — the active phase is the clear focal
          one (gold glyph that breathes, larger/bolder name); completed phases
          are muted accent + a Check; future phases stay faint. */}
      <div className="grid grid-cols-3 mb-2.5">
        {PHASES.map((p, i) => {
          const done = i < activeIdx;
          const isActive = i === activeIdx;
          // A visited phase is a HANDLE, not a label — click sails the view back
          // to its artifact. Future phases stay inert (no fake affordance).
          const clickable = !!onPhaseClick && (done || isActive);
          // Glyph colour: active = gold, completed = faded gold, future = tertiary.
          const glyphColor = isActive
            ? 'text-[var(--accent)]'
            : done
              ? 'text-[var(--accent)]/70'
              : 'text-[var(--text-tertiary)]';
          const Tag = clickable ? 'button' : 'div';
          return (
            <Tag
              key={p.key}
              {...(clickable ? { type: 'button' as const, onClick: () => onPhaseClick!(p.key), title: L(`${p.ko}로 돌아가 보기`, `Look back at ${p.en}`) } : {})}
              className={`flex items-center gap-1.5 ${i === 0 ? 'justify-start' : i === 2 ? 'justify-end' : 'justify-center'} ${clickable ? 'cursor-pointer rounded-md px-1 -mx-1 hover:bg-[var(--accent)]/[0.07] transition-colors' : ''}`}
            >
              <motion.span
                className={`shrink-0 transition-colors duration-500 ${glyphColor}`}
                // The active glyph gives one slow, calm breath; reduced-motion
                // and inactive phases stay still.
                animate={isActive && !reduce ? { opacity: [0.7, 1, 0.7] } : { opacity: 1 }}
                transition={
                  isActive && !reduce
                    ? { duration: 2.4, repeat: Infinity, ease: 'easeInOut' }
                    : { duration: 0.4, ease: EASE }
                }
              >
                <PhaseGlyph glyph={p.key} size={isActive ? 17 : 15} />
              </motion.span>
              <span
                className={`tracking-wide transition-all duration-500 ${
                  isActive
                    ? 'text-[13px] text-[var(--text-primary)] font-bold'
                    : done
                      ? 'text-[12px] text-[var(--accent)]/80 font-medium'
                      : 'text-[12px] text-[var(--text-tertiary)]'
                }`}
              >
                {L(p.ko, p.en)}
              </span>
              {done && <Check className="w-3 h-3 text-[var(--accent)]/80 shrink-0" strokeWidth={3} aria-hidden />}
            </Tag>
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
