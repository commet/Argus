'use client';

/**
 * TrialSail — 시험 항해 극장 (W2.3, behind `new_arc_enabled` / ?arc=1).
 *
 * "당신의 브리프를 선원 {N}명에게 그대로 줬어요." The brief goes to N blind
 * executors (probe-engine C lever — ZERO differentiation instructions); their
 * cards fill in arrival order wearing display-only persona labels (W1.5② —
 * the labels never touch the prompts; probe-engine does not import them).
 * Meanwhile the D lever (하중 탐침, the G0-primary measurement) reads the
 * brief's load-bearing claims.
 *
 * Copy discipline (P1–P3): everything here is a MEASUREMENT, never a verdict.
 *  - Fork callout: quotes the user's own phrase + "이 선택에 따라 '{인용}'이
 *    참도 거짓도 됩니다."
 *  - Zero forks → the silence card: "선원들이 같은 곳으로 갔어요. 남은 위험은
 *    텍스트 밖이에요." Silence is output, not failure.
 *  - The honest line: "같은 브리프를 따로따로 읽었어요" — who read it, never
 *    that they differ BECAUSE of who they are.
 *
 * 적층, not 교체: this renders ALONGSIDE the existing analysis stream; the
 * deepening loop (몰입의 검증된 원천) is untouched. Question injection from
 * forks is W2.3b — this component only measures and shows.
 *
 * Self-driving: starts its probes once per session (guarded by useProbeStore
 * status), ~5 cheap calls total (C: 3 fast + 1 merge, D: 1) — within the
 * ≤8-call probe budget. All text renders through JSX → auto-escaped.
 */

import { useEffect, useMemo } from 'react';

// Run token (module scope — survives StrictMode remounts): late callbacks from
// a superseded run must not touch the store.
let trialSailRunSeq = 0;
import { motion, AnimatePresence } from 'framer-motion';
import { Anchor, Quote, Scale } from 'lucide-react';
import { useLocale } from '@/hooks/useLocale';
import { useProbeStore } from '@/stores/useProbeStore';
import { runDivergenceProbe, runAblationProbe } from '@/lib/probe-engine';
import type { ProbeSample, Fork, AblationFinding } from '@/lib/probe-engine';
import { probeExecutorLabels } from '@/lib/probe-labels';
import { EASE } from './shared/constants';

const N_EXECUTORS = 3;

const FIELD_LABEL: Record<keyof ProbeSample, { ko: string; en: string }> = {
  week1_action: { ko: '첫 주에 할 일', en: 'First week' },
  key_resource: { ko: '핵심 자원', en: 'Key resource' },
  success_test: { ko: '성공 확인법', en: 'Success test' },
  purpose_reading: { ko: '목적 해석', en: 'Purpose read' },
};

export function TrialSail({ paragraph }: { paragraph: string }) {
  const locale = useLocale();
  const ko = locale === 'ko';
  const L = (k: string, e: string) => (ko ? k : e);

  const status = useProbeStore((s) => s.status);
  const samples = useProbeStore((s) => s.samples);
  const expected = useProbeStore((s) => s.expected);
  const forks = useProbeStore((s) => s.forks);
  const findings = useProbeStore((s) => s.findings);
  const silent = useProbeStore((s) => s.silent);
  const ablationFailed = useProbeStore((s) => s.ablationFailed);

  // Display-only crew labels — stable for the component's lifetime.
  const labels = useMemo(() => probeExecutorLabels(N_EXECUTORS), []);

  // Self-drive once per session. StrictMode-safe: dev double-mount aborts
  // run #1 in cleanup and RESETS to idle so mount #2 re-runs cleanly; a run
  // token makes run #1's late async callbacks no-ops so they can't pollute
  // run #2's state. (G-W1 contact #1 found the original version turning the
  // StrictMode abort into a fake convergence-silence — never again.)
  useEffect(() => {
    if (!paragraph.trim()) return;
    const st = useProbeStore.getState();
    if (st.status !== 'idle') {
      // Same paragraph → this run (or its finished result) is ours; don't re-probe.
      if (st.paragraph === paragraph) return;
      // Different paragraph → a PREVIOUS session's probe is still in the global
      // store (done/error states survive unmount by design, so a reload shows
      // the result). Wipe it — otherwise this session would render the old
      // session's samples/forks and even inject its stale questions.
      st.reset();
    }

    const myRun = ++trialSailRunSeq;
    const mine = () => trialSailRunSeq === myRun;
    useProbeStore.getState().begin(N_EXECUTORS, paragraph);
    const abort = new AbortController();

    (async () => {
      try {
        const [div, abl] = await Promise.all([
          runDivergenceProbe(paragraph, {
            n: N_EXECUTORS,
            signal: abort.signal,
            onSample: (_i, sample) => { if (mine()) useProbeStore.getState().sampleArrived(sample); },
          }),
          runAblationProbe(paragraph, { signal: abort.signal }),
        ]);
        if (!mine()) return; // a newer run owns the store now
        if (div.failed && abl.failed) {
          // Both measurements failed → honest failure state, not silence.
          useProbeStore.getState().failed('측정이 닿지 않았어요');
          return;
        }
        useProbeStore.getState().completed({
          forks: div.forks,
          findings: abl.findings,
          calls: [...div.calls, ...abl.calls],
          // D alone failing must not let C's convergence wear the silence card
          // (failure ≠ silence — the half that failed didn't measure anything).
          ablationFailed: !!abl.failed,
        });
      } catch (e) {
        if (!mine()) return;
        if (e instanceof DOMException && e.name === 'AbortError') {
          // Aborted mid-flight (unmount) — wipe, don't pretend.
          useProbeStore.getState().reset();
          return;
        }
        useProbeStore.getState().failed('측정이 닿지 않았어요');
      }
    })();

    return () => {
      abort.abort();
      // Synchronous part of cleanup: if this run still owns the store and is
      // unfinished, clear the half-state so a remount starts fresh. The async
      // catch above also resets, but only while it still owns the run.
      if (mine() && useProbeStore.getState().status !== 'done' && useProbeStore.getState().status !== 'error') {
        useProbeStore.getState().reset();
      }
    };
  }, [paragraph]);

  if (status === 'idle') return null;

  // Honest failure: one quiet line, no theater pretending (failure ≠ silence).
  if (status === 'error') {
    return (
      <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] px-4 py-3">
        <p className="text-[12px] text-[var(--text-tertiary)]">
          {L('이번엔 결과를 받지 못했어요 — 이 측정 없이 계속할게요.', 'No reading came back this time — continuing without it.')}
        </p>
      </div>
    );
  }

  const done = status === 'done';

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: EASE }}
      className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] p-4 md:p-5 space-y-3"
    >
      {/* The honest frame: same text, read separately. "AI 선원" is explicit —
          without it, "줬어요" read as "my confidential plan went to PEOPLE"
          (novice audit, a would-quit moment). */}
      <div>
        <p className="text-[13.5px] font-semibold text-[var(--text-primary)]">
          {L(`적으신 내용을 AI 검토자 ${N_EXECUTORS}명이 그대로 읽었어요`, `${N_EXECUTORS} AI reviewers read your text, as-is`)}
        </p>
        <p className="text-[13px] text-[var(--text-tertiary)] mt-0.5">
          {L('같은 글을 따로따로 읽었어요 — 서로 다른 지시는 없었고, 내용은 분석에만 쓰여요.', 'Each read the same text separately — no differing instructions, and it stays inside the analysis.')}
        </p>
      </div>

      {/* Executor cards, arrival order. */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
        {Array.from({ length: expected }, (_, i) => {
          const sample = samples[i] ?? null;
          const label = labels[i] ?? labels[0];
          return (
            <div
              key={i}
              className={`rounded-xl border p-3 transition-colors ${
                sample ? 'border-[var(--border)] bg-[var(--bg)]' : 'border-dashed border-[var(--border-subtle)]'
              }`}
            >
              <div className="flex items-center gap-1.5 mb-2">
                <span className="text-[14px]" aria-hidden>{label.avatar}</span>
                <span className="text-[12px] font-semibold text-[var(--text-primary)]">{label.name}</span>
                {!sample && (
                  <span className={`ml-auto text-[12px] text-[var(--text-tertiary)] ${done ? '' : 'animate-pulse'}`}>
                    {done ? L('응답 없음', 'no response') : L('읽는 중', 'reading')}
                  </span>
                )}
              </div>
              {sample ? (
                <motion.dl initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-1.5">
                  {(Object.keys(FIELD_LABEL) as (keyof ProbeSample)[]).map((f) => (
                    <div key={f}>
                      <dt className="text-[13px] uppercase tracking-wide text-[var(--text-tertiary)]">
                        {L(FIELD_LABEL[f].ko, FIELD_LABEL[f].en)}
                      </dt>
                      <dd className="text-[13px] text-[var(--text-secondary)] leading-[1.45] line-clamp-2">
                        {sample[f]}
                      </dd>
                    </div>
                  ))}
                </motion.dl>
              ) : done ? (
                // Honest no-show: a frozen skeleton reads as "loading stuck" —
                // say plainly that this reading never arrived.
                <p className="text-[12.5px] text-[var(--text-tertiary)] leading-[1.5]">
                  {L('이 검토의 응답을 받지 못했어요.', "This review didn't arrive.")}
                </p>
              ) : (
                <div className="space-y-1.5">
                  {[0, 1, 2, 3].map((r) => (
                    <div key={r} className="h-3 rounded bg-[var(--surface)] animate-pulse" />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Measurement results — forks / load-bearing claims / silence. */}
      <AnimatePresence>
        {done && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            transition={{ duration: 0.35, ease: EASE }}
            className="overflow-hidden space-y-2"
          >
            {/* Reverse convergence chip — 갈림 수가 곧 게이지. */}
            {forks.length > 0 && (
              <p className="text-[12.5px] font-semibold text-[var(--accent)] tabular-nums">
                {L(`갈림 ${forks.length}곳`, `${forks.length} fork${forks.length === 1 ? '' : 's'}`)}
              </p>
            )}

            {forks.map((fork: Fork, i: number) => (
              <div key={i} className="rounded-xl border border-[var(--accent)]/25 bg-[var(--ai)]/40 p-3">
                <div className="flex items-start gap-2">
                  <Quote size={12} className="text-[var(--accent)] mt-0.5 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-[12px] text-[var(--text-primary)] leading-[1.5]">
                      {L('이 구절에서 갈렸어요: ', 'They split on: ')}
                      <span className="font-semibold">&ldquo;{fork.cause_quote}&rdquo;</span>
                    </p>
                    <p className="text-[13px] text-[var(--text-secondary)] mt-1 leading-[1.5]">
                      {fork.variants.join(L(' ↔ ', ' ↔ '))}
                    </p>
                    <p className="text-[13px] text-[var(--accent)] mt-1.5 leading-[1.5]">
                      {L(
                        `이 선택에 따라 "${fork.flipped_user_claim}"이 참도 거짓도 됩니다.`,
                        `Depending on this, "${fork.flipped_user_claim}" becomes true or false.`,
                      )}
                    </p>
                  </div>
                </div>
              </div>
            ))}

            {findings.map((f: AblationFinding, i: number) => (
              <div key={i} className="rounded-xl border border-[var(--border)] bg-[var(--bg)] p-3">
                <div className="flex items-start gap-2">
                  <Scale size={12} className="text-[var(--text-tertiary)] mt-0.5 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-[12px] text-[var(--text-primary)] leading-[1.5]">
                      {L('이 문장이 결론을 받치고 있어요: ', 'This sentence is load-bearing: ')}
                      <span className="font-semibold">&ldquo;{f.load_bearing_claim}&rdquo;</span>
                    </p>
                    <p className="text-[13px] text-[var(--text-secondary)] mt-1 leading-[1.5]">{f.why_unsupported}</p>
                  </div>
                </div>
              </div>
            ))}

            {/* Honest partial failure: D (the primary lever) didn't land. One
                quiet line — never the silence card (failure ≠ convergence). */}
            {ablationFailed && (
              <p className="text-[12.5px] text-[var(--text-tertiary)]">
                {L('하중 측정은 이번에 닿지 않았어요.', "The load-bearing measurement didn't land this time.")}
              </p>
            )}

            {/* 침묵 카드 — convergence is a real, honest result (P3). */}
            {silent && (
              <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg)] p-3 flex items-start gap-2">
                <Anchor size={12} className="text-[var(--text-tertiary)] mt-0.5 shrink-0" />
                <p className="text-[12px] text-[var(--text-secondary)] leading-[1.55]">
                  {L(
                    'AI 검토자들이 같은 결론에 도달했어요. 이 글 안에서는 뚜렷한 갈림이 없었고, 남은 위험은 글 밖에서 확인해야 해요. 바로 마무리해도 괜찮아요.',
                    'The AI reviewers reached the same conclusion. Nothing clearly forked inside this text; the remaining risk needs checking outside it. You can move straight to the finish.',
                  )}
                </p>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
