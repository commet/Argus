'use client';

/**
 * SealMoment — the voyage's closing scene (W1.1 봉인 종막).
 *
 * This is the LAST interaction of a completed voyage: a standalone, screen-
 * transition-grade question that asks, in the plugin's own voice, whether to
 * come back later and see how the decision actually turned out.
 *
 *   "이 결정, {날짜}에 어떻게 됐는지 물어봐 드릴까요?"
 *
 * Constitution (EXECUTION-PLAN-v4.1 §0):
 *  - "물어봐 줄까요?" 화법 only. The surface NEVER says 내기 / predicate / 반증.
 *    The internal schema (predicate / falsified_if / check_by) is untouched —
 *    only the words the user sees change.
 *  - Accept = 1 tap (the bet draft is auto-derived; an editable drawer lets the
 *    user adjust the date or trim predictions, but is never required).
 *  - Reject = 1 tap, lossless — every artifact above stays fully accessible.
 *  - Silence is output (P3): with nothing falsifiable to predict, renders null.
 *
 * State machine (derived, never stored):
 *   no contract + has predicates → ASK     (the standalone question)
 *   just sealed this session     → SEALED  (calm confirmation + edit drawer)
 *   contract exists (reload/due) → delegate to <DecisionContractCard> so the
 *                                  WAITING / GRADE / VERIFIED loop has a single
 *                                  source of truth (no duplicated grading UI).
 *
 * All user/LLM text renders through JSX → React auto-escapes (no XSS). The
 * contract is read defensively so legacy localStorage sessions never crash.
 */

import { useEffect, useMemo, useState } from 'react';
import { LocaleLink } from '@/components/ui/LocaleLink';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { Anchor, CalendarPlus, Check, ChevronDown, Target, AlertTriangle, GitBranch } from 'lucide-react';
import { useLocale } from '@/hooks/useLocale';
import { useAuth } from '@/lib/auth';
import { useProjectStore } from '@/stores/useProjectStore';
import type { Project, Predicate, PredicateSource, CheckInInterval } from '@/stores/types';
import { contractFromPredicates, withCheckIn, augmentContract, shouldSealContract, buildEarlyContract, CHECK_IN_MS } from '@/lib/decision-contract';
import { recordSignal } from '@/lib/signal-recorder';
import { syncSealToTelegram } from '@/lib/telegram-sync';
import { track } from '@/lib/analytics';
import { DecisionContractCard } from '@/components/projects/DecisionContractCard';
import { JudgmentReceipt, deriveReceiptFields } from '@/components/projects/JudgmentReceipt';
import { SealStamp } from './SealStamp';
import { Graticule } from '@/components/ui/VoyageElements';
import { EASE } from './shared/constants';

const SOURCE_ICON: Record<PredicateSource, typeof Target> = {
  governing_idea: Target,
  user_lean: Target,
  risk: AlertTriangle,
  actor: GitBranch,
};

const INTERVALS: { value: CheckInInterval; ko: string; en: string }[] = [
  { value: '1w', ko: '1주 뒤', en: 'in 1 week' },
  { value: '2w', ko: '2주 뒤', en: 'in 2 weeks' },
  { value: '1m', ko: '1달 뒤', en: 'in 1 month' },
];

const DEFAULT_INTERVAL: CheckInInterval = '2w';

/** RFC 5545 TEXT escaping — commas/semicolons/backslashes/newlines. */
function icsEscape(s: string): string {
  return s
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

export function SealMoment({
  project,
  predicates,
  gate,
}: {
  project: Project;
  /** Falsifiable predictions derived from this voyage (live path). */
  predicates: Predicate[];
  /** §0 sealing restraint inputs (from the analysis snapshot). When routine +
   *  reversible + confident, the seal records a single light check instead of the
   *  full multi-predicate contract (CLAUDE.md mirror clause — don't over-fire
   *  ceremony on a low-stakes reversible call). Absent → full ceremony (safe). */
  gate?: { stakes?: 'routine' | 'important' | 'critical'; reversibility?: 'reversible' | 'partial' | 'irreversible'; framingConfidence?: number };
}) {
  const locale = useLocale();
  const ko = locale === 'ko';
  const L = (k: string, e: string) => (ko ? k : e);
  const updateProject = useProjectStore((s) => s.updateProject);
  const { user, session, signInWithGoogle } = useAuth();

  const [interval, setInterval] = useState<CheckInInterval>(DEFAULT_INTERVAL);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [dropped, setDropped] = useState<Set<string>>(new Set());
  // Scene machine for a seal performed in THIS session (P1-A3 / 07 S3):
  //   'ask'     — nothing sealed here yet (delegates to the contract card if a
  //               contract already exists from a previous session).
  //   'sealing' — the 2.6s press ceremony. Identical for EVERY seal (no
  //               content/direction variation — spine §4), tap anywhere to
  //               skip, and prefers-reduced-motion jumps straight past it.
  //   'sealed'  — the certificate plate + actions.
  const [scene, setScene] = useState<'ask' | 'sealing' | 'sealed'>('ask');
  const reducedMotion = useReducedMotion();
  const [dismissed, setDismissed] = useState(false);
  const [humanJudgment, setHumanJudgment] = useState('');

  // Ceremony clock — the press lands ~380ms, the ink line finishes ~1650ms,
  // the certificate crossfades in at 1700ms. Cleanup guards unmount mid-scene.
  useEffect(() => {
    if (scene !== 'sealing') return;
    const t = setTimeout(() => setScene('sealed'), 1700);
    return () => clearTimeout(t);
  }, [scene]);

  // Defensive: legacy sessions may carry a malformed contract.
  const contract = project?.decision_contract ?? null;

  // A genuinely flat decision (routine + reversible) is where NOT sealing is the
  // correct, spine-mandated restraint (P3 / over-fire clause). Everything else is a
  // "non-trivial frame": a consequential decision where reaching the seal with zero
  // predicates means the loop BROKE, not that restraint fired. Absent gate inputs
  // default to the safe non-trivial side (same default as the seal ceremony itself).
  const flatDecision =
    (gate?.stakes ?? 'important') === 'routine' &&
    (gate?.reversibility ?? 'partial') === 'reversible';

  // §D.2 restraint observability: the seal used to render null on zero predicates in
  // BOTH the "correctly silent on a flat decision" case AND the "engine produced
  // nothing" case — restraint and a broken loop looked identical, laundering the
  // broken-loop rate into restraint. Split the signal by reason so the broken loop
  // is measurable (internal routing only — never surfaced to the user).
  const silentNoSeal = !contract && (Array.isArray(predicates) ? predicates.length : 0) === 0;
  useEffect(() => {
    if (!silentNoSeal) return;
    const reason = flatDecision ? 'flat' : 'extraction_empty';
    recordSignal({ project_id: project.id, tool: 'voyage', signal_type: 'seal_not_armed', signal_data: { predicates: 0, reason } });
    track('seal_not_armed', { project_id: project.id, reason });
  }, [silentNoSeal, flatDecision, project.id]);

  const kept = useMemo(
    () => (Array.isArray(predicates) ? predicates : []).filter((p) => !dropped.has(p.id)),
    [predicates, dropped],
  );

  function fmtDate(ms: number): string {
    const d = new Date(ms);
    const opts: Intl.DateTimeFormatOptions = { month: 'long', day: 'numeric' };
    // A promise that crosses the year boundary must say which year it means.
    if (d.getFullYear() !== new Date().getFullYear()) opts.year = 'numeric';
    return d.toLocaleDateString(ko ? 'ko-KR' : 'en-US', opts);
  }
  const dateFor = (iv: CheckInInterval) => fmtDate(Date.now() + CHECK_IN_MS[iv]);

  // The COMMITTED check-in date (ms) — what was actually sealed, not the chip
  // currently selected in the drawer (selection no longer re-seals).
  const sealedAtMs = (() => {
    if (!contract?.check_in_at) return null;
    const t = new Date(contract.check_in_at).getTime();
    return Number.isNaN(t) ? null : t;
  })();

  // `iv` lets callers seal with a freshly-picked interval without waiting for the
  // setInterval state update to flush (React batches it, so reading `interval`
  // here would be stale).
  function seal(iv: CheckInInterval = interval) {
    if (kept.length === 0) return;
    const now = Date.now();
    const existing = project.decision_contract;
    // §0 restraint gate (CLAUDE.md mirror clause): a routine + reversible + confident
    // decision gets ONE light check, not the full multi-predicate ceremony. It NEVER
    // drops the decision — single_check still seals (the user's early rope alone if one
    // exists, else the single sharpest predicate). Absent gate inputs → full contract.
    const decision = shouldSealContract({
      stakes: gate?.stakes ?? 'important',
      reversibility: gate?.reversibility ?? 'partial',
      framingConfidence: gate?.framingConfidence ?? 0,
      predicates: kept,
    });
    if (decision.mode === 'none') return;
    const toSeal = decision.mode === 'single_check'
      ? (existing ? [] : kept.slice(0, 1)) // keep only the user's early rope, or one predicate
      : kept;
    // If an EARLY rope already exists (Phase 1 BIND at project-OPEN), AUGMENT it —
    // merge onto it, preserving id/created_at and the user's own user_lean predicate,
    // and re-confirm the check-in. Never clobber ("bind tighter at peak temptation").
    const next = existing
      ? augmentContract(existing, toSeal, now, iv)
      : (() => { const f = contractFromPredicates(project.id, toSeal, now); return f ? withCheckIn(f, iv, now) : null; })();
    if (!next) return;
    const receiptFields = deriveReceiptFields(toSeal, typeof project.name === 'string' ? project.name : '');
    const check_by = next.check_in_at ? new Date(next.check_in_at).toLocaleDateString(ko ? 'ko-KR' : 'en-US', { month: 'long', day: 'numeric' }) : '';
    // ALWAYS attach the receipt. The machine-derived fields (그때의 진짜 질문 /
    // 검증 안 된 가정) are computed regardless; only human_judgment is optional.
    // Previously the whole receipt was gated on the user typing a line, so the
    // express 1-tap path (the default) saved NO receipt → settlement collapsed to a
    // bare date + verdict chip with no then↔now to re-verify against. Empty
    // human_judgment renders nothing in JudgmentReceipt, so this costs the user
    // zero extra work while keeping the premise recall alive at settlement.
    const judgment_receipt = { ...receiptFields, human_judgment: humanJudgment.trim(), check_by };
    updateProject(project.id, { decision_contract: { ...next, judgment_receipt } });
    // Cross-surface return loop: if this logged-in user connected Telegram, mirror
    // the sealed contract into the one push channel that actually fires on the date
    // (the daily cron reads telegram_decisions, which web seals never wrote). Server
    // no-ops for unconnected users; fire-and-forget so it never blocks the seal.
    const sharp = next.predicates[0]?.text;
    if (user && session?.access_token && next.check_in_at && sharp) {
      syncSealToTelegram({
        accessToken: session.access_token,
        projectId: project.id,
        decision: typeof project.name === 'string' ? project.name : '',
        predicate: sharp,
        checkInAt: next.check_in_at,
      });
    }
    setInterval(iv);
    // First seal this session → play the ceremony (or skip it under
    // reduced-motion). A re-seal from the sealed drawer stays calmly on the
    // certificate — the ceremony plays once per session, not per adjustment.
    const firstSeal = scene === 'ask';
    setScene((s) => (s === 'sealed' ? 'sealed' : reducedMotion ? 'sealed' : 'sealing'));
    // Learning signal (2026-06-13 data-wiring fix) — the new flow recorded
    // nothing. Accepting the seal is the strongest engagement signal the
    // product has. Not already sealed → only count the first seal.
    if (firstSeal) {
      recordSignal({ project_id: project.id, tool: 'voyage', signal_type: 'seal_accepted', signal_data: { interval: iv, predicates: next.predicates.length } });
      // Also in the main funnel (user_events) — this is the activation north-star.
      track('decision_sealed', { interval: iv, predicates: next.predicates.length, augmented: !!existing, mode: decision.mode });
    }
  }

  // Recovery seal for the extraction_empty case: a consequential decision reached
  // the seal with zero machine-derived predicates (the loop would silently break).
  // Seal the user's OWN one-line decision summary as the sole predicate, authored
  // 'user' (buildEarlyContract's user_lean path) — lossless, and never offered on a
  // genuinely flat decision (see the render gate below). Mirrors seal()'s side
  // effects so the artifact behaves identically downstream.
  function manualSeal(iv: CheckInInterval = interval) {
    const summary = (typeof project?.name === 'string' ? project.name : '').trim();
    if (!summary) return;
    const c = buildEarlyContract(project.id, { lean: summary, interval: iv }, Date.now());
    if (!c) return;
    const check_by = c.check_in_at ? new Date(c.check_in_at).toLocaleDateString(ko ? 'ko-KR' : 'en-US', { month: 'long', day: 'numeric' }) : '';
    // ALWAYS attach the receipt (match the main seal path) so this recovery seal
    // also keeps a then↔now anchor at settlement; human_judgment stays optional.
    const judgment_receipt = { real_question: summary, unverified_assumption: '', human_only: '', human_judgment: humanJudgment.trim(), check_by };
    updateProject(project.id, { decision_contract: { ...c, judgment_receipt } });
    const sharp = c.predicates[0]?.text;
    if (user && session?.access_token && c.check_in_at && sharp) {
      syncSealToTelegram({
        accessToken: session.access_token,
        projectId: project.id,
        decision: summary,
        predicate: sharp,
        checkInAt: c.check_in_at,
      });
    }
    setInterval(iv);
    setScene(reducedMotion ? 'sealed' : 'sealing');
    recordSignal({ project_id: project.id, tool: 'voyage', signal_type: 'seal_accepted', signal_data: { interval: iv, predicates: c.predicates.length, mode: 'manual_recovery' } });
    track('decision_sealed', { interval: iv, predicates: c.predicates.length, mode: 'manual_recovery' });
  }

  // ── 캘린더에 약속 넣기 — a client-built .ics, because there is no outbound
  //    channel yet: the calendar is the user's own reminder, honestly framed. ──
  function downloadIcs() {
    const target = new Date(sealedAtMs ?? Date.now() + CHECK_IN_MS[interval]);
    const ymd = `${target.getFullYear()}${String(target.getMonth() + 1).padStart(2, '0')}${String(target.getDate()).padStart(2, '0')}`;
    const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
    const name = typeof project?.name === 'string' ? project.name : '';
    const summary = L(`그래서, 어떻게 됐어요? — ${name}`, `So, how did it go? — ${name}`);
    const lines = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Argus//Decision Check-in//EN',
      'BEGIN:VEVENT',
      `UID:argus-checkin-${project.id}`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${ymd}`,
      `SUMMARY:${icsEscape(summary)}`,
      `DESCRIPTION:${icsEscape(`${window.location.origin}/project`)}`,
      'END:VEVENT',
      'END:VCALENDAR',
    ];
    const blob = new Blob([lines.join('\r\n')], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `argus-checkin-${ymd}.ics`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ── Already-sealed loop (reload / waiting / due / verified): single source of
  //    truth lives in DecisionContractCard. We only own the fresh ASK + the
  //    just-sealed confirmation. ──
  if (contract && scene === 'ask') {
    return <DecisionContractCard project={project} livePredicates={predicates} />;
  }

  // Zero machine-derived predicates. Two very different worlds (see flatDecision):
  //  - FLAT decision → silence IS the output (P3 / over-fire spine). Render nothing.
  //  - NON-FLAT frame → the loop would silently break: a consequential decision with
  //    no return-hook. Offer ONE quiet, skippable manual seal of the user's own
  //    summary. Not a forced gate, not a fork — just a way to not lose the artifact.
  if ((Array.isArray(predicates) ? predicates.length : 0) === 0 && scene === 'ask') {
    if (flatDecision || dismissed) return null;
    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: EASE }}
        className="mt-12"
      >
        <div className="flex items-center gap-3 mb-8 text-[var(--text-tertiary)]/50">
          <div className="h-px flex-1 bg-[var(--border-subtle)]" />
          <span className="text-[11px] font-medium tracking-wide uppercase">{L('마지막으로', 'One last thing')}</span>
          <div className="h-px flex-1 bg-[var(--border-subtle)]" />
        </div>
        <div className="rounded-3xl border border-[var(--accent)]/30 bg-[var(--surface)] px-6 py-8 md:px-10 md:py-10 text-center">
          <div className="w-12 h-12 rounded-2xl mx-auto flex items-center justify-center bg-[var(--ai)] text-[var(--accent)]">
            <Anchor size={22} />
          </div>
          <h3 className="mt-5 text-[18px] md:text-[20px] font-bold text-[var(--text-primary)] leading-[1.4] max-w-md mx-auto">
            {L(`이 결정, ${dateFor(interval)}에 어떻게 됐는지 확인해 드릴까요?`, `Want me to check back on this on ${dateFor(interval)}?`)}
          </h3>
          <p className="mt-3 text-[13.5px] text-[var(--text-secondary)] leading-[1.6] max-w-md mx-auto">
            {L('따로 잡아둔 예측은 없지만, 그날 이 결정으로 돌아와 어떻게 됐는지 직접 확인할 수 있어요.', "There's no separate prediction to track, but you can still return to this decision that day and see, for yourself, how it went.")}
          </p>
          <div className="mt-7 flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={() => manualSeal()}
              className="inline-flex items-center justify-center gap-2 px-7 py-3 rounded-2xl text-white text-[14px] font-semibold cursor-pointer transition-transform duration-150 active:scale-[0.96]"
              style={{ background: 'var(--gradient-gold)' }}
            >
              <Check size={15} />
              {L(`네 — ${dateFor(interval)}에 확인해 주세요`, `Yes — check back on ${dateFor(interval)}`)}
            </button>
            <button
              onClick={() => {
                setDismissed(true);
                recordSignal({ project_id: project.id, tool: 'voyage', signal_type: 'seal_declined', signal_data: { predicates: 0, mode: 'manual_recovery' } });
                track('decision_seal_declined', { predicates: 0, mode: 'manual_recovery' });
              }}
              className="inline-flex items-center justify-center px-7 py-3 rounded-2xl text-[14px] font-medium text-[var(--text-secondary)] border border-[var(--border)] hover:border-[var(--text-secondary)]/40 cursor-pointer transition-colors"
            >
              {L('아니요, 괜찮아요', 'No, thanks')}
            </button>
          </div>
        </div>
      </motion.div>
    );
  }

  // ════ DISMISSED — rejected, lossless. A quiet way back, nothing forced. ════
  if (dismissed) {
    return (
      <div className="mt-10 text-center">
        <p className="text-[12.5px] text-[var(--text-tertiary)]">
          {L('마음 바뀌면 언제든 약속을 걸 수 있어요.', 'You can set the reminder anytime you change your mind.')}{' '}
          <button onClick={() => setDismissed(false)} className="font-medium text-[var(--accent)] hover:underline cursor-pointer">
            {L('질문 다시 보기', 'Show the question again')}
          </button>
        </p>
      </div>
    );
  }

  // ── Certificate / ceremony derived facts (all reads defensive — legacy
  //    contracts may lack the receipt; empty strings simply don't render). ──
  const checkDateStr = sealedAtMs ? fmtDate(sealedAtMs) : dateFor(interval);
  const stampD = new Date(sealedAtMs ?? Date.now() + CHECK_IN_MS[interval]);
  const stampDate = `${stampD.getMonth() + 1}.${stampD.getDate()}`;
  const sealedOnStr = fmtDate(Date.now());
  // The screenshot's heart: the user's OWN line (human_judgment). Falls back to
  // the sharpest predicate WITH the honest ai_surfaced label — never silently
  // promoted to look user-authored (CLAUDE.md rule 1).
  const certQuote = (contract?.judgment_receipt?.human_judgment || humanJudgment).trim();
  const certPredicate = (contract?.predicates?.[0]?.text || kept[0]?.text || '').trim();

  // ════ ASK → SEALING → SEALED — one keyed scene under AnimatePresence, so the
  //      ask card exits like paper being pressed away instead of vanishing. ════
  return (
    <AnimatePresence mode="wait">
    {scene === 'sealing' ? (
      // ════ SEALING — the 2.6s press ceremony (07 S3). One identical play for
      //      every seal; tap (or Enter/Space) anywhere = skip immediately.
      //      reduced-motion never reaches this scene (seal() jumps to 'sealed').
      <motion.div
        key="sealing"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.18 }}
        role="button"
        tabIndex={0}
        aria-label={L('건너뛰기', 'Skip')}
        onClick={() => setScene('sealed')}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setScene('sealed'); } }}
        className="seal-thud mt-10 rounded-3xl border border-[var(--accent)]/30 bg-[var(--surface)] px-6 py-12 md:py-14 text-center cursor-pointer"
      >
        <div className="flex justify-center">
          <SealStamp animate date={stampDate} />
        </div>
        <p className="seal-line-write mt-7 text-[15px] font-semibold text-[var(--text-primary)] leading-[1.5]">
          {L(`봉인했어요 — ${checkDateStr}에 제가 먼저 물어볼게요.`, `Sealed — I'll ask you first on ${checkDateStr}.`)}
        </p>
      </motion.div>
    ) : scene === 'sealed' ? (
      // ════ SEALED — the seal certificate (07 S4): the plate above is the
      //      screenshot object (graticule texture + the user's own line in
      //      serif), the actions below arrive late so the moment stays quiet.
      <motion.div
        key="sealed"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: EASE }}
        className="mt-10"
      >
        {/* ── 증서 플레이트 — the object worth keeping ── */}
        <div className="relative overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 md:p-8 text-left">
          <Graticule opacity={0.05} spacing={26} />
          <div className="absolute top-4 right-4 md:top-5 md:right-5">
            <SealStamp date={stampDate} size={64} />
          </div>
          <div className="relative pr-16 md:pr-20">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--text-tertiary)]">
              {L('항해 기록 — 봉인', 'Voyage log — sealed')} · {sealedOnStr}
            </p>
            {typeof project?.name === 'string' && project.name.trim() && (
              <p className="mt-2 text-[15px] font-semibold text-[var(--text-primary)] leading-[1.4]">{project.name}</p>
            )}
            {certQuote ? (
              <p className="mt-3 text-[16px] text-[var(--text-primary)] leading-[1.6]" style={{ fontFamily: 'var(--font-voice, serif)' }}>
                &ldquo;{certQuote}&rdquo;
              </p>
            ) : certPredicate ? (
              <div className="mt-3">
                <p className="text-[10.5px] text-[var(--text-tertiary)]">{L('AI가 대신 적어둔 확인 질문', 'A check question Argus drafted for you')}</p>
                <p className="mt-1 text-[14px] text-[var(--text-secondary)] leading-[1.6]" style={{ fontFamily: 'var(--font-voice, serif)' }}>
                  &ldquo;{certPredicate}&rdquo;
                </p>
              </div>
            ) : null}
          </div>
          <p className="relative mt-5 pt-3 border-t border-[var(--border)] text-[13px] text-[var(--text-secondary)] leading-[1.6]">
            {L(`이 판단의 답은 이제 현실만 갖고 있어요 — ${checkDateStr}, 「그래서, 어떻게 됐어요?」`,
               `Only reality holds the answer now — ${checkDateStr}, "So, how did it go?"`)}
          </p>
        </div>

        {/* ── 아래 = 행동. 기존 요소 그대로, 의식이 끝나기 전 붐비지 않게 늦게 등장. ── */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.25, duration: 0.4 }}
          className="mt-5 text-center"
        >
          <p className="text-[14px] font-semibold text-[var(--text-primary)] leading-[1.5]">
            {L(
              `좋아요. ${checkDateStr}에 물어볼게요 — 프로젝트 페이지에 오시면 제가 먼저 물어요.`,
              `Done. I'll ask on ${checkDateStr} — come to the project page and I'll bring it up first.`,
            )}
          </p>
          <p className="mt-1.5 text-[13px] text-[var(--text-secondary)] leading-[1.55]">
            {L('"그래서, 어떻게 됐어요?" — 그날 이 결정으로 돌아옵니다.', '"So, how did it go?" — this decision comes back to you that day.')}
          </p>

          {/* Peak-ownership conversion: the artifact was just minted on THIS device.
              For an anon user this is the one moment they have something worth keeping,
              so offer the durable path here — not as resignation copy, but as one tap.
              The contract is already in localStorage (updateProject above), so the
              full-page OAuth round-trip preserves it and auth.tsx runs
              migrateLocalToAccount on SIGNED_IN return — the just-sealed decision
              follows them into the account. Local seal stays lossless either way. */}
          {!user && (
            <button
              onClick={() => {
                track('seal_signin_cta', { placement: 'sealed' });
                signInWithGoogle('/workspace');
              }}
              className="mt-4 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-[13px] font-semibold text-white cursor-pointer transition-transform hover:scale-[1.02]"
              style={{ background: 'var(--gradient-gold)' }}
            >
              <Anchor size={14} />
              {L('로그인하고 어디서나 이어보기', 'Sign in to keep this everywhere')}
            </button>
          )}

          <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
            <LocaleLink href="/project" className="text-[12.5px] font-medium text-[var(--accent)] hover:underline">
              {L('프로젝트 페이지 보기 →', 'See the project page →')}
            </LocaleLink>
            <button
              onClick={downloadIcs}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12.5px] font-medium text-[var(--text-secondary)] border border-[var(--border)] hover:border-[var(--accent)]/40 hover:text-[var(--accent)] transition-colors cursor-pointer"
            >
              <CalendarPlus size={13} />
              {L('캘린더에 약속 넣기', 'Add to my calendar')}
            </button>
          </div>

          {/* Email return-path opt-in (P1-B2 / 03 S5): the seal moment is the ONE
              moment a user picks their way back, so the switch lives here in the
              same "돌아오는 길" bundle as the .ics button. Writes the existing
              decision_contract.email_reminder flag (jsonb-internal, checkin-due
              cron already gates on it) — the flag simply had no UI until now.
              Logged-in only: the cron mails the account address. Anonymous users
              keep the login CTA above as their durable path (§5-20: no new
              channel for anonymous sealers). */}
          {user && contract && (
            <label className="mt-3 inline-flex items-center justify-center gap-2 text-[12px] text-[var(--text-secondary)] cursor-pointer select-none">
              <input
                type="checkbox"
                checked={!!contract.email_reminder}
                onChange={(e) =>
                  updateProject(project.id, { decision_contract: { ...contract, email_reminder: e.target.checked } })
                }
                className="w-3.5 h-3.5 accent-[var(--accent)] cursor-pointer"
              />
              {user.email
                ? L(`그날 이메일로도 물어봐 주세요 (${user.email})`, `Ask me by email that day too (${user.email})`)
                : L('그날 이메일로도 물어봐 주세요', 'Ask me by email that day too')}
            </label>
          )}

          <button
            onClick={() => setDrawerOpen((o) => !o)}
            className="mt-4 inline-flex items-center gap-1 text-[12.5px] font-medium text-[var(--text-tertiary)] hover:text-[var(--accent)] transition-colors cursor-pointer"
          >
            {L('날짜·예측 손보기', 'Adjust date & predictions')}
            <ChevronDown size={13} className={`transition-transform ${drawerOpen ? 'rotate-180' : ''}`} />
          </button>

          <AnimatePresence>
            {drawerOpen && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.25, ease: EASE }}
                className="overflow-hidden"
              >
                <div className="pt-4 text-left">
                  {/* Selection-only — one control, one contract: the explicit
                      "이대로 다시 봉인" button below is the single commit point. */}
                  <DateChips interval={interval} onPick={setInterval} dateFor={dateFor} L={L} />
                  <div className="mt-4">
                    <PredicateEditor
                      predicates={Array.isArray(predicates) ? predicates : []}
                      dropped={dropped}
                      onToggle={(id) => {
                        setDropped((prev) => {
                          const next = new Set(prev);
                          if (next.has(id)) next.delete(id); else next.add(id);
                          return next;
                        });
                      }}
                      L={L}
                    />
                  </div>
                  {kept.length === 0 && (
                    <p className="mt-2 text-[11.5px] text-amber-600 dark:text-amber-400">
                      {L('최소 1개는 남겨야 물어볼 수 있어요.', 'Keep at least one so I have something to ask about.')}
                    </p>
                  )}
                  <button
                    onClick={() => seal()}
                    disabled={kept.length === 0}
                    className="mt-4 w-full py-2.5 rounded-xl text-[13px] font-semibold text-white disabled:opacity-50 cursor-pointer"
                    style={{ background: 'var(--gradient-gold)' }}
                  >
                    {L('이대로 다시 약속', 'Save the new promise')}
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </motion.div>
    ) : (
    // ════ ASK — the standalone closing question (the last interaction) ════
    <motion.div
      key="ask"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.985, transition: { duration: 0.22 } }}
      transition={{ duration: 0.6, ease: EASE }}
      className="mt-12"
    >
      {/* A divider that reads as a scene change — "one last thing". */}
      <div className="flex items-center gap-3 mb-8 text-[var(--text-tertiary)]/50">
        <div className="h-px flex-1 bg-[var(--border-subtle)]" />
        <span className="text-[11px] font-medium tracking-wide uppercase">{L('마지막으로', 'One last thing')}</span>
        <div className="h-px flex-1 bg-[var(--border-subtle)]" />
      </div>

      <div className="rounded-3xl border border-[var(--accent)]/30 bg-[var(--surface)] px-6 py-9 md:px-10 md:py-12 text-center">
        <div className="w-12 h-12 rounded-2xl mx-auto flex items-center justify-center bg-[var(--ai)] text-[var(--accent)]">
          <Anchor size={22} />
        </div>
        <h3 className="mt-5 text-[19px] md:text-[21px] font-bold text-[var(--text-primary)] leading-[1.4] max-w-md mx-auto">
          {L(
            `이 결정, ${dateFor(interval)}에 어떻게 됐는지 물어봐 드릴까요?`,
            `Want me to ask you on ${dateFor(interval)} how this decision turned out?`,
          )}
        </h3>
        <p className="mt-3 text-[13.5px] text-[var(--text-secondary)] leading-[1.6] max-w-md mx-auto">
          {L(
            '그날 이 결정으로 한 번 돌아와, 실제로 어떻게 됐는지 직접 확인하는 거예요. 판단의 고리를 닫는 일이죠.',
            "That day, you'll come back to this one decision and check, for yourself, how it actually went — closing the loop on your own call.",
          )}
        </p>
        {/* Channel disclosure BEFORE consent — a suspicious user won't say yes
            without knowing HOW the asking happens ("이메일? 스팸?").
            Promise parity (P1-B4): the guide FAQ ("'물어봐 준다'는 게 어떻게 오나요?",
            guide/page.tsx) mirrors this sentence — if channels change, update both. */}
        <p className="mt-2 text-[11.5px] text-[var(--text-tertiary)] max-w-md mx-auto">
          {L('그날 프로젝트 페이지에 오시면 제가 먼저 물어요. 텔레그램을 연결해 두셨다면, 그날 메시지로도 가볍게 알려드려요 — 광고성 메일은 보내지 않아요.', "On that day, I'll ask first when you open the projects page. If you've connected Telegram, I'll send a gentle nudge there too on the day — never marketing email.")}
        </p>
        {/* P2-6 honesty: an anonymous seal lives in localStorage only. Don't let the
            "comes back to you" promise read as a lie when it can vanish on this device.
            Not a gate — they can still seal locally; just told the truth + the way out. */}
        {!user && (
          <p className="mt-1.5 text-[11.5px] text-[var(--accent)]/90 max-w-md mx-auto">
            {L('지금은 로그인 전이라 이 결정은 이 기기에만 저장돼요 — 캐시를 지우거나 다른 기기에선 사라질 수 있어요. 봉인한 다음 로그인하면 계정으로 옮겨가 어디서나 돌아올 수 있어요.',
               'Not logged in yet, so this is saved on this device only — it can be lost if you clear your cache or switch devices. Seal it, then sign in and it moves to your account, reachable anywhere.')}
          </p>
        )}

        {/* Judgment Receipt — seal과 settle을 하나의 오브젝트로 묶는 진입점.
            사용자가 human_judgment를 작성하면 봉인 시 함께 저장된다. */}
        {kept.length > 0 && (() => {
          const rf = deriveReceiptFields(kept, typeof project.name === 'string' ? project.name : '');
          const check_by = dateFor(interval);
          return (rf.real_question || rf.unverified_assumption || rf.human_only) ? (
            <div className="mt-6 text-left">
              <JudgmentReceipt
                mode="seal"
                real_question={rf.real_question}
                unverified_assumption={rf.unverified_assumption}
                human_only={rf.human_only}
                check_by={check_by}
                humanJudgment={humanJudgment}
                onJudgmentChange={setHumanJudgment}
                locale={ko ? 'ko' : 'en'}
              />
            </div>
          ) : null;
        })()}

        <div className="mt-7 flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={() => seal()}
            disabled={kept.length === 0}
            className="inline-flex items-center justify-center gap-2 px-7 py-3 rounded-2xl text-white text-[14px] font-semibold disabled:opacity-50 cursor-pointer transition-transform duration-150 active:scale-[0.96]"
            style={{ background: 'var(--gradient-gold)' }}
          >
            <Check size={15} />
            {L(`네 — ${dateFor(interval)}에 물어봐 주세요`, `Yes — ask me on ${dateFor(interval)}`)}
          </button>
          <button
            onClick={() => {
              setDismissed(true);
              // A decline is as informative as an accept — the product learns
              // which decisions users don't want followed up.
              recordSignal({ project_id: project.id, tool: 'voyage', signal_type: 'seal_declined', signal_data: { predicates: kept.length } });
              track('decision_seal_declined', { predicates: kept.length });
            }}
            className="inline-flex items-center justify-center px-7 py-3 rounded-2xl text-[14px] font-medium text-[var(--text-secondary)] border border-[var(--border)] hover:border-[var(--text-secondary)]/40 cursor-pointer transition-colors"
          >
            {L('아니요, 괜찮아요', 'No, thanks')}
          </button>
        </div>

        {/* The editable drawer — auto draft is ready; this only refines it. */}
        <button
          onClick={() => setDrawerOpen((o) => !o)}
          className="mt-5 inline-flex items-center gap-1 text-[12px] font-medium text-[var(--text-tertiary)] hover:text-[var(--accent)] transition-colors cursor-pointer"
        >
          {L(`날짜 바꾸기 · 예측 ${kept.length}개 보기`, `Change date · review ${kept.length} prediction${kept.length === 1 ? '' : 's'}`)}
          <ChevronDown size={13} className={`transition-transform ${drawerOpen ? 'rotate-180' : ''}`} />
        </button>

        <AnimatePresence>
          {drawerOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.25, ease: EASE }}
              className="overflow-hidden"
            >
              <div className="pt-5 text-left max-w-md mx-auto">
                <DateChips interval={interval} onPick={setInterval} dateFor={dateFor} L={L} />
                <div className="mt-4">
                  <PredicateEditor
                    predicates={Array.isArray(predicates) ? predicates : []}
                    dropped={dropped}
                    onToggle={(id) => {
                      setDropped((prev) => {
                        const next = new Set(prev);
                        if (next.has(id)) next.delete(id); else next.add(id);
                        return next;
                      });
                    }}
                    L={L}
                  />
                </div>
                {kept.length === 0 && (
                  <p className="mt-2 text-[11.5px] text-amber-600 dark:text-amber-400">
                    {L('최소 1개는 남겨야 물어볼 수 있어요.', 'Keep at least one so I have something to ask about.')}
                  </p>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
    )}
    </AnimatePresence>
  );
}

function DateChips({
  interval,
  onPick,
  dateFor,
  L,
}: {
  interval: CheckInInterval;
  onPick: (iv: CheckInInterval) => void;
  dateFor: (iv: CheckInInterval) => string;
  L: (k: string, e: string) => string;
}) {
  return (
    <div>
      <p className="text-[12px] font-semibold text-[var(--text-secondary)] mb-2">
        {L('언제 물어볼까요?', 'When should I ask?')}
      </p>
      <div className="flex flex-wrap gap-2">
        {INTERVALS.map((iv) => (
          <button
            key={iv.value}
            onClick={() => onPick(iv.value)}
            className={`px-3 py-1.5 rounded-lg text-[12.5px] font-medium border transition-colors cursor-pointer ${
              interval === iv.value
                ? 'border-[var(--accent)] bg-[var(--ai)] text-[var(--accent)]'
                : 'border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--text-secondary)]/40'
            }`}
          >
            {L(iv.ko, iv.en)} · {dateFor(iv.value)}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Read + trim the auto-derived predictions. Surface language stays plain —
 *  "물어볼 것들" (the things I'll ask about), never 내기/predicate. */
function PredicateEditor({
  predicates,
  dropped,
  onToggle,
  L,
}: {
  predicates: Predicate[];
  dropped: Set<string>;
  onToggle: (id: string) => void;
  L: (k: string, e: string) => string;
}) {
  if (predicates.length === 0) return null;
  return (
    <div>
      <p className="text-[12px] font-semibold text-[var(--text-secondary)] mb-2">
        {L('그날 물어볼 것들', "What I'll ask you about")}
      </p>
      <ul className="space-y-1.5">
        {predicates.map((p) => {
          const Icon = SOURCE_ICON[p.source] ?? AlertTriangle;
          const off = dropped.has(p.id);
          return (
            <li key={p.id}>
              <button
                onClick={() => onToggle(p.id)}
                className={`w-full flex items-start gap-2 text-left rounded-lg border px-3 py-2.5 min-h-[44px] transition-colors cursor-pointer ${
                  off
                    ? 'border-[var(--border)] opacity-45 line-through'
                    : 'border-[var(--border)] hover:border-[var(--accent)]/40'
                }`}
              >
                <Icon size={13} className="text-[var(--text-tertiary)] mt-0.5 shrink-0" />
                <span className="flex-1 min-w-0 text-[12.5px] text-[var(--text-primary)] leading-[1.5]">{p.text}</span>
                <span className="text-[10.5px] text-[var(--text-tertiary)] shrink-0 mt-0.5">
                  {off ? L('뺌', 'off') : L('뺄까요?', 'remove?')}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
