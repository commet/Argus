'use client';

import { useMemo } from 'react';
import { Compass } from 'lucide-react';
import { Graticule } from '@/components/ui/VoyageElements';
import { getStepCoaching, buildNavigatorProfile } from '@/lib/navigator';
import type { CoachingStep, StepCoaching } from '@/lib/navigator';

interface NavigatorInlineProps {
  step: CoachingStep;
}

/* The compass glyph is the Navigator's constant mark (voyage language, echoing
   Graticule/ChartEdge). Tone is carried by the compass color, not by a colored
   left rail (that callout-rail is a generic-AI cliché). */
const TONE_ACCENT: Record<string, string> = {
  neutral: 'var(--accent)',
  positive: '#10b981',
  counterfactual: '#3b82f6',
  challenge: '#f59e0b',
};

function CoachingItem({ coaching }: { coaching: StepCoaching }) {
  const tone = coaching.tone || 'neutral';
  const accent = TONE_ACCENT[tone] || TONE_ACCENT.neutral;
  const isLong = !!coaching.detail;

  if (!isLong) {
    return (
      <div className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border-subtle)] bg-[var(--ai)] px-3 py-1.5 text-[12px] text-[var(--text-primary)]">
        <Compass size={12} style={{ color: accent }} aria-hidden="true" />
        <span>{coaching.message}</span>
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden rounded-[14px] border border-[var(--border-subtle)] bg-[var(--ai)] p-3.5">
      <Graticule opacity={0.05} spacing={20} />
      <div className="relative flex items-start gap-3">
        <Compass size={22} style={{ color: accent }} className="mt-0.5 shrink-0" aria-hidden="true" />
        <div>
          <p className="text-[12.5px] font-semibold text-[var(--text-primary)] leading-snug">{coaching.message}</p>
          <p className="text-[11.5px] text-[var(--text-secondary)] mt-0.5 leading-relaxed">{coaching.detail}</p>
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
