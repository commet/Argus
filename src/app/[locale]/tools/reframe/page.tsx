'use client';

import { ReframeStep } from '@/components/workspace/ReframeStep';
import { StepIntro } from '@/components/workspace/StepIntro';
import { useLocaleRouter } from '@/hooks/useLocaleRouter';
import { useLocale } from '@/hooks/useLocale';

export default function ReframePage() {
  const router = useLocaleRouter();
  const locale = useLocale();
  return (
    <>
      <h1 className="sr-only">{locale === 'ko' ? '문제 재정의' : 'Reframe the problem'}</h1>
      <StepIntro stepKey="reframe" />
      <ReframeStep onNavigate={(step) => router.push(`/tools/${step}`)} />
    </>
  );
}
