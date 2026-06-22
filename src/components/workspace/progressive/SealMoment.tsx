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

import { useMemo, useState } from 'react';
import { LocaleLink } from '@/components/ui/LocaleLink';
import { motion, AnimatePresence } from 'framer-motion';
import { Anchor, CalendarPlus, Check, ChevronDown, Target, AlertTriangle, GitBranch } from 'lucide-react';
import { useLocale } from '@/hooks/useLocale';
import { useProjectStore } from '@/stores/useProjectStore';
import type { Project, Predicate, PredicateSource, CheckInInterval } from '@/stores/types';
import { contractFromPredicates, withCheckIn, CHECK_IN_MS } from '@/lib/decision-contract';
import { recordSignal } from '@/lib/signal-recorder';
import { DecisionContractCard } from '@/components/projects/DecisionContractCard';
import { EASE } from './shared/constants';

const SOURCE_ICON: Record<PredicateSource, typeof Target> = {
  governing_idea: Target,
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
}: {
  project: Project;
  /** Falsifiable predictions derived from this voyage (live path). */
  predicates: Predicate[];
}) {
  const locale = useLocale();
  const ko = locale === 'ko';
  const L = (k: string, e: string) => (ko ? k : e);
  const updateProject = useProjectStore((s) => s.updateProject);

  const [interval, setInterval] = useState<CheckInInterval>(DEFAULT_INTERVAL);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [dropped, setDropped] = useState<Set<string>>(new Set());
  // Tracks a seal performed in THIS session, so we show the calm confirmation
  // here instead of falling through to the grading card on the same render.
  const [justSealed, setJustSealed] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  // Defensive: legacy sessions may carry a malformed contract.
  const contract = project?.decision_contract ?? null;

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
    const fresh = contractFromPredicates(project.id, kept, now);
    if (!fresh) return;
    updateProject(project.id, { decision_contract: withCheckIn(fresh, iv, now) });
    setInterval(iv);
    setJustSealed(true);
    // Learning signal (2026-06-13 data-wiring fix) — the new flow recorded
    // nothing. Accepting the seal is the strongest engagement signal the
    // product has. Not already sealed → only count the first seal.
    if (!justSealed) {
      recordSignal({ project_id: project.id, tool: 'voyage', signal_type: 'seal_accepted', signal_data: { interval: iv, predicates: kept.length } });
    }
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
  if (contract && !justSealed) {
    return <DecisionContractCard project={project} livePredicates={predicates} />;
  }

  // Nothing falsifiable → silence is the output (P3).
  if ((Array.isArray(predicates) ? predicates.length : 0) === 0) return null;

  // ════ SEALED — the calm confirmation, with an optional edit drawer ════
  if (justSealed) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: EASE }}
        className="mt-10 rounded-3xl border border-[var(--accent)]/30 bg-[var(--surface)] p-6 md:p-8 text-center"
      >
        <div className="w-11 h-11 rounded-2xl mx-auto flex items-center justify-center" style={{ background: 'var(--gradient-gold)' }}>
          <Anchor size={20} className="text-white" />
        </div>
        <p className="mt-4 text-[16px] font-semibold text-[var(--text-primary)] leading-[1.5]">
          {L(
            `좋아요. ${sealedAtMs ? fmtDate(sealedAtMs) : dateFor(interval)}에 물어볼게요 — 프로젝트 페이지에 오시면 제가 먼저 물어요.`,
            `Done. I'll ask on ${sealedAtMs ? fmtDate(sealedAtMs) : dateFor(interval)} — come to the project page and I'll bring it up first.`,
          )}
        </p>
        <p className="mt-1.5 text-[13px] text-[var(--text-secondary)] leading-[1.55]">
          {L('"그래서, 어떻게 됐어요?" — 그날 이 결정으로 돌아옵니다.', '"So, how did it go?" — this decision comes back to you that day.')}
        </p>

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

  // ════ ASK — the standalone closing question (the last interaction) ════
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
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
            without knowing HOW the asking happens ("이메일? 스팸?"). */}
        <p className="mt-2 text-[11.5px] text-[var(--text-tertiary)] max-w-md mx-auto">
          {L('그날 프로젝트 페이지에 오시면 제가 먼저 물어요 — 메일이나 알림은 보내지 않아요.', "On that day, I'll ask first when you open the projects page — no emails, no notifications.")}
        </p>

        <div className="mt-7 flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={() => seal()}
            disabled={kept.length === 0}
            className="inline-flex items-center justify-center gap-2 px-7 py-3 rounded-2xl text-white text-[14px] font-semibold disabled:opacity-50 cursor-pointer"
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
                className={`w-full flex items-start gap-2 text-left rounded-lg border px-3 py-2 transition-colors cursor-pointer ${
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
