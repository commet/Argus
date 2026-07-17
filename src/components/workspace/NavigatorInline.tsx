'use client';

import type { CoachingStep } from '@/lib/navigator';

interface NavigatorInlineProps {
  step: CoachingStep;
}

/**
 * E1 quarantine boundary for the legacy workspace.
 *
 * The previous implementation converted eval scores, AI-generated assumptions,
 * override frequency, and persona simulations into personalized coaching. Keep
 * the mount point stable, but render no derived coaching until E2 can prove a
 * scoped grant and write an InfluenceTrace for the use.
 */
export function NavigatorInline({ step }: NavigatorInlineProps) {
  void step;
  return null;
}
