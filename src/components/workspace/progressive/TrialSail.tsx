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

import { useEffect, useMemo, useRef } from 'react';
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

  // Display-only crew labels — stable for the component's lifetime.
  const labels = useMemo(() => probeExecutorLabels(N_EXECUTORS), []);

  // Self-drive ONCE per session (store is transient; status guards re-entry).
  const startedRef = useRef(false);
  useEffect(() => {
    if (startedRef.current || !paragraph.trim()) return;
    if (useProbeStore.getState().status !== 'idle') return;
    startedRef.current = true;

    const store = useProbeStore.getState();
    store.begin(N_EXECUTORS);
    const abort = new AbortController();

    (async () => {
      try {
        const [div, abl] = await Promise.all([
          runDivergenceProbe(paragraph, {
            n: N_EXECUTORS,
            signal: abort.signal,
            onSample: (_i, sample) => useProbeStore.getState().sampleArrived(sample),
          }),
          runAblationProbe(paragraph, { signal: abort.signal }),
        ]);
        useProbeStore.getState().completed({
          forks: div.forks,
          findings: abl.findings,
          calls: [...div.calls, ...abl.calls],
        });
      } catch (e) {
        if (e instanceof DOMException && e.name === 'AbortError') return;
        // A failed probe never blocks the voyage — quiet degrade (P3).
        useProbeStore.getState().completed({ forks: [], findings: [], calls: [] });
      }
    })();

    return () => abort.abort();
  }, [paragraph]);

  if (status === 'idle') return null;

  const done = status === 'done';

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: EASE }}
      className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] p-4 md:p-5 space-y-3"
    >
      {/* The honest frame: same brief, read separately. */}
      <div>
        <p className="text-[13.5px] font-semibold text-[var(--text-primary)]">
          {L(`당신의 브리프를 선원 ${N_EXECUTORS}명에게 그대로 줬어요`, `Your brief went to ${N_EXECUTORS} crew members, as-is`)}
        </p>
        <p className="text-[11.5px] text-[var(--text-tertiary)] mt-0.5">
          {L('같은 브리프를 따로따로 읽었어요 — 서로 다른 지시는 없었어요.', 'Each read the same brief separately — no differing instructions.')}
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
                  <span className="ml-auto text-[10px] text-[var(--text-tertiary)] animate-pulse">
                    {L('읽는 중', 'reading')}
                  </span>
                )}
              </div>
              {sample ? (
                <motion.dl initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-1.5">
                  {(Object.keys(FIELD_LABEL) as (keyof ProbeSample)[]).map((f) => (
                    <div key={f}>
                      <dt className="text-[9.5px] uppercase tracking-wide text-[var(--text-tertiary)]">
                        {L(FIELD_LABEL[f].ko, FIELD_LABEL[f].en)}
                      </dt>
                      <dd className="text-[11.5px] text-[var(--text-secondary)] leading-[1.45] line-clamp-2">
                        {sample[f]}
                      </dd>
                    </div>
                  ))}
                </motion.dl>
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
              <p className="text-[11px] font-semibold text-[var(--accent)] tabular-nums">
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
                    <p className="text-[11.5px] text-[var(--text-secondary)] mt-1 leading-[1.5]">
                      {fork.variants.join(L(' ↔ ', ' ↔ '))}
                    </p>
                    <p className="text-[11.5px] text-[var(--accent)] mt-1.5 leading-[1.5]">
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
                    <p className="text-[11.5px] text-[var(--text-secondary)] mt-1 leading-[1.5]">{f.why_unsupported}</p>
                  </div>
                </div>
              </div>
            ))}

            {/* 침묵 카드 — convergence is a real, honest result (P3). */}
            {silent && (
              <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg)] p-3 flex items-start gap-2">
                <Anchor size={12} className="text-[var(--text-tertiary)] mt-0.5 shrink-0" />
                <p className="text-[12px] text-[var(--text-secondary)] leading-[1.55]">
                  {L(
                    '선원들이 같은 곳으로 갔어요. 이 텍스트 안에서 잴 수 있는 갈림은 없었어요 — 남은 위험은 텍스트 밖이에요.',
                    'The crew sailed to the same place. Nothing measurably forked inside this text — what risk remains lives outside it.',
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
