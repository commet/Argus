'use client';

import { SynthesizeStep } from '@/components/workspace/SynthesizeStep';
import { StepIntro } from '@/components/workspace/StepIntro';
import { useLocaleRouter } from '@/hooks/useLocaleRouter';
import { useLocale } from '@/hooks/useLocale';

export default function SynthesizePage() {
  const router = useLocaleRouter();
  const locale = useLocale();
  return (
    <>
      <h1 className="sr-only">{locale === 'ko' ? '최종 정리' : 'Synthesize the final decision'}</h1>
      <StepIntro stepKey="synthesize" />
      <SynthesizeStep onNavigate={(step) => router.push(`/tools/${step}`)} />
    </>
  );
}
