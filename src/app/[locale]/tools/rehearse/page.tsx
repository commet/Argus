'use client';

import { RehearseStep } from '@/components/workspace/RehearseStep';
import { StepIntro } from '@/components/workspace/StepIntro';
import { useLocaleRouter } from '@/hooks/useLocaleRouter';
import { useLocale } from '@/hooks/useLocale';

export default function RehearsePage() {
  const router = useLocaleRouter();
  const locale = useLocale();
  return (
    <>
      <h1 className="sr-only">{locale === 'ko' ? '이해관계자 리허설' : 'Rehearse with stakeholders'}</h1>
      <StepIntro stepKey="rehearse" />
      <RehearseStep onNavigate={(step) => router.push(`/tools/${step}`)} />
    </>
  );
}
