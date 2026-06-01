'use client';

import { useMemo } from 'react';
import { Music2 } from 'lucide-react';
import { getStepCoaching, buildNavigatorProfile } from '@/lib/navigator';
import type { CoachingStep, StepCoaching } from '@/lib/navigator';

interface NavigatorInlineProps {
  step: CoachingStep;
}

const TONE_STYLES = {
  neutral: { bg: 'bg-[var(--gold-muted)]', border: 'border-[var(--gold)]/20', icon: 'text-[var(--gold)]', pill: 'bg-[var(--gold-muted)] text-[var(--gold)]' },
  positive: { bg: 'bg-emerald-500/5', border: 'border-emerald-500/20', icon: 'text-emerald-500', pill: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' },
  counterfactual: { bg: 'bg-blue-500/5', border: 'border-blue-500/20', icon: 'text-blue-500', pill: 'bg-blue-500/10 text-blue-600 dark:text-blue-400' },
  challenge: { bg: 'bg-amber-500/5', border: 'border-amber-500/20', icon: 'text-amber-500', pill: 'bg-amber-500/10 text-amber-600 dark:text-amber-400' },
};

function CoachingItem({ coaching }: { coaching: StepCoaching }) {
  const tone = coaching.tone || 'neutral';
  const s = TONE_STYLES[tone];
  const isLong = !!coaching.detail;

  if (!isLong) {
    return (
      <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] ${s.pill}`}>
        <Music2 size={11} />
        <span>{coaching.message}</span>
      </div>
    );
  }

  return (
    <div className={`rounded-2xl border ${s.border} ${s.bg} p-3`}>
      <div className="flex items-start gap-2">
        <Music2 size={13} className={`${s.icon} mt-0.5 shrink-0`} />
        <div>
          <p className="text-[12px] font-medium text-[var(--text-primary)]">{coaching.message}</p>
          <p className="text-[11px] text-[var(--text-secondary)] mt-0.5">{coaching.detail}</p>
        </div>
      </div>
    </div>
  );
}

export function NavigatorInline({ step }: NavigatorInlineProps) {
  const coachingItems = useMemo(() => {
    const profile = buildNavigatorProfile();
    return getStepCoaching(step, profile);
  }, [step]);

  if (coachingItems.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      {coachingItems.map((item, i) => (
        <CoachingItem key={`${step}-coaching-${i}`} coaching={item} />
      ))}
    </div>
  );
}
