'use client';

/**
 * LightFlow (가벼운 길) — the conversational surface for everyday decisions.
 *
 * Screen grammar: the CENTER holds only the current thing (mirror + question,
 * OR the permission ask, OR the escalation, OR the close line). BELOW it, the
 * prior Q&A accumulates as a simple stacked, collapsible record — an
 * accumulating record, never a step rail. Input is free text only ("한 줄이면
 * 돼요"); NO generated option buttons exist anywhere on this surface (anti-술
 * invariant), and NO emoji — presence is the Argus mascot, motion is its
 * breathing (stilled under prefers-reduced-motion).
 *
 * Typographic idiom (borrowed from AnalysisCard / voyage-prep): ONE serif
 * display headline per screen — the question owns it. The mirror reads as warm
 * secondary voice above it; the user's own words sit in tinted bubbles; gold
 * appears only as the small hairline accent, the offer rim, and the primary
 * action. Never a left accent bar, never a big gold fill.
 *
 * Ending is symmetric: the 남기기 moment asks PERMISSION TO RETURN (one flowing
 * sentence continuing the mirror — never a sentence to approve), and accepting
 * records through the EXISTING decision-contract machinery (projects store →
 * decision_contract → the same return loop as every seal). Declining closes in
 * one line and never re-asks. Declining is also completion.
 */

import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { ArrowRight, ChevronDown } from 'lucide-react';
import { useLocale } from '@/hooks/useLocale';
import { Button } from '@/components/ui/Button';
import { ArgusMascot } from '@/components/brand/ArgusMascot';
import { track } from '@/lib/analytics';
import { useProjectStore } from '@/stores/useProjectStore';
import {
  runLightNext,
  composeDeepenText,
  buildLightSealContract,
  lightWhenLabel,
  firstThoughtFromQas,
  type LightOffer,
  type LightQA,
  type LightWhen,
} from '@/lib/light-path/light-engine';

const EASE = [0.22, 1, 0.36, 1] as const;
const MAX_ANSWER = 500;
const MAX_SENTENCE = 200;

export type LightDeepenReason = 'escalate' | 'deepen_link' | 'crisis';

export interface LightDeepenContext {
  /** problemText + the light Q&A, composed for the heavy flow. */
  text: string;
  qas: LightQA[];
  reason: LightDeepenReason;
}

type Screen =
  | { kind: 'turn'; mirror: string; question: string }
  | { kind: 'offer'; mirror: string; offer: LightOffer }
  | { kind: 'escalate'; mirror: string; biggerQuestion: string }
  | {
      kind: 'closed';
      variant: 'accepted' | 'declined';
      sentence?: string;
      checkLabel?: string;
      firstThought?: string;
      /** Kept for the after-accept receipt edit (고쳐도 돼요) — the stored
       *  contract is updated in place, identity and schedule preserved. */
      pid?: string;
      when?: LightWhen;
      days?: number;
      /** The sealed contract's exact check date — the keepsake sets it in
       *  tabular numerals. */
      checkInAt?: string;
    };

/** The keepsake's date line — the one concrete number on the card. */
function formatCheckDate(iso: string | undefined, locale: 'ko' | 'en'): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString(locale === 'ko' ? 'ko-KR' : 'en-US', {
    month: 'long',
    day: 'numeric',
    weekday: 'short',
    hour: 'numeric',
    minute: '2-digit',
  });
}

/** The small gold hairline — the workspace's established accent motif
 *  (AnalysisCard peek). Gold stays an accent, never a fill. */
function GoldHairline() {
  return (
    <div className="mt-4 mb-2 flex items-center gap-2" aria-hidden>
      <span className="h-px w-7 bg-[var(--accent)]/60" />
      <span className="size-1 rounded-full bg-[var(--accent)]/75" />
    </div>
  );
}

export function LightFlow({
  problemText,
  opening,
  onDeepen,
  onClose,
}: {
  problemText: string;
  /** The first beat — returned by the SAME gate call that routed here. */
  opening: { mirror: string; question: string };
  /** Hand off to the existing heavy flow (escalation accept / deepen link / crisis). */
  onDeepen: (ctx: LightDeepenContext) => void;
  /** Clean end of the light session — parent returns to the idle input. */
  onClose: () => void;
}) {
  const locale = useLocale();
  const ko = locale === 'ko';
  const L = (k: string, e: string) => (ko ? k : e);
  // One quiet fade-up per element — never faked typing. Stilled entirely when
  // the user prefers reduced motion.
  const reduced = useReducedMotion();
  const fadeUp = (delay = 0) =>
    reduced
      ? {}
      : {
          initial: { opacity: 0, y: 5 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.45, ease: EASE, delay },
        };

  const [qas, setQas] = useState<LightQA[]>([]);
  const [screen, setScreen] = useState<Screen>({ kind: 'turn', mirror: opening.mirror, question: opening.question });
  const [input, setInput] = useState('');
  // After-accept receipt edit (고쳐도 돼요) — the only place the sentence is edited.
  const [editingReceipt, setEditingReceipt] = useState(false);
  const [receiptEdit, setReceiptEdit] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [recordOpen, setRecordOpen] = useState(true);
  const abortRef = useRef<AbortController | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => () => abortRef.current?.abort(), []);

  const deepen = (reason: LightDeepenReason, qasNow: LightQA[] = qas) => {
    abortRef.current?.abort();
    onDeepen({ text: composeDeepenText(problemText, qasNow, locale), qas: qasNow, reason });
  };

  const submitAnswer = async () => {
    if (busy || screen.kind !== 'turn') return;
    const answer = input.trim();
    if (!answer) return;
    const prevQas = qas;
    const nextQas = [...qas, { question: screen.question, answer }];
    setQas(nextQas);
    setInput('');
    setErr(null);
    setBusy(true);
    track('light_question_answered', { round: nextQas.length });
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const turn = await runLightNext(problemText, nextQas, locale, controller.signal);
      if (controller.signal.aborted) return;
      if (turn.crisis) {
        // Deterministic crisis gate fired on this answer — stop the light flow;
        // the existing crisis surface (heavy path) owns it from here.
        deepen('crisis', nextQas);
        return;
      }
      if (turn.action === 'ask' && turn.question) {
        setScreen({ kind: 'turn', mirror: turn.mirror, question: turn.question });
      } else if (turn.action === 'offer' && turn.offer) {
        setScreen({ kind: 'offer', mirror: turn.mirror, offer: turn.offer });
        track('light_seal_offered');
      } else if (turn.action === 'escalate' && turn.escalate) {
        setScreen({ kind: 'escalate', mirror: turn.mirror, biggerQuestion: turn.escalate.bigger_question });
        track('light_escalation_offered');
      } else {
        // Plain close — the engine had nothing honest to ask or leave behind.
        setScreen({ kind: 'closed', variant: 'declined' });
      }
    } catch {
      if (controller.signal.aborted) return;
      // Honest recovery: roll the answer back into the input so a retry re-sends it.
      setQas(prevQas);
      setInput(answer);
      setErr(L('잠깐 연결이 매끄럽지 않았어요. 한 번만 다시 보내주세요.', 'The connection hiccuped for a moment. Please send that once more.'));
    } finally {
      setBusy(false);
    }
  };

  // 첫 생각 — the first answer of this session, verbatim (내 말). Kept in the seal
  // and shown on the after-accept receipt so the return can compare
  // 처음 생각 → 남긴 판단 → 현실.
  const firstThought = firstThoughtFromQas(qas);

  // Accepting is PERMISSION TO RETURN — the sentence (offer.sentence) seals as
  // the machine's wording (honest ai_surfaced provenance) and only appears on
  // the receipt afterwards, where 고쳐도 돼요 can still make it the user's own.
  const acceptOffer = async () => {
    if (busy || screen.kind !== 'offer') return;
    const sentence = screen.offer.sentence.trim();
    if (!sentence) return;
    setBusy(true);
    setErr(null);
    try {
      const now = Date.now();
      // Durable identity first (fails soft to local-only), same as the heavy path.
      try {
        const { ensureUserId } = await import('@/lib/supabase');
        await ensureUserId();
      } catch { /* local-only is fine — localStorage-first */ }
      const store = useProjectStore.getState();
      const normalized = problemText.replace(/\s+/g, ' ').trim();
      const title = normalized.length > 72 ? `${normalized.slice(0, 69).trimEnd()}…` : normalized;
      const pid = store.createProject(title || sentence);
      const contract = buildLightSealContract(
        pid,
        { sentence, edited: false, when: screen.offer.when, days: screen.offer.days, problemText, firstThought },
        now,
      );
      if (contract) store.updateProject(pid, { decision_contract: contract });
      // Stay on the light close screen: createProject selects the new project,
      // which would swap the whole workspace out from under this surface.
      store.setCurrentProjectId(null);
      track('light_seal_accepted', { edited: false });
      setScreen({
        kind: 'closed',
        variant: 'accepted',
        sentence,
        checkLabel: lightWhenLabel(screen.offer.when, screen.offer.days, locale),
        firstThought,
        pid,
        when: screen.offer.when,
        days: screen.offer.days,
        checkInAt: contract?.check_in_at,
      });
    } finally {
      setBusy(false);
    }
  };

  const declineOffer = () => {
    if (screen.kind !== 'offer') return;
    track('light_seal_declined');
    setScreen({ kind: 'closed', variant: 'declined' });
  };

  // 고쳐도 돼요 — editing AFTER accept updates the stored contract in place and
  // flips authorship to the user (user_reworded), exactly like the pre-revision
  // edit path. Identity (id/created_at), the seal stamp, and the promised
  // check date are preserved — only the wording and its provenance change.
  const saveReceiptEdit = () => {
    if (screen.kind !== 'closed' || screen.variant !== 'accepted' || !screen.pid || !screen.when) return;
    const next = receiptEdit.trim();
    if (!next) return;
    setEditingReceipt(false);
    if (next === (screen.sentence || '').trim()) return; // unchanged — nothing to rewrite
    const store = useProjectStore.getState();
    const existing = store.getProject(screen.pid)?.decision_contract;
    const rebuilt = buildLightSealContract(
      screen.pid,
      { sentence: next, edited: true, when: screen.when, days: screen.days, problemText, firstThought: screen.firstThought },
      Date.now(),
    );
    if (!rebuilt) return;
    const contract = existing
      ? {
          ...rebuilt,
          id: existing.id,
          created_at: existing.created_at,
          closed_at: existing.closed_at ?? rebuilt.closed_at,
          check_in_at: existing.check_in_at ?? rebuilt.check_in_at,
        }
      : rebuilt;
    store.updateProject(screen.pid, { decision_contract: contract });
    setScreen({ ...screen, sentence: next });
  };

  /** 비추기 — warm secondary voice ABOVE the screen's one serif headline.
   *  One quiet fade-up (the engine call doesn't stream; we never fake typing). */
  const mirrorBlock = (mirror: string) =>
    mirror ? (
      <motion.p
        {...fadeUp(0)}
        className="text-[13.5px] md:text-[14px] text-[var(--text-secondary)] leading-[1.7] whitespace-pre-wrap break-words"
      >
        {mirror}
      </motion.p>
    ) : null;

  // Quiet links keep their visual size but carry a ≥44px hit area (mobile tap
  // audit: they measured 20–33px).
  const deepenLink = (
    <button
      type="button"
      onClick={() => { track('light_deepen_clicked'); deepen('deepen_link'); }}
      className="inline-flex min-h-11 items-center px-2 -mx-2 text-[12px] text-[var(--text-tertiary)] underline underline-offset-2 hover:text-[var(--text-secondary)] transition-colors cursor-pointer"
    >
      {L('더 깊이 보기', 'Look deeper')}
    </button>
  );

  // In-flow thinking state — the mascot keeps quiet watch (canon state
  // `watching`: a task underway; its breathing is the only motion and
  // prefers-reduced-motion stills it). Never an emoji or a spinner.
  const busyRow = (
    <span className="flex items-center gap-2 text-[12.5px] text-[var(--text-tertiary)]" aria-live="polite">
      <ArgusMascot moment="watching" size="sm" plate={false} alt="" className="!h-8 !w-auto opacity-90" />
      {L('읽고 있어요', 'Reading')}
    </span>
  );

  return (
    <div className="mx-auto w-full max-w-xl">
      {/* Source record echo — the user's own words, in their tinted bubble. */}
      <div className="mb-6 flex items-center gap-3 px-5 py-3 rounded-full bg-[var(--accent)]/[0.05] border border-[var(--accent)]/15 w-fit max-w-full">
        <div className="w-5 h-5 rounded-full bg-[var(--text-primary)] flex items-center justify-center shrink-0">
          <span className="text-[var(--bg)] text-[12.5px] font-bold">{L('나', 'Me')}</span>
        </div>
        <p className="text-[13px] text-[var(--text-secondary)] truncate">{problemText}</p>
      </div>

      {/* ── CENTER: the current thing only ── */}
      <AnimatePresence mode="wait" initial={false}>
        {screen.kind === 'turn' && (
          <motion.div
            key={`turn-${qas.length}`}
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.3, ease: EASE }}
            className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-sm)] p-5 md:p-7"
          >
            {mirrorBlock(screen.mirror)}
            {screen.mirror ? <GoldHairline /> : null}
            {/* THE question — this screen's one serif headline. */}
            <motion.h2
              {...fadeUp(0.08)}
              className="text-[18px] md:text-[21px] font-bold text-[var(--text-primary)] leading-[1.4] tracking-tight whitespace-pre-wrap break-keep break-words"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              {screen.question}
            </motion.h2>

            {/* Free-text answer only — the user's own words, never tap options. */}
            <div className="mt-5">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void submitAnswer(); } }}
                placeholder={L('한 줄이면 돼요', 'One line is enough')}
                rows={2}
                maxLength={MAX_ANSWER}
                disabled={busy}
                aria-label={L('내 답', 'My answer')}
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg)]/70 px-3.5 py-2.5 text-base md:text-[15px] leading-[1.6] text-[var(--text-primary)] resize-none focus:outline-none focus:border-[var(--accent)]/55 focus:shadow-[var(--shadow-sm)] placeholder:text-[var(--text-tertiary)] transition-all"
              />
              <div className="mt-2.5 flex items-center justify-between gap-3">
                {busy ? busyRow : deepenLink}
                <Button
                  variant="accent"
                  size="sm"
                  onClick={() => void submitAnswer()}
                  disabled={busy || !input.trim()}
                  className="shrink-0"
                >
                  {L('보내기', 'Send')} <ArrowRight size={12} />
                </Button>
              </div>
              {err && (
                <p role="alert" className="mt-2 rounded-lg bg-[var(--danger)]/5 border border-[var(--danger)]/25 px-3 py-2 text-[12.5px] text-[var(--text-primary)]">
                  {err}
                </p>
              )}
            </div>
          </motion.div>
        )}

        {screen.kind === 'offer' && (
          <motion.div
            key="offer"
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.3, ease: EASE }}
            className="rounded-2xl p-[1.5px] bg-gradient-to-b from-[var(--accent)]/35 via-[var(--accent)]/12 to-transparent shadow-[var(--shadow-md)]"
          >
            {/* The 남기기 moment wears the workspace's hairline-gradient chrome —
                gold as a rim, never a fill. */}
            <div className="rounded-[calc(1rem-1.5px)] bg-[var(--surface)] p-5 md:p-7">
              {mirrorBlock(screen.mirror)}
              {screen.mirror ? <GoldHairline /> : null}
              {/* Permission to return — ONE flowing sentence continuing the
                  mirror, and this screen's serif headline. The falsifiable line
                  (offer.sentence) is deliberately NOT shown here; it appears on
                  the receipt only after the user says yes. Fallback composes
                  mechanically from the when label (known slots only — never
                  invented content). */}
              <motion.h2
                {...fadeUp(0.08)}
                className="text-[17px] md:text-[19px] font-bold text-[var(--text-primary)] leading-[1.5] tracking-tight whitespace-pre-wrap break-keep break-words"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                {screen.offer.ask || L(
                  `${lightWhenLabel(screen.offer.when, screen.offer.days, locale)}에 제가 한 번만 물어볼까요?`,
                  `Want me to ask you just once, ${lightWhenLabel(screen.offer.when, screen.offer.days, locale)}?`,
                )}
              </motion.h2>
              <div className="mt-5 flex flex-col sm:flex-row sm:items-center gap-2">
                <Button variant="accent" size="md" onClick={() => void acceptOffer()} disabled={busy}>
                  {L(
                    `${lightWhenLabel(screen.offer.when, screen.offer.days, locale)}에 물어봐 주세요`,
                    `Ask me ${lightWhenLabel(screen.offer.when, screen.offer.days, locale)}`,
                  )}
                </Button>
                <Button variant="ghost" size="md" onClick={declineOffer} disabled={busy}>
                  {L('괜찮아요, 그냥 갈게요', "I'm okay, I'll just go")}
                </Button>
              </div>
              <div className="mt-4">{deepenLink}</div>
            </div>
          </motion.div>
        )}

        {screen.kind === 'escalate' && (
          <motion.div
            key="escalate"
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.3, ease: EASE }}
            className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-sm)] p-5 md:p-7"
          >
            {mirrorBlock(screen.mirror)}
            {screen.mirror ? <GoldHairline /> : null}
            {/* This screen's serif headline is the recognition itself. */}
            <motion.h2
              {...fadeUp(0.08)}
              className="text-[17px] md:text-[19px] font-bold text-[var(--text-primary)] leading-[1.45] tracking-tight break-keep break-words"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              {L('오늘 것 하나가 아니라, 더 큰 얘기네요.', "This isn't just today's call. It's a bigger story.")}
            </motion.h2>
            <div className="mt-3 rounded-lg bg-[var(--accent)]/[0.04] px-4 py-3">
              <p className="text-[14px] md:text-[14.5px] leading-[1.65] text-[var(--text-primary)] font-medium whitespace-pre-wrap break-words">
                {screen.biggerQuestion}
              </p>
            </div>
            <div className="mt-5 flex flex-col sm:flex-row sm:items-center gap-2">
              <Button
                variant="accent"
                size="md"
                onClick={() => { track('light_escalation_accepted'); deepen('escalate'); }}
              >
                {L('지금 조금 더 볼래요', 'Look a bit further now')}
              </Button>
              <Button
                variant="ghost"
                size="md"
                onClick={() => setScreen({ kind: 'closed', variant: 'declined' })}
              >
                {L('다음에 볼래요', 'Another time')}
              </Button>
            </div>
          </motion.div>
        )}

        {screen.kind === 'closed' && (
          <motion.div
            key="closed"
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.3, ease: EASE }}
            className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-sm)] p-5 md:p-7"
          >
            {screen.variant === 'accepted' ? (
              <>
                {/* The close line — this screen's serif headline. */}
                <motion.h2
                  {...fadeUp(0)}
                  className="text-[16px] md:text-[18px] font-bold text-[var(--text-primary)] leading-[1.5] tracking-tight break-keep break-words"
                  style={{ fontFamily: 'var(--font-display)' }}
                >
                  {ko
                    ? `기억해 뒀어요. ${screen.checkLabel}에 한 번만 물어볼게요.`
                    : `I'll remember this. I'll ask just once, ${screen.checkLabel}.`}
                </motion.h2>
                {/* ── THE KEEPSAKE — the one signature moment of the light path.
                    A small pressed card: the mascot's quiet mark, the remembered
                    sentence in the record's serif voice, the check date in
                    tabular numerals. One orchestrated, barely-there reveal
                    (stilled under prefers-reduced-motion). The first thought
                    stays on the card, and 고쳐도 돼요 keeps the line correctable
                    (editing flips authorship to the user in the stored record). */}
                {screen.sentence && (
                  <div className="mt-5 rounded-2xl p-[1.5px] bg-gradient-to-b from-[var(--accent)]/30 via-[var(--accent)]/10 to-transparent shadow-[var(--shadow-md)]">
                    <div className="rounded-[calc(1rem-1.5px)] bg-[var(--surface)] px-6 py-7 md:px-9 md:py-9 text-center">
                      <motion.div {...fadeUp(0.1)} className="flex justify-center">
                        {/* Fine mark — the dog, still and near-monochrome, a
                            letterpress stamp rather than a character. */}
                        <ArgusMascot
                          moment="witness"
                          size="sm"
                          plate={false}
                          motion="still"
                          alt=""
                          className="!h-10 !w-auto"
                          style={{ filter: 'grayscale(1) sepia(0.35)', opacity: 0.5 }}
                        />
                      </motion.div>
                      {screen.firstThought && (
                        <motion.p
                          {...fadeUp(0.22)}
                          className="mt-4 text-[12.5px] leading-[1.6] text-[var(--text-secondary)] break-words"
                        >
                          {L('처음 생각', 'First thought')} · {screen.firstThought}
                        </motion.p>
                      )}
                      {editingReceipt ? (
                        <div className="mt-3">
                          <textarea
                            value={receiptEdit}
                            onChange={(e) => setReceiptEdit(e.target.value)}
                            rows={2}
                            maxLength={MAX_SENTENCE}
                            autoFocus
                            aria-label={L('기억해 둘 한 줄', 'The line to remember')}
                            className="w-full bg-transparent text-center text-base md:text-[16px] leading-[1.65] text-[var(--text-primary)] resize-none focus:outline-none"
                            style={{ fontFamily: 'var(--font-voice, serif)' }}
                          />
                          <div className="mt-2 flex justify-center">
                            <Button variant="secondary" size="sm" onClick={saveReceiptEdit} disabled={!receiptEdit.trim()}>
                              {L('저장', 'Save')}
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <motion.div {...fadeUp(0.32)} className="mt-3">
                          <p className="text-[12.5px] text-[var(--text-tertiary)] break-keep">
                            {L('이렇게 기억해 둘게요 —', "Here's how I'll remember it —")}
                          </p>
                          <p
                            className="mt-2 text-[17px] md:text-[19px] leading-[1.6] text-[var(--text-primary)] break-keep break-words"
                            style={{ fontFamily: 'var(--font-voice, serif)' }}
                          >
                            {screen.sentence}
                          </p>
                        </motion.div>
                      )}
                      <motion.div {...fadeUp(0.48)}>
                        <div className="mx-auto mt-5 h-px w-12 bg-[var(--accent)]/30" aria-hidden />
                        {formatCheckDate(screen.checkInAt, locale) && (
                          <p className="mt-3 text-[12.5px] text-[var(--text-secondary)] tabular-nums">
                            {L('확인', 'Check')} · {formatCheckDate(screen.checkInAt, locale)}
                          </p>
                        )}
                        {!editingReceipt && (
                          <button
                            type="button"
                            onClick={() => { setReceiptEdit(screen.sentence || ''); setEditingReceipt(true); }}
                            className="mt-1 inline-flex min-h-11 items-center px-3 -mb-2 text-[12px] text-[var(--text-tertiary)] underline underline-offset-2 hover:text-[var(--text-secondary)] transition-colors cursor-pointer"
                          >
                            {L('고쳐도 돼요', 'You can fix it')}
                          </button>
                        )}
                      </motion.div>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <p
                className="text-[15px] md:text-[16px] leading-[1.65] text-[var(--text-primary)] break-keep break-words"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                {L('네, 여기까지도 충분해요. 필요하면 언제든요.', "That's plenty for today. I'm here whenever you need.")}
              </p>
            )}
            <div className="mt-5">
              <Button variant="secondary" size="sm" onClick={onClose}>
                {L('처음으로', 'Back to start')}
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── BELOW: the accumulating record (stacked, collapsible — never a step
             rail). The user's prior words live in tinted bubbles. ── */}
      {qas.length > 0 && (
        <div className="mt-7">
          <button
            type="button"
            onClick={() => setRecordOpen((o) => !o)}
            aria-expanded={recordOpen}
            className="flex min-h-11 items-center gap-1.5 px-1 text-[12.5px] font-medium text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors cursor-pointer"
          >
            <ChevronDown size={13} className={`transition-transform ${recordOpen ? '' : '-rotate-90'}`} />
            {L(`지금까지 나눈 이야기 ${qas.length}개`, `${qas.length} exchange${qas.length === 1 ? '' : 's'} so far`)}
          </button>
          {recordOpen && (
            <div className="mt-1.5 space-y-3 px-1">
              {qas.map((qa, i) => (
                <div key={i}>
                  <p className="px-1 text-[12px] leading-snug text-[var(--text-tertiary)] break-words">{qa.question}</p>
                  <div className="mt-1 rounded-xl bg-[var(--accent)]/[0.05] px-3.5 py-2.5">
                    <p className="text-[13.5px] leading-[1.6] text-[var(--text-primary)] break-words">{qa.answer}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
