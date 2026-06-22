'use client';

import { ReframeStep } from '@/components/workspace/ReframeStep';
import { StepIntro } from '@/components/workspace/StepIntro';
import { useLocaleRouter } from '@/hooks/useLocaleRouter';

export default function ReframePage() {
  const router = useLocaleRouter();
  return (
    <>
      <StepIntro stepKey="reframe" />
      <ReframeStep onNavigate={(step) => router.push(`/tools/${step}`)} />
    </>
  );
}
