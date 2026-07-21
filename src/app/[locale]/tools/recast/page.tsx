'use client';

import { RecastStep } from '@/components/workspace/RecastStep';
import { StepIntro } from '@/components/workspace/StepIntro';
import { useLocaleRouter } from '@/hooks/useLocaleRouter';
import { useLocale } from '@/hooks/useLocale';

export default function RecastPage() {
  const router = useLocaleRouter();
  const locale = useLocale();
  return (
    <>
      <h1 className="sr-only">{locale === 'ko' ? '실행 설계' : 'Design the execution plan'}</h1>
      <StepIntro stepKey="recast" />
      <RecastStep onNavigate={(step) => router.push(`/tools/${step}`)} />
    </>
  );
}
