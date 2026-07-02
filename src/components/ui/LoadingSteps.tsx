'use client';

import { useEffect, useState } from 'react';
import { Loader2, Check } from 'lucide-react';
import { useLocale } from '@/hooks/useLocale';

interface LoadingStepsProps {
  steps: string[];
  intervalMs?: number;
}

/**
 * Timer-driven step list for the legacy tools (Reframe / Rehearse / Synthesize).
 *
 * P1-C5 honesty: the step advance is a CLOCK, not real progress — so we (a)
 * show real elapsed seconds, (b) once the last step lingers past 10s, say
 * plainly that the step display is approximate, and (c) surface llm.ts
 * backoff retries (argus:llm-retry) instead of a silent stall. No fake
 * checkmark theater beyond what the caller's steps imply; a cancel wire is
 * deliberately NOT added (§5-3 — the 180s total budget caps the wait).
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

  // "Lingering": we've sat on the final staged step for 10s+ — the moment the
  // theater would start lying if we stayed silent.
  const lastStepAtSec = ((steps.length - 1) * intervalMs) / 1000;
  const lingering = currentStep === steps.length - 1 && elapsed >= lastStepAtSec + 10;

  return (
    <div className="py-8 max-w-sm mx-auto">
      <div className="space-y-3">
        {steps.map((step, i) => (
          <div
            key={i}
            className={`flex items-center gap-3 transition-all duration-300 ${
              i < currentStep ? 'opacity-50' : i === currentStep ? 'opacity-100' : 'opacity-30'
            }`}
          >
            <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 transition-colors ${
              i < currentStep
                ? 'bg-[var(--success)] text-[var(--bg)]'
                : i === currentStep
                ? 'bg-[var(--accent)] text-[var(--bg)]'
                : 'bg-[var(--border)] text-[var(--text-secondary)]'
            }`}>
              {i < currentStep ? (
                <Check size={12} />
              ) : i === currentStep ? (
                <Loader2 size={12} className="animate-spin" />
              ) : (
                <span className="text-[10px] font-bold">{i + 1}</span>
              )}
            </div>
            <span className={`text-[13px] ${
              i === currentStep ? 'font-semibold text-[var(--text-primary)]' : 'text-[var(--text-secondary)]'
            }`}>
              {step}
            </span>
          </div>
        ))}
      </div>
      <div className="mt-4 space-y-1 text-center">
        {retryNote && (
          <p className="text-[12px] text-[var(--text-secondary)]">{retryNote}</p>
        )}
        {lingering && !retryNote && (
          <p className="text-[12px] text-[var(--text-secondary)]">
            {L('아직 진행 중이에요 — 단계 표시는 대략적인 안내예요', 'Still working — the step list is an approximate guide')}
          </p>
        )}
        <p className="text-[11px] text-[var(--text-tertiary)]">
          {L(`${elapsed}초 경과`, `${elapsed}s elapsed`)}
        </p>
      </div>
    </div>
  );
}
