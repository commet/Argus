'use client';

import { RecastStep } from '@/components/workspace/RecastStep';
import { StepIntro } from '@/components/workspace/StepIntro';
import { useLocaleRouter } from '@/hooks/useLocaleRouter';

export default function RecastPage() {
  const router = useLocaleRouter();
  return (
    <>
      <StepIntro stepKey="recast" />
      <RecastStep onNavigate={(step) => router.push(`/tools/${step}`)} />
    </>
  );
}
