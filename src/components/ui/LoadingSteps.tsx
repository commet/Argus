'use client';

import { useEffect, useState } from 'react';
import { useLocale } from '@/hooks/useLocale';
import { VoyageShip, Graticule } from '@/components/ui/VoyageElements';
import { ArgusMascot } from '@/components/brand/ArgusMascot';

interface LoadingStepsProps {
  steps: string[];
  intervalMs?: number;
}

/**
 * Voyage loading state for the legacy tools (Reframe / Rehearse / Synthesize).
 *
 * The old timer-driven checkmark ladder read as fake progress — it advanced on a
 * clock, not on real work, and had to disclaim itself. This is honest instead: a
 * ship under sail = "the voyage is underway", the phase copy cycles as a single
 * calm line (not a ladder pretending each rung is done), and the ONE real number
 * (elapsed seconds) surfaces only after a few seconds so it never reads as nervous.
 *
 * Honesty carried over from the old P1-C5 design: real wall-clock, an explicit
 * "approximate" note once the last phase lingers, and llm.ts backoff retries
 * surfaced as machine state (argus:llm-retry) rather than a silent stall.
 */
export function LoadingSteps({ steps, intervalMs = 2500 }: LoadingStepsProps) {
  const locale = useLocale();
  const L = (ko: string, en: string) => (locale === 'ko' ? ko : en);
  const [currentStep, setCurrentStep] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [retryNote, setRetryNote] = useState<string | null>(null);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentStep((prev) => Math.min(prev + 1, steps.length - 1));
    }, intervalMs);
    return () => clearInterval(interval);
  }, [steps.length, intervalMs]);

  // Real wall-clock — the one number here that isn't staged.
  useEffect(() => {
    const t = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, []);

  // P1-C2 companion: a backoff wait between LLM attempts is 5–15s of silence —
  // name it as machine state ("retrying 2/3"), fact-only.
  useEffect(() => {
    const onRetry = (e: Event) => {
      const d = (e as CustomEvent).detail as { attempt?: number; max?: number } | undefined;
      if (!d?.attempt || !d?.max) return;
      setRetryNote(
        locale === 'ko'
          ? `일시적인 오류가 있어 다시 시도하는 중 (${d.attempt}/${d.max})…`
          : `Hit a temporary error — retrying (${d.attempt}/${d.max})…`,
      );
    };
    window.addEventListener('argus:llm-retry', onRetry);
    return () => window.removeEventListener('argus:llm-retry', onRetry);
  }, [locale]);

  // "Lingering": we've sat on the final staged phase for 10s+ — the moment the
  // theater would start lying if we stayed silent.
  const lastStepAtSec = ((steps.length - 1) * intervalMs) / 1000;
  const lingering = currentStep === steps.length - 1 && elapsed >= lastStepAtSec + 10;

  const note = retryNote
    ? retryNote
    : lingering
      ? L('아직 항해 중이에요 — 단계 표시는 대략적인 안내예요', 'Still sailing — the phase list is an approximate guide')
      : elapsed >= 4
        ? L(`${elapsed}초째 항해 중`, `${elapsed}s underway`)
        : '';
  const showCompanion = lingering || elapsed >= 12;

  return (
    <div className="relative overflow-hidden rounded-xl py-10">
      <Graticule opacity={0.05} spacing={22} />
      <div className="relative flex flex-col items-center text-center px-4">
        <VoyageShip state="sailing" size={72} title={steps[currentStep]} />
        <p key={currentStep} className="mt-3 text-[14px] font-semibold text-[var(--text-primary)] animate-fade-in">
          {steps[currentStep]}
        </p>
        <p className="mt-1.5 text-[11px] text-[var(--text-tertiary)] min-h-[15px]" aria-live="polite">
          {note}
        </p>
        {showCompanion && (
          <div className="mt-4">
            <ArgusMascot
              moment="watching"
              size="md"
              alt={L('작업을 함께 기다리는 Argus', 'Argus keeping watch while the work continues')}
              className="opacity-90"
            />
          </div>
        )}
      </div>
    </div>
  );
}
