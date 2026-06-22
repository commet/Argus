'use client';

import { SynthesizeStep } from '@/components/workspace/SynthesizeStep';
import { StepIntro } from '@/components/workspace/StepIntro';
import { useLocaleRouter } from '@/hooks/useLocaleRouter';

export default function SynthesizePage() {
  const router = useLocaleRouter();
  return (
    <>
      <StepIntro stepKey="synthesize" />
      <SynthesizeStep onNavigate={(step) => router.push(`/tools/${step}`)} />
    </>
  );
}
