import { AgentHub } from '@/components/agents/AgentHub';
import type { Metadata } from 'next';

const META = {
  ko: { title: 'AI 검토 방식 — Argus', description: '판단의 성격에 따라 Argus가 사용하는 검토 역할과 범위를 살펴보세요.' },
  en: { title: 'AI Review Modes — Argus', description: 'See the review roles Argus can use according to the judgment at hand.' },
} as const;

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const lang: 'ko' | 'en' = locale === 'ko' ? 'ko' : 'en';
  return META[lang];
}

export default function AgentsPage() {
  return <AgentHub />;
}
