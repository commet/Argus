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

import { motion } from 'framer-motion';
import { Loader2, Check, ArrowRight, Compass, Navigation } from 'lucide-react';
import { useLocale } from '@/hooks/useLocale';
import type { AnalysisSnapshot } from '@/stores/types';
import { EASE } from '../shared/constants';
import { HonestyShaded } from '../shared/HonestyShaded';
import { locateFlag } from '@/lib/honesty-scan';
import { CompassRose, WaveDivider } from './phase-chrome';

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
  const integrityPending = snapshot.version === 0 && (
    snapshot.lean_flags === undefined || snapshot.honesty_flags === undefined
  );
  const initialOpenInsight = snapshot.version === 0
    && !(snapshot.request_type && snapshot.request_type !== 'open')
    ? snapshot.real_question
    : snapshot.insight;
  const safeInsight = integrityPending
    ? undefined
    : initialOpenInsight;
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
        <div className="text-[12px] font-bold uppercase tracking-[0.2em] text-[var(--accent)] flex items-center gap-1.5 shrink-0">
          <span>✓</span>
          {L('정리할 준비 완료', 'Ready to wrap up')}
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
              {L('이 방향으로 정리할까요?', 'Wrap it up in this direction?')}
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
            <div className="mb-5">
              <div className="text-[12px] font-bold text-[var(--accent)] uppercase tracking-[0.15em] mb-1.5 flex items-center gap-1.5">
                <Compass size={11} className="shrink-0" />
                {safeInsight
                  ? L('지금까지 답변에서 정리된 내용', 'What your answers have clarified')
                  : L('지금 이해한 상황', 'What I heard')}
              </div>
              <p className="text-[15px] md:text-[16px] text-[var(--text-primary)] leading-relaxed font-medium">
                {safeInsight
                  ? <HonestyShaded text={safeInsight} flags={snapshot.honesty_flags} locale={locale} />
                  : snapshot.real_question}
              </p>
              {/* Honesty-scan legend (loop-17) — one quiet line, ONLY when a flag
                  actually matched the insight. Explains the dotted underline once so
                  each span stays clean. Reads as an invitation to verify, never a
                  verdict on the content. */}
              {!!safeInsight && (snapshot.honesty_flags || []).some((f) => locateFlag(safeInsight, f.text) >= 0) && (
                <p className="mt-2 text-[12px] text-[var(--text-tertiary)] leading-relaxed">
                  {L('점선 그은 곳은 아직 확인 안 된 부분이에요 — 짚어보면 어디서 확인할지 알려드려요.',
                     'Dotted spans are things we couldn’t verify — hover to see where to check.')}
                </p>
              )}
            </div>

            {/* Wave divider — section break before CTA. Soft and silent. */}
            <div className="mb-5 text-[var(--accent)]/25">
              <WaveDivider className="w-full h-2" />
            </div>

            {/* Primary CTA — gradient gold, "set sail" with Navigation
                arrow tilted like a sail. */}
            <motion.button onClick={onMix} disabled={busy} whileTap={{ scale: 0.98 }}
              className="group/sail w-full flex items-center justify-center gap-2.5 px-6 py-4 text-[var(--accent-fg)] rounded-xl text-[15px] font-semibold shadow-[var(--shadow-sm)] hover:shadow-[var(--shadow-md)] transition-all cursor-pointer disabled:opacity-50"
              style={{ background: 'var(--gradient-gold)' }}>
              {busy
                ? <><Loader2 size={16} className="animate-spin" /> {L('정리하는 중...', 'Wrapping up...')}</>
                : (
                  <>
                    {L('이 방향으로 정리하기', 'Wrap up in this direction')}
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
      <p className="text-[12px] font-bold uppercase tracking-[0.16em] text-[var(--accent)]/80 mb-2.5">
        {L('AI가 임시로 둔 전제', 'Working premise from AI')}
      </p>
      {/* The surfaced premise — a NOTE, not a headline. One display-serif
          headline per screen (the question below owns it); this reads as a
          margin annotation the user can correct in passing. */}
      <p className="text-[13.5px] text-[var(--text-primary)] leading-[1.6] max-w-[60ch]">
        {assumption}
      </p>
      {/* Recognition, not a question. Hand control back; no 맞나요?, no fork.
          (First sentence dropped: the "AI가 임시로 둔 전제" label already says
          the AI placed it — the body only needs the "you can fix it" half.) */}
      <p className="text-[12.5px] text-[var(--text-secondary)] leading-[1.6] mt-2.5">
        {L('틀렸다면 아래 답에서 바로잡으면 돼요.', "If it's off, just correct it in your next answer.")}
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

// Diagnostic line only — the heading ("여기서 마쳐도 돼요") + the two buttons
// (draft / dig in) carry the "you can stop or keep going" half, so each route's
// second sentence was cut as a restatement.
export const TERMINAL_ROUTE_COPY: Record<string, { ko: string; en: string }> = {
  flat: {
    ko: '어느 쪽을 골라도 결과가 크게 다르지 않은 결정이에요.',
    en: 'This decision lands about the same whichever way you go.',
  },
  vent: {
    ko: '지금은 결정하기보다 상황을 정리하는 쪽에 가까워 보여요.',
    en: 'This reads more like laying the situation out than deciding something.',
  },
  validation: {
    ko: '방향은 이미 잡혀 있고, 확인이 필요한 상황으로 보여요.',
    en: 'The direction already looks set — this reads as needing confirmation.',
  },
  info: {
    ko: '결정이라기보다 정보를 정리하는 요청에 가까워요.',
    en: 'This is closer to organizing information than making a decision.',
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
    ko: '이 입력은 답이 자연스럽게 하나로 모여서, 굳이 더 캐묻지 않고 위 내용으로 정리했어요.',
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
        <span className="text-[12.5px] font-bold uppercase tracking-[0.14em] text-[var(--accent)]">
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
          className="inline-flex items-center justify-center gap-2 px-5 py-3 min-h-[44px] text-[var(--accent-fg)] rounded-xl text-[13.5px] font-semibold shadow-[var(--shadow-sm)] cursor-pointer disabled:opacity-50"
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
