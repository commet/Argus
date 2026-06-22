'use client';

import { RehearseStep } from '@/components/workspace/RehearseStep';
import { StepIntro } from '@/components/workspace/StepIntro';
import { useLocaleRouter } from '@/hooks/useLocaleRouter';

export default function RehearsePage() {
  const router = useLocaleRouter();
  return (
    <>
      <StepIntro stepKey="rehearse" />
      <RehearseStep onNavigate={(step) => router.push(`/tools/${step}`)} />
    </>
  );
}
