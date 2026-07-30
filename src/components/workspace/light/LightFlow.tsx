'use client';

/**
 * LightFlow (가벼운 길) — the conversational surface for everyday decisions.
 *
 * Screen grammar: the CENTER holds only the current thing (mirror + question,
 * OR the offer, OR the escalation, OR the close line). BELOW it, the prior Q&A
 * accumulates as a simple stacked, collapsible record — an accumulating record,
 * never a step rail. Input is free text only ("한 줄이면 돼요"); NO generated
 * option buttons exist anywhere on this surface (anti-술 invariant).
 *
 * Ending is symmetric: 걸어둘게요 records through the EXISTING decision-contract
 * machinery (projects store → decision_contract → the same return loop as every
 * seal); 그냥 갈래요 closes in one line and never re-asks. Declining is also
 * completion.
 */

import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, ChevronDown, Sparkles } from 'lucide-react';
import { useLocale } from '@/hooks/useLocale';
import { Button } from '@/components/ui/Button';
import { track } from '@/lib/analytics';
import { useProjectStore } from '@/stores/useProjectStore';
import {
  runLightNext,
  composeDeepenText,
  buildLightSealContract,
  lightWhenLabel,
  type LightOffer,
  type LightQA,
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
  | { kind: 'closed'; variant: 'accepted' | 'declined'; sentence?: string; checkLabel?: string };

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

  const [qas, setQas] = useState<LightQA[]>([]);
  const [screen, setScreen] = useState<Screen>({ kind: 'turn', mirror: opening.mirror, question: opening.question });
  const [input, setInput] = useState('');
  const [offerText, setOfferText] = useState('');
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
        setOfferText(turn.offer.sentence);
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

  const acceptOffer = async () => {
    if (busy || screen.kind !== 'offer') return;
    const sentence = offerText.trim();
    if (!sentence) return;
    const edited = sentence !== screen.offer.sentence.trim();
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
        { sentence, edited, when: screen.offer.when, days: screen.offer.days, problemText },
        now,
      );
      if (contract) store.updateProject(pid, { decision_contract: contract });
      // Stay on the light close screen: createProject selects the new project,
      // which would swap the whole workspace out from under this surface.
      store.setCurrentProjectId(null);
      track('light_seal_accepted', { edited });
      setScreen({
        kind: 'closed',
        variant: 'accepted',
        sentence,
        checkLabel: lightWhenLabel(screen.offer.when, screen.offer.days, locale),
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

  const mirrorBlock = (mirror: string) =>
    mirror ? (
      <p
        className="text-[16px] md:text-[17px] leading-[1.6] text-[var(--text-primary)] whitespace-pre-wrap break-words"
        style={{ fontFamily: 'var(--font-display)' }}
      >
        {mirror}
      </p>
    ) : null;

  const deepenLink = (
    <button
      type="button"
      onClick={() => { track('light_deepen_clicked'); deepen('deepen_link'); }}
      className="text-[12px] text-[var(--text-tertiary)] underline underline-offset-2 hover:text-[var(--text-secondary)] transition-colors cursor-pointer"
    >
      {L('더 깊이 보기', 'Look deeper')}
    </button>
  );

  return (
    <div className="mx-auto w-full max-w-xl">
      {/* Source record echo — small, muted, orienting. */}
      <div className="mb-6 flex items-center gap-3 px-5 py-3 rounded-full bg-[var(--bg)] border border-[var(--border-subtle)] w-fit max-w-full">
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
            className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 md:p-6"
          >
            {mirrorBlock(screen.mirror)}
            <div className="mt-3 rounded-lg bg-[var(--accent)]/[0.04] px-4 py-3">
              <p className="text-[14.5px] leading-[1.6] text-[var(--text-primary)] font-medium whitespace-pre-wrap break-words">
                {screen.question}
              </p>
            </div>

            {/* Free-text answer only — the user's own words, never tap options. */}
            <div className="mt-4">
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
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3.5 py-2.5 text-base md:text-[15px] leading-[1.6] text-[var(--text-primary)] resize-none focus:outline-none focus:border-[var(--accent)]/55 placeholder:text-[var(--text-tertiary)] transition-colors"
              />
              <div className="mt-2 flex items-center justify-between gap-3">
                {busy ? (
                  <span className="flex items-center gap-2 text-[12.5px] text-[var(--text-tertiary)]" aria-live="polite">
                    <motion.span animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: 'linear' }} className="inline-flex">
                      <Sparkles size={13} className="text-[var(--accent)]" />
                    </motion.span>
                    {L('읽고 있어요', 'Reading')}
                  </span>
                ) : deepenLink}
                <Button
                  variant="secondary"
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
            className="rounded-2xl border border-[var(--accent)]/25 bg-[var(--surface)] p-5 md:p-6"
          >
            {mirrorBlock(screen.mirror)}
            <p className="mt-4 mb-1.5 text-[12.5px] font-semibold text-[var(--text-secondary)]">
              {L('한 줄 걸어두고 갈래요?', 'Want to leave one line to check later?')}
            </p>
            {/* The sentence is EDITABLE — rewriting makes it user-authored;
                keeping it as-is records the AI wording origin honestly. */}
            <div className="rounded-lg bg-[var(--accent)]/[0.04] px-4 py-3">
              <textarea
                value={offerText}
                onChange={(e) => setOfferText(e.target.value)}
                rows={2}
                maxLength={MAX_SENTENCE}
                disabled={busy}
                aria-label={L('걸어둘 한 줄', 'The line to leave')}
                className="w-full bg-transparent text-base md:text-[15.5px] leading-[1.6] text-[var(--text-primary)] font-medium resize-none focus:outline-none"
              />
            </div>
            <p className="mt-2 text-[12.5px] text-[var(--text-tertiary)]">
              {L(`확인 시점: ${lightWhenLabel(screen.offer.when, screen.offer.days, locale)}`,
                 `Check time: ${lightWhenLabel(screen.offer.when, screen.offer.days, locale)}`)}
            </p>
            <div className="mt-4 flex flex-col sm:flex-row sm:items-center gap-2">
              <Button variant="accent" size="md" onClick={() => void acceptOffer()} disabled={busy || !offerText.trim()}>
                {L('걸어둘게요', "I'll leave it")}
              </Button>
              <Button variant="ghost" size="md" onClick={declineOffer} disabled={busy}>
                {L('그냥 갈래요', "I'm good, thanks")}
              </Button>
            </div>
            <div className="mt-4">{deepenLink}</div>
          </motion.div>
        )}

        {screen.kind === 'escalate' && (
          <motion.div
            key="escalate"
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.3, ease: EASE }}
            className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 md:p-6"
          >
            {mirrorBlock(screen.mirror)}
            <p className="mt-4 text-[15.5px] md:text-[16.5px] font-semibold text-[var(--text-primary)]" style={{ fontFamily: 'var(--font-display)' }}>
              {L('오늘 것 하나가 아니라, 더 큰 얘기네요.', "This isn't just today's call. It's a bigger story.")}
            </p>
            <div className="mt-3 rounded-lg bg-[var(--accent)]/[0.04] px-4 py-3">
              <p className="text-[14.5px] leading-[1.6] text-[var(--text-primary)] whitespace-pre-wrap break-words">
                {screen.biggerQuestion}
              </p>
            </div>
            <div className="mt-4 flex flex-col sm:flex-row sm:items-center gap-2">
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
            className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 md:p-6"
          >
            {screen.variant === 'accepted' ? (
              <>
                {screen.sentence && (
                  <div className="mb-3 rounded-lg bg-[var(--accent)]/[0.04] px-4 py-3">
                    <p className="text-[15px] leading-[1.6] text-[var(--text-primary)] font-medium break-words">
                      {screen.sentence}
                    </p>
                  </div>
                )}
                <p className="text-[15px] leading-[1.65] text-[var(--text-primary)]" style={{ fontFamily: 'var(--font-display)' }}>
                  {ko
                    ? `걸어뒀어요. ${screen.checkLabel}에 딱 한 번 물어볼게요.`
                    : `It's up. I'll ask exactly once, ${screen.checkLabel}.`}
                </p>
              </>
            ) : (
              <p className="text-[15px] leading-[1.65] text-[var(--text-primary)]" style={{ fontFamily: 'var(--font-display)' }}>
                {L('네, 여기까지도 충분해요. 필요하면 언제든요.', "That's plenty for today. I'm here whenever you need.")}
              </p>
            )}
            <div className="mt-4">
              <Button variant="secondary" size="sm" onClick={onClose}>
                {L('처음으로', 'Back to start')}
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── BELOW: the accumulating record (stacked, collapsible — never a step rail) ── */}
      {qas.length > 0 && (
        <div className="mt-7">
          <button
            type="button"
            onClick={() => setRecordOpen((o) => !o)}
            aria-expanded={recordOpen}
            className="flex items-center gap-1.5 px-1 py-1.5 text-[12.5px] font-medium text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors cursor-pointer"
          >
            <ChevronDown size={13} className={`transition-transform ${recordOpen ? '' : '-rotate-90'}`} />
            {L(`지금까지 나눈 이야기 ${qas.length}개`, `${qas.length} exchange${qas.length === 1 ? '' : 's'} so far`)}
          </button>
          {recordOpen && (
            <div className="mt-1 space-y-2.5 px-1">
              {qas.map((qa, i) => (
                <div key={i} className="rounded-xl bg-[var(--surface)]/60 border border-[var(--border-subtle)]/70 px-4 py-3">
                  <p className="text-[12.5px] leading-snug text-[var(--text-tertiary)] break-words">{qa.question}</p>
                  <p className="mt-1 text-[13.5px] leading-snug text-[var(--text-primary)] break-words">{qa.answer}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
